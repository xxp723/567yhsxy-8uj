// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-search.js
 * 用途: 闲谈应用 — 聊天消息页搜索子模块
 * 架构层: 应用层子模块（由 chat-message.js 统一导出/接线）
 */

import { escapeHtml } from './chat-utils.js';
import { MSG_ICONS } from './chat-message-icons.js';
import { getMessageDisplayTextForQuote } from './chat-message-quote.js';

/* ========================================================================
   [区域标注·已完成·本次拆分] 聊天记录搜索文案提取
   说明：
   1. 搜索时复用引用摘要模块的消息可读文本提取能力，保持普通消息与引用消息摘要口径一致。
   2. 搜索仅使用当前运行时消息数组，不写入 IndexedDB，不使用 localStorage/sessionStorage。
   3. 后续如需调整搜索命中文案范围，请优先修改本文件。
   ======================================================================== */
export function getChatSearchMessageText(message = {}) {
  const baseText = getMessageDisplayTextForQuote(message);
  const quoteText = String(message?.quote?.text || '').trim();
  return [baseText, quoteText].filter(Boolean).join(' ');
}

export function getChatSearchMatches(messages = [], keyword = '') {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return [];
  return (Array.isArray(messages) ? messages : [])
    .map((message, index) => ({
      message,
      index,
      text: getChatSearchMessageText(message)
    }))
    .filter(item => String(item.text || '').toLowerCase().includes(query));
}

export function renderChatSearchResultBubble(item = {}, session = {}, userProfile = {}) {
  const message = item.message || {};
  const isUser = message.role === 'user';
  const senderName = isUser
    ? String(userProfile?.nickname || '我')
    : String(session?.remark || session?.name || '对方');
  const text = getChatSearchMessageText(message) || '（空消息）';

  return `
    <button class="msg-search-result ${isUser ? 'msg-search-result--user' : 'msg-search-result--other'}"
            data-action="jump-msg-search-result"
            data-message-id="${escapeHtml(message.id || '')}"
            type="button">
      <span class="msg-search-result__meta">${escapeHtml(senderName)} · 第 ${Number(item.index || 0) + 1} 条</span>
      <span class="msg-search-result__bubble">${escapeHtml(text)}</span>
    </button>
  `;
}

export function renderChatMessageSearchResultsHtml(session = {}, messages = [], options = {}) {
  const keyword = String(options.chatSearchKeyword || '');
  const matches = getChatSearchMatches(messages, keyword);
  const userProfile = options.userProfile || {};

  return keyword
    ? (matches.length
        ? matches.map(item => renderChatSearchResultBubble(item, session, userProfile)).join('')
        : `<div class="msg-search-panel__empty">没有命中“${escapeHtml(keyword)}”</div>`)
    : `<div class="msg-search-panel__empty">输入关键字后，你与对方的相关消息都会显示在这里。</div>`;
}

export function renderChatMessageSearchPanelHtml(session = {}, messages = [], options = {}) {
  const searchOpen = Boolean(options.chatSearchOpen);
  const keyword = String(options.chatSearchKeyword || '');

  return `
    <!-- ======================================================================
         [区域标注·已完成·聊天记录搜索文案与回滚定位修复] 顶栏下浮搜索框与命中结果
         说明：
         1. 点击顶栏放大镜后从顶栏下边框向下浮现；搜索仅使用当前运行时消息数组。
         2. 输入时只替换 data-role="msg-search-results" 内容，不替换 input DOM，避免输入法被关闭。
         3. 空状态文案已按本次需求更新为“你与对方”的说明。
         4. 本区域不涉及持久化存储，不使用 localStorage/sessionStorage。
         ====================================================================== -->
    <div class="msg-search-panel ${searchOpen ? 'is-open' : ''}" data-role="msg-search-panel">
      <div class="msg-search-panel__box">
        <span class="msg-search-panel__icon">${MSG_ICONS.search}</span>
        <input class="msg-search-panel__input"
               data-role="msg-search-input"
               type="text"
               value="${escapeHtml(keyword)}"
               placeholder="搜索聊天记录">
      </div>
      <div class="msg-search-panel__results" data-role="msg-search-results">
        ${renderChatMessageSearchResultsHtml(session, messages, options)}
      </div>
    </div>
  `;
}

