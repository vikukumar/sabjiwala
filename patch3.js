const fs = require('fs');
let content = fs.readFileSync('.github/workflows/release.yml', 'utf8');

// 1. Remove secrets from `if` conditions
content = content.replace(/if: env\.HAS_PROD_KEYSTORE == 'true' && secrets\.PLAY_STORE_CONFIG_JSON != ''/g, "if: env.HAS_PROD_KEYSTORE == 'true'");
content = content.replace(/if: env\.HAS_APPLE_CERTS == 'true' && secrets\.APPSTORE_PRIVATE_KEY != ''/g, "if: env.HAS_APPLE_CERTS == 'true'");
content = content.replace(/if: env\.HAS_APPLE_CERTS == 'true' && secrets\.APPSTORE_KEY_ID != ''/g, "if: env.HAS_APPLE_CERTS == 'true'");

// 2. Update files uploaded to GitHub Release
const oldFiles = `          files: |
            sabjiwala-web-static.zip
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}-ios.zip
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}-ios.zip
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}-ios.zip`;

const newFiles = `          files: |
            sabjiwala-web-static.zip
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}-ios.*
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}-ios.*
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}-ios.*`;

content = content.replace(oldFiles, newFiles);

// 3. Update release body
const oldBody = `            - **Signed Android Apps (Capacitor/Gradle)**:
              - [Customer App] \`sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.apk\`
              - [Vendor App] \`sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.apk\`
              - [Delivery App] \`sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.apk\`
            - **Unsigned iOS Payload Bundles**:
              - [Customer App] \`sabjiwala-customer-v\${{ needs.read-version.outputs.version }}-ios.zip\`
              - [Vendor App] \`sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}-ios.zip\`
              - [Delivery App] \`sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}-ios.zip\``;

const newBody = `            - **Android Apps (Capacitor/Gradle)**:
              - [Customer App] \`.apk\` and \`.aab\` bundles
              - [Vendor App] \`.apk\` and \`.aab\` bundles
              - [Delivery App] \`.apk\` and \`.aab\` bundles
            - **iOS Payload Bundles**:
              - [Customer App] \`.ipa\` (signed) or \`.zip\` (simulator)
              - [Vendor App] \`.ipa\` (signed) or \`.zip\` (simulator)
              - [Delivery App] \`.ipa\` (signed) or \`.zip\` (simulator)`;

content = content.replace(oldBody, newBody);

fs.writeFileSync('.github/workflows/release.yml', content, 'utf8');
