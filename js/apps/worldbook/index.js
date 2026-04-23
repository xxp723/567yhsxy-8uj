/**
 * js/apps/worldbook/index.js - 世情(WorldBook)应用
 *
 * [修改标注·需求1] 联动档案应用：自动解析角色卡世界书、显示绑定角色
 * [修改标注·需求2] 所有原生浏览器弹窗替换为自定义弹窗
 * [修改标注·需求3] 条目添加单独开关、去除封面开关、折叠栏显示启用状态
 * [修改标注·需求4] 去除封面删除按钮、长按封面触发弹窗
 * [修改标注·需求5] 标题栏布局调整
 * [修改标注·需求6] 圆角背景、美化世界书卡片、长按弹窗含删除确认+位置选择
 */

const WB_KEY = 'miniphone_worldbook_data_v1';
const WB_DB_PFX = 'worldbook::';
const WB_STYLE = 'miniphone-worldbook-style';
const uid = (p = 'wb') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sj = t => { try { return JSON.parse(t); } catch { return null; } };
const b64u = b => { try { return new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0))); } catch { return ''; } };

function mkBook(o = {}) {
  return {
    id: o.id || uid('book'), name: String(o.name || '未命名世界书').trim(),
    enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    type: o.type === 'local' ? 'local' : 'global',
    /* [修改标注·本次需求2] boundCharacterIds 改为数组，支持一书多绑（一本世界书可绑定多个角色） */
    boundCharacterIds: Array.isArray(o.boundCharacterIds) ? [...o.boundCharacterIds] : (o.boundCharacterId ? [o.boundCharacterId] : []),
    /* [修改标注·需求1] 记录来自档案角色卡的世界书来源，便于自动补导与绑定恢复 */
    archiveSourceCharacterId: o.archiveSourceCharacterId || null,
    archiveSourceKey: o.archiveSourceKey || null,
    entries: Array.isArray(o.entries) ? o.entries.map(mkEntry) : [],
    createdAt: o.createdAt || Date.now(), updatedAt: Date.now()
  };
}

function mkEntry(o = {}) {
  let kw = [];
  if (Array.isArray(o.keywords)) kw = o.keywords.map(k => String(k).trim()).filter(Boolean);
  else if (typeof o.keywords === 'string') kw = o.keywords.split(/[,，\s]+/).filter(Boolean);
  return {
    id: o.id || uid('e'), name: String(o.name || '').trim(),
    content: String(o.content || '').trim(),
    position: ['top', 'beforeChar', 'afterChar'].includes(o.position) ? o.position : 'afterChar',
    triggerType: o.triggerType === 'always' ? 'always' : 'keyword',
    keywords: kw, order: typeof o.order === 'number' ? o.order : 100,
    enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    disableRecursion: !!o.disableRecursion,
    preventFurtherRecursion: !!o.preventFurtherRecursion
  };
}

async function ldDB(db) {
  try { const a = await db?.getAll?.('appsData'); const r = a?.find(x => x.id === WB_DB_PFX + 'all-books'); if (r?.value && Array.isArray(r.value)) return r.value.map(mkBook); } catch {} return [];
}
async function svDB(db, aid, books) {
  try { await db?.put?.('appsData', { id: WB_DB_PFX + 'all-books', appId: aid, key: 'all-books', value: books, updatedAt: Date.now() }); } catch {}
}

function ensureCSS() {
  if (document.getElementById(WB_STYLE)) return;
  const l = document.createElement('link'); l.id = WB_STYLE; l.rel = 'stylesheet'; l.href = 'js/apps/worldbook/worldbook.css'; document.head.appendChild(l);
}

function parseTavE(r) {
  if (!r || typeof r !== 'object') return null;
  let p = 'afterChar';
  if (r.position === 0 || r.position === 'before_char') p = 'beforeChar';
  else if (r.position === 4 || r.position === 'top') p = 'top';
  let kw = [];
  if (Array.isArray(r.key)) kw = r.key; else if (Array.isArray(r.keys)) kw = r.keys;
  else if (typeof r.key === 'string') kw = r.key.split(/[,，]+/).filter(Boolean);
  else if (typeof r.keys === 'string') kw = r.keys.split(/[,，]+/).filter(Boolean);
  return mkEntry({
    name: String(r.comment || r.name || r.title || '').trim(),
    content: String(r.content || '').trim(), position: p,
    triggerType: (r.constant === true || r.constant === 1) ? 'always' : 'keyword',
    keywords: kw, order: typeof r.order === 'number' ? r.order : (typeof r.insertion_order === 'number' ? r.insertion_order : 100),
    enabled: typeof r.enabled === 'boolean' ? r.enabled : (r.disable !== true),
    disableRecursion: !!r.disable, preventFurtherRecursion: !!r.preventRecursion
  });
}

function parseTavWB(obj, fn = '导入的世界书') {
  if (!obj || typeof obj !== 'object') return null;
  let re = [];
  if (obj.entries && typeof obj.entries === 'object') re = Array.isArray(obj.entries) ? obj.entries : Object.values(obj.entries);
  if (!re.length) return null;
  const entries = re.map(parseTavE).filter(Boolean);
  if (!entries.length) return null;
  /* [修改标注·需求1] 保留导入世界书原有顶层启用状态 */
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : !(obj.disable === true || obj.disable === 1);
  return mkBook({ name: String(obj.name || obj.title || fn).trim(), enabled, entries });
}

