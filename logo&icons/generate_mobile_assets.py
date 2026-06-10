import os
from PIL import Image, ImageDraw

ROOT_DIR = r"D:\Projects\sbjiwala" if os.path.exists(r"D:\Projects\sbjiwala") else r"D:\Projects\sbjiwala"
APPS = ["customer-app", "vendor-app", "delivery-app", "admin-app"]

ICON_PATH = os.path.join(ROOT_DIR, "logo&icons", "icon.png")
LOGO_PATH = os.path.join(ROOT_DIR, "logo&icons", "log_vertical.png")

# Mipmap sizes
MIPMAPS = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Adaptive foreground sizes
ADAPTIVE = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Splash sizes (width, height, is_portrait)
SPLASHES = {
    "drawable": (512, 512, True),
    "drawable-port-mdpi": (320, 480, True),
    "drawable-port-hdpi": (480, 800, True),
    "drawable-port-xhdpi": (720, 1280, True),
    "drawable-port-xxhdpi": (960, 1600, True),
    "drawable-port-xxxhdpi": (1280, 1920, True),
    "drawable-land-mdpi": (480, 320, False),
    "drawable-land-hdpi": (800, 480, False),
    "drawable-land-xhdpi": (1280, 720, False),
    "drawable-land-xxhdpi": (1600, 960, False),
    "drawable-land-xxxhdpi": (1920, 1280, False),
}

def generate_assets():
    icon = Image.open(ICON_PATH)
    logo = Image.open(LOGO_PATH)

    for app in APPS:
        # --- Android Asset Generation ---
        res_dir = os.path.join(ROOT_DIR, "apps", app, "android", "app", "src", "main", "res")
        if os.path.exists(res_dir):
            print(f"Generating Android assets for: {app}")

            # 1. Generate Mipmap Icons
            for folder, size in MIPMAPS.items():
                folder_path = os.path.join(res_dir, folder)
                os.makedirs(folder_path, exist_ok=True)

                # Standard icon
                img_std = icon.resize((size, size), Image.Resampling.LANCZOS)
                img_std.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")

                # Round icon
                mask = Image.new("L", (size, size), 0)
                draw = ImageDraw.Draw(mask)
                draw.ellipse((0, 0, size, size), fill=255)
                
                img_round = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                img_round.paste(img_std, (0, 0))
                img_round.putalpha(mask)
                img_round.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")

            # 2. Generate Adaptive Foreground Icons
            for folder, size in ADAPTIVE.items():
                folder_path = os.path.join(res_dir, folder)
                os.makedirs(folder_path, exist_ok=True)

                fg_size = int(size * 0.66)
                resized_icon = icon.resize((fg_size, fg_size), Image.Resampling.LANCZOS)

                img_fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
                offset = (size - fg_size) // 2
                img_fg.paste(resized_icon, (offset, offset))
                img_fg.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")

            # 3. Generate Splash Screens
            for folder, (w, h, is_port) in SPLASHES.items():
                folder_path = os.path.join(res_dir, folder)
                os.makedirs(folder_path, exist_ok=True)

                bg_color = (9, 13, 16, 255) # #090d10 dark-soil background
                splash = Image.new("RGBA", (w, h), bg_color)

                min_dim = min(w, h)
                logo_target_dim = int(min_dim * 0.45)
                
                lw, lh = logo.size
                scale = logo_target_dim / max(lw, lh)
                new_lw = int(lw * scale)
                new_lh = int(lh * scale)
                
                resized_logo = logo.resize((new_lw, new_lh), Image.Resampling.LANCZOS)

                offset_x = (w - new_lw) // 2
                offset_y = (h - new_lh) // 2
                splash.paste(resized_logo, (offset_x, offset_y), resized_logo)
                splash.save(os.path.join(folder_path, "splash.png"), "PNG")
        else:
            print(f"Skipping Android assets for {app} (no Android project directory)")

        # --- iOS Asset Generation ---
        ios_icon_dir = os.path.join(ROOT_DIR, "apps", app, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset")
        ios_splash_dir = os.path.join(ROOT_DIR, "apps", app, "ios", "App", "App", "Assets.xcassets", "Splash.imageset")
        
        if os.path.exists(ios_icon_dir):
            print(f"Generating iOS icons for: {app}")
            img_ios = icon.resize((1024, 1024), Image.Resampling.LANCZOS)
            img_ios.save(os.path.join(ios_icon_dir, "AppIcon-512@2x.png"), "PNG")
            
        if os.path.exists(ios_splash_dir):
            print(f"Generating iOS splashes for: {app}")
            bg_color = (9, 13, 16, 255) # #090d10 dark-soil background
            splash_ios = Image.new("RGBA", (2732, 2732), bg_color)
            
            logo_target_dim = 1200 # center logo size
            lw, lh = logo.size
            scale = logo_target_dim / max(lw, lh)
            new_lw = int(lw * scale)
            new_lh = int(lh * scale)
            
            resized_logo = logo.resize((new_lw, new_lh), Image.Resampling.LANCZOS)
            offset_x = (2732 - new_lw) // 2
            offset_y = (2732 - new_lh) // 2
            splash_ios.paste(resized_logo, (offset_x, offset_y), resized_logo)
            
            splash_ios.save(os.path.join(ios_splash_dir, "splash-2732x2732.png"), "PNG")
            splash_ios.save(os.path.join(ios_splash_dir, "splash-2732x2732-1.png"), "PNG")
            splash_ios.save(os.path.join(ios_splash_dir, "splash-2732x2732-2.png"), "PNG")
        else:
            print(f"Skipping iOS assets for {app} (no iOS project directory)")

    print("Mobile brand assets generated successfully across all apps!")

if __name__ == "__main__":
    generate_assets()
