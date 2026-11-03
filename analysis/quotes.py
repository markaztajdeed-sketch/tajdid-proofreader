"""What did proofreaders do with straight-quoted spans "..." ? Usage: python3 -I quotes.py <workdir>"""
import sys, os, re, json, collections
wd = sys.argv[1]
data = [r for r in json.load(open(os.path.join(wd, 'pairs.json'))) if not r['name'].startswith('جدلية العلاقة')]
H = re.compile('[ً-ٰٟـ]')
n = lambda s: H.sub('', s)
res = collections.Counter()
ex = collections.defaultdict(list)
for r in data:
    for p in r['paras']:
        a, b = p['a'], n(p['b'])
        for m in re.finditer(r'"([^"\n]{1,400})"', a):
            inner = n(m.group(1)).strip()
            if len(inner) < 2:
                continue
            words = len(inner.split())
            bucket = '1-3' if words <= 3 else '4-8' if words <= 8 else '9+'
            core = re.escape(inner[:40].strip())
            if re.search('«\\s*' + core, b):
                out = '«»'
            elif re.search(r'\(\s*' + core, b):
                out = '()'
            elif re.search(r'["“]\s*' + core, b):
                out = 'kept "'
            elif inner[:40] in b:
                out = 'removed'
            else:
                out = '?'
            res[(bucket, out)] += 1
            if len(ex[(bucket, out)]) < 4:
                ex[(bucket, out)].append(inner[:60])
for k in sorted(res):
    print(k, res[k], ' | '.join(ex[k][:3]))
