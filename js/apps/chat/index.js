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
  forward: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 10l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 22H20c-8 0-12 4-12 12v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
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
  const [sessions, hiddenChatIds, contacts, contactGroups, moments, chatPromptSettings] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_HIDDEN_CHAT_IDS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_MOMENTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CHAT_PROMPT_SETTINGS(currentActiveMaskId))
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
    /* [区域标注·本次需求] 聊天 API 调用状态 */
    isAiSending: false,
    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡选择状态
       说明：仅保存在运行时；消息持久化仍只写 DB.js / IndexedDB。
       ========================================================================== */
    selectedMessageId: '',
    multiSelectMode: false,
    selectedMessageIds: [],
    /* [修改4] 用于子页面导航的堆栈标记 */
    subPageView: null               // null | 'wallet' | 'sticker' | 'chatDaysDetail'
  };

  /* [修改4·修改6] 根据当前面具构建 profile 数据 */
  buildProfileFromMask(state);

  /* [区域标注] 渲染应用骨架 HTML */
  container.innerHTML = buildAppShell(state);

  /* [区域标注] 绑定全局事件代理 */
  const clickHandler = (e) => handleClick(e, state, container, db, eventBus, windowManager, appMeta, settings);
  const inputHandler = (e) => handleInput(e, state, container, db);
  const keydownHandler = (e) => handleKeydown(e, state, container, db, settings);
  /* [区域标注·本次需求1] 通讯录分组长按删除事件：使用自定义应用内弹窗，不使用原生 confirm */
  const contactGroupLongPressHandlers = createContactGroupLongPressHandlers(state, container);
  /* === [本次修改] 聊天列表长按删除联系人：应用内确认弹窗，不使用原生 confirm === */
  const chatListLongPressHandlers = createChatListLongPressHandlers(state, container);
  container.addEventListener('click', clickHandler);
  container.addEventListener('input', inputHandler);
  container.addEventListener('keydown', keydownHandler);
  container.addEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
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
      container.removeEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
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
  if (!options.skipAppendUser) {
    state.currentMessages.push({
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    });
  }

  await persistCurrentMessages(state, db);

  if (userText) {
    session.lastMessage = userText;
    session.lastTime = Date.now();
    await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
  }

  appendCurrentMessageBubble(container, state, state.currentMessages[state.currentMessages.length - 1]);

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
      }
    });

    const aiText = String(result?.text || '').trim() || '（AI 没有返回内容）';

    /* ==========================================================================
       [区域标注·本次修改1] AI 回复拆分为多个气泡并逐条延迟显示
       说明：不再把本轮所有 AI 气泡一次性 push 到界面；每个气泡入列后单独渲染。
       ========================================================================== */
    const aiBubbles = splitAiReplyIntoBubbles(aiText, state.chatPromptSettings);
    for (let index = 0; index < aiBubbles.length; index += 1) {
      if (index > 0) await sleep(getAiBubbleDelayMs(aiBubbles[index], index));
      state.currentMessages.push({
        id: `ai_${Date.now()}_${index}`,
        role: 'assistant',
        content: aiBubbles[index],
        timestamp: Date.now() + index
      });
      hasRenderedAiBubble = true;
      session.lastMessage = aiBubbles[index] || aiText;
      session.lastTime = Date.now();
      await persistCurrentMessages(state, db);
      await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
      appendCurrentMessageBubble(container, state, state.currentMessages[state.currentMessages.length - 1]);
    }
    /* ===== 闲谈应用：AI回复拆分为多个气泡 END ===== */

    session.lastMessage = aiBubbles[aiBubbles.length - 1] || aiText;
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
   [区域标注·本次需求] 重新渲染当前聊天消息页
   ========================================================================== */
function renderCurrentChatMessage(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!msgWrap || !session) return;

  msgWrap.innerHTML = renderChatMessage(session, state.currentMessages, {
    chatSettings: state.chatPromptSettings,
    isSending: state.isAiSending,
    /* ===== 闲谈应用：用户主页头像连接到消息页 START ===== */
    userProfile: state.profile,
    /* ===== 闲谈应用：用户主页头像连接到消息页 END ===== */

    /* [区域标注·本次需求5] 消息气泡功能栏与多选状态 */
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds
  });

  setTimeout(() => {
    const listArea = msgWrap.querySelector('[data-role="msg-list"]');
    if (listArea) listArea.scrollTop = listArea.scrollHeight;
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
    selectedMessageIds: state.selectedMessageIds
  }));
  listArea.scrollTop = listArea.scrollHeight;
}

/* ==========================================================================
   [区域标注·本次需求5] 消息气泡选择状态工具
   ========================================================================== */
function resetMessageSelectionState(state) {
  state.selectedMessageId = '';
  state.multiSelectMode = false;
  state.selectedMessageIds = [];
}

function getSelectedMessages(state) {
  const selectedSet = new Set((state.selectedMessageIds || []).map(String));
  return (state.currentMessages || []).filter(message => selectedSet.has(String(message.id)));
}

