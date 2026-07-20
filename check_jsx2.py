with open('tmp_audits.txt', 'r') as f:
    lines = f.readlines()

divs = 0
for i, line in enumerate(lines[910:2385]):
    divs += line.count('<div')
    divs -= line.count('</div')

print(f"Original Divs count: {divs}")
