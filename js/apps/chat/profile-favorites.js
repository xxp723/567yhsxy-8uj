// @ts-nocheck
/**
 * 文件名: js/apps/chat/profile-favorites.js
 * 用途: 闲谈应用 — 用户主页收藏子模块。
 *       负责收藏独立页、收藏分组、HTML 收藏卡片、多选、预览与移动弹窗。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·收藏模块]
   说明：
   1. 本文件由 profile.js 拆分而来，profile.js 继续作为对外接线层导出原接口。
   2. 收藏数据仍通过 chat-utils.js 的 persistFavoriteData 写入 DB.js / IndexedDB。
   3. 本模块不使用浏览器本地同步存储接口，不写双份存储兜底。
   4. 弹窗继续使用闲谈应用内 chat-modal 样式，不使用浏览器原生弹窗。
   ========================================================================== */
import {
  TAB_ICONS,
  ICON_CHECK,
  escapeHtml,
  normalizeFavoriteData,
  persistFavoriteData,
  createUid
} from './chat-utils.js';
import { showFavoriteSavedModal } from './chat-message.js';
import { sanitizeHtmlCardDocumentForSrcdoc } from './chat-html-card.js';
import { PROFILE_ICONS as ICONS } from './profile-icons.js';

/* ========================================================================== */
/* [区域标注·已完成·闲谈大文件拆分·收藏分组工具] 收藏分组列表：固定 'html' 分组插入在 All 之后、自定义分组之前 */
export function getFavoriteGroupsWithAll(state) {
  const data = normalizeFavoriteData(state.favoriteData);
  return [{ id: 'all', name: 'All' }, { id: 'html', name: 'HTML' }, ...data.groups];
}


export function getVisibleFavoriteItems(state) {
  /* ========================================================================
     [区域标注·本次修复1-已完成] 收藏独立页容错过滤（修复历史脏数据导致空白）
     说明：
     1. 只保留结构合法的收藏卡片对象，避免 item/messages 为空时报错导致页面空白。
     2. 不改变持久化结构，仅渲染层做防御处理，修改范围限定在收藏独立页。
     ======================================================================== */
  const data = normalizeFavoriteData(state.favoriteData);
  const keyword = String(data.searchKeyword || '').trim().toLowerCase();
  const safeItems = Array.isArray(data.items) ? data.items.filter(item => item && typeof item === 'object') : [];
  /* [已完成·HTML卡片收藏] html 固定分组：只显示 favoriteKind === 'html-card' 的收藏项 */
  let items;
  if (String(data.activeGroupId || 'all') === 'html') {
    items = safeItems.filter(item => item.favoriteKind === 'html-card');
  } else if (String(data.activeGroupId || 'all') === 'all') {
    items = safeItems.filter(item => item.favoriteKind !== 'html-card');
  } else {
    items = safeItems.filter(item => String(item.groupId || 'all') === String(data.activeGroupId || 'all') && item.favoriteKind !== 'html-card');
  }
  if (keyword) items = items.filter(item => String(item.name || '').toLowerCase().includes(keyword));
  return [...items].sort((a, b) => {
    if (data.sortMode === 'name') return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
    if (data.sortMode === 'messageTime') {
      const ta = Math.max(...(Array.isArray(a.messages) ? a.messages : []).map(message => Number(message?.timestamp || 0)), 0);
      const tb = Math.max(...(Array.isArray(b.messages) ? b.messages : []).map(message => Number(message?.timestamp || 0)), 0);
      return tb - ta;
    }
    return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
  });
}


export function getFavoriteCardTitle(messages = []) {
  if (!messages.length) return '未命名收藏';
  if (messages.length === 1) {
    const msg = messages[0];
    return String(msg.type === 'sticker' ? `[表情包] ${msg.stickerName || msg.content}` : msg.content || '单条收藏').slice(0, 24);
  }
  return `${messages.length} 条消息`;
}


