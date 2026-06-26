import os
import subprocess

apps = ['customer-app', 'vendor-app', 'delivery-app', 'admin-app', 'agent-app']
base_dir = r"d:\Projects\sbjiwala\apps"

for app in apps:
    app_dir = os.path.join(base_dir, app)
    print(f"Installing @capawesome-team/capacitor-file-opener in {app}...")
    subprocess.run(["npm", "install", "@capawesome-team/capacitor-file-opener@8.0.1", "--no-audit", "--no-fund"], cwd=app_dir, shell=True)
    
    manifest_path = os.path.join(app_dir, "android", "app", "src", "main", "AndroidManifest.xml")
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if "REQUEST_INSTALL_PACKAGES" not in content:
            content = content.replace(
                '<uses-permission android:name="android.permission.INTERNET" />',
                '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
            )
            with open(manifest_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Added REQUEST_INSTALL_PACKAGES to {app}")
        else:
            print(f"REQUEST_INSTALL_PACKAGES already present in {app}")
