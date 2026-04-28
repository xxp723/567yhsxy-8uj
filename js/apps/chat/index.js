/**
 * 文件名: js/apps/chat/index.js
 * 用途: 闲谈应用入口模块。
 *       负责加载 CSS、初始化数据、渲染四大板块骨架、
 *       管理板块切换、事件代理、聊天消息页面跳转等。
 *       使用 DB.js（IndexedDB）进行持久化存储，禁止浏览器同步键值存储。
 * 架构层: 应用层（由 AppManager 动态加载）
 */

/* ==========================================================================
   [区域标注] 子模块导入
   说明：四大板块 + 聊天消息页面，各自独立 JS 文件
   ========================================================================== */
import { renderChatList } from './chat-list.js';
import { renderContacts } from './contacts.js';
import { renderMoments } from './moments.js';
import { renderProfile } from './profile.js';
import { renderChatMessage, renderMessageBubble } from './chat-message.js';
import { chat, normalizeChatPromptSettings } from './prompt.js';

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义（底部TAB栏 + 顶部栏用）
   ========================================================================== */
const TAB_ICONS = {
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
   [区域标注] 常量定义
   [修改5] 数据按 maskId 隔离存储，切换面具不会清除其它面具的数据
   ========================================================================== */
const APP_ID = 'chat';
const STORE_NAME = 'appsData';
const ARCHIVE_DB_RECORD_ID = 'archive::archive-data';
/* [修改5] 以下 key 函数按 maskId 生成独立 key */
const DATA_KEY_SESSIONS = (maskId) => `chat_sessions_${maskId || 'default'}`;
/* === [本次修改] 聊天列表长按删除联系人：只记录隐藏的聊天会话 ID，保留通讯录与其它聊天数据 === */
const DATA_KEY_HIDDEN_CHAT_IDS = (maskId) => `chat_hidden_chat_ids_${maskId || 'default'}`;
const DATA_KEY_CONTACTS = (maskId) => `chat_contacts_${maskId || 'default'}`;
/* [区域标注·本次需求1] 通讯录自定义分组按当前面具身份隔离存储 */
const DATA_KEY_CONTACT_GROUPS = (maskId) => `chat_contact_groups_${maskId || 'default'}`;
const DATA_KEY_MOMENTS = (maskId) => `chat_moments_${maskId || 'default'}`;
const DATA_KEY_MESSAGES_PREFIX = (maskId) => `chat_msgs_${maskId || 'default'}_`;
/* [区域标注·本次需求] 聊天消息页设置：当前指令/外部上下文注入/自定义思维链，统一写入 DB.js(IndexedDB) */
const DATA_KEY_CHAT_PROMPT_SETTINGS = (maskId) => `chat_prompt_settings_${maskId || 'default'}`;
/* ========================================================================
   [区域标注·本次需求3] 用户主页表情包数据键
   说明：
   1. 表情包资源是全局共享资产，不因切换用户面具身份而变化。
   2. 不同用户面具只决定 AI 挂载哪些分组；挂载配置继续存到聊天设置里。
   3. 统一写入 DB.js / IndexedDB，禁止 localStorage/sessionStorage。
   ======================================================================== */
const DATA_KEY_STICKERS = 'chat_stickers_global';
const PANEL_KEYS = ['chatList', 'contacts', 'moments', 'profile'];
const PANEL_LABELS = ['Chat', 'Contacts', 'Moments', 'Me'];
const PANEL_ICON_KEYS = ['chat', 'contacts', 'moments', 'profile'];
/* [修改4] IconPark — 返回箭头图标 */
const ICON_BACK = `<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/* [修改4] IconPark — 勾选图标 */
const ICON_CHECK = `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ==========================================================================
   [区域标注] CSS 动态加载工具函数（优化：返回 Promise，等待 CSS 加载完毕再渲染）
   说明：将闲谈应用的 CSS 直接注入 <head>，挂载时加载，卸载时移除
   ========================================================================== */
function loadCSS(href, id) {
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

function removeCSS(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ==========================================================================
   [区域标注] DB 数据读写封装（使用 IndexedDB，禁止浏览器同步键值存储）
   说明：所有数据存储在 appsData 仓库，key 为 id 字段
   ========================================================================== */
async function dbGet(db, key) {
  try {
    const record = await db.get(STORE_NAME, key);
    return record ? record.data : null;
  } catch { return null; }
}

async function dbPut(db, key, data) {
  try {
    await db.put(STORE_NAME, { id: key, appId: APP_ID, data });
  } catch (e) { console.error('[Chat] DB 写入失败:', key, e); }
}

/* ==========================================================================
   [区域标注·本次需求1/2] 通讯录工具函数
   说明：仅服务通讯录分组、搜索添加联系人弹窗；持久化统一走 DB.js / IndexedDB
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

function normalizeContactGroups(groups) {
  return Array.isArray(groups)
    ? groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
}

function normalizeContacts(contacts) {
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
function normalizeStickerData(rawData) {
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
   ===== 闲谈表情包持久化修复：IndexedDB 专用读写 START =====
   说明：
   1. 表情包独立页所有表情包分组/条目统一走 DB.js / IndexedDB。
   2. 读取兼容 IndexedDB 中既有 record.data 与历史 record.value 形态，避免刷新后被误判为空。
   3. 禁止 localStorage/sessionStorage，且不写双份兜底存储。
   ========================================================================== */
async function loadStickerDataFromDb(db) {
  try {
    const record = await db.get(STORE_NAME, DATA_KEY_STICKERS);
    return normalizeStickerData(record ? (record.data ?? record.value ?? null) : null);
  } catch (error) {
    console.error('[Chat] 表情包数据读取失败:', error);
    return normalizeStickerData(null);
  }
}

async function persistStickerData(state, db) {
  state.stickerData = normalizeStickerData(state.stickerData);
  await dbPut(db, DATA_KEY_STICKERS, state.stickerData);
}
/* ===== 闲谈表情包持久化修复：IndexedDB 专用读写 END ===== */

function createUid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getActiveMask(state) {
  return state.archiveMasks.find(mask => mask.id === state.activeMaskId) || null;
}

function getBoundRoleCandidates(state) {
  const activeMask = getActiveMask(state);
  const bindingIds = Array.isArray(activeMask?.roleBindingIds) ? activeMask.roleBindingIds : [];
  return state.archiveCharacters.filter(role => bindingIds.includes(role.id));
}

function findRoleByContact(state, contactNumber) {
  const safeContact = String(contactNumber || '').trim();
  if (!/^\d{11}$/.test(safeContact)) return null;
  return getBoundRoleCandidates(state).find(role => String(role?.contact || '').trim() === safeContact) || null;
}

/* ==========================================================================
   [区域标注·修改3] 档案数据读取兼容函数
   说明：档案应用使用 record.value；闲谈自身数据使用 record.data。
         此函数仅用于读取档案应用写入的激活面具与面具列表。
   ========================================================================== */
async function dbGetArchiveData(db, key) {
  try {
    const record = await db.get(STORE_NAME, key);
    return record ? (record.value ?? record.data ?? null) : null;
  } catch { return null; }
}

/* ==========================================================================
   [区域标注] mount — 应用挂载入口
   说明：由 AppManager 调用，接收容器元素和上下文
   ========================================================================== */
export async function mount(container, context) {
  const { appMeta, eventBus, db, windowManager, settings } = context;

  /* ==========================================================================
     [区域标注·修改5] 并行预加载 CSS + 档案数据
     说明：先加载 CSS 和档案数据，确定当前激活面具后再加载对应面具的聊天数据
     ========================================================================== */
  await Promise.all([
    loadCSS('./js/apps/chat/chat.css', 'chat-app-css'),
    /* [区域标注·本次需求5] 等待聊天消息页 CSS 加载完成，避免首次进入消息页时未样式化 */
    loadCSS('./js/apps/chat/chat-message.css', 'chat-msg-css')
  ]);

  const archiveRecord = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);

  /* [修改5·修改6] 解析档案数据，获取当前激活面具 */
  const archiveData = (archiveRecord && typeof archiveRecord === 'object') ? archiveRecord : {};
  const archiveMasks = Array.isArray(archiveData.masks) ? archiveData.masks : [];
  /* [区域标注·本次需求2] 缓存角色档案，用于通过绑定角色联系方式搜索添加通讯录 */
  const archiveCharacters = Array.isArray(archiveData.characters) ? archiveData.characters : [];
  /* [区域标注·本次修改4] 缓存档案关系网络，供 prompt.js 注入用户面具身份绑定关系 */
  const archiveSupportingRoles = Array.isArray(archiveData.supportingRoles) ? archiveData.supportingRoles : [];
  const archiveRelations = Array.isArray(archiveData.relations) ? archiveData.relations : [];
  const currentActiveMaskId = archiveData.activeMaskId || '';

  /* [修改5] 按当前面具ID加载对应数据 */
  const [sessions, hiddenChatIds, contacts, contactGroups, moments, chatPromptSettings, stickerData] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_HIDDEN_CHAT_IDS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_MOMENTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CHAT_PROMPT_SETTINGS(currentActiveMaskId)),
    loadStickerDataFromDb(db)
  ]);

  /* [区域标注] 应用状态对象 */
  const state = {
    activePanel: 'chatList',        // 当前激活的板块
    chatSubTab: 'all',              // 聊天列表子TAB: all / private / group
    chatSearchKeyword: '',          // 聊天列表搜索词
    sectionCollapsed: {},           // 折叠状态 {private: false, group: false}
    sessions: sessions || [],       // 聊天会话列表
    /* === [本次修改] 聊天列表长按删除联系人：隐藏列表单独持久化，避免删除通讯录/消息/聊天设置 === */
    hiddenChatIds: Array.isArray(hiddenChatIds) ? hiddenChatIds.map(String) : [],
    contacts: normalizeContacts(contacts), // 通讯录好友列表
    /* [区域标注·本次需求1] 通讯录自定义分组；All 为固定默认分组，不写入数组 */
    contactGroups: normalizeContactGroups(contactGroups),
    activeContactGroupId: 'all',
    moments: moments || [],         // 朋友圈动态列表
    profile: {},                    // 用户资料（由面具数据生成）
    currentChatId: null,            // 当前打开的聊天会话 ID（null 表示未打开）
    currentMessages: [],            // 当前聊天消息列表
    destroyed: false,               // 是否已销毁
    /* [修改5] 当前激活面具ID */
    activeMaskId: currentActiveMaskId,
    /* [修改5] 档案面具列表缓存 */
    archiveMasks: archiveMasks,
    /* [区域标注·本次需求2] 档案角色列表缓存，用于通讯录搜索 */
    archiveCharacters: archiveCharacters,
    /* [区域标注·本次修改4] 档案配角与关系网络缓存，用于提示词用户面具身份关系网络 */
    archiveSupportingRoles: archiveSupportingRoles,
    archiveRelations: archiveRelations,
    /* [区域标注·本次需求] 聊天提示词设置：从 IndexedDB 读取，禁止浏览器同步键值存储 */
    chatPromptSettings: normalizeChatPromptSettings(chatPromptSettings),
    /* [区域标注·本次需求3] 表情包分组与条目：全局共享资产，只从 IndexedDB 读取 */
    stickerData: normalizeStickerData(stickerData),
    /* [区域标注·本次需求3] 聊天消息页表情包面板运行时状态 */
    stickerPanelOpen: false,
    stickerPanelGroupId: normalizeStickerData(stickerData).activeGroupId || 'all',
    coffeeDockOpen: false,
    /* [区域标注·本次需求] 聊天 API 调用状态 */
    isAiSending: false,
    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡选择状态
       说明：仅保存在运行时；消息持久化仍只写 DB.js / IndexedDB。
       ========================================================================== */
    selectedMessageId: '',
    multiSelectMode: false,
    selectedMessageIds: [],
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: '',
    /* ===== 闲谈：删除消息二次确认 END ===== */
    /* [修改4] 用于子页面导航的堆栈标记 */
    subPageView: null,              // null | 'wallet' | 'sticker' | 'chatDaysDetail'
    /* [区域标注·本次需求2] 表情包独立页多选删除运行时状态 */
    stickerMultiSelectMode: false,
    selectedStickerIds: [],
    /* [区域标注·本次需求3] 表情包本地上传临时预览，不持久化；确认后才写入 IndexedDB */
    pendingStickerLocalFile: null,
    /* [区域标注·本次需求3] 表情包独立页单击放大预览延迟计时器；仅运行时使用，不持久化 */
    stickerPreviewClickTimer: 0
  };

  /* [修改4·修改6] 根据当前面具构建 profile 数据 */
  buildProfileFromMask(state);

  /* [区域标注] 渲染应用骨架 HTML */
  container.innerHTML = buildAppShell(state);

  /* [区域标注] 绑定全局事件代理 */
  const clickHandler = (e) => handleClick(e, state, container, db, eventBus, windowManager, appMeta, settings);
  const inputHandler = (e) => handleInput(e, state, container, db);
  const keydownHandler = (e) => handleKeydown(e, state, container, db, settings);
  /* [区域标注·本次需求2] 表情包独立页双击进入多选删除 */
  const dblClickHandler = (e) => handleDoubleClick(e, state, container);
  /* [区域标注·本次需求3] 表情包本地上传文件选择事件 */
  const changeHandler = (e) => handleChange(e, state, container, db);
  /* [区域标注·本次需求1] 通讯录分组长按删除事件：使用自定义应用内弹窗，不使用原生 confirm */
  const contactGroupLongPressHandlers = createContactGroupLongPressHandlers(state, container);
  /* [区域标注·本次需求3] 表情包分组长按删除事件：使用自定义应用内弹窗，不使用原生 confirm */
  const stickerGroupLongPressHandlers = createStickerGroupLongPressHandlers(state, container);
  /* === [本次修改] 聊天列表长按删除联系人：应用内确认弹窗，不使用原生 confirm === */
  const chatListLongPressHandlers = createChatListLongPressHandlers(state, container);
  container.addEventListener('click', clickHandler);
  container.addEventListener('input', inputHandler);
  container.addEventListener('keydown', keydownHandler);
  container.addEventListener('dblclick', dblClickHandler);
  container.addEventListener('change', changeHandler);
  container.addEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', stickerGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', stickerGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', stickerGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', stickerGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', stickerGroupLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', chatListLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', chatListLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', chatListLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', chatListLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', chatListLongPressHandlers.contextmenu);

  /* ==========================================================================
     [区域标注·修改5] 监听档案应用面具切换事件
     说明：当用户在档案应用中切换激活面具时，自动刷新闲谈四大板块
           切换前先保存当前面具的数据，切换后加载新面具的数据
     ========================================================================== */
  const onMaskChanged = async (payload) => {
    if (state.destroyed) return;
    const newMaskId = payload?.maskId || '';
    const oldMaskId = state.activeMaskId;

    /* 保存旧面具数据 */
    await saveMaskData(state, db, oldMaskId);

    /* 更新面具 */
    state.activeMaskId = newMaskId;

    /* 重新加载档案数据以获取最新面具列表 */
    const freshArchive = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);
    const freshData = (freshArchive && typeof freshArchive === 'object') ? freshArchive : {};
    state.archiveMasks = Array.isArray(freshData.masks) ? freshData.masks : [];
    /* [区域标注·本次需求2] 面具切换时同步角色档案缓存 */
    state.archiveCharacters = Array.isArray(freshData.characters) ? freshData.characters : [];
    /* [区域标注·本次修改4] 面具切换时同步档案关系网络缓存 */
    state.archiveSupportingRoles = Array.isArray(freshData.supportingRoles) ? freshData.supportingRoles : [];
    state.archiveRelations = Array.isArray(freshData.relations) ? freshData.relations : [];

    /* 加载新面具的数据 */
    await loadMaskData(state, db, newMaskId);

    /* 重建 profile */
    buildProfileFromMask(state);

    /* 重新渲染全部板块 */
    container.innerHTML = buildAppShell(state);
  };
  eventBus.on('archive:active-mask-changed', onMaskChanged);

  /* [区域标注] 返回实例（含 destroy 清理函数） */
  return {
    destroy() {
      state.destroyed = true;
      container.removeEventListener('click', clickHandler);
      container.removeEventListener('input', inputHandler);
      container.removeEventListener('keydown', keydownHandler);
      container.removeEventListener('dblclick', dblClickHandler);
      container.removeEventListener('change', changeHandler);
      container.removeEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', stickerGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', stickerGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', stickerGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', stickerGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', stickerGroupLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', chatListLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', chatListLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', chatListLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', chatListLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', chatListLongPressHandlers.contextmenu);
      eventBus.off('archive:active-mask-changed', onMaskChanged);
      removeCSS('chat-app-css');
      removeCSS('chat-msg-css');
    }
  };
}

