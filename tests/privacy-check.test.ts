import { expect, test } from 'bun:test';
import { checkContent, checkPath, parsePrivateTerms, type PrivacyConfig } from '../scripts/privacy-check.ts';

const config: PrivacyConfig = {
  publicBrands: ['selltly'],
  publicAssetDirs: ['brands/selltly', 'demos'],
  allowedEmailDomains: ['example.com'],
  skipContent: [],
};
const rules = (findings: Array<{ rule: string }>) => findings.map((finding) => finding.rule);

test('rejects a brand kit that is not declared public', () => {
  expect(rules(checkPath('brands/acme/brand.json', config, []))).toEqual(['brand-not-public']);
  expect(checkPath('brands/selltly/brand.json', config, [])).toEqual([]);
});

test('rejects anything inside private/', () => {
  expect(rules(checkPath('private/plans/acme.json', config, []))).toContain('private-dir');
});

test('rejects media outside the public asset directories', () => {
  expect(rules(checkPath('plans/screenshot.png', config, []))).toEqual(['asset-outside-public-dirs']);
  expect(checkPath('brands/selltly/logo.png', config, [])).toEqual([]);
});

test('rejects a plan that points at a private brand', () => {
  const plan = JSON.stringify({ engine: 'gsap', brand: 'private/brands/acme/brand.json' });
  expect(rules(checkContent('plans/acme-demo.json', plan, config, []))).toEqual(['plan-uses-private-brand']);
  const publicPlan = JSON.stringify({ engine: 'gsap', brand: 'brands/selltly/brand.json' });
  expect(checkContent('plans/selltly.json', publicPlan, config, [])).toEqual([]);
});

test('rejects real phone numbers and accepts zero placeholders', () => {
  expect(rules(checkContent('a.json', '"contact": "+58 424-5551234"', config, []))).toEqual(['phone-number']);
  expect(rules(checkContent('a.json', 'https://wa.me/584245551234', config, []))).toEqual(['phone-number']);
  expect(checkContent('a.json', '"contact": "+58 400-0000000" wa.me/580000000000', config, [])).toEqual([]);
});

test('rejects emails outside the allowed domains', () => {
  expect(rules(checkContent('a.md', 'write to jane@acme.io', config, []))).toEqual(['email']);
  expect(checkContent('a.md', 'write to jane@example.com, see @remotion/gsap', config, [])).toEqual([]);
});

test('rejects local paths that expose a machine user', () => {
  expect(rules(checkContent('a.md', 'C:\\Users\\jane\\repo', config, []))).toEqual(['local-path']);
  expect(rules(checkContent('a.json', '"C:\\\\Users\\\\jane\\\\repo"', config, []))).toEqual(['local-path']);
  expect(rules(checkContent('a.md', 'file:///home/jane/repo', config, []))).toEqual(['local-path']);
  expect(checkContent('a.md', '/home/runner/work and C:\\Users\\you\\repo', config, [])).toEqual([]);
});

test('rejects credentials', () => {
  expect(rules(checkContent('a.env', `TOKEN=ghp_${'a'.repeat(36)}`, config, []))).toEqual(['secret']);
  expect(rules(checkContent('a.pem', '-----BEGIN RSA PRIVATE KEY-----', config, []))).toEqual(['secret']);
});

test('rejects private terms in paths and text, ignoring case and accents', () => {
  const terms = parsePrivateTerms('# clients\nAcme Corp\n\ncontraloría\n');
  expect(terms).toEqual(['Acme Corp', 'contraloría']);
  expect(rules(checkPath('plans/acme-corp-demo.json', config, ['acme-corp']))).toEqual(['private-term']);
  const found = checkContent('a.md', 'line one\nDemo de CONTRALORIA', config, terms);
  expect(found).toEqual([{ file: 'a.md', line: 2, rule: 'private-term', detail: 'mentions "contraloría"' }]);
});
