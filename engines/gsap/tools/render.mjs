// Usage: bun run render -- plans/<plan>.json [--qa-only] [--motion-check] [--workers=N]
// plan.template: index (default, brand pieces) | stock (no-text stock clips) | whatsapp (chat recreation)
import {FF,PY} from './bin.mjs';import {prepareMusic} from './music.mjs';import {captureJobs,inputFingerprint,linkOrCopy,sampleFile,segmentKey,segmentRanges,shutterPlan} from './frames.mjs';
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
// plan.supersample 2 captures every frame at twice the resolution and scales it down, for sharper text and edges.
const SS=plan.supersample??1;const PAGE={viewport:{width:W,height:H},deviceScaleFactor:SS};
const b=await chromium.launch({channel:'chrome',chromiumSandbox:true});const p=await b.newPage(PAGE);
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
const ALPHA=!!meta.alpha;const CHECKER="repeating-conic-gradient(#5a5a5a 0% 25%, #3c3c3c 0% 50%) 0 0/48px 48px";
if(ALPHA)await p.evaluate(c=>{document.documentElement.style.background=c},CHECKER); // QA/contact sheet over a gray checker so the overlay is visible
for(const [i,t] of meta.qaTimes.entries()){await p.evaluate(t=>{seek(t)},t);const issues=await p.evaluate(()=>qaCheck());
  const f=path.join(out,'qa',`scene-${i+1}-${meta.scenes[i]}.png`);await p.screenshot({path:f,scale:'css'});qaFiles.push([f,`${i+1} ${meta.scenes[i]} t=${t.toFixed(2)}s`]);
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
if(ALPHA)await p.evaluate(()=>{document.documentElement.style.background='transparent'});
const fd=path.join(out,'frames');fs.rmSync(fd,{recursive:true,force:true});fs.mkdirSync(fd);
const t0=Date.now();
// Motion blur: meta.fps/meta.outFps sub-frames exist per output frame. With meta.shutter (degrees) only the
// sub-frames inside the open shutter are captured and averaged, like a film camera. Without it, every
// sub-frame is blended (legacy 360-degree behaviour).
const {perFrame:SUB,open:OPEN}=shutterPlan(meta);
// Shutter renders capture several times more frames; JPEG encodes about 3x faster than PNG and the frames are averaged anyway.
const EXT=!ALPHA&&meta.shutter?'jpg':'png';const SHOT=EXT==='jpg'?{type:'jpeg',quality:98}:{omitBackground:ALPHA};
const totalFrames=Math.round(meta.duration*meta.outFps);
// Scenes whose inputs did not change keep their frames from the previous render (--fresh ignores them).
const styleFile=`styles/${plan.style}.json`;const styleJ=fs.existsSync(path.join(ROOT,styleFile))?JSON.parse(fs.readFileSync(path.join(ROOT,styleFile))):{};
const fingerprint=inputFingerprint({root:ROOT,plan,brand:brandJ,style:styleJ,codeFiles:[`engines/gsap/${plan.template||'index'}.html`,'engines/gsap/lib/motion.js'],settings:{W,H,SS,fps:meta.fps,outFps:meta.outFps,shutter:meta.shutter??null,EXT}});
const cacheRoot=path.join(out,'frame-cache');const fresh=process.argv.includes('--fresh');
const ranges=segmentRanges(meta.segments??[{name:'all',start:0,end:meta.duration,source:JSON.stringify(plan)}],meta.outFps,totalFrames).map(r=>({...r,dir:path.join(cacheRoot,segmentKey(fingerprint,r.segment))}));
const stale=ranges.filter(r=>{const marker=path.join(r.dir,'done');return fresh||!fs.existsSync(marker)||fs.readFileSync(marker,'utf8')!==String(r.end-r.first)});
for(const r of stale){fs.rmSync(r.dir,{recursive:true,force:true});fs.mkdirSync(r.dir,{recursive:true})}
const jobs=[];
for(const r of stale){const frames=Array.from({length:r.end-r.first},(_,i)=>r.first+i);
  // A template that cannot tell holds from motion gets every sample captured.
  const moving=await p.evaluate(({frames,sub,open,fps})=>frames.map(f=>!window.isMoving||Array.from({length:open},(_,k)=>(f*sub+k)/fps).some(t=>window.isMoving(t))),{frames,sub:SUB,open:OPEN,fps:meta.fps});
  jobs.push(...captureJobs({dir:r.dir,extension:EXT,frames,moving,perFrame:SUB,open:OPEN,fps:meta.fps}))}
// Parallel frame capture: N pages, each seeks its own interleaved frames (deterministic, order-independent).
// More pages do not help: they share one GPU process, and capture slows down past four.
const wArg=process.argv.find(a=>a.startsWith('--workers='));const N=Math.max(1,Math.min(jobs.length||1,+(wArg?.split('=')[1]||Math.min(4,Math.max(1,Math.floor(os.cpus().length/3))))));
const pages=[p];for(let i=1;i<N;i++){const q=await b.newPage(PAGE);await open(q);pages.push(q)}
let done=0;
await Promise.all(pages.map(async(pg,w)=>{for(let j=w;j<jobs.length;j+=N){const job=jobs[j];await pg.evaluate(t=>{seek(t)},job.time);await pg.screenshot({path:job.file,...SHOT});for(const copy of job.copies)linkOrCopy(job.file,copy);if(++done%240===0)console.log(`frame ${done}/${jobs.length}`)}}));
for(const r of stale)fs.writeFileSync(path.join(r.dir,'done'),String(r.end-r.first));
for(const r of ranges)for(let f=r.first;f<r.end;f++)for(let k=0;k<OPEN;k++)linkOrCopy(sampleFile(r.dir,EXT,f,k),path.join(fd,`f${String(f*OPEN+k).padStart(5,'0')}.${EXT}`));
const keep=new Set(ranges.map(r=>path.basename(r.dir)));for(const old of fs.readdirSync(cacheRoot))if(!keep.has(old))fs.rmSync(path.join(cacheRoot,old),{recursive:true,force:true});
console.log(`STAGE frames: captured ${jobs.length} of ${totalFrames*OPEN} samples (${stale.length}/${ranges.length} scenes changed, still frames captured once), ${N} workers, ${((Date.now()-t0)/1000).toFixed(1)}s`);
// tmix output k mixes inputs k-OPEN+1..k, so keeping every OPEN-th one yields exactly one output frame per shutter window.
const IN_FPS=String(meta.outFps*OPEN);const MIX=`tmix=frames=${OPEN},select='not(mod(n+1\\,${OPEN}))',setpts=N/(${meta.outFps}*TB),fps=${meta.outFps}`;
await b.close();srv.close();
const silent=(meta.audio||'')==='none';let t1=Date.now();
if(!silent){prepareMusic({root:ROOT,plan,meta,outputDir:out});console.log(`STAGE music: ${((Date.now()-t1)/1000).toFixed(1)}s`)}
if(ALPHA){ // transparent overlay: ProRes 4444 (main) + VP9 WebM with alpha, no audio
  const base=path.join(out,path.basename(plan.output));t1=Date.now();const blend=`format=rgba,${MIX}`;
  execFileSync(FF,['-y','-loglevel','error','-framerate',IN_FPS,'-i',path.join(fd,`f%05d.${EXT}`),'-vf',`${blend},format=yuva444p10le`,'-c:v','prores_ks','-profile:v','4444','-alpha_bits','16','-vendor','apl0','-pix_fmt','yuva444p10le',base+'.mov'],{stdio:'inherit'});
  execFileSync(FF,['-y','-loglevel','error','-framerate',IN_FPS,'-i',path.join(fd,`f%05d.${EXT}`),'-vf',`${blend},format=yuva420p`,'-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','28','-row-mt','1','-auto-alt-ref','0',base+'.webm'],{stdio:'inherit'});
  console.log(`STAGE ffmpeg: ${((Date.now()-t1)/1000).toFixed(1)}s`);fs.rmSync(fd,{recursive:true,force:true});console.log('Rendered',base+'.mov',base+'.webm');process.exit(0)}
const mp4=path.join(out,path.basename(plan.output)+'.mp4');t1=Date.now();
// Encoded under another name and renamed at the end, so a half-written file is never mistaken for the video.
const partial=mp4.replace(/\.mp4$/,'.partial.mp4');
// HD players assume BT.709; without the explicit matrix ffmpeg converts RGB with BT.601 and colors shift.
// plan.outputHeight delivers a smaller file (720 for 720p) from the same capture; widths stay even for the encoder.
const OUT_H=plan.outputHeight??H;const OUT_W=Math.round(W*OUT_H/H/2)*2;
const FIT=`scale=${OUT_W}:${OUT_H}:flags=lanczos:out_color_matrix=bt709:out_range=tv`;
const vf=(()=>{const post=meta.post||{glowPass:meta.theme!=='light',noise:meta.theme==='light'?2:5};const blend=`[0:v]format=gbrp,${MIX}`;const nz=post.noise?`,noise=alls=${post.noise}:allf=t`:'';
  return post.glowPass?`${blend},split[a][b];[b]curves=all='0/0 0.7/0 1/1',gblur=sigma=${18*Math.min(W,H)/1080}[gl];[a][gl]blend=all_mode=screen:all_opacity=0.4${nz},${FIT},format=yuv420p[v]`:`${blend}${nz},${FIT},format=yuv420p[v]`})();
execFileSync(FF,['-y','-loglevel','error','-framerate',IN_FPS,'-i',path.join(fd,`f%05d.${EXT}`),...(silent?[]:['-i',path.join(out,'music.wav')]),'-filter_complex',vf,
 '-map','[v]',...(silent?['-an']:['-map','1:a','-c:a','aac','-b:a','256k','-shortest']),'-c:v','libx264','-crf',String(plan.crf??17),'-preset','slow','-profile:v','high','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-movflags','+faststart',partial],{stdio:'inherit'});
fs.renameSync(partial,mp4);
console.log(`STAGE ffmpeg: ${((Date.now()-t1)/1000).toFixed(1)}s`);
fs.rmSync(fd,{recursive:true,force:true});
console.log('Rendered',mp4);
