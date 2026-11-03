t=open('template.html').read()
t=t.replace('/*__ENGINE__*/',open('engine.js').read()).replace("'/*__SAMPLE__*/'","'"+open('../proto/sample.b64').read().strip()+"'")
open('tajdid-editor.html','w').write(t)
open('preview.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+t+'</body></html>')