function parsePng(buf) {
  const v = new DataView(buf); const s = new Uint8Array(buf.slice(0, 8));
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => s[i] === b)) throw new Error('Bad PNG');
  const dc = new TextDecoder(); const ch = []; let o = 8;
  while (o + 8 <= v.byteLength) {
    const ln = v.getUint32(o); o += 4;
    const tp = dc.decode(new Uint8Array(buf, o, 4)); o += 4;
    if (o + ln + 4 > v.byteLength) break;
    const dt = new Uint8Array(buf, o, ln); o += ln; o += 4;
    if (tp === 'tEXt') { const z = dt.indexOf(0); if (z > -1) ch.push({ kw: dc.decode(dt.slice(0, z)), txt: dc.decode(dt.slice(z + 1)) }); }
    if (tp === 'iTXt') { let c = 0; const rn = () => { const s2 = c; while (c < dt.length && dt[c] !== 0) c++; const r2 = dc.decode(dt.slice(s2, c)); c++; return r2; }; const kw2 = rn(); const cf = dt[c] || 0; c += 2; rn(); rn(); if (cf === 0) ch.push({ kw: kw2, txt: dc.decode(dt.slice(c)) }); }
    if (tp === 'IEND') break;
  }
  return ch;
}

function extObj(chs) {
  for (const c of chs) { const t = String(c.txt || '').trim(); if (!t) continue; let o = sj(t); if (o && typeof o === 'object') return o; const d = b64u(t); if (d) { o = sj(d); if (o && typeof o === 'object') return o; } } return null;
}

function extCB(s) {
  if (!s || typeof s !== 'object') return null;
  const r = s.data && typeof s.data === 'object' ? s.data : s;
  return r.character_book || r.world || null;
}

function dlJson(fn, d) {
  const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href = u; a.download = fn; a.click(); URL.revokeObjectURL(u);
}

