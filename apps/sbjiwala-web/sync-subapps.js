const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const webSrc = path.join(rootDir, 'apps/sbjiwala-web/src');
const customerSrc = path.join(rootDir, 'apps/customer-app/src');
const vendorSrc = path.join(rootDir, 'apps/vendor-app/src');
const deliverySrc = path.join(rootDir, 'apps/delivery-app/src');
const adminSrc = path.join(rootDir, 'apps/admin-app/src');
const agentSrc = path.join(rootDir, 'apps/agent-app/src');

console.log('=== Sbjiwala Sub-Apps Path-Based Synchronization Started ===');

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
  // 1. Clean the destination webSrc folder entirely to prevent stale files or duplicate routes
  console.log(`Cleaning target source folder...`);
  removeRecursiveSync(webSrc);

  // 2. Copy customer-app src subdirectories except 'app' (components, hooks, etc. go to base)
  console.log(`Syncing base assets (components, hooks, utils)...`);
  fs.readdirSync(customerSrc).forEach((child) => {
    if (child !== 'app') {
      copyRecursiveSync(path.join(customerSrc, child), path.join(webSrc, child));
    }
  });

  // 3. Setup app directory under sbjiwala-web
  console.log(`Creating next app layout structures...`);
  const customerAppDir = path.join(customerSrc, 'app');
  const webAppDir = path.join(webSrc, 'app');
  const webCustomerNestedDir = path.join(webAppDir, 'app'); // customer nested under /app

  fs.mkdirSync(webAppDir, { recursive: true });
  fs.mkdirSync(webCustomerNestedDir, { recursive: true });

  // Copy customer-app/src/app files
  fs.readdirSync(customerAppDir).forEach((child) => {
    const srcChildPath = path.join(customerAppDir, child);
    const isDir = fs.statSync(srcChildPath).isDirectory();

    if (isDir) {
      // Nested folders like cart, search, login, register, etc. go under /app/
      copyRecursiveSync(srcChildPath, path.join(webCustomerNestedDir, child));
      
      // Copy specific informational pages to root level of webAppDir for clean routing
      if (['about', 'privacy', 'terms', 'contact', 'pricing', 'blogs', 'contactus'].includes(child)) {
        copyRecursiveSync(srcChildPath, path.join(webAppDir, child));
        if (child === 'privacy') {
          copyRecursiveSync(srcChildPath, path.join(webAppDir, 'privacy-policy'));
        }
      }
    } else {
      // Files: layout.tsx, providers.tsx, globals.css, error.tsx, not-found.tsx, favicon.ico, version.json
      if (child === 'page.tsx') {
        // page.tsx (customer dashboard) goes to /app/page.tsx
        copyRecursiveSync(srcChildPath, path.join(webCustomerNestedDir, 'page.tsx'));
      } else {
        // Root files (layout, providers, etc.) go to root /
        copyRecursiveSync(srcChildPath, path.join(webAppDir, child));
      }
    }
  });

  // 4. Inject unified landing page at webSrc/app/page.tsx
  console.log(`Copying unified marketplace home page...`);
  const unifiedPageSource = path.join(webSrc, '../app_page_unified.tsx');
  if (fs.existsSync(unifiedPageSource)) {
    fs.copyFileSync(unifiedPageSource, path.join(webAppDir, 'page.tsx'));
  } else {
    console.warn(`[WARNING] Unified page source template not found at ${unifiedPageSource}`);
  }

  // 5. Clean and Copy Vendor app specific pages under /vendor/
  console.log(`Syncing vendor-app pages...`);
  const vendorLayoutSrc = path.join(vendorSrc, 'components/VendorLayout.tsx');
  const vendorLayoutDest = path.join(webSrc, 'components/VendorLayout.tsx');
  if (fs.existsSync(vendorLayoutSrc)) {
    copyRecursiveSync(vendorLayoutSrc, vendorLayoutDest);
  }

  const vendorPageDest = path.join(webAppDir, 'vendor/page.tsx');
  copyRecursiveSync(path.join(vendorSrc, 'app/page.tsx'), vendorPageDest);

  const vendorKycDest = path.join(webAppDir, 'vendor/kyc');
  removeRecursiveSync(vendorKycDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/kyc'), vendorKycDest);
  // Backward compatibility for kyc route
  copyRecursiveSync(path.join(vendorSrc, 'app/kyc'), path.join(webAppDir, 'kyc'));

  const vendorLoginDest = path.join(webAppDir, 'vendor/login');
  removeRecursiveSync(vendorLoginDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/login'), vendorLoginDest);

  const vendorRegisterDest = path.join(webAppDir, 'vendor/register');
  removeRecursiveSync(vendorRegisterDest);
  copyRecursiveSync(path.join(vendorSrc, 'app/register'), vendorRegisterDest);

  // Sync new orders, inventory, and profile routes
  const vendorOrdersDest = path.join(webAppDir, 'vendor/orders');
  removeRecursiveSync(vendorOrdersDest);
  if (fs.existsSync(path.join(vendorSrc, 'app/orders'))) {
    copyRecursiveSync(path.join(vendorSrc, 'app/orders'), vendorOrdersDest);
  }

  const vendorInventoryDest = path.join(webAppDir, 'vendor/inventory');
  removeRecursiveSync(vendorInventoryDest);
  if (fs.existsSync(path.join(vendorSrc, 'app/inventory'))) {
    copyRecursiveSync(path.join(vendorSrc, 'app/inventory'), vendorInventoryDest);
  }

  const vendorProfileDest = path.join(webAppDir, 'vendor/profile');
  removeRecursiveSync(vendorProfileDest);
  if (fs.existsSync(path.join(vendorSrc, 'app/profile'))) {
    copyRecursiveSync(path.join(vendorSrc, 'app/profile'), vendorProfileDest);
  }

  // Sync additional vendor routes: earnings, analytics, location, notifications
  ['earnings', 'analytics', 'location', 'notifications'].forEach((route) => {
    const dest = path.join(webAppDir, `vendor/${route}`);
    removeRecursiveSync(dest);
    const srcPath = path.join(vendorSrc, `app/${route}`);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, dest);
    }
  });

  // 6. Clean and Copy Delivery app specific pages under /delivery/
  console.log(`Syncing delivery-app pages...`);
  const deliveryLayoutSrc = path.join(deliverySrc, 'components/DeliveryLayout.tsx');
  const deliveryLayoutDest = path.join(webSrc, 'components/DeliveryLayout.tsx');
  if (fs.existsSync(deliveryLayoutSrc)) {
    copyRecursiveSync(deliveryLayoutSrc, deliveryLayoutDest);
  }

  const deliveryPageDest = path.join(webAppDir, 'delivery/page.tsx');
  copyRecursiveSync(path.join(deliverySrc, 'app/page.tsx'), deliveryPageDest);

  const deliveryLoginDest = path.join(webAppDir, 'delivery/login');
  removeRecursiveSync(deliveryLoginDest);
  copyRecursiveSync(path.join(deliverySrc, 'app/login'), deliveryLoginDest);

  const deliveryRegisterDest = path.join(webAppDir, 'delivery/register');
  removeRecursiveSync(deliveryRegisterDest);
  copyRecursiveSync(path.join(deliverySrc, 'app/register'), deliveryRegisterDest);

  // Sync additional delivery routes: profile, stores, history, earnings, payout, kyc
  ['profile', 'stores', 'history', 'earnings', 'payout', 'kyc'].forEach((route) => {
    const dest = path.join(webAppDir, `delivery/${route}`);
    removeRecursiveSync(dest);
    const srcPath = path.join(deliverySrc, `app/${route}`);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, dest);
    }
  });

  // 7. Clean and Copy Admin app specific pages under /admin/
  console.log(`Syncing admin-app pages...`);
  const adminPageDest = path.join(webAppDir, 'admin/page.tsx');
  copyRecursiveSync(path.join(adminSrc, 'app/page.tsx'), adminPageDest);

  const adminUsersDest = path.join(webAppDir, 'admin/users');
  removeRecursiveSync(adminUsersDest);
  copyRecursiveSync(path.join(adminSrc, 'app/users'), adminUsersDest);
  // Backward compatibility for users route
  copyRecursiveSync(path.join(adminSrc, 'app/users'), path.join(webAppDir, 'users'));

  const adminLoginDest = path.join(webAppDir, 'admin/login');
  removeRecursiveSync(adminLoginDest);
  copyRecursiveSync(path.join(adminSrc, 'app/login'), adminLoginDest);

  const adminSetupDest = path.join(webAppDir, 'admin/setup');
  removeRecursiveSync(adminSetupDest);
  copyRecursiveSync(path.join(adminSrc, 'app/setup'), adminSetupDest);

  // Sync new admin profile route
  const adminProfileDest = path.join(webAppDir, 'admin/profile');
  removeRecursiveSync(adminProfileDest);
  if (fs.existsSync(path.join(adminSrc, 'app/profile'))) {
    copyRecursiveSync(path.join(adminSrc, 'app/profile'), adminProfileDest);
  }

  // Sync additional admin routes: analytics, banners, categories, coupons, delivery, maps, orders, settings, support, vendors, returns
  ['analytics', 'banners', 'categories', 'coupons', 'delivery', 'maps', 'orders', 'settings', 'support', 'vendors', 'returns'].forEach((route) => {
    const dest = path.join(webAppDir, `admin/${route}`);
    removeRecursiveSync(dest);
    const srcPath = path.join(adminSrc, `app/${route}`);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, dest);
    }
  });

  // Copy admin-app custom components
  console.log(`Syncing admin-app custom components...`);
  if (fs.existsSync(path.join(adminSrc, 'components'))) {
    fs.readdirSync(path.join(adminSrc, 'components')).forEach((child) => {
      copyRecursiveSync(path.join(adminSrc, 'components', child), path.join(webSrc, 'components', child));
    });
  }

  // 7.5. Clean and Copy Agent app specific pages under /agent/
  console.log(`Syncing agent-app pages...`);
  const agentLayoutSrc = path.join(agentSrc, 'components/AgentLayout.tsx');
  const agentLayoutDest = path.join(webSrc, 'components/AgentLayout.tsx');
  if (fs.existsSync(agentLayoutSrc)) {
    copyRecursiveSync(agentLayoutSrc, agentLayoutDest);
  }

  const agentPageDest = path.join(webAppDir, 'agent/page.tsx');
  copyRecursiveSync(path.join(agentSrc, 'app/page.tsx'), agentPageDest);

  const agentLoginDest = path.join(webAppDir, 'agent/login');
  removeRecursiveSync(agentLoginDest);
  copyRecursiveSync(path.join(agentSrc, 'app/login'), agentLoginDest);

  const agentCallsDest = path.join(webAppDir, 'agent/calls');
  removeRecursiveSync(agentCallsDest);
  if (fs.existsSync(path.join(agentSrc, 'app/calls'))) {
    copyRecursiveSync(path.join(agentSrc, 'app/calls'), agentCallsDest);
  }

  // 8. Sync public assets from customer-app to sbjiwala-web
  console.log(`Syncing public assets...`);
  const customerPublic = path.join(rootDir, 'apps/customer-app/public');
  const webPublic = path.join(rootDir, 'apps/sbjiwala-web/public');
  copyRecursiveSync(customerPublic, webPublic);

  console.log('=== Sbjiwala Sub-Apps Path-Based Synchronization Completed Successfully ===');
} catch (error) {
  console.error('Error during synchronization:', error);
  process.exit(1);
}
