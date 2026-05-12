// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-stickers.js
 * 用途: 闲谈应用 — 聊天消息页表情包面板与输入联想子模块
 *       承载表情包面板分组、可见项、输入联想与局部 DOM 同步逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

import { escapeHtml, normalizeStickerData } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 继续拆分] 聊天页表情包面板数据工具
   说明：
   1. 本模块从 chat-message.js 中拆出，只负责聊天页表情包面板与输入联想的运行时工具。
   2. All 为固定默认分组；输入栏表情包面板与聊天设置“表情包挂载”共用同一份运行时数据。
   3. 只使用当前 state.stickerData / IndexedDB 已加载数据，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function normalizeStickerPanelData(rawData) {
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
      url: String(item?.url || '').trim()
    }))
    .filter(item => item.id && item.name && item.url);

  return { groups, items };
}

export function getStickerPanelGroups(rawData) {
  const data = normalizeStickerPanelData(rawData);
  return [{ id: 'all', name: 'All' }, ...data.groups];
}

export function getVisibleStickerPanelItems(rawData, groupId = 'all') {
  const data = normalizeStickerPanelData(rawData);
  if (groupId === 'all') return data.items;
  return data.items.filter(item => item.groupId === groupId);
}

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 继续拆分] 输入关键词关联表情包工具
   说明：
   1. 用户在聊天输入框打字时，只按表情包名称包含关系联想。
   2. 只有存在命中的表情包时才显示联想窗口；无输入或无命中时直接隐藏。
   3. 输入变化时优先局部更新已有 scroller 内容，避免反复重建整个窗口。
   ========================================================================== */
export function getStickerInputSuggestionItems(rawData, keyword = '') {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return [];
  const data = normalizeStickerPanelData(rawData);
  return data.items
    .filter(item => String(item.name || '').toLowerCase().includes(query))
    .slice(0, 12);
}

export function renderStickerInputSuggestItemsHtml(items = []) {
  return (Array.isArray(items) ? items : []).map(item => `
    <button class="msg-sticker-suggest__item"
            data-action="send-msg-sticker"
            data-sticker-id="${escapeHtml(item.id)}"
            type="button"
            title="${escapeHtml(item.name)}">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
      <span>${escapeHtml(item.name)}</span>
    </button>
  `).join('');
}

export function renderStickerInputSuggestDockHtml(keyword = '', rawData = {}) {
  const query = String(keyword || '').trim();
  const items = getStickerInputSuggestionItems(rawData, query);
  if (!query || !items.length) return '';

  return `
    <div class="msg-sticker-suggest" data-role="msg-sticker-suggest" data-suggest-keyword="${escapeHtml(query)}">
      <div class="msg-sticker-suggest__scroller">
        ${renderStickerInputSuggestItemsHtml(items)}
      </div>
    </div>
  `;
}

export function syncStickerInputSuggestions(container, state, keyword = '') {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const shell = msgWrap?.querySelector('.msg-input-shell');
  if (!shell) return false;

  const query = String(keyword || '').trim();
  const items = getStickerInputSuggestionItems(state.stickerData, query);
  const existingSuggest = shell.querySelector('[data-role="msg-sticker-suggest"]');

  if (!query || !items.length) {
    existingSuggest?.remove();
    return true;
  }

  const nextItemsHtml = renderStickerInputSuggestItemsHtml(items);
  if (existingSuggest) {
    existingSuggest.dataset.suggestKeyword = query;
    const scroller = existingSuggest.querySelector('.msg-sticker-suggest__scroller');
    if (scroller) {
      scroller.innerHTML = nextItemsHtml;
      return true;
    }
    existingSuggest.outerHTML = renderStickerInputSuggestDockHtml(query, state.stickerData);
    return true;
  }

  const inputBar = shell.querySelector('.msg-input-bar');
  if (!inputBar) return false;

  inputBar.insertAdjacentHTML('beforebegin', renderStickerInputSuggestDockHtml(query, state.stickerData));
  return true;
}

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 继续拆分] 表情包面板局部刷新
   说明：
   1. 面板分组切换与挂载按钮同步都只做局部 DOM 更新，不重绘整个聊天页。
   2. 表情包资源仍来自当前运行时 state.stickerData，不新增任何持久化存储。
   ========================================================================== */
export function renderMsgStickerPanelGrid(container, state, renderCurrentChatMessage) {
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

export function syncMountedStickerGroupButtons(container, state) {
  const selectedSet = new Set(
    Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
      ? state.chatPromptSettings.mountedStickerGroupIds.map(String)
      : []
  );

  container.querySelectorAll('[data-action="toggle-mounted-sticker-group"]').forEach(btn => {
    btn.classList.toggle('is-active', selectedSet.has(String(btn.dataset.stickerGroupId || '')));
  });
}
