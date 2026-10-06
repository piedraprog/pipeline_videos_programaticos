import { chromium } from 'playwright';

(async () => {
  console.log('Iniciando navegador...');
  
  // Aumentamos el timeout a 60s y quitamos headless para ver qué pasa
  const browser = await chromium.launch({ 
    headless: false, // ¡Cámbialo a false temporalmente!
    timeout: 60000 
  });
  
  console.log('Navegador iniciado ✅');
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('Título:', await page.title());
  
  // Espera 2 segundos para que veas la ventana
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();