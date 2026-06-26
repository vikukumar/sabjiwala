import os

apps = [
    ('vendor-app', 'VendorLayout.tsx'),
    ('delivery-app', 'DeliveryLayout.tsx'),
    ('admin-app', 'AdminLayout.tsx'),
    ('agent-app', 'AgentLayout.tsx')
]
base_dir = r"d:\Projects\sbjiwala\apps"

for app, layout_file in apps:
    app_shell_path = os.path.join(base_dir, app, "src", "components", layout_file)
    if os.path.exists(app_shell_path):
        with open(app_shell_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'Version: {process.env.NEXT_PUBLIC_APP_VERSION' not in content:
            # We look for the logout area
            #         )}
            #       </div>
            #     </div>
            #   );
            target = "        )}\n      </div>"
            replacement = "        )}\n        <div className=\"mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500\">\n          Version {process.env.NEXT_PUBLIC_APP_VERSION || \"1.0.0\"}\n        </div>\n      </div>"
            
            # Alternative target for layouts that use different formatting
            target2 = "      </div>\n    </div>\n  );\n\n  return ("
            replacement2 = "        <div className=\"mt-3 text-center text-[10px] text-slate-400 dark:text-slate-500\">\n          Version {process.env.NEXT_PUBLIC_APP_VERSION || \"1.0.0\"}\n        </div>\n      </div>\n    </div>\n  );\n\n  return ("
            
            if target in content:
                content = content.replace(target, replacement)
                with open(app_shell_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Added version to {app} {layout_file} using target 1")
            elif target2 in content:
                content = content.replace(target2, replacement2)
                with open(app_shell_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Added version to {app} {layout_file} using target 2")
            else:
                print(f"Could not find target in {app} {layout_file}")
        else:
            print(f"Version already added to {app}")
