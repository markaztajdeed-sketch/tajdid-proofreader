/* Tajdid proofreading engine: tier-1 (deterministic) rules applied to a .docx as tracked changes. */
(function (root) {
  'use strict';
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const L = '\\u0621-\\u064A\\u066E-\\u06D3\\u06FA-\\u06FF';   // Arabic letters (no harakat)
  const H = '\\u064B-\\u065F\\u0670';                           // harakat
  const LH = L + H;
  const D = '0-9\\u0660-\\u0669\\u06F0-\\u06F9';               // Western, Arabic-Indic and Persian digits (digits stay as the author wrote them)
  const FN = '\uE001';   // footnote / endnote reference placeholder
  const OB = '\uFFFC';   // other opaque content placeholder
  const re = (s, f) => new RegExp(s.replace(/\{L\}/g, L).replace(/\{H\}/g, H).replace(/\{LH\}/g, LH).replace(/\{D\}/g, D), f || 'g');
  const fuzzy = s => [...s].map(c => (c === ' ' ? '\\s+' : c + '[' + H + ']*')).join('');

  // ---------------------------------------------------------------- rules
  // Each rule: id, no (guide rule number), name, why, scope ('all'|'notes'), word (skip inside quotes), find(text, ctx) -> edits
  const simple = (rx, repl) => text => {
    const out = [];
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text))) {
      const r = typeof repl === 'function' ? repl(m) : m[0].replace(new RegExp(rx.source, rx.flags.replace('g', '')), repl);
      if (r !== null && r !== m[0]) out.push({ start: m.index, end: m.index + m[0].length, repl: r });
      if (m[0].length === 0) rx.lastIndex++;
    }
    return out;
  };

  const LEVANT = [['كانون الثاني', 'يناير'], ['شباط', 'فبراير'], ['آذار', 'مارس'], ['نيسان', 'أبريل'], ['أيار', 'مايو'], ['حزيران', 'يونيو'], ['تموز', 'يوليو'], ['آب', 'أغسطس'], ['أيلول', 'سبتمبر'], ['تشرين الأول', 'أكتوبر'], ['تشرين الثاني', 'نوفمبر'], ['كانون الأول', 'ديسمبر']];
  const GREG_ALIASES = { 'إبريل': 'أبريل', 'يونيه': 'يونيو', 'يوليه': 'يوليو' };
  const NISBA_EXCEPT = new Set(['كرسي', 'بديهي']);
  const WORDS = [
    ['أفريقي', 'إفريقي'], ['إيديولوج', 'أيديولوج'], ['إنثروبولوج', 'أنثروبولوج'], ['أثنولوج', 'إثنولوج'],
    ['أبستمولوج', 'إبستمولوج'], ['أنترنت', 'إنترنت'], ['ليبيرالي', 'ليبرالي'], ['مسئول', 'مسؤول']
  ];
  // words always written with dotted ي (Egyptian-style dotless forms seen in submitted texts)
  const YA_FIXED = new Map([['فى', 'في'], ['التى', 'التي'], ['الذى', 'الذي'], ['هى', 'هي'], ['اللتى', 'اللتي'], ['اللذى', 'اللذي']]);
  // words that legitimately end in ى and also exist with ي: never switch them on document evidence
  const YA_STOP = new Set(['على', 'إلى', 'حتى', 'متى', 'لدى', 'سوى', 'مصطفى', 'موسى', 'عيسى', 'يحيى', 'مستشفى', 'المعنى', 'معنى', 'مبنى', 'المبنى', 'أولى', 'الأولى', 'أخرى', 'الأخرى', 'كبرى', 'الكبرى', 'صغرى', 'الصغرى', 'أدنى', 'الأدنى', 'أعلى', 'الأعلى', 'مستوى', 'المستوى', 'فتوى', 'الفتوى', 'دعوى', 'الدعوى', 'تقوى', 'التقوى', 'هدى', 'الهدى', 'رأى', 'سعى', 'بقى', 'مضى', 'جرى', 'أتى', 'رمى', 'بنى', 'نفى', 'قضى', 'أبى', 'ألقى', 'تلقى', 'يرى', 'نرى', 'ترى', 'أرى', 'يبقى', 'يسعى', 'تسعى', 'نسعى', 'يتبنى', 'يحظى', 'تحظى', 'يلقى', 'يتلقى', 'ملقى', 'الموسيقى', 'موسيقى', 'الفوضى', 'فوضى', 'ذكرى', 'الذكرى', 'بشرى', 'دنيا', 'الدنيا', 'قصوى', 'القصوى', 'شتى', 'أنثى', 'الأنثى', 'منتهى', 'مقتضى', 'بمقتضى', 'مدى', 'المدى', 'صدى', 'الصدى', 'لدى', 'أقصى', 'الأقصى', 'أسمى', 'الأسمى', 'أبقى', 'أحرى', 'أولى', 'أدى', 'أعطى', 'سمى', 'تبنى', 'تجلى', 'يتجلى', 'تخلى', 'يتخلى', 'تعدى', 'يتعدى', 'تبقى', 'نبقى', 'ارتقى', 'يرتقى', 'التقى', 'انتهى', 'اقتضى', 'استثنى', 'تمنى', 'يتمنى', 'تلقى', 'تولى', 'يتولى', 'تسنى', 'يتسنى', 'تحرى', 'أحيا', 'مرمى', 'المرمى', 'منحى', 'المنحى', 'ملتقى', 'الملتقى', 'منتدى', 'المنتدى', 'مسعى', 'المسعى', 'مغزى', 'المغزى', 'مقهى', 'مجرى', 'المجرى', 'مأوى', 'المأوى', 'مرعى', 'جدوى', 'الجدوى', 'شكوى', 'الشكوى', 'نجوى', 'رؤيا']);

  const RULES = [
    { id: 'title-ad', no: 31, name: 'اللقب العلمي', why: 'يُكتب اللقب العلمي بمسافة بعد كل نقطة: أ. د.، أ. م. د.',
      find: text => {
        const out = [];
        for (const m of text.matchAll(re('(?<![{LH}])[وف]?أ\\.([ \\u00A0]*)(?:م\\.([ \\u00A0]*))?د\\.'))) {
          const group = [];
          let pos = m.index + m[0].indexOf('.') + 1;
          for (const ws of [m[1], m[2]]) {
            if (ws === undefined) continue;
            if (ws !== ' ') group.push({ start: pos, end: pos + ws.length, repl: ' ' });
            pos += ws.length + 2;
          }
          if (group.length) out.push({ group });
        }
        return out;
      } },
    { id: 'sp-before', no: 7, name: 'مسافة قبل علامة الترقيم', why: 'علامة الترقيم تلتصق بالكلمة التي قبلها.',
      find: simple(/(?<![A-Za-z\/—–_=])[ \u00A0]+(?=[،؛:!؟.,;])(?!\.\.)/g, () => '') }, // not after Latin text, URLs or ——— in bibliographies: proofreaders leave those
    { id: 'sp-after', no: 7, name: 'مسافة بعد علامة الترقيم', why: 'تُفصل علامة الترقيم بمسافة واحدة عن الكلمة التي تليها.',
      find: text => [
        ...simple(re('[،؛؟!:](?=[{L}«“(])'), m => m[0] + ' ')(text),
        ...simple(re('(?<=[{L}]{2}[{H}]*)\\.(?=[{L}])'), m => '. ')(text)
      ] },
    { id: 'semicolon', no: 7, name: 'الفاصلة المنقوطة', why: 'تُكتب الفاصلة المنقوطة العربية (؛) في النص العربي، وتسبق التعليل بـ(لأنّ).',
      find: text => [
        ...simple(re('(?<=[{LH}\\)"»\u00A0 ]);'), () => '؛')(text),
        ...simple(re('[،,](?=[ \u00A0]+لأن[\\u0651\\u064E]*(?:ه|ها|هم|هما|هن|نا|ني|ك|كم)?(?![{LH}]))'), () => '؛')(text)
      ] },
    { id: 'br-inner', no: 10, name: 'مسافة داخل الأقواس أو علامات التنصيص', why: 'تُلصق الأقواس وعلامات التنصيص بالنص من الطرفين دون مسافة.',
      find: (text, ctx) => {
        const out = [
          ...simple(/(?<=[(«“])[ \u00A0]+/g, () => '')(text),
          ...simple(/[ \u00A0]+(?=[)»”])/g, () => '')(text)
        ];
        for (const [a, b] of ctx.straightPairs) {
          let i = a + 1; while (text[i] === ' ' || text[i] === '\u00A0') i++;
          if (i > a + 1 && i < b) out.push({ start: a + 1, end: i, repl: '' });
          let j = b; while (j - 1 > a && (text[j - 1] === ' ' || text[j - 1] === '\u00A0')) j--;
          if (j < b && j > i) out.push({ start: j, end: b, repl: '' });
        }
        return out;
      } },
    { id: 'dash-pair', no: 8, name: 'الشرطتان حول الجملة المعترضة', why: 'الشرطتان تلتصقان بالجملة المعترضة من الطرفين.',
      find: text => {
        const out = [], rx = /(?<=\s)-([ \u00A0]+)([^\-\n]{2,80}?)([ \u00A0]+)-(?=\s)/g;
        // a list such as keywords, not a parenthetical (a dash between two numbers, 1950 - 1970, does not count)
        if ((text.match(re('(?<![{D}])\\s[-–]\\s(?![{D}])')) || []).length >= 3) return out;
        let m;
        while ((m = rx.exec(text))) {
          const a = m.index + 1, b = a + m[1].length + m[2].length;
          out.push({ group: [{ start: a, end: a + m[1].length, repl: '' }, { start: b, end: b + m[3].length, repl: '' }] });
        }
        return out;
      } },
    { id: 'dash-num', no: 8, name: 'الشرطة بين رقمين', why: 'لا مسافة قبل الشرطة ولا بعدها بين رقمين.',
      find: simple(re('(?<=[{D}])[ \\u00A0]*([-–])[ \\u00A0]*(?=[{D}])'), m => m[1]) },
    { id: 'slash', no: 9, name: 'الشرطة المائلة', why: 'تلتصق الشرطة المائلة بالكلمة الأولى، وتُفصل بمسافة عن الثانية.',
      find: simple(re('(?<=[{L}][{H}]*)[ \\u00A0]*/[ \\u00A0]*(?=[{L}])'), () => '/ ') },
    { id: 'sp-double', no: 7, name: 'مسافات زائدة', why: 'مسافة واحدة بين الكلمات.',
      find: simple(/(?<=\S)[ \u00A0]{2,}(?=\S)/g, () => ' ') },
    { id: 'dot-out', no: 14, name: 'النقطة خارج القوس', why: 'توضع النقطة بعد القوس أو علامة التنصيص الختامية، لا قبلها.',
      find: (text, ctx) => {
        const out = [];
        const closers = new Set(ctx.straightPairs.map(p => p[1]));
        for (let i = 0; i < text.length - 1; i++) {
          if (text[i] !== '.' || text[i - 1] === '.') continue;
          const c = text[i + 1];
          if (/[A-Za-z]/.test(text[i - 1] || '') || /[A-Za-z]/.test(text.slice(Math.max(0, i - 3), i))) continue;   // English citation style keeps ." inside
          if (c === ')' || c === '»' || c === '”' || (c === '"' && closers.has(i + 1))) {
            out.push({ start: i, end: i + 1, repl: '' }, { start: i + 2, end: i + 2, repl: '.' });
          }
        }
        return out.length ? [{ group: out }] : [];
      } },
    { id: 'aw-quote', no: 18, name: 'عبارة "أو (...)"', why: 'لا تُوضع علامات التنصيص حول عبارة مثل أو (متحدة).',
      find: simple(/"(أو \([^)"]{1,60}\))"/g, m => m[1]) },
    { id: 'year-paren', no: 19, name: 'العام بين قوسين', why: 'لا توضع أرقام الأعوام بين قوسين إلا مع التاريخين الميلادي والهجري أو المدة.',
      find: simple(re('(?<=(?:عام|سنة)\\s)\\(([{D}]{3,4}\\s?[مه]?)\\)'), m => m[1]) },
    { id: 'ma-la', no: 22, name: 'فصل (ما) و(لا)', word: true, why: 'تُكتب (ما زال، ما دام، لا بد، لا زال، لا سيما) مفصولة.',
      find: text => [
        ...simple(re('(?<![{LH}])([وف]?)ما(زال|زالت|زلت|زالوا|زلنا|زالا|دام|دامت|داموا)(?![{L}])'), m => m[1] + 'ما ' + m[2])(text),
        ...simple(re('(?<![{LH}])([وف]?)لا(بد|زال|زالت|سيما)(?![{L}])'), m => m[1] + 'لا ' + m[2])(text)
      ] },
    { id: 'ma-shadda', no: 26, name: '(ما) بعد النكرة', word: true, why: 'تُكتب (ما) بعد النكرة دون شدة: شخصاً ما.',
      find: simple(re('(?<=\\s)م[\\u064E]?\\u0651[\\u064E]?ا(?![{LH}])'), () => 'ما') },
    { id: 'sun-shadda', no: 5, name: 'شدة الحرف الشمسي', word: true, why: 'لا توضع الشدة على الحرف الشمسي بعد (أل) التعريف.',
      find: text => {
        const out = [];
        const rx = re('(?<![{LH}])(?:[وف]?[بكل]?ال|[وف]?لل)([تثدذرزسشصضطظلن])([{H}]*)', 'g');
        let m;
        while ((m = rx.exec(text))) {
          if (m[1] === 'ل' && /^[\u064B-\u065F]*ه/.test(text.slice(m.index + m[0].length - m[2].length))) continue; // اللّه
          const k = m[2].indexOf('\u0651');
          if (k < 0) continue;
          const pos = m.index + m[0].length - m[2].length + k;
          out.push({ start: pos, end: pos + 1, repl: '' });
        }
        return out;
      } },
    { id: 'nisba-shadda', no: 5, name: 'شدة ياء النسبة', word: true, why: 'لا توضع الشدة على ياء النسبة: عراقي، مصري، إسلامي.',
      find: text => {
        const out = [];
        const rx = re('(?<![{LH}])[{LH}]+(?![{LH}])', 'g');
        let m;
        while ((m = rx.exec(text))) {
          const w = m[0];
          const mm = w.match(/ي([\u064B-\u0650\u0652]*)\u0651([\u064B-\u0650\u0652]*)(ة[\u064B-\u0652]*|ا\u064B?)?$/);
          if (!mm) continue;
          const bare = w.replace(/[\u064B-\u065F\u0670]/g, '');
          const core = bare.replace(/[ةا]$/, '').replace(/^[وف]?[بكل]?ال/, '').replace(/^[وف]?لل/, '');
          const stem = core.slice(0, -1);
          if (stem.length < 3 || NISBA_EXCEPT.has(core)) continue;
          const pos = m.index + w.length - (mm[0].length) + 1 + mm[1].length;
          out.push({ start: pos, end: pos + 1, repl: '' });
        }
        return out;
      } },
    { id: 'tanween', no: 6, name: 'موضع تنوين الفتح', word: true, why: 'تنوين الفتح يُكتب على الألف (كتاباً)، وفي المقصورة على الحرف الذي قبلها (معنًى).',
      find: text => [
        ...simple(re('\\u064Bا(?![{LH}])'), () => 'ا\u064B')(text),
        ...simple(re('ى\\u064B(?![{LH}])'), () => '\u064Bى')(text)
      ] },
    { id: 'months', no: 21, name: 'أسماء الأشهر', word: true, translatedOff: true, why: 'يُذكر الاسم العربي الشائع متبوعاً بالاسم الغربي، مثل: تموز/ يوليو.',
      find: text => {
        const out = [];
        const greg = new Map(LEVANT.map(([a, b]) => [b, a]));
        Object.entries(GREG_ALIASES).forEach(([k, v]) => greg.set(k, greg.get(v)));
        const lev = new Map(LEVANT);
        const names = [...lev.keys(), ...greg.keys()].sort((a, b) => b.length - a.length).map(s => s.replace(/ /g, '\\s+'));
        const rx = re('(?<![{LH}])(' + names.join('|') + ')(?![{LH}])', 'g');
        let m;
        while ((m = rx.exec(text))) {
          const s = m.index, e = s + m[0].length, name = m[1].replace(/\s+/g, ' ');
          const before = text.slice(Math.max(0, s - 6), s), after = text.slice(e, e + 8);
          if (!(re('[{D}]\\s+$', '').test(before) || re('^\\s+[{D}]{3,4}', '').test(after))) continue;   // needs a date around it
          if (/\/\s*$/.test(before) || /^\s*\//.test(after)) continue;          // already paired
          if (lev.has(name)) out.push({ start: e, end: e, repl: '/ ' + lev.get(name) });
          else out.push({ start: s, end: s, repl: greg.get(name) + '/ ' });
        }
        return out;
      } },
    { id: 'tatweel', no: 24, name: 'الـ والباء والفاء مع الأجنبي والأقواس', why: 'تُكتب (الـ) و(بـ) و(فـ) بالمدّة للدلالة على الاتصال.',
      find: text => [
        ...simple(re('(?<![{LH}])(ال|وال|فال|بال|ب|ف|ك|ل)(?:ـ?[ \\u00A0]+|ـ(?![ \\u00A0])|(?=[A-Za-z]))(?=[A-Za-z])'), m => m[1] + 'ـ ')(text),
        ...simple(re('(?<![{LH}])([فبلك])(?=[(«“])'), m => m[1] + 'ـ')(text)
      ] },
    { id: 'page', no: 29, name: 'كتابة رقم الصفحة', why: 'يُكتب حرف (ص) ملاصقاً للرقم: ص22.',
      find: simple(re('(?<![{LH}(])صص?(?:[ \\u00A0]*[.:][ \\u00A0]*|[ \\u00A0]+)(?=[{D}])'), () => 'ص') },
    { id: 'abbr', no: 29, name: 'الاختصارات في الهوامش', scope: 'notes', why: 'تُكتب الاختصارات ملاصقة للرقم: ط1، ع102، مج2.',
      find: simple(re('(?<![{LH}(])(ط|ع|مج)(?:[ \\u00A0]*[.:][ \\u00A0]*|[ \\u00A0]+)(?=[{D}])'), m => m[1]) },
    { id: 'ibid', no: 29, name: '(المصدر نفسه) و(مصدر سابق)', scope: 'notes', why: 'تُكتب (المصدر نفسه) للمصدر المكرر مباشرة، و(مصدر سابق) لمصدر ورد قبل عدة هوامش، ثم فاصلة ورقم الصفحة.',
      find: text => [
        ...simple(/نفس المصدر|نفس المرجع|المرجع نفسه|(?<![\u0621-\u064A])م(?:[ \u00A0]*\.[ \u00A0]*|[ \u00A0]+)ن(?![\u0621-\u064A])\.?/g, () => 'المصدر نفسه')(text),
        ...simple(/(?<![\u0621-\u064A])(?:مرجع سابق|المرجع السابق|المصدر السابق)(?![\u0621-\u064A])/g, () => 'مصدر سابق')(text),
        ...simple(/(?<=المصدر نفسه|نفس المصدر|المرجع نفسه|مصدر سابق|مرجع سابق)[ \u00A0]*[,،]?[ \u00A0]*(?=ص\s*[0-9\u0660-\u0669\u06F0-\u06F9])/g, () => '، ')(text)
      ] },
    { id: 'fn-space', no: 29, name: 'موضع رقم الهامش', why: 'يلتصق رقم الهامش بالكلمة التي قبله دون مسافة، ويأتي قبل النقطة.',
      find: text => {
        const out = simple(new RegExp('[ \\u00A0]+(?=' + FN + ')', 'g'), () => '')(text);
        const rx = new RegExp('\\.(' + FN + '+)', 'g');
        let m;
        while ((m = rx.exec(text))) out.push({ group: [{ start: m.index, end: m.index + 1, repl: '' }, { start: m.index + m[0].length, end: m.index + m[0].length, repl: '.' }] });
        return out;
      } },
    { id: 'ya-dots', no: 0, label: 'الياء المنقوطة', name: 'الياء في آخر الكلمة', word: true, why: 'تُكتب الياء منقوطة (في، التي، الأخلاقي)، ولا تُكتب ألفاً مقصورة إلا في الكلمات التي آخرها ألف.',
      find: (text, ctx) => {
        const out = [];
        const rx = re('(?<![{LH}])([وفبلك]?)([{L}]+ى)(?![{LH}])', 'g');
        let m;
        while ((m = rx.exec(text))) {
          const w = m[2], s = m.index + m[1].length;
          let fix = YA_FIXED.get(w);
          if (!fix && ctx.lexicon && w.length >= 5 && !YA_STOP.has(w)) {
            const alt = w.slice(0, -1) + 'ي';
            if ((ctx.lexicon.get(alt) || 0) >= 2 && (ctx.lexicon.get(alt) || 0) >= (ctx.lexicon.get(w) || 0)) fix = alt;
          }
          if (fix) out.push({ start: s, end: s + w.length, repl: fix });
        }
        return out;
      } },
    { id: 'inna', no: 0, label: 'قاعدة نحوية', name: 'كسر همزة (إنّ) بعد القول وحيث وإذ', word: true, why: 'تُكسر همزة (إنّ) بعد القول ومشتقاته، وبعد (حيث) و(إذ): حيث إنّ، إذ إنّ، يمكن القول إنّ.',
      find: simple(re('(?<![{LH}])((?:حيث|إذ|القول|يقال|قيل|قال|قالت|قالوا|يقول|تقول|نقول|أقول|يقولون)[ \u00A0]+)أن(?:\u0651)?(ه|ها|هم|هما|هن|نا|ني|ك|كم)?(?![{LH}])'),
        m => m[1] + 'إنّ' + (m[2] || '')) },
    { id: 'shadda-common', no: 4, name: 'الشدة في الأدوات الشائعة', word: true, why: 'توضع الشدة في الأدوات التي يلتبس معناها دونها: أنّ، إنّ، لكنّ، كلّ، إلّا، ممّا، ثمّ، أمّا.',
      find: text => {
        const out = [];
        const add = (rx, posOf) => { rx.lastIndex = 0; let m; while ((m = rx.exec(text))) { const p = posOf(m); out.push({ start: p, end: p, repl: '\u0651' }); } };
        // أنّ/إنّ/لكنّ/كأنّ + attached pronoun
        add(re('(?<![{LH}])([وفلب]?(?:أن|إن|لكن|كأن))(?=(?:ه|ها|هم|هما|هن|ك|كم|كما|ني|نا)(?![{LH}]))', 'g'), m => m.index + m[0].length);
        // أنّ/إنّ/لكنّ/كأنّ before a definite noun
        add(re('(?<![{LH}])([وفلب]?(?:أن|إن|لكن|كأن))(?=[ \u00A0]+ال)', 'g'), m => m.index + m[0].length);
        // كلّ (with prefixes and pronouns)
        add(re('(?<![{LH}])([وفبلك]?كل)(?=(?:ه|ها|هم|هما|نا|كم)?(?![{LH}]))', 'g'), m => m.index + m[0].length);
        // إلّا
        add(re('(?<![{LH}])([وف]?إل)(?=ا(?![{LH}]))', 'g'), m => m.index + m[0].length);
        // ممّا، عمّا، أمّا، إمّا، ثمّ
        add(re('(?<![{LH}])([وف]?(?:مم|عم|أم|إم))(?=ا(?![{LH}]))', 'g'), m => m.index + m[0].length);
        add(re('(?<![{LH}])([وف]?ثم)(?![{LH}])', 'g'), m => m.index + m[0].length);
        return out;
      } },
    { id: 'quote-type', no: 13, name: 'الأقواس أو علامات التنصيص', why: 'الكلمة المفردة والعبارة القصيرة (حتى أربع كلمات) توضعان بين قوسين ( )، والاقتباس والعبارة الطويلة بين علامتي التنصيص " " (القاعدتان 10 و13).',
      find: (text, ctx) => {
        const out = [];
        const pairs = ctx.straightPairs.map(p => [...p, '"']);
        for (const [o, c] of [['“', '”'], ['«', '»']]) {
          const st = [];
          for (let i = 0; i < text.length; i++) { if (text[i] === o) st.push(i); else if (text[i] === c && st.length) pairs.push([st.pop(), i, o]); }
        }
        for (const [a, b, kind] of pairs) {
          const inner = text.slice(a + 1, b).trim();
          if (!re('[{L}]').test(inner) || /[A-Za-z]{3,}/.test(inner.replace(re('[{LH}\\s]', 'g'), '').slice(0, 1) + inner.slice(0, 3))) continue;
          if (inner.includes(FN) || inner.includes(OB) || /^[(«]/.test(inner)) continue;
          const words = inner.split(/\s+/).length;
          const [op, cl] = words <= 4 ? ['(', ')'] : ['"', '"'];
          if (kind === '"' && op === '"') continue;
          out.push({ group: [{ start: a, end: a + 1, repl: op }, { start: b, end: b + 1, repl: cl }] });
        }
        return out;
      } },
    { id: 'words', no: 0, name: 'الكلمات المعتمدة في المركز', word: true, why: 'قائمة طرق كتابة بعض الكلمات في إصدارات المركز.',
      find: text => {
        const out = [];
        for (const [bad, good] of WORDS) out.push(...simple(re('(?<![{LH}])([وفبكل]?(?:ال)?)' + bad), m => m[1] + good)(text));
        out.push(...simple(re('(?<![{LH}])([وفبكل]?(?:ال)?)رئيسي(ة?)(?![{LH}])'), m => m[1] + 'رئيس' + m[2])(text));
        out.push(...simple(re('ق\\.م\\.(?=\\s+[{L}])'), () => 'ق.م')(text));
        return out;
      } }
  ];

  const CAT = { punct: ['sp-before', 'sp-after', 'br-inner', 'dash-pair', 'dash-num', 'slash', 'sp-double', 'semicolon', 'dot-out', 'aw-quote', 'fn-space'],
    spell: ['sun-shadda', 'nisba-shadda', 'tanween', 'ma-la', 'ma-shadda', 'tatweel', 'words', 'ya-dots', 'inna', 'shadda-common'],
    conv: ['year-paren', 'months', 'page', 'abbr', 'ibid', 'quote-type', 'title-ad'] };
  for (const [c, ids] of Object.entries(CAT)) ids.forEach(id => { const r = RULES.find(x => x.id === id); if (r) r.cat = c; });

  // ---------------------------------------------------------------- helpers
  const kids = n => { const a = []; for (let c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) a.push(c); return a; };
  const isW = (n, name) => n.namespaceURI === W && n.localName === name;
  const ZERO_WIDTH = new Set(['pPr', 'bookmarkStart', 'bookmarkEnd', 'proofErr', 'commentRangeStart', 'commentRangeEnd', 'permStart', 'permEnd']);

  function classifyRun(r) {
    let text = '', ok = true, note = false;
    for (const c of kids(r)) {
      if (c.namespaceURI !== W) { ok = false; continue; }
      if (c.localName === 'rPr' || c.localName === 'lastRenderedPageBreak') continue;
      if (c.localName === 't') { text += c.textContent; continue; }
      if (c.localName === 'footnoteReference' || c.localName === 'endnoteReference') note = true;
      ok = false;
    }
    if (ok) return { kind: 'text', text };
    return { kind: 'opaque', text: note ? FN : OB };
  }

  function minimalEdit(text, e) {
    const a = text.slice(e.start, e.end), b = e.repl;
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    return { start: e.start + p, end: e.end - s, repl: b.slice(p, b.length - s) };
  }

  function pairRanges(text) {
    const straight = [];
    let open = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === '"') { if (open < 0) open = i; else { straight.push([open, i]); open = -1; } }
    const ranges = straight.map(p => [p[0], p[1]]);
    const unbalanced = [];
    if (open >= 0) unbalanced.push('"');
    const pairs = [['«', '»'], ['“', '”'], ['(', ')'], ['[', ']']];
    const quran = [];
    for (const [o, c] of pairs) {
      const st = [];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === o) st.push(i);
        else if (text[i] === c) { if (st.length) { const a = st.pop(); if (o !== '(' && o !== '[') ranges.push([a, i]); } else unbalanced.push(c); }
      }
      if (st.length) unbalanced.push(o);
    }
    // Quran ornate brackets: either orientation, paired in order
    let q = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === '\uFD3F' || text[i] === '\uFD3E') { if (q < 0) q = i; else { quran.push([q, i]); q = -1; } }
    if (q >= 0) unbalanced.push('﴿');
    return { straight, quotes: ranges, quran, unbalanced };
  }

  const overlaps = (s, e, ranges) => ranges.some(([a, b]) => (e > s ? s <= b && e - 1 >= a : s > a && s <= b));

  // ---------------------------------------------------------------- paragraph processing
  function readParagraph(p) {
    if (p.getElementsByTagNameNS(W, 'ins').length || p.getElementsByTagNameNS(W, 'del').length ||
        p.getElementsByTagNameNS(W, 'moveFrom').length || p.getElementsByTagNameNS(W, 'moveTo').length) return null;
    const segs = [];
    let text = '';
    for (const c of kids(p)) {
      if (c.namespaceURI === W && ZERO_WIDTH.has(c.localName)) { segs.push({ node: c, kind: 'opaque', start: text.length, text: '' }); continue; }
      const k = isW(c, 'r') ? classifyRun(c) : { kind: 'opaque', text: OB };
      segs.push({ node: c, kind: k.kind, start: text.length, text: k.text });
      text += k.text;
    }
    if (!/[\u0600-\u06FF]/.test(text)) return null;
    return { segs, text };
  }

  // Find rule groups in one paragraph's text. Each group: { rule, edits:[{start,end,repl,rule}], lo, hi, before, after }
  function findGroups(text, ctx) {
    const pr = pairRanges(text);
    const warnings = [];
    if (pr.unbalanced.length) warnings.push({ where: ctx.where, kind: 'unbalanced', marks: [...new Set(pr.unbalanced)].join(' '), snippet: snippet(text, 0, 0) });
    const rctx = { straightPairs: pr.straight, lexicon: ctx.lexicon };
    const accepted = [], groups = [];
    const busy = (s, e) => accepted.some(a => (e > s ? s < a.end && e > a.start : false) || (e === s && a.start === s && a.end === s) || (e === s && s > a.start && s < a.end) || (e > s && a.end === a.start && a.start > s && a.start < e));
    for (const rule of RULES) {
      if (rule.scope === 'notes' && !ctx.inNotes) continue;
      if (rule.translatedOff && ctx.opts.translated) continue;
      if (rule.optional && !ctx.opts[rule.optional]) continue;
      let found;
      try { found = rule.find(text, rctx); } catch (err) { continue; }
      for (const f of found) {
        const group = (f.group || [f]).map(e => minimalEdit(text, e)).filter(e => e.end > e.start || e.repl);
        if (!group.length) continue;
        let ok = true;
        for (const e of group) {
          const del = text.slice(e.start, e.end);
          if (del.includes(OB) || del.includes(FN)) ok = false;
          if (overlaps(e.start, e.end, pr.quran)) ok = false;
          if (rule.word && overlaps(e.start, e.end, pr.quotes)) ok = false;
          if (busy(e.start, e.end)) ok = false;
        }
        if (!ok) continue;
        const ruleTag = { id: rule.id, no: rule.no, label: rule.label, name: rule.name, why: rule.why, cat: rule.cat };
        group.forEach(e => accepted.push(Object.assign(e, { rule: ruleTag })));
        const lo = Math.min(...group.map(e => e.start)), hi = Math.max(...group.map(e => e.end));
        const after = applyEdits(text, group);
        groups.push({ rule: ruleTag, edits: group, lo, hi,
          before: snippet(text, lo, hi), after: snippet(after, lo, hi + group.reduce((n, e) => n + e.repl.length - (e.end - e.start), 0)) });
      }
    }
    return { groups, warnings, quran: pr.quran };
  }

  function processParagraph(p, ctx) {
    const rp = readParagraph(p);
    if (!rp) return;
    const { groups, warnings } = findGroups(rp.text, ctx);
    ctx.warnings.push(...warnings);
    groups.forEach(g => ctx.changes.push({ where: ctx.where, rule: g.rule, before: g.before, after: g.after }));
    const edits = groups.flatMap(g => g.edits);
    if (edits.length) rebuild(p, rp.segs, rp.text, edits, ctx);
  }

  // Character diff (trimmed common prefix/suffix, then LCS on the middle) -> edits on `a`
  function diffEdits(a, b, rule) {
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
    if (!A.length && !B.length) return [];
    if (A.length * B.length > 4e6) return [{ start: p, end: p + A.length, repl: B, rule }];
    const n = A.length, m = B.length, D = new Uint16Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      D[i * (m + 1) + j] = A[i] === B[j] ? D[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(D[(i + 1) * (m + 1) + j], D[i * (m + 1) + j + 1]);
    const out = []; let i = 0, j = 0, cur = null;
    const flush = () => { if (cur) { out.push(cur); cur = null; } };
    while (i < n || j < m) {
      if (i < n && j < m && A[i] === B[j]) { flush(); i++; j++; }
      else if (j < m && (i === n || D[i * (m + 1) + j + 1] >= D[(i + 1) * (m + 1) + j])) { if (!cur) cur = { start: p + i, end: p + i, repl: '', rule }; cur.repl += B[j]; j++; }
      else { if (!cur) cur = { start: p + i, end: p + i, repl: '', rule }; cur.end = p + i + 1; i++; }
    }
    flush();
    return out;
  }

  const PARTS = [['word/document.xml', 'المتن', false], ['word/footnotes.xml', 'الهوامش', true], ['word/endnotes.xml', 'الحواشي الختامية', true]];
  // Walk every proofreadable paragraph of a docx in a stable order; fn(p, key, where, inNotes)
  async function walk(zip, xml, fn) {
    const docs = [];
    for (const [path, where, inNotes] of PARTS) {
      const f = zip.file(path);
      if (!f) continue;
      const doc = xml.parse(await f.async('string'));
      docs.push([path, doc]);
      const ps = Array.from(doc.getElementsByTagNameNS(W, 'p'));
      let k = 0;
      for (const p of ps) {
        let anc = p.parentNode, skip = false;
        while (anc && anc.nodeType === 1) { if (isW(anc, 'ins') || isW(anc, 'del') || (anc.getAttributeNS && /separator|continuation/i.test(anc.getAttributeNS(W, 'type') || ''))) skip = true; anc = anc.parentNode; }
        if (skip) continue;
        fn(p, path + '#' + (k++), where, inNotes);
      }
    }
    return docs;
  }

  // Read a docx for the editor: every Arabic paragraph with its rule groups
  async function loadDocx(JSZip, buf, opts, xml) {
    const zip = await JSZip.loadAsync(buf);
    const raw = [];
    await walk(zip, xml, (p, key, where, inNotes) => {
      const rp = readParagraph(p);
      if (rp) raw.push({ key, where, inNotes, text: rp.text });
    });
    const lexicon = buildLexicon(raw.map(r => r.text));
    const paras = raw.map(r => {
      const g = findGroups(r.text, { opts, where: r.where, inNotes: r.inNotes, lexicon });
      return Object.assign(r, { groups: g.groups, warnings: g.warnings, quran: g.quran });
    });
    return { paras, lexicon };
  }

  // Word counts for the whole document (harakat removed), used by rules that look for the document's own spelling
  function buildLexicon(texts) {
    const lex = new Map();
    for (const t of texts) for (const w of t.replace(/[\u064B-\u065F\u0670\u0640]/g, '').split(/[^\u0621-\u064A]+/)) if (w) lex.set(w, (lex.get(w) || 0) + 1);
    return lex;
  }

  // Write the editor's decisions back: decide(key, text) -> edits on the original text (or null for none)
  async function exportDocx(JSZip, buf, decide, opts, xml) {
    const zip = await JSZip.loadAsync(buf);
    const ctx = { opts, nextId: 880000, date: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
    const docs = await walk(zip, xml, (p, key) => {
      const rp = readParagraph(p);
      if (!rp) return;
      const edits = decide(key, rp.text);
      if (edits && edits.length) rebuild(p, rp.segs, rp.text, edits, ctx);
    });
    for (const [path, doc] of docs) zip.file(path, xml.serialize(doc));
    return zip.generateAsync({ type: opts.outType || 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function applyEdits(text, edits) {
    let out = text;
    [...edits].sort((a, b) => b.start - a.start || b.end - a.end).forEach(e => { out = out.slice(0, e.start) + e.repl + out.slice(e.end); });
    return out;
  }
  function snippet(text, lo, hi) {
    const a = Math.max(0, lo - 28), b = Math.min(text.length, hi + 28);
    return { pre: (a > 0 ? '…' : '') + text.slice(a, lo), mid: text.slice(lo, hi), post: text.slice(hi, b) + (b < text.length ? '…' : '') };
  }

  // ---------------------------------------------------------------- XML rebuild
  function rebuild(p, segs, text, edits, ctx) {
    const doc = p.ownerDocument;
    const delAt = new Array(text.length).fill(null);
    const insAt = new Map();
    for (const e of edits) {
      for (let i = e.start; i < e.end; i++) delAt[i] = e.rule;
      if (e.repl) { if (!insAt.has(e.start)) insAt.set(e.start, []); insAt.get(e.start).push(e); }
    }
    const textSegs = segs.filter(s => s.kind === 'text' && s.text.length);
    // who emits each insertion: the text run containing the position, else the text run ending there, else standalone
    const owner = new Map();
    for (const pos of insAt.keys()) {
      let o = textSegs.find(s => s.start <= pos && pos < s.start + s.text.length);
      if (!o) o = [...textSegs].reverse().find(s => s.start + s.text.length === pos);
      owner.set(pos, o || null);
    }
    const el = name => doc.createElementNS(W, 'w:' + name);
    const mark = (kind, rule) => {
      const m = el(kind);
      m.setAttributeNS(W, 'w:id', String(ctx.nextId++));
      m.setAttributeNS(W, 'w:author', rule.author || ((rule.no ? 'قاعدة ' + rule.no : rule.label || 'قائمة الكلمات') + ': ' + rule.name));
      m.setAttributeNS(W, 'w:date', ctx.date);
      return m;
    };
    const run = (rPr, str, tag) => {
      const r = el('r');
      if (rPr) r.appendChild(rPr.cloneNode(true));
      const t = el(tag);
      t.setAttributeNS(XMLNS, 'xml:space', 'preserve');
      t.appendChild(doc.createTextNode(str));
      r.appendChild(t);
      return r;
    };
    const insNodes = (rPr, list) => list.map(e => {
      if (ctx.opts.clean) return run(rPr, e.repl, 't');
      const m = mark('ins', e.rule); m.appendChild(run(rPr, e.repl, 't')); return m;
    });
    const rPrOf = seg => seg && kids(seg.node).find(c => isW(c, 'rPr'));
    let prevText = null;
    for (const seg of segs) {
      if (seg.kind !== 'text' || !seg.text.length) {
        if (seg.text.length && insAt.has(seg.start) && owner.get(seg.start) === null) {
          insNodes(rPrOf(prevText), insAt.get(seg.start)).forEach(n => p.insertBefore(n, seg.node));
          owner.delete(seg.start);
        }
        continue;
      }
      prevText = seg;
      const rPr = rPrOf(seg);
      const nodes = [];
      const end = seg.start + seg.text.length;
      const mine = pos => insAt.has(pos) && owner.get(pos) === seg;
      let i = seg.start;
      while (i < end) {
        if (mine(i)) nodes.push(...insNodes(rPr, insAt.get(i)));
        const rule = delAt[i];
        let j = i + 1;
        while (j < end && delAt[j] === rule && !mine(j)) j++;
        const str = text.slice(i, j);
        if (rule === null) nodes.push(run(rPr, str, 't'));
        else if (!ctx.opts.clean) { const m = mark('del', rule); m.appendChild(run(rPr, str, 'delText')); nodes.push(m); }
        i = j;
      }
      if (mine(end)) nodes.push(...insNodes(rPr, insAt.get(end)));
      nodes.forEach(n => p.insertBefore(n, seg.node));
      p.removeChild(seg.node);
    }
    const tail = text.length;
    if (insAt.has(tail) && owner.get(tail) === null) insNodes(rPrOf(prevText), insAt.get(tail)).forEach(n => p.appendChild(n));
  }

  // ---------------------------------------------------------------- docx entry
  async function processDocx(JSZip, buf, opts, xml) {
    const zip = await JSZip.loadAsync(buf);
    const ctx = { opts, changes: [], warnings: [], nextId: 880000, date: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
    const parts = [['word/document.xml', 'المتن', false], ['word/footnotes.xml', 'الهوامش', true], ['word/endnotes.xml', 'الحواشي الختامية', true]];
    let paragraphs = 0;
    for (const [path, where, inNotes] of parts) {
      const f = zip.file(path);
      if (!f) continue;
      const doc = xml.parse(await f.async('string'));
      ctx.where = where; ctx.inNotes = inNotes;
      const ps = Array.from(doc.getElementsByTagNameNS(W, 'p'));
      for (const p of ps) {
        // skip separator footnotes and paragraphs nested inside revisions
        let anc = p.parentNode, skip = false;
        while (anc && anc.nodeType === 1) { if (isW(anc, 'ins') || isW(anc, 'del') || (anc.getAttributeNS && /separator|continuation/i.test(anc.getAttributeNS(W, 'type') || ''))) skip = true; anc = anc.parentNode; }
        if (skip) continue;
        paragraphs++;
        processParagraph(p, ctx);
      }
      zip.file(path, xml.serialize(doc));
    }
    const out = await zip.generateAsync({ type: opts.outType || 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return { data: out, changes: ctx.changes, warnings: ctx.warnings, paragraphs };
  }

  const api = { processDocx, loadDocx, exportDocx, findGroups, buildLexicon, diffEdits, applyEdits, RULES, FN, OB, _processParagraph: processParagraph };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TajdidEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
