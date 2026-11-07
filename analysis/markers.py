"""Per-article before>after counts of the markers that tell which guide/convention a proofreader followed
(nisba shadda, tanween, أنّ/أنَّ, quote marks, Quran refs, salawat forms, ص/ط/ج spacing, years...).
Usage: python3 -I markers.py <workdir> [skip-key ...]   (reads <workdir>/pairs.json from extract.py)
The last column sums all articles except the skipped keys (e.g. s06 for a pair whose "before" is already proofread).
"""
import json, os, re, sys

L = 'ء-ي'
H = 'ً-ْ'
MARKERS = [
    ('nisba+shadda', f'[{L}]{{3,}}يّ(?:ة|اً|ا)?(?![{L}])'),
    ('ًا (on letter)', 'ًا'), ('اً (on alef)', 'اً'),
    ('أنَّ shadda+fatha', f'(?<![{L}])[وفلب]?[أإ]نَّ(?![{L}])'),
    ('أنّ shadda only', f'(?<![{L}])[وفلب]?[أإ]نّ(?![{L}{H}])'),
    ('أن bare + ال', f'(?<![{L}])أن(?= ال)'),
    ('كلّ', f'(?<![{L}])كلّ'), ('كل bare', f'(?<![{L}])كل(?![{L}{H}])'),
    ('إلّا', 'إلّا'), ('حتّى', 'حتّى'),
    ('straight "', '"'), ('short "..."', '"[^"\\n]{1,30}"'), ('« »', '[«»]'), ('“ ”', '[“”]'),
    ('﴿ ﴾', '[﴾﴿]'), ('{ }', '[{}]'), ('من الآية', 'من الآية'), ('[سورة: ...]', '\\[[^\\]]{2,15}: '),
    ('، لأن', '، ?لأن'), ('؛ لأن', '؛ ?لأن'),
    ('ﷺ', 'ﷺ'), ('﵌ (وآله)', '﵌'), ('﵇ glyphs', '[﵇﵈﵂﵁]'), ('صلى الله...', 'صل[ىّ]+ الله'),
    ('(ص)', '\\(ص\\)'), ('(ع)', '\\(ع\\)'), ('عليه السلام', 'عليه السلام|عليهم السلام|عليها السلام'),
    ('ص N', f'(?<![{L}])ص[.:]? +\\d'), ('صN', f'(?<![{L}])ص\\d'),
    ('ط N', f'(?<![{L}])ط[.:]? +\\d'), ('طN', f'(?<![{L}])ط\\d'),
    ('ج N', f'(?<![{L}])ج[.:]? +\\d'), ('جN', f'(?<![{L}])ج\\d'),
    ('هـ/م', 'هـ ?/ ?\\d'), ('هـ-م', 'هـ ?- ?\\d'), ('(ت N', '\\(ت:? ?\\d'), ('Nم)', '\\d{3,4}م\\)'),
    ('Indic digits', '[٠-٩]'),
    ('ينظر', 'ينظر|يُنظر'), ('انظر', 'انظر'), ('استخدام', 'استخدام'), ('استعمال', 'استعمال'),
    ('باعتبار', 'باعتبار'), ('بوصف', 'بوصف'), ('رئيسية/رئيسي', 'رئيسية|رئيسي'),
]


def main(wd, skip):
    data = json.load(open(os.path.join(wd, 'pairs.json')))
    rows = [['marker'] + [r['name'][:3] for r in data] + ['total']]
    for name, pat in MARKERS:
        rx = re.compile(pat)
        row, ta, tb = [name], 0, 0
        for r in data:
            a = len(rx.findall('\n'.join(p['a'] for p in r['paras'])))
            b = len(rx.findall('\n'.join(p['b'] for p in r['paras'])))
            row.append(f'{a}>{b}')
            if r['name'][:3] not in skip:
                ta, tb = ta + a, tb + b
        rows.append(row + [f'{ta}>{tb}'])
    w = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    for r in rows:
        print('  '.join(c.ljust(w[i]) for i, c in enumerate(r)))


main(sys.argv[1], set(sys.argv[2:]))