/* ==========================================================================
   [区域标注] unmount — 应用卸载
   ========================================================================== */
export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}

/* ==========================================================================
   [区域标注] 构建应用骨架 HTML
   说明：包含顶部栏、四大板块容器、底部悬浮TAB栏、弹窗层
   ========================================================================== */
function buildAppShell(state) {
  return `
    <!-- [区域标注] 闲谈应用根容器 -->
    <!-- [区域标注·本次需求2] data-active-panel 用于精确控制通讯录/朋友圈/用户主页标题栏顶部间距 -->
    <div class="chat-app" data-role="chat-app-root" data-active-panel="${state.activePanel}">

      <!-- ================================================================
           [区域标注] 顶部导航栏
           说明：左上角">"返回桌面，中间花体字"Chat"，右上角"+"添加
           ================================================================ -->
      <div class="chat-top-bar">
        <!-- [区域标注·本次需求4] Chat/Contacts 标题组：右侧紧跟缩小后的 IconPark "+" 按钮 -->
        <div class="chat-top-bar__title-wrap">
          <button class="chat-top-bar__title" data-action="go-home" type="button">Chat</button>
          <button class="chat-top-bar__add" data-action="add-chat" type="button" aria-label="添加">${TAB_ICONS.plus}</button>
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 聊天列表子TAB栏（All / Private / Group）
           说明：仅在聊天列表板块时显示
           ================================================================ -->
      <div class="chat-tabs" data-role="chat-sub-tabs" style="${state.activePanel === 'chatList' ? '' : 'display:none;'}">
        <button class="chat-tab-btn ${state.chatSubTab === 'all' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="all">All</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'private' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="private">Private</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'group' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="group">Group</button>
      </div>

      <!-- ================================================================
           [区域标注] 四大板块内容区
           ================================================================ -->
      <!-- [区域标注] 聊天列表板块 -->
      <div class="chat-panel ${state.activePanel === 'chatList' ? 'is-active' : ''}" data-panel="chatList">
        ${renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed)}
      </div>
      <!-- [区域标注] 通讯录板块 -->
      <div class="chat-panel ${state.activePanel === 'contacts' ? 'is-active' : ''}" data-panel="contacts">
        ${renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId)}
      </div>
      <!-- [区域标注] 朋友圈板块 -->
      <div class="chat-panel ${state.activePanel === 'moments' ? 'is-active' : ''}" data-panel="moments">
        ${renderMoments(state.moments)}
      </div>
      <!-- [区域标注] 用户主页板块 -->
      <div class="chat-panel ${state.activePanel === 'profile' ? 'is-active' : ''}" data-panel="profile">
        ${renderProfile(state.profile)}
      </div>

      <!-- ================================================================
           [区域标注] 聊天消息页面容器（初始隐藏，点击聊天条目后显示）
           ================================================================ -->
      <div class="chat-message-page-wrap" data-role="msg-page-wrap" style="display:none;">
      </div>

      <!-- ================================================================
           [区域标注] 底部悬浮 TAB 栏（四大板块切换）
           说明：参照图片1 — 暗色圆角胶囊，选中态椭圆扩展变色
           ================================================================ -->
      <div class="chat-bottom-tab" data-role="bottom-tab">
        ${PANEL_KEYS.map((key, idx) => `
          <!-- [区域标注] 底部TAB: ${PANEL_LABELS[idx]} -->
          <button class="chat-bottom-tab__btn ${state.activePanel === key ? 'is-active' : ''}"
                  data-action="switch-panel" data-panel="${key}">
            ${TAB_ICONS[PANEL_ICON_KEYS[idx]]}
            <span>${PANEL_LABELS[idx]}</span>
          </button>
        `).join('')}
      </div>

      <!-- ================================================================
           [区域标注] 应用内弹窗层（替代原生浏览器弹窗）
           说明：用于搜索通讯录好友并添加到聊天列表等场景
           ================================================================ -->
      <div class="chat-modal-mask is-hidden" data-role="modal-mask">
        <div class="chat-modal-panel" data-role="modal-panel">
          <!-- 弹窗内容由 JS 动态填充 -->
        </div>
      </div>

    </div>
  `;
}

/* ==========================================================================
   [区域标注] 刷新指定板块内容
   说明：局部更新板块 innerHTML，避免整页重建
   ========================================================================== */
function refreshPanel(container, state, panelKey) {
  const panelEl = container.querySelector(`[data-panel="${panelKey}"]`);
  if (!panelEl) return;

  switch (panelKey) {
    case 'chatList':
      panelEl.innerHTML = renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed);
      break;
    case 'contacts':
      panelEl.innerHTML = renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId);
      break;
    case 'moments':
      panelEl.innerHTML = renderMoments(state.moments);
      break;
    case 'profile':
      panelEl.innerHTML = renderProfile(state.profile);
      break;
  }
}

/* ==========================================================================
   [区域标注] 切换底部板块
   ========================================================================== */
function switchPanel(container, state, panelKey) {
  state.activePanel = panelKey;

  /* [区域标注·本次需求2] 同步当前板块标记，供 CSS 单独调整非聊天列表标题栏顶部间距 */
  const rootEl = container.querySelector('[data-role="chat-app-root"]');
  if (rootEl) rootEl.dataset.activePanel = panelKey;

  /* [区域标注] 更新板块显隐 */
  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) el.classList.toggle('is-active', k === panelKey);
  });

  /* [区域标注] 更新底部TAB选中态 */
  container.querySelectorAll('.chat-bottom-tab__btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.panel === panelKey);
  });

  /* [区域标注] 聊天列表子TAB栏仅在聊天列表板块显示 */
  const subTabsEl = container.querySelector('[data-role="chat-sub-tabs"]');
  if (subTabsEl) subTabsEl.style.display = panelKey === 'chatList' ? '' : 'none';

  /* [区域标注] 顶部标题根据板块切换 */
  const titleEl = container.querySelector('.chat-top-bar__title');
  if (titleEl) {
    const titles = { chatList: 'Chat', contacts: 'Contacts', moments: 'Moments', profile: 'Me' };
    titleEl.textContent = titles[panelKey] || 'Chat';
  }

  /* [区域标注·本次需求2] "+"按钮在聊天列表与通讯录板块显示：聊天列表添加聊天，通讯录搜索添加联系人 */
  const addBtn = container.querySelector('.chat-top-bar__add');
  if (addBtn) addBtn.style.display = (panelKey === 'chatList' || panelKey === 'contacts') ? '' : 'none';
}

/* ==========================================================================
   [区域标注] 打开聊天消息页面
   说明：隐藏主界面，显示独立的聊天消息页面
   ========================================================================== */
async function openChatMessage(container, state, db, chatId) {
  const session = state.sessions.find(s => s.id === chatId);
  if (!session) return;

  state.currentChatId = chatId;
  resetMessageSelectionState(state);
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;

  /* [区域标注] 从 IndexedDB 加载该会话的消息记录 */
  state.currentMessages = (await dbGet(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + chatId)) || [];

  /* [区域标注] 隐藏主界面元素，显示消息页面 */
  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const panels = container.querySelectorAll('.chat-panel');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = 'none';
  if (subTabs) subTabs.style.display = 'none';
  if (bottomTab) bottomTab.style.display = 'none';
  panels.forEach(p => p.style.display = 'none');

  if (msgWrap) {
    msgWrap.style.display = 'flex';
    renderCurrentChatMessage(container, state);
  }

  /* [区域标注] 滚动到消息底部 */
  setTimeout(() => {
    const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
    if (listArea) listArea.scrollTop = listArea.scrollHeight;
  }, 50);
}

/* ==========================================================================
   [区域标注] 关闭聊天消息页面，返回聊天列表
   ========================================================================== */
function closeChatMessage(container, state) {
  state.currentChatId = null;
  state.currentMessages = [];
  resetMessageSelectionState(state);
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;

  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = '';
  if (subTabs) subTabs.style.display = state.activePanel === 'chatList' ? '' : 'none';
  if (bottomTab) bottomTab.style.display = '';

  /* [区域标注] 恢复板块显示 */
  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) {
      el.style.display = '';
      el.classList.toggle('is-active', k === state.activePanel);
    }
  });

  if (msgWrap) {
    msgWrap.style.display = 'none';
    msgWrap.innerHTML = '';
  }
}

/* ==========================================================================
   [区域标注·本次修改1] AI 回复气泡延迟工具
   说明：让 AI 同一轮拆分后的消息气泡按真人打字节奏逐条出现。
   ========================================================================== */
function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function getAiBubbleDelayMs(bubbleText, index) {
  const length = String(bubbleText || '').length;
  return Math.min(1300, Math.max(420, 260 + length * 24 + index * 80));
}

/* ==========================================================================
   [区域标注] 发送消息
   说明：将用户输入的消息添加到当前会话的消息列表并持久化
   ========================================================================== */
