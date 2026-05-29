const fs = require('fs');
let content = fs.readFileSync('.github/workflows/release.yml', 'utf8');

const fileRegex = /files: \|[\s\S]*?(?=body: \|)/;
const newFiles = `files: |
            sabjiwala-web-static.zip
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.apk
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}.aab
            sabjiwala-customer-v\${{ needs.read-version.outputs.version }}-ios.*
            sabjiwala-vendor-v\${{ needs.read-version.outputs.version }}-ios.*
            sabjiwala-delivery-v\${{ needs.read-version.outputs.version }}-ios.*
          `;

content = content.replace(fileRegex, newFiles);

const bodyRegex = /- \*\*Signed Android Apps[\s\S]*?(?=## Deployment instructions)/;
const newBody = `- **Android Apps (Capacitor/Gradle)**:
              - [Customer App] \`.apk\` and \`.aab\` bundles
              - [Vendor App] \`.apk\` and \`.aab\` bundles
              - [Delivery App] \`.apk\` and \`.aab\` bundles
            - **iOS Payload Bundles**:
              - [Customer App] \`.ipa\` (signed) or \`.zip\` (simulator)
              - [Vendor App] \`.ipa\` (signed) or \`.zip\` (simulator)
              - [Delivery App] \`.ipa\` (signed) or \`.zip\` (simulator)

            `;

content = content.replace(bodyRegex, newBody);

fs.writeFileSync('.github/workflows/release.yml', content, 'utf8');
