"""Learn a 'words the proofreaders write with shadda' list from the after-texts, with a held-out check.
Usage: python3 -I shaddalex.py <workdir> [out.json]
"""
import sys, os, re, json, collections, random

wd = sys.argv[1]
data = [r for r in json.load(open(os.path.join(wd, 'pairs.json'))) if not r['name'].startswith('جدلية العلاقة')]
OTHER = re.compile('[ً-ِْ-ٰٟـ]')  # every mark except shadda
WORD = re.compile('[ء-يّ]+')
FUNC = re.compile('^[وفبلك]?(?:أن|إن|لكن|كأن|كل|إلا|مما|عما|أما|إما|ثم)')


def words(text):
    return WORD.findall(OTHER.sub('', text))


def learn(recs, min_n=3, ratio=0.9):
    withs, without = collections.Counter(), collections.Counter()
    for r in recs:
        for p in r['paras']:
            for w in words(p['b']):
                if 'ّ' in w:
                    withs[w] += 1
                else:
                    without[w] += 1
    lex = {}
    for w, n in withs.items():
        bare = w.replace('ّ', '')
        if len(bare) < 3 or re.search('يّ(ة|ا)?$', w) or FUNC.match(bare):
            continue  # nisba ya is a guide question; function words have their own rule
        if w.startswith('ال') and len(w) > 2 and w[3:4] == 'ّ':
            continue  # sun letter shadda
        if n >= min_n and n / (n + without[bare]) >= ratio:
            # all shadda forms of this bare word must agree
            lex[bare] = w
    # drop bare forms that map to two different shadda forms
    forms = collections.defaultdict(set)
    for w in withs:
        forms[w.replace('ّ', '')].add(w)
    return {b: w for b, w in lex.items() if len(forms[b]) == 1}


def evaluate(lex, recs):
    ok = bad = 0
    for r in recs:
        for p in r['paras']:
            A, B = words(p['a']), set(words(p['b']))
            Bbare = set(w for w in B if 'ّ' not in w)
            for w in A:
                if w in lex:
                    if lex[w] in B:
                        ok += 1
                    elif w in Bbare:
                        bad += 1
    return ok, bad


random.seed(7)
names = [r['name'] for r in data]
tot_ok = tot_bad = 0
for k in range(4):  # 4-fold by article
    test = set(names[k::4])
    lex = learn([r for r in data if r['name'] not in test])
    ok, bad = evaluate(lex, [r for r in data if r['name'] in test])
    tot_ok += ok; tot_bad += bad
    print(f'fold {k}: lexicon {len(lex)} words, held-out: agreed {ok}, proofreader left bare {bad}')
print('held-out precision', round(100 * tot_ok / max(1, tot_ok + tot_bad)), '%')
full = learn(data)
print('full lexicon size', len(full))
print(list(full.items())[:40])
if len(sys.argv) > 2:
    json.dump(full, open(sys.argv[2], 'w'), ensure_ascii=False)
