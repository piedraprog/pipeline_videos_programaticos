import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('corporate plan holds independent signals and canonical CTA',()=>{
  const p=JSON.parse(read('plans/selltly-corporate-senales.json'));
  expect([p.format,p.fps,p.outFps]).toEqual(['9x16',60,30]);
  expect(p.story.signals.map((s:any)=>s.icon)).toEqual(['visit','product','chat','order']);
  expect(p.story.cta).toBe('Solicitar acceso Founder');
  expect(p.story.contact).toBe('+58 400-0000000');
  expect(p.duration-p.story.ctaAt).toBeGreaterThanOrEqual(4.5);
  for(const signal of p.story.signals)expect(signal.description).not.toMatch(/\d/);
});
test('corporate page exposes deterministic hooks and checks actual DOM text',()=>{
  const html=read('engines/gsap/corporate.html');
  for(const hook of ['window.ready=main()','window.seek=','window.qaCheck=','window.meta=','range.getClientRects()','scrollWidth'])expect(html).toContain(hook);
  expect(html).toContain('paused:true');
  expect(html).toContain("for(const e of [board,cta,summary,...cards])e.style.opacity='0'");
  expect(html).toContain('line-height:1.5');
  expect(html).not.toMatch(/Math\.random|setTimeout|Date\.now|class="phone"/);
});
