import re
import sys

def replace_colors(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    replacements = {
        r'bg-\[\#1e1e1e\]': 'bg-bg-surface',
        r'bg-\[\#181818\]': 'bg-bg-base',
        r'bg-\[\#2a2a2a\]': 'bg-bg-hover',
        r'bg-\[\#333\]': 'bg-bg-active',
        r'bg-\[\#222\]': 'bg-bg-hover',
        r'hover:bg-\[\#333\]': 'hover:bg-bg-active',
        r'hover:bg-\[\#444\]': 'hover:bg-border-hover',
        r'hover:bg-\[\#2a2a2a\]': 'hover:bg-bg-hover',
        r'hover:bg-\[\#222\]': 'hover:bg-bg-hover',
        r'border-\[\#333\]': 'border-border-main',
        r'border-\[\#444\]': 'border-border-hover',
        r'text-gray-300': 'text-text-secondary',
        r'text-gray-100': 'text-text-primary',
        r'text-white': 'text-text-inverted',
        r'hover:text-white': 'hover:text-text-inverted',
        r'text-gray-400': 'text-text-tertiary',
        r'text-gray-500': 'text-text-tertiary',
        r'hover:border-gray-500': 'hover:border-border-hover',
        r'hover:text-gray-100': 'hover:text-text-primary',
        r'hover:text-gray-200': 'hover:text-text-secondary',
        r'border-orange-500': 'border-accent',
        r'text-orange-500': 'text-accent',
        r'theme="vs-dark"': 'theme={theme === \'light\' ? \'vs\' : \'vs-dark\'}',
    }

    for pattern, repl in replacements.items():
        content = re.sub(pattern, repl, content)
        
    with open(filepath, 'w') as f:
        f.write(content)

replace_colors('/Users/vunloonchin/dev/MyAPITester/src/App.tsx')
replace_colors('/Users/vunloonchin/dev/MyAPITester/src/KeyValueEditor.tsx')
print("Done!")
