"""Stamp a fresh version on every file the page loads, so phones get an update right away.

GitHub Pages lets browsers keep a file for 10 minutes, and phones kept running old code after
every change. Run before each commit:  python bump.py
It rewrites  app.js?v=...  in index.html and every  from './x.js?v=...'  import.
"""
import io, re, time, pathlib

v = time.strftime('%Y%m%d%H%M%S')
root = pathlib.Path(__file__).parent

def stamp(text):
    text = re.sub(r"(from '\./[\w-]+\.js)(\?v=\d+)?'", lambda m: f"{m.group(1)}?v={v}'", text)
    text = re.sub(r'(href="[\w-]+\.js)(\?v=\d+)?"', lambda m: f'{m.group(1)}?v={v}"', text)  # modulepreload links
    return re.sub(r'(src="app\.js)(\?v=\d+)?"', lambda m: f'{m.group(1)}?v={v}"', text)

for f in ['index.html', *[p.name for p in root.glob('*.js')]]:
    p = root / f
    s = io.open(p, encoding='utf8').read()
    n = stamp(s)
    if n != s:
        io.open(p, 'w', encoding='utf8').write(n)
print('version', v)
