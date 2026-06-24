import os

apps = ['vendor-app', 'delivery-app', 'admin-app', 'agent-app']
base_dir = r"d:\Projects\sabjiwala\apps"

for app in apps:
    layout_path = os.path.join(base_dir, app, "src", "app", "layout.tsx")
    if os.path.exists(layout_path):
        with open(layout_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'AppUpdater' not in content:
            # Add import
            import_statement = 'import { AppUpdater } from "@sbjiwala/shared";'
            if 'import AppShell' in content:
                content = content.replace('import AppShell', f'{import_statement}\nimport AppShell')
            elif 'import Providers' in content:
                content = content.replace('import Providers', f'{import_statement}\nimport Providers')
                
            # Replace AppShell children
            # Some apps might use <AppShell> others might just use <Providers>{children}</Providers>
            
            app_name = app.split('-')[0]
            if '<AppShell>{children}</AppShell>' in content:
                content = content.replace(
                    '<AppShell>{children}</AppShell>',
                    f'<AppShell>{{children}}</AppShell>\n          <AppUpdater appName="{app_name}" />'
                )
            elif '{children}</Providers>' in content:
                content = content.replace(
                    '{children}</Providers>',
                    f'{{children}}\n          <AppUpdater appName="{app_name}" />\n        </Providers>'
                )
            elif '{children}</body>' in content:
                 content = content.replace(
                    '{children}</body>',
                    f'{{children}}\n        <AppUpdater appName="{app_name}" />\n      </body>'
                )

            with open(layout_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {app} layout.tsx")
        else:
            print(f"{app} already updated")
