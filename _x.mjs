import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const ROOT=process.cwd();const planArg='plans/stock-whatsapp-order-9x16.json';
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200);fs.createReadStream(f).pipe(r)}).listen(0);
setTimeout(()=>{console.log('force exit');process.exit(3)},80000);
const N=+process.argv[2];
await Promise.all(Array.from({length:N},async(_,i)=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 await p.goto(`http://localhost:${srv.address().port}/engines/gsap/_wa.html?only=${i+1}&plan=${encodeURIComponent(planArg)}`);
 const okr=await p.waitForFunction(()=>window.ready!==undefined,null,{timeout:40000}).then(()=>1,()=>0);if(!okr){console.log('section',i+1,'NOT READY');return}
 const r=await Promise.race([p.evaluate(()=>{seek(1);seek(4);return 'ok'}),new Promise(r=>setTimeout(()=>r('HANG'),20000))]);console.log('section',i+1,r);
 if(r==='ok')await b.close();}));
process.exit(0);
