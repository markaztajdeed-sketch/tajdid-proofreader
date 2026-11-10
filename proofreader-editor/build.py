# Builds tajdid-editor.html from template.html + engine.js + guide.js + the sample article.
# Run from this folder: python build.py
import base64, os
here = os.path.dirname(os.path.abspath(__file__))
p = lambda *a: os.path.join(here, *a)
t = open(p('template.html'), encoding='utf-8').read()
sample = base64.b64encode(open(p('..', 'proofreader-prototype', 'sample.docx'), 'rb').read()).decode()
t = t.replace('/*__ENGINE__*/', open(p('engine.js'), encoding='utf-8').read()).replace('/*__GUIDE__*/', open(p('guide.js'), encoding='utf-8').read()).replace('/*__LOGO__*/', base64.b64encode(open(p('assets', 'logo.png'), 'rb').read()).decode()).replace("'/*__SAMPLE__*/'", "'" + sample + "'")
open(p('tajdid-editor.html'), 'w', encoding='utf-8').write(t)
