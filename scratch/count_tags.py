import re

with open(r'C:\Users\Rex\projects\mindsyn-v2\src\components\SettingsTab.tsx', 'r') as f:
    content = f.read()

# Remove comments
content = re.sub(r'\{/\*.*?\*/\}', '', content, flags=re.DOTALL)
content = re.sub(r'//.*', '', content)

open_tags = content.count('<div')
close_tags = content.count('</div')

print(f"Open <div: {open_tags}")
print(f"Close </div: {close_tags}")

# Count braces in return
return_match = re.search(r'return\s*\((.*)\)\s*;', content, flags=re.DOTALL)
if return_match:
    return_content = return_match.group(1)
    open_braces = return_content.count('{')
    close_braces = return_content.count('}')
    print(f"Braces in return: {open_braces} open, {close_braces} close")
