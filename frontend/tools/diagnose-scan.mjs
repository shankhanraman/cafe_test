// Headless reproduction of the Scan flow. Captures console + page errors so we can see why
// the "Use a sample bill" button appears to do nothing.
import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const log = (s) => console.log(s);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
log('loaded login');

// Sign in → dashboard
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByText('Good morning', { exact: false }).waitFor({ timeout: 5000 });
log('on dashboard');

// Go to Scan
await page.getByRole('button', { name: 'Scan a bill' }).first().click();
await page.getByText('Drop the bill photo or PDF here').waitFor({ timeout: 5000 });
log('on scan screen (idle)');

// Click "Use a sample bill"
await page.getByRole('button', { name: 'Use a sample bill' }).click();
log('clicked Use a sample bill');

// Expect processing then Review
try {
  await page.getByText('Reading line items', { exact: false }).waitFor({ timeout: 2000 });
  log('processing state shown');
} catch {
  log('NO processing state appeared');
}
try {
  await page.getByText('Review extracted lines').waitFor({ timeout: 5000 });
  log('REACHED Review screen ✅');
} catch {
  log('DID NOT reach Review screen ❌');
}

// Now verify "Browse files" → file picker → Review (the previously-dead button).
await page.getByRole('button', { name: 'Scan a bill' }).first().click();
await page.getByText('Drop the bill photo or PDF here').waitFor({ timeout: 5000 });
const chooser = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Browse files' }).click();
const fc = await chooser;
await fc.setFiles({ name: 'bill.png', mimeType: 'image/png', buffer: Buffer.from('fake') });
log('chose a file via Browse files');
try {
  await page.getByText('Review extracted lines').waitFor({ timeout: 5000 });
  log('Browse files REACHED Review screen ✅');
} catch {
  log('Browse files DID NOT reach Review ❌');
}

log('--- captured errors ---');
log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
