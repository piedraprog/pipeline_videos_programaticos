import {expect, test} from 'bun:test';

test('store completes a simulated purchase and decrements stock only once', async () => {
  const child = Bun.spawn(['node','--input-type=module','-e', `
    import {chromium} from 'playwright';
    import {pathToFileURL} from 'node:url';
    import path from 'node:path';
    import assert from 'node:assert/strict';
    import {existsSync} from 'node:fs';
    assert.ok(existsSync('demos/studio-store/index.html'), 'Store HTML must exist');
    const browser = await chromium.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      await page.goto(pathToFileURL(path.resolve('demos/studio-store/index.html')).href);
      await page.locator('[data-product="arc-headphones"]').click();
      assert.match(await page.locator('#product-stock').innerText(), /8 available/);
      await page.locator('#add-to-cart').click();
      await page.locator('#view-cart').click();
      assert.match(await page.locator('#cart-total').innerText(), /129/);
      await page.locator('#checkout').click();
      assert.match(await page.locator('#confirmation').innerText(), /Order confirmed/);
      await page.locator('#continue-shopping').click();
      await page.locator('[data-product="arc-headphones"]').click();
      assert.match(await page.locator('#product-stock').innerText(), /7 available/);
      await page.locator('#view-cart').click();
      assert.equal(await page.locator('#checkout').isEnabled(), false);
      console.log('Purchase, empty-cart guard and stock assertions passed');
    } finally {await browser.close();}
  `], {stdout:'pipe',stderr:'pipe'});
  const [exit,out,error] = await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  expect({exit,error}).toEqual({exit:0,error:''});
  expect(out).toContain('stock assertions passed');
}, 30000);
