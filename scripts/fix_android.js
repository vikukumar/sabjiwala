const fs = require('fs');
const apps = ['customer-app', 'vendor-app', 'delivery-app', 'admin-app', 'agent-app'];

const proguardRules = `

# Capacitor Stream Call & WebRTC ProGuard Rules
-dontwarn ee.forgr.capacitor.streamcall.**
-keep class ee.forgr.capacitor.streamcall.** { *; }
-dontwarn io.getstream.**
-keep class io.getstream.** { *; }
-dontwarn org.webrtc.**
-keep class org.webrtc.** { *; }
-dontwarn org.jetbrains.kotlin.**
`;

apps.forEach(app => {
  const varPath = `apps/${app}/android/variables.gradle`;
  if (fs.existsSync(varPath)) {
    let content = fs.readFileSync(varPath, 'utf8');
    if (!content.includes('kotlin_version')) {
      content = content.replace('ext {', 'ext {\n    kotlin_version = \'1.9.24\'');
      fs.writeFileSync(varPath, content);
      console.log(`Updated ${varPath}`);
    }
  }

  const proPath = `apps/${app}/android/app/proguard-rules.pro`;
  if (fs.existsSync(proPath)) {
    let content = fs.readFileSync(proPath, 'utf8');
    if (!content.includes('ee.forgr.capacitor.streamcall')) {
      fs.appendFileSync(proPath, proguardRules);
      console.log(`Updated ${proPath}`);
    }
  }
});
console.log('Done modifying files');
