import os
import shutil
import subprocess

def run_cmd(args, cwd=None):
    print(f"Running: {' '.join(args)} in {cwd or '.'}")
    res = subprocess.run(args, cwd=cwd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"FAILED: {res.stderr}")
        return False
    print(res.stdout)
    return True

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    shared_dir = os.path.join(root_dir, "shared")
    
    # 1. Build the shared package
    print("Building @sbjiwala/shared...")
    if not run_cmd(["npm", "install"], cwd=shared_dir):
        return
    if not run_cmd(["npm", "run", "build"], cwd=shared_dir):
        return

    # 2. Define targets
    apps = ["customer-app", "vendor-app", "admin-app", "delivery-app", "sbjiwala-web"]
    
    for app in apps:
        app_dir = os.path.join(root_dir, "apps", app)
        if not os.path.exists(app_dir):
            continue
            
        print(f"\nProcessing {app}...")
        
        # Ensure node_modules/@sbjiwala exists
        target_parent = os.path.join(app_dir, "node_modules", "@sbjiwala")
        os.makedirs(target_parent, exist_ok=True)
        
        target_path = os.path.join(target_parent, "shared")
        
        # Remove existing symlink or folder
        if os.path.exists(target_path) or os.path.islink(target_path):
            print(f"Removing existing link/dir at {target_path}...")
            if os.path.islink(target_path):
                os.unlink(target_path)
            else:
                shutil.rmtree(target_path, ignore_errors=True)
                
        # Copy physical shared files to {target_path}...
        print(f"Copying physical shared files to {target_path}...")
        os.makedirs(target_path, exist_ok=True)
        
        try:
            shutil.copytree(os.path.join(shared_dir, "dist"), os.path.join(target_path, "dist"), dirs_exist_ok=True)
        except Exception as e:
            print(f"Warning during dist folder copy: {e}")
            
        try:
            shutil.copytree(os.path.join(shared_dir, "src"), os.path.join(target_path, "src"), dirs_exist_ok=True)
        except Exception as e:
            print(f"Warning during src folder copy: {e}")
        
        try:
            shutil.copy2(os.path.join(shared_dir, "package.json"), os.path.join(target_path, "package.json"))
        except Exception as e:
            print(f"Warning during package.json copy: {e}")
            
        try:
            shutil.copy2(os.path.join(shared_dir, "tsconfig.json"), os.path.join(target_path, "tsconfig.json"))
        except Exception as e:
            print(f"Warning during tsconfig.json copy: {e}")
        
        print(f"Successfully copied to {app}!")

if __name__ == "__main__":
    main()
