// For each rule: net change in token distance to the proofread text when only that rule is applied.
// Negative = the rule moves the text away from what the proofreaders did.
// Usage: node perrule.js <workdir> <engine.js>
const fs=require('fs'),path=require('path');const [wd,ep]=process.argv.slice(2);const E=require(path.resolve(ep));
const data=JSON.parse(fs.readFileSync(path.join(wd,'pairs.json'),'utf8'));
const toks=s=>s.match(/\S+/g)||[];
function dist(a,b){const A=toks(a),B=toks(b);if(A.length*B.length>4e6)return Math.max(A.length,B.length);const m=B.length;let p=new Uint16Array(m+1),c=new Uint16Array(m+1);for(let i=1;i<=A.length;i++){for(let j=1;j<=m;j++)c[j]=A[i-1]===B[j-1]?p[j-1]+1:Math.max(p[j],c[j-1]);[p,c]=[c,p];}return A.length+B.length-2*p[m];}
const R={};
for(const r of data){const lex=E.buildLexicon(r.paras.map(p=>p.a));
 for(const p of r.paras){const gs=E.findGroups(p.a,{opts:{},where:p.part,inNotes:p.part==='notes',lexicon:lex}).groups;if(!gs.length)continue;
  const d0=dist(p.a,p.b);const by={};for(const g of gs)(by[g.rule.id]=by[g.rule.id]||[]).push(...g.edits);
  for(const [id,ed] of Object.entries(by)){const d1=dist(E.applyEdits(p.a,ed),p.b);const o=R[id]||(R[id]={gain:0,n:0});o.gain+=d0-d1;o.n+=ed.length;}}}
for(const [id,o] of Object.entries(R).sort((a,b)=>a[1].gain-b[1].gain))console.log(id.padEnd(14),String(o.n).padStart(6),String(o.gain).padStart(7));
