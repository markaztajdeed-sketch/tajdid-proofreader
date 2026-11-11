// قاموس مركز تجديد: كيف يكتب المركز كلمات وأسماء ومصطلحات بعينها. تقرؤه شاشة «القاموس»، ويقرؤه المحرك:
// الكلمات المعتمدة والأعلام يصحّحها آلياً، والاستثناءات لا يلمسها، والمصطلحات للعرض فقط.
// إلى أن تجهز الحسابات، يُعدَّل هذا الملف بطلب من مسؤول الدليل، فيصل التعديل إلى كل المدققين مع تحديث الأداة.
//
// words: good (تُكتب)، bad (لا تُكتب)، from/to (جذع الكلمة الخاطئ وصوابه؛ يصحّحه المحرك مع (ال) وحروف العطف والجر
//        ولواحق الكلمة)، special (يصحّحه المحرك بقاعدة خاصة به)، src، added (تاريخ الإضافة).
// names: name (الصيغة المعتمدة)، variants (صيغ تُصحَّح إليها، كلمة كاملة)، note، src، added.
// terms: term، def (تعريف قصير)، src، added.
// exceptions: word (كلمة كاملة لا يقترح المحرك فيها أي تصحيح)، note، src، added.
(function (root) {
  'use strict';
  const GUIDE = 'الدليل', CORPUS = 'تحليل المقالات', SAMPLE = 'مثال مؤقت';
  const words = [
    { good: 'إفريقيا', bad: 'أفريقيا', from: 'أفريقي', to: 'إفريقي', src: GUIDE, added: '2026-11-02' },
    { good: 'رئيس، رئيسة', bad: 'رئيسي، رئيسية', special: true, src: GUIDE, added: '2026-11-02' },
    { good: 'أيديولوجيا', bad: 'إيديولوجيا', from: 'إيديولوج', to: 'أيديولوج', src: GUIDE, added: '2026-11-02' },
    { good: 'أنثروبولوجيا', bad: 'إنثروبولوجيا', from: 'إنثروبولوج', to: 'أنثروبولوج', src: GUIDE, added: '2026-11-02' },
    { good: 'إثنولوجيا', bad: 'أثنولوجيا', from: 'أثنولوج', to: 'إثنولوج', src: GUIDE, added: '2026-11-02' },
    { good: 'إبستمولوجيا', bad: 'أبستمولوجيا', from: 'أبستمولوج', to: 'إبستمولوج', src: GUIDE, added: '2026-11-02' },
    { good: 'إنترنت', bad: 'أنترنت', from: 'أنترنت', to: 'إنترنت', src: GUIDE, added: '2026-11-02' },
    { good: 'ليبرالية', bad: 'ليبيرالية', from: 'ليبيرالي', to: 'ليبرالي', src: GUIDE, added: '2026-11-02' },
    { good: 'ق.م', bad: 'ق.م.', special: true, src: GUIDE, added: '2026-11-02' },
    { good: 'مسؤول', bad: 'مسئول', from: 'مسئول', to: 'مسؤول', src: CORPUS, added: '2026-11-04' }
  ];

  // أمثلة مؤقتة إلى أن تُستخرج القائمة الكاملة من تحليل المقالات وتعتمدها الإدارة.
  // الصيغة المعتمدة هي الأكثر وروداً في المقالات بعد التدقيق.
  const names = [
    { name: 'أفلاطون', variants: ['افلاطون'], note: 'همزة القطع.', src: SAMPLE, added: '2026-11-11' },
    { name: 'أرسطو', variants: ['ارسطو'], note: 'همزة القطع.', src: SAMPLE, added: '2026-11-11' },
    { name: 'أركون', variants: ['اركون'], note: 'محمد أركون. همزة القطع.', src: SAMPLE, added: '2026-11-11' },
    { name: 'ابن سينا', variants: ['ابن سيناء'], note: 'بلا همزة في آخره.', src: SAMPLE, added: '2026-11-11' },
    { name: 'هيغل', variants: ['هيجل'], note: 'وردت «هيغل» في المقالات أكثر من «هيجل».', src: SAMPLE, added: '2026-11-11' },
    { name: 'هايدغر', variants: ['هيدغر', 'هيدجر', 'هايدجر'], note: 'الصيغة الأكثر وروداً في المقالات.', src: SAMPLE, added: '2026-11-11' },
    { name: 'دوركايم', variants: ['دوركهايم'], note: 'الصيغة الأكثر وروداً في المقالات.', src: SAMPLE, added: '2026-11-11' }
  ];

  const terms = [
    { term: 'الحداثة', def: 'مرحلة فكرية وحضارية نشأت في أوروبا، تقوم على مركزية العقل والإنسان والعلم.', src: SAMPLE, added: '2026-11-11' },
    { term: 'العلمانية', def: 'فصل الدين عن الدولة ومؤسساتها وعن الشأن العام.', src: SAMPLE, added: '2026-11-11' },
    { term: 'الهرمنيوطيقا', def: 'علم تأويل النصوص وفهمها.', src: SAMPLE, added: '2026-11-11' }
  ];

  const exceptions = [];

  const api = { words, names, terms, exceptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TajdidDict = api;
})(typeof window !== 'undefined' ? window : globalThis);
