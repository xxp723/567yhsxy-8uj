// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-utils.js
 * 用途: 闲谈应用 — 跨子模块共享的常量、图标、工具函数
 *       供 index.js、chat-list.js、contacts.js、chat-message.js、profile.js 共同导入使用。
 *       所有涉及持久化存储的代码使用项目中的 DB.js（IndexedDB），禁止 localStorage/sessionStorage。
 * 架构层: 应用层（闲谈公共模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义（底部TAB栏 + 顶部栏用）
   ========================================================================== */
export const TAB_ICONS = {
  /* [区域标注] 返回桌面 ">" 图标 */
  back: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注] "+" 添加按钮图标 */
  plus: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 8v32M8 24h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 聊天列表 TAB 图标（消息气泡） */
  chat: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 19.5h20M14 27.5h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 通讯录 TAB 图标（通讯录/书本） */
  contacts: `<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="4" width="32" height="40" rx="2" stroke="currentColor" stroke-width="3"/><path d="M18 18h12M18 26h8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M4 12h4M4 24h4M4 36h4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 朋友圈 TAB 图标（地球/动态） */
  moments: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c-5.333 6.667-8 13.333-8 20s2.667 13.333 8 20c5.333-6.667 8-13.333 8-20s-2.667-13.333-8-20Z" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注] 用户主页 TAB 图标（人物） */
  profile: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 24a10 10 0 1 0 0-20a10 10 0 0 0 0 20Z" stroke="currentColor" stroke-width="3"/><path d="M8 42a16 16 0 0 1 32 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 关闭弹窗 X 图标 */
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·本次需求5] IconPark — 多选转发图标 */
  forward: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 10l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 22H20c-8 0-12 4-12 12v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·收藏功能] IconPark — 收藏 / 搜索 / 筛选图标 */
  favorite: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l5.6 11.4L42 19.2l-9 8.8l2.1 12.4L24 34.5l-11.1 5.9L15 28l-9-8.8l12.4-1.8L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  search: `<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="13" stroke="currentColor" stroke-width="3"/><path d="M31 31l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  filter: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 10h36L28 26v12l-8 4V26L6 10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,

  /* ========================================================================
     [区域标注·本次需求3] 用户主页表情包页 IconPark 图标
     说明：表情包分组、上传、URL 导入等按键图案统一使用 IconPark 风格 SVG。
     ======================================================================== */
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3"/><path d="M16 29c2 4 14 4 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="20" r="2.5" fill="currentColor"/><circle cx="31" cy="20" r="2.5" fill="currentColor"/></svg>`,
  upload: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 16L24 6l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 34v8h32v-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  link: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 29l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 14l3-3a10 10 0 0 1 14 14l-3 3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 34l-3 3a10 10 0 0 1-14-14l3-3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* ===== 闲谈表情包本地文件导入：IconPark 文件图标 START ===== */
  fileText: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 4h16l8 8v32H12V4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M28 4v10h10" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 24h12M18 31h12M18 38h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
  /* ===== 闲谈表情包本地文件导入：IconPark 文件图标 END ===== */
};

/* ==========================================================================
   [区域标注] 共享常量定义
   ========================================================================== */
export const APP_ID = 'chat';
export const STORE_NAME = 'appsData';
export const ARCHIVE_DB_RECORD_ID = 'archive::archive-data';

/* [修改5] 以下 key 函数按 maskId 生成独立 key */
export const DATA_KEY_SESSIONS = (maskId) => `chat_sessions_${maskId || 'default'}`;
/* === [本次修改] 聊天列表长按删除联系人：只记录隐藏的聊天会话 ID，保留通讯录与其它聊天数据 === */
export const DATA_KEY_HIDDEN_CHAT_IDS = (maskId) => `chat_hidden_chat_ids_${maskId || 'default'}`;
export const DATA_KEY_CONTACTS = (maskId) => `chat_contacts_${maskId || 'default'}`;
/* [区域标注·本次需求1] 通讯录自定义分组按当前面具身份隔离存储 */
export const DATA_KEY_CONTACT_GROUPS = (maskId) => `chat_contact_groups_${maskId || 'default'}`;
export const DATA_KEY_MOMENTS = (maskId) => `chat_moments_${maskId || 'default'}`;
export const DATA_KEY_MESSAGES_PREFIX = (maskId) => `chat_msgs_${maskId || 'default'}_`;
/* ========================================================================
   ===== 闲谈聊天设置按联系人独立存储 START =====
   说明：
   1. 聊天消息页设置按"当前面具 + 当前聊天对象"写入 DB.js / IndexedDB。
   2. 不同联系人可拥有不同的表情包挂载、时间感知、当前指令、思维链、气泡数量与短期记忆设置。
   3. 禁止 localStorage/sessionStorage，且不写双份兜底存储。
   ======================================================================== */
export const DATA_KEY_CHAT_PROMPT_SETTINGS = (maskId, chatId) => `chat_prompt_settings_${maskId || 'default'}_${chatId || 'default'}`;
export function getCurrentChatPromptSettingsKey(state) {
  return DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId, state.currentChatId || 'default');
}
/* ===== 闲谈聊天设置按联系人独立存储 END ===== */

/* ========================================================================
   [区域标注·本次需求3] 用户主页表情包数据键
   ======================================================================== */
export const DATA_KEY_STICKERS = 'chat_stickers_global';
/* ========================================================================
   [区域标注·已完成·本次钱包需求] 用户主页钱包数据键
   说明：
   1. 钱包数据按当前面具身份隔离存储。
   2. 只使用 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   3. 余额基础值统一按人民币 CNY 保存，展示币种可切换为 USD / JPY / KRW / EUR。
   ======================================================================== */
export const DATA_KEY_WALLET = (maskId) => `chat_wallet_${maskId || 'default'}`;
/* ========================================================================
   [区域标注·已完成·收藏持久化] 收藏数据键
   ======================================================================== */
export const DATA_KEY_FAVORITES = (maskId) => `chat_favorites_${maskId || 'default'}`;

export const PANEL_KEYS = ['chatList', 'contacts', 'moments', 'profile'];
export const PANEL_LABELS = ['Chat', 'Contacts', 'Moments', 'Me'];
export const PANEL_ICON_KEYS = ['chat', 'contacts', 'moments', 'profile'];
/* [修改4] IconPark — 返回箭头图标 */
export const ICON_BACK = `<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* [修改4] IconPark — 勾选图标 */
export const ICON_CHECK = `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ==========================================================================
   [区域标注] CSS 动态加载工具函数（优化：返回 Promise，等待 CSS 加载完毕再渲染）
   说明：将闲谈应用的 CSS 直接注入 <head>，挂载时加载，卸载时移除
   ========================================================================== */
export function loadCSS(href, id) {
  return new Promise((resolve) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === '1' || existing.sheet) {
        resolve();
        return;
      }
      const done = () => {
        existing.dataset.loaded = '1';
        resolve();
      };
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', done, { once: true });
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = id;
    const done = () => {
      link.dataset.loaded = '1';
      resolve();
    };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true }); // 即使加载失败也不阻塞
    document.head.appendChild(link);
  });
}

export function removeCSS(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ==========================================================================
   [区域标注] DB 数据读写封装（使用 IndexedDB，禁止浏览器同步键值存储）
   说明：所有数据存储在 appsData 仓库，key 为 id 字段
   ========================================================================== */
export async function dbGet(db, key) {
  try {
    const record = await db.get(STORE_NAME, key);
    return record ? record.data : null;
  } catch { return null; }
}

export async function dbPut(db, key, data) {
  try {
    await db.put(STORE_NAME, { id: key, appId: APP_ID, data });
  } catch (e) { console.error('[Chat] DB 写入失败:', key, e); }
}

/* ==========================================================================
   [区域标注·本次需求1/2] 通讯录工具函数
   说明：仅服务通讯录分组、搜索添加联系人弹窗；持久化统一走 DB.js / IndexedDB
   ========================================================================== */
export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

export function normalizeContactGroups(groups) {
  return Array.isArray(groups)
    ? groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
}

export function normalizeContacts(contacts) {
  return Array.isArray(contacts)
    ? contacts.map(contact => ({
        ...contact,
        groupId: String(contact?.groupId || '').trim()
      }))
    : [];
}

/* ========================================================================
   [区域标注·本次需求3] 表情包数据规范化
   说明：All 是固定默认分组，不写入 groups；表情包条目与分组数据只来自 IndexedDB。
   ======================================================================== */
export function normalizeStickerData(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
  const validGroupIds = new Set(['all', ...groups.map(group => group.id)]);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : (Array.isArray(source.stickers) ? source.stickers : []);
  const items = rawItems
    .map(item => ({
      id: String(item?.id || '').trim(),
      groupId: validGroupIds.has(String(item?.groupId || 'all')) ? String(item?.groupId || 'all') : 'all',
      name: String(item?.name || '').trim(),
      url: String(item?.url || '').trim(),
      source: String(item?.source || 'url'),
      createdAt: Number(item?.createdAt || Date.now())
    }))
    .filter(item => item.id && item.name && item.url);
  const activeGroupId = validGroupIds.has(String(source.activeGroupId || 'all')) ? String(source.activeGroupId || 'all') : 'all';

  return { activeGroupId, groups, items };
}

/* ==========================================================================
   [区域标注·已完成·收藏数据规范化]
   说明：All 为固定默认大分组；收藏卡片可归属大分组/组内小分组。
         此区域已完成，后续修改收藏数据结构可直接从这里开始。
   ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·本次钱包需求] 钱包数据规范化
   说明：
   1. balanceBaseCny 始终保存为人民币基础余额。
   2. displayCurrency 只控制钱包页面显示的货币单位与换算结果。
   3. rates 表示 1 CNY 可兑换的目标币种数量；CNY 固定为 1。
   ========================================================================== */
export function normalizeWalletData(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const safeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const displayCurrency = ['CNY', 'USD', 'JPY', 'KRW', 'EUR'].includes(String(source.displayCurrency || 'CNY'))
    ? String(source.displayCurrency || 'CNY')
    : 'CNY';

  return {
    balanceBaseCny: Math.max(0, safeNumber(source.balanceBaseCny, 0)),
    displayCurrency,
    rates: {
      CNY: 1,
      USD: Math.max(0, safeNumber(source?.rates?.USD, 0.14)),
      JPY: Math.max(0, safeNumber(source?.rates?.JPY, 21.5)),
      KRW: Math.max(0, safeNumber(source?.rates?.KRW, 191)),
      EUR: Math.max(0, safeNumber(source?.rates?.EUR, 0.13))
    },
    updatedAt: Math.max(0, safeNumber(source.updatedAt, Date.now()))
  };
}

export function normalizeFavoriteData(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
  const validGroupIds = new Set(['all', ...groups.map(group => group.id)]);
  const subGroups = Array.isArray(source.subGroups)
    ? source.subGroups
        .map(group => ({
          id: String(group?.id || '').trim(),
          parentGroupId: validGroupIds.has(String(group?.parentGroupId || 'all')) ? String(group?.parentGroupId || 'all') : 'all',
          name: String(group?.name || '').trim(),
          createdAt: Number(group?.createdAt || Date.now())
        }))
        .filter(group => group.id && group.name)
    : [];
  const validSubGroupIds = new Set(subGroups.map(group => group.id));
  const items = Array.isArray(source.items)
    ? source.items
        .map(item => {
          const messages = Array.isArray(item?.messages)
            ? item.messages
                .map(message => ({
                  id: String(message?.id || '').trim(),
                  role: String(message?.role || 'user'),
                  type: String(message?.type || ''),
                  content: String(message?.content || ''),
                  stickerName: String(message?.stickerName || ''),
                  stickerUrl: String(message?.stickerUrl || ''),
                  timestamp: Number(message?.timestamp || 0) || Date.now()
                }))
                .filter(message => message.id && message.content)
            : [];
          const groupId = validGroupIds.has(String(item?.groupId || 'all')) ? String(item?.groupId || 'all') : 'all';
          const subGroupId = validSubGroupIds.has(String(item?.subGroupId || '')) ? String(item?.subGroupId || '') : '';
          return {
            id: String(item?.id || '').trim(),
            name: String(item?.name || '').trim(),
            groupId,
            subGroupId,
            messages,
            createdAt: Number(item?.createdAt || Date.now()),
            updatedAt: Number(item?.updatedAt || item?.createdAt || Date.now()),
            sourceChatId: String(item?.sourceChatId || '')
          };
        })
        .filter(item => item.id && item.messages.length)
    : [];
  const activeGroupId = validGroupIds.has(String(source.activeGroupId || 'all')) ? String(source.activeGroupId || 'all') : 'all';
  const sortMode = ['name', 'updatedAt', 'messageTime'].includes(String(source.sortMode || 'updatedAt')) ? String(source.sortMode || 'updatedAt') : 'updatedAt';

  return {
    activeGroupId,
    groups,
    subGroups,
    items,
    sortMode,
    searchOpen: Boolean(source.searchOpen),
    searchKeyword: String(source.searchKeyword || '')
  };
}

export async function persistFavoriteData(state, db) {
  state.favoriteData = normalizeFavoriteData(state.favoriteData);
  await dbPut(db, DATA_KEY_FAVORITES(state.activeMaskId), state.favoriteData);
}

/* ==========================================================================
   [区域标注·已完成·本次钱包需求] 钱包数据持久化
   说明：
   1. 钱包余额、显示币种、汇率设置统一只写入 DB.js / IndexedDB。
   2. 不保留任何 localStorage/sessionStorage 读写逻辑，也不写双份兜底代码。
   ========================================================================== */
export async function persistWalletData(state, db) {
  state.walletData = normalizeWalletData(state.walletData);
  await dbPut(db, DATA_KEY_WALLET(state.activeMaskId), state.walletData);
}

/* ==========================================================================
   ===== 闲谈表情包持久化修复：IndexedDB 专用读写 START =====
   说明：
   1. 表情包独立页所有表情包分组/条目统一走 DB.js / IndexedDB。
   2. 读取兼容 IndexedDB 中既有 record.data 与历史 record.value 形态，避免刷新后被误判为空。
   3. 禁止 localStorage/sessionStorage，且不写双份兜底存储。
   ========================================================================== */
export async function loadStickerDataFromDb(db) {
  try {
    const record = await db.get(STORE_NAME, DATA_KEY_STICKERS);
    return normalizeStickerData(record ? (record.data ?? record.value ?? null) : null);
  } catch (error) {
    console.error('[Chat] 表情包数据读取失败:', error);
    return normalizeStickerData(null);
  }
}

export async function persistStickerData(state, db) {
  state.stickerData = normalizeStickerData(state.stickerData);
  await dbPut(db, DATA_KEY_STICKERS, state.stickerData);
}
/* ===== 闲谈表情包持久化修复：IndexedDB 专用读写 END ===== */

export function createUid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getActiveMask(state) {
  return state.archiveMasks.find(mask => mask.id === state.activeMaskId) || null;
}

export function getBoundRoleCandidates(state) {
  const activeMask = getActiveMask(state);
  const bindingIds = Array.isArray(activeMask?.roleBindingIds) ? activeMask.roleBindingIds : [];
  return state.archiveCharacters.filter(role => bindingIds.includes(role.id));
}

export function findRoleByContact(state, contactNumber) {
  const safeContact = String(contactNumber || '').trim();
  if (!/^\d{11}$/.test(safeContact)) return null;
  return getBoundRoleCandidates(state).find(role => String(role?.contact || '').trim() === safeContact) || null;
}

/* ==========================================================================
   [区域标注·修改3] 档案数据读取兼容函数
   说明：档案应用使用 record.value；闲谈自身数据使用 record.data。
         此函数仅用于读取档案应用写入的激活面具与面具列表。
   ========================================================================== */
export async function dbGetArchiveData(db, key) {
  try {
    const record = await db.get(STORE_NAME, key);
    return record ? (record.value ?? record.data ?? null) : null;
  } catch { return null; }
}

/* ==========================================================================
   [区域标注] 弹窗内提示文本 / 关闭弹窗
   ========================================================================== */
export function renderModalNotice(container, message) {
  const notice = container.querySelector('[data-role="modal-notice"]');
  if (notice) {
    notice.textContent = message || '';
    notice.classList.toggle('is-visible', Boolean(message));
    return;
  }

  const body = container.querySelector('[data-role="contact-search-results"]');
  if (body) body.innerHTML = `<div class="chat-modal-hint">${escapeHtml(message || '')}</div>`;
}

export function closeModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  if (mask) mask.classList.add('is-hidden');
}
