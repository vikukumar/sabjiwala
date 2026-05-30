"""
Asset generator to copy, resize, and distribute logos & icons to Next.js public folders.
"""
import os
import shutil
from PIL import Image

ROOT_DIR = r"D:\Projects\sbjiwala" if os.path.exists(r"D:\Projects\sbjiwala") else r"D:\Projects\sabjiwala"
SRC_DIR = os.path.join(ROOT_DIR, "logo&icons")
web_app_name = "sbjiwala-web" if os.path.exists(os.path.join(ROOT_DIR, "apps", "sbjiwala-web")) else "sabjiwala-web"
APPS = ["customer-app", "vendor-app", "delivery-app", "admin-app", web_app_name]

def main():
    icon_src = os.path.join(SRC_DIR, "icon.png")
    log_h_src = os.path.join(SRC_DIR, "log_horizontal.png")
    log_v_src = os.path.join(SRC_DIR, "log_vertical.png")

    if not os.path.exists(icon_src):
        print(f"Error: {icon_src} not found")
        return

    # Load source icon image
    img = Image.open(icon_src)
    
    for app in APPS:
        dest_public = os.path.join(ROOT_DIR, "apps", app, "public")
        dest_src_app = os.path.join(ROOT_DIR, "apps", app, "src", "app")
        
        os.makedirs(dest_public, exist_ok=True)
        os.makedirs(dest_src_app, exist_ok=True)
        
        print(f"Processing assets for: {app}")
        
        # 1. Copy Logos and Icons directly
        shutil.copy2(log_h_src, os.path.join(dest_public, "logo_horizontal.png"))
        shutil.copy2(log_v_src, os.path.join(dest_public, "logo_vertical.png"))
        shutil.copy2(icon_src, os.path.join(dest_public, "icon.png"))
        
        # 2. Generate Favicon
        # Save as ICO format supporting multiple standard sizes
        favicon_path_public = os.path.join(dest_public, "favicon.ico")
        favicon_path_src = os.path.join(dest_src_app, "favicon.ico")
        
        img.save(favicon_path_public, format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])
        img.save(favicon_path_src, format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])
        
        # 3. Generate PWA sized icons (transparent PNG)
        icon_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
        icon_192.save(os.path.join(dest_public, "icon-192x192.png"), "PNG")
        
        icon_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
        icon_512.save(os.path.join(dest_public, "icon-512x512.png"), "PNG")
        
        # 4. Generate Apple Touch Icons (iOS PWA)
        icon_180 = img.resize((180, 180), Image.Resampling.LANCZOS)
        icon_180.save(os.path.join(dest_public, "apple-touch-icon.png"), "PNG")
        icon_180.save(os.path.join(dest_public, "apple-touch-icon-precomposed.png"), "PNG")
        
    print("Branding assets generated and replaced successfully across all apps!")

if __name__ == "__main__":
    main()
