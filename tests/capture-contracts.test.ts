import {test, expect} from 'bun:test';
import {mkdtemp, writeFile, readFile, rm, mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function runCapture(actions: unknown[], html: string) {
  const server = Bun.serve({port:0, fetch: () => new Response(html, {headers:{'Content-Type':'text/html'}})});
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'capture-contract-'));
  const projectName = `contract-${crypto.randomUUID()}`;
  const projectDir = path.resolve('projects', projectName);
  try {
    await mkdir(projectDir, {recursive:true});
    await writeFile(path.join(projectDir,'manifest.json'), '{"stale":true}');
    const plan = path.join(temporary, 'plan.json');
    await writeFile(plan, JSON.stringify({projectName, baseUrl:`http://localhost:${server.port}`, scenes:[{id:'one', durationFrames:30, actions}]}));
    const child = Bun.spawn(['node','src/capture.ts',plan], {stdout:'pipe',stderr:'pipe'});
    const [exit, errors] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    let manifest: string | null = null;
    try {manifest = await readFile(path.join(projectDir, 'manifest.json'),'utf8');} catch {}
    return {exit,errors,manifest};
  } finally {
    server.stop(true);
    // These explicit paths were created by this test and are bounded to the temp/project roots.
    await rm(temporary, {recursive:true,force:true});
    await rm(projectDir, {recursive:true,force:true});
  }
}

test('missing application readiness fails and invalidates a stale manifest', async () => {
  const result = await runCapture([{type:'waitFor',selector:'#loaded'},{type:'screenshot'}], '<h1>Loading</h1>');
  expect(result.exit).toBe(1);
  expect(result.errors).toContain('waitFor');
  expect(result.manifest).toBeNull();
}, 30000);

test('unexpected confirmation fails instead of rendering an incomplete flow', async () => {
  const result = await runCapture([{type:'click',selector:'button',dialog:{message:'Product added'}},{type:'screenshot'}], '<button onclick="alert(\'Request failed\')">Add</button>');
  expect(result.exit).toBe(1);
  expect(result.errors).toContain('Expected dialog containing');
  expect(result.manifest).toBeNull();
}, 30000);

test('missing confirmation cannot advance to screenshot', async () => {
  const result = await runCapture([{type:'click',selector:'button',dialog:{message:'Product added'}},{type:'screenshot'}], '<button>Add</button>');
  expect(result.exit).toBe(1);
  expect(result.errors).toContain('Timeout');
  expect(result.manifest).toBeNull();
}, 30000);
