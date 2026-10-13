// bun run setup — prepares this repo to render on Linux or Windows. Idempotent; safe to re-run.
// 1) JS deps (bun install)  2) Playwright Chromium  3) ffmpeg (repo dep ffmpeg-static, else PATH)  4) Python + numpy/pillow (requirements.txt)
import {execFileSync,spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const win=process.platform==='win32';let bad=0;
const run=(cmd,args,o={})=>spawnSync(cmd,args,{cwd:root,stdio:'inherit',shell:win,...o}).status===0;
const ok=(m)=>console.log('  ok  '+m),fail=(m)=>{bad++;console.log('  FAIL '+m)};
const nv=+process.versions.node.split('.')[0];nv>=24?ok('node '+process.versions.node):fail('Node '+process.versions.node+' found; capture/tests need Node >= 24 (runs .ts natively).');
console.log('[1/4] JS dependencies');run('bun',['install'])?ok('bun install'):fail('bun install failed. Install Bun (https://bun.sh) and Node >= 24.');
console.log('[2/4] Playwright Chromium');run('npx',['playwright','install','chromium'])?ok('chromium'):fail('npx playwright install chromium failed (on Linux, also try: npx playwright install-deps chromium).');
console.log('[3/4] ffmpeg');
const {FF}=await import('../engines/gsap/tools/bin.mjs');
try{const v=execFileSync(FF,['-hide_banner','-filters'],{encoding:'utf8'});v.includes('tmix')?ok(`ffmpeg: ${FF}`):fail(`ffmpeg at ${FF} lacks the tmix filter; set FFMPEG=<path to full ffmpeg>`)}catch{fail('ffmpeg not found. It normally comes from the ffmpeg-static dependency; otherwise install it (Windows: winget install Gyan.FFmpeg; Linux: apt install ffmpeg) or set FFMPEG.')}
console.log('[4/4] Python + numpy/pillow');
const pys=win?['python','py']:['python3','python'];const py=pys.find(p=>spawnSync(p,['--version'],{stdio:'ignore'}).status===0);
if(!py)fail('Python 3.10+ not found. Windows: winget install Python.Python.3.12; Linux: apt install python3 python3-pip.');
else{const has=()=>spawnSync(py,['-c','import numpy,PIL'],{stdio:'ignore'}).status===0;
  if(!has()){const a=['-m','pip','install','--user','-r','requirements.txt'];if(!run(py,a,{shell:false}))run(py,[...a,'--break-system-packages'],{shell:false})}
  has()?ok(`${py} with numpy + pillow`):fail(`pip install -r requirements.txt failed for ${py}.`)}
console.log(bad?`\nSetup incomplete: ${bad} problem(s) above.`:'\nSetup OK. Try: bun run render -- plans/selltly-9x16-light.json --qa-only');process.exit(bad?1:0);
