/**
 * js/apps/worldbook/index.js - 世情(WorldBook)应用
 */

/* ── 常量 & 工具 ── */
const WB_KEY = 'miniphone_worldbook_data_v1';
const WB_DB_PFX = 'worldbook::';
const WB_STYLE = 'miniphone-worldbook-style';
const uid = (p = 'wb') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sj = t => { try { return JSON.parse(t); } catch { return null; } };
const b64u = b => { try { return new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0))); } catch { return ''; } };
const ft = ts => {
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
};

/* ── 数据模型 ── */
function mkBook(o = {}) {
  return {
    id: o.id || uid('book'),
    name: String(o.name || '未命名世界书').trim(),
    enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    type: o.type === 'local' ? 'local' : 'global',
    boundCharacterId: o.boundCharacterId || null,
    entries: Array.isArray(o.entries) ? o.entries.map(mkEntry) : [],
    createdAt: o.createdAt || Date.now(),
    updatedAt: Date.now()
  };
}

function mkEntry(o = {}) {
  let kw = [];
  if (Array.isArray(o.keywords)) kw = o.keywords.map(k => String(k).trim()).filter(Boolean);
  else if (typeof o.keywords === 'string') kw = o.keywords.split(/[,，\s]+/).filter(Boolean);
  return {
    id: o.id || uid('e'),
    name: String(o.name || '').trim(),
    content: String(o.content || '').trim(),
    position: ['top', 'beforeChar', 'afterChar'].includes(o.position) ? o.position : 'afterChar',
    triggerType: o.triggerType === 'always' ? 'always' : 'keyword',
    keywords: kw,
    order: typeof o.order === 'number' ? o.order : 100,
    disableRecursion: !!o.disableRecursion,
    preventFurtherRecursion: !!o.preventFurtherRecursion
  };
}

/* ── 持久化 ── */
function rdLocal() { try { const r = localStorage.getItem(WB_KEY); return r ? JSON.parse(r).map(mkBook) : []; } catch { return []; } }
function wrLocal(b) { try { localStorage.setItem(WB_KEY, JSON.stringify(b)); } catch { } }
async function ldDB(db) {
  try {
    const a = await db?.getAll?.('appsData');
    const r = a?.find(x => x.id === WB_DB_PFX + 'all-books');
    if (r?.value && Array.isArray(r.value)) return r.value.map(mkBook);
  } catch { }
  return null;
}
async function svDB(db, aid, books) {
  wrLocal(books);
  try { await db?.put?.('appsData', { id: WB_DB_PFX + 'all-books', appId: aid, key: 'all-books', value: books, updatedAt: Date.now() }); } catch { }
}

/* ── CSS 注入 ── */
function ensureCSS() {
  if (document.getElementById(WB_STYLE)) return;
  const l = document.createElement('link');
  l.id = WB_STYLE; l.rel = 'stylesheet'; l.href = 'js/apps/worldbook/worldbook.css';
  document.head.appendChild(l);
}

/* ── 酒馆格式解析 ── */
function parseTavE(r) {
  if (!r || typeof r !== 'object') return null;
  let p = 'afterChar';
  if (r.position === 0 || r.position === 'before_char') p = 'beforeChar';
  else if (r.position === 4 || r.position === 'top') p = 'top';
  let kw = [];
  if (Array.isArray(r.key)) kw = r.key;
  else if (Array.isArray(r.keys)) kw = r.keys;
  else if (typeof r.key === 'string') kw = r.key.split(/[,，]+/).filter(Boolean);
  else if (typeof r.keys === 'string') kw = r.keys.split(/[,，]+/).filter(Boolean);
  return mkEntry({
    name: String(r.comment || r.name || r.title || '').trim(),
    content: String(r.content || '').trim(),
    position: p,
    triggerType: (r.constant === true || r.constant === 1) ? 'always' : 'keyword',
    keywords: kw,
    order: typeof r.order === 'number' ? r.order : (typeof r.insertion_order === 'number' ? r.insertion_order : 100),
    disableRecursion: !!r.disable,
    preventFurtherRecursion: !!r.preventRecursion
  });
}