function refreshCurrentSessionLastMessage(state) {
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const latest = [...(state.currentMessages || [])].reverse().find(item => String(item?.content || '').trim());
  session.lastMessage = latest?.content || '';
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

  const latestUser = [...state.currentMessages].reverse().find(item => item?.role === 'user');
  if (!latestUser?.content) {
    renderCurrentChatMessage(container, state);
    return;
  }

  await persistCurrentMessages(state, db);
  await sendMessage(container, state, db, latestUser.content, settingsManager, { skipAppendUser: true, triggerAi: true });
}

/* ===== 闲谈应用：短期记忆与最新一轮消息 START ===== */
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

  const currentRoundMessages = latestUserStart >= 0 ? normalized.slice(latestUserStart).filter(item => item.role === 'user') : [];
  const userInput = currentRoundMessages.map(item => item.content).join('\n');

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
/* ===== 闲谈应用：短期记忆与最新一轮消息 END ===== */

/* ===== 闲谈应用：AI回复拆分为多个气泡 START ===== */
function splitAiReplyIntoBubbles(text, chatSettings = {}) {
  const raw = sanitizeAiVisibleReply(text);
  if (!raw) return ['（AI 没有返回内容）'];

  const min = Math.max(1, Math.floor(Number(chatSettings.replyBubbleMin || 1)) || 1);
  const max = Math.max(min, Math.floor(Number(chatSettings.replyBubbleMax || min)) || min);

  /* ==========================================================================
     [区域标注·本次修改3] 严格拆分文字消息与问号气泡
     说明：
     1. 优先识别 prompt.js 新增的 [[TEXT_MESSAGE]]文字消息内容 格式。
     2. 无论 AI 是否按格式输出，只要同一段里出现多个问句/感叹句/句号句，就强制拆开。
     3. 之前“问号后有空格”不会被 (?=\S) 命中，所以会把两个问句留在同一气泡；这里已修复。
     ========================================================================== */
  const textMessageMatches = [...raw.matchAll(/\[\[TEXT_MESSAGE\]\]\s*([\s\S]*?)(?=\[\[TEXT_MESSAGE\]\]|$)/g)]
    .map(match => match[1].trim())
    .filter(Boolean);

  let parts = textMessageMatches.length
    ? textMessageMatches
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

  const textMessageMatches = [...value.matchAll(/\[\[TEXT_MESSAGE\]\]\s*([\s\S]*?)(?=\[\[TEXT_MESSAGE\]\]|$)/g)]
    .map(match => match[1].trim())
    .filter(Boolean);

  if (textMessageMatches.length) {
    value = textMessageMatches.join('\n');
  }

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
    .replace(/\[\[TEXT_MESSAGE\]\]/g, '')
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
   [区域标注] 关闭弹窗
   ========================================================================== */
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
    case 'msg-coffee': {
      const dock = container.querySelector('[data-role="msg-feature-dock"]');
      if (dock) dock.classList.toggle('is-open');
      break;
    }

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
      state.multiSelectMode = false;
      state.selectedMessageIds = [];
      state.selectedMessageId = state.selectedMessageId === messageId ? '' : messageId;
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 删除单条消息
       ========================================================================== */
    case 'msg-bubble-delete': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      state.currentMessages = (state.currentMessages || []).filter(message => String(message.id) !== messageId);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 进入多选模式
       ========================================================================== */
    case 'msg-bubble-multi': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      state.selectedMessageId = '';
      state.multiSelectMode = true;
      state.selectedMessageIds = [messageId];
      renderCurrentChatMessage(container, state);
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
      renderCurrentChatMessage(container, state);
      break;
    }

    /* [区域标注·本次需求5] 多选模式 — 取消 */
    case 'msg-multi-cancel':
      resetMessageSelectionState(state);
      renderCurrentChatMessage(container, state);
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

    /* [区域标注·本次需求] 功能区占位按钮：当前不弹窗、不调用原生 alert */
    case 'msg-feature-placeholder':
      break;

    /* ==========================================================================
       [区域标注·修改3] 头像/封面上传已移除 — 不再支持点击头像上传
       说明：头像和签名由档案应用的用户面具身份数据驱动
       ========================================================================== */

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
   [区域标注·修改3] 图片上传弹窗已移除
   说明：头像和签名由档案应用的用户面具身份数据驱动，不再支持手动上传
   ========================================================================== */

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
    return `
      <div class="chat-sub-page">
        <div class="chat-sub-page__header chat-sub-page__header--center">
          <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">表情包</button>
        </div>
        <div class="chat-sub-page__body">
          <div class="chat-sub-page__empty">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M16 28c2 4 10 4 12 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="20" r="2" fill="currentColor"/><circle cx="30" cy="20" r="2" fill="currentColor"/></svg>
            <p>表情包功能开发中...</p>
          </div>
        </div>
      </div>
    `;
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
