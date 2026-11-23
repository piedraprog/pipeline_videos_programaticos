// Blocks private or personal material from entering this public repository.
// Usage: node scripts/privacy-check.ts          -> files staged for commit (pre-commit hook)
//        node scripts/privacy-check.ts --all    -> every file in HEAD (pre-push hook, CI)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PrivacyConfig {
  publicBrands: string[];
  publicAssetDirs: string[];
  allowedEmailDomains: string[];
  skipContent: string[];
}

export interface Finding {
  file: string;
  line?: number;
  rule: string;
  detail: string;
}

const ASSET_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.pdf',
  '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wav', '.mp3',
  '.ttf', '.otf', '.woff', '.woff2',
]);
const PLACEHOLDER_USER_NAMES = new Set(['user', 'username', 'you', 'runner', 'name']);
const PLACEHOLDER_PHONE_DIGITS = /0{7}/;
const MIN_PHONE_DIGITS = 10;

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['API key (sk-)', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
];

export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}

function findPrivateTerm(text: string, privateTerms: string[]): string | undefined {
  const haystack = normalize(text);
  return privateTerms.find((term) => haystack.includes(normalize(term)));
}

export function checkPath(file: string, config: PrivacyConfig, privateTerms: string[]): Finding[] {
  const findings: Finding[] = [];
  if (isUnder(file, 'private')) {
    findings.push({ file, rule: 'private-dir', detail: 'private/ is local-only and must never be committed' });
  }
  const brand = /^brands\/([^/]+)\//.exec(file)?.[1];
  if (brand && !config.publicBrands.includes(brand)) {
    findings.push({ file, rule: 'brand-not-public', detail: `brand "${brand}" is not in publicBrands; keep it in private/brands/` });
  }
  const isAsset = ASSET_EXTENSIONS.has(path.extname(file).toLowerCase());
  if (isAsset && !config.publicAssetDirs.some((directory) => isUnder(file, directory))) {
    findings.push({ file, rule: 'asset-outside-public-dirs', detail: 'images, video, audio and fonts are only allowed inside publicAssetDirs' });
  }
  const term = findPrivateTerm(file, privateTerms);
  if (term) findings.push({ file, rule: 'private-term', detail: `path mentions "${term}"` });
  return findings;
}

function checkPlanBrand(file: string, content: string, config: PrivacyConfig): Finding[] {
  if (!/^plans\/[^/]+\.json$/.test(file)) return [];
  let brandPath: unknown;
  try {
    brandPath = (JSON.parse(content) as { brand?: unknown }).brand;
  } catch {
    return [{ file, rule: 'plan-unreadable', detail: 'plan is not valid JSON' }];
  }
  if (typeof brandPath !== 'string') return [];
  const brand = /^brands\/([^/]+)\//.exec(brandPath)?.[1];
  if (brand && config.publicBrands.includes(brand)) return [];
  return [{ file, rule: 'plan-uses-private-brand', detail: `plan points at "${brandPath}"; keep it in private/plans/` }];
}

function checkLine(line: string, config: PrivacyConfig, privateTerms: string[]): Array<Omit<Finding, 'file' | 'line'>> {
  const findings: Array<Omit<Finding, 'file' | 'line'>> = [];

  for (const match of line.matchAll(/\+\d[\d ().-]{7,18}\d|wa\.me\/\d{8,}/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= MIN_PHONE_DIGITS && !PLACEHOLDER_PHONE_DIGITS.test(digits)) {
      findings.push({ rule: 'phone-number', detail: `${match[0]} (use a placeholder such as +58 400-0000000)` });
    }
  }

  for (const match of line.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g)) {
    const domain = (match[1] ?? '').toLowerCase();
    if (!config.allowedEmailDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))) {
      findings.push({ rule: 'email', detail: match[0] });
    }
  }

  for (const match of line.matchAll(/[A-Za-z]:\\+Users\\+([^\\\s"'<>]+)|\/(?:home|Users)\/([A-Za-z0-9._-]+)\//g)) {
    const userName = (match[1] ?? match[2] ?? '').toLowerCase();
    if (!PLACEHOLDER_USER_NAMES.has(userName)) {
      findings.push({ rule: 'local-path', detail: `${match[0]} exposes a machine user name` });
    }
  }

  for (const [name, pattern] of SECRET_PATTERNS) {
    if (pattern.test(line)) findings.push({ rule: 'secret', detail: name });
  }

  const term = findPrivateTerm(line, privateTerms);
  if (term) findings.push({ rule: 'private-term', detail: `mentions "${term}"` });
  return findings;
}

export function checkContent(file: string, content: string, config: PrivacyConfig, privateTerms: string[]): Finding[] {
  const findings = checkPlanBrand(file, content, config);
  content.split(/\r?\n/).forEach((line, index) => {
    for (const finding of checkLine(line, config, privateTerms)) {
      findings.push({ file, line: index + 1, ...finding });
    }
  });
  return findings;
}

export function parsePrivateTerms(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function git(rootDir: string, args: string[]): Buffer {
  return execFileSync('git', args, { cwd: rootDir, maxBuffer: 64 * 1024 * 1024 });
}

function listFiles(rootDir: string, scanAll: boolean): string[] {
  const args = scanAll
    ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];
  return git(rootDir, args).toString('utf8').split('\0').filter(Boolean);
}

function readTextBlob(rootDir: string, file: string, scanAll: boolean): string | undefined {
  const blob = git(rootDir, ['show', `${scanAll ? 'HEAD' : ''}:${file}`]);
  return blob.includes(0) ? undefined : blob.toString('utf8');
}

function run(): void {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const scanAll = process.argv.includes('--all');
  const config = JSON.parse(readFileSync(path.join(rootDir, 'privacy.config.json'), 'utf8')) as PrivacyConfig;
  const termsPath = path.join(rootDir, '.private-terms');
  const privateTerms = existsSync(termsPath) ? parsePrivateTerms(readFileSync(termsPath, 'utf8')) : [];

  const findings: Finding[] = [];
  for (const file of listFiles(rootDir, scanAll)) {
    findings.push(...checkPath(file, config, privateTerms));
    const isAsset = ASSET_EXTENSIONS.has(path.extname(file).toLowerCase());
    if (isAsset || config.skipContent.includes(file)) continue;
    const content = readTextBlob(rootDir, file, scanAll);
    if (content !== undefined) findings.push(...checkContent(file, content, config, privateTerms));
  }

  if (findings.length === 0) {
    const scope = scanAll ? 'HEAD' : 'staged files';
    const terms = privateTerms.length > 0 ? `${privateTerms.length} private terms` : 'no .private-terms file, generic rules only';
    console.log(`privacy-check: ${scope} clean (${terms}).`);
    return;
  }
  console.error(`privacy-check: ${findings.length} problem(s). This repository is public.\n`);
  for (const finding of findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    console.error(`  ${location}  [${finding.rule}] ${finding.detail}`);
  }
  console.error('\nMove client or personal work to private/ (git-ignored), or replace the value with a placeholder.');
  console.error('If a finding is a false positive, adjust privacy.config.json in the same commit.');
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