/* ========================================================================
   [区域标注·已完成·闲谈大文件拆分·HTML收藏封面标题工具]
   说明：
   1. 收藏页 HTML 卡片封面第一行固定显示“角色名的卡片”。
   2. 第二行已改为优先读取卡片正文里的真实标题（data-card-title / h1-h3 / .card-title / .title / role=heading）。
   3. <title> / og:title / aria-label 只作为后备，避免旧卡片把“角色名的卡片”误当作 HTML 卡片标题。
   4. 若旧收藏数据里 cardTitle 与第一行相同，则不再重复显示，改用“HTML 卡片”兜底。
   5. 只用于收藏页运行时展示，不读写持久化存储，不使用浏览器本地同步存储接口。
   ======================================================================== */
function normalizeFavoriteHtmlCardTitleText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}


function extractFavoriteHtmlCardTitleFromHtml(cardHtml) {
  const html = String(cardHtml || '').trim();
  if (!html || typeof DOMParser !== 'function') return '';

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const metaTitle = doc.querySelector('meta[property="og:title"], meta[name="title"]')?.getAttribute('content');
    const explicitTitleEl = doc.querySelector('[data-card-title]');
    const headingEl = doc.querySelector('h1, h2, h3, [role="heading"], .card-title, .title');
    const ariaTitleEl = doc.querySelector('[aria-label]');

    const candidates = [
      explicitTitleEl?.getAttribute('data-card-title'),
      explicitTitleEl?.textContent,
      headingEl?.textContent,
      doc.querySelector('title')?.textContent,
      metaTitle,
      ariaTitleEl?.getAttribute('aria-label'),
      ariaTitleEl?.textContent
    ];

    for (const candidate of candidates) {
      const title = normalizeFavoriteHtmlCardTitleText(candidate);
      if (title) return title;
    }
  } catch (_) {
    return '';
  }

  return '';
}


function getFavoriteHtmlCardCoverSecondLine(item, roleNameText) {
  const firstLineText = normalizeFavoriteHtmlCardTitleText(`${roleNameText || 'AI'}的卡片`);
  const htmlTitle = extractFavoriteHtmlCardTitleFromHtml(item?.cardHtml);
  if (htmlTitle && htmlTitle !== firstLineText) return htmlTitle;

  const storedTitle = normalizeFavoriteHtmlCardTitleText(item?.cardTitle || item?.name);
  if (storedTitle && storedTitle !== firstLineText) return storedTitle;

  return 'HTML 卡片';
}


/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·添加消息到收藏]
   说明：保持原 profile.js 行为，持久化仍通过 persistFavoriteData / DB.js / IndexedDB。
   ========================================================================== */
export async function addMessagesToFavorites(container, state, db, messages) {
  const selected = Array.isArray(messages) ? messages.filter(Boolean) : [];
  if (!selected.length) return;
  const data = normalizeFavoriteData(state.favoriteData);
  const now = Date.now();
  const safeMessages = selected.map(message => ({
    id: String(message.id || createUid('fav_msg')),
    role: String(message.role || 'user'),
    type: String(message.type || ''),
    content: String(message.content || ''),
    stickerName: String(message.stickerName || ''),
    stickerUrl: String(message.stickerUrl || ''),
    timestamp: Number(message.timestamp || now)
  })).filter(message => String(message.content || '').trim());
  if (!safeMessages.length) return;
  const item = {
    id: createUid('favorite'),
    name: getFavoriteCardTitle(safeMessages),
    groupId: data.activeGroupId || 'all',
    subGroupId: '',
    messages: safeMessages,
    createdAt: now,
    updatedAt: now,
    sourceChatId: String(state.currentChatId || '')
  };
  state.favoriteData = { ...data, items: [...data.items, item] };
  await persistFavoriteData(state, db);
  showFavoriteSavedModal(container, safeMessages.length);
}


/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·收藏弹窗]
   说明：收藏分组、筛选、预览、删除、移动均使用应用内自定义弹窗。
   ========================================================================== */