/* ========================================================================
   [区域标注·已完成·本次拆分] 聊天记录搜索面板局部同步
   说明：
   1. 输入过程中禁止替换整个面板，只同步开合 class、input value 与结果列表，保持输入法稳定。
   2. 搜索状态仅为运行时 UI 状态，不读写 IndexedDB/localStorage/sessionStorage。
   3. 后续如需调整聚焦、结果刷新或浮层开合行为，请优先修改本文件。
   ======================================================================== */
export function syncChatMessageSearchPanel(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const conversation = msgWrap?.querySelector('[data-role="msg-conversation"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!conversation || !session) return false;

  const searchOptions = {
    userProfile: state.profile,
    chatSearchOpen: state.chatMessageSearchOpen,
    chatSearchKeyword: state.chatMessageSearchKeyword
  };

  let panel = conversation.querySelector('[data-role="msg-search-panel"]');
  if (!panel) {
    conversation.querySelector('.msg-top-bar')?.insertAdjacentHTML(
      'afterend',
      renderChatMessageSearchPanelHtml(session, state.currentMessages, searchOptions)
    );
    panel = conversation.querySelector('[data-role="msg-search-panel"]');
  }

  if (!panel) return false;

  panel.classList.toggle('is-open', Boolean(state.chatMessageSearchOpen));

  const searchBtn = conversation.querySelector('[data-action="toggle-msg-search"]');
  if (searchBtn) searchBtn.classList.toggle('is-active', Boolean(state.chatMessageSearchOpen));

  const input = panel.querySelector('[data-role="msg-search-input"]');
  const keyword = String(state.chatMessageSearchKeyword || '');
  if (input && input.value !== keyword) input.value = keyword;

  const results = panel.querySelector('[data-role="msg-search-results"]');
  if (results) {
    results.innerHTML = renderChatMessageSearchResultsHtml(session, state.currentMessages, searchOptions);
  }

  if (state.chatMessageSearchOpen && input && document.activeElement !== input) {
    window.setTimeout(() => {
      if (!state.chatMessageSearchOpen || document.activeElement === input) return;
      input.focus({ preventScroll: true });
      const len = String(input.value || '').length;
      input.setSelectionRange(len, len);
    }, 30);
  }

  return true;
}

/* ========================================================================
   [区域标注·已完成·本次拆分] 聊天记录搜索回滚定位
   说明：
   1. 只滚动消息列表容器自身，不调用 row.scrollIntoView()，避免把桌面层和顶栏一起带动。
   2. 定位与高亮仅作用于当前运行时 DOM，不涉及任何持久化存储。
   3. 后续如需调整定位偏移或高亮时长，请优先修改本文件。
   ======================================================================== */
export function scrollToChatSearchResult(container, messageId = '') {
  const safeMessageId = String(messageId || '').trim();
  if (!safeMessageId) return false;

  const listArea = container.querySelector('[data-role="msg-list"]');
  const row = listArea?.querySelector(`[data-message-id="${CSS.escape(safeMessageId)}"]`);
  if (!listArea || !row) return false;

  const listRect = listArea.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const nextScrollTop = listArea.scrollTop
    + (rowRect.top - listRect.top)
    - ((listArea.clientHeight - rowRect.height) / 2);

  listArea.scrollTo({
    top: Math.max(0, Math.min(nextScrollTop, listArea.scrollHeight - listArea.clientHeight)),
    behavior: 'smooth'
  });
  row.classList.remove('is-search-target');
  window.setTimeout(() => row.classList.add('is-search-target'), 20);
  window.setTimeout(() => row.classList.remove('is-search-target'), 1700);
  return true;
}
