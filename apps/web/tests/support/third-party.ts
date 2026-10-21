import type { Page } from '@playwright/test';

// The footer loads the official eNamad trust seal from trustseal.enamad.ir. Tests must not depend on that
// third-party host being reachable (a foreign tunnel, an offline workstation or a provider outage makes it
// fail and would add console errors unrelated to YariZan). The REAL integration is kept: the page still
// requests the exact production URL, which is recorded and asserted; only the network answer is a fixed
// 1x1 PNG served locally.
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
export const enamadSealUrl =
  /^https:\/\/trustseal\.enamad\.ir\/logo\.aspx\?id=8237399&Code=[A-Za-z0-9]+$/;

export async function stubEnamadSeal(page: Page) {
  const requested: string[] = [];
  await page.route(/^https:\/\/trustseal\.enamad\.ir\//, async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
  });
  return requested;
}
