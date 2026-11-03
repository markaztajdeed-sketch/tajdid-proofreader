// How much of the proofreaders' work does the engine reproduce?
// Counts changed word tokens between before→after, and between engine(before)→after.
// Usage: node coverage.js <workdir> <engine.js> <out.json>
const fs = require('fs'), path = require('path');
const [wd, enginePath, outPath] = process.argv.slice(2);
const E = require(path.resolve(enginePath));
const data = JSON.parse(fs.readFileSync(path.join(wd, 'pairs.json'), 'utf8')).filter(r => !r.name.startsWith('جدلية العلاقة'));
const toks = s => s.match(/\S+/g) || [];
// token-level LCS distance (number of tokens not matched), bounded for long paragraphs
function dist(a, b) {
  const A = toks(a), B = toks(b);
  if (A.length * B.length > 4e6) return Math.max(A.length, B.length);
  const m = B.length; let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= m; j++) cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return A.length + B.length - 2 * prev[m];
}
const rows = [];
let T0 = 0, T1 = 0;
for (const r of data) {
  const lex = E.buildLexicon(r.paras.map(p => p.a));
  let d0 = 0, d1 = 0;
  for (const p of r.paras) {
    const g = E.findGroups(p.a, { opts: {}, where: p.part, inNotes: p.part === 'notes', lexicon: lex }).groups;
    const a2 = E.applyEdits(p.a, g.flatMap(x => x.edits));
    d0 += dist(p.a, p.b); d1 += dist(a2, p.b);
  }
  T0 += d0; T1 += d1;
  rows.push({ name: r.name, before: d0, afterEngine: d1, pct: Math.round(100 * (d0 - d1) / d0) });
}
rows.forEach(r => console.log(r.name.slice(0, 40).padEnd(40), String(r.before).padStart(6), String(r.afterEngine).padStart(6), (r.pct + '%').padStart(5)));
console.log('TOTAL'.padEnd(40), String(T0).padStart(6), String(T1).padStart(6), (Math.round(100 * (T0 - T1) / T0) + '%').padStart(5));
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ rows, T0, T1 }));
