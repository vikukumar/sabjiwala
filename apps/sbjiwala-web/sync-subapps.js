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

  // Write nested customer app layout
  const nestedLayoutContent = `"use client";

import React from "react";
import AppShell from "@/components/AppShell";
import { AppUpdater } from "@sbjiwala/shared";

export default function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <AppUpdater appName="customer" />
    </>
  );
}
`;
  fs.writeFileSync(path.join(webCustomerNestedDir, 'layout.tsx'), nestedLayoutContent, 'utf8');

  // Copy customer-app/src/app files
  fs.readdirSync(customerAppDir).forEach((child) => {
    const srcChildPath = path.join(customerAppDir, child);
    const isDir = fs.statSync(srcChildPath).isDirectory();

    if (isDir) {
      // Nested folders like cart, search, login, register, etc. go under /app/
      copyRecursiveSync(srcChildPath, path.join(webCustomerNestedDir, child));
      
      // Copy specific informational pages to root level of webAppDir for clean routing
      if (['about', 'privacy', 'terms', 'contact', 'pricing', 'blogs', 'contactus', 'refund-policy'].includes(child)) {
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
      } else if (child === 'layout.tsx') {
        // Root layout.tsx — remove AppShell and AppUpdater
        let content = fs.readFileSync(srcChildPath, 'utf8');
        content = content
          .replace(/import\s+AppShell\s+from\s+['"]@\/components\/AppShell['"];?\r?\n?/, '')
          .replace(/import\s+\{\s*AppUpdater\s*\}\s+from\s+['"]@sbjiwala\/shared['"];?\r?\n?/, '')
          .replace(/<AppShell>([\s\S]*?)<\/AppShell>/, '$1')
          .replace(/<AppUpdater\s+appName="customer"\s*\/>\r?\n?/, '');
        fs.writeFileSync(path.join(webAppDir, child), content, 'utf8');
      } else if (child === 'not-found.tsx' || child === 'error.tsx') {
        // Copy customer-specific error pages to /app/app/not-found.tsx and /app/app/error.tsx
        copyRecursiveSync(srcChildPath, path.join(webCustomerNestedDir, child));
      } else {
        // Root files (layout, providers, etc.) go to root /
        copyRecursiveSync(srcChildPath, path.join(webAppDir, child));
        if (child === 'version.json') {
          copyRecursiveSync(srcChildPath, path.join(webCustomerNestedDir, 'version.json'));
        }
      }
    }
  });

  // 4. Inject unified landing page, not-found and error boundaries
  console.log(`Copying unified marketplace pages and error handlers...`);
  const unifiedPageSource = path.join(webSrc, '../app_page_unified.tsx');
  if (fs.existsSync(unifiedPageSource)) {
    fs.copyFileSync(unifiedPageSource, path.join(webAppDir, 'page.tsx'));
  } else {
    console.warn(`[WARNING] Unified page source template not found at ${unifiedPageSource}`);
  }

  const unifiedNotFoundSource = path.join(webSrc, '../app_not_found_unified.tsx');
  if (fs.existsSync(unifiedNotFoundSource)) {
    fs.copyFileSync(unifiedNotFoundSource, path.join(webAppDir, 'not-found.tsx'));
  } else {
    console.warn(`[WARNING] Unified not found template not found at ${unifiedNotFoundSource}`);
  }

  const unifiedErrorSource = path.join(webSrc, '../app_error_unified.tsx');
  if (fs.existsSync(unifiedErrorSource)) {
    fs.copyFileSync(unifiedErrorSource, path.join(webAppDir, 'error.tsx'));
  } else {
    console.warn(`[WARNING] Unified error template not found at ${unifiedErrorSource}`);
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

  // Sync vendor-specific error and 404 pages
  const vendorNotFoundSrc = path.join(vendorSrc, 'app/not-found.tsx');
  if (fs.existsSync(vendorNotFoundSrc)) {
    fs.copyFileSync(vendorNotFoundSrc, path.join(webAppDir, 'vendor/not-found.tsx'));
  }
  const vendorErrorSrc = path.join(vendorSrc, 'app/error.tsx');
  if (fs.existsSync(vendorErrorSrc)) {
    fs.copyFileSync(vendorErrorSrc, path.join(webAppDir, 'vendor/error.tsx'));
  }

  // 6. Clean and Copy Delivery app specific pages under /delivery/
  console.log(`Syncing delivery-app pages...`);
  const deliveryLayoutSrc = path.join(deliverySrc, 'components/DeliveryLayout.tsx');
  const deliveryLayoutDest = path.join(webSrc, 'components/DeliveryLayout.tsx');
  if (fs.existsSync(deliveryLayoutSrc)) {
    copyRecursiveSync(deliveryLayoutSrc, deliveryLayoutDest);
  }

  const navigationMapSrc = path.join(deliverySrc, 'components/NavigationMap.tsx');
  const navigationMapDest = path.join(webSrc, 'components/NavigationMap.tsx');
  if (fs.existsSync(navigationMapSrc)) {
    copyRecursiveSync(navigationMapSrc, navigationMapDest);
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

  // Sync delivery-specific error and 404 pages
  const deliveryNotFoundSrc = path.join(deliverySrc, 'app/not-found.tsx');
  if (fs.existsSync(deliveryNotFoundSrc)) {
    fs.copyFileSync(deliveryNotFoundSrc, path.join(webAppDir, 'delivery/not-found.tsx'));
  }
  const deliveryErrorSrc = path.join(deliverySrc, 'app/error.tsx');
  if (fs.existsSync(deliveryErrorSrc)) {
    fs.copyFileSync(deliveryErrorSrc, path.join(webAppDir, 'delivery/error.tsx'));
  }

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

  // Sync additional admin routes: analytics, banners, categories, coupons, delivery, maps, orders, settings, support, vendors, returns, pages, email-designer, invoice-builder, support-agents, ads
  ['analytics', 'banners', 'categories', 'coupons', 'delivery', 'maps', 'orders', 'settings', 'support', 'vendors', 'returns', 'pages', 'email-designer', 'invoice-builder', 'support-agents', 'ads'].forEach((route) => {
    const dest = path.join(webAppDir, `admin/${route}`);
    removeRecursiveSync(dest);
    const srcPath = path.join(adminSrc, `app/${route}`);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, dest);
    }
  });

  // Sync admin-specific error and 404 pages
  const adminNotFoundSrc = path.join(adminSrc, 'app/not-found.tsx');
  if (fs.existsSync(adminNotFoundSrc)) {
    fs.copyFileSync(adminNotFoundSrc, path.join(webAppDir, 'admin/not-found.tsx'));
  }
  const adminErrorSrc = path.join(adminSrc, 'app/error.tsx');
  if (fs.existsSync(adminErrorSrc)) {
    fs.copyFileSync(adminErrorSrc, path.join(webAppDir, 'admin/error.tsx'));
  }

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

  // Sync additional agent routes: calls, orders, returns, kyc
  ['calls', 'orders', 'returns', 'kyc'].forEach((route) => {
    const dest = path.join(webAppDir, `agent/${route}`);
    removeRecursiveSync(dest);
    const srcPath = path.join(agentSrc, `app/${route}`);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, dest);
    }
  });

  // Sync agent-specific error and 404 pages
  const agentNotFoundSrc = path.join(agentSrc, 'app/not-found.tsx');
  if (fs.existsSync(agentNotFoundSrc)) {
    fs.copyFileSync(agentNotFoundSrc, path.join(webAppDir, 'agent/not-found.tsx'));
  }
  const agentErrorSrc = path.join(agentSrc, 'app/error.tsx');
  if (fs.existsSync(agentErrorSrc)) {
    fs.copyFileSync(agentErrorSrc, path.join(webAppDir, 'agent/error.tsx'));
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
