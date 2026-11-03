"""Corpus-level before/after statistics. Usage: python3 -I stats.py <workdir>"""
import sys, os, re, json, collections

wd = sys.argv[1]
data = [r for r in json.load(open(os.path.join(wd, 'pairs.json'))) if not r['name'].startswith('جدلية العلاقة')]
A = '\n'.join(p['a'] for r in data for p in r['paras'])
B = '\n'.join(p['b'] for r in data for p in r['paras'])
L = 'ء-ي'


def cnt(pat, s):
    return len(re.findall(pat, s))


rows = [
    ('words', r'\S+'),
    ('fatha (not with shadda)', '(?<!ّ)َ(?!ّ)'),
    ('damma', 'ُ'), ('kasra', 'ِ'), ('sukun', 'ْ'),
    ('shadda', 'ّ'), ('shadda+fatha', 'َّ|َّ'),
    ('tanween fath on letter before alef ًا', 'ًا'), ('tanween fath after alef اً', 'اً'),
    ('tanween damm', 'ٌ'), ('tanween kasr', 'ٍ'),
    ('word-final nisba ي with shadda', f'[{L}]{{3,}}يّ(?:ة|اً|ا)?(?![{L}])'),
    ('word-final nisba ي no shadda (ال..ي)', f'ال[{L}]{{3,}}ي(?:ة)?(?![{L}ّ])'),
    ('أنّ with shadda', 'أنّ'), ('أن bare followed by space+ال', 'أن(?= ال)'),
    ('إنّ', 'إنّ'), ('كلّ', '(?<![' + L + '])كلّ'), ('كل bare', '(?<![' + L + '])كل(?![' + L + 'ًّ-ْ])'),
    ('إلّا', 'إلّا'), ('إلا bare', '(?<![' + L + '])إلا(?![' + L + '])'),
    ('حتّى', 'حتّى'), ('حتى bare', '(?<![' + L + '])حتى'),
    ('straight quotes "', '"'), ('« »', '[«»]'), ('“ ”', '[“”]'),
    ('Latin run in ( )', r'\([A-Za-z][^()]*\)'),
    ('﴿ ﴾', '[﴾﴿]'), ('{ }', r'[{}]'),
    ('space before ، or .', r' [،.؛:؟]'),
    ('فى/التى/الذى', '(?<![' + L + '])(?:فى|التى|الذى|هى)(?![' + L + '])'),
    ('المرجع نفسه', 'المرجع نفسه'), ('المصدر نفسه', 'المصدر نفسه'), ('مرجع سابق', 'مرجع سابق|المرجع السابق'), ('مصدر سابق', 'مصدر سابق'),
    ('ص + space + digit', r'(?<![' + L + '])ص[.:]? +\d'), ('ص+digit', r'(?<![' + L + '])ص\d'),
    ('باعتبار', 'باعتبار'), ('بوصف', 'بوصف'),
    ('حيث أن', 'حيث أن'), ('حيث إن', 'حيث إن'),
    ('لابد', 'لابد'), ('لا بد', 'لا بد'),
    ('مسئول', 'مسئول'), ('مسؤول', 'مسؤول'),
    ('بعضها البعض', 'بعضها البعض|بعضهم البعض'),
    ('Western digits', r'\d'), ('Arabic-Indic digits', '[٠-٩]'),
    ('ـ tatweel', 'ـ'),
]
print('metric'.ljust(42), 'before', 'after')
for name, pat in rows:
    print(name.ljust(42), str(cnt(pat, A)).rjust(6), str(cnt(pat, B)).rjust(6))

# frequent words that gained shadda
gain = collections.Counter()
for r in data:
    for e in r['edits']:
        a, b = e['a'].strip(), e['b'].strip()
        if a and b and a.replace('ّ', '') == b.replace('ّ', '') and b.count('ّ') > a.count('ّ'):
            gain[re.sub('[،.؛:؟,]', '', b)] += 1
print('\nwords most often given a shadda:')
print(', '.join(f'{w}:{n}' for w, n in gain.most_common(60)))
