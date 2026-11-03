const fs=require('fs'), JSZip=require('jszip'), {DOMParser,XMLSerializer}=require('@xmldom/xmldom');
const E=require('./engine.js');
const xml={parse:s=>new DOMParser().parseFromString(s,'application/xml'), serialize:d=>new XMLSerializer().serializeToString(d)};
(async()=>{
 const opts={translated:false,salam:true,outType:'nodebuffer'};
 const r=await E.processDocx(JSZip,fs.readFileSync(process.argv[2]),opts,xml);
 fs.writeFileSync(process.argv[3],r.data);
 const c=await E.processDocx(JSZip,fs.readFileSync(process.argv[2]),{...opts,clean:true},xml);
 fs.writeFileSync(process.argv[3].replace('.docx','-clean.docx'),c.data);
 for(const ch of r.changes) console.log(ch.rule.no, ch.rule.id,'|',ch.before.mid,'→',ch.after.mid,'|', ch.where);
 console.log('warnings',JSON.stringify(r.warnings));
 console.log('paragraphs',r.paragraphs,'changes',r.changes.length);
})();
