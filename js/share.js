/* المشاركة: نسخ، واتساب، رسالة نصية، باركود QR (عادي أو مضغوط)، وقراءة الباركود بالكاميرا */
(function (global) {
  'use strict';
  const { h } = U;

  const PREFIX = 'TQ1:';          // باركود مضغوط خاص بالبرنامج
  const PLAIN_LIMIT = 1100;       // بايت: حد مريح لقراءة الباركود العادي بكاميرا الجوال
  const CHUNK = 1800;             // حروف لكل باركود عند التقسيم

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  // ---------- الضغط ----------
  async function deflate(text) {
    const s = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function inflate(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(await new Response(s).arrayBuffer());
  }
  const b64url = (bytes) => U.bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64url = (s) => U.b64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

  /** يحوّل النص إلى قائمة نصوص باركود */
  async function encode(text, mode) {
    if (mode === 'plain') return [text];
    const payload = b64url(await deflate(text));
    if (payload.length + PREFIX.length <= 2800) return [PREFIX + payload];
    const n = Math.ceil(payload.length / CHUNK);
    return Array.from({ length: n }, (_, i) => `${PREFIX}${i + 1}/${n}:${payload.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  /** يفك نص باركود واحد أو عدة أجزاء. يرجع {text} أو {need:[أرقام ناقصة]} */
  async function decode(parts) {
    const list = (Array.isArray(parts) ? parts : [parts]).map((s) => String(s).trim()).filter(Boolean);
    if (!list.length) return { text: '' };
    if (!list[0].startsWith(PREFIX)) return { text: list.join('\n') };
    const multi = list[0].slice(PREFIX.length).match(/^(\d+)\/(\d+):/);
    if (!multi) return { text: await inflate(unb64url(list[0].slice(PREFIX.length))) };
    const n = +multi[2]; const got = {};
    list.forEach((s) => { const m = s.slice(PREFIX.length).match(/^(\d+)\/(\d+):(.*)$/s); if (m) got[+m[1]] = m[3]; });
    const need = []; for (let i = 1; i <= n; i++) if (!got[i]) need.push(i);
    if (need.length) return { need, total: n };
    let all = ''; for (let i = 1; i <= n; i++) all += got[i];
    return { text: await inflate(unb64url(all)) };
  }

  // ---------- رسم الباركود ----------
  function qrCanvas(text, px) {
    const qr = qrcode(0, 'L'); qr.addData(text, 'Byte'); qr.make();
    const n = qr.getModuleCount(); const quiet = 4;
    const scale = Math.max(2, Math.floor((px || 420) / (n + quiet * 2)));
    const size = (n + quiet * 2) * scale;
    const c = h('canvas', { width: size, height: size, className: 'qr' });
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++)
      if (qr.isDark(r, col)) g.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
    return c;
  }

  // ---------- نافذة المشاركة ----------
  function open(text, title, settings) {
    const S = settings || {};
    const ta = h('textarea.share-text', { value: text, rows: 10 });
    const qrBox = h('div.qr-box');
    const info = h('div.note');
    let mode = new TextEncoder().encode(text).length <= PLAIN_LIMIT ? 'plain' : 'compressed';
    const modeSel = h('select', { on: { change: () => { mode = modeSel.value; renderQR(); } } },
      h('option', { value: 'plain' }, 'باركود عادي (تقرؤه أي كاميرا)'),
      h('option', { value: 'compressed' }, 'باركود مضغوط (يقرؤه البرنامج، لنص أطول)'));
    modeSel.value = mode;

    let timer = null;
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(renderQR, 400); });

    async function renderQR() {
      qrBox.innerHTML = '';
      const t = ta.value;
      const bytes = new TextEncoder().encode(t).length;
      if (mode === 'compressed' && typeof CompressionStream !== 'function') {
        info.textContent = 'المتصفح لا يدعم الضغط، استخدم الباركود العادي.'; return;
      }
      try {
        const codes = await encode(t, mode);
        if (mode === 'plain' && bytes > PLAIN_LIMIT)
          info.textContent = `النص طويل (${t.length} حرف)، وقد يصعب على الكاميرا قراءة الباركود العادي. جرّب «المضغوط» أو اختصر النص.`;
        else info.textContent = codes.length > 1
          ? `النص طويل فقُسّم على ${codes.length} باركود. امسحها بالترتيب من «قراءة باركود» في البرنامج.`
          : `${t.length} حرف — باركود واحد.`;
        codes.forEach((code, i) => {
          let cv;
          try { cv = qrCanvas(code, 380); } catch (e) { qrBox.append(h('div.err', 'النص أطول من سعة الباركود، اختصره أو استخدم المضغوط.')); return; }
          qrBox.append(h('figure.qr-fig', cv,
            h('figcaption', codes.length > 1 ? `جزء ${i + 1} من ${codes.length}` : '',
              h('button.small.secondary', { on: { click: () => cv.toBlob((b) => U.download(`باركود_${i + 1}.png`, b)) } }, 'حفظ الصورة'))));
        });
      } catch (e) { info.textContent = 'تعذر إنشاء الباركود: ' + e.message; }
    }

    // واتساب / رسالة نصية
    const phone = h('input', { type: 'tel', placeholder: '05xxxxxxxx', dir: 'ltr', className: 'phone' });
    const contacts = (S.contacts || []);
    const contactSel = contacts.length ? h('select', { on: { change: () => { phone.value = contactSel.value; } } },
      h('option', { value: '' }, 'اختر من الأرقام المحفوظة'),
      contacts.map((c) => h('option', { value: c.phone }, `${c.name} — ${c.phone}`))) : null;

    const wa = () => {
      const n = U.normPhone(phone.value);
      const url = `https://wa.me/${n}?text=${encodeURIComponent(ta.value)}`;
      window.open(url, '_blank', 'noopener');
    };
    const sms = () => {
      const n = U.normPhone(phone.value);
      location.href = `sms:${n ? '+' + n : ''}?body=${encodeURIComponent(ta.value)}`;
    };
    const nativeShare = navigator.share ? h('button.secondary', { on: { click: () => navigator.share({ title, text: ta.value }).catch(() => {}) } }, 'مشاركة…') : null;

    const body = h('div.share',
      h('label.lbl', 'النص (تقدر تعدّله قبل النسخ أو الإرسال أو إنشاء الباركود)'), ta,
      h('div.row.wrap',
        h('button', { on: { click: () => U.copy(ta.value) } }, '📋 نسخ النص'),
        nativeShare),
      h('fieldset', h('legend', 'إرسال'),
        h('div.row.wrap', phone, contactSel,
          h('button.wa', { on: { click: wa } }, 'واتساب'),
          h('button.secondary', { on: { click: sms } }, 'رسالة نصية')),
        h('div.note', 'يفتح واتساب أو تطبيق الرسائل والنص جاهز، والإرسال يكون بضغطتك أنت. اترك الرقم فارغاً لتختار جهة الاتصال من التطبيق.')),
      h('fieldset', h('legend', 'باركود'), modeSel, info, qrBox));
    U.modal(title || 'مشاركة', body, null, { wide: true });
    renderQR();
  }

  // ---------- قراءة الباركود ----------
  function scan(onText) {
    const video = h('video', { playsInline: true, muted: true, className: 'scan-video' });
    const status = h('div.note', 'وجّه الكاميرا نحو الباركود…');
    const out = h('textarea.share-text', { rows: 8, placeholder: 'سيظهر النص هنا. ويمكنك أيضاً لصق نص باركود مضغوط (يبدأ بـ TQ1:) ثم الضغط على «فك».' });
    const parts = [];
    let stream = null, stop = false, detector = null;

    const finish = async (raw) => {
      if (!raw || parts.includes(raw)) return;
      parts.push(raw);
      try {
        const r = await decode(parts);
        if (r.need) { status.textContent = `تمت قراءة ${r.total - r.need.length} من ${r.total}. امسح الجزء: ${r.need.join('، ')}`; return; }
        out.value = r.text; status.textContent = 'تمت القراءة ✓'; stopCam();
      } catch (e) { status.textContent = 'تعذر فك الباركود: ' + e.message; }
    };
    const stopCam = () => { stop = true; if (stream) stream.getTracks().forEach((t) => t.stop()); };

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream; await video.play();
        if ('BarcodeDetector' in window) {
          try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { detector = null; }
        }
        const cv = document.createElement('canvas'); const g = cv.getContext('2d', { willReadFrequently: true });
        const tick = async () => {
          if (stop) return;
          if (video.readyState >= 2) {
            try {
              if (detector) {
                const codes = await detector.detect(video);
                if (codes[0]) await finish(codes[0].rawValue);
              } else {
                cv.width = video.videoWidth; cv.height = video.videoHeight;
                g.drawImage(video, 0, 0);
                const img = g.getImageData(0, 0, cv.width, cv.height);
                const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
                if (code) await finish(code.binaryData && code.binaryData.length ? new TextDecoder().decode(new Uint8Array(code.binaryData)) : code.data);
              }
            } catch (_) {}
          }
          setTimeout(tick, 180);
        };
        tick();
      } catch (e) { status.textContent = 'تعذر تشغيل الكاميرا: ' + e.message + ' — يمكنك اختيار صورة الباركود بدلاً من ذلك.'; }
    }

    const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async () => {
      const f = fileIn.files[0]; if (!f) return;
      const img = await createImageBitmap(f);
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, cv.width, cv.height);
      const code = jsQR(d.data, d.width, d.height);
      if (code) await finish(code.binaryData && code.binaryData.length ? new TextDecoder().decode(new Uint8Array(code.binaryData)) : code.data);
      else status.textContent = 'لم يُعثر على باركود في الصورة.';
      fileIn.value = '';
    } } });

    const m = U.modal('قراءة باركود', h('div.share', video, status,
      h('div.row.wrap',
        h('button.secondary', { on: { click: () => fileIn.click() } }, 'من صورة'), fileIn,
        h('button.secondary', { on: { click: async () => {
          try { const r = await decode(out.value.split(/\s+/)); if (r.need) status.textContent = `ناقص الأجزاء: ${r.need.join('، ')}`; else out.value = r.text; }
          catch (e) { status.textContent = 'تعذر الفك: ' + e.message; }
        } } }, 'فك')),
      out,
      h('div.row.wrap',
        h('button', { on: { click: () => U.copy(out.value) } }, '📋 نسخ'),
        onText ? h('button.secondary', { on: { click: () => { onText(out.value); m.close(); } } }, 'استخدام النص') : null,
        h('button.secondary', { on: { click: () => { m.close(); open(out.value, 'مشاركة النص'); } } }, 'مشاركة / تعديل'))),
      null, { wide: true, onClose: stopCam });
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) startCam();
    else status.textContent = 'الكاميرا غير متاحة هنا. اختر صورة الباركود أو الصق النص.';
  }

  global.Share = { open, scan, encode, decode };
})(window);
