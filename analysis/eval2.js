// For each rule: how often it fires on the "before" texts vs on the proofread "after" texts.
// If the proofreaders follow the rule, it should almost never fire on the after texts.
// Usage: node eval2.js <workdir> <engine.js> [samples-rule]
const fs = require('fs'), path = require('path');
const [wd, enginePath, show] = process.argv.slice(2);
const E = require(path.resolve(enginePath));
const data = JSON.parse(fs.readFileSync(path.join(wd, 'pairs.json'), 'utf8')).filter(r => !r.name.startsWith('جدلية العلاقة'));
const cnt = {}, names = {}, ex = [];
const run = (text, part, side, lexicon) => {
  const res = E.findGroups(text, { opts: {}, where: part, inNotes: part === 'notes', lexicon });
  for (const g of res.groups) {
    const c = cnt[g.rule.id] || (cnt[g.rule.id] = { A: 0, B: 0 });
    c[side]++; names[g.rule.id] = g.rule.name;
    if (show === g.rule.id && side === 'B' && ex.length < 400) ex.push(g.before.pre.slice(-25) + '⟦' + g.before.mid + '⟧' + g.before.post.slice(0, 20) + '  →  ⟦' + g.after.mid + '⟧');
  }
};
for (const r of data) {
  const LA = E.buildLexicon ? E.buildLexicon(r.paras.map(p => p.a)) : null, LB = E.buildLexicon ? E.buildLexicon(r.paras.map(p => p.b)) : null;
  for (const p of r.paras) { run(p.a, p.part, 'A', LA); run(p.b, p.part, 'B', LB); }
}
let a = 0, b = 0;
for (const [id, c] of Object.entries(cnt).sort((x, y) => y[1].A - x[1].A)) {
  a += c.A; b += c.B;
  const agree = c.A ? Math.max(0, 100 * (1 - c.B / c.A)) : 0;
  console.log(id.padEnd(14), names[id].padEnd(38), String(c.A).padStart(6), String(c.B).padStart(6), (agree.toFixed(0) + '%').padStart(5));
}
console.log('TOTAL'.padEnd(53), String(a).padStart(6), String(b).padStart(6));
if (ex.length) console.log(ex.join('\n'));
