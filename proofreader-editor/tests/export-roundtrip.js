// Export round-trip test: accept every correction, export a tracked and a clean copy, then check that
//  accepting all changes in the tracked copy gives the corrected text, rejecting them gives the original,
//  and the clean copy equals the corrected text. Needs: npm i jszip @xmldom/xmldom
// Usage: node tests/export-roundtrip.js <out-dir> [file.docx ...]   (default: the sample article)
const fs=require('fs'), path=require('path'), JSZip=require('jszip'), {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const E=require(process.env.ENGINE||require('path').join(__dirname,'..','engine.js'));
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
let parseErr=[];
const xml={parse:s=>new DOMParser({onError:(l,m)=>{if(l!=='warning')parseErr.push(m)}}).parseFromString(s,'application/xml'), serialize:d=>new XMLSerializer().serializeToString(d)};
function view(doc, mode){
  for (const n of Array.from(doc.getElementsByTagNameNS(W,'commentReference'))) n.parentNode.parentNode.removeChild(n.parentNode); // mode accept|reject: transform revisions in place
  const kill = mode==='accept'?'del':'ins', keep = mode==='accept'?'ins':'del';
  for (const n of Array.from(doc.getElementsByTagNameNS(W,kill))) if(n.parentNode && n.parentNode.localName!=='rPr') n.parentNode.removeChild(n);
  for (const n of Array.from(doc.getElementsByTagNameNS(W,keep))) { if(n.parentNode.localName==='rPr') continue; while(n.firstChild) n.parentNode.insertBefore(n.firstChild,n); n.parentNode.removeChild(n); }
  if(mode==='reject') for (const t of Array.from(doc.getElementsByTagNameNS(W,'delText'))) { const nt=doc.createElementNS(W,'w:t'); while(t.firstChild) nt.appendChild(t.firstChild); t.parentNode.replaceChild(nt,t); }
}
async function texts(buf, mode){
  const zip=await JSZip.loadAsync(buf); const out=new Map();
  for (const p of ['word/document.xml','word/footnotes.xml','word/endnotes.xml']) { const f=zip.file(p); if(!f) continue; const s=await f.async('string'); const d=xml.parse(s); view(d,mode||'none'); zip.file(p,xml.serialize(d)); }
  const b=await zip.generateAsync({type:'nodebuffer'});
  const r=await E.loadDocx(JSZip,b,{translated:false},xml); r.paras.forEach(p=>out.set(p.key,p.text)); return out;
}
(async()=>{
  const outDir=process.argv[2]||'export-test-out'; let files=process.argv.slice(3); if(!files.length) files=[path.join(__dirname,'..','..','proofreader-prototype','sample.docx')]; fs.mkdirSync(outDir,{recursive:true});
  let tot={files:0,groups:0,bad:0};
  for (const f of files){
    parseErr=[];
    const buf=fs.readFileSync(f); const res=await E.loadDocx(JSZip,buf,{translated:false},xml);
    const exp=new Map(), orig=new Map(); let ng=0;
    for (const p of res.paras){ orig.set(p.key,p.text); const ed=p.groups.flatMap(g=>g.edits); ng+=p.groups.length; exp.set(p.key,E.applyEdits(p.text,ed)); }
    const decide=(k,t)=>{const p=res.paras.find(x=>x.key===k); return p && p.text===t ? p.groups.flatMap(g=>g.edits.map(e=>Object.assign({},e,{note:'القاعدة '+g.rule.no+': '+g.rule.name+'\n'+(g.rule.why||'')}))):null;};
    const tr=await E.exportDocx(JSZip,buf,decide,{translated:false,outType:'nodebuffer'},xml);
    const cl=await E.exportDocx(JSZip,buf,decide,{translated:false,clean:true,outType:'nodebuffer'},xml);
    const base=path.basename(f,'.docx').slice(0,40); fs.writeFileSync(path.join(outDir,base+' - tracked.docx'),tr); fs.writeFileSync(path.join(outDir,base+' - clean.docx'),cl);
    const A=await texts(tr,'accept'), R=await texts(tr,'reject'), C=await texts(cl,null);
    const errs=[];
    for (const [k,o] of orig){ const e=exp.get(k);
      // paragraphs whose expected text has no Arabic would vanish from loadDocx; compare when present
      if((A.get(k)??null)!==e && /[؀-ۿ]/.test(e)) errs.push(['accept',k,e.slice(0,80),(A.get(k)||'∅').slice(0,80)]);
      if(R.get(k)!==o) errs.push(['reject',k,o.slice(0,80),(R.get(k)||'∅').slice(0,80)]);
      if((C.get(k)??null)!==e && /[؀-ۿ]/.test(e)) errs.push(['clean',k]);
    }
    if(A.size!==orig.size) errs.push(['count', orig.size, A.size, R.size]);
    tot.files++; tot.groups+=ng; if(errs.length||parseErr.length) tot.bad++;
    console.log((errs.length||parseErr.length?'FAIL ':'ok   ')+base, 'paras',orig.size,'groups',ng, errs.length?JSON.stringify(errs.slice(0,3)):'', parseErr.slice(0,2).join('|'));
  }
  console.log(JSON.stringify(tot)); if(tot.bad) process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
