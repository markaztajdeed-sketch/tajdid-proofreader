"""Extract paragraph text from before/after docx pairs and diff them.
Usage: python3 -I extract.py <workdir>
Writes <workdir>/pairs.json : [{name, stats, edits:[{part, a, b, ctxA, ctxB}]}]
"""
import sys, os, re, json, zipfile, difflib
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
FN = ''


def para_text(p):
    out = []
    for el in p.iter():
        tag = el.tag
        if tag == W + 't':
            # skip text inside deletions
            out.append(el.text or '')
        elif tag == W + 'delText':
            pass
        elif tag in (W + 'footnoteReference', W + 'endnoteReference'):
            out.append(FN)
        elif tag == W + 'tab':
            out.append('\t')
    return ''.join(out)


def read_docx(path):
    z = zipfile.ZipFile(path)
    res = {'body': [], 'notes': [], 'ins': 0, 'del': 0, 'comments': 0}
    for part, key in (('word/document.xml', 'body'), ('word/footnotes.xml', 'notes'), ('word/endnotes.xml', 'notes')):
        if part not in z.namelist():
            continue
        root = ET.fromstring(z.read(part))
        res['ins'] += len(root.findall('.//' + W + 'ins'))
        res['del'] += len(root.findall('.//' + W + 'del'))
        for p in root.iter(W + 'p'):
            t = para_text(p)
            if t.strip():
                res[key].append(t)
    if 'word/comments.xml' in z.namelist():
        res['comments'] = len(ET.fromstring(z.read('word/comments.xml')).findall('.//' + W + 'comment'))
    return res


TOK = re.compile(r'\s+|[^\s]')  # tokens: whitespace runs or single chars


def words(s):
    return re.findall(r'\s+|[\w؀-ۿً-ٟ]+|[^\s\w]', s)


def diff_para(a, b):
    ta, tb = words(a), words(b)
    sm = difflib.SequenceMatcher(None, ta, tb, autojunk=False)
    edits = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            continue
        ea, eb = ''.join(ta[i1:i2]), ''.join(tb[j1:j2])
        ca = ''.join(ta[max(0, i1 - 6):i1]) + '⟦' + ea + '⟧' + ''.join(ta[i2:i2 + 6])
        cb = ''.join(tb[max(0, j1 - 6):j1]) + '⟦' + eb + '⟧' + ''.join(tb[j2:j2 + 6])
        edits.append({'a': ea, 'b': eb, 'ctxA': ca, 'ctxB': cb})
    return edits


def align(pa, pb):
    """Align paragraph lists; return list of (a, b) where either may be None."""
    norm = lambda s: re.sub(r'[\sً-ٟـ]+', '', s)[:60]
    sm = difflib.SequenceMatcher(None, [norm(x) for x in pa], [norm(x) for x in pb], autojunk=False)
    pairs = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            pairs += list(zip(pa[i1:i2], pb[j1:j2]))
        elif op == 'replace':
            # pair greedily by similarity
            A, B = pa[i1:i2], pb[j1:j2]
            used = set()
            for x in A:
                best, bs = None, 0.5
                for k, y in enumerate(B):
                    if k in used:
                        continue
                    r = difflib.SequenceMatcher(None, x, y, autojunk=False).quick_ratio()
                    if r > bs:
                        best, bs = k, r
                if best is None:
                    pairs.append((x, None))
                else:
                    used.add(best)
                    pairs.append((x, B[best]))
            for k, y in enumerate(B):
                if k not in used:
                    pairs.append((None, y))
        elif op == 'delete':
            pairs += [(x, None) for x in pa[i1:i2]]
        else:
            pairs += [(None, y) for y in pb[j1:j2]]
    return pairs


def main(wd):
    out = []
    for f in sorted(os.listdir(os.path.join(wd, 'before'))):
        if not f.endswith('.docx'):
            continue
        a = read_docx(os.path.join(wd, 'before', f))
        b = read_docx(os.path.join(wd, 'after', f))
        rec = {'name': f[:-5], 'stats': {'paraA': len(a['body']) + len(a['notes']), 'paraB': len(b['body']) + len(b['notes']),
               'wordsA': sum(len(x.split()) for x in a['body'] + a['notes']), 'trackedB': b['ins'] + b['del'], 'trackedA': a['ins'] + a['del'],
               'commentsB': b['comments']}, 'edits': [], 'onlyA': 0, 'onlyB': 0, 'paras': []}
        for part in ('body', 'notes'):
            for x, y in align(a[part], b[part]):
                if x is None:
                    rec['onlyB'] += 1
                    continue
                if y is None:
                    rec['onlyA'] += 1
                    continue
                rec['paras'].append({'part': part, 'a': x, 'b': y})
                if x != y:
                    for e in diff_para(x, y):
                        e['part'] = part
                        rec['edits'].append(e)
        out.append(rec)
    json.dump(out, open(os.path.join(wd, 'pairs.json'), 'w'), ensure_ascii=False, indent=1)
    for r in out:
        print(r['name'][:40].ljust(40), r['stats'], 'edits', len(r['edits']), 'onlyA', r['onlyA'], 'onlyB', r['onlyB'])


main(sys.argv[1])