const I = {
  search: '<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29.5 29.5L40 40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  imp: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 20l8 10 8-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  exp: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 42V18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 28l8-10 8 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  add: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  cls: '<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24 31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevDown: '<svg viewBox="0 0 48 48" fill="none"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  del: '<svg viewBox="0 0 48 48" fill="none"><path d="M12 14h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M17 14V10h14v4" stroke="currentColor" stroke-width="3"/><path d="M16 14l1 24h14l1-24" stroke="currentColor" stroke-width="3"/></svg>',
  globe: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M6 24h36M24 6c-6 6-9 12-9 18s3 12 9 18c6-6 9-12 9-18s-3-12-9-18Z" stroke="currentColor" stroke-width="3"/></svg>',
  pin: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 44s16-12 16-24a16 16 0 0 0-32 0c0 12 16 24 16 24Z" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="20" r="5" stroke="currentColor" stroke-width="3"/></svg>',
  book: '<svg viewBox="0 0 48 48" fill="none"><path d="M6 8h14a4 4 0 0 1 4 4v28a3 3 0 0 0-3-3H6V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M42 8H28a4 4 0 0 0-4 4v28a3 3 0 0 1 3-3h15V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 48 48" fill="none"><path d="M19 29l-4 4a7 7 0 0 0 10 10l4-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M29 19l4-4a7 7 0 0 0-10-10l-4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M18 30l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  /* [修改标注·需求6-改] 放大/全屏图标 - IconPark FullScreen */
  expand: '<svg viewBox="0 0 48 48" fill="none"><path d="M6 6h12M6 6v12M42 6H30M42 6v12M6 42h12M6 42V30M42 42H30M42 42V30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  /* [修改标注·需求6-改] 收缩/退出全屏图标 - IconPark OffScreen */
  shrink: '<svg viewBox="0 0 48 48" fill="none"><path d="M18 6v12H6M30 6v12h12M18 42V30H6M30 42V30h12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const POS_LABELS = { top: '置顶', beforeChar: '角色前', afterChar: '角色后' };

export async function mount(container, context) {
  ensureCSS();
  const S = { books: [], tab: 'global', openId: null, sOpen: false, sQ: '', sBooks: new Set(), sEntries: new Set(), expEnt: new Set() };
  const { db, appId, eventBus } = context;
  /* [修改标注·需求3] 点击标题文字返回桌面时，复用应用统一关闭事件，避免仅移除窗口壳体 */
  const closeToDesktop = () => { eventBus?.emit('app:close', { appId }); };
  const save = () => { S.books.forEach(b => { b.updatedAt = Date.now(); }); void svDB(db, appId, S.books); };
  /* chars() 从 IndexedDB 缓存读取档案数据（由 loadArchiveCache 预加载） */
  let _archiveCharsCache = [];
  const loadArchiveCache = async () => {
    try {
      const all = await db?.getAll?.('appsData');
      const rec = all?.find(x => x.id === 'archive::data');
      if (rec?.value && Array.isArray(rec.value.characters)) _archiveCharsCache = rec.value.characters;
    } catch {}
  };
  const chars = () => _archiveCharsCache;
  /* [修改标注·需求1] 从档案持久化数据中提取角色卡自带的绑定世界书，确保世情应用晚于档案打开时也能自动补导 */
  const archiveBoundBooks = () => chars().flatMap((character) => {
    const boundWorldBooks = Array.isArray(character?.boundWorldBooks) ? character.boundWorldBooks : [];
    return boundWorldBooks.map((wb, index) => {
      const raw = wb?.raw && typeof wb.raw === 'object' ? wb.raw : (wb && typeof wb === 'object' ? wb : null);
      if (!raw) return null;
      return {
        characterId: character?.id || null,
        characterName: character?.name || '',
        sourceKey: wb?.sourceKey || `${character?.id || 'char'}::${index}`,
        name: wb?.name || raw?.name || raw?.title || '角色卡世界书',
        raw
      };
    }).filter(Boolean);
  });
  /* [修改标注·需求1] 将档案角色卡绑定世界书导入世情局部板块，并保留原有状态字段 */
  const importArchiveWorldBook = ({ characterId = null, sourceKey = '', name = '', raw = null }) => {
    if (!raw || typeof raw !== 'object') return false;
    const safeSourceKey = sourceKey || uid('archivewb');
    const existed = S.books.find((book) => book.archiveSourceCharacterId === characterId && book.archiveSourceKey === safeSourceKey);
    if (existed) return false;
    const book = parseTavWB(raw, name || '角色卡世界书');
    if (!book) return false;
    book.type = 'local';
    /* [修改标注·本次需求2] 使用 boundCharacterIds 数组支持一书多绑 */
    book.boundCharacterIds = characterId ? [characterId] : [];
    book.archiveSourceCharacterId = characterId || null;
    book.archiveSourceKey = safeSourceKey;
    S.books.push(book);
    return true;
  };
  const syncArchiveBoundWorldBooks = () => {
    let changed = false;
    archiveBoundBooks().forEach((item) => {
      if (importArchiveWorldBook(item)) changed = true;
    });
    if (changed) save();
  };
  const curBooks = () => S.books.filter(b => b.type === S.tab);
  const findBook = id => S.books.find(b => b.id === id);
  await loadArchiveCache();
  S.books = await ldDB(db);
  syncArchiveBoundWorldBooks();

  const appWindow = container.closest('.app-window');
  const header = appWindow?.querySelector('.app-window__header') || null;
  const closeBtn = header?.querySelector('.app-window__close') || null;
  const actionsEl = header?.querySelector('.app-window__actions') || null;
  const titleEl = header?.querySelector('.app-window__title') || null;

  container.innerHTML = '<div class="wb-app"><div class="wb-content" id="wbc"></div><nav class="wb-tabbar" id="wbt"></nav><div id="wbm" class="wb-modal hidden"></div><div id="wbto" class="wb-toast"></div><input id="wbi" type="file" accept=".json,.png" style="display:none"></div>';
  const $c = container.querySelector('#wbc');
  const $t = container.querySelector('#wbt');
  const $m = container.querySelector('#wbm');
  const $to = container.querySelector('#wbto');
  const $fi = container.querySelector('#wbi');
  let mClean = () => {};
  let tTmr = null;
  let longPressTimer = null;

  const toast = (msg, type = 'info') => { if (!$to) return; $to.textContent = msg; $to.dataset.type = type; $to.classList.add('show'); if (tTmr) clearTimeout(tTmr); tTmr = setTimeout(() => $to.classList.remove('show'), 1800); };
  const closeMod = () => { $m.classList.add('hidden'); $m.innerHTML = ''; mClean(); mClean = () => {}; };
  const openMod = ({ title = '', body = '', okTxt = '确认', noTxt = '取消', foot = true, danger = false, onOpen, onOk }) => {
    closeMod();
    $m.innerHTML = '<div class="wb-modal__mask" data-a="mc"></div><div class="wb-modal__panel"><div class="wb-modal__header"><span>' + esc(title) + '</span><button class="wb-modal__close" data-a="mc">' + I.cls + '</button></div><div class="wb-modal__body">' + body + '</div>' + (foot ? '<div class="wb-modal__footer"><button class="wb-btn" data-a="mc">' + esc(noTxt) + '</button><button class="wb-btn ' + (danger ? 'wb-btn--danger' : 'wb-btn--primary') + '" data-a="mok">' + esc(okTxt) + '</button></div>' : '') + '</div>';
    $m.classList.remove('hidden');
    const h = async e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'mc') { closeMod(); return; } if (a === 'mok' && onOk) { const r = await onOk($m); if (r !== false) closeMod(); } };
    $m.addEventListener('click', h); mClean = () => $m.removeEventListener('click', h);
    if (onOpen) onOpen($m);
  };

  const confirmDel = (msg, fn) => openMod({ title: '确认操作', body: '<p class="wb-modal-hint">' + esc(msg) + '</p>', okTxt: '确认删除', danger: true, onOk: () => { fn?.(); } });

  const openPositionPicker = (currentPos, eid, bid) => {
    const ps = [{ value: 'top', label: '置顶' }, { value: 'beforeChar', label: '角色前' }, { value: 'afterChar', label: '角色后' }];
    openMod({ title: '选择条目位置', foot: false,
      body: '<div class="wb-position-picker">' + ps.map(p => '<div class="wb-position-option' + (p.value === currentPos ? ' is-active' : '') + '" data-a="pickpos" data-pos="' + p.value + '"><span>' + p.label + '</span><span class="wb-position-radio' + (p.value === currentPos ? ' is-checked' : '') + '"></span></div>').join('') + '</div>',
      onOpen: el => { el.addEventListener('click', ev => { const opt = ev.target.closest('[data-a="pickpos"]'); if (!opt) return; const book = findBook(bid); if (!book) return; const entry = book.entries.find(en => en.id === eid); if (!entry) return; entry.position = opt.dataset.pos; save(); closeMod(); render(); }); }
    });
  };

  const openTriggerPicker = (curTrig, eid, bid) => {
    const ts = [{ value: 'keyword', label: '关键词' }, { value: 'always', label: '常驻' }];
    openMod({ title: '选择触发方式', foot: false,
      body: '<div class="wb-position-picker">' + ts.map(t => '<div class="wb-position-option' + (t.value === curTrig ? ' is-active' : '') + '" data-a="picktrig" data-trig="' + t.value + '"><span>' + t.label + '</span><span class="wb-position-radio' + (t.value === curTrig ? ' is-checked' : '') + '"></span></div>').join('') + '</div>',
      onOpen: el => { el.addEventListener('click', ev => { const opt = ev.target.closest('[data-a="picktrig"]'); if (!opt) return; const book = findBook(bid); if (!book) return; const entry = book.entries.find(en => en.id === eid); if (!entry) return; entry.triggerType = opt.dataset.trig; save(); closeMod(); render(); }); }
    });
  };

  /* [修改标注·需求6] 长按世界书封面弹窗：删除确认 + 位置选择 */
  const openBookLongPressMenu = book => {
    const isLocal = book.type === 'local';
    const isGlobal = book.type === 'global';
    openMod({ title: esc(book.name), foot: false,
      body: '<div class="wb-longpress-menu">' +
        '<div class="wb-longpress-section"><div class="wb-longpress-section-title">放置位置</div>' +
        '<div class="wb-position-picker"><div class="wb-position-option' + (isGlobal ? ' is-active' : '') + '" data-a="settype" data-type="global"><span>' + I.globe + ' 全局</span><span class="wb-position-radio' + (isGlobal ? ' is-checked' : '') + '"></span></div>' +
        '<div class="wb-position-option' + (isLocal ? ' is-active' : '') + '" data-a="settype" data-type="local"><span>' + I.pin + ' 局部</span><span class="wb-position-radio' + (isLocal ? ' is-checked' : '') + '"></span></div></div></div>' +
        '<div class="wb-longpress-section"><div class="wb-longpress-section-title">危险操作</div>' +
        '<button class="wb-btn wb-btn--danger" style="width:100%" data-a="delbook">' + I.del + ' 删除此世界书</button></div></div>',
      onOpen: el => {
        el.addEventListener('click', ev => {
          const setT = ev.target.closest('[data-a="settype"]');
          if (setT) {
            const nextType = setT.dataset.type;
            book.type = nextType;
            /* [修改标注·需求2] 放入全局板块后不再与档案角色绑定；切回局部时恢复原始角色绑定来源 */
            if (nextType === 'global') {
              /* [修改标注·本次需求2] 切到全局时清空绑定角色数组 */
              book.boundCharacterIds = [];
            } else if ((!book.boundCharacterIds || book.boundCharacterIds.length === 0) && book.archiveSourceCharacterId) {
              book.boundCharacterIds = [book.archiveSourceCharacterId];
            }
            save(); closeMod(); render(); return;
          }
          const delB = ev.target.closest('[data-a="delbook"]');
          if (delB) { closeMod(); confirmDel('确定删除世界书"' + book.name + '"吗？此操作不可撤销。', () => { S.books = S.books.filter(b => b.id !== book.id); save(); S.openId = null; render(); toast('已删除', 'success'); }); }
        });
      }
    });
  };

  /* [修改标注·需求5] 搜索同时覆盖世界书名称、条目名称、条目内容与关键词 */
  const doSearch = q => {
    S.sBooks.clear();
    S.sEntries.clear();
    if (!q) return;
    const ql = q.toLowerCase();
    S.books.forEach(b => {
      if (b.name.toLowerCase().includes(ql)) S.sBooks.add(b.id);
      b.entries.forEach(e => {
        const keywordsText = Array.isArray(e.keywords) ? e.keywords.join(' ') : '';
        const matched = [
          e.name,
          e.content,
          keywordsText
        ].some(text => String(text || '').toLowerCase().includes(ql));
        if (matched) {
          S.sBooks.add(b.id);
          S.sEntries.add(e.id);
        }
      });
    });
  };

  const rEntry = (e, bid) => {
    const ex = S.expEnt.has(e.id);
    const sm = S.sEntries.has(e.id);
    const tl = e.triggerType === 'always' ? '常驻' : '关键词';
    const enableBadge = e.enabled ? '<span class="wb-entry-card__status-badge wb-entry-card__status-badge--on">ON</span>' : '<span class="wb-entry-card__status-badge wb-entry-card__status-badge--off">OFF</span>';
    return '<div class="wb-entry-card' + (ex ? ' is-expanded' : '') + (sm ? ' is-search-match' : '') + '" data-eid="' + e.id + '" data-bid="' + bid + '">' +
      '<div class="wb-entry-card__header" data-a="te" data-eid="' + e.id + '"><span class="wb-entry-card__chevron">' + I.chev + '</span><span class="wb-entry-card__title">' + esc(e.name || '未命名条目') + '</span>' + enableBadge + '<span class="wb-entry-card__trigger-badge">' + tl + '</span></div>' +
      '<div class="wb-entry-card__body">' +
      /* [修改标注·需求5] "启用此条目"字体调小至与条目内容字体大小一致 */
      '<div class="wb-entry-switch-row wb-entry-switch-row--small"><label>启用此条目</label><label class="wb-entry-toggle"><input type="checkbox" data-f="enabled" data-eid="' + e.id + '" data-bid="' + bid + '"' + (e.enabled ? ' checked' : '') + '><span class="wb-toggle-track"></span></label></div>' +
      '<div class="wb-entry-field"><label>条目名称</label><input type="text" data-f="name" data-eid="' + e.id + '" data-bid="' + bid + '" value="' + esc(e.name) + '" placeholder="输入名称"></div>' +
      /* [修改标注·需求6] 内容板块标题行右侧添加放大按钮 */
      '<div class="wb-entry-field wb-entry-field--content"><div class="wb-entry-field__label-row"><label>内容</label><button class="wb-content-expand-btn" data-a="expandcontent" data-eid="' + e.id + '" data-bid="' + bid + '" title="放大内容编辑区">' + I.expand + '</button></div><textarea data-f="content" data-eid="' + e.id + '" data-bid="' + bid + '" rows="4" placeholder="输入条目内容">' + esc(e.content) + '</textarea></div>' +
      '<div class="wb-entry-field-row"><div class="wb-entry-field" style="flex:1"><label>位置</label><button class="wb-pos-picker-btn" data-a="openpos" data-eid="' + e.id + '" data-bid="' + bid + '">' + esc(POS_LABELS[e.position] || e.position) + '</button></div>' +
      '<div class="wb-entry-field" style="flex:1"><label>排序</label><input type="number" data-f="order" data-eid="' + e.id + '" data-bid="' + bid + '" value="' + e.order + '"></div></div>' +
      '<div class="wb-entry-field-row"><div class="wb-entry-field" style="flex:1"><label>触发方式</label><button class="wb-pos-picker-btn" data-a="opentrigger" data-eid="' + e.id + '" data-bid="' + bid + '">' + (e.triggerType === 'always' ? '常驻' : '关键词') + '</button></div>' +
      '<div class="wb-entry-field" style="flex:1"><label>关键词</label><input type="text" data-f="keywords" data-eid="' + e.id + '" data-bid="' + bid + '" value="' + esc(e.keywords.join(', ')) + '" placeholder="逗号分隔"' + (e.triggerType === 'always' ? ' disabled' : '') + '></div></div>' +
      /* [修改标注·需求5] "禁止递归"改为"不可递归"，字体调小至与条目内容字体大小一致 */
      '<div class="wb-entry-switch-row wb-entry-switch-row--small"><label>不可递归</label><label class="wb-entry-toggle"><input type="checkbox" data-f="disableRecursion" data-eid="' + e.id + '" data-bid="' + bid + '"' + (e.disableRecursion ? ' checked' : '') + '><span class="wb-toggle-track"></span></label></div>' +
      /* [修改标注·需求5] "阻止后续递归"改为"防止进一步递归"，字体调小至与条目内容字体大小一致 */
      '<div class="wb-entry-switch-row wb-entry-switch-row--small"><label>防止进一步递归</label><label class="wb-entry-toggle"><input type="checkbox" data-f="preventFurtherRecursion" data-eid="' + e.id + '" data-bid="' + bid + '"' + (e.preventFurtherRecursion ? ' checked' : '') + '><span class="wb-toggle-track"></span></label></div>' +
      '<button class="wb-entry-delete-btn wb-btn wb-btn--danger" data-a="de" data-eid="' + e.id + '" data-bid="' + bid + '">' + I.del + ' 删除条目</button></div></div>';
  };

  /* [修改标注·本次需求2] 搜索时只列出匹配的条目，不再显示所有条目仅高亮 */
  const rBookOpen = book => {
    const bids = Array.isArray(book.boundCharacterIds) ? book.boundCharacterIds : [];
    const cnames = bids.map(cid => chars().find(c => c.id === cid)?.name || '未知角色').filter(Boolean);
    const bd = book.type === 'local' && cnames.length ? '<div class="wb-book-open__binding">' + I.link + ' 绑定角色: ' + esc(cnames.join(', ')) + '</div>' : '';
    const entries = (S.sOpen && S.sQ) ? book.entries.filter(e => S.sEntries.has(e.id)) : book.entries;
    let listHtml;
    if (!entries.length) {
      if (S.sOpen && S.sQ) listHtml = '<div class="wb-empty"><h3>未找到匹配的条目</h3><p>尝试更换关键词搜索</p></div>';
      else listHtml = '<div class="wb-empty"><h3>暂无条目</h3><p>点击标题栏左上角 + 添加新条目</p></div>';
    } else {
      listHtml = entries.map(e => rEntry(e, book.id)).join('');
    }
    return '<div class="wb-book-open">' + bd + '<div class="wb-entry-list">' + listHtml + '</div></div>';
  };

  const rBookCard = b => {
    const sm = S.sBooks.has(b.id);
    /* [修改标注·本次需求2] 卡片上显示绑定角色名称（一书多绑） */
    const bids2 = Array.isArray(b.boundCharacterIds) ? b.boundCharacterIds : [];
    const cn = b.type === 'local' && bids2.length ? bids2.map(cid => chars().find(c => c.id === cid)?.name || '').filter(Boolean).join(', ') : '';
    return '<div class="wb-book-card' + (sm ? ' is-search-match' : '') + '" data-a="ob" data-id="' + b.id + '">' +
      '<div class="wb-book-card__inner"><span class="wb-book-card__name">' + esc(b.name) + '</span>' +
      (cn ? '<span class="wb-book-card__bind">' + I.link + ' ' + esc(cn) + '</span>' : '') +
      '</div></div>';
  };

  /* [修改标注·本次需求2] 搜索时只列出匹配的世界书，不再显示所有书籍仅高亮 */
  const rGrid = () => {
    const bs = curBooks();
    const filtered = (S.sOpen && S.sQ) ? bs.filter(b => S.sBooks.has(b.id)) : bs;
    if (!filtered.length) {
      if (S.sOpen && S.sQ) return '<div class="wb-empty"><h3>未找到匹配的世界书</h3><p>尝试更换关键词搜索</p></div>';
      return '<div class="wb-empty"><h3>暂无' + (S.tab === 'global' ? '全局' : '局部') + '世界书</h3><p>点击标题栏导入或底部 + 新建</p></div>';
    }
    return '<div class="wb-book-grid">' + filtered.map(rBookCard).join('') + '</div>';
  };

  /* [本次修改标注·仅限需求2] 世情应用标题改为内嵌可点击按钮，绕过全局标题 pointer-events:none，仅修复“世情/世界书名称”返回桌面功能 */
  const renderHomeTitle = (title) => {
    if (!titleEl) return;
    titleEl.innerHTML = '<button type="button" class="wb-header-title-btn" data-a="gohome" title="返回桌面">' + esc(title) + '</button>';
  };

  /* [修改标注·需求3/需求5] 标题栏渲染：标题文字返回桌面，右侧补搜索按钮 */
  const renderHeader = () => {
    if (!header) return;
    if (closeBtn) closeBtn.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    header.querySelectorAll('.wb-header-left,.wb-header-right').forEach(el => el.remove());

    if (S.openId) {
      const book = findBook(S.openId);
      const bookName = book ? book.name : '世界书';
      const left = document.createElement('span'); left.className = 'wb-header-left';
      left.innerHTML = '<button class="wb-header-btn" data-a="goback" title="返回上一级">' + I.back + '</button>';
      header.appendChild(left);
      /* [本次修改标注·仅限需求2] 打开世界书后，点击标题中的世界书名称直接返回桌面 */
      renderHomeTitle(bookName);
      const right = document.createElement('span'); right.className = 'wb-header-right';
      /* [修改标注·需求5] 右侧添加搜索按钮，同时保留新增条目按钮 */
      right.innerHTML = '<button class="wb-header-btn" data-a="ts" title="搜索条目">' + I.search + '</button><button class="wb-header-btn" data-a="ae" title="添加条目">' + I.add + '</button>';
      header.appendChild(right);
    } else {
      const left = document.createElement('span'); left.className = 'wb-header-left';
      left.innerHTML = '<button class="wb-header-btn" data-a="imp" title="导入">' + I.imp + '</button><button class="wb-header-btn" data-a="expall" title="导出">' + I.exp + '</button>';
      header.appendChild(left);
      /* [本次修改标注·仅限需求2] 主列表页点击“世情”标题直接返回桌面 */
      renderHomeTitle('世情');
      const right = document.createElement('span'); right.className = 'wb-header-right';
      /* [修改标注·需求5] 在“世情”标题右侧添加搜索世界书按钮 */
      right.innerHTML = '<button class="wb-header-btn" data-a="ts" title="搜索世界书">' + I.search + '</button>';
      header.appendChild(right);
    }
  };

  /* 渲染主函数 */
  const render = () => {
    if (S.openId) {
      const book = findBook(S.openId);
      if (!book) { S.openId = null; render(); return; }
      $c.innerHTML = (S.sOpen ? '<div class="wb-search-bar"><input type="text" placeholder="搜索条目..." value="' + esc(S.sQ) + '" data-a="si"><button data-a="sc">' + I.cls + '</button></div>' : '') + rBookOpen(book);
    } else {
      $c.innerHTML = (S.sOpen ? '<div class="wb-search-bar"><input type="text" placeholder="搜索世界书..." value="' + esc(S.sQ) + '" data-a="si"><button data-a="sc">' + I.cls + '</button></div>' : '') + rGrid();
    }
    $t.innerHTML = '<button class="wb-tab-btn' + (S.tab === 'global' ? ' is-active' : '') + '" data-a="tg" data-tab="global">' + I.globe + ' 全局</button>' +
      '<div class="wb-tab-add-wrapper"><div class="wb-tab-add-bg"></div><button class="wb-tab-add-btn" data-a="na">' + I.add + '</button></div>' +
      '<button class="wb-tab-btn' + (S.tab === 'local' ? ' is-active' : '') + '" data-a="tg" data-tab="local">' + I.pin + ' 局部</button>';
    renderHeader();
  };

  /* 新建世界书弹窗 */
  const openNewBookMod = () => {
    openMod({ title: '新建世界书', okTxt: '创建',
      body: '<div class="wb-form-group"><label>名称</label><input id="wbnbn" type="text" placeholder="世界书名称"></div>' +
        '<div class="wb-form-group"><label>放置位置</label><div class="wb-position-picker"><div class="wb-position-option is-active" data-nbt="global"><span>' + I.globe + ' 全局</span><span class="wb-position-radio is-checked"></span></div><div class="wb-position-option" data-nbt="local"><span>' + I.pin + ' 局部</span><span class="wb-position-radio"></span></div></div></div>',
      onOpen: el => {
        let selType = 'global';
        el.querySelectorAll('[data-nbt]').forEach(opt => {
          opt.addEventListener('click', () => {
            selType = opt.dataset.nbt;
            el.querySelectorAll('[data-nbt]').forEach(o2 => { o2.classList.toggle('is-active', o2.dataset.nbt === selType); o2.querySelector('.wb-position-radio').classList.toggle('is-checked', o2.dataset.nbt === selType); });
          });
        });
        el._getType = () => selType;
        setTimeout(() => el.querySelector('#wbnbn')?.focus(), 100);
      },
      onOk: el => {
        const n = el.querySelector('#wbnbn')?.value?.trim();
        if (!n) { toast('请输入名称'); return false; }
        const tp = el._getType?.() || 'global';
        const nb = mkBook({ name: n, type: tp }); S.books.push(nb); save();
        S.tab = tp; render(); toast('已创建', 'success');
      }
    });
  };

  /* 添加条目弹窗 */
  const openNewEntryMod = bid => {
    openMod({ title: '新建条目', okTxt: '添加',
      body: '<div class="wb-form-group"><label>条目名称</label><input id="wbnen" type="text" placeholder="输入名称"></div>',
      onOpen: el => setTimeout(() => el.querySelector('#wbnen')?.focus(), 100),
      onOk: el => {
        const n = el.querySelector('#wbnen')?.value?.trim();
        if (!n) { toast('请输入名称'); return false; }
        const book = findBook(bid); if (!book) return;
        const ne = mkEntry({ name: n }); book.entries.push(ne); save();
        S.expEnt.add(ne.id); render(); toast('已添加', 'success');
      }
    });
  };

  /* 文件导入 */
  const handleImport = async file => {
    try {
      const fn = file.name.toLowerCase();
      if (fn.endsWith('.json')) {
        const txt = await file.text(); const obj = sj(txt);
        if (!obj) { toast('JSON 解析失败', 'error'); return; }
        const wb = parseTavWB(obj, file.name.replace(/\.json$/i, ''));
        if (wb) { wb.type = S.tab; S.books.push(wb); save(); render(); toast('导入成功: ' + wb.entries.length + ' 条目', 'success'); }
        else { toast('未找到有效世界书数据', 'error'); }
      } else if (fn.endsWith('.png')) {
        const buf = await file.arrayBuffer(); const chs = parsePng(buf); const obj = extObj(chs);
        if (!obj) { toast('PNG中未找到数据', 'error'); return; }
        const cb = extCB(obj);
        if (cb) { const wb = parseTavWB(cb, file.name.replace(/\.png$/i, '')); if (wb) { wb.type = S.tab; S.books.push(wb); save(); render(); toast('导入成功', 'success'); return; } }
        const wb = parseTavWB(obj, file.name.replace(/\.png$/i, ''));
        if (wb) { wb.type = S.tab; S.books.push(wb); save(); render(); toast('导入成功', 'success'); }
        else { toast('未找到世界书数据', 'error'); }
      } else { toast('不支持的文件格式', 'error'); }
    } catch (err) { toast('导入出错', 'error'); console.error(err); }
  };

  /* 导出全部 */
  const exportAll = () => {
    const bs = curBooks();
    if (!bs.length) { toast('无可导出的世界书'); return; }
    bs.forEach(b => { const d = { name: b.name, entries: {} }; b.entries.forEach((e, i) => { d.entries[i] = { comment: e.name, content: e.content, key: e.keywords, order: e.order, constant: e.triggerType === 'always', position: e.position === 'top' ? 4 : (e.position === 'beforeChar' ? 0 : 1), disable: e.disableRecursion, enabled: e.enabled }; }); dlJson(b.name + '.json', d); });
    toast('已导出 ' + bs.length + ' 本', 'success');
  };

  /* 事件代理 */
  const onClick = ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (!a) return;

    if (a === 'ob') { const id = ev.target.closest('[data-a="ob"]').dataset.id; S.openId = id; S.sOpen = false; S.sQ = ''; S.expEnt.clear(); render(); return; }
    if (a === 'goback') { S.openId = null; S.sOpen = false; S.sQ = ''; render(); return; }
    if (a === 'gohome') { closeToDesktop(); return; }
    if (a === 'tg') { S.tab = ev.target.closest('[data-a="tg"]').dataset.tab; S.openId = null; render(); return; }
    if (a === 'na') { openNewBookMod(); return; }
    if (a === 'ae') { if (S.openId) openNewEntryMod(S.openId); return; }
    if (a === 'imp') { $fi.click(); return; }
    if (a === 'expall') { exportAll(); return; }
    if (a === 'ts') { S.sOpen = !S.sOpen; if (!S.sOpen) { S.sQ = ''; S.sBooks.clear(); S.sEntries.clear(); } render(); return; }
    if (a === 'sc') { S.sOpen = false; S.sQ = ''; S.sBooks.clear(); S.sEntries.clear(); render(); return; }
    if (a === 'te') { const eid = ev.target.closest('[data-a="te"]').dataset.eid; S.expEnt.has(eid) ? S.expEnt.delete(eid) : S.expEnt.add(eid); render(); return; }
    if (a === 'de') { const el = ev.target.closest('[data-a="de"]'); const eid = el.dataset.eid; const bid = el.dataset.bid; confirmDel('确定删除此条目？', () => { const book = findBook(bid); if (book) { book.entries = book.entries.filter(e => e.id !== eid); save(); render(); toast('已删除', 'success'); } }); return; }
    if (a === 'openpos') { const el = ev.target.closest('[data-a="openpos"]'); openPositionPicker(el.dataset.pos || 'afterChar', el.dataset.eid, el.dataset.bid); return; }
    if (a === 'opentrigger') { const el = ev.target.closest('[data-a="opentrigger"]'); openTriggerPicker(el.dataset.trigger || 'keyword', el.dataset.eid, el.dataset.bid); return; }
    /* [修改标注·需求6] 放大内容编辑区弹窗 */
    if (a === 'expandcontent') { const el = ev.target.closest('[data-a="expandcontent"]'); const eid = el.dataset.eid; const bid = el.dataset.bid; const book = findBook(bid); if (!book) return; const entry = book.entries.find(en => en.id === eid); if (!entry) return; openMod({ title: '编辑内容 - ' + (entry.name || '未命名条目'), okTxt: '保存', body: '<textarea id="wb-expand-content" class="wb-expand-textarea" rows="16" placeholder="输入条目内容">' + esc(entry.content) + '</textarea>', onOk: mel => { const ta = mel.querySelector('#wb-expand-content'); if (ta) { entry.content = ta.value; save(); render(); } } }); return; }
  };

  /* 输入事件 */
  const onInput = ev => {
    const t = ev.target;
    if (t.dataset.a === 'si') { S.sQ = t.value; doSearch(S.sQ); render(); const inp = $c.querySelector('[data-a="si"]'); if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = inp.value.length; } return; }
    const f = t.dataset.f; const eid = t.dataset.eid; const bid = t.dataset.bid;
    if (!f || !eid || !bid) return;
    const book = findBook(bid); if (!book) return;
    const entry = book.entries.find(e => e.id === eid); if (!entry) return;
    if (f === 'name') entry.name = t.value;
    else if (f === 'content') entry.content = t.value;
    else if (f === 'order') entry.order = parseInt(t.value) || 0;
    else if (f === 'keywords') entry.keywords = t.value.split(/[,，]+/).map(k => k.trim()).filter(Boolean);
    save();
  };

  /* checkbox 事件 */
  const onChange = ev => {
    const t = ev.target;
    if (t.type !== 'checkbox') return;
    const f = t.dataset.f; const eid = t.dataset.eid; const bid = t.dataset.bid;
    if (!f || !eid || !bid) return;
    const book = findBook(bid); if (!book) return;
    const entry = book.entries.find(e => e.id === eid); if (!entry) return;
    entry[f] = t.checked;
    save();
    if (f === 'enabled') { const card = t.closest('.wb-entry-card'); if (card) { const badge = card.querySelector('.wb-entry-card__status-badge'); if (badge) { badge.textContent = t.checked ? 'ON' : 'OFF'; badge.className = 'wb-entry-card__status-badge ' + (t.checked ? 'wb-entry-card__status-badge--on' : 'wb-entry-card__status-badge--off'); } } }
  };

  /* [修改标注·需求4] 长按世界书封面 */
  const onPointerDown = ev => {
    const card = ev.target.closest('.wb-book-card[data-a="ob"]');
    if (!card) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      ev.preventDefault();
      const bid = card.dataset.id; const book = findBook(bid);
      if (book) openBookLongPressMenu(book);
      card.dataset._lp = '1';
    }, 600);
  };
  const onPointerUp = ev => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    const card = ev.target.closest('.wb-book-card[data-a="ob"]');
    if (card && card.dataset._lp === '1') { ev.preventDefault(); ev.stopPropagation(); delete card.dataset._lp; }
  };

  /* 标题点击 */
  const onHeaderClick = ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a;
    if (a === 'gohome') { closeToDesktop(); return; }
    if (a === 'goback') { S.openId = null; S.sOpen = false; S.sQ = ''; render(); return; }
    if (a === 'imp') { $fi.click(); return; }
    if (a === 'expall') { exportAll(); return; }
    if (a === 'ts') { S.sOpen = !S.sOpen; if (!S.sOpen) { S.sQ = ''; S.sBooks.clear(); S.sEntries.clear(); } render(); return; }
    if (a === 'ae') { if (S.openId) openNewEntryMod(S.openId); return; }
  };

  $fi.addEventListener('change', ev => { const f = ev.target.files?.[0]; if (f) handleImport(f); $fi.value = ''; });

  $c.addEventListener('click', onClick);
  $c.addEventListener('input', onInput);
  $c.addEventListener('change', onChange);
  $c.addEventListener('pointerdown', onPointerDown);
  $c.addEventListener('pointerup', onPointerUp);
  $c.addEventListener('pointercancel', onPointerUp);
  $t.addEventListener('click', onClick);
  if (header) header.addEventListener('click', onHeaderClick);

  /* [修改标注·需求1] 监听档案应用角色卡导入事件，并同步角色卡自带世界书到世情局部板块 */
  const onCharImported = (data) => {
    if (!data || !Array.isArray(data.worldBooks)) return;
    let changed = false;
    data.worldBooks.forEach((wb, index) => {
      const raw = wb?.raw && typeof wb.raw === 'object' ? wb.raw : (wb && typeof wb === 'object' ? wb : null);
      if (!raw) return;
      if (importArchiveWorldBook({
        characterId: data.characterId || null,
        sourceKey: wb?.sourceKey || `${data.characterId || 'char'}::${index}`,
        name: wb?.name || raw?.name || raw?.title || '角色卡世界书',
        raw
      })) {
        changed = true;
      }
    });
    if (changed) {
      save();
      render();
    }
  };
  if (eventBus) eventBus.on('character:imported', onCharImported);

  render();

  /* unmount */
  return () => {
    $c.removeEventListener('click', onClick);
    $c.removeEventListener('input', onInput);
    $c.removeEventListener('change', onChange);
    $c.removeEventListener('pointerdown', onPointerDown);
    $c.removeEventListener('pointerup', onPointerUp);
    $c.removeEventListener('pointercancel', onPointerUp);
    $t.removeEventListener('click', onClick);
    if (header) header.removeEventListener('click', onHeaderClick);
    if (eventBus) eventBus.off('character:imported', onCharImported);
    if (closeBtn) closeBtn.style.display = '';
    if (actionsEl) actionsEl.style.display = '';
    if (titleEl) { titleEl.textContent = ''; titleEl.style.cursor = ''; delete titleEl.dataset.a; }
    header?.querySelectorAll('.wb-header-left,.wb-header-right').forEach(el => el.remove());
    if (longPressTimer) clearTimeout(longPressTimer);
    if (tTmr) clearTimeout(tTmr);
  };
}

export function unmount() {}