function parseTavWB(obj, fn = '导入的世界书') {
  if (!obj || typeof obj !== 'object') return null;
  let re = [];
  if (obj.entries && typeof obj.entries === 'object') re = Array.isArray(obj.entries) ? obj.entries : Object.values(obj.entries);
  if (!re.length) return null;
  const entries = re.map(parseTavE).filter(Boolean);
  if (!entries.length) return null;
  return mkBook({ name: String(obj.name || obj.title || fn).trim(), entries });
}

/* ── PNG 解析 ── */
function parsePng(buf) {
  const v = new DataView(buf);
  const s = new Uint8Array(buf.slice(0, 8));
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => s[i] === b)) throw new Error('Bad PNG');
  const dc = new TextDecoder();
  const ch = [];
  let o = 8;
  while (o + 8 <= v.byteLength) {
    const ln = v.getUint32(o); o += 4;
    const tp = dc.decode(new Uint8Array(buf, o, 4)); o += 4;
    if (o + ln + 4 > v.byteLength) break;
    const dt = new Uint8Array(buf, o, ln); o += ln; o += 4;
    if (tp === 'tEXt') {
      const z = dt.indexOf(0);
      if (z > -1) ch.push({ kw: dc.decode(dt.slice(0, z)), txt: dc.decode(dt.slice(z + 1)) });
    }
    if (tp === 'iTXt') {
      let c = 0;
      const rn = () => { const s2 = c; while (c < dt.length && dt[c] !== 0) c++; const r2 = dc.decode(dt.slice(s2, c)); c++; return r2; };
      const kw2 = rn(); const cf = dt[c] || 0; c += 2; rn(); rn();
      if (cf === 0) ch.push({ kw: kw2, txt: dc.decode(dt.slice(c)) });
    }
    if (tp === 'IEND') break;
  }
  return ch;
}

function extObj(chs) {
  for (const c of chs) {
    const t = String(c.txt || '').trim();
    if (!t) continue;
    let o = sj(t);
    if (o && typeof o === 'object') return o;
    const d = b64u(t);
    if (d) { o = sj(d); if (o && typeof o === 'object') return o; }
  }
  return null;
}

function extCB(s) {
  if (!s || typeof s !== 'object') return null;
  const r = s.data && typeof s.data === 'object' ? s.data : s;
  return r.character_book || r.world || null;
}

function dlJson(fn, d) {
  const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = fn; a.click();
  URL.revokeObjectURL(u);
}

/* ── SVG 图标 ── */
const I = {
  search: '<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29.5 29.5L40 40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  imp: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 20l8 10 8-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  exp: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 42V18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 28l8-10 8 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  add: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  cls: '<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24 31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  del: '<svg viewBox="0 0 48 48" fill="none"><path d="M12 14h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M17 14V10h14v4" stroke="currentColor" stroke-width="3"/><path d="M16 14l1 24h14l1-24" stroke="currentColor" stroke-width="3"/></svg>',
  globe: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M6 24h36M24 6c-6 6-9 12-9 18s3 12 9 18c6-6 9-12 9-18s-3-12-9-18Z" stroke="currentColor" stroke-width="3"/></svg>',
  pin: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 44s16-12 16-24a16 16 0 0 0-32 0c0 12 16 24 16 24Z" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="20" r="5" stroke="currentColor" stroke-width="3"/></svg>'
};

/* ═══════════════════════════════════════════════════════
   mount / unmount
   ═══════════════════════════════════════════════════════ */

