// Usage: bun run bumper -- brands/<brand>/brand.json projects/bumpers-<brand> <intro|outro>:<A-D>:<9x16|16x9|1x1>:<dark|light> [...] [--qa-only]
import {FF,PY} from './bin.mjs';
// Renders brand intro/outro bumpers: 60fps seek capture -> ffmpeg 2-frame blend to 30fps -> code-synth SFX muxed.
import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const [brand,outDir,...rest]=process.argv.slice(2);const qaOnly=rest.includes('--qa-only');const jobs=rest.filter(x=>!x.startsWith('--'));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(ROOT+path.sep)||!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)}).listen(0);
const out=path.resolve(ROOT,outDir);fs.mkdirSync(path.join(out,'qa'),{recursive:true});
const b=await chromium.launch();let failed=false;
for(const job of jobs){const [kind,variant,format,bg]=job.split(':');const name=`${kind}-${variant}-${format}-${bg}`;
  const [W,H]={'16x9':[1920,1080],'9x16':[1080,1920],'1x1':[1080,1080]}[format];const p=await b.newPage({viewport:{width:W,height:H}});
  p.on('pageerror',e=>{console.error(name,'page error',e.message);failed=true});
  await p.goto(`http://localhost:${srv.address().port}/engines/gsap/bumper.html?brand=${encodeURIComponent(brand)}&kind=${kind}&variant=${variant}&format=${format}&bg=${bg}`);
  await p.evaluate(()=>window.ready);const meta=await p.evaluate(()=>window.meta);
  for(const [k,f] of [.2,.42,.62,.97].entries()){await p.evaluate(t=>{seek(t)},meta.duration*f);if(f===(kind==='intro'?.62:.97)){const iss=await p.evaluate(()=>qaCheck());if(iss.length){console.log(name,'QA FAIL',iss);failed=true}}
    await p.screenshot({path:path.join(out,'qa',`${name}-${k}.png`)})}
  console.log(`${name}: ${meta.duration.toFixed(2)}s, ${meta.sfx.length} sfx`);
  if(!qaOnly){const fd=path.join(out,'frames-'+name);fs.rmSync(fd,{recursive:true,force:true});fs.mkdirSync(fd);
    const n=Math.round(meta.duration*60);for(let i=0;i<n;i++){await p.evaluate(t=>{seek(t)},i/60);await p.screenshot({path:path.join(fd,`f${String(i).padStart(5,'0')}.png`)})}
    fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(meta));execFileSync(PY,[path.join(ROOT,'engines/gsap/tools/sfx.py'),path.join(out,name+'.json'),path.join(out,name+'.wav')]);
    execFileSync(FF,['-y','-loglevel','error','-framerate','60','-i',path.join(fd,'f%05d.png'),'-i',path.join(out,name+'.wav'),'-filter_complex',`[0:v]format=gbrp,tmix=frames=2,fps=30,format=yuv420p[v]`,'-map','[v]','-map','1:a','-c:v','libx264','-crf','17','-preset','slow','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',path.join(out,name+'.mp4')]);
    fs.rmSync(fd,{recursive:true,force:true});fs.rmSync(path.join(out,name+'.wav'));console.log('  ->',name+'.mp4')}
  await p.close()}
await b.close();srv.close();process.exit(failed?1:0);
