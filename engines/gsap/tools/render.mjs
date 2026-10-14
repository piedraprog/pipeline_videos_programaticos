// Usage: bun run render -- plans/<plan>.json [--qa-only] [--motion-check] [--workers=N]
// plan.template: index (default, brand pieces) | stock (no-text stock clips) | whatsapp (chat recreation)
import {FF,PY} from './bin.mjs';
import {chromium} from 'playwright';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';import os from 'node:os';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');

const planArg=process.argv[2];const qaOnly=process.argv.includes('--qa-only');
if(!planArg){console.error('Usage: node tools/render.mjs plans/<plan>.json [--qa-only]');process.exit(2)}
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)){r.writeHead(404);return r.end()}
  r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)}).listen(0);
const port=srv.address().port;
const plan=JSON.parse(fs.readFileSync(path.join(ROOT,planArg)));
const [W,H]={'16x9':[1920,1080],'9x16':[1080,1920],'1x1':[1080,1080]}[plan.format];
const out=path.join(ROOT,plan.output);fs.mkdirSync(path.join(out,'qa'),{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:W,height:H}});
p.on('pageerror',e=>console.error('page error',e));
const pageUrl=`http://localhost:${port}/engines/gsap/${plan.template||'index'}.html?plan=${encodeURIComponent(planArg)}`;
const open=async pg=>{await pg.goto(pageUrl);await pg.waitForFunction(()=>window.ready!==undefined,null,{timeout:60000});await pg.evaluate(()=>window.ready)};
await open(p);
const meta=await p.evaluate(()=>window.meta);fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify(meta,null,1));
// Messaging gate: no forbidden claims (e.g. "gratis") anywhere on screen
let failed=false;
const brandJ=plan.brand?JSON.parse(fs.readFileSync(path.join(ROOT,plan.brand))):{};const forb=(brandJ.messaging||{}).forbidden||[];
const norm=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
for(const txt of meta.copy)for(const w of forb){if(new RegExp(`(^|[^a-z])${norm(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z]|$)`).test(norm(txt))){console.log(`MESSAGING FAIL: "${txt}" contains forbidden "${w}"`);failed=true}}
// QA: one settled frame per scene + automated clipping check
const qaFiles=[];const tq=Date.now();
for(const [i,t] of meta.qaTimes.entries()){await p.evaluate(t=>{seek(t)},t);const issues=await p.evaluate(()=>qaCheck());
  const f=path.join(out,'qa',`scene-${i+1}-${meta.scenes[i]}.png`);await p.screenshot({path:f});qaFiles.push([f,`${i+1} ${meta.scenes[i]} t=${t.toFixed(2)}s`]);
  console.log(`QA scene ${i+1} (${meta.scenes[i]}) @${t.toFixed(2)}s: ${issues.length?'FAIL':'ok'}`);issues.forEach(x=>console.log('   - '+x));if(issues.length)failed=true}
console.log(`STAGE qa: ${((Date.now()-tq)/1000).toFixed(1)}s`);execFileSync(PY,[path.join(ROOT,'engines/gsap/tools/sheet.py'),path.join(out,'contact-sheet.png'),...qaFiles.flat()]);
if(failed){console.error('QA failed: fix the plan/copy before rendering.');await b.close();srv.close();process.exit(1)}
if(process.argv.includes('--motion-check')){ // sample consecutive 60fps frames around every cut and flag jumps
  const md=path.join(out,'motion');fs.rmSync(md,{recursive:true,force:true});fs.mkdirSync(md);
  for(const [ci,c] of meta.cuts.entries()){if(!ci)continue;const f0=Math.round((c-.6)*meta.fps),f1=Math.round((c+.6)*meta.fps);
    for(let f=f0;f<=f1;f++){await p.evaluate(t=>{seek(t)},f/meta.fps);await p.screenshot({path:path.join(md,`c${ci}_${String(f).padStart(5,'0')}.jpg`),type:'jpeg',quality:70})}}
  try{execFileSync(PY,[path.join(ROOT,'engines/gsap/tools/motioncheck.py'),md],{stdio:'inherit'})}catch{failed=true}
}
if(failed){console.error('Motion check failed.');await b.close();srv.close();process.exit(1)}
if(qaOnly){await b.close();srv.close();process.exit(0)}
const fd=path.join(out,'frames');fs.rmSync(fd,{recursive:true,force:true});fs.mkdirSync(fd);
const n=Math.round(meta.duration*meta.fps);const t0=Date.now();
// Parallel frame capture: N pages, each seeks its own interleaved frames (deterministic, order-independent).
const wArg=process.argv.find(a=>a.startsWith('--workers='));const N=Math.max(1,+(wArg?.split('=')[1]||Math.min(6,Math.max(1,Math.floor(os.cpus().length/3)))));
const pages=[p];for(let i=1;i<N;i++){const q=await b.newPage({viewport:{width:W,height:H}});await open(q);pages.push(q)}
let done=0;
await Promise.all(pages.map(async(pg,w)=>{for(let i=w;i<n;i+=N){await pg.evaluate(t=>{seek(t)},i/meta.fps);await pg.screenshot({path:path.join(fd,`f${String(i).padStart(5,'0')}.png`)});if(++done%120===0)console.log(`frame ${done}/${n}`)}}));
console.log(`STAGE frames: ${n} frames, ${N} workers, ${((Date.now()-t0)/1000).toFixed(1)}s`);
await b.close();srv.close();
const silent=(meta.audio||'')==='none';let t1=Date.now();
if(!silent){execFileSync(PY,[path.join(ROOT,'engines/gsap/tools/music.py'),path.join(out,'meta.json'),path.join(out,'music.wav')],{stdio:'inherit'});console.log(`STAGE music: ${((Date.now()-t1)/1000).toFixed(1)}s`)}
const mp4=path.join(out,path.basename(plan.output)+'.mp4');t1=Date.now();
const vf=(()=>{const post=meta.post||{glowPass:meta.theme!=='light',noise:meta.theme==='light'?2:5};const blend=`[0:v]format=gbrp,tmix=frames=${Math.round(meta.fps/meta.outFps)},fps=${meta.outFps}`;const nz=post.noise?`,noise=alls=${post.noise}:allf=t`:'';
  return post.glowPass?`${blend},split[a][b];[b]curves=all='0/0 0.7/0 1/1',gblur=sigma=${18*Math.min(W,H)/1080}[gl];[a][gl]blend=all_mode=screen:all_opacity=0.4${nz},format=yuv420p[v]`:`${blend}${nz},format=yuv420p[v]`})();
execFileSync(FF,['-y','-loglevel','error','-framerate',String(meta.fps),'-i',path.join(fd,'f%05d.png'),...(silent?[]:['-i',path.join(out,'music.wav')]),'-filter_complex',vf,
 '-map','[v]',...(silent?['-an']:['-map','1:a','-c:a','aac','-b:a','192k','-shortest']),'-c:v','libx264','-crf','17','-preset','slow','-movflags','+faststart',mp4],{stdio:'inherit'});
console.log(`STAGE ffmpeg: ${((Date.now()-t1)/1000).toFixed(1)}s`);
fs.rmSync(fd,{recursive:true,force:true});
console.log('Rendered',mp4);
