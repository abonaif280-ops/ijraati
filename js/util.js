/* أدوات عامة: التواريخ الهجرية، المعرفات، بناء عناصر الواجهة، التنبيهات */
(function (global) {
  'use strict';

  const U = {};

  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.now = () => new Date().toISOString();

  // ---------- التواريخ ----------
  // نحفظ التواريخ بصيغة ISO (yyyy-mm-dd) ونعرضها هجرياً (أم القرى)
  U.parseISO = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  U.toISO = (d) => {
    if (!d) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  U.todayISO = () => U.toISO(new Date());

  const hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',
    { year: 'numeric', month: '2-digit', day: '2-digit' });
  U.hijriParts = (d) => {
    const parts = hijriFmt.formatToParts(d);
    const g = (t) => +(parts.find((p) => p.type === t) || {}).value;
    return { y: g('year'), m: g('month'), d: g('day') };
  };
  /** تاريخ هجري نصي 1448/02/14 من تاريخ ISO أو Date */
  U.hijri = (v) => {
    const d = v instanceof Date ? v : U.parseISO(v);
    if (!d) return '';
    const h = U.hijriParts(d);
    return `${h.y}/${String(h.m).padStart(2, '0')}/${String(h.d).padStart(2, '0')}`;
  };
  /** تحويل هجري (1448/02/14) إلى ISO بالبحث حول تاريخ تقريبي */
  U.hijriToISO = (s) => {
    const m = String(s || '').replace(/[^\d/]/g, '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return '';
    const y = +m[1], mo = +m[2], da = +m[3];
    // تقدير: السنة الهجرية ≈ 354.367 يوماً، بداية 1 محرم 1 = 16/7/622م
    const approx = new Date(622, 6, 16 + Math.round((y - 1) * 354.367 + (mo - 1) * 29.53 + (da - 1)));
    for (let off = -40; off <= 40; off++) {
      const d = new Date(approx.getFullYear(), approx.getMonth(), approx.getDate() + off);
      const h = U.hijriParts(d);
      if (h.y === y && h.m === mo && h.d === da) return U.toISO(d);
    }
    return '';
  };
  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  U.dayName = (v) => {
    const d = v instanceof Date ? v : U.parseISO(v);
    return d ? DAYS[d.getDay()] : '';
  };
  U.daysBetween = (a, b) => {
    const da = U.parseISO(a), db = U.parseISO(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  };
  U.timeNow = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  /** 14:30 → 2:30 مساءً */
  U.time12 = (t) => {
    const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return t || '';
    let h = +m[1];
    const suf = h < 12 ? 'صباحاً' : 'مساءً';
    h = h % 12 || 12;
    return `${h}:${m[2]} ${suf}`;
  };

  // ---------- النصوص والقوالب ----------
  /** استبدال {متغير} بقيمته؛ المتغير غير المعروف يبقى كما هو ليظهر للمستخدم */
  U.fill = (tpl, vars) => String(tpl || '').replace(/\{([^{}]+)\}/g, (all, k) => {
    const v = vars[k.trim()];
    return v === undefined || v === null || v === '' ? '(......)' : String(v);
  });
  U.safeName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'بدون_اسم';
  U.normPhone = (s) => {
    let d = String(s || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');
    if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
    else if (/^5\d{8}$/.test(d)) d = '966' + d;
    return d;
  };
  U.bytesLabel = (n) => n < 1024 ? n + ' بايت' : n < 1048576 ? (n / 1024).toFixed(0) + ' ك.ب' : (n / 1048576).toFixed(1) + ' م.ب';

  // ---------- عناصر الواجهة ----------
  /** h('div.cls#id', {attrs, on:{click}}, ...children) */
  U.h = (sel, attrs, ...kids) => {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][^.#]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) m[2].replace(/([.#])([^.#]+)/g, (_, t, v) => {
      if (t === '.') el.classList.add(v); else el.id = v;
    });
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (k) => {
      if (k === null || k === undefined || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
  };

  U.toast = (msg, kind) => {
    let box = document.getElementById('toasts');
    if (!box) { box = U.h('div#toasts'); document.body.append(box); }
    const t = U.h('div.toast' + (kind ? '.' + kind : ''), msg);
    box.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  };

  /** نافذة حوار؛ تُرجع {close, el} */
  U.modal = (title, body, actions, opts) => {
    const back = U.h('div.modal-back');
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (opts && opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const box = U.h('div.modal' + (opts && opts.wide ? '.wide' : ''),
      U.h('div.modal-head', U.h('h3', title), U.h('button.icon', { title: 'إغلاق', on: { click: close } }, '✕')),
      U.h('div.modal-body', body),
      actions && actions.length ? U.h('div.modal-foot', actions) : null);
    back.append(box);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    return { close, el: box };
  };

  U.confirm = (msg) => new Promise((res) => {
    let done = false;
    const m = U.modal('تأكيد', U.h('p', msg), [
      U.h('button.danger', { on: { click: () => { done = true; m.close(); res(true); } } }, 'نعم'),
      U.h('button.secondary', { on: { click: () => m.close() } }, 'إلغاء'),
    ], { onClose: () => { if (!done) res(false); } });
  });

  U.download = (name, blob) => {
    const url = URL.createObjectURL(blob);
    const a = U.h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  U.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = U.h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    U.toast('تم النسخ');
  };

  U.readFileAsDataURL = (blob) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob);
  });
  U.dataURLToBlob = (url) => {
    const [head, b64] = url.split(',');
    const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };
  U.bytesToB64 = (bytes) => {
    let s = ''; const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  };
  U.b64ToBytes = (b64) => {
    const bin = atob(b64); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  };

  global.U = U;
})(window);
