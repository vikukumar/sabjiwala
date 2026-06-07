const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const webSrc = path.join(rootDir, 'apps/sbjiwala-web/src');
const customerSrc = path.join(rootDir, 'apps/customer-app/src');
const vendorSrc = path.join(rootDir, 'apps/vendor-app/src');
const deliverySrc = path.join(rootDir, 'apps/delivery-app/src');
const adminSrc = path.join(rootDir, 'apps/admin-app/src');

console.log('=== Sbjiwala Sub-Apps Synchronization Started ===');

// Helper to copy recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // Ensure parent directory exists
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// Helper to remove directory recursively
function removeRecursiveSync(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

try {
  // 1. Sync customer-app src as base
  console.log(`Syncing base from customer-app...`);
  copyRecursiveSync(customerSrc, webSrc);

  // 2. Clean and Copy Vendor app specific pages
  console.log(`Syncing vendor-app pages...`);
  // page.tsx
  const vendorPageDest = path.join(webSrc, 'app/vendor/page.tsx');
  copyRecursiveSync(path.join(vendorSrc, 'app/page.tsx'), vendorPageDest);
  // kyc directory
  const vendorKycDest = path.join(webSrc, 'app/kyc');
  removeRecursiveSync(vendorKycDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/kyc'), vendorKycDest);
  // login directory
  const vendorLoginDest = path.join(webSrc, 'app/vendor/login');
  removeRecursiveSync(vendorLoginDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/login'), vendorLoginDest);
  // register directory
  const vendorRegisterDest = path.join(webSrc, 'app/vendor/register');
  removeRecursiveSync(vendorRegisterDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/register'), vendorRegisterDest);

  // 3. Clean and Copy Delivery app specific pages
  console.log(`Syncing delivery-app pages...`);
  // page.tsx
  const deliveryPageDest = path.join(webSrc, 'app/delivery/page.tsx');
  copyRecursiveSync(path.join(deliverySrc, 'app/page.tsx'), deliveryPageDest);
  // login directory
  const deliveryLoginDest = path.join(webSrc, 'app/delivery/login');
  removeRecursiveSync(deliveryLoginDest);
  copyRecursiveSync(path.join(deliverySrc, 'app/login'), deliveryLoginDest);
  // register directory
  const deliveryRegisterDest = path.join(webSrc, 'app/delivery/register');
  removeRecursiveSync(deliveryRegisterDest);
  copyRecursiveSync(path.join(deliverySrc, 'app/register'), deliveryRegisterDest);

  // 4. Clean and Copy Admin app specific pages
  console.log(`Syncing admin-app pages...`);
  // page.tsx
  const adminPageDest = path.join(webSrc, 'app/admin/page.tsx');
  copyRecursiveSync(path.join(adminSrc, 'app/page.tsx'), adminPageDest);
  // users directory
  const adminUsersDest = path.join(webSrc, 'app/users');
  removeRecursiveSync(adminUsersDest);
  copyRecursiveSync(path.join(adminSrc, 'app/users'), adminUsersDest);
  // login directory
  const adminLoginDest = path.join(webSrc, 'app/admin/login');
  removeRecursiveSync(adminLoginDest);
  copyRecursiveSync(path.join(adminSrc, 'app/login'), adminLoginDest);
  // setup directory
  const adminSetupDest = path.join(webSrc, 'app/admin/setup');
  removeRecursiveSync(adminSetupDest);
  copyRecursiveSync(path.join(adminSrc, 'app/setup'), adminSetupDest);

  // 5. Sync public assets from customer-app to sbjiwala-web (for sw.js and manifest.json)
  console.log(`Syncing public assets from customer-app...`);
  const customerPublic = path.join(rootDir, 'apps/customer-app/public');
  const webPublic = path.join(rootDir, 'apps/sbjiwala-web/public');
  copyRecursiveSync(customerPublic, webPublic);

  console.log('=== Sbjiwala Sub-Apps Synchronization Completed Successfully ===');
} catch (error) {
  console.error('Error during synchronization:', error);
  process.exit(1);
}
