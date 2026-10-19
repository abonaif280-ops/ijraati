/* نواة البرنامج: التشغيل، التنقل، الحفظ، لوحة القضايا، الإعدادات، التصدير والاستيراد */
(function (global) {
  'use strict';
  const { h } = U;

  const App = {
    S: null,
    cases: [],
    pending: new Set(),
    saveTimer: null,
    settingsTimer: null,
  };

  // ================= أدوات النماذج =================
  /** حقل مربوط بخاصية في كائن؛ أي تعديل يُحفظ تلقائياً */
  App.field = function (label, obj, key, opts = {}) {
    const type = opts.type || 'text';
    const get = () => (obj[key] == null ? '' : obj[key]);
    const changed = (v) => {
      obj[key] = v;
      if (opts.item !== false) obj.updatedAt = U.now();
      if (opts.onChange) opts.onChange(v);
      if (opts.settings) App.saveSettingsSoon(); else if (App.current) App.touch(App.current);
    };
    let input, extra = null;
    if (type === 'textarea') {
      input = h('textarea', { rows: opts.rows || 3, value: get(), placeholder: opts.placeholder || '' });
      input.addEventListener('input', () => changed(input.value));
    } else if (type === 'select') {
      input = h('select', (opts.options || []).map((o) => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return h('option', { value: v }, t);
      }));
      input.value = get();
      input.addEventListener('change', () => changed(input.value));
    } else if (type === 'date') {
      // تاريخ ميلادي مخزّن + عرض هجري بجانبه
      input = h('input', { type: 'date', value: get() });
      extra = h('span.hint', get() ? U.hijri(get()) + 'هـ' : '');
      input.addEventListener('change', () => { changed(input.value); extra.textContent = input.value ? U.hijri(input.value) + 'هـ' : ''; });
    } else if (type === 'hijri') {
      // تاريخ هجري نصي كما يُكتب في المكاتبات
      input = h('input', { type: 'text', value: get(), placeholder: '1448/02/14', dir: 'ltr', className: 'hijri' });
      const g = () => { const iso = U.hijriToISO(input.value); return iso ? '= ' + iso.split('-').reverse().join('/') + 'م' : ''; };
      extra = h('span.hint', g());
      const today = h('button.small.ghost', { type: 'button', title: 'تاريخ اليوم', on: { click: () => { input.value = U.hijri(new Date()); changed(input.value); extra.textContent = g(); } } }, 'اليوم');
      input.addEventListener('input', () => { changed(input.value.trim()); extra.textContent = g(); });
      extra = h('span', today, extra);
    } else {
      input = h('input', { type, value: get(), placeholder: opts.placeholder || '', dir: opts.dir || null });
      input.addEventListener('input', () => changed(type === 'number' ? +input.value : input.value));
    }
    if (opts.id) input.id = opts.id;
    return h('label.field' + (opts.wide ? '.wide' : '') + (opts.full ? '.full' : ''), h('span.lbl', label), h('span.ctl', input, extra));
  };

  App.btn = (text, onClick, cls) => h('button' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', on: { click: onClick } }, text);

  // ================= الحفظ =================
  App.touch = function (c) {
    App.pending.add(c);
    App.setSaveState('saving');
    clearTimeout(App.saveTimer);
    App.saveTimer = setTimeout(App.flush, 700);
  };
  App.flush = async function () {
    clearTimeout(App.saveTimer);
    const list = [...App.pending]; App.pending.clear();
    let waiting = false;
    try {
      for (const c of list) {
        // في وضع المجلد يُسمّى مجلد القضية برقم المعاملة، فننتظر إدخاله قبل أول حفظ
        if (Store.mode === 'folder' && !c.folder && !(c.caseNo || '').trim()) { App.pending.add(c); waiting = true; continue; }
        await Store.saveCase(c);
      }
      App.setSaveState(waiting ? 'waiting' : 'saved');
    } catch (e) {
      list.forEach((c) => App.pending.add(c));
      App.setSaveState('error');
      U.toast('تعذر الحفظ: ' + e.message, 'err');
    }
  };
  App.setSaveState = function (s) {
    const el = document.getElementById('saveState'); if (!el) return;
    el.className = 'save-state ' + s;
    el.textContent = s === 'saving' ? 'جارٍ الحفظ…' : s === 'error' ? 'لم يُحفظ!' : s === 'waiting' ? 'أدخل رقم المعاملة ليبدأ الحفظ' : 'محفوظ ✓';
  };
  App.saveSettingsSoon = function () {
    App.setSaveState('saving');
    clearTimeout(App.settingsTimer);
    App.settingsTimer = setTimeout(async () => {
      try { await Store.saveSettings(App.S); App.setSaveState('saved'); }
      catch (e) { App.setSaveState('error'); U.toast('تعذر حفظ الإعدادات: ' + e.message, 'err'); }
    }, 600);
  };
  window.addEventListener('beforeunload', (e) => {
    if (App.pending.size) { App.flush(); e.preventDefault(); e.returnValue = ''; }
  });

  function mergeSettings(saved) {
    const D = JSON.parse(JSON.stringify(T.DEFAULT_SETTINGS));
    if (!saved) return D;
    const S = Object.assign(D, saved);
    S.texts = Object.assign(JSON.parse(JSON.stringify(T.DEFAULT_SETTINGS.texts)), saved.texts || {});
    S.leftLabels = Object.assign({}, T.DEFAULT_SETTINGS.leftLabels, saved.leftLabels || {});
    S.investigator = Object.assign({}, T.DEFAULT_SETTINGS.investigator, saved.investigator || {});
    S.chief = Object.assign({}, T.DEFAULT_SETTINGS.chief, saved.chief || {});
    return S;
  }

  /** يضمن وجود كل الحقول في القضية (للقضايا القديمة أو المستوردة) */
  App.normalizeCase = function (c) {
    c.parties = c.parties || []; c.events = c.events || []; c.docs = c.docs || []; c.attachments = c.attachments || [];
    c.referral = c.referral || {}; c.order = c.order || {};
    return c;
  };
  App.newCase = function () {
    return App.normalizeCase({
      id: U.uid(), caseNo: '', txnDateH: '', referralDate: U.todayISO(), referralType: 'داخلية', referringBody: '',
      subject: '', charge: '', priority: 'متوسطة', status: 'قيد العمل',
      referral: { from: App.S.recipient, no: '', dateH: '' }, order: { no: '', dateH: '', issuer: App.S.recipient.replace(/^سعادة\s*/, '') },
      followNext: '', followDate: '', result: '', notes: '', createdAt: U.now(), updatedAt: U.now(),
    });
  };
  App.live = (arr) => (arr || []).filter((x) => !x.deleted);
  App.findCase = (id) => App.cases.find((c) => c.id === id);

  // ================= التشغيل =================
  App.start = async function () {
    if (!Auth.ok()) return Auth.render(() => {
      App.start();
      if (Auth.isDefault()) U.toast('أنت تستخدم بيانات الدخول الافتراضية؛ غيّرها من «الإعدادات»', 'err');
    });
    renderShell();
    let st;
    try { st = await Store.init(); } catch (e) { st = 'needs-setup'; }
    if (st === 'ready') return App.load();
    renderSetup(st);
  };
  App.load = async function () {
    try {
      App.S = mergeSettings(await Store.loadSettings());
      App.cases = (await Store.listCases()).map(App.normalizeCase);
    } catch (e) {
      U.toast('تعذرت قراءة البيانات: ' + e.message, 'err');
      return renderSetup('needs-setup');
    }
    document.getElementById('storeLabel').textContent = Store.label();
    document.body.classList.add('ready');
    window.onhashchange = route;
    route();
  };

  function renderShell() {
    document.body.innerHTML = '';
    document.body.append(
      h('header.topbar',
        h('a.brand', { href: '#/' }, h('span.logo-dot'), 'إجراءات التحقيق'),
        h('nav.topnav',
          h('a', { href: '#/' }, 'القضايا'),
          h('a', { href: '#/new' }, '+ قضية جديدة'),
          h('a', { href: '#/transfer' }, 'نقل البيانات'),
          h('a', { href: '#/settings' }, 'الإعدادات')),
        h('div.topright',
          App.btn([h('span', '▦'), h('span.txt', ' قراءة باركود')], () => Share.scan(), 'ghost small'),
          h('span#saveState.save-state.saved', 'محفوظ ✓'),
          h('span#storeLabel.store-label', ''),
          App.btn([h('span', '🔒'), h('span.txt', ' خروج')], async () => { await App.flush(); Auth.lock(); }, 'ghost small'))),
      h('main#view'),
      // شريط سفلي للجوال (يظهر بالـ CSS على الشاشات الصغيرة فقط)
      h('nav.bottomnav',
        [['#/', '☰', 'القضايا'], ['#/new', '＋', 'جديدة'], ['#/transfer', '⇅', 'نقل'], ['#/settings', '⚙', 'الإعدادات']]
          .map(([href, ic, t]) => h('a', { href }, h('i', ic), h('span', t)))));
  }
  const view = () => document.getElementById('view');

  function renderSetup(st) {
    const v = view(); v.innerHTML = '';
    const box = h('div.setup.card',
      h('h1', 'مرحباً بك في برنامج إجراءات التحقيق'),
      h('p', 'اختر أين تُحفظ بياناتك. يُفضّل على الكمبيوتر اختيار مجلد (مثلاً على الفلاشة)، فتُحفظ كل قضية في مجلد مستقل بملفاتها ومرفقاتها.'));
    if (st === 'needs-permission') {
      box.append(h('div.callout', `المجلد المحفوظ: «${Store.folderName}». يحتاج المتصفح موافقتك لفتحه.`),
        App.btn(`فتح المجلد «${Store.folderName}»`, async () => {
          try { await Store.reconnect(); App.load(); } catch (e) { U.toast(e.message, 'err'); }
        }, 'big'));
    }
    if (Store.supportsFolder) {
      box.append(App.btn('📁 اختيار مجلد البيانات', async () => {
        try { await Store.pickFolder(); App.load(); } catch (e) { if (e.name !== 'AbortError') U.toast(e.message, 'err'); }
      }, st === 'needs-permission' ? 'secondary big' : 'big'));
    }
    box.append(App.btn('📱 الحفظ داخل المتصفح' + (Store.supportsFolder ? '' : ' (الخيار المتاح على هذا الجهاز)'), async () => {
      await Store.useBrowser(); App.load();
    }, Store.supportsFolder ? 'secondary big' : 'big'),
    h('p.note', 'الحفظ داخل المتصفح مناسب للجوال. انقل بياناتك بين الأجهزة من «نقل البيانات» بالتصدير والاستيراد، وخذ نسخة احتياطية بشكل دوري.'));
    v.append(box);
  }

  // ================= التنقل =================
  function route() {
    App.flush();
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const v = view(); v.innerHTML = ''; window.scrollTo(0, 0);
    document.querySelectorAll('.topnav a, .bottomnav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#/' + (parts[0] || '')));
    App.current = null;
    try {
      if (!parts[0]) return renderDashboard(v);
      if (parts[0] === 'new') {
        const c = App.newCase(); App.cases.push(c); App.current = c; App.touch(c);
        location.replace('#/case/' + c.id + '/info'); return;
      }
      if (parts[0] === 'settings') return renderSettings(v);
      if (parts[0] === 'transfer') return renderTransfer(v);
      if (parts[0] === 'case') {
        const c = App.findCase(parts[1]);
        if (!c) { v.append(h('div.card', 'القضية غير موجودة.')); return; }
        App.current = c;
        return CaseView.render(v, c, parts[2] || 'info', parts[3]);
      }
      renderDashboard(v);
    } catch (e) {
      console.error(e);
      v.append(h('div.card.err', 'حدث خطأ في العرض: ' + e.message));
    }
  }
  App.route = route;
  App.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  // ================= لوحة القضايا =================
  const filters = { q: '', status: '', flag: '', showDeleted: false };
  function renderDashboard(v) {
    const S = App.S;
    const all = App.cases.filter((c) => !c.deleted);
    const infos = new Map(all.map((c) => [c, T.stageInfo(c, S)]));
    const count = (fn) => all.filter(fn).length;
    const stale = `راكدة ${S.staleDays || 14}+ يوم`;
    const kpis = [
      ['إجمالي القضايا', all.length, ''],
      ['المفتوحة', count((c) => !infos.get(c).closed), 'open'],
      ['المكتملة', count((c) => infos.get(c).closed), 'done'],
      ['متابعة متأخرة', count((c) => infos.get(c).flag === 'متابعة متأخرة'), 'late'],
      [stale, count((c) => infos.get(c).flag === stale), 'stale'],
      ['بانتظار رد / إجراء', count((c) => c.status === 'بانتظار رد/إجراء'), 'wait'],
    ];
    const kpiRow = h('div.kpis', kpis.map(([t, n, k]) => h('button.kpi.' + (k || 'all'), {
      type: 'button', on: { click: () => {
        filters.flag = k === 'late' ? 'متابعة متأخرة' : k === 'stale' ? stale : '';
        filters.status = k === 'wait' ? 'بانتظار رد/إجراء' : k === 'done' ? '__closed' : k === 'open' ? '__open' : '';
        App.route();
      } },
    }, h('b', String(n)), h('span', t))));

    const list = h('div.case-list');
    const draw = () => {
      list.innerHTML = '';
      const q = filters.q.trim();
      let rows = (filters.showDeleted ? App.cases.filter((c) => c.deleted) : all).filter((c) => {
        const inf = infos.get(c) || T.stageInfo(c, S);
        if (filters.status === '__closed' && !inf.closed) return false;
        if (filters.status === '__open' && inf.closed) return false;
        if (filters.status && !filters.status.startsWith('__') && c.status !== filters.status) return false;
        if (filters.flag && inf.flag !== filters.flag) return false;
        if (!q) return true;
        const hay = [c.caseNo, c.subject, c.referringBody, c.notes, ...App.live(c.parties).map((p) => p.name)].join(' ');
        return hay.includes(q);
      });
      rows.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      if (!rows.length) {
        list.append(h('div.empty', all.length ? 'لا توجد قضايا مطابقة.' : h('span', 'لا توجد قضايا بعد. ', h('a', { href: '#/new' }, 'أضف أول قضية'))));
        return;
      }
      rows.forEach((c) => {
        const inf = infos.get(c) || T.stageInfo(c, S);
        const names = App.live(c.parties).filter((p) => p.role === 'accused').map((p) => p.name).join('، ');
        const card = h('a.case-card', { href: '#/case/' + c.id + '/info' },
          h('div.cc-top', h('b.cc-no', c.caseNo || '(بدون رقم)'),
            h('span.flag.' + flagClass(inf.flag), inf.flag),
            c.priority === 'عالية' ? h('span.flag.high', 'أولوية عالية') : null),
          h('div.cc-sub', c.subject || '—'),
          names ? h('div.cc-names', '👤 ' + names) : null,
          h('div.cc-bottom',
            h('span', 'المرحلة: ', h('b', inf.current)),
            h('span.progress', h('i', { style: { width: inf.percent + '%' } })),
            h('span.muted', inf.percent + '%'),
            inf.lastDate ? h('span.muted', 'آخر إجراء: ' + U.hijri(inf.lastDate) + 'هـ') : null));
        if (filters.showDeleted) {
          card.removeAttribute('href');
          card.append(App.btn('استعادة', (e) => { e.preventDefault(); c.deleted = false; App.touch(c); App.route(); }, 'small'));
        }
        list.append(card);
      });
    };

    const search = h('input.search', { type: 'search', placeholder: 'بحث برقم المعاملة أو الموضوع أو الاسم…', value: filters.q });
    search.addEventListener('input', () => { filters.q = search.value; draw(); });
    const statusSel = h('select', h('option', { value: '' }, 'كل الحالات'), h('option', { value: '__open' }, 'المفتوحة'), h('option', { value: '__closed' }, 'المكتملة'),
      T.STATUSES.map((s) => h('option', { value: s }, s)));
    statusSel.value = filters.status;
    statusSel.addEventListener('change', () => { filters.status = statusSel.value; draw(); });
    const flagSel = h('select', h('option', { value: '' }, 'كل المؤشرات'), ['طبيعية', 'متابعة متأخرة', stale, 'مكتملة'].map((s) => h('option', { value: s }, s)));
    flagSel.value = filters.flag;
    flagSel.addEventListener('change', () => { filters.flag = flagSel.value; draw(); });
    const delCount = App.cases.filter((c) => c.deleted).length;

    v.append(
      h('div.page-head', h('h1', 'لوحة القضايا'), App.btn('+ قضية جديدة', () => App.go('#/new'))),
      kpiRow,
      h('div.toolbar', search, statusSel, flagSel,
        delCount ? h('label.chk', h('input', { type: 'checkbox', checked: filters.showDeleted, on: { change: (e) => { filters.showDeleted = e.target.checked; draw(); } } }), ` المحذوفة (${delCount})`) : null),
      list);
    draw();
  }
  function flagClass(f) {
    if (f === 'مكتملة') return 'done';
    if (f === 'متابعة متأخرة') return 'late';
    if (f.startsWith('راكدة')) return 'stale';
    return 'ok';
  }
  App.flagClass = flagClass;

  // ================= الإعدادات =================
  function renderSettings(v) {
    const S = App.S;
    const F = (label, obj, key, o = {}) => App.field(label, obj, key, { ...o, settings: true, item: false });
    const preview = h('div.lh-preview');
    const drawPreview = () => {
      preview.innerHTML = Doc.toHTML({ header: { no: '4705320559/1', date: U.hijri(new Date()), subject: 'محضر سماع أقوال', attach: 'لا يوجد' },
        blocks: [{ t: 'p', text: 'نص تجريبي لمعاينة شكل الخطاب بالخط والحجم المختارين.' }] }, S);
    };

    // أسطر الترويسة
    const linesBox = h('div.lines');
    const drawLines = () => {
      linesBox.innerHTML = '';
      S.headerLines.forEach((line, i) => {
        const inp = h('input', { value: line, on: { input: (e) => { S.headerLines[i] = e.target.value; App.saveSettingsSoon(); drawPreview(); } } });
        linesBox.append(h('div.line-row', inp,
          App.btn('▲', () => { if (i) { [S.headerLines[i - 1], S.headerLines[i]] = [S.headerLines[i], S.headerLines[i - 1]]; App.saveSettingsSoon(); drawLines(); drawPreview(); } }, 'icon'),
          App.btn('▼', () => { if (i < S.headerLines.length - 1) { [S.headerLines[i + 1], S.headerLines[i]] = [S.headerLines[i], S.headerLines[i + 1]]; App.saveSettingsSoon(); drawLines(); drawPreview(); } }, 'icon'),
          App.btn('✕', () => { S.headerLines.splice(i, 1); App.saveSettingsSoon(); drawLines(); drawPreview(); }, 'icon danger')));
      });
      linesBox.append(App.btn('+ إضافة سطر', () => { S.headerLines.push(''); App.saveSettingsSoon(); drawLines(); }, 'small secondary'));
    };
    drawLines();

    const logoIn = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async () => {
      const f = logoIn.files[0]; if (!f) return;
      S.logo = await shrinkImage(f, 400); App.saveSettingsSoon(); drawPreview(); logoIn.value = '';
    } } });

    const onPrev = { onChange: drawPreview };
    const sec = (title, ...kids) => h('section.card.settings-sec', h('h2', title), ...kids);

    // الصياغات
    const textLabels = {
      statementIntro: 'محضر سماع الأقوال: الافتتاحية', statementCharge: 'محضر سماع الأقوال: الإحاطة بالمخالفة', statementClose: 'محضر سماع الأقوال: الخاتمة',
      witnessIntro: 'محضر الشاهد: الافتتاحية', witnessCharge: 'محضر الشاهد: التنبيه', witnessClose: 'محضر الشاهد: الخاتمة',
      confrontationIntro: 'محضر المواجهة: الافتتاحية', confrontationClose: 'محضر المواجهة: الخاتمة',
      generalRecord: 'المحضر العام', closingRecord: 'محضر إقفال التحقيق',
      ackCharge: 'إقرار الإحاطة بالمخالفة', ackNoMore: 'إقرار عدم وجود أقوال أخرى', ackNotice: 'إقرار التبليغ', ackFree: 'الإقرار العام',
      letterGreeting: 'الخطابات: المقدمة', letterClosing: 'الخطابات: الختام', letterOrder: 'خطاب طلب أمر التحقيق', letterSummon: 'خطاب المراجعة (الاستدعاء)',
      letterBio: 'خطاب طلب النبذة والسوابق', letterCover: 'خطاب التغطية', letterFree: 'الخطاب العام', reportOpening: 'التقرير النهائي: الافتتاحية',
    };
    const texts = h('div.texts', Object.keys(textLabels).map((k) => h('div.text-item',
      F(textLabels[k], S.texts, k, { type: 'textarea', rows: 4, full: true }),
      App.btn('استعادة الأصل', (e) => { S.texts[k] = T.DEFAULT_SETTINGS.texts[k]; e.target.closest('.text-item').querySelector('textarea').value = S.texts[k]; App.saveSettingsSoon(); }, 'small ghost'))));
    const chips = h('div.chips', T.VAR_HELP.map((k) => h('button.chip', { type: 'button', title: 'نسخ', on: { click: () => U.copy('{' + k + '}') } }, '{' + k + '}')));

    // بنك الأسئلة
    const bank = h('div.bank');
    const drawBank = () => {
      bank.innerHTML = '';
      S.questionBank.forEach((x, i) => bank.append(h('div.line-row',
        h('input.cat', { value: x.cat, placeholder: 'التصنيف', on: { input: (e) => { x.cat = e.target.value; App.saveSettingsSoon(); } } }),
        h('input', { value: x.q, placeholder: 'السؤال', on: { input: (e) => { x.q = e.target.value; App.saveSettingsSoon(); } } }),
        App.btn('✕', () => { S.questionBank.splice(i, 1); App.saveSettingsSoon(); drawBank(); }, 'icon danger'))));
      bank.append(App.btn('+ سؤال', () => { S.questionBank.push({ cat: 'الموضوع', q: '' }); App.saveSettingsSoon(); drawBank(); }, 'small secondary'));
    };
    drawBank();

    // الأرقام
    const contacts = h('div.contacts');
    const drawContacts = () => {
      contacts.innerHTML = '';
      S.contacts.forEach((x, i) => contacts.append(h('div.line-row',
        h('input', { value: x.name, placeholder: 'الاسم', on: { input: (e) => { x.name = e.target.value; App.saveSettingsSoon(); } } }),
        h('input', { value: x.phone, placeholder: '05xxxxxxxx', dir: 'ltr', on: { input: (e) => { x.phone = e.target.value; App.saveSettingsSoon(); } } }),
        App.btn('✕', () => { S.contacts.splice(i, 1); App.saveSettingsSoon(); drawContacts(); }, 'icon danger'))));
      contacts.append(App.btn('+ رقم', () => { S.contacts.push({ name: '', phone: '' }); App.saveSettingsSoon(); drawContacts(); }, 'small secondary'));
    };
    drawContacts();

    v.append(
      h('div.page-head', h('h1', 'الإعدادات')),
      sec('الترويسة',
        h('div.grid2',
          h('div', h('span.lbl', 'أسطر الترويسة (يمين الصفحة، تحت بعض)'), linesBox),
          h('div',
            h('span.lbl', 'الشعار (أعلى الوسط)'),
            h('div.logo-row', S.logo ? h('img.logo-thumb', { src: S.logo }) : h('span.muted', 'لا يوجد شعار'),
              App.btn(S.logo ? 'تغيير الشعار' : 'رفع الشعار', () => logoIn.click(), 'small'), logoIn,
              S.logo ? App.btn('حذف', () => { S.logo = ''; App.saveSettingsSoon(); App.route(); }, 'small ghost') : null),
            h('span.lbl', 'مسميات الحقول (يسار الصفحة)'),
            h('div.grid2.tight',
              F('الرقم', S.leftLabels, 'no', onPrev), F('التاريخ', S.leftLabels, 'date', onPrev),
              F('الموضوع', S.leftLabels, 'subject', onPrev), F('المشفوعات', S.leftLabels, 'attach', onPrev)),
            h('div.grid2.tight',
              F('الخط', S, 'font', onPrev), F('حجم خط النص', S, 'fontSize', { type: 'number', ...onPrev }),
              F('حجم خط الترويسة', S, 'headerFontSize', { type: 'number', ...onPrev })))),
        h('span.lbl', 'معاينة'), preview),
      sec('بيانات الشعبة والتوقيعات',
        h('div.grid2',
          F('اسم الشعبة', S, 'unit'), F('مكان التحقيق (يظهر في المحاضر)', S, 'place'),
          F('المخاطب الافتراضي في الخطابات', S, 'recipient'), F('عدد أيام الركود للتنبيه', S, 'staleDays', { type: 'number' })),
        h('h3', 'الضابط المحقق'),
        h('div.grid3', F('الاسم', S.investigator, 'name'), F('الرتبة', S.investigator, 'rank'), F('الصفة في التوقيع', S.investigator, 'title')),
        h('h3', 'رئيس الشعبة (يعتمد التقرير النهائي ويوقّع الخطابات)'),
        h('div.grid3', F('الاسم', S.chief, 'name'), F('الرتبة', S.chief, 'rank'), F('المنصب', S.chief, 'title'))),
      sec('صياغات المستندات',
        h('p.note', 'المتغيرات بين القوسين { } تُستبدل تلقائياً ببيانات القضية. اضغط على أي متغير لنسخه:'), chips, texts),
      sec('بنك الأسئلة', h('p.note', 'تظهر هذه الأسئلة عند كتابة المحاضر لتختار منها بسرعة.'), bank),
      Auth.settingsSection(),
      sec('أرقام الإرسال (واتساب / رسائل)', contacts),
      sec('التخزين',
        h('p', 'الحالي: ', h('b', Store.label())),
        h('div.row.wrap',
          Store.supportsFolder ? App.btn('اختيار مجلد آخر', async () => {
            try { await Store.pickFolder(); App.load(); U.toast('تم تغيير المجلد'); } catch (e) { if (e.name !== 'AbortError') U.toast(e.message, 'err'); }
          }, 'secondary') : null,
          Store.mode !== 'browser' ? App.btn('التحويل إلى الحفظ داخل المتصفح', async () => {
            if (!(await U.confirm('سيعمل البرنامج من بيانات المتصفح، ولن تظهر قضايا المجلد إلا بعد العودة إليه. هل تريد المتابعة؟'))) return;
            await Store.useBrowser(); App.load();
          }, 'ghost') : null),
        h('p.note', 'لنقل القضايا بين المجلد والمتصفح أو بين الكمبيوتر والجوال استخدم «نقل البيانات».')));
    drawPreview();
  }

  async function shrinkImage(file, max) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  // ================= نقل البيانات (تصدير / استيراد) =================
  App.exportCases = async function (cases, withFiles, withSettings) {
    const files = {};
    if (withFiles) {
      for (const c of cases) {
        for (const a of App.live(c.attachments)) {
          const blob = await Store.getFile(c, 'مرفقات', a.file);
          if (blob) files[`${c.id}/${a.file}`] = await U.readFileAsDataURL(blob);
        }
      }
    }
    const payload = {
      app: 'tahqiq', kind: 'export', version: 1, exportedAt: U.now(),
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'جوال' : 'كمبيوتر',
      cases, files, settings: withSettings ? App.S : undefined,
    };
    const name = `تصدير_${cases.length === 1 ? U.safeName(cases[0].caseNo || 'قضية') : cases.length + '_قضايا'}_${U.hijri(new Date()).replace(/\//g, '-')}.tahqiq.json`;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && /Mobile|Android|iPhone/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'ملف نقل - إجراءات التحقيق' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    U.download(name, blob);
    U.toast('تم إنشاء ملف التصدير');
  };

  /** دمج عنصرين بنفس المعرف: الأحدث تعديلاً يفوز */
  function mergeArr(a, b) {
    const map = new Map((a || []).map((x) => [x.id, x]));
    for (const x of b || []) {
      const old = map.get(x.id);
      if (!old || (x.updatedAt || '') > (old.updatedAt || '')) map.set(x.id, x);
    }
    return [...map.values()];
  }
  App.importPayload = async function (data) {
    if (!data || data.app !== 'tahqiq' || !Array.isArray(data.cases)) throw new Error('الملف ليس ملف نقل من البرنامج');
    let added = 0, merged = 0;
    for (const inc of data.cases.map(App.normalizeCase)) {
      let cur = App.cases.find((c) => c.id === inc.id) || (inc.caseNo && App.cases.find((c) => c.caseNo === inc.caseNo && !c.deleted));
      if (!cur) {
        const c = { ...inc }; delete c.folder;
        App.cases.push(c); cur = c; added++;
      } else {
        const newer = (inc.updatedAt || '') > (cur.updatedAt || '');
        const keep = { id: cur.id, folder: cur.folder };
        const arrays = ['parties', 'events', 'docs', 'attachments'].reduce((o, k) => (o[k] = mergeArr(cur[k], inc[k]), o), {});
        if (newer) Object.assign(cur, inc);
        Object.assign(cur, arrays, keep);
        if (inc.report && (!cur.report || (inc.report.updatedAt || '') > (cur.report.updatedAt || ''))) cur.report = inc.report;
        if (inc.index && (!cur.index || (inc.index.updatedAt || '') > (cur.index.updatedAt || ''))) cur.index = inc.index;
        merged++;
      }
      await Store.saveCase(cur);
      for (const a of inc.attachments || []) {
        const url = data.files && data.files[`${inc.id}/${a.file}`];
        if (url && !(await Store.getFile(cur, 'مرفقات', a.file))) await Store.putFile(cur, 'مرفقات', a.file, U.dataURLToBlob(url));
      }
    }
    return { added, merged };
  };

  function renderTransfer(v) {
    const live = App.cases.filter((c) => !c.deleted);
    const chosen = new Set();
    const withFiles = h('input', { type: 'checkbox', checked: true });
    const withSettings = h('input', { type: 'checkbox' });
    const list = h('div.pick-list', live.map((c) => h('label.chk', h('input', { type: 'checkbox', on: { change: (e) => e.target.checked ? chosen.add(c) : chosen.delete(c) } }),
      ` ${c.caseNo || '(بدون رقم)'} — ${c.subject || ''}`)));
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: async () => {
      const f = fileIn.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const r = await App.importPayload(data);
        if (data.settings && await U.confirm('الملف يحتوي على إعدادات (ترويسة وصياغات). هل تريد استبدال إعداداتك الحالية بها؟')) {
          App.S = mergeSettings(data.settings); await Store.saveSettings(App.S);
        }
        U.toast(`تم الاستيراد: ${r.added} قضية جديدة، ${r.merged} قضية دُمجت`);
        App.route();
      } catch (e) { U.toast('تعذر الاستيراد: ' + e.message, 'err'); }
      fileIn.value = '';
    } } });

    v.append(
      h('div.page-head', h('h1', 'نقل البيانات')),
      h('section.card',
        h('h2', 'تصدير'),
        h('p.note', 'يُنشئ ملفاً واحداً تنقله إلى جهاز آخر (الجوال أو كمبيوتر) ثم تستورده هناك. القضايا تُربط برقم المعاملة، فإذا كانت موجودة تُدمج إجراءاتها ويُؤخذ الأحدث تعديلاً.'),
        h('label.chk', h('input', { type: 'checkbox', on: { change: (e) => list.querySelectorAll('input').forEach((i) => { i.checked = e.target.checked; i.dispatchEvent(new Event('change')); }) } }), ' تحديد الكل'),
        list,
        h('label.chk', withFiles, ' تضمين المرفقات (يكبّر حجم الملف)'),
        h('label.chk', withSettings, ' تضمين الإعدادات (الترويسة والصياغات والشعار)'),
        h('div.row.wrap',
          App.btn('تصدير المحدد', () => { if (!chosen.size) return U.toast('اختر قضية واحدة على الأقل', 'err'); App.exportCases([...chosen], withFiles.checked, withSettings.checked); }),
          App.btn('نسخة احتياطية كاملة', () => App.exportCases(live, true, true), 'secondary'))),
      h('section.card',
        h('h2', 'استيراد'),
        h('p.note', 'اختر ملف التصدير (ينتهي بـ .tahqiq.json).'),
        App.btn('اختيار ملف للاستيراد', () => fileIn.click()), fileIn));
  }

  global.App = App;
  document.addEventListener('DOMContentLoaded', () => App.start());
  // العمل بدون إنترنت للنسخة المنشورة فقط؛ من file:// على الكمبيوتر لا يُسجَّل شيء
  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})(window);
