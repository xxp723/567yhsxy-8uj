/**
 * js/apps/chat/index.js
 * 闲谈应用主入口
 *
 * =========================================================
 * 闲谈应用 DB 区域：只允许使用 DB.js / IndexedDB
 * 禁止使用 localStorage / sessionStorage
 * =========================================================
 */

import { renderList } from './list.js';
import { renderContacts } from './contacts.js';
import { renderMoments } from './moments.js';
import { renderProfile } from './profile.js';
import { renderConversation } from './conversation.js';

/* =========================================================
 * 闲谈应用 IconPark 图标区域
 * 所有按钮图标统一从这里取
 * ========================================================= */
export const ICONS = {
  back: '<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24 31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  add: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29.5 29.5L40 40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  
  // Tab Icons
  chat: '<svg viewBox="0 0 48 48" fill="none"><path d="M44 24c0 11.046-8.954 20-20 20-2.26 0-4.432-.375-6.452-1.07L6 44l2.5-9.5A19.866 19.866 0 0 1 4 24C4 12.954 12.954 4 24 4s20 8.954 20 20z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>',
  contacts: '<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM14 34c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  moments: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 4v40M4 24h40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="3"/></svg>',
  profile: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="12" r="8" stroke="currentColor" stroke-width="3"/><path d="M42 44c0-9.941-8.059-18-18-18S6 34.059 6 44" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  
  // Conversation Icons
  coffee: '<svg viewBox="0 0 48 48" fill="none"><path d="M28 12v22c0 2.21-1.79 4-4 4h-8c-2.21 0-4-1.79-4-4V12h16zM28 16h6c2.21 0 4 1.79 4 4v2c0 2.21-1.79 4-4 4h-6M18 4v4M24 4v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 38h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  ai: '<svg viewBox="0 0 48 48" fill="none"><path d="M24 4v8M24 36v8M44 24h-8M12 24H4M38 10l-6 6M16 32l-6 6M38 38l-6-6M16 16l-6-6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="24" r="8" fill="currentColor"/></svg>',
  send: '<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L29.7 43 22.1 25.9 4.5 18.3 43 5z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M43 5L22.1 25.9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="5" stroke="currentColor" stroke-width="3"/><path d="M35.6 14.4l-2.6 1.5A13.92 13.92 0 0 0 30.1 12l.6-2.9A2 2 0 0 0 28.8 7H19.2a2 2 0 0 0-1.9 2.1l.6 2.9a13.92 13.92 0 0 0-2.9 3.9l-2.6-1.5a2 2 0 0 0-2.7.7L5.5 22.4a2 2 0 0 0 .5 2.7l2.3 1.9c-.1.7-.1 1.3-.1 2s0 1.3.1 2l-2.3 1.9a2 2 0 0 0-.5 2.7l4.2 7.3a2 2 0 0 0 2.7.7l2.6-1.5a13.92 13.92 0 0 0 2.9 3.9l-.6 2.9A2 2 0 0 0 19.2 41h9.6a2 2 0 0 0 1.9-2.1l-.6-2.9a13.92 13.92 0 0 0 2.9-3.9l2.6 1.5a2 2 0 0 0 2.7-.7l4.2-7.3a2 2 0 0 0-.5-2.7l-2.3-1.9c.1-.7.1-1.3.1-2s0-1.3-.1-2l2.3-1.9a2 2 0 0 0 .5-2.7l-4.2-7.3a2 2 0 0 0-2.7-.7z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronRight: '<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevronDown: '<svg viewBox="0 0 48 48" fill="none"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

/* =========================================================
 * 工具函数区域
 * ========================================================= */
export const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const esc = v => String(v ?? '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');

// 动态加载 CSS，防止全局污染
export const loadCss = (href, id) => {
  return new Promise((resolve) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = resolve; // 失败也继续
    document.head.appendChild(link);
  });
};

/* =========================================================
 * 闲谈数据获取封装区域
 * ========================================================= */
const CHAT_DATA_KEY = 'chat::data-v1';

