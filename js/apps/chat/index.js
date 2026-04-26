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
import { renderChatMessage } from './chat-message.js';

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
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
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
const DATA_KEY_CONTACTS = (maskId) => `chat_contacts_${maskId || 'default'}`;
/* [区域标注·本次需求1] 通讯录自定义分组按当前面具身份隔离存储 */
const DATA_KEY_CONTACT_GROUPS = (maskId) => `chat_contact_groups_${maskId || 'default'}`;
const DATA_KEY_MOMENTS = (maskId) => `chat_moments_${maskId || 'default'}`;
const DATA_KEY_MESSAGES_PREFIX = (maskId) => `chat_msgs_${maskId || 'default'}_`;
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
  const { appMeta, eventBus, db, windowManager } = context;

  /* ==========================================================================
     [区域标注·修改5] 并行预加载 CSS + 档案数据
     说明：先加载 CSS 和档案数据，确定当前激活面具后再加载对应面具的聊天数据
     ========================================================================== */
  await loadCSS('./js/apps/chat/chat.css', 'chat-app-css');
  void loadCSS('./js/apps/chat/chat-message.css', 'chat-msg-css');

  const archiveRecord = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);

  /* [修改5·修改6] 解析档案数据，获取当前激活面具 */
  const archiveData = (archiveRecord && typeof archiveRecord === 'object') ? archiveRecord : {};
  const archiveMasks = Array.isArray(archiveData.masks) ? archiveData.masks : [];
  /* [区域标注·本次需求2] 缓存角色档案，用于通过绑定角色联系方式搜索添加通讯录 */
  const archiveCharacters = Array.isArray(archiveData.characters) ? archiveData.characters : [];
  const currentActiveMaskId = archiveData.activeMaskId || '';

  /* [修改5] 按当前面具ID加载对应数据 */
  const [sessions, contacts, contactGroups, moments] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_MOMENTS(currentActiveMaskId))
  ]);

  /* [区域标注] 应用状态对象 */
  const state = {
    activePanel: 'chatList',        // 当前激活的板块
    chatSubTab: 'all',              // 聊天列表子TAB: all / private / group
    chatSearchKeyword: '',          // 聊天列表搜索词
    sectionCollapsed: {},           // 折叠状态 {private: false, group: false}
    sessions: sessions || [],       // 聊天会话列表
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
    /* [修改4] 用于子页面导航的堆栈标记 */
    subPageView: null               // null | 'wallet' | 'sticker' | 'chatDaysDetail'
  };

  /* [修改4·修改6] 根据当前面具构建 profile 数据 */
  buildProfileFromMask(state);

  /* [区域标注] 渲染应用骨架 HTML */
  container.innerHTML = buildAppShell(state);

  /* [区域标注] 绑定全局事件代理 */
  const clickHandler = (e) => handleClick(e, state, container, db, eventBus, windowManager, appMeta);
  const inputHandler = (e) => handleInput(e, state, container, db);
  container.addEventListener('click', clickHandler);
  container.addEventListener('input', inputHandler);

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
        <button class="chat-top-bar__title" data-action="go-home" type="button">Chat</button>
        <button class="chat-top-bar__add" data-action="add-chat">${TAB_ICONS.plus}</button>
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
        ${renderChatList(state.sessions, state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed)}
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
      panelEl.innerHTML = renderChatList(state.sessions, state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed);
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
    msgWrap.innerHTML = renderChatMessage(session, state.currentMessages);
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
   [区域标注] 发送消息
   说明：将用户输入的消息添加到当前会话的消息列表并持久化
   ========================================================================== */
async function sendMessage(container, state, db, content) {
  if (!content.trim() || !state.currentChatId) return;

  const msg = {
    id: Date.now().toString(),
    role: 'user',
    content: content.trim(),
    timestamp: Date.now()
  };

  state.currentMessages.push(msg);

  /* [区域标注] 持久化消息到 IndexedDB */
  await dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + state.currentChatId, state.currentMessages);

  /* [区域标注] 更新会话的最后消息和时间 */
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (session) {
    session.lastMessage = content.trim();
    session.lastTime = Date.now();
    await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
  }

  /* [区域标注] 重新渲染消息页面 */
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (msgWrap && session) {
    msgWrap.innerHTML = renderChatMessage(session, state.currentMessages);
    /* [区域标注] 滚动到底部 */
    setTimeout(() => {
      const listArea = msgWrap.querySelector('[data-role="msg-list"]');
      if (listArea) listArea.scrollTop = listArea.scrollHeight;
    }, 30);
  }
}

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
      const alreadyAdded = state.sessions.some(s => s.id === c.id);
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
   [区域标注] 点击事件代理处理器
   说明：统一处理应用内所有按钮/列表项的点击事件
   ========================================================================== */
async function handleClick(e, state, container, db, eventBus, windowManager, appMeta) {
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
      if (contact && !state.sessions.some(s => s.id === contactId)) {
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

        closeModal(container);
        refreshPanel(container, state, 'chatList');

        /* [区域标注] 自动打开新创建的聊天 */
        await openChatMessage(container, state, db, contact.id);
      }
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 通讯录分组 TAB 切换
       ========================================================================== */
    case 'switch-contact-group': {
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
      if (input && input.value.trim()) {
        await sendMessage(container, state, db, input.value);
      }
      break;
    }

    /* [区域标注] 聊天消息页面 — 咖啡按钮（预留） */
    case 'msg-coffee':
      /* 预留功能位，后续扩展 */
      break;

    /* [区域标注] 聊天消息页面 — 魔术棒按钮（预留） */
    case 'msg-magic':
      /* 预留功能位，后续扩展 */
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
    dbPut(db, DATA_KEY_CONTACTS(maskId), state.contacts),
    /* [区域标注·本次需求1] 持久化通讯录自定义分组到 IndexedDB（禁止浏览器同步键值存储） */
    dbPut(db, DATA_KEY_CONTACT_GROUPS(maskId), state.contactGroups),
    dbPut(db, DATA_KEY_MOMENTS(maskId), state.moments)
  ]);
}

/* ==========================================================================
   [区域标注·修改5] 加载指定面具的聊天数据
   说明：在切换面具后调用，从 IndexedDB 恢复该面具的数据
   ========================================================================== */
async function loadMaskData(state, db, maskId) {
  const [sessions, contacts, contactGroups, moments] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(maskId)),
    dbGet(db, DATA_KEY_CONTACTS(maskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(maskId)),
    dbGet(db, DATA_KEY_MOMENTS(maskId))
  ]);
  state.sessions = sessions || [];
  state.contacts = normalizeContacts(contacts);
  /* [区域标注·本次需求1] 切换面具时同步加载该面具的通讯录分组 */
  state.contactGroups = normalizeContactGroups(contactGroups);
  state.activeContactGroupId = 'all';
  state.moments = moments || [];
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
}
