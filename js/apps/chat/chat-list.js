// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-list.js
 * 用途: 闲谈应用 — 聊天列表板块
 *       管理所有聊天会话的显示、All/Private/Group 三个子TAB切换、
 *       折叠分组标题、搜索过滤等功能。
 * 架构层: 应用层（闲谈子模块）
 */

import { TAB_ICONS, escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   说明：聊天列表板块用到的所有图标，统一从 IconPark 字节跳动开源引用
   ========================================================================== */
const ICONS = {
  /* [区域标注] 搜索图标 */
  search: `<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29 29l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 展开/折叠箭头 — 向下 */
  chevronDown: `<svg viewBox="0 0 48 48" fill="none"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 展开/折叠箭头 — 向右（折叠态） */
  chevronRight: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 消息气泡空状态图标 */
  message: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 19.5h20M14 27.5h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/* ==========================================================================
   [区域标注] 渲染聊天列表 HTML
   说明：根据当前子TAB（all/private/group）和搜索关键词过滤并渲染列表
   ========================================================================== */
export function renderChatList(chatSessions, subTab, searchKeyword, sectionCollapsed) {
  const keyword = (searchKeyword || '').toLowerCase().trim();

  /* [区域标注] 过滤会话列表 */
  let filtered = chatSessions.filter(s => {
    /* ========================================================================
       [区域标注·已完成·当前会话备注显示名]
       说明：
       1. 聊天列表显示名与搜索关键字优先使用 session.remark，其次回退 session.name。
       2. 备注仅用于本地 UI 展示，不写入 AI 提示词。
       ======================================================================== */
    const displayName = String(s.remark ?? '').length ? String(s.remark) : String(s.name || '');
    if (keyword && !displayName.toLowerCase().includes(keyword)) return false;
    return true;
  });

  /* [区域标注] 按子TAB分类 */
  const privateChats = filtered.filter(s => s.type === 'private');
  const groupChats = filtered.filter(s => s.type === 'group');

  /* [区域标注] 搜索栏 HTML */
  const searchBarHtml = `
    <!-- [区域标注] 聊天列表搜索栏 -->
    <div class="chat-search-bar">
      ${ICONS.search}
      <input type="text" placeholder="搜索聊天..." data-role="chat-search-input" value="${escapeHtml(searchKeyword || '')}">
    </div>
  `;

  /* [区域标注] 渲染单个聊天条目 */
  const renderItem = (session) => `
    <!-- === [本次修改] 聊天列表长按删除联系人：长按该聊天条目仅从聊天列表隐藏 === -->
    <div class="chat-item" data-action="open-chat" data-long-press-action="delete-chat-list-contact" data-chat-id="${session.id}">
      <div class="chat-item__avatar">
        ${session.avatar
          ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(session.name)}">`
          : escapeHtml((session.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-item__info">
        <div class="chat-item__name">${escapeHtml(String(session.remark ?? '').length ? String(session.remark) : (session.name || '未命名'))}</div>
        <div class="chat-item__last-msg">${escapeHtml(session.lastMessage || '')}</div>
      </div>
      <div class="chat-item__meta">
        <span class="chat-item__time">${formatTime(session.lastTime)}</span>
        <span class="chat-item__badge ${(session.unread || 0) <= 0 ? 'is-hidden' : ''}">${session.unread || 0}</span>
      </div>
    </div>
  `;

  /* [区域标注] 渲染分组区块（带可折叠标题） */
  const renderSection = (title, key, items) => {
    const isCollapsed = !!sectionCollapsed[key];
    if (items.length === 0) return '';
    return `
      <!-- [区域标注] 聊天列表分区：${title} -->
      <div class="chat-list-section">
        <div class="chat-list-section__header ${isCollapsed ? 'is-collapsed' : ''}" data-action="toggle-section" data-section-key="${key}">
          <h3>${escapeHtml(title)}</h3>
          <span class="chat-section-toggle">${isCollapsed ? ICONS.chevronRight : ICONS.chevronDown}</span>
        </div>
        <div class="chat-list-section__body ${isCollapsed ? 'is-collapsed' : ''}" style="${isCollapsed ? 'max-height:0;' : ''}">
          ${items.map(renderItem).join('')}
        </div>
      </div>
    `;
  };

  /* [区域标注] 空状态提示 */
  const emptyHtml = `
    <!-- [区域标注] 聊天列表空状态 -->
    <div class="chat-list-empty">
      ${ICONS.message}
      <p>暂无聊天记录<br>点击右上角 + 开始新对话</p>
    </div>
  `;

  /* [区域标注] 按子TAB组装最终内容 */
  let listContentHtml = '';

  if (subTab === 'all') {
    /* [区域标注] All 板块 — 包含 Private 和 Group 折叠分区 */
    if (privateChats.length === 0 && groupChats.length === 0) {
      listContentHtml = emptyHtml;
    } else {
      listContentHtml = renderSection('Private', 'private', privateChats)
                       + renderSection('Group', 'group', groupChats);
    }
  } else if (subTab === 'private') {
    /* [区域标注] Private 板块 — 仅显示单聊 */
    listContentHtml = privateChats.length > 0
      ? privateChats.map(renderItem).join('')
      : emptyHtml;
  } else if (subTab === 'group') {
    /* [区域标注] Group 板块 — 仅显示群聊 */
    listContentHtml = groupChats.length > 0
      ? groupChats.map(renderItem).join('')
      : emptyHtml;
  }

  return `
    <!-- [区域标注] 聊天列表主内容区 -->
    ${searchBarHtml}
    <div class="chat-list-area">
      ${listContentHtml}
    </div>
  `;
}

/* ==========================================================================
   [区域标注] 获取可见聊天会话（排除隐藏的）
   ========================================================================== */
export function getVisibleChatSessions(state) {
  const hiddenSet = new Set(Array.isArray(state.hiddenChatIds) ? state.hiddenChatIds.map(String) : []);
  return (state.sessions || []).filter(session => !hiddenSet.has(String(session.id)));
}

/* ==========================================================================
   [区域标注] 显示"添加聊天"弹窗
   ========================================================================== */
export function showAddChatModal(container, state) {
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
   [区域标注] 聊天列表长按处理器
   ========================================================================== */
export function createChatListLongPressHandlers(state, container) {
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
   [区域标注] 删除聊天列表联系人确认弹窗
   ========================================================================== */
export function showDeleteChatListContactModal(container, state, chatId) {
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