export function showCreateFavoriteGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;
  panel.innerHTML = `
    <!-- [区域标注·已完成·收藏分组] 新建收藏大分组弹窗 -->
    <div class="chat-modal-header">
      <span>新建收藏分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search" type="text" maxlength="12" placeholder="输入分组名称" data-role="favorite-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-favorite-group" type="button">完成</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="favorite-group-name-input"]')?.focus(), 30);
}


export function showCreateFavoriteSubGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;
  panel.innerHTML = `
    <!-- [区域标注·已完成·本次需求2] 收藏再分组合并弹窗：确认后将已选收藏卡片合并成一张新卡片 -->
    <div class="chat-modal-header">
      <span>收藏再分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search" type="text" maxlength="12" placeholder="输入小分组名称" data-role="favorite-sub-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-favorite-sub-group" type="button">完成</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="favorite-sub-group-name-input"]')?.focus(), 30);
}


export function showFavoriteFilterModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;
  const modes = [
    { id: 'name', name: '名称' },
    { id: 'updatedAt', name: '修改时间' },
    { id: 'messageTime', name: '原消息时间' }
  ];
  const current = normalizeFavoriteData(state.favoriteData).sortMode;
  panel.innerHTML = `
    <!-- [区域标注·已完成·收藏筛选] 排序筛选弹窗 -->
    <div class="chat-modal-header">
      <span>筛选排序</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${modes.map(mode => `
        <button class="chat-contact-group-choice ${current === mode.id ? 'is-active' : ''}" data-action="set-favorite-sort" data-favorite-sort="${mode.id}" type="button">
          <span>${mode.name}</span>${current === mode.id ? `<i>${ICON_CHECK}</i>` : ''}
        </button>
      `).join('')}
    </div>
  `;
  mask.classList.remove('is-hidden');
}


export function showFavoritePreviewModal(container, state, itemId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const item = normalizeFavoriteData(state.favoriteData).items.find(entry => String(entry.id) === String(itemId));
  if (!mask || !panel || !item) return;

  /* ==========================================================================
     [区域标注·本次修复2-已完成] 收藏预览消息头角色名显示
     说明：
     1. 原先固定显示“AI”，在多角色收藏场景下无法区分来源角色。
     2. 现在优先根据 sourceChatId 匹配当前面具下会话名称，作为 AI 消息头展示名。
     3. 用户消息仍显示“我”；其余消息无匹配时兜底显示“AI”。
     ========================================================================== */
  const sourceSession = (state.sessions || []).find(session => String(session.id) === String(item.sourceChatId || ''));
  const sourceRoleName = String(sourceSession?.name || '').trim() || 'AI';

  panel.innerHTML = `
    <!-- [区域标注·已完成·收藏组展开] 单条/多条收藏卡片预览弹窗 -->
    <div class="chat-modal-header">
      <span>${escapeHtml(item.name || '收藏')}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${item.messages.map(message => {
        if (message.type === 'separator') {
          return `<div class="favorite-preview-message favorite-preview-message--separator">${escapeHtml(message.content || '————')}</div>`;
        }
        return `
          <div class="favorite-preview-message">
            <span class="favorite-preview-message__role">${message.role === 'user' ? '我' : escapeHtml(sourceRoleName)} · ${new Date(message.timestamp || item.createdAt).toLocaleString()}</span>
            ${escapeHtml(message.type === 'sticker' ? `[表情包] ${message.stickerName || message.content}` : message.content)}
          </div>
        `;
      }).join('')}
    </div>
  `;
  mask.classList.remove('is-hidden');
}


