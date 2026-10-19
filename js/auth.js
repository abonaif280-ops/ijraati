/* قفل الدخول: اسم مستخدم وكلمة مرور لكل جهاز. تُحفظ كلمة المرور مُجزّأة (SHA-256 مع ملح) لا نصاً صريحاً */
(function (global) {
  'use strict';
  const { h } = U;
  const KEY = 'tahqiq.auth', SESSION = 'tahqiq.session';
  const DEFAULT_USER = 'admin', DEFAULT_PASS = '123456';
  const ROUNDS = 3000;

  // SHA-256 مكتوب هنا ليعمل بنفس النتيجة في كل الأجهزة، ومنها فتح الملف مباشرة من الفلاشة
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(total - 4, len * 8); dv.setUint32(total - 8, Math.floor(len / 0x20000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = W[i - 16] + s0 + W[i - 7] + s1;
      }
      let [a, b, c, d, e, f, g, k] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (k + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += k;
    }
    const out = new Uint8Array(32); const ov = new DataView(out.buffer);
    H.forEach((x, i) => ov.setUint32(i * 4, x));
    return out;
  }
  const enc = new TextEncoder();
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  function hash(salt, user, pass) {
    let d = sha256(enc.encode(salt + '\u0000' + user + '\u0000' + pass));
    const s = enc.encode(salt);
    for (let i = 0; i < ROUNDS; i++) { const m = new Uint8Array(d.length + s.length); m.set(d); m.set(s, d.length); d = sha256(m); }
    return hex(d);
  }

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } }
  const Auth = {};
  Auth.isDefault = () => !read();
  Auth.user = () => (read() || {}).user || DEFAULT_USER;
  Auth.check = (user, pass) => {
    const rec = read();
    if (!rec) return user === DEFAULT_USER && pass === DEFAULT_PASS;
    return user === rec.user && hash(rec.salt, user, pass) === rec.hash;
  };
  Auth.ok = () => { try { return sessionStorage.getItem(SESSION) === '1'; } catch (_) { return false; } };
  Auth.lock = () => { try { sessionStorage.removeItem(SESSION); } catch (_) {} location.reload(); };
  Auth.change = (user, pass) => {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(KEY, JSON.stringify({ user, salt, hash: hash(salt, user, pass) }));
  };

  /** شاشة الدخول؛ تستدعي onIn بعد الدخول الصحيح */
  Auth.render = function (onIn) {
    document.body.innerHTML = '';
    const user = h('input', { type: 'text', autocomplete: 'username', dir: 'ltr', required: true, autocapitalize: 'off', spellcheck: false });
    const pass = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', required: true });
    const msg = h('p.login-err');
    let fails = 0;
    const form = h('form.login.card', { on: { submit: (e) => {
      e.preventDefault();
      const btn = form.querySelector('button'); btn.disabled = true;
      setTimeout(() => {
        if (Auth.check(user.value.trim(), pass.value)) {
          try { sessionStorage.setItem(SESSION, '1'); } catch (_) {}
          onIn();
          return;
        }
        fails++; pass.value = ''; pass.focus();
        msg.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        // تأخير يزيد مع تكرار الخطأ
        setTimeout(() => { btn.disabled = false; }, Math.min(fails, 10) * 400);
      }, 30);
    } } },
    h('h1', 'إجراءاتي'),
    h('label.field', h('span.lbl', 'اسم المستخدم'), h('span.ctl', user)),
    h('label.field', h('span.lbl', 'كلمة المرور'), h('span.ctl', pass)),
    msg,
    h('button.big', { type: 'submit' }, 'دخول'));
    document.body.append(form);
    user.focus();
  };

  /** قسم الإعدادات: تغيير اسم المستخدم وكلمة المرور */
  Auth.settingsSection = function () {
    const cur = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr' });
    const user = h('input', { type: 'text', value: Auth.user(), autocomplete: 'username', dir: 'ltr', autocapitalize: 'off', spellcheck: false });
    const p1 = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr' });
    const p2 = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr' });
    const row = (label, input) => h('label.field', h('span.lbl', label), h('span.ctl', input));
    const save = () => {
      const u = user.value.trim();
      if (!Auth.check(Auth.user(), cur.value)) return U.toast('كلمة المرور الحالية غير صحيحة', 'err');
      if (!u) return U.toast('اكتب اسم المستخدم', 'err');
      if (p1.value.length < 6) return U.toast('كلمة المرور الجديدة 6 خانات على الأقل', 'err');
      if (p1.value !== p2.value) return U.toast('كلمتا المرور غير متطابقتين', 'err');
      try { Auth.change(u, p1.value); } catch (e) { return U.toast('تعذر الحفظ: ' + e.message, 'err'); }
      cur.value = p1.value = p2.value = '';
      U.toast('تم تغيير بيانات الدخول');
    };
    return h('section.card.settings-sec', h('h2', 'الدخول'),
      Auth.isDefault() ? h('div.callout', 'ما زالت بيانات الدخول الافتراضية مستخدمة (', h('bdi', { dir: 'ltr', style: { whiteSpace: 'nowrap' } }, 'admin / 123456'), '). غيّرها الآن.') : null,
      h('p.note', 'بيانات الدخول خاصة بهذا الجهاز وهذا المتصفح، ولا تنتقل مع ملفات التصدير. إذا نسيتها فلن تستطيع الدخول، فاحتفظ بنسخة احتياطية من بياناتك.'),
      h('div.grid2', row('كلمة المرور الحالية', cur), row('اسم المستخدم', user), row('كلمة المرور الجديدة', p1), row('تأكيد كلمة المرور الجديدة', p2)),
      h('div.row.wrap', App.btn('حفظ بيانات الدخول', save)));
  };

  global.Auth = Auth;
})(window);
