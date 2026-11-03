"""Classify the before/after edits in pairs.json into kinds and print counts and samples.
Usage: python3 -I classify.py <workdir> [kind-to-dump [n]]
"""
import sys, os, re, json, collections, random

HAR = re.compile('[ً-ٰٟ]')
AR_DIG = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')


def strip_h(s):
    return HAR.sub('', s)


def alef(s):
    return re.sub('[أإآٱ]', 'ا', s)


def kind(e):
    a, b = e['a'], e['b']
    A, B = a.replace('ـ', ''), b.replace('ـ', '')
    if re.sub(r'\s', '', a) == re.sub(r'\s', '', b):
        if a.strip() == '' or b.strip() == '':
            return 'space'
        return 'space'
    if a != '' and b != '' and a.replace('ـ', '') == b.replace('ـ', ''):
        return 'tatweel'
    if strip_h(A) == strip_h(B):
        ha, hb = len(HAR.findall(A)), len(HAR.findall(B))
        if 'ً' in a + b and abs(ha - hb) == 0:
            return 'tanween-pos'
        return 'harakat-add' if hb > ha else 'harakat-remove' if ha > hb else 'harakat-change'
    sa, sb = strip_h(A), strip_h(B)
    if alef(sa) == alef(sb):
        return 'hamza'
    if sa.translate(AR_DIG) == sb.translate(AR_DIG):
        return 'digits'
    if re.sub('ة', 'ه', sa) == re.sub('ة', 'ه', sb):
        return 'ta-marbuta'
    if re.sub('ى', 'ي', sa) == re.sub('ى', 'ي', sb):
        return 'ya-maqsura'
    if alef(re.sub('ى', 'ي', re.sub('ة', 'ه', sa))) == alef(re.sub('ى', 'ي', re.sub('ة', 'ه', sb))):
        return 'orthography-mixed'
    letters = lambda s: re.sub(r'[^ء-ي\w]', '', s)
    if letters(sa) == letters(sb):
        # only punctuation / symbols differ
        pa, pb = re.sub(r'[ء-ي\w\s]', '', sa), re.sub(r'[ء-ي\w\s]', '', sb)
        if set(pa + pb) <= set('"“”«»\'‘’'):
            return 'quotes'
        if set(pa + pb) <= set('()[]{}'):
            return 'brackets'
        if set(pa + pb) <= set('-–—ـ'):
            return 'dash'
        return 'punct'
    if not a.strip():
        return 'insert-word'
    if not b.strip():
        return 'delete-word'
    if '' in a + b:
        return 'footnote-ref'
    return 'word-change'


def main(wd, dump=None, n=60):
    data = json.load(open(os.path.join(wd, 'pairs.json')))
    c = collections.Counter()
    per = collections.defaultdict(list)
    for r in data:
        if r['name'].startswith('جدلية العلاقة'):
            continue  # after-file is a different restructured version
        for e in r['edits']:
            k = kind(e)
            c[k] += 1
            per[k].append((r['name'], e))
    if dump:
        random.seed(1)
        sample = random.sample(per[dump], min(n, len(per[dump])))
        for name, e in sample:
            print(repr(e['a']), '→', repr(e['b']), '|', e['ctxA'].replace('\n', ' ')[:120], '||', e['ctxB'].replace('\n', ' ')[:120])
        return
    for k, v in c.most_common():
        print(k.ljust(18), v)
    json.dump({k: [(nm, e) for nm, e in v] for k, v in per.items()}, open(os.path.join(wd, 'bykind.json'), 'w'), ensure_ascii=False)


main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None, int(sys.argv[3]) if len(sys.argv) > 3 else 60)
