// Read-only check of the admin demo product state (price, visibility, stock) + storefront.
import {chromium} from 'playwright';
const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900},storageState:'.sessions/admin-reposteria.json'});const p=await c.newPage();
await p.goto('http://localhost:4200/products/c3120001-0000-4000-8000-000000000004',{waitUntil:'networkidle'});await p.waitForSelector('#product-section-ficha');
const r=await p.evaluate(()=>({head:document.querySelector('h1')?.parentElement?.innerText.replace(/\s+/g,' ').slice(0,120),visible:document.querySelector('#product-visible').checked,highlight:document.querySelector('#product-highlight').checked}));
console.log('ADMIN',JSON.stringify(r));
const s=await c.newPage();await s.goto('http://demo-reposteria.localtest.me:4321/producto/torta-vainilla',{waitUntil:'networkidle'});
console.log('STORE',s.url(),await s.locator('.product-detail__price-primary').first().innerText().catch(()=>'(no price: hidden?)'));
const h=await c.newPage();await h.goto('http://demo-reposteria.localtest.me:4321/',{waitUntil:'networkidle'});console.log('HOME lists vainilla:',await h.locator('a[href="/producto/torta-vainilla"]').count());
await b.close();
