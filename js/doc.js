/* نموذج المستند الموحد ← ملف Word (.docx) أو معاينة HTML للطباعة.
   نموذج المستند:
   { header: {no, date, subject, attach} | null,
     blocks: [ {t:'title', text} | {t:'p', text, align, bold, size} | {t:'qa', n, q, a}
             | {t:'kv', rows:[[label, value]]} | {t:'table', head, rows, widths}
             | {t:'sig', cols:[{title, lines}]} | {t:'space'} | {t:'pagebreak'} ] }
   داخل النص: **عريض** وسطر جديد \n. */
(function (global) {
  'use strict';

  // ================= ZIP (بدون ضغط) =================
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function zip(files) { // files: [{name, data: Uint8Array}]
    const enc = new TextEncoder();
    const chunks = []; const central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name); const data = f.data; const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, a) => s + a.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)],
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ================= أدوات XML =================
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /** يقسم النص إلى مقاطع {text, bold} حسب **...** */
  function segments(text, bold) {
    const out = [];
    String(text == null ? '' : text).split('**').forEach((part, i) => {
      if (part) out.push({ text: part, bold: bold ? i % 2 === 0 : i % 2 === 1 });
    });
    return out;
  }

  function makeW(opts) {
    const font = esc(opts.font || 'Traditional Arabic');
    const base = Math.round((opts.fontSize || 16) * 2);
    const rPr = (o) => `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
      (o.bold ? '<w:b/><w:bCs/>' : '') +
      `<w:sz w:val="${o.sz || base}"/><w:szCs w:val="${o.sz || base}"/>` +
      (o.underline ? '<w:u w:val="single"/>' : '') + '<w:rtl/></w:rPr>';
    const run = (text, o) => String(text).split('\n').map((line, i) =>
      `<w:r>${rPr(o)}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join('');
    const JC = { center: 'center', justify: 'both', both: 'both' }; // اليمين هو الأصل في الفقرة العربية
    const p = (text, o = {}) => {
      const jc = JC[o.align] ? `<w:jc w:val="${JC[o.align]}"/>` : '';
      const sp = `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 60 : o.after}" w:line="${o.line || 264}" w:lineRule="auto"/>`;
      const ind = o.indent ? `<w:ind w:right="${o.indent}"/>` : '';
      const keep = o.keepNext ? '<w:keepNext/>' : '';
      const border = o.borderBottom ? '<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/></w:pBdr>' : '';
      const runs = segments(text, o.bold).map((s) => run(s.text, { ...o, bold: s.bold })).join('');
      const mark = o.sz ? `<w:rPr><w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/><w:rtl/></w:rPr>` : '<w:rPr><w:rtl/></w:rPr>';
      return `<w:p><w:pPr>${keep}${border}<w:bidi/>${sp}${ind}${jc}${mark}</w:pPr>${runs}</w:p>`;
    };
    const cell = (inner, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>` +
      (o.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="E7ECE8"/>' : '') +
      (o.vAlign ? `<w:vAlign w:val="${o.vAlign}"/>` : '') + `</w:tcPr>${inner || p('')}</w:tc>`;
    const table = (rows, widths, o = {}) => {
      const b = o.border ? 'single' : 'nil';
      const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map((k) => o.bottomRule && k === 'bottom' ? '<w:bottom w:val="single" w:sz="12" w:space="0" w:color="000000"/>'
          : `<w:${k} w:val="${b}" w:sz="4" w:space="0" w:color="000000"/>`).join('');
      const total = widths.reduce((a, x) => a + x, 0);
      return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/>` +
        `<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
        `<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
        `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
        rows.map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c.xml, widths[i], c)).join('')}</w:tr>`).join('') +
        '</w:tbl>';
    };
    return { p, table, base, font };
  }

  const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134;
  const CONTENT_W = PAGE_W - 2 * MARGIN;

  function bodyXML(doc, W) {
    const out = [];
    let qaNum = 0;
    for (const b of doc.blocks) {
      switch (b.t) {
        case 'title':
          out.push(W.p(b.text, { align: 'center', bold: true, underline: true, sz: W.base + 4, after: 160, before: 80, keepNext: true }));
          break;
        case 'subtitle':
          out.push(W.p(b.text, { bold: true, sz: W.base + 1, before: 120, after: 60, keepNext: true }));
          break;
        case 'p':
          out.push(W.p(b.text, { align: b.align || 'justify', bold: b.bold, sz: b.size ? b.size * 2 : undefined, indent: b.indent }));
          break;
        case 'qa': {
          qaNum = b.n || qaNum + 1;
          out.push(W.p(`**س${qaNum}/** ${b.q || ''}`, { align: 'justify', keepNext: true, after: 20 }));
          out.push(W.p(`**ج${qaNum}/** ${b.a || ''}`, { align: 'justify', after: 120 }));
          break;
        }
        case 'kv': {
          const lw = Math.round(CONTENT_W * 0.28);
          out.push(W.table(b.rows.map(([k, v]) => [
            { xml: W.p(k, { bold: true, after: 0 }), shade: true },
            { xml: W.p(v || '', { after: 0 }) },
          ]), [lw, CONTENT_W - lw], { border: true }));
          out.push(W.p('', { after: 60 }));
          break;
        }
        case 'table': {
          const n = (b.head || b.rows[0] || []).length || 1;
          const widths = b.widths ? b.widths.map((f) => Math.round(CONTENT_W * f)) : Array(n).fill(Math.round(CONTENT_W / n));
          const rows = [];
          if (b.head) rows.push(b.head.map((h) => ({ xml: W.p(h, { bold: true, align: 'center', after: 0 }), shade: true })));
          b.rows.forEach((r) => rows.push(r.map((c) => ({ xml: W.p(c, { after: 0, align: b.align || undefined }) }))));
          out.push(W.table(rows, widths, { border: true }));
          out.push(W.p('', { after: 60 }));
          break;
        }
        case 'sig': {
          const n = b.cols.length;
          const w = Math.round(CONTENT_W / n);
          out.push(W.p('', { after: 120 }));
          out.push(W.table([b.cols.map((c) => ({
            xml: W.p(c.title, { bold: true, align: 'center', after: 80 }) +
              (c.lines || []).map((l) => W.p(l, { align: 'center', after: 40 })).join(''),
          }))], Array(n).fill(w)));
          break;
        }
        case 'space': out.push(W.p('')); break;
        case 'pagebreak': out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); break;
      }
    }
    return out.join('');
  }

  function headerXML(doc, opts, W, logo) {
    if (!doc.header) return `<w:p><w:pPr><w:bidi/></w:pPr></w:p>`;
    const hsz = Math.round((opts.headerFontSize || 13) * 2);
    const lines = (opts.headerLines || []).filter((l) => l.trim());
    const right = lines.map((l) => W.p(l, { bold: true, align: 'center', sz: hsz, after: 0, line: 240 })).join('');
    let center = W.p('', { align: 'center', after: 0 });
    if (logo) {
      const cx = Math.round(logo.wCm * 360000), cy = Math.round(logo.hCm * 360000);
      center = `<w:p><w:pPr><w:bidi/><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:drawing>` +
        `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="logo"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    const L = opts.leftLabels || {};
    const h = doc.header;
    const leftRows = [[L.no || 'الرقم', h.no], [L.date || 'التاريخ', h.date ? h.date + 'هـ' : ''], [L.subject || 'الموضوع', h.subject], [L.attach || 'المشفوعات', h.attach]];
    const left = leftRows.map(([k, v]) => W.p(`**${k}:** ${v || ''}`, { sz: hsz, after: 0, line: 240 })).join('');
    const third = Math.round(CONTENT_W / 3);
    return W.table([[
      { xml: right, vAlign: 'center' }, { xml: center, vAlign: 'center' }, { xml: left, vAlign: 'center' },
    ]], [third + 300, third - 600, third + 300], { bottomRule: true }) + W.p('', { after: 0, sz: 8, line: 240 });
  }

  function footerXML(W) {
    const f = W.font; const sz = W.base - 6;
    const r = (t) => `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:rtl/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`;
    const fld = (code) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r('1')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    return `<w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr>${r('صفحة ')}${fld('PAGE')}${r(' من ')}${fld('NUMPAGES')}</w:p>`;
  }

  async function logoInfo(dataURL) {
    if (!dataURL) return null;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataURL; });
    // نحوّل الشعار إلى PNG دائماً لضمان التوافق
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const png = U.b64ToBytes(c.toDataURL('image/png').split(',')[1]);
    const ratio = img.naturalWidth / img.naturalHeight;
    let hCm = 2.2, wCm = hCm * ratio;
    if (wCm > 4) { wCm = 4; hCm = wCm / ratio; }
    return { png, wCm, hCm };
  }

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  async function toDocx(doc, opts) {
    const W = makeW(opts);
    const logo = doc.header ? await logoInfo(opts.logo) : null;
    const enc = new TextEncoder();
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const files = [];
    const add = (name, s) => files.push({ name, data: typeof s === 'string' ? enc.encode(s) : s });

    add('[Content_Types].xml', X +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>');
    add('_rels/.rels', X +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>');
    add('docProps/core.xml', X +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      `<dc:title>${esc(doc.title || '')}</dc:title><dc:creator>برنامج إجراءات التحقيق</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
    add('word/_rels/document.xml.rels', X +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
      '</Relationships>');
    add('word/_rels/header1.xml.rels', X +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      (logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : '') +
      '</Relationships>');
    if (logo) add('word/media/logo.png', logo.png);
    const f = W.font;
    add('word/styles.xml', X +
      `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>` +
      `<w:sz w:val="${W.base}"/><w:szCs w:val="${W.base}"/><w:rtl/><w:lang w:val="ar-SA" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>` +
      '<w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:bidi/></w:pPr></w:style>' +
      '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:bidiVisual/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
      '</w:styles>');
    add('word/settings.xml', X + `<w:settings ${NS}><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    add('word/header1.xml', X + `<w:hdr ${NS}>${headerXML(doc, opts, W, logo)}</w:hdr>`);
    add('word/footer1.xml', X + `<w:ftr ${NS}>${footerXML(W)}</w:ftr>`);
    add('word/document.xml', X + `<w:document ${NS}><w:body>${bodyXML(doc, W)}<w:p><w:pPr><w:bidi/></w:pPr></w:p>` +
      `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/>` +
      `<w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="454" w:footer="454" w:gutter="0"/>` +
      '<w:bidi/></w:sectPr></w:body></w:document>');
    return zip(files);
  }

  // ================= معاينة HTML =================
  const he = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rich = (s, bold) => segments(s, bold).map((x) => (x.bold ? `<b>${he(x.text)}</b>` : he(x.text)).replace(/\n/g, '<br>')).join('');

  function letterheadHTML(doc, opts) {
    if (!doc.header) return '';
    const L = opts.leftLabels || {};
    const h = doc.header;
    const lines = (opts.headerLines || []).filter((l) => l.trim()).map((l) => `<div>${he(l)}</div>`).join('');
    const logo = opts.logo ? `<img src="${opts.logo}" alt="">` : '';
    return `<div class="lh"><div class="lh-r">${lines}</div><div class="lh-c">${logo}</div>` +
      `<div class="lh-l"><div><b>${he(L.no || 'الرقم')}:</b> ${he(h.no)}</div><div><b>${he(L.date || 'التاريخ')}:</b> ${h.date ? he(h.date) + 'هـ' : ''}</div>` +
      `<div><b>${he(L.subject || 'الموضوع')}:</b> ${he(h.subject)}</div><div><b>${he(L.attach || 'المشفوعات')}:</b> ${he(h.attach)}</div></div></div>`;
  }

  function toHTML(doc, opts) {
    const parts = [];
    let qaNum = 0;
    for (const b of doc.blocks) {
      switch (b.t) {
        case 'title': parts.push(`<h2 class="d-title">${rich(b.text)}</h2>`); break;
        case 'subtitle': parts.push(`<h3 class="d-sub">${rich(b.text)}</h3>`); break;
        case 'p': parts.push(`<p class="d-p ${b.align || 'justify'}">${rich(b.text, b.bold)}</p>`); break;
        case 'qa':
          qaNum = b.n || qaNum + 1;
          parts.push(`<div class="d-qa"><p><b>س${qaNum}/</b> ${rich(b.q)}</p><p><b>ج${qaNum}/</b> ${rich(b.a)}</p></div>`);
          break;
        case 'kv':
          parts.push(`<table class="d-kv">${b.rows.map(([k, v]) => `<tr><th>${rich(k)}</th><td>${rich(v)}</td></tr>`).join('')}</table>`);
          break;
        case 'table':
          parts.push(`<table class="d-table">${b.head ? `<tr>${b.head.map((x) => `<th>${rich(x)}</th>`).join('')}</tr>` : ''}` +
            b.rows.map((r) => `<tr>${r.map((x) => `<td>${rich(x)}</td>`).join('')}</tr>`).join('') + '</table>');
          break;
        case 'sig':
          parts.push(`<div class="d-sig">${b.cols.map((c) => `<div><b>${rich(c.title)}</b>${(c.lines || []).map((l) => `<div>${rich(l)}</div>`).join('')}</div>`).join('')}</div>`);
          break;
        case 'space': parts.push('<p class="d-p">&nbsp;</p>'); break;
        case 'pagebreak': parts.push('<div class="d-break"></div>'); break;
      }
    }
    const style = `font-family:"${he(opts.font || 'Traditional Arabic')}",serif;font-size:${opts.fontSize || 16}pt`;
    // جدول بترويسة thead حتى تتكرر الترويسة في كل صفحة مطبوعة
    return `<div class="paper" style='${style}'><table class="pt"><thead><tr><td>${letterheadHTML(doc, opts)}</td></tr></thead>` +
      `<tbody><tr><td>${parts.join('')}</td></tr></tbody></table></div>`;
  }

  /** النص الصافي للمستند (للنسخ والباركود وواتساب) */
  function toText(doc) {
    const out = [];
    if (doc.header) {
      if (doc.header.subject) out.push(`الموضوع: ${doc.header.subject}`);
      if (doc.header.no) out.push(`الرقم: ${doc.header.no}`);
      if (doc.header.date) out.push(`التاريخ: ${doc.header.date}هـ`);
      out.push('');
    }
    let qaNum = 0;
    const clean = (s) => String(s || '').replace(/\*\*/g, '');
    for (const b of doc.blocks) {
      switch (b.t) {
        case 'title': case 'subtitle': out.push(clean(b.text)); break;
        case 'p': out.push(clean(b.text)); break;
        case 'qa': qaNum = b.n || qaNum + 1; out.push(`س${qaNum}/ ${clean(b.q)}`, `ج${qaNum}/ ${clean(b.a)}`); break;
        case 'kv': b.rows.forEach(([k, v]) => out.push(`${clean(k)}: ${clean(v)}`)); break;
        case 'table':
          if (b.head) out.push(b.head.map(clean).join(' | '));
          b.rows.forEach((r) => out.push(r.map(clean).join(' | ')));
          break;
        case 'sig': b.cols.forEach((c) => out.push(clean(c.title) + ': ' + (c.lines || []).map(clean).join(' - '))); break;
      }
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  global.Doc = { toDocx, toHTML, toText, zip, crc32 };
})(window);