async function sendMessage(container, state, db, content, settingsManager, options = {}) {
  const userText = String(content || '').trim();
  const triggerAi = options.triggerAi !== false;
  if ((!userText && !options.skipAppendUser) || !state.currentChatId || (triggerAi && state.isAiSending)) return;

  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  /* [区域标注·本次需求] 用户消息入列并写入 IndexedDB */
  /* ===== 闲谈：发送消息去重 START ===== */
  let appendedUserMessage = null;
  if (!options.skipAppendUser) {
    appendedUserMessage = {
      id: `user_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };
    state.currentMessages.push(appendedUserMessage);
  }
  /* ===== 闲谈：发送消息去重 END ===== */

  await persistCurrentMessages(state, db);

  if (userText) {
    session.lastMessage = userText;
    session.lastTime = Date.now();
    await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
  }

  /* ===== 闲谈：发送消息去重 START ===== */
  if (appendedUserMessage) {
    appendCurrentMessageBubble(container, state, appendedUserMessage);
  }
  /* ===== 闲谈：发送消息去重 END ===== */

  /* ===== 闲谈应用：回车只发送用户消息 START ===== */
  if (!triggerAi) return;
  /* ===== 闲谈应用：回车只发送用户消息 END ===== */

  /* ==========================================================================
     [区域标注·本次修改2] 修复纸飞机发送后闪屏
     说明：问题出在发送后连续两次整页重绘聊天消息页：
           第一次渲染用户消息，第二次仅为了显示“正在回复...”又重建整个 msgWrap。
           这里改为只更新发送状态相关 DOM，不重建聊天页面，避免点击纸飞机后闪屏。
     ========================================================================== */
  state.isAiSending = true;
  updateCurrentChatSendingUi(container, state);

  let hasRenderedAiBubble = false;

  try {
    /* ===== 闲谈应用：短期记忆与最新一轮消息 START ===== */
    const promptPayload = buildPromptPayloadForLatestUserRound(state.currentMessages, state.chatPromptSettings.shortTermMemoryRounds);
    /* ===== 闲谈应用：短期记忆与最新一轮消息 END ===== */

    /* [区域标注·本次需求] 调用 prompt.js 的 chat()：按指定顺序组装 messages 后调用设置应用主 API */
    const result = await chat({
      userInput: promptPayload.userInput,
      history: promptPayload.history,
      chatSettings: state.chatPromptSettings,
      settingsManager,
      /* [区域标注·本次需求] 提示词真实上下文：把当前会话/联系人/面具/档案/DB 传给 prompt.js，供 AI 读取有效信息 */
      db,
      activeMaskId: state.activeMaskId,
      currentSession: session,
      currentContact: state.contacts.find(contact => String(contact.id) === String(session.id)) || null,
      archiveData: {
        activeMaskId: state.activeMaskId,
        masks: state.archiveMasks,
        characters: state.archiveCharacters,
        /* [区域标注·本次修改4] 注入档案应用显示的用户面具关系网络 */
        supportingRoles: state.archiveSupportingRoles,
        relations: state.archiveRelations
      },
      /* [区域标注·本次需求3] 把全局表情包资产传给 prompt.js，由当前面具挂载分组决定 AI 可用资源 */
      stickerData: state.stickerData
    });

    const aiMessages = buildAiReplyMessages(result?.rawText || result?.text || '', state);
    for (let index = 0; index < aiMessages.length; index += 1) {
      const message = {
        ...aiMessages[index],
        id: `ai_${Date.now()}_${index}`,
        timestamp: Date.now() + index
      };
      const visibleText = String(message.type === 'sticker' ? message.stickerName || message.content || '表情包' : message.content || '').trim();
      if (index > 0) await sleep(getAiBubbleDelayMs(visibleText, index));
      state.currentMessages.push(message);
      hasRenderedAiBubble = true;
      session.lastMessage = message.type === 'sticker'
        ? `[表情包] ${message.stickerName || '未命名表情包'}`
        : (message.content || '（AI 没有返回内容）');
      session.lastTime = Date.now();
      await persistCurrentMessages(state, db);
      await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
      appendCurrentMessageBubble(container, state, state.currentMessages[state.currentMessages.length - 1]);
    }

    session.lastMessage = aiMessages[aiMessages.length - 1]?.type === 'sticker'
      ? `[表情包] ${aiMessages[aiMessages.length - 1]?.stickerName || '未命名表情包'}`
      : (aiMessages[aiMessages.length - 1]?.content || '（AI 没有返回内容）');
    session.lastTime = Date.now();
  } catch (error) {
    state.currentMessages.push({
      id: `ai_error_${Date.now()}`,
      role: 'assistant',
      content: `API 调用失败：${error?.message || '未知错误'}`,
      timestamp: Date.now()
    });
  } finally {
    state.isAiSending = false;
    await persistCurrentMessages(state, db);
    await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
    if (hasRenderedAiBubble) {
      updateCurrentChatSendingUi(container, state);
    } else {
      renderCurrentChatMessage(container, state);
    }
  }
}

/* ==========================================================================
   [区域标注·本次需求] 持久化当前聊天消息
   说明：统一写入 DB.js / IndexedDB，不使用浏览器同步键值存储。
   ========================================================================== */
async function persistCurrentMessages(state, db) {
  if (!state.currentChatId) return;
  await dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + state.currentChatId, state.currentMessages);
}

/* ==========================================================================
   [区域标注·本次需求3] 聊天消息页表情包发送与 AI 表情包协议解析
   说明：
   1. 用户从底栏表情包面板选择表情包后，直接以表情包消息发送到聊天界面。
   2. AI 可通过 **`[表情] 角色名：表情名或资源ID`** 协议发送已挂载表情包。
   3. 所有消息持久化统一走 DB.js / IndexedDB。
   ========================================================================== */
function getMountedStickerItems(state) {
  const data = normalizeStickerData(state.stickerData);
  const mountedGroupIds = Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
    ? Array.from(new Set(state.chatPromptSettings.mountedStickerGroupIds.map(String).filter(Boolean)))
    : [];
  if (!mountedGroupIds.length) return [];
  if (mountedGroupIds.includes('all')) return data.items;
  return data.items.filter(item => mountedGroupIds.includes(String(item.groupId || 'all')));
}

function getStickerProtocolCandidates(token) {
  const raw = String(token || '').trim();
  if (!raw) return [];

  /* ========================================================================
     [区域标注·本次需求2] AI 表情包协议目标强力归一化
     说明：
     1. 兼容模型把“资源ID：xxx / 表情名：xxx / xxx”混写进 [表情] 内容。
     2. 只在已挂载表情包中匹配；不编造、不兜底到其它存储。
     3. 目标是防止 AI 表情包因轻微掉格式而在聊天界面显示成纯文本协议。
     ======================================================================== */
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[`*_]+/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();

  const candidates = [
    cleaned,
    cleaned.replace(/^(?:资源\s*ID|资源Id|ID|id|表情名|名称)\s*[：:]\s*/i, '').trim()
  ];

  [...cleaned.matchAll(/(?:资源\s*ID|资源Id|ID|id|表情名|名称)\s*[：:]\s*([^；;，,\n]+)/gi)]
    .forEach(match => candidates.push(String(match[1] || '').trim()));

  [...cleaned.matchAll(/sticker_[A-Za-z0-9_:-]+/g)]
    .forEach(match => candidates.push(String(match[0] || '').trim()));

  cleaned.split(/[；;，,\s]+/).forEach(part => candidates.push(part.trim()));

  return Array.from(new Set(
    candidates
      .map(item => String(item || '').replace(/^["'“”]+|["'“”]+$/g, '').trim())
      .filter(Boolean)
  ));
}

function resolveStickerProtocolTarget(token, state) {
  const candidates = getStickerProtocolCandidates(token);
  if (!candidates.length) return null;

  const candidateItems = getMountedStickerItems(state);
  for (const normalizedToken of candidates) {
    const byId = candidateItems.find(item => String(item.id) === normalizedToken);
    if (byId) return byId;

    const byName = candidateItems.find(item => String(item.name) === normalizedToken);
    if (byName) return byName;
  }

  return null;
}

/* ==========================================================================
   [区域标注·本次修改2/3] AI 表情包格式自动修正解析
   说明：
   1. 只使用当前 IndexedDB 读取到的全局表情包数据与当前面具挂载分组。
   2. 不使用 localStorage/sessionStorage，也不做双份存储兜底。
   3. 当 AI 漏写 **`[表情] 角色名：资源ID`** 完整协议时，尝试从资源ID/表情名/关键词补全为内部 sticker 消息。
   ========================================================================== */
function normalizeStickerLooseMatchText(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[`*_#"“”"'《》（）()\[\]【】{}]/g, '')
    .replace(/(?:资源\s*ID|资源Id|表情名|名称|表情包|表情|贴纸|sticker|发送|发个|发一张|来个|给你|我发|刚才|点错了|没发出去|这回|看清楚|看看|吧|啊|呀|呢|了)/gi, '')
    .replace(/[：:；;，,。.!！？?\s-]+/g, '')
    .toLowerCase()
    .trim();
}

function findLooseStickerTargetFromText(text, state) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const exact = resolveStickerProtocolTarget(raw, state);
  if (exact) return exact;

  const mountedItems = getMountedStickerItems(state);
  if (!mountedItems.length) return null;

  const hasStickerIntent = /表情|表情包|贴纸|sticker_|资源\s*ID|资源Id|动图|发.*图|发.*包/i.test(raw);
  const rawLower = raw.toLowerCase();

  const byId = mountedItems.find(item => {
    const id = String(item.id || '').trim();
    return id && rawLower.includes(id.toLowerCase());
  });
  if (byId) return byId;

  const rawLoose = normalizeStickerLooseMatchText(raw);
  if (!rawLoose) return null;

  const byName = mountedItems.find(item => {
    const name = String(item.name || '').trim();
    const nameLoose = normalizeStickerLooseMatchText(name);
    return name && (
      raw.includes(name) ||
      (hasStickerIntent && nameLoose.length >= 2 && (rawLoose.includes(nameLoose) || nameLoose.includes(rawLoose)))
    );
  });

  return byName || null;
}

function createStickerMessagePatchFromTarget(message, sticker) {
  if (!message || !sticker) return null;
  return {
    ...message,
    role: 'assistant',
    type: 'sticker',
    content: `[表情包] ${sticker.name}`,
    stickerId: sticker.id,
    stickerName: sticker.name,
    stickerUrl: sticker.url
  };
}

function repairAiMessageFormatIfPossible(message, state) {
  if (!message || message.role !== 'assistant') return null;
  if (String(message.type || '') === 'sticker' && String(message.stickerUrl || '').trim()) return null;

  const sticker = findLooseStickerTargetFromText(message.content, state);
  return sticker ? createStickerMessagePatchFromTarget(message, sticker) : null;
}

function cleanAiProtocolBlockContent(content) {
  return String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
}

function extractAiProtocolBlocks(rawText) {
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  /* ========================================================================
     [区域标注·本次需求2] AI 回复通用协议强力解析器
     说明：
     1. 优先寻找任意位置的 [回复]/[表情] 协议头，而不是要求整行完全规范。
     2. 兼容漏加 **、漏加反引号、多个协议连写、协议前后夹杂 Markdown 的情况。
     3. 提取后统一转成内部消息对象，聊天界面绝不直接显示原始协议文本。
     ======================================================================== */
  const markerRegex = /(?:\*\*)?\s*`?\s*\[(回复|表情)\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
  const matches = [...visibleText.matchAll(markerRegex)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const contentStart = Number(match.index || 0) + String(match[0] || '').length;
      const contentEnd = nextMatch ? Number(nextMatch.index || visibleText.length) : visibleText.length;
      return {
        type: String(match[1] || '').trim(),
        roleName: String(match[2] || '').trim(),
        content: cleanAiProtocolBlockContent(visibleText.slice(contentStart, contentEnd))
      };
    })
    .filter(item => item.type && item.content);
}

function buildAiReplyMessages(rawText, state) {
  const protocolBlocks = extractAiProtocolBlocks(rawText);
  if (!protocolBlocks.length) {
    const repairedSticker = findLooseStickerTargetFromText(rawText, state);
    if (repairedSticker) {
      return [{
        role: 'assistant',
        type: 'sticker',
        content: `[表情包] ${repairedSticker.name}`,
        stickerId: repairedSticker.id,
        stickerName: repairedSticker.name,
        stickerUrl: repairedSticker.url
      }];
    }

    return splitAiReplyIntoBubbles(rawText, state.chatPromptSettings).map(content => ({
      role: 'assistant',
      content
    }));
  }

  const builtMessages = [];
  protocolBlocks.forEach(block => {
    if (block.type === '表情') {
      const sticker = resolveStickerProtocolTarget(block.content, state) || findLooseStickerTargetFromText(block.content, state);
      if (sticker) {
        builtMessages.push({
          role: 'assistant',
          type: 'sticker',
          content: `[表情包] ${sticker.name}`,
          stickerId: sticker.id,
          stickerName: sticker.name,
          stickerUrl: sticker.url
        });
      }
      /* [区域标注·本次修改2] 表情协议无有效匹配时直接丢弃原始协议，避免 sticker_id 或残缺协议以纯文本气泡露出 */
      return;
    }

    splitStrictSentenceBubbles(block.content).forEach(content => {
      builtMessages.push({
        role: 'assistant',
        content
      });
    });
  });

  return builtMessages.length
    ? builtMessages
    : [{ role: 'assistant', content: '（AI 没有返回内容）' }];
}

async function sendStickerMessage(container, state, db, stickerId, settingsManager, options = {}) {
  if (!state.currentChatId || state.isAiSending) return;

  const data = normalizeStickerData(state.stickerData);
  const sticker = data.items.find(item => String(item.id) === String(stickerId));
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!sticker || !session) return;

  const stickerMessage = {
    id: `user_sticker_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'sticker',
    content: `[表情包] ${sticker.name}`,
    stickerId: sticker.id,
    stickerName: sticker.name,
    stickerUrl: sticker.url,
    timestamp: Date.now()
  };

  state.currentMessages.push(stickerMessage);
  state.stickerPanelOpen = false;
  state.coffeeDockOpen = false;
  session.lastMessage = `[表情包] ${sticker.name}`;
  session.lastTime = Date.now();

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  renderCurrentChatMessage(container, state);

  /* ========================================================================
     [区域标注·本次需求1] 发送表情包后禁止立即调用 API
     说明：
     1. 用户点选表情包只把表情包作为 user 消息入列并写入 IndexedDB。
     2. 只有纸飞机按钮或魔法棒等显式触发点传入 triggerAi:true 时，才允许调用 API。
     3. 不做双份存储兜底，不使用 localStorage/sessionStorage。
     ======================================================================== */
  if (options.triggerAi === true) {
    await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  }
}

/* ==========================================================================
   [区域标注·本次需求] 重新渲染当前聊天消息页
   ========================================================================== */
function renderCurrentChatMessage(container, state, options = {}) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!msgWrap || !session) return;

  /* ===== 闲谈：多选模式滚动锁定 START ===== */
  const listBefore = msgWrap.querySelector('[data-role="msg-list"]');
  const shouldKeepScroll = Boolean(options.keepScroll);
  const previousScrollTop = listBefore ? listBefore.scrollTop : 0;
  /* ===== 闲谈：多选模式滚动锁定 END ===== */

  msgWrap.innerHTML = renderChatMessage(session, state.currentMessages, {
    chatSettings: state.chatPromptSettings,
    isSending: state.isAiSending,
    /* ===== 闲谈应用：用户主页头像连接到消息页 START ===== */
    userProfile: state.profile,
    /* ===== 闲谈应用：用户主页头像连接到消息页 END ===== */

    /* [区域标注·本次需求3] 聊天消息页表情包面板数据 */
    stickerData: state.stickerData,
    stickerPanelGroupId: state.stickerPanelGroupId,
    stickerPanelOpen: state.stickerPanelOpen,
    coffeeDockOpen: state.coffeeDockOpen,

    /* [区域标注·本次需求5] 消息气泡功能栏与多选状态 */
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds,
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: state.deleteConfirmMessageId
    /* ===== 闲谈：删除消息二次确认 END ===== */
  });

  setTimeout(() => {
    const listArea = msgWrap.querySelector('[data-role="msg-list"]');
    if (!listArea) return;
    /* ===== 闲谈：多选模式滚动锁定 START ===== */
    if (shouldKeepScroll) {
      listArea.scrollTop = previousScrollTop;
      return;
    }
    /* ===== 闲谈：多选模式滚动锁定 END ===== */
    listArea.scrollTop = listArea.scrollHeight;
  }, 30);
}

/* ==========================================================================
   [区域标注·本次需求1/5] 增量追加聊天气泡
   说明：
   1. AI 逐条输出气泡时只向 msg-list 追加 DOM，不重建整个消息页，修复闪屏。
   2. 用户点击纸飞机后也优先追加气泡，避免输入栏/顶部栏反复销毁重建。
   ========================================================================== */
function appendCurrentMessageBubble(container, state, message) {
  if (!message || !state.currentChatId) return;

  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!msgWrap || !listArea || !session) {
    renderCurrentChatMessage(container, state);
    return;
  }

  const emptyEl = listArea.querySelector('.msg-empty');
  if (emptyEl) emptyEl.remove();

  listArea.insertAdjacentHTML('beforeend', renderMessageBubble(message, session, {
    userProfile: state.profile,
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds,
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: state.deleteConfirmMessageId
    /* ===== 闲谈：删除消息二次确认 END ===== */
  }));
  listArea.scrollTop = listArea.scrollHeight;
}

/* ========================================================================== 
   ===== 闲谈：气泡功能区局部刷新防闪屏 START =====
   说明：
   1. 点击消息气泡、删除、取消删除确认等只影响少数气泡工具区。
   2. 禁止因此重建整个聊天消息页，避免页面闪烁和输入栏/顶部栏抖动。
   3. 真正删除消息时才更新消息列表，并保持用户当前滚动位置。
   ========================================================================== */
function refreshMessageBubbleRows(container, state, messageIds = []) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!listArea || !session) return false;

  const uniqueIds = Array.from(new Set((messageIds || []).map(id => String(id || '')).filter(Boolean)));
  uniqueIds.forEach(messageId => {
    const row = listArea.querySelector(`.msg-bubble-row[data-message-id="${CSS.escape(messageId)}"]`);
    const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
    if (!row || !message) return;

    row.outerHTML = renderMessageBubble(message, session, {
      userProfile: state.profile,
      selectedMessageId: state.selectedMessageId,
      multiSelectMode: state.multiSelectMode,
      selectedMessageIds: state.selectedMessageIds,
      deleteConfirmMessageId: state.deleteConfirmMessageId
    });
  });

  return true;
}

function refreshCurrentMessageListOnly(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!listArea || !session) {
    renderCurrentChatMessage(container, state, { keepScroll: true });
    return;
  }

  const previousScrollTop = listArea.scrollTop;
  listArea.innerHTML = (state.currentMessages || []).length
    ? state.currentMessages.map(message => renderMessageBubble(message, session, {
        userProfile: state.profile,
        selectedMessageId: state.selectedMessageId,
        multiSelectMode: state.multiSelectMode,
        selectedMessageIds: state.selectedMessageIds,
        deleteConfirmMessageId: state.deleteConfirmMessageId
      })).join('')
    : `<div class="msg-empty"></div>`;
  listArea.scrollTop = previousScrollTop;
}

function updateMultiSelectActionBar(container, state) {
  const bar = container.querySelector('[data-role="msg-multi-action-bar"]');
  if (!bar) return;
  const count = (state.selectedMessageIds || []).length;
  const countEl = bar.querySelector('.msg-multi-action-bar__count');
  if (countEl) countEl.textContent = `已选 ${count} 条`;
  bar.querySelectorAll('[data-action="msg-multi-delete-selected"], [data-action="msg-multi-forward"]').forEach(btn => {
    btn.toggleAttribute('disabled', count <= 0);
  });
}
/* ===== 闲谈：气泡功能区局部刷新防闪屏 END ===== */

/* ==========================================================================
   [区域标注·本次需求5] 消息气泡选择状态工具
   ========================================================================== */
function resetMessageSelectionState(state) {
  state.selectedMessageId = '';
  state.multiSelectMode = false;
  state.selectedMessageIds = [];
  /* ===== 闲谈：删除消息二次确认 START ===== */
  state.deleteConfirmMessageId = '';
  /* ===== 闲谈：删除消息二次确认 END ===== */
}

function getSelectedMessages(state) {
  const selectedSet = new Set((state.selectedMessageIds || []).map(String));
  return (state.currentMessages || []).filter(message => selectedSet.has(String(message.id)));
}

function refreshCurrentSessionLastMessage(state) {
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const latest = [...(state.currentMessages || [])].reverse().find(item => String(item?.content || '').trim());
  session.lastMessage = latest?.type === 'sticker'
    ? `[表情包] ${latest?.stickerName || '未命名表情包'}`
    : (latest?.content || '');
  session.lastTime = latest?.timestamp || Date.now();
}

/* ==========================================================================
   [区域标注·本次需求4] 清空当前聊天全部记录确认弹窗
   说明：从聊天消息页右上角“设置”进入；使用应用内弹窗，不使用原生 confirm/alert。
   ========================================================================== */
function showClearAllMessagesModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  if (!mask || !panel || !session) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求4] 清空全部聊天记录确认弹窗 -->
    <div class="chat-modal-header">
      <span>清空聊天记录</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否清空与“${escapeHtml(session.name || '未命名')}”的全部聊天记录？<br>此操作只清空当前聊天界面的消息，不删除联系人。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-clear-all-messages" type="button">清空</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次修改3] AI 消息格式修正结果弹窗
   说明：消息气泡“修正”按钮无法补全格式时使用应用内弹窗提示，不使用原生 alert/confirm。
   ========================================================================== */
function showAiFormatRepairResultModal(container, { success = false, title = '', message = '' } = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次修改3] AI 消息格式修正提示弹窗 -->
    <div class="chat-modal-header">
      <span>${escapeHtml(title || (success ? '修正完成' : '无法修正'))}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">${escapeHtml(message || (success ? '已将这条 AI 消息修正为表情包消息。' : '未识别到可匹配的已挂载表情包格式或关键词。'))}</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次需求5] 多选转发联系人选择弹窗
   说明：把选中的多条消息转发到聊天列表中其它联系人聊天界面；持久化统一写 IndexedDB。
   ========================================================================== */
function showForwardMessagesModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const selectedMessages = getSelectedMessages(state);
  const targets = getVisibleChatSessions(state).filter(session => String(session.id) !== String(state.currentChatId));

  const targetHtml = targets.length
    ? targets.map(session => `
        <!-- [区域标注·本次需求5] 可转发联系人：${escapeHtml(session.name || '未命名')} -->
        <button class="chat-forward-target" data-action="confirm-forward-messages" data-chat-id="${escapeHtml(session.id)}" type="button">
          <span class="chat-forward-target__avatar">
            ${session.avatar
              ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(session.name || '')}">`
              : escapeHtml((session.name || '?').charAt(0).toUpperCase())}
          </span>
          <span class="chat-forward-target__name">${escapeHtml(session.name || '未命名')}</span>
          <span class="chat-forward-target__icon">${TAB_ICONS.forward}</span>
        </button>
      `).join('')
    : `<div class="chat-modal-hint">暂无其它可转发的聊天联系人。</div>`;

  panel.innerHTML = `
    <!-- [区域标注·本次需求5] 多选消息转发弹窗 -->
    <div class="chat-modal-header">
      <span>转发 ${selectedMessages.length} 条消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${targetHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次修改2] 局部更新聊天发送中状态
   说明：只改顶部状态文字和输入按钮禁用态，不重建消息页，避免纸飞机点击闪屏。
   ========================================================================== */
function updateCurrentChatSendingUi(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (!msgWrap) return;

  const statusEl = msgWrap.querySelector('.msg-top-bar__status');
  if (statusEl) statusEl.textContent = state.isAiSending ? '正在回复...' : '在线';

  msgWrap.querySelectorAll('[data-role="msg-input"], [data-action="msg-magic"], [data-action="msg-send"]').forEach(el => {
    el.toggleAttribute('disabled', Boolean(state.isAiSending));
  });
}

/* ==========================================================================
   ===== 闲谈聊天底栏防闪屏：功能区/表情包区局部刷新 START =====
   说明：
   1. 点击“咖啡”和“表情包”只切换现有 DOM 的 is-open / is-active 状态。
   2. 不再重建整个聊天消息页，避免输入栏、消息列表和顶部栏闪屏。
   3. 仅服务用户提到的聊天底栏功能区/表情包区，不影响其它页面。
   ========================================================================== */
function syncMessageDockOpenState(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (!msgWrap) return;

  const coffeeDock = msgWrap.querySelector('[data-role="msg-feature-dock"]');
  const stickerPanel = msgWrap.querySelector('[data-role="msg-sticker-panel"]');
  const coffeeBtn = msgWrap.querySelector('[data-action="msg-coffee"]');
  const stickerBtn = msgWrap.querySelector('[data-action="msg-sticker"]');

  if (coffeeDock) coffeeDock.classList.toggle('is-open', Boolean(state.coffeeDockOpen));
  if (stickerPanel) stickerPanel.classList.toggle('is-open', Boolean(state.stickerPanelOpen));
  if (coffeeBtn) coffeeBtn.classList.toggle('is-active', Boolean(state.coffeeDockOpen));
  if (stickerBtn) stickerBtn.classList.toggle('is-active', Boolean(state.stickerPanelOpen));
}

function renderMsgStickerPanelGrid(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const panel = msgWrap?.querySelector('[data-role="msg-sticker-panel"]');
  const grid = panel?.querySelector('.msg-sticker-panel__grid');
  if (!grid) {
    renderCurrentChatMessage(container, state, { keepScroll: true });
    return;
  }

  const data = normalizeStickerData(state.stickerData);
  const groupId = String(state.stickerPanelGroupId || 'all');
  const visibleItems = groupId === 'all'
    ? data.items
    : data.items.filter(item => String(item.groupId || 'all') === groupId);

  panel.querySelectorAll('.msg-sticker-panel__group-btn').forEach(btn => {
    btn.classList.toggle('is-active', String(btn.dataset.stickerGroupId || 'all') === groupId);
  });

  grid.innerHTML = visibleItems.length
    ? visibleItems.map(item => `
        <!-- ===== 闲谈聊天底栏防闪屏：局部刷新表情包项 START ===== -->
        <button class="msg-sticker-panel__item"
                data-action="send-msg-sticker"
                data-sticker-id="${escapeHtml(item.id)}"
                type="button"
                title="${escapeHtml(item.name)}">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.name)}</span>
        </button>
        <!-- ===== 闲谈聊天底栏防闪屏：局部刷新表情包项 END ===== -->
      `).join('')
    : `<div class="msg-sticker-panel__empty">当前分组暂无表情包</div>`;
}
/* ===== 闲谈聊天底栏防闪屏：功能区/表情包区局部刷新 END ===== */

/* ==========================================================================
   ===== 闲谈聊天设置页表情包挂载：局部刷新 START =====
   说明：选择挂载分组后只更新按钮选中态，页面继续停留在聊天设置页。
   ========================================================================== */
function syncMountedStickerGroupButtons(container, state) {
  const selectedSet = new Set(
    Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
      ? state.chatPromptSettings.mountedStickerGroupIds.map(String)
      : []
  );

  container.querySelectorAll('[data-action="toggle-mounted-sticker-group"]').forEach(btn => {
    btn.classList.toggle('is-active', selectedSet.has(String(btn.dataset.stickerGroupId || '')));
  });
}
/* ===== 闲谈聊天设置页表情包挂载：局部刷新 END ===== */

/* ==========================================================================
   [区域标注·本次需求] 魔法棒重新回复
   说明：删除最新一轮 AI 回复后，直接用用户最新消息重新调用 API。
   ========================================================================== */
async function retryLatestAiReply(container, state, db, settingsManager) {
  if (!state.currentChatId || state.isAiSending) return;

  for (let i = state.currentMessages.length - 1; i >= 0; i -= 1) {
    if (state.currentMessages[i]?.role === 'assistant') {
      state.currentMessages.splice(i, 1);
      continue;
    }
    break;
  }

  /* ===== 闲谈：用户最新一轮消息触发AI START =====
     说明：魔法棒重新回复使用“用户最新一轮消息”触发。
     sendMessage(skipAppendUser) 会基于 state.currentMessages 调用 buildPromptPayloadForLatestUserRound，
     自动把末尾连续 user 消息合并为“用户最新一轮消息”。 */
  const latestUserRound = [];
  for (let i = state.currentMessages.length - 1; i >= 0; i -= 1) {
    const item = state.currentMessages[i];
    if (item?.role !== 'user') break;
    if (String(item.content || '').trim()) latestUserRound.unshift(item);
  }
  if (!latestUserRound.length) {
    renderCurrentChatMessage(container, state);
    return;
  }

  /* ========================================================================
     [区域标注·本次修改1] 魔法棒重 roll 立即清空旧 AI 回复
     说明：
     1. 先删除最新一轮 AI 回复并立即写入 DB.js / IndexedDB。
     2. 立刻刷新当前消息列表，让旧气泡马上从聊天界面消失。
     3. 再调用 API 重新生成最新一轮回复，不保留旧 AI 气泡到返回列表后才消失。
     ======================================================================== */
  refreshCurrentSessionLastMessage(state);
  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);
  renderCurrentChatMessage(container, state, { keepScroll: true });
  await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  /* ===== 闲谈：用户最新一轮消息触发AI END ===== */
}

/* ===== 闲谈：用户最新一轮消息触发AI START ===== */
function buildPromptPayloadForLatestUserRound(messages = [], shortTermMemoryRounds = 8) {
  const normalized = Array.isArray(messages)
    ? messages.filter(item => item && (item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim())
    : [];

  let latestUserStart = -1;
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (normalized[i].role !== 'user') continue;
    latestUserStart = i;
    while (latestUserStart > 0 && normalized[latestUserStart - 1]?.role === 'user') {
      latestUserStart -= 1;
    }
    break;
  }

  /* 用户最新一轮消息 = 消息末尾往前连续的 user 消息组，而不是最后一条 user 消息 */
  const currentRoundMessages = latestUserStart >= 0 ? normalized.slice(latestUserStart).filter(item => item.role === 'user') : [];
  const userInput = currentRoundMessages.map((item, index) => {
    const content = String(item.content || '').trim();
    return currentRoundMessages.length > 1 ? `第${index + 1}条：${content}` : content;
  }).join('\n');

  const roundLimit = Math.max(0, Math.floor(Number(shortTermMemoryRounds)) || 0);
  const previous = latestUserStart >= 0 ? normalized.slice(0, latestUserStart) : normalized;
  if (roundLimit <= 0) return { userInput, history: [] };

  const rounds = [];
  let current = [];
  previous.forEach(item => {
    if (item.role === 'user' && current.length) {
      rounds.push(current);
      current = [];
    }
    current.push({ role: item.role, content: item.content });
  });
  if (current.length) rounds.push(current);

  return {
    userInput,
    history: rounds.slice(-roundLimit).flat()
  };
}
/* ===== 闲谈：用户最新一轮消息触发AI END ===== */

/* ===== 闲谈应用：AI回复拆分为多个气泡 START ===== */
/* ===== 闲谈：通用消息协议解析 START ===== */
function extractProtocolReplyContents(text) {
  /*
   * ========================================================================
   * [区域标注·本次需求2] 通用消息协议强力约束入口
   * 说明：
   * 1. 统一复用 extractAiProtocolBlocks，不再维护两套容易分叉的协议正则。
   * 2. 只取 [回复] 内容，保证“回复文字消息”不再把协议头原样显示到聊天界面。
   * 3. 这里只负责解析可见文本，不做任何持久化存储。
   * ======================================================================== */
  return extractAiProtocolBlocks(text)
    .filter(block => block.type === '回复')
    .map(block => String(block.content || '').trim())
    .filter(Boolean);
}
/* ===== 闲谈：通用消息协议解析 END ===== */

function splitAiReplyIntoBubbles(text, chatSettings = {}) {
  const raw = sanitizeAiVisibleReply(text);
  if (!raw) return ['（AI 没有返回内容）'];

  const min = Math.max(1, Math.floor(Number(chatSettings.replyBubbleMin || 1)) || 1);
  const max = Math.max(min, Math.floor(Number(chatSettings.replyBubbleMax || min)) || min);

  /* ==========================================================================
     [区域标注·本次修改3] 严格拆分通用消息协议与问号气泡
     说明：
     1. 只识别 prompt.js 的 **`[回复] 角色名：文字消息内容`** 通用协议。
     2. 无论 AI 是否按格式输出，只要同一段里出现多个问句/感叹句/句号句，就强制拆开。
     3. 之前“问号后有空格”不会被 (?=\S) 命中，所以会把两个问句留在同一气泡；这里已修复。
     ========================================================================== */
  const protocolReplyMatches = extractProtocolReplyContents(raw);

  let parts = protocolReplyMatches.length
    ? protocolReplyMatches
    : raw
        .split(/\n{2,}|(?:\s*<bubble>\s*)|(?:\s*<\/bubble>\s*)|(?:\s*\|\|\|\s*)|(?:\s*---气泡---\s*)/i)
        .map(item => item.trim())
        .filter(Boolean);

  parts = parts.flatMap(part => splitStrictSentenceBubbles(part));

  if (parts.length <= 1 && raw.length > 28) {
    parts = raw
      .split(/(?<=[，,、；;])\s*/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  while (parts.length < min && parts.some(item => item.length > 12)) {
    const index = parts.findIndex(item => item.length > 12);
    const item = parts[index];
    const splitAt = Math.ceil(item.length / 2);
    parts.splice(index, 1, item.slice(0, splitAt).trim(), item.slice(splitAt).trim());
  }

  const cleaned = parts.map(item => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, Math.max(max, min)) : ['（AI 没有返回内容）'];
}

/* ==========================================================================
   [区域标注·本次需求2] AI 可见回复清理
   说明：进一步清理模型偶发输出的幕后审查文本，只保留聊天界面应该显示的内容。
   ========================================================================== */
function sanitizeAiVisibleReply(text) {
  let value = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();

  /* ===== 闲谈：通用消息协议解析 START ===== */
  const protocolReplyMatches = extractProtocolReplyContents(value);
  if (protocolReplyMatches.length) {
    value = protocolReplyMatches.join('\n');
  }
  /* ===== 闲谈：通用消息协议解析 END ===== */

  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line && !/^(思考回复内容|思考内容|检查规则|审查规则|拟定句子|检查结果|最终输出|回复格式)\s*[：:]/.test(line))
    .map(line => line.replace(/^气泡\s*\d+\s*[：:]\s*/i, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function splitStrictSentenceBubbles(text) {
  const normalized = String(text || '')
    /* ===== 闲谈：通用消息协议解析 START ===== */
    .replace(/\*\*`?\s*\[回复\]\s*[^：:\n`]+?\s*[：:]\s*/g, '')
    .replace(/`?\*\*/g, '')
    /* ===== 闲谈：通用消息协议解析 END ===== */
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalized) return [];

  return normalized
    .replace(/([。！？!?]+)(?:\s+|(?=\S))/g, '$1\n')
    .replace(/([…]{2,}|[.。]{3,}|、、、)(?:\s+|(?=\S))/g, '$1\n')
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}
/* ===== 闲谈应用：AI回复拆分为多个气泡 END ===== */

/* ==========================================================================
   [区域标注] 显示"添加聊天"弹窗
   说明：搜索通讯录好友，选择后添加到聊天列表并开始对话
   ========================================================================== */
function showAddChatModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  /* [区域标注] 构建弹窗内容 — 好友选择列表 */
  const contactsHtml = state.contacts.length === 0
    ? `<p style="text-align:center;color:rgba(74,52,42,0.45);font-size:13px;padding:20px 0;">暂无通讯录好友<br>请先在档案应用中添加角色</p>`
    : state.contacts.map(c => {
      /* ==========================================================================
         [区域标注·本次需求3] 删除后允许重新添加
         说明：被 hiddenChatIds 隐藏的会话不再显示“已添加”，可再次点击恢复聊天列表。
         ========================================================================== */
      const alreadyAdded = state.sessions.some(s => s.id === c.id) && !state.hiddenChatIds.map(String).includes(String(c.id));
      return `
        <!-- [区域标注] 好友选择项: ${c.name || '未命名'} -->
        <div class="chat-modal-contact ${alreadyAdded ? '' : ''}" 
             data-action="select-contact-for-chat" data-contact-id="${c.id}"
             style="${alreadyAdded ? 'opacity:0.45;pointer-events:none;' : ''}">
          <div class="chat-modal-contact__avatar">
            ${c.avatar
              ? `<img src="${c.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
              : (c.name || '?').charAt(0).toUpperCase()}
          </div>
          <span class="chat-modal-contact__name">${c.name || '未命名'}${alreadyAdded ? ' (已添加)' : ''}</span>
        </div>
      `;
    }).join('');

  panel.innerHTML = `
    <!-- [区域标注] "添加聊天"弹窗 -->
    <div class="chat-modal-header">
      <span>添加聊天</span>
      <button class="chat-modal-close" data-action="close-modal">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search" type="text" placeholder="搜索好友..." data-role="modal-search">
    <div class="chat-modal-body" data-role="modal-body">
      ${contactsHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次需求2] 显示"搜索添加联系人"弹窗
   说明：右上角 + 在通讯录板块触发；只搜索当前用户面具绑定角色的 11 位联系方式
   ========================================================================== */
function showAddContactModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录搜索添加联系人弹窗 -->
    <div class="chat-modal-header">
      <span>添加联系人</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           inputmode="numeric"
           maxlength="11"
           placeholder="输入绑定角色的11位联系方式"
           data-role="contact-add-search-input">
    <div class="chat-modal-body" data-role="contact-search-results">
      <div class="chat-modal-hint">请输入 11 位数字联系方式，搜索当前面具身份绑定的角色。</div>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="contact-add-search-input"]');
    if (input) input.focus();
  }, 30);
}

/* ==========================================================================
   [区域标注·本次需求2] 渲染通讯录搜索结果
   说明：搜索结果右侧使用 IconPark "+" 图标按钮添加到通讯录
   ========================================================================== */
function renderContactSearchResults(container, state, rawValue) {
  const body = container.querySelector('[data-role="contact-search-results"]');
  if (!body) return;

  const contactNumber = String(rawValue || '').replace(/\D/g, '').slice(0, 11);
  const input = container.querySelector('[data-role="contact-add-search-input"]');
  if (input && input.value !== contactNumber) input.value = contactNumber;

  if (!contactNumber) {
    body.innerHTML = `<div class="chat-modal-hint">请输入 11 位数字联系方式，搜索当前面具身份绑定的角色。</div>`;
    return;
  }

  if (!/^\d{11}$/.test(contactNumber)) {
    body.innerHTML = `<div class="chat-modal-hint">联系方式需为 11 位数字。</div>`;
    return;
  }

  const role = findRoleByContact(state, contactNumber);
  if (!role) {
    body.innerHTML = `<div class="chat-modal-hint">未搜索到当前面具绑定的角色。</div>`;
    return;
  }

  const alreadyAdded = state.contacts.some(contact => contact.id === role.id);
  body.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录搜索结果角色：${escapeHtml(role.name || '未命名角色')} -->
    <div class="chat-contact-search-result">
      <div class="chat-contact-search-result__avatar">
        ${role.avatar
          ? `<img src="${escapeHtml(role.avatar)}" alt="${escapeHtml(role.name || '')}">`
          : escapeHtml((role.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-contact-search-result__info">
        <div class="chat-contact-search-result__name">${escapeHtml(role.name || '未命名角色')}</div>
        <div class="chat-contact-search-result__contact">${escapeHtml(role.contact || '')}</div>
      </div>
      <button class="chat-contact-search-result__add ${alreadyAdded ? 'is-added' : ''}"
              data-action="${alreadyAdded ? 'view-contact' : 'add-contact-from-search'}"
              data-role-id="${escapeHtml(role.id)}"
              data-contact-id="${escapeHtml(role.id)}"
              type="button"
              aria-label="${alreadyAdded ? '选择分组' : '添加联系人'}">
        ${alreadyAdded ? ICON_CHECK : TAB_ICONS.plus}
      </button>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·本次需求1] 显示"新建通讯录分组"弹窗
   说明：All 旁边的 "+" 分组按钮触发；使用应用内弹窗，不使用原生浏览器弹窗
   ========================================================================== */
function showCreateContactGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求1] 新建通讯录分组弹窗 -->
    <div class="chat-modal-header">
      <span>新建分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           maxlength="12"
           placeholder="输入分组名称"
           data-role="contact-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-contact-group" type="button">完成</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="contact-group-name-input"]');
    if (input) input.focus();
  }, 30);
}

/* ==========================================================================
   [区域标注·本次需求1/2] 弹窗内提示文本
   说明：替代 alert，用于分组命名和联系人搜索提示
   ========================================================================== */
function renderModalNotice(container, message) {
  const notice = container.querySelector('[data-role="modal-notice"]');
  if (notice) {
    notice.textContent = message || '';
    notice.classList.toggle('is-visible', Boolean(message));
    return;
  }

  const body = container.querySelector('[data-role="contact-search-results"]');
  if (body) body.innerHTML = `<div class="chat-modal-hint">${escapeHtml(message || '')}</div>`;
}

/* ==========================================================================
   [区域标注·本次需求2] 显示联系人分组选择弹窗
   说明：点击已添加联系人后，可选择其所属通讯录分组；All 表示不指定自定义分组
   ========================================================================== */
function showContactGroupPickerModal(container, state, contactId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const contact = state.contacts.find(item => item.id === contactId);
  if (!mask || !panel || !contact) return;

  const groups = Array.isArray(state.contactGroups) ? state.contactGroups : [];
  const currentGroupId = contact.groupId || '';

  const groupButtonsHtml = [
    { id: '', name: 'All' },
    ...groups
  ].map(group => {
    const isActive = currentGroupId === group.id;
    return `
      <!-- [区域标注·本次需求2] 联系人分组选择项：${escapeHtml(group.name)} -->
      <button class="chat-contact-group-choice ${isActive ? 'is-active' : ''}"
              data-action="assign-contact-group"
              data-contact-id="${escapeHtml(contact.id)}"
              data-contact-group-id="${escapeHtml(group.id)}"
              type="button">
        <span>${escapeHtml(group.name)}</span>
        ${isActive ? `<i>${ICON_CHECK}</i>` : ''}
      </button>
    `;
  }).join('');

  panel.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录联系人分组选择弹窗 -->
    <div class="chat-modal-header">
      <span>选择分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-contact-group-picker-head">
      <div class="chat-contact-group-picker-head__avatar">
        ${contact.avatar
          ? `<img src="${escapeHtml(contact.avatar)}" alt="${escapeHtml(contact.name || '')}">`
          : escapeHtml((contact.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-contact-group-picker-head__info">
        <div class="chat-contact-group-picker-head__name">${escapeHtml(contact.name || '未命名')}</div>
        <div class="chat-contact-group-picker-head__tip">选择此联系人所在的通讯录分组</div>
      </div>
    </div>
    <div class="chat-modal-body">
      ${groupButtonsHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注] 关闭弹窗
   ========================================================================== */
function closeModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  if (mask) mask.classList.add('is-hidden');
}

/* ==========================================================================
   === [本次修改] 聊天列表长按删除联系人：仅过滤聊天列表显示 ===
   说明：删除聊天列表联系人时只写入 hiddenChatIds；不删除通讯录联系人、
         不删除消息记录、不清空其它聊天设置；持久化统一走 IndexedDB。
   ========================================================================== */
function getVisibleChatSessions(state) {
  const hiddenSet = new Set(Array.isArray(state.hiddenChatIds) ? state.hiddenChatIds.map(String) : []);
  return (state.sessions || []).filter(session => !hiddenSet.has(String(session.id)));
}

/* ==========================================================================
   === [本次修改] 聊天列表长按删除联系人：长按处理器 ===
   说明：长按聊天条目打开应用内确认弹窗，替代原生 confirm。
   ========================================================================== */
function createChatListLongPressHandlers(state, container) {
  let timer = null;
  let pressedTarget = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pressedTarget = null;
  };

  const openDeleteModal = () => {
    const target = pressedTarget;
    if (!target) return;

    const chatId = target.dataset.chatId || '';
    const exists = chatId && getVisibleChatSessions(state).some(session => String(session.id) === String(chatId));
    if (!exists) return;

    target.dataset.longPressTriggered = '1';
    showDeleteChatListContactModal(container, state, chatId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-chat-list-contact"]');
      if (!target) return;

      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-chat-list-contact"]')) {
        e.preventDefault();
      }
    }
  };
}

/* ==========================================================================
   === [本次修改] 聊天列表长按删除联系人：确认弹窗 ===
   说明：应用内弹窗样式与闲谈/设置风格统一，不使用浏览器原生弹窗。
   ========================================================================== */
function showDeleteChatListContactModal(container, state, chatId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const session = (state.sessions || []).find(item => String(item.id) === String(chatId));
  if (!mask || !panel || !session) return;

  panel.innerHTML = `
    <!-- === [本次修改] 聊天列表长按删除联系人确认弹窗 === -->
    <div class="chat-modal-header">
      <span>删除聊天联系人</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否从聊天列表中删除“${escapeHtml(session.name || '未命名')}”？<br>通讯录联系人、聊天记录和其它聊天设置都会保留。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-chat-list-contact" data-chat-id="${escapeHtml(session.id)}" type="button">删除</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次需求1] 通讯录分组长按删除处理器
   说明：仅除 All 以外的自定义分组可长按删除；删除标签不删除联系人。
   ========================================================================== */
function createContactGroupLongPressHandlers(state, container) {
  let timer = null;
  let pressedTarget = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pressedTarget = null;
  };

  const openDeleteModal = () => {
    const target = pressedTarget;
    if (!target) return;

    const groupId = target.dataset.contactGroupId || '';
    const exists = groupId && groupId !== 'all' && state.contactGroups.some(group => group.id === groupId);
    if (!exists) return;

    target.dataset.longPressTriggered = '1';
    showDeleteContactGroupModal(container, state, groupId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-contact-group"]');
      if (!target) return;

      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-contact-group"]')) {
        e.preventDefault();
      }
    }
  };
}

/* ==========================================================================
   [区域标注·本次需求1] 删除通讯录分组确认弹窗
   说明：应用内弹窗替代原生 confirm；只删除分组标签，联系人保留并回到 All。
   ========================================================================== */
function showDeleteContactGroupModal(container, state, groupId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const group = state.contactGroups.find(item => item.id === groupId);
  if (!mask || !panel || !group) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求1] 删除通讯录分组确认弹窗 -->
    <div class="chat-modal-header">
      <span>删除分组标签</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否删除“${escapeHtml(group.name)}”分组标签？<br>分组内联系人不会被删除，之后只会在 All 中显示。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-contact-group" data-contact-group-id="${escapeHtml(group.id)}" type="button">删除</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注] 点击事件代理处理器
   说明：统一处理应用内所有按钮/列表项的点击事件
   ========================================================================== */
async function handleClick(e, state, container, db, eventBus, windowManager, appMeta, settingsManager) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    /* [区域标注] 返回桌面 */
    case 'go-home':
      eventBus.emit('app:close', { appId: APP_ID });
      break;

    /* [区域标注] 切换底部板块 */
    case 'switch-panel': {
      const panelKey = target.dataset.panel;
      if (panelKey && PANEL_KEYS.includes(panelKey)) {
        switchPanel(container, state, panelKey);
      }
      break;
    }

    /* [区域标注] 切换聊天列表子TAB */
    case 'switch-sub-tab': {
      const subTab = target.dataset.subTab;
      if (subTab) {
        state.chatSubTab = subTab;
        /* 更新子TAB按钮选中态 */
        container.querySelectorAll('.chat-tab-btn').forEach(btn => {
          btn.classList.toggle('is-active', btn.dataset.subTab === subTab);
        });
        refreshPanel(container, state, 'chatList');
      }
      break;
    }

    /* [区域标注] 折叠/展开聊天列表分区 */
    case 'toggle-section': {
      const key = target.dataset.sectionKey;
      if (key) {
        state.sectionCollapsed[key] = !state.sectionCollapsed[key];
        refreshPanel(container, state, 'chatList');
      }
      break;
    }

    /* [区域标注] 打开聊天对话 */
    case 'open-chat': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const chatId = target.dataset.chatId;
      if (chatId) {
        await openChatMessage(container, state, db, chatId);
      }
      break;
    }

    /* [区域标注·本次需求2] 右上角"+"：聊天列表添加聊天；通讯录搜索添加联系人 */
    case 'add-chat':
      if (state.activePanel === 'contacts') {
        showAddContactModal(container, state);
      } else {
        showAddChatModal(container, state);
      }
      break;

    /* [区域标注] 关闭弹窗 */
    case 'close-modal':
      closeModal(container);
      break;

    /* [区域标注] 弹窗中选择好友添加到聊天列表 */
    case 'select-contact-for-chat': {
      const contactId = target.dataset.contactId;
      const contact = state.contacts.find(c => c.id === contactId);
      if (contact) {
        const existedSession = state.sessions.find(s => s.id === contactId);
        if (existedSession) {
          /* === [本次修改] 聊天列表长按删除联系人：重新添加时只取消隐藏，保留原会话数据 === */
          state.hiddenChatIds = state.hiddenChatIds.filter(id => String(id) !== String(contactId));
          await dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(state.activeMaskId), state.hiddenChatIds);
        } else {
          /* [区域标注] 创建新聊天会话 */
          const newSession = {
            id: contact.id,
            name: contact.name || '未命名',
            avatar: contact.avatar || '',
            type: 'private',
            lastMessage: '',
            lastTime: Date.now(),
            unread: 0
          };
          state.sessions.push(newSession);
          await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
        }

        closeModal(container);
        refreshPanel(container, state, 'chatList');

        /* [区域标注] 自动打开新创建或恢复显示的聊天 */
        await openChatMessage(container, state, db, contact.id);
      }
      break;
    }

    /* ==========================================================================
       === [本次修改] 聊天列表长按删除联系人：确认后仅从聊天列表隐藏 ===
       ========================================================================== */
    case 'confirm-delete-chat-list-contact': {
      const chatId = target.dataset.chatId || '';
      const sessionExists = chatId && state.sessions.some(session => String(session.id) === String(chatId));
      if (!sessionExists) break;

      const hiddenSet = new Set(Array.isArray(state.hiddenChatIds) ? state.hiddenChatIds.map(String) : []);
      hiddenSet.add(String(chatId));
      state.hiddenChatIds = Array.from(hiddenSet);

      await dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(state.activeMaskId), state.hiddenChatIds);

      closeModal(container);
      refreshPanel(container, state, 'chatList');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 通讯录分组 TAB 切换
       ========================================================================== */
    case 'switch-contact-group': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const groupId = target.dataset.contactGroupId || 'all';
      const exists = groupId === 'all' || state.contactGroups.some(group => group.id === groupId);
      state.activeContactGroupId = exists ? groupId : 'all';
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 打开新建通讯录分组弹窗
       ========================================================================== */
    case 'create-contact-group':
      showCreateContactGroupModal(container);
      break;

    /* ==========================================================================
       [区域标注·本次需求1] 确认创建通讯录分组
       ========================================================================== */
    case 'confirm-create-contact-group': {
      const input = container.querySelector('[data-role="contact-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入分组名称');
        break;
      }
      const group = { id: createUid('contact_group'), name };
      state.contactGroups.push(group);
      state.activeContactGroupId = group.id;
      await dbPut(db, DATA_KEY_CONTACT_GROUPS(state.activeMaskId), state.contactGroups);
      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 确认删除通讯录分组标签
       说明：只删除分组标签；该分组下联系人 groupId 清空，联系人继续保留在 All。
       ========================================================================== */
    case 'confirm-delete-contact-group': {
      const groupId = target.dataset.contactGroupId || '';
      const exists = groupId && state.contactGroups.some(group => group.id === groupId);
      if (!exists) break;

      state.contactGroups = state.contactGroups.filter(group => group.id !== groupId);
      state.contacts = state.contacts.map(contact => (
        contact.groupId === groupId ? { ...contact, groupId: '' } : contact
      ));
      if (state.activeContactGroupId === groupId) state.activeContactGroupId = 'all';

      await Promise.all([
        dbPut(db, DATA_KEY_CONTACT_GROUPS(state.activeMaskId), state.contactGroups),
        dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts)
      ]);

      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 从搜索结果添加角色到通讯录
       ========================================================================== */
    case 'add-contact-from-search': {
      const roleId = target.dataset.roleId;
      const role = getBoundRoleCandidates(state).find(item => item.id === roleId);
      if (!role) {
        renderModalNotice(container, '未找到可添加的绑定角色');
        break;
      }
      if (!state.contacts.some(contact => contact.id === role.id)) {
        state.contacts.push({
          id: role.id,
          roleId: role.id,
          name: role.name || '未命名角色',
          avatar: role.avatar || '',
          signature: role.signature || role.basicSetting || '',
          contact: role.contact || '',
          groupId: '',
          addedAt: Date.now()
        });
        await dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts);
        buildProfileFromMask(state);
        refreshPanel(container, state, 'contacts');
        refreshPanel(container, state, 'profile');
      }
      showContactGroupPickerModal(container, state, role.id);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 点击联系人后打开通讯录分组选择弹窗
       ========================================================================== */
    case 'view-contact': {
      const contactId = target.dataset.contactId;
      if (contactId) showContactGroupPickerModal(container, state, contactId);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 保存联系人所属通讯录分组
       ========================================================================== */
    case 'assign-contact-group': {
      const contactId = target.dataset.contactId;
      const groupId = target.dataset.contactGroupId || '';
      const safeGroupId = groupId && state.contactGroups.some(group => group.id === groupId) ? groupId : '';
      state.contacts = state.contacts.map(contact => (
        contact.id === contactId ? { ...contact, groupId: safeGroupId } : contact
      ));
      await dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts);
      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* [区域标注] 聊天消息页面 — 返回按钮 */
    case 'msg-back':
      closeChatMessage(container, state);
      refreshPanel(container, state, 'chatList');
      break;

    /* [区域标注] 聊天消息页面 — 发送按钮 */
    case 'msg-send': {
      const input = container.querySelector('[data-role="msg-input"]');
      const value = String(input?.value || '').trim();
      if (input) input.value = '';

      /* ===== 闲谈应用：纸飞机触发AI回复 START ===== */
      if (value) {
        await sendMessage(container, state, db, value, settingsManager, { triggerAi: true });
      } else {
        await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
      }
      /* ===== 闲谈应用：纸飞机触发AI回复 END ===== */
      break;
    }

    /* [区域标注·本次需求] 聊天消息页面 — 咖啡按钮：切换升起功能区 */
    case 'msg-coffee':
      state.coffeeDockOpen = !state.coffeeDockOpen;
      if (state.coffeeDockOpen) state.stickerPanelOpen = false;
      syncMessageDockOpenState(container, state);
      break;

    /* ========================================================================
       [区域标注·本次需求3] 聊天消息页底栏表情包按钮 / 分组切换 / 发送
       ======================================================================== */
    case 'msg-sticker':
      state.stickerPanelOpen = !state.stickerPanelOpen;
      if (state.stickerPanelOpen) {
        state.coffeeDockOpen = false;
        state.stickerPanelGroupId = state.stickerPanelGroupId || normalizeStickerData(state.stickerData).activeGroupId || 'all';
      }
      syncMessageDockOpenState(container, state);
      break;

    case 'switch-msg-sticker-group':
      state.stickerPanelGroupId = target.dataset.stickerGroupId || 'all';
      renderMsgStickerPanelGrid(container, state);
      break;

    case 'send-msg-sticker':
      /* [区域标注·本次需求1] 点选表情包只发送，不触发 AI；用户点击纸飞机后才调用 API */
      await sendStickerMessage(container, state, db, target.dataset.stickerId, settingsManager, { triggerAi: false });
      break;

    /* [区域标注·本次需求] 聊天消息页面 — 魔法棒按钮：删除最新 AI 回复并重新回复 */
    case 'msg-magic':
      await retryLatestAiReply(container, state, db, settingsManager);
      break;

    /* [区域标注·本次需求] 聊天消息页面 — 三点设置按钮：进入独立聊天设置页 */
    case 'msg-more': {
      const conversation = container.querySelector('[data-role="msg-conversation"]');
      const settingsPage = container.querySelector('[data-role="msg-settings-page"]');
      if (conversation) conversation.style.display = 'none';
      if (settingsPage) settingsPage.style.display = 'flex';
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求4] 聊天设置页 — 打开清空全部聊天记录确认弹窗
       ========================================================================== */
    case 'open-clear-all-messages-modal':
      showClearAllMessagesModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·本次需求4] 聊天设置页 — 确认清空当前聊天全部记录
       ========================================================================== */
    case 'confirm-clear-all-messages': {
      state.currentMessages = [];
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 单击消息气泡 — 显示/隐藏气泡上方功能栏
       ========================================================================== */
    case 'msg-bubble-select': {
      const messageId = String(target.dataset.messageId || '');
      if (!messageId) break;
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 START ===== */
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      state.multiSelectMode = false;
      state.selectedMessageIds = [];
      state.selectedMessageId = state.selectedMessageId === messageId ? '' : messageId;
      state.deleteConfirmMessageId = '';
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, messageId]);
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 END ===== */
      break;
    }

    /* ==========================================================================
       [区域标注·本次修改3] 消息气泡功能栏 — 修正 AI 消息格式
       说明：只修正 AI 消息中残缺的表情包格式，成功后原地替换并写入 DB.js / IndexedDB。
       ========================================================================== */
    case 'msg-bubble-fix-format': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const messageIndex = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (messageIndex < 0) break;

      const repairedMessage = repairAiMessageFormatIfPossible(state.currentMessages[messageIndex], state);
      if (!repairedMessage) {
        showAiFormatRepairResultModal(container, {
          success: false,
          title: '无法修正',
          message: '未识别到可匹配的已挂载表情包格式或关键词。请确认 AI 文本里包含表情包资源ID、完整表情名或明显表情关键词。'
        });
        break;
      }

      state.currentMessages[messageIndex] = repairedMessage;
      state.deleteConfirmMessageId = '';
      state.selectedMessageId = messageId;
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshMessageBubbleRows(container, state, [messageId]);
      showAiFormatRepairResultModal(container, {
        success: true,
        title: '修正完成',
        message: `已将这条 AI 消息修正为表情包：“${repairedMessage.stickerName || '未命名表情包'}”。`
      });
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 删除单条消息
       ========================================================================== */
    case 'msg-bubble-delete': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 START ===== */
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      state.deleteConfirmMessageId = state.deleteConfirmMessageId === messageId ? '' : messageId;
      state.selectedMessageId = messageId;
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, messageId]);
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 END ===== */
      break;
    }

    /* ===== 闲谈：删除消息二次确认 START ===== */
    case 'msg-bubble-confirm-delete': {
      const messageId = String(target.dataset.messageId || state.deleteConfirmMessageId || state.selectedMessageId || '');
      if (!messageId || state.deleteConfirmMessageId !== messageId) break;
      state.currentMessages = (state.currentMessages || []).filter(message => String(message.id) !== messageId);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshCurrentMessageListOnly(container, state);
      break;
    }
    /* ===== 闲谈：删除消息二次确认 END ===== */

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 进入多选模式
       ========================================================================== */
    case 'msg-bubble-multi': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      state.selectedMessageId = '';
      state.deleteConfirmMessageId = '';
      state.multiSelectMode = true;
      state.selectedMessageIds = [messageId];
      renderCurrentChatMessage(container, state, { keepScroll: true });
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 勾选/取消勾选消息
       ========================================================================== */
    case 'msg-multi-toggle': {
      const messageId = String(target.dataset.messageId || '');
      if (!messageId) break;
      const selectedSet = new Set((state.selectedMessageIds || []).map(String));
      if (selectedSet.has(messageId)) {
        selectedSet.delete(messageId);
      } else {
        selectedSet.add(messageId);
      }
      state.selectedMessageIds = Array.from(selectedSet);
      /* ===== 闲谈：多选勾选局部刷新防闪屏 START ===== */
      refreshMessageBubbleRows(container, state, [messageId]);
      updateMultiSelectActionBar(container, state);
      /* ===== 闲谈：多选勾选局部刷新防闪屏 END ===== */
      break;
    }

    /* [区域标注·本次需求5] 多选模式 — 取消 */
    case 'msg-multi-cancel':
      resetMessageSelectionState(state);
      renderCurrentChatMessage(container, state, { keepScroll: true });
      break;

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 删除选中消息组
       ========================================================================== */
    case 'msg-multi-delete-selected': {
      const selectedSet = new Set((state.selectedMessageIds || []).map(String));
      if (!selectedSet.size) break;
      state.currentMessages = (state.currentMessages || []).filter(message => !selectedSet.has(String(message.id)));
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* [区域标注·本次需求5] 多选模式 — 打开转发联系人弹窗 */
    case 'msg-multi-forward':
      if ((state.selectedMessageIds || []).length) showForwardMessagesModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 确认转发到其它聊天联系人
       ========================================================================== */
    case 'confirm-forward-messages': {
      const targetChatId = String(target.dataset.chatId || '');
      const targetSession = state.sessions.find(session => String(session.id) === targetChatId);
      const selectedMessages = getSelectedMessages(state);
      if (!targetSession || !selectedMessages.length) break;

      const targetKey = DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + targetChatId;
      const targetMessages = (await dbGet(db, targetKey)) || [];
      const now = Date.now();
      const forwardedMessages = selectedMessages.map((message, index) => ({
        id: `forward_${now}_${index}`,
        role: 'user',
        content: String(message.content || ''),
        timestamp: now + index
      })).filter(message => message.content.trim());

      targetMessages.push(...forwardedMessages);
      targetSession.lastMessage = forwardedMessages[forwardedMessages.length - 1]?.content || targetSession.lastMessage || '';
      targetSession.lastTime = now;

      await Promise.all([
        dbPut(db, targetKey, targetMessages),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      resetMessageSelectionState(state);
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* [区域标注·本次需求] 聊天设置页 — 返回聊天消息页 */
    case 'msg-settings-back':
      renderCurrentChatMessage(container, state);
      break;

    /* [区域标注·本次需求] 聊天设置页 — iPhone 风格开关 */
    case 'toggle-external-context':
      state.chatPromptSettings.externalContextEnabled = !state.chatPromptSettings.externalContextEnabled;
      await dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
      target.classList.toggle('is-on', state.chatPromptSettings.externalContextEnabled);
      break;

    /* ===== 闲谈应用：时间感知设置开关 START ===== */
    case 'toggle-time-awareness':
      state.chatPromptSettings.timeAwarenessEnabled = !state.chatPromptSettings.timeAwarenessEnabled;
      await dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
      target.classList.toggle('is-on', state.chatPromptSettings.timeAwarenessEnabled);
      break;
    /* ===== 闲谈应用：时间感知设置开关 END ===== */

    /* ========================================================================
       [区域标注·本次需求3] 设置页表情包挂载切换
       ======================================================================== */
    case 'toggle-mounted-sticker-group': {
      const groupId = String(target.dataset.stickerGroupId || '').trim();
      if (!groupId) break;
      const current = new Set(Array.isArray(state.chatPromptSettings.mountedStickerGroupIds) ? state.chatPromptSettings.mountedStickerGroupIds.map(String) : []);
      if (current.has(groupId)) {
        current.delete(groupId);
      } else {
        if (groupId === 'all') {
          current.clear();
          current.add('all');
        } else {
          current.delete('all');
          current.add(groupId);
        }
      }
      state.chatPromptSettings.mountedStickerGroupIds = Array.from(current);
      await dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
      syncMountedStickerGroupButtons(container, state);
      break;
    }

    /* [区域标注·本次需求] 功能区占位按钮：当前不弹窗、不调用原生 alert */
    case 'msg-feature-placeholder':
      break;

    /* ==========================================================================
       [区域标注·修改1] 钱包折叠栏 — 点击进入钱包子页面
       ========================================================================== */
    case 'open-wallet':
      openSubPage(container, state, 'wallet');
      break;

    /* ==========================================================================
       [区域标注·修改1] 表情包折叠栏 — 点击进入表情包子页面
       ========================================================================== */
    case 'open-sticker':
      openSubPage(container, state, 'sticker');
      break;

    /* ==========================================================================
       [区域标注·修改4] 身份数量卡片 — 点击弹窗切换面具身份
       ========================================================================== */
    case 'open-mask-switcher':
      showMaskSwitcherModal(container, state, db, eventBus);
      break;

    /* ==========================================================================
       [区域标注·修改4] 聊天天数卡片 — 点击进入聊天天数详情子页面
       ========================================================================== */
    case 'open-chat-days-detail':
      openSubPage(container, state, 'chatDaysDetail');
      break;

    /* ==========================================================================
       [区域标注·修改4] 好友数量卡片 — 点击（预留，可进入好友列表）
       ========================================================================== */
    case 'open-friends-detail':
      /* 切换到通讯录板块 */
      switchPanel(container, state, 'contacts');
      break;

    /* ==========================================================================
       [区域标注·修改2] 子页面点击标题返回用户主页
       ========================================================================== */
    case 'go-profile':
      closeSubPage(container, state);
      break;

    /* ==========================================================================
       [区域标注·本次需求3] 表情包独立页面：分组切换、新建分组、添加表情包
       ========================================================================== */
    case 'switch-sticker-group': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const groupId = target.dataset.stickerGroupId || 'all';
      const data = normalizeStickerData(state.stickerData);
      const exists = groupId === 'all' || data.groups.some(group => group.id === groupId);
      state.stickerData = { ...data, activeGroupId: exists ? groupId : 'all' };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'create-sticker-group':
      showCreateStickerGroupModal(container);
      break;

    case 'confirm-create-sticker-group': {
      const input = container.querySelector('[data-role="sticker-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入分组名称');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const group = { id: createUid('sticker_group'), name };
      state.stickerData = {
        ...data,
        groups: [...data.groups, group],
        activeGroupId: group.id
      };
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'open-sticker-upload-modal':
      showStickerUploadModal(container, state);
      break;

    case 'confirm-add-local-sticker': {
      const pending = state.pendingStickerLocalFile;
      const nameInput = container.querySelector('[data-role="sticker-local-name-input"]');
      const name = String(nameInput?.value || pending?.name || '').trim();
      if (!pending?.url) {
        renderModalNotice(container, '请先选择本地表情包文件');
        break;
      }
      if (!name) {
        renderModalNotice(container, '请给这个表情包命名');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const now = Date.now();
      state.stickerData = {
        ...data,
        items: [
          ...data.items,
          {
            id: createUid('sticker'),
            groupId: getStickerTargetGroupId(state),
            name,
            url: pending.url,
            source: 'local',
            createdAt: now
          }
        ]
      };
      state.pendingStickerLocalFile = null;
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-add-url-stickers': {
      const textarea = container.querySelector('[data-role="sticker-url-import-input"]');
      const parsed = parseStickerUrlImportText(textarea?.value || '');
      if (!parsed.length) {
        renderModalNotice(container, '请输入 jpg、png、gif 格式的有效 URL；支持“描述：url”“描述 url”或完整 URL');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const targetGroupId = getStickerTargetGroupId(state);
      const now = Date.now();
      const newItems = parsed.map((item, index) => ({
        id: createUid('sticker'),
        groupId: targetGroupId,
        name: item.name,
        url: item.url,
        source: 'url',
        createdAt: now + index
      }));

      state.stickerData = {
        ...data,
        items: [...data.items, ...newItems]
      };
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-delete-sticker-group': {
      const groupId = target.dataset.stickerGroupId || '';
      const data = normalizeStickerData(state.stickerData);
      const exists = groupId && data.groups.some(group => group.id === groupId);
      if (!exists) break;

      state.stickerData = {
        ...data,
        groups: data.groups.filter(group => group.id !== groupId),
        items: data.items.map(item => item.groupId === groupId ? { ...item, groupId: 'all' } : item),
        activeGroupId: data.activeGroupId === groupId ? 'all' : data.activeGroupId
      };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·本次需求3] 表情包独立页单击放大预览
       说明：
       1. 单击普通表情包时打开应用内预览弹窗，不使用原生浏览器弹窗。
       2. 延迟 260ms 是为了给既有“双击进入多选删除”留出取消单击的时间。
       ======================================================================== */
    case 'open-sticker-preview': {
      if (state.stickerMultiSelectMode) break;
      const stickerId = String(target.dataset.stickerId || '').trim();
      if (!stickerId) break;
      if (state.stickerPreviewClickTimer) window.clearTimeout(state.stickerPreviewClickTimer);
      state.stickerPreviewClickTimer = window.setTimeout(() => {
        state.stickerPreviewClickTimer = 0;
        showStickerPreviewModal(container, state, stickerId);
      }, 260);
      break;
    }

    /* ========================================================================
       [区域标注·本次需求2] 表情包独立页多选删除
       说明：双击任意表情包进入多选删除态；支持单选、多选、全选与批量删除。
       ======================================================================== */
    case 'toggle-sticker-multi-item': {
      if (!state.stickerMultiSelectMode) break;
      const stickerId = String(target.dataset.stickerId || '').trim();
      if (!stickerId) break;
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      if (selectedSet.has(stickerId)) {
        selectedSet.delete(stickerId);
      } else {
        selectedSet.add(stickerId);
      }
      state.selectedStickerIds = Array.from(selectedSet);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'sticker-multi-cancel':
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      rerenderCurrentSubPage(container, state);
      break;

    case 'sticker-multi-select-all': {
      const visibleStickerIds = getVisibleStickers(state).map(item => String(item.id));
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      const isAllSelected = visibleStickerIds.length > 0 && visibleStickerIds.every(id => selectedSet.has(id));
      state.selectedStickerIds = isAllSelected ? [] : visibleStickerIds;
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'sticker-multi-delete-selected': {
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      if (!selectedSet.size) break;
      const data = normalizeStickerData(state.stickerData);
      state.stickerData = {
        ...data,
        items: data.items.filter(item => !selectedSet.has(String(item.id)))
      };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·修改4] 面具切换弹窗中选择面具
       ========================================================================== */
    case 'switch-mask': {
      const maskId = target.dataset.maskId;
      if (maskId && maskId !== state.activeMaskId) {
        await performMaskSwitch(container, state, db, eventBus, maskId);
      }
      closeModal(container);
      break;
    }

    default:
      break;
  }
}

/* ==========================================================================
   [区域标注·修改5] 保存当前面具的聊天数据到 IndexedDB
   说明：在切换面具前调用，确保旧面具的数据不会丢失
   ========================================================================== */
async function saveMaskData(state, db, maskId) {
  await Promise.all([
    dbPut(db, DATA_KEY_SESSIONS(maskId), state.sessions),
    /* === [本次修改] 聊天列表长按删除联系人：隐藏状态保存到 IndexedDB === */
    dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(maskId), state.hiddenChatIds),
    dbPut(db, DATA_KEY_CONTACTS(maskId), state.contacts),
    /* [区域标注·本次需求1] 持久化通讯录自定义分组到 IndexedDB（禁止浏览器同步键值存储） */
    dbPut(db, DATA_KEY_CONTACT_GROUPS(maskId), state.contactGroups),
    dbPut(db, DATA_KEY_MOMENTS(maskId), state.moments),
    dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(maskId), state.chatPromptSettings)
  ]);
}

/* ==========================================================================
   [区域标注·修改5] 加载指定面具的聊天数据
   说明：在切换面具后调用，从 IndexedDB 恢复该面具的数据
   ========================================================================== */
async function loadMaskData(state, db, maskId) {
  const [sessions, hiddenChatIds, contacts, contactGroups, moments, chatPromptSettings] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(maskId)),
    dbGet(db, DATA_KEY_HIDDEN_CHAT_IDS(maskId)),
    dbGet(db, DATA_KEY_CONTACTS(maskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(maskId)),
    dbGet(db, DATA_KEY_MOMENTS(maskId)),
    dbGet(db, DATA_KEY_CHAT_PROMPT_SETTINGS(maskId))
  ]);
  state.sessions = sessions || [];
  /* === [本次修改] 聊天列表长按删除联系人：切换面具时恢复对应隐藏状态 === */
  state.hiddenChatIds = Array.isArray(hiddenChatIds) ? hiddenChatIds.map(String) : [];
  state.contacts = normalizeContacts(contacts);
  /* [区域标注·本次需求1] 切换面具时同步加载该面具的通讯录分组 */
  state.contactGroups = normalizeContactGroups(contactGroups);
  state.activeContactGroupId = 'all';
  state.moments = moments || [];
  state.chatPromptSettings = normalizeChatPromptSettings(chatPromptSettings);
  state.pendingStickerLocalFile = null;
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];
}

/* ==========================================================================
   [区域标注·修改4·修改6] 从档案面具数据构建 profile 对象
   说明：根据当前激活的面具ID，从 archiveMasks 中提取头像、昵称、签名，
         并计算好友数量、身份数量、聊天天数等实时统计数据
   ========================================================================== */
function buildProfileFromMask(state) {
  const activeMask = state.archiveMasks.find(m => m.id === state.activeMaskId);

  /* [修改6] 显示当前激活面具的头像和个性签名 */
  state.profile = {
    nickname: activeMask?.name || '我的昵称',
    avatar: activeMask?.avatar || '',
    signature: activeMask?.signature || '点击输入个性签名...',
    /* [修改4] 好友数量 = 当前面具身份通讯录中的好友数 */
    friendsCount: state.contacts.length,
    /* [修改4] 身份数量 = 档案应用中所有用户面具数量 */
    identitiesCount: state.archiveMasks.length,
    /* [修改4] 聊天天数 = 当前面具身份的聊天总天数（按去重日期计算） */
    chatDays: calculateTotalChatDays(state)
  };
}

/* ==========================================================================
   [区域标注·修改4] 计算当前面具身份的聊天总天数
   说明：遍历所有会话的最后消息时间，统计去重的日期数量
         这是一个近似计算：只基于 session 的 lastTime 来估算
   ========================================================================== */
function calculateTotalChatDays(state) {
  const daySet = new Set();
  (state.sessions || []).forEach(s => {
    if (s.lastTime) {
      const dateStr = new Date(s.lastTime).toISOString().slice(0, 10);
      daySet.add(dateStr);
    }
  });
  return daySet.size;
}

/* ==========================================================================
   [区域标注·修改4] 计算每个好友的聊天天数详情
   说明：遍历 sessions，为每个好友计算独立的聊天天数
   ========================================================================== */
function calculatePerFriendChatDays(state) {
  return (state.sessions || []).map(s => {
    const days = s.lastTime ? 1 : 0; // 简化计算：有最后消息则至少1天
    return {
      id: s.id,
      name: s.name || '未命名',
      avatar: s.avatar || '',
      days
    };
  });
}

/* ==========================================================================
   [区域标注·修改4] 显示面具身份切换弹窗
   说明：列出档案应用中所有用户面具，点击切换当前激活面具
         使用自定义弹窗（与设置应用风格统一），不使用原生浏览器弹窗
   ========================================================================== */
function showMaskSwitcherModal(container, state, db, eventBus) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const masksHtml = state.archiveMasks.length === 0
    ? `<p style="text-align:center;color:rgba(74,52,42,0.45);font-size:13px;padding:20px 0;">暂无用户面具<br>请先在档案应用中创建面具身份</p>`
    : state.archiveMasks.map(m => {
      const isActive = m.id === state.activeMaskId;
      return `
        <!-- [区域标注·修改4] 面具切换项: ${m.name || '未命名'} -->
        <div class="chat-mask-switch-item ${isActive ? 'is-active' : ''}"
             data-action="switch-mask" data-mask-id="${m.id}">
          <div class="chat-mask-switch-item__avatar">
            ${m.avatar
              ? `<img src="${m.avatar}" alt="">`
              : (m.name || '?').charAt(0).toUpperCase()}
          </div>
          <div class="chat-mask-switch-item__info">
            <div class="chat-mask-switch-item__name">${m.name || '未命名面具'}</div>
            <div class="chat-mask-switch-item__sig">${m.signature || ''}</div>
          </div>
          ${isActive ? `<div class="chat-mask-switch-item__check">${ICON_CHECK}</div>` : ''}
        </div>
      `;
    }).join('');

  panel.innerHTML = `
    <!-- [区域标注·修改4] 面具身份切换弹窗 -->
    <div class="chat-modal-header">
      <span>切换用户身份</span>
      <button class="chat-modal-close" data-action="close-modal">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${masksHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·修改4·修改5] 执行面具切换
   说明：保存旧面具数据 → 更新面具ID → 加载新面具数据 → 重建profile → 重渲染
         同时通知档案应用更新 activeMaskId
   ========================================================================== */
async function performMaskSwitch(container, state, db, eventBus, newMaskId) {
  const oldMaskId = state.activeMaskId;

  /* [修改5] 保存旧面具数据 */
  await saveMaskData(state, db, oldMaskId);

  /* 更新面具ID */
  state.activeMaskId = newMaskId;

  /* [修改5] 加载新面具数据 */
  await loadMaskData(state, db, newMaskId);

  /* [修改4·修改6] 重建 profile */
  buildProfileFromMask(state);

  /* 通知档案应用同步 activeMaskId */
  eventBus.emit('archive:active-mask-changed', { maskId: newMaskId });

  /* 重新渲染全部板块 */
  container.innerHTML = buildAppShell(state);
}

/* ==========================================================================
   [区域标注·修改1] 打开子页面（钱包 / 表情包 / 聊天天数详情）
   说明：隐藏主界面元素，在内容区显示独立子页面
   ========================================================================== */
function openSubPage(container, state, pageType) {
  state.subPageView = pageType;
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];

  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const panels = container.querySelectorAll('.chat-panel');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = 'none';
  if (subTabs) subTabs.style.display = 'none';
  if (bottomTab) bottomTab.style.display = 'none';
  panels.forEach(p => p.style.display = 'none');

  if (msgWrap) {
    msgWrap.style.display = 'flex';
    msgWrap.innerHTML = renderSubPage(state, pageType);
  }
}

/* ==========================================================================
   [区域标注·修改1] 关闭子页面，返回用户主页
   ========================================================================== */
function closeSubPage(container, state) {
  state.subPageView = null;
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];

  const topBar = container.querySelector('.chat-top-bar');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = '';
  if (bottomTab) bottomTab.style.display = '';

  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) {
      el.style.display = '';
      el.classList.toggle('is-active', k === state.activePanel);
    }
  });

  if (msgWrap) {
    msgWrap.style.display = 'none';
    msgWrap.innerHTML = '';
  }
}

/* ==========================================================================
   [区域标注·本次需求3] 用户主页表情包独立页面工具函数
   说明：
   1. All 为固定默认分组；自定义分组横向滑动，右侧跟随 IconPark “+”。
   2. 表情包列表一行四个，列表区域可纵向滚动且隐藏滚动条。
   3. 持久化统一走 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
function getStickerGroupsWithAll(state) {
  const data = normalizeStickerData(state.stickerData);
  return [{ id: 'all', name: 'All' }, ...data.groups];
}

function getStickerTargetGroupId(state) {
  const data = normalizeStickerData(state.stickerData);
  return data.activeGroupId && data.activeGroupId !== 'all'
    ? data.activeGroupId
    : 'all';
}

function getVisibleStickers(state) {
  const data = normalizeStickerData(state.stickerData);
  if (data.activeGroupId === 'all') return data.items;
  return data.items.filter(item => item.groupId === data.activeGroupId);
}

function rerenderCurrentSubPage(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (msgWrap && state.subPageView) {
    msgWrap.innerHTML = renderSubPage(state, state.subPageView);
  }
}

function renderStickerSubPage(state) {
  const data = normalizeStickerData(state.stickerData);
  const groups = getStickerGroupsWithAll(state);
  const visibleStickers = getVisibleStickers(state);
  const selectedStickerIds = Array.isArray(state.selectedStickerIds) ? state.selectedStickerIds.map(String) : [];
  const selectedStickerSet = new Set(selectedStickerIds);
  const allVisibleSelected = visibleStickers.length > 0 && visibleStickers.every(item => selectedStickerSet.has(String(item.id)));

  const groupTabsHtml = groups.map(group => `
    <!-- [区域标注·本次需求3] 表情包分组：${escapeHtml(group.name)} -->
    <button class="chat-tab-btn sticker-group-tab-btn ${data.activeGroupId === group.id ? 'is-active' : ''}"
            data-action="switch-sticker-group"
            data-sticker-group-id="${escapeHtml(group.id)}"
            ${group.id !== 'all' ? 'data-long-press-action="delete-sticker-group"' : ''}
            type="button">
      ${escapeHtml(group.name)}
    </button>
  `).join('');

  const stickerGridHtml = visibleStickers.length
    ? visibleStickers.map(item => `
        <!-- [区域标注·本次需求3] 表情包独立页单击放大预览项：${escapeHtml(item.name)} -->
        <button class="sticker-grid-item ${state.stickerMultiSelectMode ? 'is-multi-selecting' : ''} ${selectedStickerSet.has(String(item.id)) ? 'is-selected' : ''}"
                data-action="${state.stickerMultiSelectMode ? 'toggle-sticker-multi-item' : 'open-sticker-preview'}"
                data-sticker-id="${escapeHtml(item.id)}"
                type="button"
                title="${escapeHtml(item.name)}">
          <div class="sticker-grid-item__thumb">
            <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
            ${state.stickerMultiSelectMode ? `<span class="sticker-grid-item__check">${selectedStickerSet.has(String(item.id)) ? ICON_CHECK : ''}</span>` : ''}
          </div>
          <div class="sticker-grid-item__name">${escapeHtml(item.name)}</div>
        </button>
      `).join('')
    : `<div class="sticker-empty">${TAB_ICONS.sticker}<p>当前分组还没有表情包<br>点击右上角 + 添加</p></div>`;

  const stickerMultiBarHtml = state.stickerMultiSelectMode ? `
    <!-- [区域标注·本次需求2] 表情包独立页多选删除悬浮底栏 -->
    <div class="sticker-multi-action-bar">
      <button class="sticker-multi-action-bar__btn" data-action="sticker-multi-cancel" type="button">${TAB_ICONS.close}<span>取消</span></button>
      <span class="sticker-multi-action-bar__count">已选 ${selectedStickerIds.length} 个</span>
      <button class="sticker-multi-action-bar__btn" data-action="sticker-multi-select-all" type="button">${allVisibleSelected ? ICON_CHECK : TAB_ICONS.plus}<span>${allVisibleSelected ? '取消全选' : '全选'}</span></button>
      <button class="sticker-multi-action-bar__btn sticker-multi-action-bar__btn--danger" data-action="sticker-multi-delete-selected" type="button" ${selectedStickerIds.length ? '' : 'disabled'}>${TAB_ICONS.close}<span>删除</span></button>
    </div>
  ` : '';

  return `
    <div class="chat-sub-page sticker-sub-page">
      <!-- ===== 用户主页表情包独立页面：标题栏 START ===== -->
      <div class="chat-sub-page__header chat-sub-page__header--center sticker-sub-page__header">
        <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">表情包</button>
        <button class="sticker-page-add-btn" data-action="open-sticker-upload-modal" type="button" aria-label="添加表情包">${TAB_ICONS.plus}</button>
      </div>
      <!-- ===== 用户主页表情包独立页面：标题栏 END ===== -->

      <!-- ===== 用户主页表情包独立页面：固定分组栏 START ===== -->
      <div class="sticker-group-tabs">
        <div class="sticker-group-tabs__scroller">
          ${groupTabsHtml}
          <button class="sticker-group-add-tab" data-action="create-sticker-group" type="button" aria-label="新建表情包分组">${TAB_ICONS.plus}</button>
        </div>
      </div>
      <!-- ===== 用户主页表情包独立页面：固定分组栏 END ===== -->

      <!-- ===== 用户主页表情包独立页面：可滚动表情包列表 START ===== -->
      <div class="sticker-list-scroll ${state.stickerMultiSelectMode ? 'is-multi-selecting' : ''}">
        <div class="sticker-grid">
          ${stickerGridHtml}
        </div>
      </div>
      <!-- ===== 用户主页表情包独立页面：可滚动表情包列表 END ===== -->

      ${stickerMultiBarHtml}
    </div>
  `;
}

function showCreateStickerGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 新建表情包分组弹窗 -->
    <div class="chat-modal-header">
      <span>新建表情包分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           maxlength="12"
           placeholder="输入分组名称"
           data-role="sticker-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-sticker-group" type="button">完成</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="sticker-group-name-input"]');
    if (input) input.focus();
  }, 30);
}

function showStickerPreviewModal(container, state, stickerId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const sticker = normalizeStickerData(state.stickerData).items.find(item => String(item.id) === String(stickerId));
  if (!mask || !panel || !sticker) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 表情包独立页单击放大预览弹窗 -->
    <div class="chat-modal-header sticker-preview-modal__header">
      <span>${escapeHtml(sticker.name || '表情包')}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="sticker-preview-modal__body">
      <img class="sticker-preview-modal__image" src="${escapeHtml(sticker.url)}" alt="${escapeHtml(sticker.name || '表情包')}">
    </div>
  `;

  mask.classList.remove('is-hidden');
}

function showStickerUploadModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  state.pendingStickerLocalFile = null;
  const activeGroup = getStickerGroupsWithAll(state).find(group => group.id === getStickerTargetGroupId(state));

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 添加表情包弹窗 -->
    <div class="chat-modal-header">
      <span>添加表情包到 ${escapeHtml(activeGroup?.name || 'All')}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body chat-upload-modal-body sticker-upload-modal-body">
      <label class="chat-upload-option">
        <span class="chat-upload-option__icon">${TAB_ICONS.upload}</span>
        <span class="chat-upload-option__text">本地上传 jpg / png / gif</span>
        <input class="sticker-local-file-input" data-role="sticker-local-file-input" type="file" accept="image/jpeg,image/png,image/gif" hidden>
      </label>
      <input class="chat-modal-search" data-role="sticker-local-name-input" type="text" maxlength="24" placeholder="本地表情包名称">
      <div class="sticker-local-preview" data-role="sticker-local-preview"></div>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-add-local-sticker" type="button">添加本地表情包</button>

      <div class="sticker-import-divider"></div>

      <!-- ===== 闲谈表情包本地文件导入：txt/docx 批量导入 START ===== -->
      <label class="chat-upload-option">
        <span class="chat-upload-option__icon">${TAB_ICONS.fileText}</span>
        <span class="chat-upload-option__text">导入本地文件 txt / docx</span>
        <input class="sticker-import-file-input" data-role="sticker-import-file-input" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      </label>
      <div class="chat-modal-hint">文件内容支持“名称：图片URL”“名称 图片URL”或每行一个图片URL，导入后会自动加入当前分组。</div>
      <!-- ===== 闲谈表情包本地文件导入：txt/docx 批量导入 END ===== -->

      <div class="sticker-import-divider"></div>

      <label class="chat-upload-url-label">
        <span class="chat-upload-url-label__icon">${TAB_ICONS.link}</span>
        <span>URL 链接导入（支持单个 / 批量，一行一个）</span>
      </label>
      <textarea class="sticker-url-import-input"
                data-role="sticker-url-import-input"
                placeholder="开心：https://e.com/happy.jpg&#10;伤心：https://o.com/sad.jpg&#10;https://e.com/cute.gif"></textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-add-url-stickers" type="button">导入 URL</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

function normalizeStickerUrl(url) {
  return String(url || '').trim().replace(/,(jpg|jpeg|png|gif)(?=([?#]|$))/i, '.$1');
}

function isAllowedStickerUrl(url) {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif)(?:[?#].*)?$/i.test(normalizeStickerUrl(url));
}

function extractStickerNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const fileName = decodeURIComponent((parsed.pathname.split('/').pop() || '表情包').replace(/\.(jpg|jpeg|png|gif)$/i, ''));
    return fileName || '表情包';
  } catch {
    return '表情包';
  }
}

function parseStickerUrlImportText(text) {
  return String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      /* [区域标注·本次需求3] URL 解析：同时兼容 .jpg 与用户示例里的 ,jpg 写法 */
      const urlMatch = line.match(/https?:\/\/\S+[\.,](?:jpg|jpeg|png|gif)(?:[?#]\S*)?/i);
      if (!urlMatch) return null;
      const url = normalizeStickerUrl(urlMatch[0].replace(/[，,。；;）)]$/, ''));
      if (!isAllowedStickerUrl(url)) return null;

      const beforeUrl = line.slice(0, urlMatch.index).trim();
      const name = beforeUrl
        .replace(/[：:]\s*$/, '')
        .trim() || extractStickerNameFromUrl(url);

      return { name, url };
    })
    .filter(Boolean);
}

/* ==========================================================================
   ===== 闲谈表情包本地文件导入：txt/docx 解析 START =====
   说明：
   1. 只服务用户主页表情包独立页右上角“+”弹窗中的“导入本地文件”。
   2. txt 直接读取文本；docx 只解析 word/document.xml 文本内容。
   3. 批量导入结果统一写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
async function importStickerTextToCurrentGroup(container, state, db, text) {
  const parsed = parseStickerUrlImportText(text);
  if (!parsed.length) {
    renderModalNotice(container, '未解析到有效表情包；请使用“名称：图片URL”或每行一个图片URL');
    return;
  }

  const data = normalizeStickerData(state.stickerData);
  const targetGroupId = getStickerTargetGroupId(state);
  const now = Date.now();
  const newItems = parsed.map((item, index) => ({
    id: createUid('sticker'),
    groupId: targetGroupId,
    name: item.name,
    url: item.url,
    source: 'file-import',
    createdAt: now + index
  }));

  state.stickerData = {
    ...data,
    items: [...data.items, ...newItems]
  };
  await persistStickerData(state, db);
  closeModal(container);
  rerenderCurrentSubPage(container, state);
}

function decodeXmlText(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}

function parseDocxXmlText(xmlText) {
  return String(xmlText || '')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map(line => decodeXmlText(line).trim())
    .filter(Boolean)
    .join('\n');
}

function findZipEntry(bytes, fileName) {
  const decoder = new TextDecoder('utf-8');
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (bytes[index] !== 0x50 || bytes[index + 1] !== 0x4b || bytes[index + 2] !== 0x05 || bytes[index + 3] !== 0x06) continue;

    const view = new DataView(bytes.buffer, bytes.byteOffset + index, 22);
    const centralDirSize = view.getUint32(12, true);
    const centralDirOffset = view.getUint32(16, true);
    let offset = centralDirOffset;
    const end = centralDirOffset + centralDirSize;

    while (offset < end && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x01 && bytes[offset + 3] === 0x02) {
      const entryView = new DataView(bytes.buffer, bytes.byteOffset + offset, 46);
      const compression = entryView.getUint16(10, true);
      const compressedSize = entryView.getUint32(20, true);
      const fileNameLength = entryView.getUint16(28, true);
      const extraLength = entryView.getUint16(30, true);
      const commentLength = entryView.getUint16(32, true);
      const localHeaderOffset = entryView.getUint32(42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

      if (name === fileName) {
        const localView = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
        const localNameLength = localView.getUint16(26, true);
        const localExtraLength = localView.getUint16(28, true);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        return {
          compression,
          data: bytes.slice(dataStart, dataStart + compressedSize)
        };
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    break;
  }
  return null;
}

async function inflateRawZipData(compressedData) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器不支持 docx 解压解析，请改用 txt 导入');
  }

  const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readDocxText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entry = findZipEntry(bytes, 'word/document.xml');
  if (!entry) throw new Error('未找到 docx 正文内容');

  const xmlBytes = entry.compression === 0
    ? entry.data
    : await inflateRawZipData(entry.data);

  return parseDocxXmlText(new TextDecoder('utf-8').decode(xmlBytes));
}
/* ===== 闲谈表情包本地文件导入：txt/docx 解析 END ===== */

function showDeleteStickerGroupModal(container, state, groupId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const data = normalizeStickerData(state.stickerData);
  const group = data.groups.find(item => item.id === groupId);
  if (!mask || !panel || !group) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 删除表情包分组确认弹窗 -->
    <div class="chat-modal-header">
      <span>删除表情包分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否删除“${escapeHtml(group.name)}”分组？<br>分组内表情包不会删除，会移动到 All。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-sticker-group" data-sticker-group-id="${escapeHtml(group.id)}" type="button">删除</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

function createStickerGroupLongPressHandlers(state, container) {
  let timer = null;
  let pressedTarget = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pressedTarget = null;
  };

  const openDeleteModal = () => {
    const target = pressedTarget;
    if (!target) return;

    const groupId = target.dataset.stickerGroupId || '';
    const data = normalizeStickerData(state.stickerData);
    const exists = groupId && groupId !== 'all' && data.groups.some(group => group.id === groupId);
    if (!exists) return;

    target.dataset.longPressTriggered = '1';
    showDeleteStickerGroupModal(container, state, groupId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-sticker-group"]');
      if (!target) return;

      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-sticker-group"]')) {
        e.preventDefault();
      }
    }
  };
}

/* ==========================================================================
   [区域标注·修改1·修改4] 渲染子页面内容
   说明：根据 pageType 渲染钱包 / 表情包 / 聊天天数详情页面
   ========================================================================== */
function renderSubPage(state, pageType) {
  if (pageType === 'wallet') {
    return `
      <div class="chat-sub-page">
        <div class="chat-sub-page__header chat-sub-page__header--center">
          <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">钱包</button>
        </div>
        <div class="chat-sub-page__body">
          <div class="chat-sub-page__empty">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><path d="M6 10h36v28H6V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M6 18h36" stroke="currentColor" stroke-width="3"/><path d="M32 28a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z" fill="currentColor"/></svg>
            <p>钱包功能开发中...</p>
          </div>
        </div>
      </div>
    `;
  }

  if (pageType === 'sticker') {
    return renderStickerSubPage(state);
  }

  if (pageType === 'chatDaysDetail') {
    const friends = calculatePerFriendChatDays(state);
    const totalDays = calculateTotalChatDays(state);
    const listHtml = friends.length === 0
      ? `<p style="text-align:center;color:rgba(74,52,42,0.45);font-size:13px;padding:20px 0;">暂无聊天记录</p>`
      : friends.map(f => `
          <div class="chat-days-detail-item">
            <div class="chat-days-detail-item__avatar">
              ${f.avatar ? `<img src="${f.avatar}" alt="">` : (f.name || '?').charAt(0).toUpperCase()}
            </div>
            <div class="chat-days-detail-item__info">
              <span class="chat-days-detail-item__name">${f.name}</span>
              <span class="chat-days-detail-item__days">${f.days} 天</span>
            </div>
          </div>
        `).join('');

    return `
      <div class="chat-sub-page">
        <div class="chat-sub-page__header chat-sub-page__header--center">
          <button class="chat-sub-page__title chat-sub-page__title--button" data-action="go-profile" type="button">聊天天数详情</button>
        </div>
        <div class="chat-sub-page__body">
          <div class="chat-days-detail-total">
            <span class="chat-days-detail-total__num">${totalDays}</span>
            <span class="chat-days-detail-total__label">总聊天天数</span>
          </div>
          <div class="chat-days-detail-list">
            ${listHtml}
          </div>
        </div>
      </div>
    `;
  }

  return `<div class="chat-sub-page"><div class="chat-sub-page__header chat-sub-page__header--center"><button class="chat-sub-page__title chat-sub-page__title--button" data-action="go-profile" type="button">未知页面</button></div></div>`;
}

/* ==========================================================================
   [区域标注] 输入事件代理处理器
   说明：处理搜索框等输入事件
   ========================================================================== */
function handleInput(e, state, container, db) {
  const target = e.target;

  /* [区域标注] 聊天列表搜索输入 */
  if (target.matches('[data-role="chat-search-input"]')) {
    state.chatSearchKeyword = target.value || '';
    refreshPanel(container, state, 'chatList');
    return;
  }

  /* [区域标注] 弹窗中搜索输入 */
  if (target.matches('[data-role="modal-search"]')) {
    const keyword = (target.value || '').toLowerCase();
    const body = container.querySelector('[data-role="modal-body"]');
    if (!body) return;
    body.querySelectorAll('.chat-modal-contact').forEach(item => {
      const nameEl = item.querySelector('.chat-modal-contact__name');
      const name = (nameEl?.textContent || '').toLowerCase();
      item.style.display = name.includes(keyword) ? '' : 'none';
    });
    return;
  }

  /* ==========================================================================
     [区域标注·本次需求2] 通讯录弹窗联系方式搜索输入
     说明：只在弹窗内搜索，通讯录页面内不保留搜索框
     ========================================================================== */
  if (target.matches('[data-role="contact-add-search-input"]')) {
    renderContactSearchResults(container, state, target.value || '');
    return;
  }

  /* ==========================================================================
     [区域标注·本次需求] 聊天设置输入持久化
     说明：当前指令、自定义思维链统一写入 DB.js / IndexedDB。
     ========================================================================== */
  if (target.matches('[data-role="msg-current-command"]')) {
    state.chatPromptSettings.currentCommand = target.value || '';
    dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
    return;
  }

  if (target.matches('[data-role="msg-custom-thinking"]')) {
    state.chatPromptSettings.customThinkingInstruction = target.value || '';
    dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
    return;
  }

  /* ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== */
  if (target.matches('[data-role="msg-reply-bubble-min"], [data-role="msg-reply-bubble-max"], [data-role="msg-short-term-memory-rounds"]')) {
    const minInput = container.querySelector('[data-role="msg-reply-bubble-min"]');
    const maxInput = container.querySelector('[data-role="msg-reply-bubble-max"]');
    const memoryInput = container.querySelector('[data-role="msg-short-term-memory-rounds"]');

    const min = Math.max(1, Math.floor(Number(minInput?.value || 1)) || 1);
    const max = Math.max(min, Math.floor(Number(maxInput?.value || min)) || min);
    const rounds = Math.max(0, Math.floor(Number(memoryInput?.value || 0)) || 0);

    state.chatPromptSettings.replyBubbleMin = min;
    state.chatPromptSettings.replyBubbleMax = max;
    state.chatPromptSettings.shortTermMemoryRounds = rounds;

    if (minInput && String(minInput.value) !== String(min)) minInput.value = String(min);
    if (maxInput && String(maxInput.value) !== String(max)) maxInput.value = String(max);
    if (memoryInput && String(memoryInput.value) !== String(rounds)) memoryInput.value = String(rounds);

    dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId), state.chatPromptSettings);
    return;
  }
  /* ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== */
}

/* ==========================================================================
   [区域标注·本次需求3] 表情包本地上传 change 处理
   说明：读取为 data URL 后仅暂存在运行时，用户点击确认才写入 IndexedDB。
   ========================================================================== */
async function handleChange(e, state, container, db) {
  const target = e.target;

  /* ===== 闲谈表情包本地文件导入：txt/docx change 处理 START ===== */
  if (target?.matches?.('[data-role="sticker-import-file-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    try {
      const fileName = String(file.name || '').toLowerCase();
      const text = fileName.endsWith('.docx')
        ? await readDocxText(file)
        : await file.text();
      await importStickerTextToCurrentGroup(container, state, db, text);
    } catch (error) {
      renderModalNotice(container, error?.message || '本地文件导入失败');
    } finally {
      target.value = '';
    }
    return;
  }
  /* ===== 闲谈表情包本地文件导入：txt/docx change 处理 END ===== */

  if (!target?.matches?.('[data-role="sticker-local-file-input"]')) return;

  const file = target.files?.[0];
  if (!file) return;

  if (!/^image\/(jpeg|png|gif)$/i.test(file.type || '')) {
    renderModalNotice(container, '本地上传仅支持 jpg、png、gif 格式');
    target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result || '');
    state.pendingStickerLocalFile = {
      name: file.name.replace(/\.(jpg|jpeg|png|gif)$/i, ''),
      url
    };

    const nameInput = container.querySelector('[data-role="sticker-local-name-input"]');
    if (nameInput && !String(nameInput.value || '').trim()) {
      nameInput.value = state.pendingStickerLocalFile.name;
    }

    const preview = container.querySelector('[data-role="sticker-local-preview"]');
    if (preview) {
      preview.innerHTML = `
        <img src="${escapeHtml(url)}" alt="${escapeHtml(state.pendingStickerLocalFile.name)}">
        <span>${escapeHtml(state.pendingStickerLocalFile.name)}</span>
      `;
    }
  };
  reader.readAsDataURL(file);
}

