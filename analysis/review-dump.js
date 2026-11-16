// Usage: node review-dump.js <engine.js> <pairs.json> <out.tsv>
// word-level dump of every engine suggestion: doc, para, rule, before-word(s), after-word(s), context
const E=require(process.argv[2]);const d=require(process.argv[3]);const out=[];
const W=/[ء-يً-ْٰـA-Za-z0-9٠-٩]/;
for(const r of d){const l=E.buildLexicon(r.paras.map(p=>p.a));r.paras.forEach((p,i)=>{const t=p.a;
 for(const g of E.findGroups(t,{opts:{},where:p.part,inNotes:p.part==='notes',lexicon:l}).groups){
  const s=Math.min(...g.edits.map(e=>e.start)),e=Math.max(...g.edits.map(e=>e.end));
  let a=s,b=e;while(a>0&&W.test(t[a-1]))a--;while(b<t.length&&W.test(t[b]))b++;
  if(b-a>80){a=s;b=e;}
  const sub=t.slice(a,b);const aft=E.applyEdits(sub,g.edits.map(x=>({...x,start:x.start-a,end:x.end-a})));
  out.push([r.name.slice(0,3),i,g.rule.id,sub,aft,t.slice(Math.max(0,a-35),a),t.slice(b,b+35),r.guide||''].join('\t'));}});}
require('fs').writeFileSync(process.argv[4],out.join('\n'));
