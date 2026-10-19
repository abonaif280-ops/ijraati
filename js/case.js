/* صفحة القضية: البيانات، الأطراف، الإجراءات، المستندات، المرفقات، التقرير النهائي، الفهرس */
(function (global) {
  'use strict';
  const { h } = U;
  const F = (...a) => App.field(...a);
  const live = (a) => App.live(a);
  const pname = (p) => p ? `${p.rank ? p.rank + '/ ' : ''}${p.name}` : '';

  const TABS = [
    ['info', 'البيانات'], ['parties', 'الأطراف'], ['events', 'الإجراءات'], ['docs', 'المحاضر والمستندات', 'المحاضر'],
    ['attachments', 'المرفقات'], ['report', 'التقرير النهائي', 'التقرير'], ['index', 'فهرس المعاملة', 'الفهرس'],
  ];

  function render(v, c, tab, sub) {
    const S = App.S;
    const inf = T.stageInfo(c, S);
    const tracker = h('div.tracker', T.STAGES.map((s, i) => h('button.stage' + (inf.done[i] ? '.done' : '') + (!inf.closed && s.label === inf.current ? '.current' : ''), {
      type: 'button', title: inf.done[i] ? 'تم' : 'إضافة هذا الإجراء',
      on: { click: () => eventDialog(c, null, { type: s.ev }) },
    }, h('i', inf.done[i] ? '✓' : String(i + 1)), h('span', s.label))));

    v.append(
      h('div.case-head',
        h('div',
          h('a.back', { href: '#/' }, '→ القضايا'),
          h('h1', c.caseNo || 'قضية جديدة', h('span.flag.' + App.flagClass(inf.flag), inf.flag)),
          h('div.muted', c.subject || '')),
        h('div.row.wrap',
          App.btn('مشاركة ملخص', () => Share.open(caseSummary(c), 'ملخص القضية', S), 'secondary small'),
          App.btn('تصدير القضية', () => App.exportCases([c], true, false), 'secondary small'),
          App.btn('حذف', async () => {
            if (!(await U.confirm('نقل القضية إلى المحذوفات؟ يمكن استعادتها من لوحة القضايا.'))) return;
            c.deleted = true; App.touch(c); App.go('#/');
          }, 'ghost small danger'))),
      tracker,
      h('nav.tabs', TABS.map(([k, t, short]) => h('a' + (k === tab || (tab === 'doc' && k === 'docs') ? '.active' : ''), { href: `#/case/${c.id}/${k}` },
        short ? [h('span.t-long', t), h('span.t-short', short)] : t,
        k === 'parties' ? badge(live(c.parties).length) : k === 'events' ? badge(live(c.events).length) : k === 'docs' ? badge(live(c.docs).length) : k === 'attachments' ? badge(live(c.attachments).length) : null))));

    // في الجوال: إظهار التبويب الحالي داخل شريط التبويبات المتحرك أفقياً
    const act = v.querySelector('.tabs a.active');
    if (act) requestAnimationFrame(() => act.scrollIntoView({ block: 'nearest', inline: 'center' }));
    const body = h('div.tab-body'); v.append(body);
    ({ info: tabInfo, parties: tabParties, events: tabEvents, docs: tabDocs, attachments: tabAttachments, report: tabReport, index: tabIndex, doc: docEditor }[tab] || tabInfo)(body, c, sub);
  }
  const badge = (n) => n ? h('span.badge', String(n)) : null;

  function caseSummary(c) {
    const inf = T.stageInfo(c, App.S);
    const last = T.eventsSorted(c).filter((e) => !e.deleted).pop();
    return [
      `القضية رقم: ${c.caseNo || ''}`,
      c.subject ? `الموضوع: ${c.subject}` : '',
      c.referringBody ? `الجهة المحيلة: ${c.referringBody}` : '',
      c.order && c.order.no ? `أمر التحقيق: ${c.order.no} وتاريخ ${c.order.dateH || ''}هـ` : '',
      live(c.parties).length ? 'الأطراف:\n' + live(c.parties).map((p) => `- ${T.ROLES[p.role]}: ${pname(p)}`).join('\n') : '',
      `المرحلة الحالية: ${inf.current} (${inf.percent}%)`,
      last ? `آخر إجراء: ${last.type} بتاريخ ${U.hijri(last.date)}هـ` : '',
      c.followNext ? `الإجراء القادم: ${c.followNext}` : '',
    ].filter(Boolean).join('\n');
  }

  // ================= البيانات =================
  function tabInfo(b, c) {
    const S = App.S;
    const group = (t, ...k) => h('section.card', h('h2', t), h('div.grid3', ...k));
    b.append(
      group('بيانات المعاملة',
        F('رقم المعاملة', c, 'caseNo', { dir: 'ltr', placeholder: '4705320559/1' }),
        F('تاريخ المعاملة (هجري)', c, 'txnDateH', { type: 'hijri' }),
        F('تاريخ الإحالة', c, 'referralDate', { type: 'date' }),
        F('نوع الإحالة', c, 'referralType', { type: 'select', options: T.REFERRAL_TYPES }),
        F('الجهة المحيلة', c, 'referringBody'),
        F('الأولوية', c, 'priority', { type: 'select', options: T.PRIORITIES }),
        F('الحالة', c, 'status', { type: 'select', options: T.STATUSES })),
      h('section.card', h('h2', 'الموضوع'),
        F('موضوع القضية', c, 'subject', { full: true, placeholder: 'مثال: فقدان العينة المرفوعة من موقع الحادثة' }),
        F('المخالفة المنسوبة (تظهر في الإحاطة والإقرارات)', c, 'charge', { type: 'textarea', rows: 2, full: true })),
      group('خطاب الإحالة',
        F('صاحب الخطاب', c.referral, 'from', { placeholder: S.recipient }),
        F('رقم الخطاب', c.referral, 'no', { dir: 'ltr' }),
        F('تاريخ الخطاب (هجري)', c.referral, 'dateH', { type: 'hijri' })),
      group('أمر التحقيق',
        F('رقم الأمر', c.order, 'no', { dir: 'ltr' }),
        F('تاريخ الأمر (هجري)', c.order, 'dateH', { type: 'hijri' }),
        F('مصدر الأمر', c.order, 'issuer')),
      group('المتابعة',
        F('الإجراء القادم', c, 'followNext', { type: 'textarea', rows: 2, wide: true }),
        F('موعد المتابعة', c, 'followDate', { type: 'date' })),
      h('section.card', h('h2', 'الوقائع والنتيجة'),
        F('الوقائع / ملاحظات (تُنقل إلى التقرير النهائي)', c, 'notes', { type: 'textarea', rows: 5, full: true }),
        F('النتيجة / القرار النهائي', c, 'result', { type: 'textarea', rows: 3, full: true }),
        F('مسار المعاملة / ملاحظة', c, 'path', { full: true })));
  }

  // ================= الأطراف =================
  function tabParties(b, c) {
    const list = h('div.party-list');
    const draw = () => {
      list.innerHTML = '';
      const ps = live(c.parties);
      if (!ps.length) list.append(h('div.empty', 'أضف المحقق معهم والشهود. بياناتهم تُعبّأ تلقائياً في المحاضر والخطابات.'));
      ps.forEach((p) => {
        const actions = p.role === 'accused'
          ? [['محضر سماع أقوال', 'statement'], ['إقرار إحاطة', 'ackCharge'], ['خطاب مراجعة', 'letterSummon']]
          : [['محضر سماع شاهد', 'witness'], ['إقرار', 'ackFree']];
        list.append(h('section.card.party',
          h('div.party-head',
            h('span.role.' + p.role, T.ROLES[p.role]),
            h('b', pname(p) || 'طرف جديد'),
            h('div.row.wrap', actions.map(([t, type]) => App.btn(t, () => createDoc(c, type, [p.id]), 'small secondary')),
              App.btn('حذف', async () => { if (await U.confirm(`حذف ${p.name || 'الطرف'}؟`)) { p.deleted = true; p.updatedAt = U.now(); App.touch(c); draw(); } }, 'small ghost danger'))),
          h('div.grid3',
            F('الصفة', p, 'role', { type: 'select', options: Object.entries(T.ROLES), onChange: draw }),
            F('الاسم الرباعي', p, 'name'),
            F('الرتبة / الصفة الوظيفية', p, 'rank'),
            F('الرقم العسكري', p, 'militaryNo', { dir: 'ltr' }),
            F('رقم الهوية', p, 'nationalId', { dir: 'ltr' }),
            F('جهة العمل', p, 'unit'),
            F('الجوال', p, 'phone', { type: 'tel', dir: 'ltr' }),
            F('السوابق', p, 'record', { placeholder: 'لا يوجد' })),
          F('النبذة الوظيفية', p, 'bio', { type: 'textarea', rows: 2, full: true }),
          F('مختصر الأقوال (يُستخدم في التقرير إذا لم يوجد محضر)', p, 'summary', { type: 'textarea', rows: 2, full: true })));
      });
    };
    const add = (role) => { c.parties.push({ id: U.uid(), role, name: '', rank: '', unit: '', updatedAt: U.now() }); App.touch(c); draw(); list.lastChild.scrollIntoView({ behavior: 'smooth' }); };
    b.append(h('div.row.wrap.tab-actions', App.btn('+ محقق معه', () => add('accused')), App.btn('+ شاهد', () => add('witness'), 'secondary')), list);
    draw();
  }

  // ================= الإجراءات =================
  function eventText(c, e) {
    const p = c.parties.find((x) => x.id === e.partyId);
    return [
      `الإجراء: ${e.type}`, `التاريخ: ${U.hijri(e.date)}هـ`, `القضية: ${c.caseNo || ''}${c.subject ? ' - ' + c.subject : ''}`,
      e.details ? `التفاصيل: ${e.details}` : '', e.ref ? `رقم الخطاب / المرجع: ${e.ref}` : '',
      p ? `الطرف: ${pname(p)}` : e.who ? `الجهة / الشخص: ${e.who}` : '',
      e.result ? `النتيجة: ${e.result}` : '', e.nextDate ? `المتابعة القادمة: ${U.hijri(e.nextDate)}هـ` : '', e.notes ? `ملاحظات: ${e.notes}` : '',
    ].filter(Boolean).join('\n');
  }

  function eventDialog(c, e, preset) {
    const isNew = !e;
    const ev = e ? { ...e } : { id: U.uid(), date: U.todayISO(), type: 'اتصال / متابعة', details: '', ref: '', who: '', partyId: '', result: '', nextDate: '', notes: '', ...(preset || {}) };
    const S = App.S;
    const keep = App.current; App.current = null; // لا نحفظ أثناء الكتابة في النافذة
    const body = h('div.grid2',
      F('التاريخ', ev, 'date', { type: 'date' }),
      F('نوع الإجراء', ev, 'type', { type: 'select', options: T.EVENT_TYPES }),
      F('التفاصيل', ev, 'details', { type: 'textarea', rows: 3, full: true }),
      F('رقم الخطاب / المرجع', ev, 'ref', { dir: 'ltr' }),
      F('الطرف', ev, 'partyId', { type: 'select', options: [['', '—'], ...live(c.parties).map((p) => [p.id, pname(p)])] }),
      F('الجهة / الشخص ذو العلاقة', ev, 'who'),
      F('النتيجة / المخرجات', ev, 'result', { type: 'textarea', rows: 2, full: true }),
      F('تاريخ المتابعة القادمة', ev, 'nextDate', { type: 'date' }),
      F('ملاحظات', ev, 'notes'));
    const m = U.modal(isNew ? 'إضافة إجراء' : 'تعديل إجراء', body, [
      App.btn('حفظ', () => {
        ev.updatedAt = U.now();
        if (isNew) c.events.push(ev); else Object.assign(e, ev);
        if (ev.nextDate && (!c.followDate || ev.nextDate > U.todayISO())) c.followDate = ev.nextDate;
        App.current = keep; App.touch(c); m.close(); App.route();
      }),
      App.btn('إلغاء', () => m.close(), 'secondary'),
    ], { onClose: () => { App.current = keep; } });
  }

  function tabEvents(b, c) {
    const rows = T.eventsSorted(c).filter((e) => !e.deleted);
    const table = h('div.events');
    if (!rows.length) table.append(h('div.empty', 'لا توجد إجراءات. سجّل كل حركة على القضية: خطاب، مراجعة، اتصال، تحقيق، متابعة.'));
    rows.forEach((e) => {
      const p = c.parties.find((x) => x.id === e.partyId);
      const atts = live(c.attachments).filter((a) => a.eventId === e.id);
      table.append(h('div.event',
        h('div.ev-date', h('b', U.hijri(e.date)), h('small', U.dayName(e.date))),
        h('div.ev-main',
          h('div.ev-type', e.type, e.ref ? h('span.muted', ` — مرجع: ${e.ref}`) : null),
          e.details ? h('div', e.details) : null,
          p || e.who ? h('div.muted', p ? pname(p) : e.who) : null,
          e.result ? h('div.ev-result', '← ' + e.result) : null,
          atts.length ? h('div.muted', '📎 ' + atts.map((a) => a.title || a.name).join('، ')) : null),
        h('div.ev-actions',
          App.btn('قراءة / مشاركة', () => Share.open(eventText(c, e), 'قراءة إجراء', App.S), 'small secondary'),
          App.btn('تعديل', () => eventDialog(c, e), 'small ghost'),
          App.btn('✕', async () => { if (await U.confirm('حذف هذا الإجراء؟')) { e.deleted = true; e.updatedAt = U.now(); App.touch(c); App.route(); } }, 'small ghost danger'))));
    });
    b.append(h('div.row.wrap.tab-actions', App.btn('+ إضافة إجراء', () => eventDialog(c))), table);
  }

  /** يسجل إجراءً تلقائياً عند إصدار مستند (مرة واحدة لكل مستند) */
  function logEvent(c, holder, type, details, date, ref) {
    if (!type || holder.eventId && c.events.some((e) => e.id === holder.eventId && !e.deleted)) return;
    const e = { id: U.uid(), date: date || U.todayISO(), type, details, ref: ref || '', updatedAt: U.now() };
    c.events.push(e); holder.eventId = e.id; App.touch(c);
    U.toast(`سُجّل في الإجراءات: ${type}`);
  }

  // ================= المستندات =================
  function createDoc(c, type, partyIds) {
    const Tp = T.DOC_TYPES[type];
    const candidates = live(c.parties).filter((p) => Tp.parties === 'one-accused' ? p.role === 'accused' : Tp.parties === 'one-witness' ? p.role === 'witness' : true);
    const make = (ids) => {
      const d = T.newDoc(type, c, App.S, ids);
      c.docs.push(d); App.touch(c);
      App.go(`#/case/${c.id}/doc/${d.id}`);
    };
    if (partyIds) return make(partyIds);
    if (Tp.parties.startsWith('one')) {
      const pool = candidates.length ? candidates : live(c.parties);
      if (!pool.length) { U.toast('أضف الطرف أولاً من تبويب «الأطراف»', 'err'); return App.go(`#/case/${c.id}/parties`); }
      if (pool.length === 1) return make([pool[0].id]);
      const m = U.modal('اختر الطرف', h('div.pick-list', pool.map((p) => App.btn(`${T.ROLES[p.role]}: ${pname(p)}`, () => { m.close(); make([p.id]); }, 'secondary'))));
      return;
    }
    if (Tp.parties === 'many') return make(live(c.parties).filter((p) => p.role === 'accused').map((p) => p.id));
    make([]);
  }

  function docFileName(c, d) {
    const ps = (d.partyIds || []).map((id) => (c.parties.find((p) => p.id === id) || {}).name).filter(Boolean);
    return `${d.title}${ps.length ? ' - ' + ps.join('، ') : ''} - ${U.hijri(d.date).replace(/\//g, '-')}`;
  }

  async function saveWord(c, model, base, onSaved) {
    try {
      const blob = await Doc.toDocx(model, App.S);
      const name = U.safeName(base) + '.docx';
      if (Store.mode === 'folder') await Store.putFile(c, 'صادر', name, blob);
      U.download(name, blob);
      U.toast(Store.mode === 'folder' ? 'حُفظ في مجلد القضية/صادر وتم تنزيله' : 'تم تنزيل ملف Word');
      if (onSaved) onSaved();
    } catch (e) { console.error(e); U.toast('تعذر إنشاء ملف Word: ' + e.message, 'err'); }
  }
  function printModel(model) {
    const fr = h('iframe', { style: { position: 'fixed', width: '0', height: '0', border: '0', left: '0', bottom: '0' } });
    document.body.append(fr);
    const css = [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join('');
    fr.contentDocument.open();
    fr.contentDocument.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${model.title || ''}</title>${css}</head><body class="print-body">${Doc.toHTML(model, App.S)}</body></html>`);
    fr.contentDocument.close();
    const go = () => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 2000); };
    if (fr.contentDocument.readyState === 'complete') setTimeout(go, 300); else fr.onload = () => setTimeout(go, 300);
  }
  function tabDocs(b, c) {
    const groups = {};
    Object.entries(T.DOC_TYPES).forEach(([k, t]) => (groups[t.group] = groups[t.group] || []).push([k, t]));
    const creators = h('section.card', h('h2', 'إنشاء مستند جديد'),
      h('div.creators', Object.entries(groups).map(([g, items]) => h('div.creator-group', h('h3', g),
        items.map(([k, t]) => App.btn(t.name, () => createDoc(c, k), 'secondary small'))))));
    const docs = live(c.docs).sort((a, b2) => (b2.date || '').localeCompare(a.date || '') || (b2.createdAt || '').localeCompare(a.createdAt || ''));
    const list = h('section.card', h('h2', 'مستندات القضية'),
      docs.length ? h('div.doc-list', docs.map((d) => {
        const ps = (d.partyIds || []).map((id) => c.parties.find((p) => p.id === id)).filter(Boolean);
        return h('div.doc-row',
          h('a.doc-title', { href: `#/case/${c.id}/doc/${d.id}` }, h('b', d.title), ps.length ? h('span.muted', ' — ' + ps.map(pname).join('، ')) : null),
          h('span.muted', U.hijri(d.date) + 'هـ'),
          h('span.group-tag', T.DOC_TYPES[d.type].group),
          h('div.row',
            App.btn('Word', () => saveWord(c, T.build(c, d, App.S), docFileName(c, d), () => logEvent(c, d, T.DOC_TYPES[d.type].event, docFileName(c, d), d.date, d.no)), 'small'),
            App.btn('طباعة', () => printModel(T.build(c, d, App.S)), 'small secondary'),
            App.btn('مشاركة', () => Share.open(Doc.toText(T.build(c, d, App.S)), d.title, App.S), 'small secondary')));
      })) : h('div.empty', 'لا توجد مستندات بعد.'));
    b.append(creators, list);
  }

  // ---------- محرر المستند ----------
  function docEditor(b, c, docId) {
    const d = c.docs.find((x) => x.id === docId);
    if (!d) { b.append(h('div.card', 'المستند غير موجود.')); return; }
    const S = App.S;
    const Tp = T.DOC_TYPES[d.type];
    d.edited = d.edited || {};
    const preview = h('div.preview');
    let pt = null;
    const refresh = () => { clearTimeout(pt); pt = setTimeout(() => { preview.innerHTML = Doc.toHTML(T.build(c, d, S), S); }, 250); };
    const form = h('div.doc-form');
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);

    const textKeys = ['intro', 'mid', 'close', 'body', 'greeting', 'closing'];
    const areas = {};
    const regen = (force) => {
      const fresh = { ...d }; T.fillTexts(fresh, c, S);
      textKeys.forEach((k) => {
        if (fresh[k] === undefined) return;
        if (force || !d.edited[k]) { d[k] = fresh[k]; if (areas[k]) areas[k].querySelector('textarea').value = d[k]; }
      });
      if (force) d.edited = {};
      d.updatedAt = U.now(); App.touch(c); refresh();
    };
    const TX = (label, key, rows) => {
      const f = F(label, d, key, { type: 'textarea', rows: rows || 3, full: true, onChange: () => { d.edited[key] = true; } });
      areas[key] = f; return f;
    };

    // الأطراف
    let partyCtl = null;
    if (Tp.parties !== 'none') {
      const pool = live(c.parties);
      if (Tp.parties.startsWith('one')) {
        partyCtl = h('label.field', h('span.lbl', 'الطرف'), h('span.ctl', (() => {
          const sel = h('select', h('option', { value: '' }, '—'), pool.map((p) => h('option', { value: p.id }, `${T.ROLES[p.role]}: ${pname(p)}`)));
          sel.value = (d.partyIds || [])[0] || '';
          sel.addEventListener('change', () => { d.partyIds = sel.value ? [sel.value] : []; regen(false); });
          return sel;
        })()));
      } else {
        partyCtl = h('div.field.full', h('span.lbl', 'الأطراف'), h('div.chk-row', pool.map((p) => h('label.chk',
          h('input', { type: 'checkbox', checked: (d.partyIds || []).includes(p.id), on: { change: (e) => {
            d.partyIds = (d.partyIds || []).filter((x) => x !== p.id); if (e.target.checked) d.partyIds.push(p.id);
            regen(false); drawQA();
          } } }), ' ' + pname(p)))));
      }
    }

    // الأسئلة والأجوبة
    const qaBox = h('div.qa-list');
    const drawQA = () => {
      if (!Tp.qa) return;
      qaBox.innerHTML = '';
      const parties = (d.partyIds || []).map((id) => c.parties.find((p) => p.id === id)).filter(Boolean);
      d.qa.forEach((x, i) => {
        const move = (k) => { const j = i + k; if (j < 0 || j >= d.qa.length) return; [d.qa[i], d.qa[j]] = [d.qa[j], d.qa[i]]; touchDoc(); drawQA(); };
        qaBox.append(h('div.qa-item',
          h('div.qa-head', h('b', `س${i + 1}`),
            d.type === 'confrontation' ? (() => {
              const sel = h('select', h('option', { value: '' }, 'الموجّه إليه'), parties.map((p) => h('option', { value: pname(p) }, pname(p))));
              sel.value = x.who || ''; sel.addEventListener('change', () => { x.who = sel.value; touchDoc(); });
              return sel;
            })() : null,
            h('span.spacer'),
            App.btn('▲', () => move(-1), 'icon'), App.btn('▼', () => move(1), 'icon'),
            App.btn('✕', () => { d.qa.splice(i, 1); touchDoc(); drawQA(); }, 'icon danger')),
          F('السؤال', x, 'q', { type: 'textarea', rows: 2, full: true, onChange: () => { d.updatedAt = U.now(); } }),
          F('الجواب', x, 'a', { type: 'textarea', rows: 3, full: true, onChange: () => { d.updatedAt = U.now(); } })));
      });
      refresh();
    };
    const touchDoc = () => { d.updatedAt = U.now(); App.touch(c); refresh(); };
    const addQ = (q) => { d.qa.push({ id: U.uid(), q: q || '', a: '' }); touchDoc(); drawQA(); const t = qaBox.lastChild && qaBox.lastChild.querySelector(q ? 'textarea:last-of-type' : 'textarea'); if (t) t.focus(); };
    const bankDialog = () => {
      const cats = {};
      S.questionBank.forEach((x) => (cats[x.cat || 'عام'] = cats[x.cat || 'عام'] || []).push(x.q));
      const m = U.modal('بنك الأسئلة', h('div.bank-pick', Object.entries(cats).map(([cat, qs]) => h('div',
        h('h3', cat), qs.map((q) => App.btn(q, () => { addQ(q); U.toast('أُضيف السؤال'); }, 'secondary small block'))))),
        [App.btn('تم', () => m.close())]);
    };

    const meta = h('section.card', h('h2', Tp.name),
      h('div.grid3',
        F('العنوان', d, 'title'),
        F('التاريخ', d, 'date', { type: 'date', onChange: () => regen(false) }),
        F('الرقم (الترويسة)', d, 'no', { dir: 'ltr' }),
        F('الموضوع (الترويسة)', d, 'subject'),
        F('المشفوعات', d, 'attach'),
        Tp.qa || Tp.intro ? F('ساعة البدء', d, 'start', { type: 'time', onChange: () => regen(false) }) : null,
        Tp.qa ? F('ساعة الانتهاء', d, 'end', { type: 'time', onChange: () => regen(false) }) : null,
        Tp.letter ? F('المخاطب', d, 'to', { onChange: () => regen(false) }) : null,
        Tp.letter ? F('الموقّع', d, 'signer', { type: 'select', options: [['chief', 'رئيس الشعبة'], ['investigator', 'المحقق']] }) : null,
        partyCtl));

    const texts = h('section.card', h('div.sec-head', h('h2', 'النص'),
      App.btn('إعادة توليد النص من القالب', async () => { if (await U.confirm('سيُستبدل النص الحالي بالصياغة من الإعدادات وبيانات القضية الحالية. متابعة؟')) regen(true); }, 'small ghost')));
    if (Tp.letter) texts.append(TX('المقدمة', 'greeting', 2), TX('نص الخطاب', 'body', 8), TX('الختام', 'closing', 1));
    else if (Tp.ack) texts.append(TX('نص الإقرار', 'body', 6));
    else {
      if (d.intro !== undefined) texts.append(TX('الافتتاحية', 'intro', 5));
      if (d.mid !== undefined) texts.append(TX('الإحاطة / التنبيه', 'mid', 3));
      if (d.type === 'general' || d.type === 'closing') texts.append(F('نص إضافي', d, 'text', { type: 'textarea', rows: 5, full: true }));
    }

    const qaSec = Tp.qa ? h('section.card', h('div.sec-head', h('h2', 'الأسئلة والأجوبة'),
      h('div.row.wrap', App.btn('+ سؤال', () => addQ()), App.btn('من بنك الأسئلة', bankDialog, 'secondary'))), qaBox,
      h('div.row.wrap', App.btn('+ سؤال', () => addQ(), 'small'))) : null;
    const closeSec = d.close !== undefined ? h('section.card', TX('الخاتمة', 'close', 3)) : null;

    const actions = h('div.doc-actions',
      h('a.back', { href: `#/case/${c.id}/docs` }, '→ المستندات'),
      App.btn('حفظ Word', () => saveWord(c, T.build(c, d, S), docFileName(c, d), () => logEvent(c, d, Tp.event, docFileName(c, d), d.date, d.no))),
      App.btn('طباعة / PDF', () => printModel(T.build(c, d, S)), 'secondary'),
      App.btn('قراءة / مشاركة', () => Share.open(Doc.toText(T.build(c, d, S)), d.title, S), 'secondary'),
      App.btn('حذف', async () => { if (await U.confirm('حذف هذا المستند؟')) { d.deleted = true; d.updatedAt = U.now(); App.touch(c); App.go(`#/case/${c.id}/docs`); } }, 'ghost danger'));

    form.append(meta, texts, qaSec, closeSec);
    b.append(actions, h('div.editor', form, h('div.preview-col', h('div.preview-label', 'معاينة'), preview)));
    drawQA(); refresh();
  }

  // ================= المرفقات =================
  async function addFiles(c, files) {
    for (const f of files) {
      const id = U.uid();
      const a = { id, file: `${id}_${U.safeName(f.name)}`, name: f.name, title: f.name.replace(/\.[^.]+$/, ''), type: f.type, size: f.size, date: U.todayISO(), eventId: '', text: '', updatedAt: U.now() };
      try { await Store.putFile(c, 'مرفقات', a.file, f); c.attachments.push(a); }
      catch (e) { U.toast(`تعذر حفظ ${f.name}: ${e.message}`, 'err'); }
    }
    App.touch(c); App.route();
  }
  async function viewAttachment(c, a) {
    const blob = await Store.getFile(c, 'مرفقات', a.file);
    if (!blob) return U.toast('الملف غير موجود في التخزين', 'err');
    const url = URL.createObjectURL(blob);
    let viewer;
    const type = a.type || blob.type || '';
    if (type.startsWith('image/')) viewer = h('img.att-view', { src: url });
    else if (type === 'application/pdf') viewer = h('iframe.att-view', { src: url });
    else if (type.startsWith('text/')) viewer = h('pre.att-text', await blob.text());
    else viewer = h('p', 'لا يمكن عرض هذا النوع داخل البرنامج. استخدم «تنزيل / فتح».');
    const keep = App.current;
    U.modal(a.title || a.name, h('div', viewer,
      F('نص المرفق / ملخصه (للنسخ والمشاركة والباركود)', a, 'text', { type: 'textarea', rows: 4, full: true, onChange: () => App.touch(keep) })),
    [
      App.btn('قراءة / مشاركة النص', () => Share.open(`${a.title || a.name}\n${a.text || ''}`.trim(), 'مشاركة مرفق', App.S), 'secondary'),
      App.btn('تنزيل / فتح', () => { window.open(url, '_blank'); }, 'secondary'),
    ], { wide: true, onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
  }
  function tabAttachments(b, c) {
    const fileIn = h('input', { type: 'file', multiple: true, hidden: true, on: { change: () => { addFiles(c, [...fileIn.files]); fileIn.value = ''; } } });
    const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, on: { change: () => { addFiles(c, [...camIn.files]); camIn.value = ''; } } });
    const drop = h('div.drop', 'اسحب الملفات وأفلتها هنا، أو', App.btn('اختر ملفات', () => fileIn.click(), 'small'),
      /Mobile|Android|iPhone/i.test(navigator.userAgent) ? App.btn('📷 تصوير مستند', () => camIn.click(), 'small secondary') : null, fileIn, camIn);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(c, [...e.dataTransfer.files]); });

    const atts = live(c.attachments);
    const evOpts = [['', 'غير مرتبط بإجراء'], ...T.eventsSorted(c).filter((e) => !e.deleted).map((e) => [e.id, `${U.hijri(e.date)} - ${e.type}`])];
    b.append(h('section.card', drop),
      h('section.card', h('h2', 'مرفقات القضية'),
        atts.length ? h('div.att-list', atts.map((a) => h('div.att',
          h('div.att-icon', (a.type || '').startsWith('image/') ? '🖼' : a.type === 'application/pdf' ? '📄' : '📎'),
          h('div.att-main',
            h('div.grid3',
              F('اسم المرفق', a, 'title'),
              F('التاريخ', a, 'date', { type: 'date' }),
              F('الإجراء المرتبط', a, 'eventId', { type: 'select', options: evOpts })),
            h('div.muted', `${a.name} — ${U.bytesLabel(a.size || 0)}`)),
          h('div.ev-actions',
            App.btn('عرض / قراءة', () => viewAttachment(c, a), 'small'),
            App.btn('مشاركة', () => Share.open(`${a.title || a.name}\n${a.text || ''}`.trim(), 'مشاركة مرفق', App.S), 'small secondary'),
            App.btn('✕', async () => {
              if (!(await U.confirm(`حذف المرفق «${a.title || a.name}»؟`))) return;
              a.deleted = true; a.updatedAt = U.now(); await Store.removeFile(c, 'مرفقات', a.file); App.touch(c); App.route();
            }, 'small ghost danger'))))) : h('div.empty', 'لا توجد مرفقات.')));
  }

  // ================= التقرير النهائي =================
  function tabReport(b, c) {
    const S = App.S;
    if (!c.report) { c.report = T.defaultReport(c, S); App.touch(c); }
    const r = c.report; r.summaries = r.summaries || {};
    const preview = h('div.preview');
    let pt = null;
    const refresh = () => { clearTimeout(pt); pt = setTimeout(() => { preview.innerHTML = Doc.toHTML(T.buildReport(c, r, S), S); }, 250); };
    const form = h('div.doc-form');
    form.addEventListener('input', refresh); form.addEventListener('change', refresh);
    const FR = (l, k, o = {}) => F(l, r, k, o);

    const sums = live(c.parties).map((p) => {
      const f = F(`ملخص أقوال ${T.ROLES[p.role]}: ${pname(p)}`, r.summaries, p.id, { type: 'textarea', rows: 4, full: true, item: false, onChange: () => { r.updatedAt = U.now(); } });
      const fromRecords = App.btn('توليد من المحاضر', () => {
        const recs = live(c.docs).filter((d) => (d.type === 'statement' || d.type === 'witness' || d.type === 'confrontation') && (d.partyIds || []).includes(p.id));
        if (!recs.length) return U.toast('لا توجد محاضر لهذا الطرف', 'err');
        const text = recs.map((d) => (d.qa || []).filter((x) => x.a && (!x.who || x.who === pname(p))).map((x) => x.a.trim()).join(' ')).join('\n');
        r.summaries[p.id] = text; f.querySelector('textarea').value = text; r.updatedAt = U.now(); App.touch(c); refresh();
      }, 'small ghost');
      return h('div', f, fromRecords);
    });

    form.append(
      h('section.card', h('h2', 'بيانات التقرير'),
        h('div.grid3', FR('التاريخ', 'date', { type: 'date' }), FR('الرقم', 'no', { dir: 'ltr' }), FR('المشفوعات', 'attach')),
        h('div.row.wrap',
          h('label.chk', h('input', { type: 'checkbox', checked: r.showBio !== false, on: { change: (e) => { r.showBio = e.target.checked; r.updatedAt = U.now(); App.touch(c); refresh(); } } }), ' إظهار جدول النبذة الوظيفية'),
          h('label.chk', h('input', { type: 'checkbox', checked: r.showEvents !== false, on: { change: (e) => { r.showEvents = e.target.checked; r.updatedAt = U.now(); App.touch(c); refresh(); } } }), ' إظهار جدول الإجراءات'))),
      h('section.card', h('h2', 'المحتوى'),
        FR('الافتتاحية', 'opening', { type: 'textarea', rows: 3, full: true }),
        FR('الوقائع', 'facts', { type: 'textarea', rows: 6, full: true })),
      h('section.card', h('h2', 'ملخص الأقوال'), sums.length ? sums : h('div.empty', 'أضف الأطراف أولاً.')),
      h('section.card', h('h2', 'الرأي'),
        FR('المناقشة والتحليل (تحليل الأدلة ومواطن التعارض)', 'analysis', { type: 'textarea', rows: 6, full: true }),
        FR('النتيجة', 'result', { type: 'textarea', rows: 3, full: true }),
        FR('المرئيات والتوصيات', 'recommendations', { type: 'textarea', rows: 4, full: true })));

    const model = () => T.buildReport(c, r, S);
    const base = () => `التقرير النهائي - ${c.caseNo ? U.safeName(c.caseNo) : ''} - ${U.hijri(r.date).replace(/\//g, '-')}`;
    b.append(
      h('div.doc-actions',
        App.btn('حفظ Word', () => saveWord(c, model(), base(), () => logEvent(c, r, 'إعداد تقرير القضية', 'إعداد التقرير النهائي', r.date, r.no))),
        App.btn('طباعة / PDF', () => printModel(model()), 'secondary'),
        App.btn('قراءة / مشاركة', () => Share.open(Doc.toText(model()), 'التقرير النهائي', S), 'secondary'),
        App.btn('إعادة البناء من بيانات القضية', async () => {
          if (!(await U.confirm('سيُعاد إنشاء التقرير من بيانات القضية، وتُفقد تعديلاتك عليه. متابعة؟'))) return;
          c.report = T.defaultReport(c, S); App.touch(c); App.route();
        }, 'ghost')),
      h('div.editor', form, h('div.preview-col', h('div.preview-label', 'معاينة'), preview)));
    refresh();
  }

  // ================= فهرس المعاملة =================
  function tabIndex(b, c) {
    const S = App.S;
    if (!c.index) { c.index = T.defaultIndex(c); App.touch(c); }
    const ix = c.index;
    const preview = h('div.preview');
    const refresh = () => { preview.innerHTML = Doc.toHTML(T.buildIndex(c, ix, S), S); };
    const rowsBox = h('div.index-rows');
    const touch = () => { ix.updatedAt = U.now(); App.touch(c); refresh(); };
    const draw = () => {
      rowsBox.innerHTML = '';
      ix.rows.forEach((r, i) => rowsBox.append(h('div.line-row',
        h('b.num', String(i + 1)),
        h('input', { value: r.name, placeholder: 'المستند', on: { input: (e) => { r.name = e.target.value; touch(); } } }),
        h('input.date', { type: 'date', value: r.date || '', on: { change: (e) => { r.date = e.target.value; touch(); } } }),
        h('input.pages', { type: 'number', min: 1, value: r.pages, title: 'عدد الأوراق', on: { input: (e) => { r.pages = e.target.value; touch(); } } }),
        App.btn('▲', () => { if (i) { [ix.rows[i - 1], ix.rows[i]] = [ix.rows[i], ix.rows[i - 1]]; touch(); draw(); } }, 'icon'),
        App.btn('▼', () => { if (i < ix.rows.length - 1) { [ix.rows[i + 1], ix.rows[i]] = [ix.rows[i], ix.rows[i + 1]]; touch(); draw(); } }, 'icon'),
        App.btn('✕', () => { ix.rows.splice(i, 1); touch(); draw(); }, 'icon danger'))));
      rowsBox.append(App.btn('+ سطر', () => { ix.rows.push({ id: U.uid(), name: '', date: '', pages: '1' }); touch(); draw(); }, 'small secondary'));
    };
    draw();
    const model = () => T.buildIndex(c, ix, S);
    b.append(
      h('div.doc-actions',
        App.btn('حفظ Word', () => saveWord(c, model(), `فهرس المعاملة - ${U.safeName(c.caseNo || '')}`, () => logEvent(c, ix, 'فهرسة المعاملة', 'فهرسة المعاملة', U.todayISO()))),
        App.btn('طباعة / PDF', () => printModel(model()), 'secondary'),
        App.btn('إعادة البناء من القضية', async () => {
          if (!(await U.confirm('سيُعاد بناء الفهرس من الإجراءات والمستندات والمرفقات. متابعة؟'))) return;
          c.index = T.defaultIndex(c); App.touch(c); App.route();
        }, 'ghost')),
      h('div.editor',
        h('div.doc-form', h('section.card', h('h2', 'محتويات المعاملة'), h('p.note', 'رتّب المستندات وعدّل عدد أوراق كل منها، وأرقام الصفحات تُحسب تلقائياً.'),
          F('تاريخ الفهرس', ix, 'date', { type: 'date', onChange: refresh }), rowsBox)),
        h('div.preview-col', h('div.preview-label', 'معاينة'), preview)));
    refresh();
  }

  global.CaseView = { render, createDoc, saveWord, printModel, eventText };
})(window);
