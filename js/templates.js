/* الإعدادات الافتراضية، أنواع المستندات، المتغيرات، وبناء نموذج كل مستند */
(function (global) {
  'use strict';

  // ================= الإعدادات الافتراضية =================
  const DEFAULT_SETTINGS = {
    version: 1,
    // بيانات الجهة تُكتب من «الإعدادات»، أو من js/local.js على الكمبيوتر (لا يُنشر)
    headerLines: [''],
    logo: '',
    leftLabels: { no: 'الرقم', date: 'التاريخ', subject: 'الموضوع', attach: 'المشفوعات' },
    font: 'Traditional Arabic',
    fontSize: 16,
    headerFontSize: 13,
    unit: '',
    place: '',
    recipient: '',
    investigator: { name: '', rank: '', title: 'المحقق' },
    chief: { name: '', rank: '', title: 'رئيس الشعبة' },
    contacts: [],
    staleDays: 14,
    texts: {
      statementIntro: 'إنه في يوم {اليوم} الموافق {التاريخ}هـ، وفي تمام الساعة {الساعة}، وبمقر {المكان}، وبناءً على خطاب {صاحب_الإحالة} رقم ({رقم_خطاب_الإحالة}) وتاريخ {تاريخ_خطاب_الإحالة}هـ، بشأن {الموضوع}، وبناءً على أمر التحقيق رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، فقد افتتحنا نحن {رتبة_المحقق}/ {المحقق} هذا المحضر، وحضر أمامنا المذكور بياناته أدناه:',
      statementCharge: 'وبإحاطته بما هو منسوب إليه وهو: {المخالفة}، وإفهامه بحقه في إبداء أقواله ودفاعه وتقديم ما لديه من مستندات، جرى سؤاله على النحو الآتي:',
      statementClose: 'وبهذا انتهت أقواله، وأُقفل المحضر في تمام الساعة {ساعة_الانتهاء}، وبعد تلاوة أقواله عليه أقرّ بصحتها ووقّع عليها، والله الموفق.',
      witnessIntro: 'إنه في يوم {اليوم} الموافق {التاريخ}هـ، وفي تمام الساعة {الساعة}، وبمقر {المكان}، وإلحاقاً بالتحقيق الجاري في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، وبناءً على أمر التحقيق رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، حضر أمامنا نحن {رتبة_المحقق}/ {المحقق} الشاهد المذكور بياناته أدناه:',
      witnessCharge: 'وبعد تنبيهه إلى وجوب قول الحق وعدم كتمان الشهادة، جرى سؤاله على النحو الآتي:',
      witnessClose: 'وبهذا انتهت أقواله، وأُقفل المحضر في تمام الساعة {ساعة_الانتهاء}، وبعد تلاوة أقواله عليه أقرّ بصحتها ووقّع عليها، والله الموفق.',
      confrontationIntro: 'إنه في يوم {اليوم} الموافق {التاريخ}هـ، وفي تمام الساعة {الساعة}، وبمقر {المكان}، وإلحاقاً بالتحقيق الجاري في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، ولوجود تعارض في الأقوال بين كل من: {الأطراف}، فقد أجرينا نحن {رتبة_المحقق}/ {المحقق} المواجهة بينهم على النحو الآتي:',
      confrontationClose: 'وبهذا انتهت المواجهة، وأُقفل المحضر في تمام الساعة {ساعة_الانتهاء}، وبعد تلاوته على الحاضرين أقرّوا بصحة ما ورد فيه ووقّعوا عليه، والله الموفق.',
      closingRecord: 'إنه في يوم {اليوم} الموافق {التاريخ}هـ، وبعد استكمال إجراءات التحقيق في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، الصادر بشأنها أمر التحقيق رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، وسماع أقوال كل من: {الأطراف}، والاطلاع على ما أُرفق بالأوراق من مستندات، فقد قررنا نحن {رتبة_المحقق}/ {المحقق} إقفال التحقيق، ورفع الأوراق مشفوعة بالتقرير النهائي لاستكمال اللازم.',
      generalRecord: 'إنه في يوم {اليوم} الموافق {التاريخ}هـ، وفي تمام الساعة {الساعة}، وبمقر {المكان}، وإلحاقاً بالتحقيق الجاري في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، فقد قمنا نحن {رتبة_المحقق}/ {المحقق} بـ ......',
      ackCharge: 'أقر أنا/ {الرتبة} {الاسم}، رقم الهوية ({الهوية})، بأنني أُحطت علماً بالمخالفة المنسوبة إليّ وهي: {المخالفة}، وأُفهمت بحقي في الدفاع عن نفسي وتقديم ما لدي من أقوال ومستندات، وعلى ذلك أوقع.',
      ackNoMore: 'أقر أنا/ {الرتبة} {الاسم}، رقم الهوية ({الهوية})، بأنه ليس لدي أقوال أو إفادات أو مستندات أخرى غير ما أدليت به في محضر سماع أقوالي في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، وعلى ذلك أوقع.',
      ackNotice: 'أقر أنا/ {الرتبة} {الاسم}، رقم الهوية ({الهوية})، بأنني تبلّغت بـ ...... وذلك في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}، وعلى ذلك أوقع.',
      ackFree: 'أقر أنا/ {الرتبة} {الاسم}، رقم الهوية ({الهوية})، بأنني ...... وعلى ذلك أوقع.',
      letterGreeting: '{المخاطب} المحترم\nالسلام عليكم ورحمة الله وبركاته، وبعد:',
      letterClosing: 'وتقبلوا تحياتي،،،',
      letterOrder: 'إشارةً إلى خطاب {صاحب_الإحالة} رقم ({رقم_خطاب_الإحالة}) وتاريخ {تاريخ_خطاب_الإحالة}هـ، بشأن {الموضوع}، والمحال إلى {الشعبة} للتحقيق والإفادة.\nنأمل من سعادتكم التكرم بالموافقة على إجراء التحقيق مع كل من:\n{قائمة_المحقق_معهم}\nوذلك لاستكمال الإجراءات النظامية حيال الموضوع.',
      letterSummon: 'بناءً على أمر التحقيق رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، بشأن {الموضوع}.\nنأمل التكرم بتوجيه {الرتبة}/ {الاسم} بمراجعة {الشعبة} يوم ...... الموافق ......هـ في تمام الساعة ......، وذلك لسماع أقواله بشأن الموضوع المشار إليه.',
      letterBio: 'إلحاقاً بالتحقيق الجاري في القضية رقم ({رقم_المعاملة}) بشأن {الموضوع}.\nنأمل التكرم بتزويدنا بالنبذة الوظيفية وصحيفة السوابق لكل من:\n{قائمة_المحقق_معهم}\nوذلك لإرفاقها بأوراق التحقيق.',
      letterCover: 'إشارةً إلى أمر سعادتكم رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، بالموافقة على إجراء التحقيق بشأن {الموضوع}.\nنفيد سعادتكم بأنه تم استكمال التحقيق مع كل من: {الأطراف}، ونرفق لسعادتكم أصل المعاملة مشفوعة بالتقرير النهائي المتضمن النتيجة والمرئيات، للاطلاع والتوجيه بما ترونه.',
      letterFree: '......',
      reportOpening: 'بناءً على أمر التحقيق رقم ({رقم_أمر_التحقيق}) وتاريخ {تاريخ_أمر_التحقيق}هـ، الصادر من {مصدر_الأمر}، بالموافقة على إجراء التحقيق بشأن {الموضوع}، فقد جرى التحقيق، وفيما يلي بيان ما تم:',
    },
    questionBank: [
      { cat: 'افتتاحية', q: 'عرّف بنفسك وعملك الحالي ومدة خدمتك؟' },
      { cat: 'افتتاحية', q: 'هل سبق أن حُقق معك أو صدرت بحقك عقوبة؟' },
      { cat: 'الموضوع', q: 'ما معلوماتك عن موضوع التحقيق؟' },
      { cat: 'الموضوع', q: 'متى وأين حدث ذلك؟ ومن كان حاضراً؟' },
      { cat: 'الموضوع', q: 'ما الإجراء المتبع لديكم في مثل هذه الحالة؟ وهل التزمت به؟' },
      { cat: 'الموضوع', q: 'هل يوجد ما يثبت أقوالك من مستندات أو شهود؟' },
      { cat: 'المواجهة', q: 'ورد في أقوال ...... أن ......، فما ردك؟' },
      { cat: 'ختامية', q: 'هل لديك أقوال أخرى تود إضافتها؟' },
      { cat: 'ختامية', q: 'هل هذه أقوالك وتصادق عليها؟' },
    ],
  };

  // ================= المراحل وأنواع الإجراءات =================
  const STAGES = [
    { key: 'referral', label: 'استلام الإحالة', ev: 'استلام إحالة' },
    { key: 'orderReq', label: 'طلب أمر التحقيق', ev: 'طلب أمر تحقيق' },
    { key: 'order', label: 'صدور أمر التحقيق', ev: 'صدور أمر تحقيق' },
    { key: 'summon', label: 'خطاب المراجعة', ev: 'إعداد خطاب مراجعة' },
    { key: 'investigation', label: 'إجراء التحقيق', ev: 'إجراء التحقيق' },
    { key: 'report', label: 'التقرير النهائي', ev: 'إعداد تقرير القضية' },
    { key: 'index', label: 'فهرسة المعاملة', ev: 'فهرسة المعاملة' },
    { key: 'cover', label: 'خطاب التغطية', ev: 'إعداد خطاب التغطية' },
    { key: 'returned', label: 'الإعادة لمدير الشرطة', ev: 'إعادة لمدير الشرطة' },
  ];
  const EVENT_TYPES = ['استلام إحالة', 'طلب أمر تحقيق', 'صدور أمر تحقيق', 'إعداد خطاب مراجعة', 'مراجعة المخالف',
    'إجراء التحقيق', 'اتصال / متابعة', 'إعداد تقرير القضية', 'فهرسة المعاملة', 'إعداد خطاب التغطية', 'إعادة لمدير الشرطة', 'ملاحظة أخرى'];
  const PRIORITIES = ['عالية', 'متوسطة', 'منخفضة'];
  const STATUSES = ['قيد العمل', 'بانتظار رد/إجراء', 'موقوفة مؤقتاً', 'مكتملة'];
  const REFERRAL_TYPES = ['داخلية', 'خارجية'];
  const ROLES = { accused: 'محقق معه', witness: 'شاهد' };

  // ================= أنواع المستندات =================
  // parties: none | one-accused | one-witness | one | many
  const DOC_TYPES = {
    statement:     { group: 'محاضر', name: 'محضر سماع أقوال محقق معه', short: 'محضر سماع أقوال', parties: 'one-accused', qa: true, intro: 'statementIntro', mid: 'statementCharge', close: 'statementClose', event: 'إجراء التحقيق', signParties: true },
    witness:       { group: 'محاضر', name: 'محضر سماع أقوال شاهد', short: 'محضر سماع أقوال شاهد', parties: 'one-witness', qa: true, intro: 'witnessIntro', mid: 'witnessCharge', close: 'witnessClose', event: 'إجراء التحقيق', signParties: true },
    confrontation: { group: 'محاضر', name: 'محضر مواجهة', short: 'محضر مواجهة', parties: 'many', qa: true, intro: 'confrontationIntro', close: 'confrontationClose', event: 'إجراء التحقيق', signParties: true },
    general:       { group: 'محاضر', name: 'محضر عام (اطلاع / معاينة / إثبات حالة)', short: 'محضر', parties: 'many-optional', intro: 'generalRecord', event: 'إجراء التحقيق', signParties: true, freeTitle: true },
    closing:       { group: 'محاضر', name: 'محضر إقفال التحقيق', short: 'محضر إقفال التحقيق', parties: 'none', intro: 'closingRecord' },
    ackCharge:     { group: 'إقرارات', name: 'إقرار بالإحاطة بالمخالفة', short: 'إقرار', parties: 'one', ack: 'ackCharge' },
    ackNoMore:     { group: 'إقرارات', name: 'إقرار بعدم وجود أقوال أخرى', short: 'إقرار', parties: 'one', ack: 'ackNoMore' },
    ackNotice:     { group: 'إقرارات', name: 'إقرار تبليغ / استلام', short: 'إقرار', parties: 'one', ack: 'ackNotice' },
    ackFree:       { group: 'إقرارات', name: 'إقرار عام', short: 'إقرار', parties: 'one', ack: 'ackFree' },
    letterOrder:   { group: 'خطابات', name: 'خطاب طلب أمر التحقيق', short: 'طلب أمر تحقيق', parties: 'none', letter: 'letterOrder', event: 'طلب أمر تحقيق' },
    letterSummon:  { group: 'خطابات', name: 'خطاب مراجعة (استدعاء)', short: 'خطاب مراجعة', parties: 'one', letter: 'letterSummon', event: 'إعداد خطاب مراجعة' },
    letterBio:     { group: 'خطابات', name: 'خطاب طلب نبذة وسوابق', short: 'طلب نبذة وسوابق', parties: 'none', letter: 'letterBio', event: 'اتصال / متابعة' },
    letterCover:   { group: 'خطابات', name: 'خطاب التغطية', short: 'خطاب تغطية', parties: 'none', letter: 'letterCover', event: 'إعداد خطاب التغطية' },
    letterFree:    { group: 'خطابات', name: 'خطاب عام', short: 'خطاب', parties: 'none', letter: 'letterFree', freeTitle: true },
  };

  // ================= المتغيرات =================
  function partyListText(parties) {
    return parties.map((p, i) => `${i + 1}- ${p.rank ? p.rank + '/ ' : ''}${p.name}${p.unit ? ' - ' + p.unit : ''}${p.nationalId ? ' - هوية رقم (' + p.nationalId + ')' : ''}`).join('\n');
  }
  function partyNames(parties) {
    return parties.map((p) => `${p.rank ? p.rank + '/ ' : ''}${p.name}`).join('، ');
  }

  function vars(c, S, d) {
    const parties = (d && d.partyIds ? d.partyIds.map((id) => c.parties.find((p) => p.id === id)).filter(Boolean) : []);
    const p = parties[0] || {};
    const accused = c.parties.filter((x) => x.role === 'accused');
    const date = (d && d.date) || U.todayISO();
    return {
      'رقم_المعاملة': c.caseNo,
      'تاريخ_المعاملة': c.txnDateH,
      'الجهة_المحيلة': c.referringBody,
      'الموضوع': c.subject,
      'المخالفة': c.charge || c.subject,
      'صاحب_الإحالة': c.referral && c.referral.from,
      'رقم_خطاب_الإحالة': c.referral && c.referral.no,
      'تاريخ_خطاب_الإحالة': c.referral && c.referral.dateH,
      'رقم_أمر_التحقيق': c.order && c.order.no,
      'تاريخ_أمر_التحقيق': c.order && c.order.dateH,
      'مصدر_الأمر': c.order && c.order.issuer,
      'الاسم': p.name, 'الرتبة': p.rank, 'الرقم_العسكري': p.militaryNo, 'الهوية': p.nationalId,
      'جهة_العمل': p.unit, 'الجوال': p.phone,
      'الأطراف': partyNames(parties.length ? parties : accused),
      'قائمة_المحقق_معهم': partyListText(accused),
      'المحقق': S.investigator.name, 'رتبة_المحقق': S.investigator.rank, 'صفة_المحقق': S.investigator.title,
      'رئيس_الشعبة': S.chief.name, 'رتبة_رئيس_الشعبة': S.chief.rank,
      'الشعبة': S.unit, 'المكان': (d && d.place) || S.place, 'المخاطب': (d && d.to) || S.recipient,
      'اليوم': U.dayName(date), 'التاريخ': U.hijri(date),
      'الساعة': U.time12((d && d.start) || ''), 'ساعة_الانتهاء': U.time12((d && d.end) || ''),
      'تاريخ_اليوم': U.hijri(U.todayISO()),
    };
  }

  const VAR_HELP = ['رقم_المعاملة', 'الموضوع', 'المخالفة', 'الجهة_المحيلة', 'صاحب_الإحالة', 'رقم_خطاب_الإحالة', 'تاريخ_خطاب_الإحالة',
    'رقم_أمر_التحقيق', 'تاريخ_أمر_التحقيق', 'مصدر_الأمر', 'الاسم', 'الرتبة', 'الرقم_العسكري', 'الهوية', 'جهة_العمل', 'الجوال',
    'الأطراف', 'قائمة_المحقق_معهم', 'المحقق', 'رتبة_المحقق', 'رئيس_الشعبة', 'الشعبة', 'المكان', 'المخاطب',
    'اليوم', 'التاريخ', 'الساعة', 'ساعة_الانتهاء', 'تاريخ_اليوم'];

  // ================= إنشاء مستند جديد =================
  function newDoc(type, c, S, partyIds) {
    const T = DOC_TYPES[type];
    const d = {
      id: U.uid(), type, title: T.short, partyIds: partyIds || [], date: U.todayISO(),
      start: T.qa || T.intro ? U.timeNow() : '', end: '', place: S.place,
      no: c.caseNo, attach: '', createdAt: U.now(), updatedAt: U.now(),
    };
    if (T.letter) { d.to = S.recipient; d.subject = c.subject ? `بشأن ${c.subject.replace(/^بشأن\s*/, '')}` : ''; d.signer = 'chief'; d.attach = type === 'letterCover' ? 'أصل المعاملة + التقرير النهائي' : ''; }
    else d.subject = T.short;
    fillTexts(d, c, S);
    if (T.qa) d.qa = type === 'confrontation' ? [] : [{ id: U.uid(), q: '', a: '' }];
    return d;
  }
  /** (إعادة) توليد النصوص من القوالب بحسب بيانات القضية الحالية */
  function fillTexts(d, c, S) {
    const T = DOC_TYPES[d.type]; const v = vars(c, S, d); const X = S.texts;
    if (T.intro) d.intro = U.fill(X[T.intro], v);
    if (T.mid) d.mid = U.fill(X[T.mid], v);
    if (T.close) d.close = U.fill(X[T.close], v);
    if (T.ack) d.body = U.fill(X[T.ack], v);
    if (T.letter) {
      d.body = U.fill(X[T.letter], v);
      d.greeting = U.fill(X.letterGreeting, v);
      d.closing = U.fill(X.letterClosing, v);
    }
  }
  function partyRows(p) {
    return [['الاسم', p.name], ['الرتبة / الصفة', p.rank], ['الرقم العسكري', p.militaryNo], ['رقم الهوية', p.nationalId],
      ['جهة العمل', p.unit], ['رقم الجوال', p.phone]].filter((r) => r[1]);
  }
  const sigLine = 'التوقيع: ..................';
  const officerSig = (S) => ({ title: S.investigator.title || 'المحقق', lines: [`${S.investigator.rank ? S.investigator.rank + '/ ' : ''}${S.investigator.name || '..................'}`, sigLine] });
  const chiefSig = (S) => ({ title: S.chief.title || 'رئيس الشعبة', lines: [`${S.chief.rank ? S.chief.rank + '/ ' : ''}${S.chief.name || '..................'}`, sigLine] });
  const partySig = (p, label) => ({ title: label || ROLES[p.role] || 'الطرف', lines: [`${p.rank ? p.rank + '/ ' : ''}${p.name}`, sigLine] });

  // ================= بناء نموذج المستند =================
  function build(c, d, S) {
    const T = DOC_TYPES[d.type];
    const parties = (d.partyIds || []).map((id) => c.parties.find((p) => p.id === id)).filter(Boolean);
    const header = { no: d.no || c.caseNo, date: U.hijri(d.date), subject: d.subject || T.short, attach: d.attach || '' };
    const blocks = [];

    if (T.letter) {
      String(d.greeting || '').split('\n').forEach((l, i) => blocks.push({ t: 'p', text: l, bold: i === 0, align: i === 0 ? 'right' : 'justify' }));
      String(d.body || '').split('\n').forEach((l) => blocks.push({ t: 'p', text: l, align: 'justify', indent: 0 }));
      if (d.closing) blocks.push({ t: 'p', text: d.closing, align: 'center' });
      blocks.push({ t: 'sig', cols: [{ title: '', lines: [] }, d.signer === 'investigator' ? officerSig(S) : chiefSig(S)] });
      return { title: d.title, header, blocks };
    }

    if (T.ack) {
      blocks.push({ t: 'title', text: d.title || T.short });
      blocks.push({ t: 'p', text: d.body, align: 'justify' });
      if (parties[0]) {
        blocks.push({ t: 'space' });
        blocks.push({ t: 'kv', rows: [['المقر بما فيه', `${parties[0].rank ? parties[0].rank + '/ ' : ''}${parties[0].name}`], ['التوقيع', ''], ['التاريخ', U.hijri(d.date) + 'هـ']] });
      }
      blocks.push({ t: 'sig', cols: [{ title: '', lines: [] }, officerSig(S)] });
      return { title: d.title, header, blocks };
    }

    // المحاضر
    blocks.push({ t: 'title', text: d.title || T.short });
    if (d.intro) blocks.push({ t: 'p', text: d.intro });
    if (T.parties !== 'none' && parties.length) {
      if (parties.length === 1) blocks.push({ t: 'kv', rows: partyRows(parties[0]) });
      else blocks.push({ t: 'table', head: ['م', 'الاسم', 'الرتبة / الصفة', 'جهة العمل', 'الهوية'], widths: [0.06, 0.3, 0.2, 0.26, 0.18],
        rows: parties.map((p, i) => [String(i + 1), p.name, p.rank || '', p.unit || '', p.nationalId || '']) });
    }
    if (d.mid) blocks.push({ t: 'p', text: d.mid });
    if (d.text) String(d.text).split('\n').forEach((l) => blocks.push({ t: 'p', text: l }));
    (d.qa || []).forEach((x, i) => {
      if (d.type === 'confrontation' && x.who) blocks.push({ t: 'qa', n: i + 1, q: x.q, a: `(${x.who}): ${x.a || ''}` });
      else blocks.push({ t: 'qa', n: i + 1, q: x.q, a: x.a });
    });
    if (d.close) blocks.push({ t: 'p', text: d.close });
    const sigs = T.signParties ? parties.map((p) => partySig(p)) : [];
    sigs.push(officerSig(S));
    for (let i = 0; i < sigs.length; i += 3) blocks.push({ t: 'sig', cols: sigs.slice(i, i + 3) });
    return { title: d.title, header, blocks };
  }

  // ================= التقرير النهائي =================
  function eventsSorted(c) {
    return [...(c.events || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  function defaultReport(c, S) {
    const v = vars(c, S, null);
    const summaries = {};
    c.parties.forEach((p) => {
      const recs = (c.docs || []).filter((d) => (d.type === 'statement' || d.type === 'witness') && (d.partyIds || []).includes(p.id));
      summaries[p.id] = recs.length ? recs.map((d) => (d.qa || []).filter((x) => x.a).map((x) => x.a).join(' ')).join('\n') : (p.summary || '');
    });
    return {
      date: U.todayISO(), no: c.caseNo, attach: '',
      opening: U.fill(S.texts.reportOpening, v),
      facts: c.notes || '', summaries, analysis: '', result: c.result || '', recommendations: '',
      showBio: true, showEvents: true, updatedAt: U.now(),
    };
  }
  function buildReport(c, r, S) {
    const header = { no: r.no || c.caseNo, date: U.hijri(r.date), subject: 'التقرير النهائي', attach: r.attach || '' };
    const B = [];
    const ord = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً'];
    let k = 0;
    const sec = (t) => B.push({ t: 'subtitle', text: `${ord[k++]}: ${t}` });
    const paras = (s) => String(s || '').split('\n').filter((l) => l.trim()).forEach((l) => B.push({ t: 'p', text: l }));

    B.push({ t: 'title', text: `التقرير النهائي للتحقيق في القضية رقم (${c.caseNo || ''})` });
    if (S.chief.name || S.recipient) B.push({ t: 'p', text: `**${S.recipient} المحترم**`, align: 'right' });
    B.push({ t: 'p', text: 'السلام عليكم ورحمة الله وبركاته، وبعد:', align: 'right' });
    paras(r.opening);

    sec('بيانات القضية');
    B.push({ t: 'kv', rows: [
      ['رقم المعاملة', c.caseNo], ['تاريخ المعاملة', c.txnDateH ? c.txnDateH + 'هـ' : ''], ['الجهة المحيلة', c.referringBody],
      ['الموضوع', c.subject], ['أمر التحقيق', c.order && c.order.no ? `رقم (${c.order.no}) وتاريخ ${c.order.dateH || ''}هـ` : ''],
    ].filter((x) => x[1]) });

    sec('الوقائع'); paras(r.facts);

    const accused = c.parties.filter((p) => p.role === 'accused');
    if (r.showBio && accused.length) {
      sec('النبذة الوظيفية للمحقق معهم');
      B.push({ t: 'table', head: ['م', 'الاسم', 'الرتبة', 'الرقم العسكري', 'جهة العمل', 'السوابق'], widths: [0.05, 0.25, 0.12, 0.18, 0.24, 0.16],
        rows: accused.map((p, i) => [String(i + 1), p.name, p.rank || '', p.militaryNo || '', p.unit || '', p.record || 'لا يوجد']) });
    }

    if (r.showEvents && (c.events || []).length) {
      sec('الإجراءات المتخذة');
      B.push({ t: 'table', head: ['م', 'التاريخ', 'الإجراء', 'التفاصيل'], widths: [0.05, 0.19, 0.2, 0.56],
        rows: eventsSorted(c).map((e, i) => [String(i + 1), U.hijri(e.date) + 'هـ', e.type, e.details || ''] ) });
    }

    const withSum = c.parties.filter((p) => (r.summaries || {})[p.id]);
    if (withSum.length) {
      sec('ملخص الأقوال');
      withSum.forEach((p) => {
        B.push({ t: 'p', text: `**${ROLES[p.role]}: ${p.rank ? p.rank + '/ ' : ''}${p.name}**` });
        paras(r.summaries[p.id]);
      });
    }
    if (r.analysis) { sec('المناقشة والتحليل'); paras(r.analysis); }
    if (r.result) { sec('النتيجة'); paras(r.result); }
    if (r.recommendations) { sec('المرئيات والتوصيات'); paras(r.recommendations); }

    B.push({ t: 'p', text: 'هذا ما لزم عرضه، والأمر لسعادتكم.', align: 'center' });
    B.push({ t: 'sig', cols: [officerSig(S), { title: 'يُعتمد،', lines: [S.chief.title || 'رئيس الشعبة', `${S.chief.rank ? S.chief.rank + '/ ' : ''}${S.chief.name || '..................'}`, sigLine] }] });
    return { title: 'التقرير النهائي', header, blocks: B };
  }

  // ================= فهرس المعاملة =================
  function defaultIndex(c) {
    const rows = [];
    eventsSorted(c).forEach((e) => rows.push({ id: U.uid(), name: `${e.type}${e.ref ? ' رقم (' + e.ref + ')' : ''}`, date: e.date, pages: '1' }));
    (c.docs || []).forEach((d) => rows.push({ id: U.uid(), name: d.title + (d.partyIds && d.partyIds.length ? ' - ' + d.partyIds.map((id) => (c.parties.find((p) => p.id === id) || {}).name).filter(Boolean).join('، ') : ''), date: d.date, pages: '1' }));
    (c.attachments || []).forEach((a) => rows.push({ id: U.uid(), name: a.title || a.name, date: a.date || '', pages: '1' }));
    rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return { date: U.todayISO(), rows, updatedAt: U.now() };
  }
  function buildIndex(c, ix, S) {
    let from = 1;
    const rows = ix.rows.map((r, i) => {
      const n = Math.max(1, parseInt(r.pages, 10) || 1);
      const range = n === 1 ? String(from) : `${from} - ${from + n - 1}`;
      from += n;
      return [String(i + 1), r.name, r.date ? U.hijri(r.date) + 'هـ' : '', String(n), range];
    });
    return {
      title: 'فهرس المعاملة',
      header: { no: c.caseNo, date: U.hijri(ix.date), subject: 'فهرس المعاملة', attach: '' },
      blocks: [
        { t: 'title', text: `فهرس المعاملة رقم (${c.caseNo || ''})` },
        { t: 'p', text: `**الموضوع:** ${c.subject || ''}` },
        { t: 'table', head: ['م', 'المستند', 'التاريخ', 'عدد الأوراق', 'من - إلى'], widths: [0.06, 0.5, 0.16, 0.12, 0.16], rows },
        { t: 'p', text: `**إجمالي الأوراق:** ${from - 1}` },
        { t: 'sig', cols: [{ title: '', lines: [] }, officerSig(S)] },
      ],
    };
  }

  // ================= حالة القضية =================
  function stageInfo(c, S) {
    const types = new Set((c.events || []).map((e) => e.type));
    const done = STAGES.map((s) => types.has(s.ev));
    const nextIdx = done.indexOf(false);
    const doneCount = done.filter(Boolean).length;
    const lastDate = eventsSorted(c).map((e) => e.date).filter(Boolean).pop() || c.referralDate || (c.createdAt || '').slice(0, 10);
    const today = U.todayISO();
    const idle = lastDate ? U.daysBetween(lastDate, today) : null;
    const closed = done[STAGES.length - 1] || c.status === 'مكتملة';
    let flag = 'طبيعية';
    if (closed) flag = 'مكتملة';
    else if (c.followDate && c.followDate < today) flag = 'متابعة متأخرة';
    else if (idle !== null && idle >= (S.staleDays || 14)) flag = `راكدة ${S.staleDays || 14}+ يوم`;
    return {
      done, doneCount, percent: Math.round(doneCount / STAGES.length * 100),
      current: closed ? 'مكتملة' : STAGES[nextIdx < 0 ? STAGES.length - 1 : nextIdx].label,
      lastDate, idle, flag, closed,
      sinceReferral: c.referralDate ? U.daysBetween(c.referralDate, today) : null,
    };
  }

  global.T = {
    DEFAULT_SETTINGS, STAGES, EVENT_TYPES, PRIORITIES, STATUSES, REFERRAL_TYPES, ROLES, DOC_TYPES, VAR_HELP,
    vars, newDoc, fillTexts, build, defaultReport, buildReport, defaultIndex, buildIndex, stageInfo, eventsSorted,
  };
})(window);