export async function getChatData(db, appId) {
  let record = await db.get('appsData', CHAT_DATA_KEY);
  if (!record || !record.value) {
    record = {
      id: CHAT_DATA_KEY,
      appId,
      key: 'data-v1',
      value: {
        version: 1,
        contactsByMask: {},
        conversationsByMask: {},
        messagesByConversation: {},
        chatSettingsByConversation: {},
        momentsByMask: {},
        profileExtrasByMask: {}
      }
    };
    await db.put('appsData', record);
  }
  return record.value;
}

export async function saveChatData(db, appId, value) {
  await db.put('appsData', {
    id: CHAT_DATA_KEY,
    appId,
    key: 'data-v1',
    value,
    updatedAt: Date.now()
  });
}

export async function getArchiveData(db) {
  const rec = await db.get('appsData', 'archive::archive-data');
  return rec?.value || null;
}

export async function getWorldbookData(db) {
  const rec = await db.get('appsData', 'worldbook::all-books');
  return rec?.value || [];
}

export async function getSettingsData(db) {
  const rec = await db.get('settings', 'global');
  return rec?.value || null;
}

/* =========================================================
 * 弹窗与 Toast 区域（应用内，无原生）
 * ========================================================= */
export function showToast(container, msg, type = 'info') {
  let toastEl = container.querySelector('#chat-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'chat-toast';
    toastEl.className = 'chat-toast';
    container.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.dataset.type = type;
  toastEl.classList.add('show');
  if (toastEl._timer) clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

export function openModal(container, { title, body, okTxt = '确认', noTxt = '取消', onOk, hideFooter = false }) {
  let modalEl = container.querySelector('#chat-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'chat-modal';
    modalEl.className = 'chat-modal hidden';
    container.appendChild(modalEl);
  }
  
  modalEl.innerHTML = `
    <div class="chat-modal__mask" data-act="close"></div>
    <div class="chat-modal__panel">
      <div class="chat-modal__header">
        <span>${esc(title)}</span>
        <button class="chat-modal__close" data-act="close">${ICONS.close}</button>
      </div>
      <div class="chat-modal__body">${body}</div>
      ${!hideFooter ? `
      <div class="chat-modal__footer">
        <button class="chat-btn chat-btn--default" data-act="close">${esc(noTxt)}</button>
        <button class="chat-btn chat-btn--primary" data-act="ok">${esc(okTxt)}</button>
      </div>` : ''}
    </div>
  `;
  modalEl.classList.remove('hidden');
  
  const handler = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') {
      modalEl.classList.add('hidden');
      modalEl.removeEventListener('click', handler);
    } else if (act === 'ok') {
      if (onOk) {
        const keepOpen = await onOk(modalEl);
        if (keepOpen !== false) {
          modalEl.classList.add('hidden');
          modalEl.removeEventListener('click', handler);
        }
      } else {
        modalEl.classList.add('hidden');
        modalEl.removeEventListener('click', handler);
      }
    }
  };
  modalEl.addEventListener('click', handler);
  return modalEl;
}

/* =========================================================
 * 四大板块状态与渲染管理
 * ========================================================= */
