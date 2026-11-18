import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createOrderQuote } from '../lib/order';
const password=readFileSync('OWNER-ACCESS.txt','utf8').match(/كلمة المرور: (.+)/)![1].trim();

test('The static menu and cart work without any API or database', async ({page,request})=>{
 const calls:string[]=[];
 await page.route('http://localhost:3101/api/**',route=>{calls.push(route.request().url());return route.abort();});
 await page.goto('/');
 await page.getByRole('button',{name:'تفاصيل صينية مشكل مندي',exact:true}).click();
 await expect(page.getByRole('button',{name:'أضف إلى السلة',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'أضف إلى السلة',exact:true}).click();
 await page.locator('.dish-view-cart').click();
 await expect(page.getByTestId('subtotal')).toHaveText('31,000 د.ع');
 expect(calls).toEqual([]);
 for(const path of ['/api/catalog','/api/owner','/api/orders','/track'])expect((await request.get(path)).status()).toBe(404);
});

test('Every packaged image and font is publicly served with identical bytes',async({request})=>{
 const files:string[]=[];
 function walk(dir:string){for(const item of readdirSync(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.(jpg|png|svg|ttf|woff2)$/i.test(file))files.push(file);}}
 walk('public');expect(files.length).toBeGreaterThanOrEqual(11);
 for(const file of files){
  const url='/'+file.replace(/\\/g,'/').replace(/^public\//,'');
  const response=await request.get(url);expect(response.status(),url).toBe(200);
  const mime=/\.(ttf|woff2)$/.test(file)?'font/':'image/';expect(response.headers()['content-type'],url).toContain(mime);
  expect(createHash('sha256').update(await response.body()).digest('hex'),url).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
 }
});

test('WhatsApp handoff includes accurate details and never claims the order was received',async({page,context})=>{
 await context.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Intercepted WhatsApp handoff</title>'}));
 await page.goto('/');await page.getByRole('button',{name:'أضف نصف مندي دجاج إلى السلة',exact:true}).click();
 await page.getByRole('button',{name:/^افتح السلة/}).click();
 await page.locator('input[name="name"]').fill('زبون الفحص');await page.locator('input[name="phone"]').fill('٠٧٧٠١٢٣٤٥٦٧');
 await page.getByRole('combobox',{name:'منطقة التوصيل'}).selectOption('ur');
 await page.locator('textarea[name="address"]').fill('عنوان الفحص قرب المدرسة');
 await page.locator('textarea[name="notes"]').fill('بدون إضافات');
 await page.getByRole('button',{name:'مراجعة الطلب',exact:true}).click();
 const link=page.getByRole('link',{name:'أرسل الطلب عبر واتساب',exact:true});
 const url=new URL((await link.getAttribute('href'))!);expect(url.host).toBe('wa.me');expect(url.pathname).toBe('/9647841444044');
 const message=url.searchParams.get('text')!;
 for(const text of ['نصف مندي دجاج','حي أور','14,000','07701234567','عنوان الفحص قرب المدرسة','بدون إضافات'])expect(message).toContain(text);
 const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();await popup.close();
 await expect(page.getByRole('status').filter({hasText:'كمّل الإرسال'})).toBeVisible();
 await expect(page.locator('body')).not.toContainText('طلبك صار عندنا');
 await page.reload();await expect(page.getByRole('button',{name:/^افتح السلة/})).toContainText('1');
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));expect(storage).not.toContain('زبون الفحص');expect(storage).not.toContain('07701234567');
});

test('Local owner password, menu edits, fees, reset and per-browser isolation',async({page,context,browser})=>{
 await page.goto('/owner/');await page.locator('input[name="password"]').fill('wrong-password');await page.getByRole('button',{name:'ادخل إلى لوحة المطعم',exact:true}).click();
 await expect(page.locator('.checkout-error[role=alert]')).toHaveText('كلمة المرور غير صحيحة.');
 await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'ادخل إلى لوحة المطعم',exact:true}).click();
 await expect(page.locator('.owner-main')).toBeVisible();await page.reload();await expect(page.locator('.owner-main')).toBeVisible();
 await page.getByRole('button',{name:'إدارة المنيو',exact:true}).click();
 const dish=page.locator('.menu-editor-card').filter({hasText:'نصف مندي دجاج'});await dish.locator('input[name="price"]').fill('12000');await dish.getByRole('button',{name:'حفظ التغيير',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('على هذا الجهاز');
 await page.getByRole('button',{name:'مناطق التوصيل',exact:true}).click();
 const area=page.locator('.area-editor').filter({hasText:'الصالحية'});await area.locator('input').fill('3500');await area.getByRole('button').click();
 const tab=await context.newPage();await tab.goto('/');await expect(tab.locator('.dish-card').filter({hasText:'نصف مندي دجاج'})).toContainText('12,000');
 await tab.getByRole('button',{name:'أضف نصف مندي دجاج إلى السلة',exact:true}).click();await tab.getByRole('button',{name:/^افتح السلة/}).click();await tab.getByRole('combobox',{name:'منطقة التوصيل'}).selectOption('salhiya');await expect(tab.getByTestId('grand-total')).toHaveText('15,500 د.ع');
 const other=await browser.newContext();const fresh=await other.newPage();await fresh.goto('http://localhost:3101/');await expect(fresh.locator('.dish-card').filter({hasText:'نصف مندي دجاج'})).toContainText('10,000');await other.close();
 await page.getByRole('button',{name:'نظرة عامة',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'تحميل الإعدادات للنشر',exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('catalog-defaults.json');
 const exported=JSON.parse(readFileSync((await download.path())!,'utf8'));expect(exported.dishes.find((d:{id:number})=>d.id===27).price).toBe(12000);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'استعادة الإعدادات الأصلية',exact:true}).click();await expect(tab.getByTestId('grand-total')).toHaveText('12,000 د.ع');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'.screenshots/local-owner-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'تسجيل الخروج',exact:true}).click();await expect(page.locator('input[name="password"]')).toBeVisible();
});

test('Local calculator validates quantities, availability, phone and addresses',()=>{
 const valid={items:[{id:27,quantity:2,price:1}],fulfillment:'delivery',areaId:'askari',name:'أحمد علي',phone:'٠٧٧٠١٢٣٤٥٦٧',address:'قرب الجامع، الدار 12',notes:'',total:1};
 const quote=createOrderQuote(valid);expect(quote.total).toBe(23000);expect(quote.phone).toBe('07701234567');
 for(const change of [{items:[]},{items:[{id:27,quantity:-1}]},{items:[{id:27,quantity:100}]},{items:[{id:263,quantity:1}]},{areaId:'unknown'},{phone:'123'},{address:'قرب'}])expect(()=>createOrderQuote({...valid,...change})).toThrow();
});

test('Malformed local settings and blocked storage do not disable the static menu',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('hadramout-local-catalog-v1','{broken');Storage.prototype.setItem=()=>{throw new DOMException('Storage blocked','QuotaExceededError');};});
 await page.goto('/');await expect(page.getByRole('button',{name:'أضف نصف مندي دجاج إلى السلة',exact:true})).toBeEnabled();
 await page.goto('/owner/');await page.locator('input[name="password"]').fill(password);await page.getByRole('button',{name:'ادخل إلى لوحة المطعم',exact:true}).click();
 await page.getByRole('button',{name:'إدارة المنيو',exact:true}).click();await page.locator('.menu-editor-card').first().getByRole('button').click();await expect(page.locator('.checkout-error[role=alert]')).toContainText('تعذّر الحفظ');
});
