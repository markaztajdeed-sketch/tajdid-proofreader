// Extract proper names (أعلام) and repeated terms from the proofread texts, with how often and in how many articles
// they occur, and compare them with the dictionary.
// Western names/terms: the Arabic words written right before a Latin gloss in parentheses, «هايدغر (Heidegger)»;
// a capitalised gloss is a name, a lower-case one a term. Arab/Islamic names: ابن/أبو/عبد + name, and a name
// followed by death dates «(ت 413هـ)».
// Usage: node names.js <workdir with pairs.json> <dictionary.js> <out.json>
const fs = require('fs'), path = require('path');
const [wd, dictPath, outPath] = process.argv.slice(2);
const D = require(path.resolve(dictPath));
const data = JSON.parse(fs.readFileSync(path.join(wd, 'pairs.json'), 'utf8'));
const AR = '\\u0621-\\u064A\\u064B-\\u0652\\u0670';
const strip = s => s.replace(/[ً-ْٰـ]/g, '');
const key = s => strip(s).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const PRE = /^(?:و|ف|ب|ل|ك|وب|ول|فب|فل)(?=ال)|^(?:و|ف)(?=[^ال])/;
const STOP = new Set(['في', 'من', 'إلى', 'على', 'عن', 'مع', 'أو', 'و', 'هو', 'هي', 'التي', 'الذي', 'كتاب', 'كتابه', 'بعنوان', 'مصطلح', 'مفهوم', 'يسمى', 'يُسمى', 'ما', 'أي', 'أن', 'أنّ', 'إن', 'إنّ', 'قال', 'يقول', 'عند', 'لدى', 'بين', 'كما', 'هذا', 'هذه', 'ذلك', 'تلك', 'أيضاً', 'الفيلسوف', 'الفيلسوفة', 'المفكر', 'الباحث', 'الباحثة', 'العالم', 'عالم', 'الكاتب', 'الكاتبة', 'الأمريكي', 'الأمريكية', 'الألماني', 'الفرنسي', 'الفرنسية', 'البريطاني', 'الإنجليزي', 'اليوناني', 'النمساوي', 'الكندي', 'الأستاذ', 'الدكتور', 'د.', 'نظرية', 'مدرسة', 'اسم', 'باسم', 'المعروف', 'المعروفة', 'أمثال', 'مثل', 'منهم', 'ومنهم']);
const names = new Map(), terms = new Map();
// rough sound skeletons, to check that the Arabic words really are a transliteration of the Latin gloss
const latSk = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/sch|sh|ch(?=[aeiou])/g, 'S').replace(/ph/g, 'f').replace(/th/g, 't').replace(/kh|ch/g, 'H').replace(/gh/g, 'G').replace(/ck|qu?|c(?=[aou]|$)/g, 'k').replace(/c/g, 's').replace(/x/g, 'ks').replace(/[^a-zSHG]/g, '').replace(/[aeiouyw]/g, '').replace(/p/g, 'b').replace(/v/g, 'f').replace(/z/g, 's').replace(/d/g, 't').replace(/g|j/g, 'G').replace(/h/g, '').replace(/(.)\1+/g, '$1');
const AM = { 'ب': 'b', 'پ': 'b', 'ت': 't', 'ط': 't', 'ث': 's', 'د': 't', 'ض': 't', 'ذ': 's', 'ك': 'k', 'ق': 'k', 'غ': 'G', 'ج': 'G', 'ف': 'f', 'ڤ': 'f', 'س': 's', 'ص': 's', 'ز': 's', 'ش': 'S', 'م': 'm', 'n': 'n', 'ن': 'n', 'ل': 'l', 'ر': 'r', 'ه': '', 'ح': 'H', 'خ': 'H' };
const arSk = (s) => strip(s).replace(/^ال/, '').split('').map(c => AM[c] !== undefined ? AM[c] : '').join('').replace(/(.)\1+/g, '$1');
const lcs = (a, b) => { const dp = Array(b.length + 1).fill(0); for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]); prev = t; } } return dp[b.length]; };
const sounds = (ar, lat) => { const A = arSk(ar), L = latSk(lat); if (A.length < 2 || L.length < 2) return false; return 2 * lcs(A, L) / (A.length + L.length) >= 0.7; };
const add = (map, ar, lat, doc, art) => {
  const k = key(ar); let o = map.get(k);
  if (!o) map.set(k, o = { forms: new Map(), lat: new Map(), docs: new Set(), n: 0 });
  o.n++; o.docs.add(doc); o.forms.set(ar, (o.forms.get(ar) || 0) + 1);
  if (lat) o.lat.set(lat, (o.lat.get(lat) || 0) + 1);
};
let o_loan = false;
const words = s => s.split(/\s+/).filter(Boolean);
const clean = w => w.replace(/^[«"“(\[]+|[»"”)\],.،؛:]+$/g, '');
for (const r of data) {
  const doc = r.name;
  for (const p of r.paras) {
    const t = p.b;
    // Arabic words + (Latin gloss)
    for (const m of t.matchAll(new RegExp('((?:[' + AR + '.]+\\s+){1,4})\\(\\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.\'’\\- ]{1,60}?)\\s*[,،)]', 'g'))) {
      const lat = m[2].trim(); const lw = lat.split(/\s+/).filter(x => !/^(?:de|von|van|la|le|al|der|du|di|da|y|and|the|of)$/i.test(x) && x.length > 1);
      if (!lw.length || lw.length > 4) continue;
      const lastAr = strip((words(m[1]).map(clean).filter(Boolean).slice(-1)[0] || ''));
      const isName = !/^(?:[وفبلك]{0,2})ال/.test(lastAr) && /^[A-ZÀ-Ý]/.test(lat) && lw.every(x => /^[A-ZÀ-Ý]/.test(x) || /^(?:de|von|van|la|le|al)$/i.test(x));
      let aw = words(m[1]).map(clean).filter(Boolean);
      if (isName) {
        if (!aw.length) continue;
        let take = null;
        for (let k = Math.min(aw.length, lw.length + 1); k >= 1 && !take; k--) {
          const c = aw.slice(-k); c[0] = c[0].replace(PRE, '');
          if (!STOP.has(strip(c[0])) && sounds(c.join(''), lw.slice(-k).join(''))) take = c;
          else if (k > 1 && sounds(c.join(''), lw.join(''))) take = c;
        }
        if (!take) { const c = aw.slice(-1); c[0] = c[0].replace(PRE, ''); if (sounds(c[0], lw[lw.length - 1])) take = c; }
        if (!take) continue;
        add(names, take.join(' '), lat, doc);
      } else {
        let take = aw.slice(-Math.min(3, lw.length));
        while (take.length && STOP.has(strip(take[0]))) take.shift();
        if (!take.length) continue;
        take[0] = take[0].replace(/^(?:و|ف|ب|ل|ك|وب|ول)(?=ال)/, '');
        o_loan = sounds(take.join(''), lat);
        add(terms, take.join(' '), lat.toLowerCase(), doc);
        terms.get(key(take.join(' '))).glossDocs = (terms.get(key(take.join(' '))).glossDocs || new Set()).add(doc);
        if (o_loan) terms.get(key(take.join(' '))).loan = true;
      }
    }
    // Arab/Islamic names
    for (const m of t.matchAll(new RegExp('(?:^|[\\s(«"])((?:[وف]?(?:ابن|أبو|أبي|أبا|عبد)\\s+[' + AR + ']{2,}(?:\\s+(?:بن|ابن)\\s+[' + AR + ']{2,})?(?:\\s+ال[' + AR + ']{2,}ي(?![' + AR + ']))?))', 'g'))) {
      const nm = m[1].replace(/^[وف](?=(?:ابن|أبو|أبي|أبا|عبد))/, '');
      if (/^عبد\s+(?:الله|ه|ها)$/.test(strip(nm)) && false) continue;
      add(names, nm, '', doc);
    }
    for (const m of t.matchAll(new RegExp('((?:[' + AR + ']{2,}\\s+){1,3})\\(\\s*(?:ت\\.?|المتوفى|توفي)\\s*[0-9٠-٩]', 'g'))) {
      let aw = words(m[1]); while (aw.length && STOP.has(strip(aw[0]))) aw.shift();
      if (aw.length) { aw[0] = aw[0].replace(PRE, ''); add(names, aw.join(' '), 'ت', doc); }
    }
  }
}
// second pass: how often each name form occurs anywhere in the proofread texts (a gloss is given only once)
const docsText = data.map(r => ({ name: r.name, t: strip(r.paras.map(p => p.b).join('\n')) }));
const occ = (form) => { const f = strip(form); const re = new RegExp('(?<![\u0621-\u064A])(?:[وفبلك]{0,2})' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\u0621-\u064A])', 'g'); let n = 0, d = 0; for (const x of docsText) { const k = (x.t.match(re) || []).length; n += k; if (k) d++; } return [n, d]; };
for (const map of [names, terms]) for (const o of map.values()) { const f = [...o.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]; const [n, d] = occ(f); o.n = Math.max(o.n, n); o.dn = d; }
// variant spellings: same skeleton once long vowels, hamza and g/j are ignored
const skel = s => key(s).replace(/[اويء]/g, '').replace(/ج/g, 'غ').replace(/\s+/g, ' ');
// dictionary
const dictNames = new Map();
for (const n of D.names) { dictNames.set(key(n.name), n.name); for (const v of n.variants || []) dictNames.set(key(v), n.name + ' (صيغة مرفوضة)'); }
const dictTerms = new Set(D.terms.map(x => key(x.term.replace(/^ال/, ''))));
const dump = (map, isName) => [...map.entries()].filter(([k, o]) => true).map(([k, o]) => {
  const forms = [...o.forms.entries()].sort((a, b) => b[1] - a[1]);
  const lat = [...o.lat.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]).filter(x => x !== 'ت');
  const main = forms[0][0];
  const inDict = isName ? (dictNames.get(k) || [...dictNames.keys()].find(d => k.endsWith(' ' + d) || k === d) && (dictNames.get(k) || 'جزء من: ' + dictNames.get([...dictNames.keys()].find(d => k.endsWith(' ' + d))))) : dictTerms.has(key(main.replace(/^ال/, '')));
  return { glossDocs: o.glossDocs ? o.glossDocs.size : 0, loan: !!o.loan, skel: skel(main), main, forms: forms.map(x => x[0] + ' ×' + x[1]), lat: lat.slice(0, 3), n: o.n, docs: Math.max(o.docs.size, o.dn || 0), inDict: inDict || '' };
}).sort((a, b) => b.docs - a.docs || b.n - a.n);
const out = { names: dump(names, true), terms: dump(terms, false) };
const bySkel = new Map(); for (const x of out.names) { const a = bySkel.get(x.skel) || []; a.push(x); bySkel.set(x.skel, a); }
out.variantGroups = [...bySkel.values()].filter(a => a.length > 1).map(a => a.map(x => x.main + ' ×' + x.n + ' (' + x.docs + ' مقالات)' + (x.inDict ? ' [قاموس]' : '')));
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log('names', out.names.length, 'terms', out.terms.length);
for (const x of out.names.slice(0, 60)) console.log(x.docs, x.n, x.main, '|', x.lat.join('; '), '|', x.forms.slice(1, 4).join('، '), '|', x.inDict);
console.log('--- terms');
for (const x of out.terms.slice(0, 40)) console.log(x.docs, x.n, x.main, '|', x.lat.join('; '), '|', x.inDict);