export function showDeleteFavoriteGroupModal(container, state, groupId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const group = normalizeFavoriteData(state.favoriteData).groups.find(item => String(item.id) === String(groupId));
  if (!mask || !panel || !group) return;
  panel.innerHTML = `
    <!-- [区域标注·已完成·收藏分组删除] 删除后内容自动移至 All -->
    <div class="chat-modal-header">
      <span>删除收藏分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body"><div class="chat-modal-hint">是否删除“${escapeHtml(group.name)}”？<br>分组内收藏会自动移动至 All。</div></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-favorite-group" data-favorite-group-id="${escapeHtml(group.id)}" type="button">删除</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}


export function showMoveFavoriteToGroupModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const groups = getFavoriteGroupsWithAll(state);
  const selectedCount = (state.selectedFavoriteIds || []).length;

  panel.innerHTML = `
    <!-- [区域标注·已完成·收藏移动弹窗] 选择目标分组弹窗 -->
    <div class="chat-modal-header">
      <span>移动到分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">将已选的 ${selectedCount} 个收藏移动到：</div>
      ${groups.map(group => `
        <button class="chat-contact-group-choice"
                data-action="confirm-move-favorite-to-group"
                data-favorite-target-group-id="${escapeHtml(group.id)}"
                type="button">
          <span>${escapeHtml(group.name)}</span>
          <i>${ICONS.chevronRight}</i>
        </button>
      `).join('')}
    </div>
  `;

  mask.classList.remove('is-hidden');
}


/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·收藏长按交互]
   说明：收藏分组长按删除、收藏卡片长按多选均集中在本模块维护。
   ========================================================================== */
export function createFavoriteGroupLongPressHandlers(state, container) {
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
    const groupId = target.dataset.favoriteGroupId || '';
    const data = normalizeFavoriteData(state.favoriteData);
    const exists = groupId && groupId !== 'all' && data.groups.some(group => group.id === groupId);
    if (!exists) return;
    target.dataset.longPressTriggered = '1';
    showDeleteFavoriteGroupModal(container, state, groupId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-favorite-group"]');
      if (!target) return;
      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-favorite-group"]')) e.preventDefault();
    }
  };
}


export function createFavoriteCardLongPressHandlers(state, container) {
  let timer = null;
  let pressedTarget = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pressedTarget = null;
  };

  const enterMultiSelect = () => {
    const target = pressedTarget;
    if (!target) return;
    const favoriteId = String(target.dataset.favoriteId || '').trim();
    if (!favoriteId) return;

    /* 阻止后续 click 事件触发预览弹窗 */
    target.dataset.longPressTriggered = '1';
    const originalAction = target.dataset.action;
    target.dataset.action = '';
    setTimeout(() => {
      delete target.dataset.longPressTriggered;
      if (target.dataset.action === '') target.dataset.action = originalAction;
    }, 300);

    state.favoriteMultiSelectMode = true;
    state.selectedFavoriteIds = [favoriteId];

    /* 重新渲染当前子页面 */
    const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
    if (msgWrap && state.subPageView === 'favorite') {
      msgWrap.innerHTML = renderFavoriteSubPage(state);
    }
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="favorite-card-select"]');
      if (!target) return;
      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(enterMultiSelect, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="favorite-card-select"]')) {
        e.preventDefault();
      }
    }
  };
}


/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·收藏独立页渲染]
   说明：收藏页面、HTML 收藏卡片、搜索栏、分组栏、多选底栏集中在本模块维护。
   ========================================================================== */
export function renderFavoriteSubPage(state) {
  const data = normalizeFavoriteData(state.favoriteData);
  const items = getVisibleFavoriteItems(state);
  const selectedSet = new Set((state.selectedFavoriteIds || []).map(String));
  const allVisibleSelected = items.length > 0 && items.every(item => selectedSet.has(String(item.id)));
  const groupTabsHtml = getFavoriteGroupsWithAll(state).map(group => `
    <!-- [区域标注·已完成·收藏大分组] 分组：${escapeHtml(group.name)} -->
    <button class="chat-tab-btn favorite-group-tab-btn ${data.activeGroupId === group.id ? 'is-active' : ''}"
            data-action="switch-favorite-group"
            data-favorite-group-id="${escapeHtml(group.id)}"
            ${group.id !== 'all' && group.id !== 'html' ? 'data-long-press-action="delete-favorite-group"' : ''}
            type="button">${escapeHtml(group.name)}</button>
  `).join('');
  /* ========================================================================
     [区域标注·已完成·本次HTML收藏封面标题/悬浮放大]
     说明：
     1. HTML 固定分组中的收藏卡片默认显示两行封面文案：
        第一行为“角色名的卡片”，第二行为 HTML 卡片正文标题。
     2. 单击封面后在收藏页面上方以悬浮层放大 HTML 卡片内容；不使用弹窗、不显示关闭按钮。
     3. 关闭由 index.js 监听“放大内容外的页面区域”完成，仍只改运行时 DOM，不写持久化。
     ======================================================================== */
  const isHtmlGroup = String(data.activeGroupId || 'all') === 'html';
  const cardsHtml = items.length ? items.map(item => {
    /* [区域标注·已完成·本次HTML收藏封面标题修正] 第一行显示角色名卡片，第二行优先显示 HTML 正文标题 */
    if (isHtmlGroup && item.favoriteKind === 'html-card') {
      const safeSrcdoc = sanitizeHtmlCardDocumentForSrcdoc(item.cardHtml || '');
      const sourceSession = (state.sessions || []).find(session => String(session.id) === String(item.sourceChatId || ''));
      const roleNameText = String(sourceSession?.name || item.sourceName || 'AI').trim() || 'AI';
      const cardTitleText = getFavoriteHtmlCardCoverSecondLine(item, roleNameText);
      const safeTitle = escapeHtml(cardTitleText);
      const safeCoverTitle = escapeHtml(`${roleNameText}的卡片`);
      /* ======================================================================
         [区域标注·已完成·收藏HTML卡片展开跳转上下文]
         说明：展开后的“跳转”按钮只读取收藏项已有来源字段，不新增持久化字段。
         ====================================================================== */
      const safeSourceChatId = escapeHtml(item.sourceChatId || '');
      const safeSourceMessageId = escapeHtml(item.sourceMessageId || '');
      return `
        <!-- [区域标注·已完成·本次HTML收藏封面标题/悬浮放大] ${safeCoverTitle} / ${safeTitle} -->
        <div class="favorite-html-card"
             data-action="toggle-favorite-html-card-zoom"
             data-favorite-id="${escapeHtml(item.id)}">
          <div class="favorite-html-card__cover">
            <div class="favorite-html-card__title">${safeCoverTitle}</div>
            <div class="favorite-html-card__hint">${safeTitle}</div>
          </div>
          <div class="favorite-html-card__zoom" data-role="favorite-html-card-zoom-panel">
            <!-- [区域标注·已完成·收藏HTML卡片展开跳转上下文] 展开态顶部跳转按钮：回到原聊天消息上下文 -->
            <div class="favorite-html-card__jump-row">
              <button class="favorite-html-card__jump-btn"
                      data-action="jump-favorite-html-card-source"
                      data-favorite-id="${escapeHtml(item.id)}"
                      data-source-chat-id="${safeSourceChatId}"
                      data-source-message-id="${safeSourceMessageId}"
                      type="button"
                      aria-label="跳转到原聊天消息上下文">
                ${ICONS.jumpToChat}
                <span>跳转</span>
              </button>
            </div>
            <iframe class="favorite-html-card__iframe"
                    sandbox="allow-scripts"
                    srcdoc="${escapeHtml(safeSrcdoc)}"
                    title="${safeTitle}"></iframe>
          </div>
        </div>
      `;
    }
    /* [区域标注·已完成] 收藏卡片渲染兜底：messages 统一安全数组，避免空白页 */
    const safeMessages = Array.isArray(item.messages) ? item.messages.filter(message => message && typeof message === 'object') : [];
    const sub = data.subGroups.find(group => String(group.id) === String(item.subGroupId));
    const preview = safeMessages.map(message => message.type === 'sticker' ? `[表情包] ${message.stickerName || message.content}` : message.content).join(' / ');
    return `
      <!-- [区域标注·已完成·收藏卡片（本次已修复空白问题）] ${escapeHtml(item.name || '未命名收藏')} -->
      <button class="favorite-card ${selectedSet.has(String(item.id)) ? 'is-selected' : ''}"
              data-action="${state.favoriteMultiSelectMode ? 'toggle-favorite-item' : 'open-favorite-preview'}"
              data-favorite-id="${escapeHtml(item.id)}"
              ${!state.favoriteMultiSelectMode ? 'data-long-press-action="favorite-card-select"' : ''}
              type="button">
        ${state.favoriteMultiSelectMode ? `<span class="favorite-card__check">${selectedSet.has(String(item.id)) ? ICON_CHECK : ''}</span>` : ''}
        <div class="favorite-card__title">${escapeHtml(item.name || '未命名收藏')}</div>
        <div class="favorite-card__meta">${safeMessages.length > 1 ? '消息组' : '单条消息'}${sub ? ` · ${escapeHtml(sub.name)}` : ''}</div>
        <div class="favorite-card__preview">${escapeHtml(preview)}</div>
      </button>
    `;
  }).join('') : `<div class="favorite-empty">当前分组暂无收藏<br>可在聊天气泡功能栏点击“收藏”添加</div>`;

  /* ==========================================================================
     [区域标注·已完成·收藏多选底栏] 收藏多选模式悬浮操作栏
     说明：长按收藏卡片进入多选模式后显示。
           包含"分组"（新建子分组）、"移动"（移至已有大分组）、"全选"、"删除"按钮。
           按钮图标统一使用 IconPark 图标。
     ========================================================================== */
  const multiBar = state.favoriteMultiSelectMode ? `
    <div class="sticker-multi-action-bar">
      <button class="sticker-multi-action-bar__btn" data-action="favorite-multi-cancel" type="button">${ICONS.closeSmall}<span>取消</span></button>
      <button class="sticker-multi-action-bar__btn" data-action="favorite-multi-group" type="button" ${selectedSet.size ? '' : 'disabled'}>${ICONS.folderPlus}<span>分组</span></button>
      <button class="sticker-multi-action-bar__btn" data-action="favorite-multi-move" type="button" ${selectedSet.size ? '' : 'disabled'}>${ICONS.transfer}<span>移动</span></button>
      <span class="sticker-multi-action-bar__count">已选 ${selectedSet.size} 个</span>
      <button class="sticker-multi-action-bar__btn" data-action="favorite-multi-select-all" type="button">${allVisibleSelected ? ICON_CHECK : ICONS.checkOne}<span>${allVisibleSelected ? '取消全选' : '全选'}</span></button>
      <button class="sticker-multi-action-bar__btn sticker-multi-action-bar__btn--danger" data-action="favorite-multi-delete" type="button" ${selectedSet.size ? '' : 'disabled'}>${ICONS.deleteIcon}<span>删除</span></button>
    </div>
  ` : '';

  return `
    <div class="chat-sub-page favorite-sub-page">
      <div class="chat-sub-page__header chat-sub-page__header--center favorite-sub-page__header">
        <button class="favorite-page-icon-btn favorite-page-search-btn" data-action="toggle-favorite-search" type="button" aria-label="搜索收藏">${TAB_ICONS.search}</button>
        <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">收藏</button>
        <button class="favorite-page-icon-btn favorite-page-filter-btn" data-action="open-favorite-filter" type="button" aria-label="筛选收藏">${TAB_ICONS.filter}</button>
      </div>
      <div class="favorite-search-row ${data.searchOpen ? '' : 'is-hidden'}">
        <input class="favorite-search-input" data-role="favorite-search-input" type="text" value="${escapeHtml(data.searchKeyword || '')}" placeholder="搜索收藏卡片名称">
      </div>
      <div class="favorite-group-tabs"><div class="favorite-group-tabs__scroller">
        ${groupTabsHtml}
        <button class="favorite-group-add-tab" data-action="create-favorite-group" type="button" aria-label="新建收藏分组">${TAB_ICONS.plus}</button>
      </div></div>
      <div class="favorite-list-scroll ${state.favoriteMultiSelectMode ? 'is-multi-selecting' : ''}">
        <div class="favorite-grid">${cardsHtml}</div>
      </div>
      ${multiBar}
    </div>
  `;
}
