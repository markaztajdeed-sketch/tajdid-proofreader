// How much of what the proofreaders changed does the engine already do, what does it miss, and where does it disagree?
// 1) Every change the proofreader made (before → after, word tokens) is put in a category; for each one we check
//    whether the engine's output has the same text at that place (caught) or not (missed).
// 2) Every engine correction (group) is checked against the proofread text: agree / disagree / unclear.
// Usage: node measure.js <workdir with pairs.json> <engine.js> <out.json>
//   pairs.json records may carry .guide ('new' | 'old' | '?') and .batch.
const fs = require('fs'), path = require('path');
const [wd, enginePath, outPath] = process.argv.slice(2);
const E = require(path.resolve(enginePath));
const data = JSON.parse(fs.readFileSync(path.join(wd, 'pairs.json'), 'utf8')).filter(r => !r.name.startsWith('جدلية العلاقة'));

const TOK = /\s+|[\w؀-ۿً-ٟ]+|[^\s\w]/g;
const toks = s => s.match(TOK) || [];
const HARAKAT = /[ً-ْٰ]/g;
const PUNCT = /[\s.,،؛;:!?؟()\[\]{}«»"'“”‘’\-–—/…*]/g;

// compare texts ignoring harakat, except the one the rule or category is about
const SH = new Set(['shadda-sure', 'shadda-common', 'sun-shadda', 'nisba-shadda', 'ma-shadda', 'شدة']);
const keepFor = (k) => SH.has(k) ? '\u0651' : (k === 'tanween' || k === 'تنوين') ? '\u064B' : '';
const nvk = (s, keep) => s.replace(/[\u064B-\u0652\u0670]/g, ch => keep.includes(ch) ? ch : '').replace(/\s+/g, ' ');
function opcodes(a, b) {
  // token LCS (bounded); returns [op, i1, i2, j1, j2]
  const n = a.length, m = b.length;
  if (n * m > 9e6) return [['replace', 0, n, 0, m]];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0, si = 0, sj = 0;
  const flush = () => { if (i > si || j > sj) ops.push([i > si && j > sj ? 'replace' : i > si ? 'delete' : 'insert', si, i, sj, j]); };
  while (i < n && j < m) {
    if (a[i] === b[j]) { flush(); i++; j++; si = i; sj = j; continue; }
    if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  i = n; j = m; flush();
  return ops;
}

function classify(a, b) {
  if (a === b) return null;
  const sp = s => s.replace(/\s+/g, ' ');
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return 'مسافات';
  const pa = a.replace(PUNCT, ''), pb = b.replace(PUNCT, '');
  if (pa === pb) {
    const marks = s => s.replace(/[^()\[\]«»"“”'‘’\-–—/]/g, '');
    if (marks(a) !== marks(b)) {
      const q = s => s.replace(/[^()«»"“”]/g, ''), d = s => s.replace(/[^\-–—]/g, '');
      if (q(a) !== q(b)) return 'أقواس وتنصيص';
      if (d(a) !== d(b)) return 'شرطات';
      return 'ترقيم آخر';
    }
    return 'فواصل ونقاط';
  }
  if (pa.replace(HARAKAT, '') === pb.replace(HARAKAT, '')) {
    const sh = s => (s.match(/ّ/g) || []).length;
    if (sh(pa) !== sh(pb)) return 'شدة';
    const tn = s => s.replace(/[^ً]/g, '');
    if (/ً/.test(pa + pb)) return 'تنوين';
    return 'حركات أخرى';
  }
  const n = s => s.replace(HARAKAT, '').replace(/[أإآٱ]/g, 'ا');
  if (n(pa) === n(pb)) return 'همزة القطع والوصل';
  const n2 = s => n(s).replace(/ى/g, 'ي');
  if (n2(pa) === n2(pb)) return 'الياء والألف المقصورة';
  const n3 = s => n2(s).replace(/ة/g, 'ه');
  if (n3(pa) === n3(pb)) return 'التاء المربوطة';
  if (/\d|[٠-٩]/.test(a + b) && a.replace(/[\d٠-٩]/g, '') === b.replace(/[\d٠-٩]/g, '')) return 'أرقام';
  const wa = pa.replace(HARAKAT, ''), wb = pb.replace(HARAKAT, '');
  if (wa.replace(/ما|لا/g, '') === wb.replace(/ما|لا/g, '') && sp(a).split(' ').length !== sp(b).split(' ').length) return 'فصل ووصل';
  return 'كلمات (إملاء ونحو وأسلوب)';
}

// finer kind inside a category: is it a mechanical case the engine is meant to cover, or a judgement case?
const SUN = 'تثدذرزسشصضطظلن';
function sub(c, a, b) {
  const cnt = (s, r) => (s.match(r) || []).length;
  if (c === 'شدة') {
    const add = cnt(b, /\u0651/g) > cnt(a, /\u0651/g);
    const w = (add ? b : a).replace(/[\u064B-\u0650\u0652]/g, '');
    if (!add && new RegExp('ال[' + SUN + ']\u0651').test(w)) return 'حذف شدة الشمسي (آلي)';
    if (!add && /ي\u0651/.test(w)) return 'حذف شدة ياء النسبة (آلي)';
    if (add && /^[وفلبك]?(?:[أإ]ن|لكن|كأن|كل|إلا|ثم|مم|عم|إم|أم)\u0651/.test(w)) return 'شدة الأدوات (آلي)';
    return add ? 'شدة في كلمات أخرى (اجتهاد)' : 'حذف شدة أخرى';
  }
  if (c === 'تنوين') {
    const ta = cnt(a, /\u064B/g), tb = cnt(b, /\u064B/g);
    if (ta === tb) return 'موضع التنوين (آلي)';
    return tb > ta ? 'إضافة تنوين (نحو)' : 'حذف تنوين';
  }
  if (c === 'أقواس وتنصيص') {
    const q = s => s.replace(/[^()«»"“”]/g, '');
    if (q(a).length && q(b).length) return 'تغيير نوع العلامة (آلي)';
    return q(b).length ? 'إضافة أقواس أو تنصيص (اجتهاد)' : 'حذف أقواس أو تنصيص';
  }
  if (c === 'شرطات') {
    const d = s => s.replace(/[^\-–—]/g, '');
    if (d(a).length && d(b).length) return 'نوع الشرطة (آلي)';
    return d(b).length ? 'إضافة شرطة (اجتهاد)' : 'حذف شرطة';
  }
  if (c === 'فواصل ونقاط') {
    if (/;/.test(a) && /؛/.test(b) || /,/.test(a) && /،/.test(b)) return 'علامة لاتينية إلى عربية (آلي)';
    return 'إضافة أو حذف أو تغيير علامة (اجتهاد)';
  }
  return c;
}
const words = {};
// map A-token boundaries to E-token boundaries
function boundaryMap(ops, n) {
  const lo = new Int32Array(n + 1), hi = new Int32Array(n + 1);
  let ia = 0, ie = 0;
  const eq = (to) => { for (let k = ia; k <= to; k++) lo[k] = hi[k] = ie + (k - ia); ie += to - ia; ia = to; };
  for (const [op, i1, i2, j1, j2] of ops) {
    eq(i1);
    if (op === 'insert') { lo[i1] = j1; hi[i1] = j2; }
    else { lo[i1] = hi[i1] = j1; for (let k = i1 + 1; k < i2; k++) { lo[k] = j1; hi[k] = j2; } }
    ia = i2; ie = j2; lo[i2] = hi[i2] = j2;
  }
  eq(n);
  return { lo, hi };
}

const cats = {}, rules = {}, samples = { missed: {}, wrong: {} };
const bump = (o, k, g, f) => { const c = o[k] || (o[k] = {}); const x = c[g] || (c[g] = { n: 0, caught: 0, agree: 0, disagree: 0, unclear: 0 }); x.n++; if (f) x[f]++; };
const keep = (o, k, s) => { const a = o[k] || (o[k] = []); if (a.length < 40 && Math.random() < 0.5) a.push(s); };

for (const r of data) {
  const g = r.guide || '?';
  const lex = E.buildLexicon(r.paras.map(p => p.a));
  for (const p of r.paras) {
    const res = E.findGroups(p.a, { opts: {}, where: p.part, inNotes: p.part === 'notes', lexicon: lex });
    const out = E.applyEdits(p.a, res.groups.flatMap(x => x.edits));
    const tA = toks(p.a), tB = toks(p.b), tE = toks(out);
    const opsAB = p.a === p.b ? [] : opcodes(tA, tB);
    const mB = boundaryMap(opsAB, tA.length), mE = boundaryMap(opcodes(tA, tE), tA.length);
    const starts = []; { let c = 0; for (const t of tA) { starts.push(c); c += t.length; } starts.push(c); }
    const tokAt = (ch) => { let lo = 0, hi = tA.length; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= ch) lo = m; else hi = m - 1; } return lo; };
    // engine corrections vs proofreader: compare the words around each correction (short vowels ignored)
    for (const gr of res.groups) {
      const ed = gr.edits; const lo = Math.min(...ed.map(e => e.start)), hi = Math.max(...ed.map(e => e.end));
      let t1 = tokAt(Math.max(0, lo - 1)), t2 = tokAt(Math.max(lo, hi)) + 1;
      // widen to one word on each side
      let w = 0; while (t1 > 0 && w < 1) { t1--; if (/\S/.test(tA[t1]) && !/^\s+$/.test(tA[t1]) && /[\u0600-\u06FF\w]/.test(tA[t1])) w++; }
      w = 0; while (t2 < tA.length && w < 1) { if (/[\u0600-\u06FF\w]/.test(tA[t2])) w++; t2++; }
      const A0 = starts[t1], A1 = starts[t2];
      // const inner = ed.filter(e => e.start >= A0 && e.end <= A1).map(e => ({ ...e, start: e.start - A0, end: e.end - A0 }));
      const orig = p.a.slice(A0, A1), fixed = tE.slice(mE.lo[t1], mE.hi[t2]).join('');
      const kp = keepFor(gr.rule.id), nv = x => nvk(x, kp);
      const cands = [tB.slice(mB.lo[t1], mB.hi[t2]), tB.slice(mB.hi[t1], mB.lo[t2]), tB.slice(mB.lo[t1], mB.lo[t2]), tB.slice(mB.hi[t1], mB.hi[t2])].map(x => nv(x.join('')));
      let v = 'unclear';
      if (cands.includes(nv(fixed))) v = 'agree'; else if (cands.includes(nv(orig))) v = 'disagree';
      bump(rules, gr.rule.id, g, v);
      if (v === 'unclear' && g === 'new' && process.env.DBG === gr.rule.id) console.log('U|', orig, '→', fixed, '|B:', cands[0]);
      if (v === 'disagree' && g === 'new') keep(samples.wrong, gr.rule.id, r.name.slice(0, 30) + ' | ' + orig + '  →  ' + fixed);
    }
    if (p.a === p.b) continue;
    // proofreader changes vs engine output
    const { lo, hi } = mE;
    for (const [op, i1, i2, j1, j2] of opsAB) {
      const a = tA.slice(i1, i2).join(''), b = tB.slice(j1, j2).join('');
      if (op === 'replace' && a.length > 200) continue;
      let c = classify(a, b); if (!c) continue;
      if (c === 'مسافات' && (i1 === 0 || i2 === tA.length || /\t|\n/.test(a + b))) continue; // edges and tabs are not visible text
      if (c === 'مسافات' && /[^\u0600-\u06FF\s\d.,،؛:()"«»\-]/.test(tA.slice(Math.max(0, i1 - 1), i2 + 1).join(''))) c = 'مسافات في نص أجنبي';
      const cand = [tE.slice(lo[i1], hi[i2]), tE.slice(hi[i1], lo[i2]), tE.slice(lo[i1], lo[i2]), tE.slice(hi[i1], hi[i2])].map(x => x.join(''));
      const kp = keepFor(c), caught = cand.map(x => nvk(x, kp)).includes(nvk(b, kp));
      bump(cats, c, g, caught ? 'caught' : null);
      if (c !== sub(c, a, b)) bump(cats, c + ' › ' + sub(c, a, b), g, caught ? 'caught' : null);
      if (!caught && /همزة|الياء|التاء|كلمات/.test(c) && b.length < 30) { const k = c[0] + '|' + a.trim() + ' → ' + b.trim(); const o = words[k] || (words[k] = { n: 0, docs: new Set() }); o.n++; o.docs.add(r.name); }
      if (!caught && g === 'new') {
        const ctx = tA.slice(Math.max(0, i1 - 8), i1).join('') + '⟦' + a + '⟧' + tA.slice(i2, i2 + 8).join('') + '  →  ⟦' + b + '⟧';
        keep(samples.missed, sub(c, a, b), r.name.slice(0, 30) + ' | ' + ctx);
      }
    }
  }
}
const sum = (o) => { const t = {}; for (const [k, gs] of Object.entries(o)) { t[k] = { n: 0, caught: 0, agree: 0, disagree: 0, unclear: 0 }; for (const x of Object.values(gs)) for (const f in x) t[k][f] += x[f]; } return t; };
const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '-';
console.log('== تعديلات المدققين: هل يفعلها المحرك؟ (الكل | الدليل الجديد)');
const SC = sum(cats);
const line = (k, x, lab) => { const nw = cats[k].new || { n: 0, caught: 0 }; console.log(lab.padEnd(40), String(x.n).padStart(6), pc(x.caught, x.n).padStart(5), ' | ', String(nw.n).padStart(5), pc(nw.caught, nw.n).padStart(5)); };
for (const [k, x] of Object.entries(SC).filter(([k]) => !k.includes(' › ')).sort((a, b) => b[1].n - a[1].n)) {
  line(k, x, k);
  for (const [k2, x2] of Object.entries(SC).filter(([k2]) => k2.startsWith(k + ' › ')).sort((a, b) => b[1].n - a[1].n)) line(k2, x2, '   ' + k2.split(' › ')[1]);
}
console.log('\n== تصحيحات المحرك: هل وافقها المدقق؟ (الكل: عدد، موافقة، مخالفة | الدليل الجديد)');
for (const [k, x] of Object.entries(sum(rules)).sort((a, b) => b[1].n - a[1].n)) {
  const nw = rules[k].new || { n: 0, agree: 0, disagree: 0 };
  console.log(k.padEnd(14), String(x.n).padStart(6), pc(x.agree, x.n).padStart(5), pc(x.disagree, x.n).padStart(5), ' | ', String(nw.n).padStart(5), pc(nw.agree, nw.n).padStart(5), pc(nw.disagree, nw.n).padStart(5));
}
const agg = (pred) => { let n = 0, k = 0; for (const [key, gs] of Object.entries(cats)) if (pred(key)) { const x = gs.new || { n: 0, caught: 0 }; n += x.n; k += x.caught; } return [n, k]; };
const mech = agg(k => /\(آلي\)/.test(k) || k === 'مسافات' || k === 'الياء والألف المقصورة');
console.log('\nالدليل الجديد: الحالات الآلية', mech[0], 'التقط المحرك', mech[1], pc(mech[1], mech[0]));
const topw = Object.entries(words).filter(([k, o]) => o.docs.size >= 3).sort((x, y) => y[1].n - x[1].n).slice(0, 300).map(([k, o]) => [k, o.n, o.docs.size]);
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ cats, rules, samples, topw }, null, 1));
