// Migration for uploads that merge new files into an older checkout.
// Delete only the named, retired server files. Never touch public/, .data/, or .env files.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');
if (!/output\s*:\s*["']export["']/.test(config)) throw new Error('Static cleanup requires output: export.');
const retired = [
  'app/api/catalog/route.ts',
  'app/api/checkout/route.ts',
  'app/api/orders/route.ts',
  'app/api/owner/route.ts',
  'app/api/orders/[token]/route.ts',
  'app/track/page.tsx',
  'lib/database.ts',
  'lib/store.ts',
  'lib/owner-auth.ts',
  'lib/errors.ts',
  'lib/order-types.ts',
  'playwright.remote.config.ts',
  '.next/dev/types/validator.ts',
  '.next/dev/types/routes.d.ts',
];
let removed = 0;
for (const relative of retired) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Refusing path outside the project.');
  if (!fs.existsSync(target)) continue;
  if (!fs.lstatSync(target).isFile()) throw new Error(`Expected a regular file: ${relative}`);
  fs.unlinkSync(target); removed++;
}
console.log(`Static preparation complete: ${removed} obsolete files removed; images and local data preserved.`);
