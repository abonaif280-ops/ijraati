/* التخزين: مجلد على الجهاز (Edge/Chrome على الكمبيوتر) أو داخل المتصفح (الجوال)
   الواجهة نفسها في الحالتين، فبقية البرنامج لا يهمه أين تُحفظ البيانات. */
(function (global) {
  'use strict';

  const CASES_DIR = 'القضايا';
  const SETTINGS_FILE = 'الإعدادات.json';
  const CASE_FILE = 'القضية.json';

  // ---------- IndexedDB ----------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('tahqiq', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('kv');
        d.createObjectStore('cases', { keyPath: 'id' });
        d.createObjectStore('files');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }
  const kvGet = (k) => idb('kv', 'readonly', (s) => s.get(k));
  const kvSet = (k, v) => idb('kv', 'readwrite', (s) => s.put(v, k));

  // ---------- مساعدات المجلد ----------
  async function readJSON(dir, name) {
    try {
      const fh = await dir.getFileHandle(name);
      return JSON.parse(await (await fh.getFile()).text());
    } catch (e) {
      if (e.name === 'NotFoundError') return null;
      throw e;
    }
  }
  async function writeFile(dir, name, data) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }
  const folderOf = (c) => c.folder || U.safeName(c.caseNo || c.id);

  const Store = {
    mode: null,          // 'folder' | 'browser'
    dir: null,
    folderName: '',
    supportsFolder: 'showDirectoryPicker' in window,

    /** يحاول استعادة المجلد المحفوظ. يرجع: 'ready' | 'needs-permission' | 'needs-setup' */
    async init() {
      const pref = await kvGet('mode');
      if (pref === 'browser') { this.mode = 'browser'; return 'ready'; }
      if (pref === 'folder' && this.supportsFolder) {
        const h = await kvGet('dir');
        if (h) {
          this.dir = h; this.folderName = h.name;
          const p = await h.queryPermission({ mode: 'readwrite' });
          if (p === 'granted') { this.mode = 'folder'; return 'ready'; }
          return 'needs-permission';
        }
      }
      return 'needs-setup';
    },
    async reconnect() {
      const p = await this.dir.requestPermission({ mode: 'readwrite' });
      if (p !== 'granted') throw new Error('لم يُمنح الإذن بالوصول للمجلد');
      this.mode = 'folder';
    },
    async pickFolder() {
      const h = await window.showDirectoryPicker({ id: 'tahqiq-data', mode: 'readwrite' });
      this.dir = h; this.folderName = h.name; this.mode = 'folder';
      await kvSet('dir', h); await kvSet('mode', 'folder');
    },
    async useBrowser() {
      this.mode = 'browser'; this.dir = null;
      await kvSet('mode', 'browser');
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
    },
    label() {
      return this.mode === 'folder' ? `المجلد: ${this.folderName}` : 'التخزين داخل المتصفح';
    },

    // ---------- الإعدادات ----------
    async loadSettings() {
      if (this.mode === 'folder') return readJSON(this.dir, SETTINGS_FILE);
      return kvGet('settings');
    },
    async saveSettings(s) {
      if (this.mode === 'folder') return writeFile(this.dir, SETTINGS_FILE, JSON.stringify(s, null, 2));
      return kvSet('settings', s);
    },

    // ---------- القضايا ----------
    async listCases() {
      if (this.mode === 'browser') return (await idb('cases', 'readonly', (s) => s.getAll())) || [];
      const out = [];
      const root = await this.dir.getDirectoryHandle(CASES_DIR, { create: true });
      for await (const [name, h] of root.entries()) {
        if (h.kind !== 'directory') continue;
        try {
          const c = await readJSON(h, CASE_FILE);
          if (c) { c.folder = name; out.push(c); }
        } catch (e) { console.warn('تعذرت قراءة', name, e); }
      }
      return out;
    },
    async saveCase(c) {
      c.updatedAt = U.now();
      if (this.mode === 'browser') return idb('cases', 'readwrite', (s) => s.put(c));
      if (!c.folder) c.folder = await this._uniqueFolder(U.safeName(c.caseNo || c.id));
      const d = await this._caseDir(c, true);
      await writeFile(d, CASE_FILE, JSON.stringify(c, null, 2));
    },
    async _uniqueFolder(base) {
      const root = await this.dir.getDirectoryHandle(CASES_DIR, { create: true });
      let name = base, i = 2;
      for (;;) {
        try { await root.getDirectoryHandle(name); name = `${base} (${i++})`; }
        catch (_) { return name; }
      }
    },
    async _caseDir(c, create) {
      const root = await this.dir.getDirectoryHandle(CASES_DIR, { create: true });
      return root.getDirectoryHandle(folderOf(c), { create: !!create });
    },

    // ---------- الملفات (مرفقات / صادر) ----------
    async putFile(c, sub, name, blob) {
      if (this.mode === 'browser') return idb('files', 'readwrite', (s) => s.put(blob, `${c.id}/${sub}/${name}`));
      const d = await (await this._caseDir(c, true)).getDirectoryHandle(sub, { create: true });
      await writeFile(d, name, blob);
    },
    async getFile(c, sub, name) {
      if (this.mode === 'browser') return idb('files', 'readonly', (s) => s.get(`${c.id}/${sub}/${name}`));
      try {
        const d = await (await this._caseDir(c)).getDirectoryHandle(sub);
        return await (await d.getFileHandle(name)).getFile();
      } catch (_) { return null; }
    },
    async removeFile(c, sub, name) {
      if (this.mode === 'browser') return idb('files', 'readwrite', (s) => s.delete(`${c.id}/${sub}/${name}`));
      try {
        const d = await (await this._caseDir(c)).getDirectoryHandle(sub);
        await d.removeEntry(name);
      } catch (_) {}
    },
  };

  global.Store = Store;
})(window);
