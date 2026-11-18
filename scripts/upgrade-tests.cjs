const fs=require('fs');let text=fs.readFileSync('tests/site.spec.ts','utf8');
const a=text.indexOf('  const link = await page.getByRole(\'link\', { name: \'أرسل الطلب عبر واتساب\'');
const b=text.indexOf('  await page.screenshot({ path: \'.screenshots/order-review.png\' });',a);
if(a<0||b<0)throw Error('Test anchor missing');
text=text.slice(0,a)+'  await expect(page.getByRole("button", { name: "تأكيد وإرسال الطلب للمطعم", exact: true })).toBeVisible();\n'+text.slice(b);
text=text.replace('Complete checkout calculates server totals and prepares the correct WhatsApp message without sending it','Checkout review calculates server totals before explicit order confirmation');fs.writeFileSync('tests/site.spec.ts',text);
