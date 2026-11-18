import { test, expect } from '@playwright/test';

test('First view presents the brand, direct contact and interactive location on desktop and mobile', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hadramout-recent-orders-v1', '[{"code":"old","token":"old"}]'));
  await page.goto('/');
  const welcome = page.locator('.restaurant-welcome');
  await expect(welcome.getByRole('heading', { level: 1 })).toHaveText('حضرموت اليمني');
  await expect(welcome.locator('.welcome-phone')).toHaveAttribute('href', 'tel:07841444044');
  await expect(welcome.locator('.welcome-phone')).toContainText('07841444044');
  await expect(welcome.locator('.welcome-whatsapp')).toHaveAttribute('href', 'https://wa.me/9647841444044');
  await expect(welcome.locator('.welcome-instagram')).toHaveAttribute('href', 'https://www.instagram.com/hadramot.na/');
  await expect(welcome.locator('.welcome-instagram')).toContainText('@hadramot.na');
  await expect(welcome.locator('iframe')).toHaveAttribute('src', /google\.com\/maps\?cid=17520701731878199095.*output=embed/);
  await expect(welcome.locator('iframe')).toHaveAttribute('title', /خريطة موقع مطعم حضرموت اليمني/);
  await expect(welcome.locator('.location-directions')).toHaveAttribute('href', /destination_place_id=ChIJhY6H0oXj3T8RN98rgGUJJvM/);
  await expect(welcome.locator('.location-address')).toContainText('شارع الإمام علي');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const selector of ['h1', '.welcome-phone', '.welcome-whatsapp', '.welcome-instagram', '.welcome-map iframe']) {
      await expect(welcome.locator(selector)).toBeInViewport();
    }
    const map = await welcome.locator('iframe').boundingBox();
    expect(map!.y + map!.height).toBeLessThan(844);
    await page.screenshot({ path: `.screenshots/welcome-${width}.png` });
  }
  await expect(page.locator('a[href*="/track"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('تابع طلبك');
  expect(await page.evaluate(() => localStorage.getItem('hadramout-recent-orders-v1'))).toBeNull();
});