/* ==========================================================================
   [区域标注·本次需求] 聊天输入框回车发送
   说明：用户在输入法中点击“回车”后发送消息；Shift+Enter 不处理（当前为单行输入框）。
   ========================================================================== */
async function handleKeydown(e, state, container, db, settingsManager) {
  const target = e.target;
  if (!target?.matches?.('[data-role="msg-input"]')) return;
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

  e.preventDefault();
  const value = target.value;
  target.value = '';
  /* ===== 闲谈应用：回车只发送用户消息 START ===== */
  await sendMessage(container, state, db, value, settingsManager, { triggerAi: false });
  /* ===== 闲谈应用：回车只发送用户消息 END ===== */
}

/* ==========================================================================
   [区域标注·本次需求2] 表情包独立页双击进入多选删除
   说明：双击任意表情包即可唤起底部悬浮多选栏，并默认选中当前表情包。
   ========================================================================== */
function handleDoubleClick(e, state, container) {
  if (state.subPageView !== 'sticker') return;
  if (state.stickerPreviewClickTimer) {
    window.clearTimeout(state.stickerPreviewClickTimer);
    state.stickerPreviewClickTimer = 0;
  }
  const target = e.target.closest('[data-sticker-id]');
  if (!target) return;

  const stickerId = String(target.dataset.stickerId || '').trim();
  if (!stickerId) return;

  state.stickerMultiSelectMode = true;
  state.selectedStickerIds = [stickerId];
  rerenderCurrentSubPage(container, state);
}