export async function mount(container, context) {
  const { db, appId, eventBus } = context;
  const appWindow = container.closest('.app-window');
  
  // 初始化结构
  container.innerHTML = `
    <div class="chat-app" id="chat-app-root">
      <div class="chat-content" id="chat-content"></div>
      <div class="chat-tabbar" id="chat-tabbar"></div>
    </div>
  `;
  const rootEl = container.querySelector('#chat-app-root');
  const contentEl = container.querySelector('#chat-content');
  const tabbarEl = container.querySelector('#chat-tabbar');

  // 状态
  const state = {
    activeTab: 'list', // list, contacts, moments, profile, conversation
    activeConversationId: null,
    chatData: null,
    archiveData: null,
    activeMaskId: null,
    cssLoaded: {}
  };

  // 获取数据
  state.chatData = await getChatData(db, appId);
  state.archiveData = await getArchiveData(db);
  state.activeMaskId = state.archiveData?.activeMaskId || null;

  // 刷新数据的方法
  const refreshData = async () => {
    state.archiveData = await getArchiveData(db);
    state.activeMaskId = state.archiveData?.activeMaskId || null;
    await renderCurrentTab();
  };

  // 监听档案身份切换
  const onMaskChanged = () => refreshData();
  if (eventBus) {
    eventBus.on('archive:active-mask-changed', onMaskChanged);
    eventBus.on('character:imported', onMaskChanged);
  }

  // 动态加载对应 CSS 并渲染
  const renderCurrentTab = async () => {
    // 隐藏标题栏默认内容（我们会在应用内部模拟顶栏，或者覆盖）
    const header = appWindow?.querySelector('.app-window__header');
    if (header) {
      const closeBtn = header.querySelector('.app-window__close');
      const actionsEl = header.querySelector('.app-window__actions');
      if (closeBtn) closeBtn.style.display = 'none';
      if (actionsEl) actionsEl.style.display = 'none';
      header.innerHTML = ''; // 清空，因为我们会把自定义顶栏放在各自的 css 里或直接挂在内容里。
      // 为统一，我们隐藏原窗体的头部，直接在 chat-content 内部画 header。
      header.style.display = 'none';
    }
    
    // 加载当前 tab 对应的 css
    const cssName = `chat-${state.activeTab}`;
    if (!state.cssLoaded[cssName]) {
      await loadCss(`js/apps/chat/${state.activeTab}.css`, `css-${cssName}`);
      state.cssLoaded[cssName] = true;
    }
    
    // 给 appWindow 加上标志性 class，以便独立 CSS 控制
    appWindow.className = `app-window chat-app-window chat-app-window--${state.activeTab}`;

    const renderCtx = {
      container: contentEl,
      rootEl,
      db,
      appId,
      eventBus,
      state,
      ICONS,
      showToast: (msg, type) => showToast(rootEl, msg, type),
      openModal: (opts) => openModal(rootEl, opts),
      switchTab: (tab) => {
        state.activeTab = tab;
        renderCurrentTab();
      },
      openConversation: (convId) => {
        state.activeConversationId = convId;
        state.activeTab = 'conversation';
        renderCurrentTab();
      },
      closeApp: () => {
        eventBus?.emit('app:close', { appId });
      }
    };

    if (state.activeTab === 'conversation') {
      tabbarEl.style.display = 'none';
      await renderConversation(renderCtx);
    } else {
      tabbarEl.style.display = 'flex';
      renderTabbar();
      if (state.activeTab === 'list') await renderList(renderCtx);
      else if (state.activeTab === 'contacts') await renderContacts(renderCtx);
      else if (state.activeTab === 'moments') await renderMoments(renderCtx);
      else if (state.activeTab === 'profile') await renderProfile(renderCtx);
    }
  };

  const renderTabbar = () => {
    const tabs = [
      { id: 'list', icon: ICONS.chat, label: '聊天' },
      { id: 'contacts', icon: ICONS.contacts, label: '通讯录' },
      { id: 'moments', icon: ICONS.moments, label: '动态' },
      { id: 'profile', icon: ICONS.profile, label: '主页' }
    ];
    
    tabbarEl.innerHTML = tabs.map(t => `
      <div class="chat-tab-item ${state.activeTab === t.id ? 'is-active' : ''}" data-tab="${t.id}">
        <span class="chat-tab-icon">${t.icon}</span>
        ${state.activeTab === t.id ? `<span class="chat-tab-label">${t.label}</span>` : ''}
      </div>
    `).join('');
  };

  tabbarEl.addEventListener('click', (e) => {
    const item = e.target.closest('.chat-tab-item');
    if (!item) return;
    const tab = item.dataset.tab;
    if (tab && tab !== state.activeTab) {
      state.activeTab = tab;
      renderCurrentTab();
    }
  });

  await renderCurrentTab();

  return () => {
    if (eventBus) {
      eventBus.off('archive:active-mask-changed', onMaskChanged);
      eventBus.off('character:imported', onMaskChanged);
    }
    if (appWindow) {
      appWindow.className = 'app-window';
      const header = appWindow.querySelector('.app-window__header');
      if (header) {
        header.style.display = '';
        // 恢复内容视口需刷新
      }
    }
  };
}

export function unmount() {}
