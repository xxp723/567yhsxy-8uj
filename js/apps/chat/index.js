/**
 * 文件名: js/apps/chat/index.js
 * 用途: 闲谈应用入口模块。
 *       负责加载 CSS、初始化数据、渲染四大板块骨架、
 *       管理板块切换、事件代理、聊天消息页面跳转等。
 *       使用 DB.js（IndexedDB）进行持久化存储，禁止 localStorage。
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
   ========================================================================== */
const APP_ID = 'chat';
const STORE_NAME = 'appsData';
const DATA_KEY_SESSIONS = 'chat_sessions';
const DATA_KEY_CONTACTS = 'chat_contacts';
const DATA_KEY_MOMENTS = 'chat_moments';
const DATA_KEY_PROFILE = 'chat_profile';
const DATA_KEY_MESSAGES_PREFIX = 'chat_msgs_';
const PANEL_KEYS = ['chatList', 'contacts', 'moments', 'profile'];
const PANEL_LABELS = ['Chat', 'Contacts', 'Moments', 'Me'];
const PANEL_ICON_KEYS = ['chat', 'contacts', 'moments', 'profile'];

/* ==========================================================================
   [区域标注] CSS 动态加载工具函数（优化：返回 Promise，等待 CSS 加载完毕再渲染）
   说明：将闲谈应用的 CSS 直接注入 <head>，挂载时加载，卸载时移除
   ========================================================================== */
function loadCSS(href, id) {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = id;
    link.onload = () => resolve();
    link.onerror = () => resolve(); // 即使加载失败也不阻塞
    document.head.appendChild(link);
  });
}

