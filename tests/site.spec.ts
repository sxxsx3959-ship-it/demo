import { test, expect } from '@playwright/test';

const addChicken = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'أضف نصف مندي دجاج إلى السلة', exact: true });
const openCart = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^افتح السلة/ });

test('Hadramout branding, clean content, local assets and responsive layout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page).toHaveTitle(/حضرموت اليمني/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h1')).toContainText('حضرموت اليمني');
  await expect(page.locator('body')).not.toContainText('بيلاجيو');
  await expect(page.locator('body')).not.toContainText('تجريبي');
  await expect(page.locator('.delivery-zone')).toHaveCount(11);
  for (const image of await page.locator('img').all()) await image.scrollIntoViewIfNeeded();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(i => i.decode().catch(() => {}))); });
  expect(await page.evaluate(() => Array.from(document.images).filter(i => !i.naturalWidth).map(i => i.src))).toEqual([]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: '.screenshots/hadramout-desktop.png', fullPage: true });
  for (const width of [1440, 1024, 820, 768, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.screenshots/hadramout-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'فتح القائمة', exact: true }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'قائمتنا', exact: true }).click();
  await expect(page.getByRole('navigation')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('Category filters, actual dish details and availability', async ({ page }) => {
  await page.goto('/');
  await page.locator('.category-card').filter({ hasText: 'مندي الدجاج' }).click();
  await expect(page.locator('.dish-card')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'أضف مجبوس دجاج إلى السلة', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'عرض جميع الأطباق', exact: true }).click();
  await expect(page.locator('.dish-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'تفاصيل نصف مندي دجاج', exact: true }).click();
  await expect(page.locator('.dish-modal')).toBeVisible();
  await page.getByRole('button', { name: 'أضف إلى السلة', exact: true }).click();
  await expect(page.locator('.dish-view-cart')).toContainText('1 في سلتك');
  await page.locator('.dish-view-cart').click();
  await expect(page.locator('.cart-dialog')).toBeVisible();
  await expect(page.locator('.modal-dish')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.cart-dialog')).toHaveCount(0);
});

test('Persistent cart, quantity changes, all area fees, pickup and removal', async ({ page }) => {
  await page.goto('/');
  await addChicken(page).click(); await addChicken(page).click();
  await page.getByRole('button', { name: 'أضف مشروبات غازية إلى السلة', exact: true }).click();
  await page.reload();
  await expect(openCart(page)).toHaveAccessibleName('افتح السلة، 3 أصناف');
  await openCart(page).click();
  await expect(page.getByTestId('subtotal')).toHaveText('20,500 د.ع');
  await page.getByRole('button', { name: 'زيادة نصف مندي دجاج', exact: true }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('30,500 د.ع');
  await page.getByRole('button', { name: 'تقليل نصف مندي دجاج', exact: true }).click();
  for (const [id, fee] of [['salhiya', 2000], ['askari', 3000], ['eridu', 4000], ['ur', 4000], ['baghdad-street', 3000]] as const) {
    await page.getByRole('combobox', { name: 'منطقة التوصيل' }).selectOption(id);
    await expect(page.getByTestId('delivery-fee')).toHaveText(`${fee.toLocaleString('en-US')} د.ع`);
    await expect(page.getByTestId('grand-total')).toHaveText(`${(20500 + fee).toLocaleString('en-US')} د.ع`);
  }
  await page.getByRole('radio', { name: 'استلام من المطعم', exact: true }).check();
  await expect(page.getByTestId('grand-total')).toHaveText('20,500 د.ع');
  await expect(page.locator('textarea[name="address"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'حذف مشروبات غازية', exact: true }).click();
  await page.getByRole('button', { name: 'حذف نصف مندي دجاج', exact: true }).click();
  await expect(page.locator('.cart-empty')).toBeVisible();
});

test('Checkout calculates locally and prepares a WhatsApp message', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await addChicken(page).click(); await addChicken(page).click();
  await page.getByRole('button', { name: 'أضف مشروبات غازية إلى السلة', exact: true }).click();
  await openCart(page).click();
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.locator('.order-review')).toHaveCount(0);
  await page.locator('input[name="name"]').fill('أحمد علي');
  await page.locator('input[name="phone"]').fill('07701234567');
  await page.getByRole('combobox', { name: 'منطقة التوصيل' }).selectOption('salhiya');
  await page.locator('textarea[name="address"]').fill('شارع المدرسة، الدار رقم 12، قرب الجامع');
  await page.locator('textarea[name="notes"]').fill('المشروب بيبسي، يرجى الاتصال عند الوصول');
  await page.screenshot({ path: '.screenshots/cart-desktop.png' });
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.locator('.order-review')).toBeVisible();
  await expect(page.locator('.review-total')).toContainText('22,500');
  await expect(page.getByRole("link", { name: "أرسل الطلب عبر واتساب", exact: true })).toBeVisible();
  await page.screenshot({ path: '.screenshots/order-review.png' });
  await page.getByRole('button', { name: 'تعديل الطلب', exact: true }).click();
  await expect(page.locator('input[name="name"]')).toHaveValue('أحمد علي');
  await page.getByRole('combobox', { name: 'منطقة التوصيل' }).selectOption('ur');
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.locator('.review-total')).toContainText('24,500');
  expect(await page.evaluate(() => localStorage.getItem('hadramout-cart-v1'))).not.toContain('أحمد');
});

test('Mobile basket layout, form and dialog stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await addChicken(page).click(); await openCart(page).click();
  await page.getByRole('combobox', { name: 'منطقة التوصيل' }).selectOption('askari');
  await page.locator('input[name="name"]').fill('علي حسين');
  await page.locator('input[name="phone"]').fill('07801234567');
  await page.locator('textarea[name="address"]').fill('قرب المدرسة، شارع 10');
  await page.locator('.cart-dialog').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: '.screenshots/cart-mobile.png' });
  await page.locator('.cart-details-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.screenshots/cart-mobile-details.png' });
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.locator('.cart-dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.locator('.order-review')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق السلة', exact: true }).click();
  await expect(page.locator('.cart-dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('Damaged stored carts recover safely and do not inject unknown items', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hadramout-cart-v1', '{broken json'));
  await page.goto('/'); await openCart(page).click(); await expect(page.locator('.cart-empty')).toBeVisible();
  await page.getByRole('button', { name: 'إغلاق السلة', exact: true }).click();
  await addChicken(page).click(); await openCart(page).click();
  await expect(page.getByTestId('subtotal')).toHaveText('10,000 د.ع');
});
