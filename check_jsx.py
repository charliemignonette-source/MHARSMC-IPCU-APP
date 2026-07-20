with open('src/components/Audits.tsx', 'r') as f:
    lines = f.readlines()

divs = 0
for i, line in enumerate(lines[910:2273]):
    divs += line.count('<div')
    divs -= line.count('</div')

print(f"Divs count: {divs}")