export async function mount(container, context) {
  ensureCSS();

  /* ── 状态 ── */
  const S = {
    books: [], tab: 'global', openId: null,
    sOpen: false, sQ: '',
    sBooks: new Set(), sEntries: new Set(), expEnt: new Set()
  };
  const { db, appId, windowManager: wm } = context;

  const save = () => { S.books.forEach(b => { b.updatedAt = Date.now(); }); void svDB(db, appId, S.books); };
  const chars = () => { try { const d = JSON.parse(localStorage.getItem('miniphone_archive_app_data_v1') || '{}'); return Array.isArray(d.characters) ? d.characters : []; } catch { return []; } };
  const curBooks = () => S.books.filter(b => b.type === S.tab);
  const findBook = id => S.books.find(b => b.id === id);

  /* 加载数据 */
  const fromDB = await ldDB(db);
  S.books = (fromDB && fromDB.length > 0) ? fromDB : rdLocal();

  /* ── DOM 骨架 ── */
  container.innerHTML = `<div class="wb-app">
    <div class="wb-content" id="wbc"></div>
    <nav class="wb-tabbar" id="wbt"></nav>
    <div id="wbm" class="wb-modal hidden"></div>
    <div id="wbto" class="wb-toast"></div>
    <input id="wbi" type="file" accept=".json,.png" style="display:none">
  </div>`;
  const $c = container.querySelector('#wbc');
  const $t = container.querySelector('#wbt');
  const $m = container.querySelector('#wbm');
  const $to = container.querySelector('#wbto');
  const $fi = container.querySelector('#wbi');

  let mClean = () => { };
  let tTmr = null;

  /* ── Toast ── */
  const toast = msg => {
    if (!$to) return;
    $to.textContent = msg; $to.classList.add('show');
    if (tTmr) clearTimeout(tTmr);
    tTmr = setTimeout(() => $to.classList.remove('show'), 1800);
  };

  /* ── 模态框 ── */
  const closeMod = () => { $m.classList.add('hidden'); $m.innerHTML = ''; mClean(); mClean = () => { }; };

  const openMod = ({ title = '', body = '', okTxt = '确认', noTxt = '取消', foot = true, onOpen, onOk }) => {
    closeMod();
    $m.innerHTML = `<div class="wb-modal__mask" data-a="mc"></div>
      <div class="wb-modal__panel">
        <div class="wb-modal__header"><span>${esc(title)}</span><button class="wb-modal__close" data-a="mc">${I.cls}</button></div>
        <div class="wb-modal__body">${body}</div>
        ${foot ? `<div class="wb-modal__footer">
          <button class="wb-btn" data-a="mc">${esc(noTxt)}</button>
          <button class="wb-btn wb-btn--primary" data-a="mok">${esc(okTxt)}</button>
        </div>` : ''}
      </div>`;
    $m.classList.remove('hidden');
    const h = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'mc') { closeMod(); return; }
      if (a === 'mok' && onOk) { const r = await onOk($m); if (r !== false) closeMod(); }
    };
    $m.addEventListener('click', h);
    mClean = () => $m.removeEventListener('click', h);
    if (onOpen) onOpen($m);
  };

  const confirmDel = (msg, fn) => openMod({
    title: '确认操作',
    body: `<p class="wb-modal-hint">${esc(msg)}</p>`,
    okTxt: '确认删除',
    onOk: () => { fn?.(); }
  });

  /* ── 搜索 ── */
  const doSearch = q => {
    S.sBooks.clear(); S.sEntries.clear();
    if (!q) return;
    const ql = q.toLowerCase();
    S.books.forEach(b => {
      if (b.name.toLowerCase().includes(ql)) S.sBooks.add(b.id);
      b.entries.forEach(e => {
        if (e.name.toLowerCase().includes(ql)) { S.sBooks.add(b.id); S.sEntries.add(e.id); }
      });
    });
  };

  /* ═══════════════  渲染  ═══════════════ */

  const rEntry = (e, bid) => {
    const ex = S.expEnt.has(e.id);
    const sm = S.sEntries.has(e.id);
    const tl = e.triggerType === 'always' ? '常驻' : '关键词';
    return `<div class="wb-entry-card${ex ? ' is-expanded' : ''}${sm ? ' is-search-match' : ''}" data-eid="${e.id}" data-bid="${bid}">
      <div class="wb-entry-card__header" data-a="te" data-eid="${e.id}">
        <span class="wb-entry-card__chevron">${I.chev}</span>
        <span class="wb-entry-card__title">${esc(e.name || '未命名条目')}</span>
        <span class="wb-entry-card__trigger-badge">${tl}</span>
      </div>
      <div class="wb-entry-card__body">
        <div class="wb-entry-field"><label>条目名称</label><input type="text" data-f="name" data-eid="${e.id}" data-bid="${bid}" value="${esc(e.name)}" placeholder="输入名称"></div>
        <div class="wb-entry-field"><label>内容</label><textarea data-f="content" data-eid="${e.id}" data-bid="${bid}" rows="4" placeholder="输入条目内容">${esc(e.content)}</textarea></div>
        <div class="wb-entry-field-row">
          <div class="wb-entry-field" style="flex:1"><label>位置</label><select data-f="position" data-eid="${e.id}" data-bid="${bid}">
            <option value="top"${e.position === 'top' ? ' selected' : ''}>置顶</option>
            <option value="beforeChar"${e.position === 'beforeChar' ? ' selected' : ''}>角色前</option>
            <option value="afterChar"${e.position === 'afterChar' ? ' selected' : ''}>角色后</option>
          </select></div>
          <div class="wb-entry-field" style="flex:1"><label>排序</label><input type="number" data-f="order" data-eid="${e.id}" data-bid="${bid}" value="${e.order}"></div>
        </div>
        <div class="wb-entry-field-row">
          <div class="wb-entry-field" style="flex:1"><label>触发方式</label><select data-f="triggerType" data-eid="${e.id}" data-bid="${bid}">
            <option value="keyword"${e.triggerType === 'keyword' ? ' selected' : ''}>关键词</option>
            <option value="always"${e.triggerType === 'always' ? ' selected' : ''}>常驻</option>
          </select></div>
          <div class="wb-entry-field" style="flex:1"><label>关键词</label><input type="text" data-f="keywords" data-eid="${e.id}" data-bid="${bid}" value="${esc(e.keywords.join(', '))}" placeholder="逗号分隔"${e.triggerType === 'always' ? ' disabled' : ''}></div>
        </div>
        <div class="wb-entry-switch-row"><label>禁用递归</label><label class="wb-entry-toggle"><input type="checkbox" data-f="disableRecursion" data-eid="${e.id}" data-bid="${bid}"${e.disableRecursion ? ' checked' : ''}><span class="wb-toggle-track"></span></label></div>
        <div class="wb-entry-switch-row"><label>阻止后续递归</label><label class="wb-entry-toggle"><input type="checkbox" data-f="preventFurtherRecursion" data-eid="${e.id}" data-bid="${bid}"${e.preventFurtherRecursion ? ' checked' : ''}><span class="wb-toggle-track"></span></label></div>
        <button class="wb-entry-delete-btn wb-btn wb-btn--danger" data-a="de" data-eid="${e.id}" data-bid="${bid}">${I.del} 删除条目</button>
      </div>
    </div>`;
  };

  const rBookOpen = book => {
    const cn = book.boundCharacterId ? chars().find(c => c.id === book.boundCharacterId)?.name || '未知角色' : '';
    const bd = book.type === 'local' ? `<div class="wb-book-open__binding">绑定角色: ${cn || '未绑定'}</div>` : '';
    return `<div class="wb-book-open">
      <div class="wb-book-open__header">
        <button class="wb-book-open__back" data-a="bb">${I.back}</button>
        <span class="wb-book-open__title">${esc(book.name)}</span>
        <button class="wb-book-open__add-entry wb-header-btn" data-a="ae" data-bid="${book.id}">${I.add}</button>
      </div>${bd}
      <div class="wb-entry-list">
        ${book.entries.length ? book.entries.map(e => rEntry(e, book.id)).join('') : '<div class="wb-empty">暂无条目，点击右上角 + 添加</div>'}
      </div>
    </div>`;
  };

  const rGrid = () => {
    const books = curBooks();
    const sq = S.sQ;
    let sb = '';
    if (S.sOpen) sb = `<div class="wb-search-bar"><input type="text" id="wb-sinp" placeholder="搜索书名/条目名..." value="${esc(sq)}"><button data-a="sc">${I.cls}</button></div>`;
    let g = '';
    if (!books.length) {
      g = `<div class="wb-empty">暂无${S.tab === 'global' ? '全局' : '局部'}世界书</div>`;
    } else {
      g = '<div class="wb-book-grid">' + books.map(b => {
        const sm = S.sBooks.has(b.id);
        const mc = sq && sm ? ' is-search-match' : '';
        const hc = sq && !sm ? ' hidden' : '';
        return `<div class="wb-book-card${mc}${hc}" data-bid="${b.id}" data-a="ob">
          <div class="wb-book-card__name">${esc(b.name)}</div>
          <label class="wb-book-card__switch"><label class="wb-book-toggle" data-a="stop"><input type="checkbox" data-a="tb" data-bid="${b.id}"${b.enabled ? ' checked' : ''}><span class="wb-toggle-track"></span></label></label>
          <button class="wb-book-card__del" data-a="db" data-bid="${b.id}" title="删除">${I.del}</button>
        </div>`;
      }).join('') + '</div>';
    }
    return sb + g;
  };

  const rTabbar = () => {
    $t.innerHTML = `
      <button class="wb-tab-btn${S.tab === 'global' ? ' is-active' : ''}" data-a="st" data-tab="global">${I.globe}<span>全局</span></button>
      <div class="wb-tab-add-wrapper"><div class="wb-tab-add-bg"></div><button class="wb-tab-add-btn" data-a="ab">${I.add}</button></div>
      <button class="wb-tab-btn${S.tab === 'local' ? ' is-active' : ''}" data-a="st" data-tab="local">${I.pin}<span>局部</span></button>`;
  };

  /* ── 标题栏 ── */
  const setHeader = () => {
    if (!wm) return;
    if (S.openId) {
      wm.setTitle?.(appId, findBook(S.openId)?.name || '世情');
      wm.setBackAction?.(appId, () => { S.openId = null; render(); });
      wm.setHeaderActions?.(appId, []);
    } else {
      wm.setTitle?.(appId, '世情');
      wm.setBackAction?.(appId, null);
      wm.setHeaderActions?.(appId, [
        { label: '搜索', icon: I.search, onClick: () => { S.sOpen = !S.sOpen; if (!S.sOpen) { S.sQ = ''; doSearch(''); } render(); } },
        { label: '导入', icon: I.imp, onClick: () => $fi.click() },
        { label: '导出', icon: I.exp, onClick: doExport }
      ]);
    }
  };

  /* ── 主渲染 ── */
  const render = () => {
    if (S.openId) {
      const book = findBook(S.openId);
      $c.innerHTML = book ? rBookOpen(book) : '<div class="wb-empty">世界书不存在</div>';
      $t.style.display = 'none';
    } else {
      $c.innerHTML = rGrid();
      $t.style.display = '';
      rTabbar();
      if (S.sOpen) {
        const inp = $c.querySelector('#wb-sinp');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }
    }
    setHeader();
  };

  /* ── 添加世界书弹窗 ── */
  const showAddBook = () => {
    const cc = chars();
    const co = cc.map(c => `<div class="wb-char-item" data-cid="${c.id}">${esc(c.name || c.id)}</div>`).join('');
    openMod({
      title: '添加世界书',
      body: `<div class="wb-form-group"><label>名称</label><input type="text" id="wb-nb-name" placeholder="输入世界书名称"></div>
        <div class="wb-form-group"><label>类型</label><div class="wb-form-row">
          <button class="wb-btn wb-btn--primary" id="wb-nb-tg" data-v="global">全局</button>
          <button class="wb-btn" id="wb-nb-tl" data-v="local">局部</button>
        </div></div>
        <div class="wb-form-group" id="wb-nb-chargrp" style="display:none"><label>绑定角色</label>
          <div class="wb-char-list">${co || '<div class="wb-empty" style="padding:8px">暂无角色卡</div>'}</div>
        </div>`,
      onOpen: el => {
        let st2 = 'global', sc2 = null;
        const tg = el.querySelector('#wb-nb-tg'), tl = el.querySelector('#wb-nb-tl'), cg = el.querySelector('#wb-nb-chargrp');
        tg.onclick = () => { st2 = 'global'; tg.className = 'wb-btn wb-btn--primary'; tl.className = 'wb-btn'; cg.style.display = 'none'; };
        tl.onclick = () => { st2 = 'local'; tl.className = 'wb-btn wb-btn--primary'; tg.className = 'wb-btn'; cg.style.display = ''; };
        el.querySelectorAll('.wb-char-item').forEach(ci => ci.onclick = () => {
          el.querySelectorAll('.wb-char-item').forEach(x => x.classList.remove('is-active'));
          ci.classList.add('is-active'); sc2 = ci.dataset.cid;
        });
        el._getData = () => ({ type: st2, charId: sc2 });
      },
      onOk: el => {
        const nm = el.querySelector('#wb-nb-name')?.value?.trim();
        if (!nm) { toast('请输入世界书名称'); return false; }
        const { type, charId } = el._getData();
        const book = mkBook({ name: nm, type, boundCharacterId: type === 'local' ? charId : null });
        S.books.push(book); S.tab = type; save(); render();
        toast('已创建: ' + nm);
      }
    });
  };

  /* ── 导出 ── */
  const doExport = () => {
    const books = curBooks();
    if (!books.length) { toast('当前无可导出的世界书'); return; }
    if (books.length === 1) { dlJson(books[0].name + '_' + ft(Date.now()) + '.json', books[0]); toast('已导出'); return; }
    openMod({
      title: '选择导出的世界书',
      body: '<div class="wb-char-list">' + books.map(b => `<div class="wb-char-item" data-bid="${b.id}">${esc(b.name)}</div>`).join('') + '</div>',
      onOk: el => {
        const sel = el.querySelector('.wb-char-item.is-active');
        if (!sel) { toast('请选择一本世界书'); return false; }
        const book = findBook(sel.dataset.bid);
        if (book) { dlJson(book.name + '_' + ft(Date.now()) + '.json', book); toast('已导出'); }
      },
      onOpen: el => {
        el.querySelectorAll('.wb-char-item').forEach(ci => ci.onclick = () => {
          el.querySelectorAll('.wb-char-item').forEach(x => x.classList.remove('is-active'));
          ci.classList.add('is-active');
        });
      }
    });
  };

  /* ── 导入 ── */
  const doImport = async file => {
    const fn = file.name.toLowerCase();
    if (fn.endsWith('.png')) {
      try {
        const buf = await file.arrayBuffer();
        const chs = parsePng(buf);
        const obj = extObj(chs);
        if (!obj) { toast('PNG中未找到角色数据'); return; }
        const cb = extCB(obj);
        if (!cb) { toast('角色卡中无世界书数据'); return; }
        const book = parseTavWB(cb, file.name.replace(/\.png$/i, ''));
        if (!book) { toast('无法解析世界书条目'); return; }
        S.books.push(book); save(); render();
        toast('已从PNG导入: ' + book.name);
      } catch (err) { toast('PNG解析失败: ' + err.message); }
    } else {
      try {
        const text = await file.text();
        const obj = sj(text);
        if (!obj) { toast('JSON解析失败'); return; }
        // 本应用格式
        if (obj.id && obj.entries && Array.isArray(obj.entries)) {
          const book = mkBook(obj); S.books.push(book); save(); render();
          toast('已导入: ' + book.name); return;
        }
        // 酒馆世界书格式
        const tavBook = parseTavWB(obj, file.name.replace(/\.json$/i, ''));
        if (tavBook) { S.books.push(tavBook); save(); render(); toast('已导入酒馆格式: ' + tavBook.name); return; }
        // 角色卡JSON中提取character_book
        const cb = extCB(obj);
        if (cb) {
          const bk = parseTavWB(cb, file.name.replace(/\.json$/i, ''));
          if (bk) { S.books.push(bk); save(); render(); toast('已从角色卡导入: ' + bk.name); return; }
        }
        toast('无法识别的JSON格式');
      } catch (err) { toast('导入失败: ' + err.message); }
    }
  };

  $fi.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) doImport(f); $fi.value = ''; });

  /* ── 事件委托 ── */
  const hClick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'st') { const tab = e.target.closest('[data-tab]')?.dataset.tab; if (tab && tab !== S.tab) { S.tab = tab; S.sQ = ''; doSearch(''); render(); } }
    if (a === 'ab') showAddBook();
    if (a === 'ob') { const bid = e.target.closest('[data-bid]')?.dataset.bid; if (bid) { S.openId = bid; S.expEnt.clear(); render(); } }
    if (a === 'bb') { S.openId = null; render(); }
    if (a === 'tb') { e.stopPropagation(); const bid = e.target.dataset.bid; const book = findBook(bid); if (book) { book.enabled = e.target.checked; save(); } }
    if (a === 'stop') e.stopPropagation();
    if (a === 'db') { e.stopPropagation(); const bid = e.target.closest('[data-bid]')?.dataset.bid; const book = findBook(bid); if (book) confirmDel('确定删除世界书「' + book.name + '」？', () => { S.books = S.books.filter(b => b.id !== bid); save(); render(); }); }
    if (a === 'te') { const eid = e.target.closest('[data-eid]')?.dataset.eid; if (eid) { S.expEnt.has(eid) ? S.expEnt.delete(eid) : S.expEnt.add(eid); render(); } }
    if (a === 'ae') { const bid = e.target.closest('[data-bid]')?.dataset.bid; const book = findBook(bid); if (book) { const ne = mkEntry({ name: '新条目' }); book.entries.push(ne); S.expEnt.add(ne.id); save(); render(); } }
    if (a === 'de') { const eid = e.target.closest('[data-eid]')?.dataset.eid; const bid = e.target.closest('[data-bid]')?.dataset.bid; const book = findBook(bid); if (book) confirmDel('确定删除该条目？', () => { book.entries = book.entries.filter(en => en.id !== eid); S.expEnt.delete(eid); save(); render(); }); }
    if (a === 'sc') { S.sQ = ''; S.sOpen = false; doSearch(''); render(); }
  };

  const hInput = e => {
    const t = e.target;
    if (t.id === 'wb-sinp') { S.sQ = t.value; doSearch(S.sQ); render(); return; }
    const f = t.dataset.f, eid = t.dataset.eid, bid = t.dataset.bid;
    if (!f || !eid || !bid) return;
    const book = findBook(bid); if (!book) return;
    const entry = book.entries.find(en => en.id === eid); if (!entry) return;
    if (f === 'name') entry.name = t.value;
    if (f === 'content') entry.content = t.value;
    if (f === 'position') entry.position = t.value;
    if (f === 'order') entry.order = parseInt(t.value) || 0;
    if (f === 'triggerType') { entry.triggerType = t.value; const kwInp = $c.querySelector(`input[data-f="keywords"][data-eid="${eid}"]`); if (kwInp) kwInp.disabled = t.value === 'always'; }
    if (f === 'keywords') entry.keywords = t.value.split(/[,，\s]+/).filter(Boolean);
    if (f === 'disableRecursion') entry.disableRecursion = t.checked;
    if (f === 'preventFurtherRecursion') entry.preventFurtherRecursion = t.checked;
    save();
  };

  container.addEventListener('click', hClick);
  container.addEventListener('input', hInput);
  container.addEventListener('change', hInput);

  /* ── 全局API：供档案应用调用 ── */
  window.importWorldBookFromCharacterCard = async file => {
    await doImport(file);
  };

  /* ── 首次渲染 ── */
  render();

  return {
    destroy: () => {
      container.removeEventListener('click', hClick);
      container.removeEventListener('input', hInput);
      container.removeEventListener('change', hInput);
      delete window.importWorldBookFromCharacterCard;
      closeMod();
      if (tTmr) clearTimeout(tTmr);
    }
  };
}

export function unmount(instance) {
  instance?.destroy?.();
  const s = document.getElementById(WB_STYLE);
  if (s) s.remove();
}