function removeCSS(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/* ==========================================================================
   [区域标注] DB 数据读写封装（使用 IndexedDB，禁止 localStorage）
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
   [区域标注] mount — 应用挂载入口
   说明：由 AppManager 调用，接收容器元素和上下文
   ========================================================================== */
export async function mount(container, context) {
  const { appMeta, eventBus, db, windowManager } = context;

  /* ==========================================================================
     [区域标注] 并行预加载 CSS + IndexedDB 数据，全部就绪后再渲染（消除进入卡顿）
     说明：CSS 与数据并行加载，避免串行等待导致的白屏/闪烁
     ========================================================================== */
  const [,, sessions, contacts, moments, profile] = await Promise.all([
    loadCSS('./js/apps/chat/chat.css', 'chat-app-css'),
    loadCSS('./js/apps/chat/chat-message.css', 'chat-msg-css'),
    dbGet(db, DATA_KEY_SESSIONS),
    dbGet(db, DATA_KEY_CONTACTS),
    dbGet(db, DATA_KEY_MOMENTS),
    dbGet(db, DATA_KEY_PROFILE)
  ]);

  /* [区域标注] 应用状态对象 */
  const state = {
    activePanel: 'chatList',        // 当前激活的板块
    chatSubTab: 'all',              // 聊天列表子TAB: all / private / group
    chatSearchKeyword: '',          // 聊天列表搜索词
    contactsSearchKeyword: '',      // 通讯录搜索词
    sectionCollapsed: {},           // 折叠状态 {private: false, group: false}
    sessions: sessions || [],       // 聊天会话列表
    contacts: contacts || [],       // 通讯录好友列表
    moments: moments || [],         // 朋友圈动态列表
    profile: profile || {},         // 用户资料
    currentChatId: null,            // 当前打开的聊天会话 ID（null 表示未打开）
    currentMessages: [],            // 当前聊天消息列表
    destroyed: false                // 是否已销毁
  };

  /* [区域标注] 渲染应用骨架 HTML */
  container.innerHTML = buildAppShell(state);

  /* [区域标注] 绑定全局事件代理 */
  const clickHandler = (e) => handleClick(e, state, container, db, eventBus, windowManager, appMeta);
  const inputHandler = (e) => handleInput(e, state, container, db);
  container.addEventListener('click', clickHandler);
  container.addEventListener('input', inputHandler);

  /* [区域标注] 返回实例（含 destroy 清理函数） */
  return {
    destroy() {
      state.destroyed = true;
      container.removeEventListener('click', clickHandler);
      container.removeEventListener('input', inputHandler);
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
    <div class="chat-app" data-role="chat-app-root">

      <!-- ================================================================
           [区域标注] 顶部导航栏
           说明：左上角">"返回桌面，中间花体字"Chat"，右上角"+"添加
           ================================================================ -->
      <div class="chat-top-bar">
        <button class="chat-top-bar__back" data-action="go-home">${TAB_ICONS.back}</button>
        <div class="chat-top-bar__title">Chat</div>
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
        ${renderContacts(state.contacts, state.contactsSearchKeyword)}
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
      panelEl.innerHTML = renderContacts(state.contacts, state.contactsSearchKeyword);
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

  /* [区域标注] "+"按钮仅在聊天列表板块显示 */
  const addBtn = container.querySelector('.chat-top-bar__add');
  if (addBtn) addBtn.style.display = panelKey === 'chatList' ? '' : 'none';
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
  state.currentMessages = (await dbGet(db, DATA_KEY_MESSAGES_PREFIX + chatId)) || [];

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
  await dbPut(db, DATA_KEY_MESSAGES_PREFIX + state.currentChatId, state.currentMessages);

  /* [区域标注] 更新会话的最后消息和时间 */
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (session) {
    session.lastMessage = content.trim();
    session.lastTime = Date.now();
    await dbPut(db, DATA_KEY_SESSIONS, state.sessions);
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

    /* [区域标注] 右上角"+"添加聊天 */
    case 'add-chat':
      showAddChatModal(container, state);
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
        await dbPut(db, DATA_KEY_SESSIONS, state.sessions);

        closeModal(container);
        refreshPanel(container, state, 'chatList');

        /* [区域标注] 自动打开新创建的聊天 */
        await openChatMessage(container, state, db, contact.id);
      }
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
       [区域标注] 用户主页 — 点击封面区域上传封面图片
       说明：弹出自定义弹窗，支持本地上传 / URL 链接上传
       ========================================================================== */
    case 'upload-cover':
      showImageUploadModal(container, state, db, 'cover');
      break;

    /* ==========================================================================
       [区域标注] 用户主页 — 点击头像区域上传头像图片
       说明：弹出自定义弹窗，支持本地上传 / URL 链接上传
       ========================================================================== */
    case 'upload-avatar':
      showImageUploadModal(container, state, db, 'avatar');
      break;

    /* [区域标注] 图片上传弹窗 — 选择本地文件 */
    case 'upload-pick-local': {
      const uploadType = target.dataset.uploadType;
      triggerLocalFileUpload(container, state, db, uploadType);
      break;
    }

    /* [区域标注] 图片上传弹窗 — 确认 URL 链接 */
    case 'upload-confirm-url': {
      const uploadType2 = target.dataset.uploadType;
      confirmUrlUpload(container, state, db, uploadType2);
      break;
    }

    default:
      break;
  }
}

/* ==========================================================================
   [区域标注] 显示图片上传弹窗（封面/头像共用）
   说明：替代原生浏览器弹窗，与设置应用内弹窗风格统一
         支持两种上传方式：本地文件选择 / URL 链接输入
   参数：type — 'cover' 表示封面，'avatar' 表示头像
   ========================================================================== */
function showImageUploadModal(container, state, db, type) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const titleText = type === 'cover' ? '更换封面图片' : '更换头像图片';

  /* [区域标注] 上传图标 SVG — IconPark 风格 */
  const uploadIcon = `<svg viewBox="0 0 48 48" fill="none"><path d="M24 34V14M15 23l9-9l9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 40h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
  const linkIcon = `<svg viewBox="0 0 48 48" fill="none"><path d="M26 24a6 6 0 0 0-8.49 0l-8.48 8.49a6 6 0 0 0 8.48 8.48l2.83-2.83" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 24a6 6 0 0 0 8.49 0l8.48-8.49a6 6 0 0 0-8.48-8.48L27.66 9.86" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  panel.innerHTML = `
    <!-- [区域标注] 图片上传弹窗 -->
    <div class="chat-modal-header">
      <span>${titleText}</span>
      <button class="chat-modal-close" data-action="close-modal">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body chat-upload-modal-body">
      <!-- [区域标注] 本地文件上传按钮 -->
      <button class="chat-upload-option" data-action="upload-pick-local" data-upload-type="${type}">
        <span class="chat-upload-option__icon">${uploadIcon}</span>
        <span class="chat-upload-option__text">从本地选择图片</span>
      </button>
      <!-- [区域标注] URL 链接输入区 -->
      <div class="chat-upload-url-area">
        <div class="chat-upload-url-label">
          <span class="chat-upload-url-label__icon">${linkIcon}</span>
          <span>通过 URL 链接上传</span>
        </div>
        <div class="chat-upload-url-row">
          <input class="chat-modal-search" type="url" placeholder="请输入图片 URL..." data-role="upload-url-input">
          <button class="chat-modal-btn chat-modal-btn--primary" data-action="upload-confirm-url" data-upload-type="${type}">确认</button>
        </div>
      </div>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注] 触发本地文件选择上传
   说明：创建隐藏 <input type="file">，用户选择图片后转为 base64 存储
   ========================================================================== */
function triggerLocalFileUpload(container, state, db, type) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) { fileInput.remove(); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result;
      if (!dataUrl) { fileInput.remove(); return; }

      /* [区域标注] 更新 profile 数据并持久化到 IndexedDB */
      if (type === 'cover') {
        state.profile.cover = dataUrl;
      } else {
        state.profile.avatar = dataUrl;
      }
      await dbPut(db, DATA_KEY_PROFILE, state.profile);

      closeModal(container);
      refreshPanel(container, state, 'profile');
      fileInput.remove();
    };
    reader.readAsDataURL(file);
  });

  fileInput.click();
}

/* ==========================================================================
   [区域标注] 确认 URL 链接上传
   说明：读取弹窗中 URL 输入框的值，保存到 profile 并持久化
   ========================================================================== */
async function confirmUrlUpload(container, state, db, type) {
  const input = container.querySelector('[data-role="upload-url-input"]');
  const url = input?.value?.trim();
  if (!url) return;

  /* [区域标注] 更新 profile 数据并持久化到 IndexedDB */
  if (type === 'cover') {
    state.profile.cover = url;
  } else {
    state.profile.avatar = url;
  }
  await dbPut(db, DATA_KEY_PROFILE, state.profile);

  closeModal(container);
  refreshPanel(container, state, 'profile');
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

  /* [区域标注] 通讯录搜索输入 */
  if (target.matches('[data-role="contacts-search-input"]')) {
    state.contactsSearchKeyword = target.value || '';
    refreshPanel(container, state, 'contacts');
    return;
  }
}
