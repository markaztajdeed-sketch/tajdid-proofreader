"""Pair before/after Word files whose names differ, and copy them into <workdir>/before and <workdir>/after
under the same short key, ready for extract.py. Old .doc files are converted with LibreOffice first.
Pairs whose two files are byte-identical (not proofread) are skipped.
Usage: python3 -I pair.py <before_dir> <after_dir> <workdir>
"""
import os, re, sys, shutil, hashlib, difflib, subprocess, tempfile


def docx_files(d):
    out, tmp = {}, tempfile.mkdtemp()
    for f in os.listdir(d):
        p = os.path.join(d, f)
        if f.endswith('.docx'):
            out[f[:-5]] = p
        elif f.endswith('.doc'):
            subprocess.run(['soffice', '--headless', '--convert-to', 'docx', '--outdir', tmp, p], capture_output=True)
            q = os.path.join(tmp, f[:-4] + '.docx')
            if os.path.exists(q):
                out[f[:-4]] = q
    return out


def norm(s):
    s = re.sub(r'[ً-ْ\s()\'.،؟?0-9]+', '', s)
    return s.replace('إ', 'ا').replace('أ', 'ا')


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest()


def main(bdir, adir, wd):
    A, B = docx_files(bdir), docx_files(adir)
    os.makedirs(os.path.join(wd, 'before'), exist_ok=True)
    os.makedirs(os.path.join(wd, 'after'), exist_ok=True)
    left = set(B)
    for i, (a, pa) in enumerate(sorted(A.items())):
        if not left:
            break
        b = max(left, key=lambda x: difflib.SequenceMatcher(None, norm(a), norm(x)).ratio())
        r = difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()
        left.discard(b)
        same = md5(pa) == md5(B[b])
        print(f'{r:.2f}', 'SAME' if same else '    ', a, '||', b)
        if same:
            continue
        key = f's{i + 1:02d} {a[:40]}.docx'
        shutil.copy(pa, os.path.join(wd, 'before', key))
        shutil.copy(B[b], os.path.join(wd, 'after', key))
    if left:
        print('unpaired after-files:', sorted(left))


main(*sys.argv[1:4])
