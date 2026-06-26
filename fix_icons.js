const fs = require('fs');
const path = require('path');

const walk = d => {
  let r = [];
  try {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      // Skip node_modules and .next directories
      if (p.includes('node_modules') || p.includes('.next')) continue;

      if (fs.statSync(p).isDirectory()) {
        r.push(...walk(p));
      } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
        r.push(p);
      }
    }
  } catch (e) { }
  return r;
};

const files = walk('d:/Projects/sbjiwala/apps');
let count = 0;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;

  if (c.includes('createCustomerIcon(') ||
    c.includes('createStoreIcon(') ||
    c.includes('createDeliveryAgentIcon(') ||
    c.includes('createLocationPinIcon(')) {

    c = c.replace(/createCustomerIcon\(\)/g, 'createCustomerIcon(L)');
    c = c.replace(/createStoreIcon\(\)/g, 'createStoreIcon(L)');
    c = c.replace(/createLocationPinIcon\(\)/g, 'createLocationPinIcon(L)');

    // DeliveryAgent might have 0 or 1 args. Be careful to match the opening paren
    c = c.replace(/createDeliveryAgentIcon\(([^)]*)\)/g, (match, p1) => {
      // If it already has L, don't replace
      if (p1.startsWith('L')) return match;
      return p1.trim() ? `createDeliveryAgentIcon(L, ${p1})` : 'createDeliveryAgentIcon(L)';
    });

    if (c !== original) {
      fs.writeFileSync(f, c);
      console.log('Updated ' + f);
      count++;
    }
  }
}
console.log(`Updated ${count} files.`);
