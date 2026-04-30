// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message.js
 * 用途: 闲谈应用 — 聊天消息页面
 *       独立的聊天对话界面，包含消息列表、悬浮输入栏、功能占位区与聊天设置页。
 * 架构层: 应用层（闲谈子模块）
 */

import {
  TAB_ICONS,
  DATA_KEY_SESSIONS,
  DATA_KEY_MESSAGES_PREFIX,
  dbPut,
  escapeHtml,
  normalizeStickerData
} from './chat-utils.js';
import { chat } from './prompt.js';
import { getVisibleChatSessions } from './chat-list.js';

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   说明：聊天消息页面用到的所有按键图标统一使用 IconPark 风格 SVG。
/* ========================================================================== */
const MSG_ICONS = {
  back: `<svg viewBox="0 0 48 48" fill="none"><path d="M32 36L20 24l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  send: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L25 43l-5-18L2 20L43 5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 25l23-20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  magicWand: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L5 43" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M35 5l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 6l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2l2-6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 24l1.5 4l4 1.5l-4 1.5l-1.5 4l-1.5-4l-4-1.5l4-1.5l1.5-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  coffee: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 20h28v14a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V20Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 24h4a6 6 0 0 1 0 12h-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6v6M20 6v6M28 6v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·AI识图图片入口] IconPark — 图片按钮图标
     说明：用于聊天消息页咖啡功能区“图片”板块，图标来源保持 IconPark 风格。
  /* ======================================================================== */
  image: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 10h36v28H6V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 30l7-8l6 6l5-5l8 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="18" r="3" stroke="currentColor" stroke-width="3"/></svg>`,
  more: `<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>`,
  emptyChat: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`,
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3"/><path d="M16 29c2 4 14 4 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="20" r="2.5" fill="currentColor"/><circle cx="31" cy="20" r="2.5" fill="currentColor"/></svg>`,
  wallet: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 14h36v28H6V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 14V8h26v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 28h10v8H32a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  bolt: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 4L10 28h14l-4 16l18-24H24l4-16Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,

  /* ==========================================================================
     [区域标注·本次修改3] 消息气泡功能栏 IconPark 图标
     说明：单击消息气泡后显示，含修正、删除和多选；“修正”用于 AI 表情包格式补全。
  /* ========================================================================== */
  fixFormat: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 36l4 4l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 6l4 8l8 4l-8 4l-4 8l-4-8l-8-4l8-4l4-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 30l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  delete: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 11h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 11V7h10v4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 11l2 30h16l2-30" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M21 19v14M27 19v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  multiSelect: `<svg viewBox="0 0 48 48" fill="none"><path d="M20 10h20v20H20V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 18v20h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 20l4 4l7-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·气泡编辑收藏] IconPark — 编辑 / 收藏按钮图标 */
  edit: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 34v6h6L38 16l-6-6L8 34Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M29 13l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  favorite: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l5.6 11.4L42 19.2l-9 8.8l2.1 12.4L24 34.5l-11.1 5.9L15 28l-9-8.8l12.4-1.8L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  forward: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 10l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 22H20c-8 0-12 4-12 12v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  broom: `<svg viewBox="0 0 48 48" fill="none"><path d="M30 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M27 9l12 12L18 42H8v-10L27 9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M12 32l4 4M19 25l4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
/* ========================================================================== */
/* escapeHtml 已从 chat-utils.js 导入，不再本地重复定义 */

function formatMsgTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ==========================================================================
   [区域标注·本次需求3] 聊天页表情包面板数据工具
   说明：All 为固定默认分组；输入栏表情包面板与聊天设置“表情包挂载”共用。
/* ========================================================================== */
function normalizeStickerPanelData(rawData) {
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

function getStickerPanelGroups(rawData) {
  const data = normalizeStickerPanelData(rawData);
  return [{ id: 'all', name: 'All' }, ...data.groups];
}

function getVisibleStickerPanelItems(rawData, groupId = 'all') {
  const data = normalizeStickerPanelData(rawData);
  if (groupId === 'all') return data.items;
  return data.items.filter(item => item.groupId === groupId);
}

/* ==========================================================================
   [区域标注·本次需求5] 单条消息气泡渲染
   说明：
   1. 导出给 index.js 增量追加消息，避免 AI 每输出一个气泡都整页重绘造成闪屏。
   2. 同时为每条消息补充 data-message-id，供单击功能栏、删除、多选使用。
/* ========================================================================== */
export function renderMessageBubble(msg, chatSession, options = {}) {
  const session = chatSession || {};
  const name = session.name || '聊天';
  const userProfile = options.userProfile || {};
  const userAvatar = userProfile.avatar || '';
  const userName = userProfile.nickname || '我';
  const selectedMessageId = String(options.selectedMessageId || '');
  const selectedMessageIds = Array.isArray(options.selectedMessageIds) ? options.selectedMessageIds.map(String) : [];
  const multiSelectMode = Boolean(options.multiSelectMode);
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const deleteConfirmMessageId = String(options.deleteConfirmMessageId || '');
  /* ===== 闲谈：删除消息二次确认 END ===== */

  const messageId = String(msg?.id || '');
  const isUser = msg?.role === 'user';
  const isAssistant = msg?.role === 'assistant' || msg?.role === 'other';
  const isToolbarOpen = !multiSelectMode && selectedMessageId && selectedMessageId === messageId;
  const isSelected = selectedMessageIds.includes(messageId);
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const isDeleteConfirming = isToolbarOpen && deleteConfirmMessageId === messageId;
  /* ===== 闲谈：删除消息二次确认 END ===== */
  const isStickerMessage = String(msg?.type || '') === 'sticker' && String(msg?.stickerUrl || '').trim();
  /* ========================================================================
     [区域标注·已完成·AI识图图片消息渲染] 图片消息类型判断
     说明：
     1. type:image 的消息来自咖啡功能区“图片”板块。
     2. imageUrl 会随当前聊天记录写入 DB.js / IndexedDB，并在 prompt.js 中作为视觉输入发送给 AI。
     3. 不使用 localStorage/sessionStorage，也不保留双份存储兜底。
     ======================================================================== */
  const isImageMessage = String(msg?.type || '') === 'image' && String(msg?.imageUrl || '').trim();
  /* ========================================================================
     [区域标注·已完成·本次转账需求] 转账消息类型判断
     说明：
     1. type:transfer 的消息来自聊天消息页咖啡功能区“转账”板块。
     2. 金额基础值按 CNY 写入当前聊天记录；显示金额和币种跟随发起转账时的钱包显示单位。
     3. 持久化仍只走 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const isTransferMessage = String(msg?.type || '') === 'transfer';
  const bubbleInnerHtml = isStickerMessage
    ? `
        <div class="msg-sticker-bubble" title="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
          <img class="msg-sticker-bubble__image" src="${escapeHtml(msg?.stickerUrl || '')}" alt="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
        </div>
      `
    : (isImageMessage
        ? `
          <div class="msg-image-bubble" title="${escapeHtml(msg?.imageName || msg?.content || '图片')}">
            <img class="msg-image-bubble__image" src="${escapeHtml(msg?.imageUrl || '')}" alt="${escapeHtml(msg?.imageName || msg?.content || '图片')}">
          </div>
        `
        : (isTransferMessage
            ? `
              <div class="msg-transfer-bubble" title="转账">
                <div class="msg-transfer-bubble__icon">${MSG_ICONS.wallet}</div>
                <div class="msg-transfer-bubble__content">
                  <span class="msg-transfer-bubble__label">转账</span>
                  <strong class="msg-transfer-bubble__amount">${escapeHtml(msg?.transferDisplayAmount || msg?.content || '')}</strong>
                  ${String(msg?.transferNote || '').trim()
                    ? `<span class="msg-transfer-bubble__note">${escapeHtml(msg.transferNote)}</span>`
                    : `<span class="msg-transfer-bubble__note msg-transfer-bubble__note--empty">无备注</span>`}
                </div>
              </div>
            `
            : escapeHtml(msg?.content || '')));

  return `
    <!-- [区域标注·本次需求5] 可单击消息气泡：${escapeHtml(messageId)} -->
    <div class="msg-bubble-row ${isUser ? 'msg-bubble-row--right' : 'msg-bubble-row--left'} ${multiSelectMode ? 'is-multi-selecting' : ''} ${isSelected ? 'is-selected' : ''}"
         data-message-id="${escapeHtml(messageId)}"
         data-action="${multiSelectMode ? 'msg-multi-toggle' : 'msg-bubble-select'}">
      ${!isUser ? `<div class="msg-bubble__avatar">${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="">` : escapeHtml((name || '?').charAt(0).toUpperCase())}</div>` : ''}
      <div class="msg-bubble-content">
        ${isToolbarOpen ? `
          <!-- [区域标注·已完成·气泡小功能区] 单击气泡后显示：修正 / 编辑 / 收藏 / 删除 / 多选 -->
          <div class="msg-bubble-toolbar" data-role="msg-bubble-toolbar">
            ${isAssistant ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--fix-format" data-action="msg-bubble-fix-format" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.fixFormat}<span>修正</span>
              </button>
            ` : ''}
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-edit" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.edit}<span>编辑</span>
            </button>
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-favorite" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.favorite}<span>收藏</span>
            </button>
            <!-- ===== 闲谈：删除消息二次确认 START ===== -->
            <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--danger ${isDeleteConfirming ? 'is-confirming' : ''}" data-action="msg-bubble-delete" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.delete}<span>${isDeleteConfirming ? '取消' : '删除'}</span>
            </button>
            ${isDeleteConfirming ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--confirm-delete" data-action="msg-bubble-confirm-delete" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.check}<span>确认删除</span>
              </button>
            ` : ''}
            <!-- ===== 闲谈：删除消息二次确认 END ===== -->
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-multi" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.multiSelect}<span>多选</span>
            </button>
          </div>
        ` : ''}
        <div class="msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--other'} ${isAssistant && msg?.pending ? 'is-pending' : ''} ${isStickerMessage ? 'msg-bubble--sticker' : ''} ${isImageMessage ? 'msg-bubble--image' : ''} ${isTransferMessage ? 'msg-bubble--transfer' : ''}">
          ${bubbleInnerHtml}
        </div>
        <span class="msg-bubble__time">${formatMsgTime(msg?.timestamp)}</span>
      </div>
      ${isUser ? `<div class="msg-bubble__avatar msg-bubble__avatar--user">${userAvatar ? `<img src="${escapeHtml(userAvatar)}" alt="${escapeHtml(userName)}">` : `<span>${escapeHtml((userName || '我').charAt(0))}</span>`}</div>` : ''}
      ${multiSelectMode ? `
        <!-- [区域标注·本次需求5] 多选勾选圆点 -->
        <button class="msg-bubble-select-dot ${isSelected ? 'is-selected' : ''}" data-action="msg-multi-toggle" data-message-id="${escapeHtml(messageId)}" type="button" aria-label="选择消息">
          ${isSelected ? MSG_ICONS.check : ''}
        </button>
      ` : ''}
    </div>
  `;
}

/* ==========================================================================
   [区域标注] 渲染聊天消息页面 HTML
   参数：chatSession — 聊天会话对象
         messages — 消息数组 [{id, role, content, timestamp}]
         options.chatSettings — 当前聊天设置
         options.isSending — API 调用中状态
/* ========================================================================== */
export function renderChatMessage(chatSession, messages, options = {}) {
  const session = chatSession || {};
  const name = session.name || '聊天';
  const msgs = messages || [];
  const chatSettings = options.chatSettings || {};
  const isSending = Boolean(options.isSending);

  /* ==========================================================================
     [区域标注·本次需求3] 聊天页表情包面板 / AI 挂载设置
  /* ========================================================================== */
  const stickerData = normalizeStickerPanelData(options.stickerData);
  const stickerPanelGroupId = String(options.stickerPanelGroupId || 'all');
  const stickerPanelOpen = Boolean(options.stickerPanelOpen);
  const coffeeDockOpen = Boolean(options.coffeeDockOpen);
  const stickerGroups = getStickerPanelGroups(stickerData);
  const visibleStickerItems = getVisibleStickerPanelItems(stickerData, stickerPanelGroupId);
  const mountedStickerGroupIds = Array.isArray(chatSettings.mountedStickerGroupIds)
    ? chatSettings.mountedStickerGroupIds.map(String)
    : [];

  /* ========================================================================
     [区域标注·本次需求5] 消息选择状态
     说明：由 index.js 管理，只影响消息工具栏/多选栏显示。
     ======================================================================== */
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const deleteConfirmMessageId = String(options.deleteConfirmMessageId || '');
  /* ===== 闲谈：删除消息二次确认 END ===== */
  const multiSelectMode = Boolean(options.multiSelectMode);
  const selectedMessageIds = Array.isArray(options.selectedMessageIds) ? options.selectedMessageIds.map(String) : [];
  const selectedCount = selectedMessageIds.length;

  /* ==========================================================================
     [区域标注] 聊天顶部栏
  /* ========================================================================== */
  const topBarHtml = `
    <div class="msg-top-bar">
      <button class="msg-top-bar__back" data-action="msg-back" type="button">${MSG_ICONS.back}</button>
      <div class="msg-top-bar__user">
        <div class="msg-top-bar__avatar">
          ${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(name)}">` : escapeHtml((name || '?').charAt(0).toUpperCase())}
        </div>
        <div class="msg-top-bar__info">
          <span class="msg-top-bar__name">${escapeHtml(name)}</span>
          <span class="msg-top-bar__status">${isSending ? '正在回复...' : '在线'}</span>
        </div>
      </div>
      <button class="msg-top-bar__more" data-action="msg-more" type="button">${MSG_ICONS.more}</button>
    </div>
  `;

  /* ==========================================================================
     [区域标注] 消息列表区域
     说明：AI 回复中的 <think>...</think> 已在 prompt.js 里剥离，界面只展示最终回复。
  /* ========================================================================== */
  const messagesHtml = msgs.length === 0
    ? `<div class="msg-empty">${MSG_ICONS.emptyChat}<p>还没有消息<br>发送一条消息开始聊天吧</p></div>`
    : msgs.map(msg => renderMessageBubble(msg, session, options)).join('');

  /* ==========================================================================
     [区域标注·已完成·咖啡功能区图片与转账入口] 咖啡按钮升起功能区
     说明：
     1. 已保留“图片”板块，用户可通过应用内面板发送本地图片或图片 URL。
     2. 已新增“转账”板块，点击后打开应用内转账弹窗，不使用原生浏览器弹窗。
     3. 图片与转账消息都只写入 DB.js / IndexedDB，不使用浏览器同步键值存储。
  /* ========================================================================== */
  const featureDockHtml = `
    <div class="msg-feature-dock ${coffeeDockOpen ? 'is-open' : ''}" data-role="msg-feature-dock">
      <button class="msg-feature-dock__item" type="button" data-action="open-msg-image-modal" data-feature="image">
        ${MSG_ICONS.image}<span>图片</span>
      </button>
      <button class="msg-feature-dock__item" type="button" data-action="open-msg-transfer-modal" data-feature="transfer">
        ${MSG_ICONS.wallet}<span>转账</span>
      </button>
      <button class="msg-feature-dock__item" type="button" data-action="msg-feature-placeholder" data-feature="action">
        ${MSG_ICONS.bolt}<span>动作</span>
      </button>
    </div>
  `;

  /* ==========================================================================
     [区域标注·本次需求3] 输入栏表情包升起面板
     说明：圆形表情包按钮触发；顶部显示分组，可切换；一行四个排列发送到聊天界面。
  /* ========================================================================== */
  const stickerPanelHtml = `
    <div class="msg-sticker-panel ${stickerPanelOpen ? 'is-open' : ''}" data-role="msg-sticker-panel">
      <div class="msg-sticker-panel__groups">
        ${stickerGroups.map(group => `
          <button class="msg-sticker-panel__group-btn ${stickerPanelGroupId === group.id ? 'is-active' : ''}"
                  data-action="switch-msg-sticker-group"
                  data-sticker-group-id="${escapeHtml(group.id)}"
                  type="button">
            ${escapeHtml(group.name)}
          </button>
        `).join('')}
      </div>
      <div class="msg-sticker-panel__grid">
        ${visibleStickerItems.length
          ? visibleStickerItems.map(item => `
              <button class="msg-sticker-panel__item"
                      data-action="send-msg-sticker"
                      data-sticker-id="${escapeHtml(item.id)}"
                      type="button"
                      title="${escapeHtml(item.name)}">
                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
                <span>${escapeHtml(item.name)}</span>
              </button>
            `).join('')
          : `<div class="msg-sticker-panel__empty">当前分组暂无表情包</div>`}
      </div>
    </div>
  `;

  /* ==========================================================================
     [区域标注·本次需求5] 多选底部操作栏
     说明：多选模式下用户可删除选中消息或转发给聊天列表中的其他联系人。
  /* ========================================================================== */
  const multiSelectBarHtml = multiSelectMode ? `
    <div class="msg-multi-action-bar" data-role="msg-multi-action-bar">
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-cancel" type="button">${MSG_ICONS.close}<span>取消</span></button>
      <span class="msg-multi-action-bar__count">已选 ${selectedCount} 条</span>
      <!-- [区域标注·已完成·收藏多选底栏] 聊天消息多选后可收藏单条或多条为消息组 -->
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-favorite-selected" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.favorite}<span>收藏</span></button>
      <button class="msg-multi-action-bar__btn msg-multi-action-bar__btn--danger" data-action="msg-multi-delete-selected" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.delete}<span>删除</span></button>
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-forward" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.forward}<span>转发</span></button>
    </div>
  ` : '';

  /* ========================================================================
     [区域标注·本次需求1] 多选模式聊天会话显式状态类
     说明：
     1. 进入多选后直接停止渲染底部输入栏，不再依赖 CSS :has() 才隐藏输入栏。
     2. 通过显式类名控制底部留白与层级，修复首次进入多选时底栏不显示的问题。
     ======================================================================== */
  const conversationClassName = multiSelectMode ? 'msg-conversation is-multi-select-mode' : 'msg-conversation';
  const listAreaClassName = multiSelectMode ? 'msg-list-area is-multi-select-mode' : 'msg-list-area';

  /* ==========================================================================
     [区域标注] 悬浮底部输入栏
     说明：四周圆角矩形；左侧咖啡按钮；输入框回车发送；右侧魔法棒与纸飞机。
  /* ========================================================================== */
  const inputBarHtml = `
    <div class="msg-input-shell">
      ${featureDockHtml}
      ${stickerPanelHtml}
      <div class="msg-input-bar">
        <button class="msg-input-bar__icon-btn" data-action="msg-coffee" type="button">${MSG_ICONS.coffee}</button>
        <button class="msg-input-bar__icon-btn ${stickerPanelOpen ? 'is-active' : ''}" data-action="msg-sticker" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.sticker}</button>
        <input type="text" class="msg-input-bar__input" placeholder="输入消息..." data-role="msg-input" ${isSending ? 'disabled' : ''}>
        <button class="msg-input-bar__icon-btn" data-action="msg-magic" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.magicWand}</button>
        <button class="msg-input-bar__icon-btn msg-input-bar__send-btn" data-action="msg-send" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.send}</button>
      </div>
    </div>
  `;

  /* ==========================================================================
     [区域标注] 独立聊天设置页面
     说明：三点按钮进入；所有设置由 index.js 写入 DB.js / IndexedDB。
  /* ========================================================================== */
  const settingsPageHtml = `
    <div class="msg-settings-page" data-role="msg-settings-page" style="display:none;">
      <div class="msg-settings-header">
        <button class="msg-settings-header__back" data-action="msg-settings-back" type="button">${MSG_ICONS.back}</button>
        <div class="msg-settings-header__title">聊天设置</div>
      </div>
      <div class="msg-settings-body">
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">当前指令</div>
          <textarea class="msg-settings-textarea" data-role="msg-current-command" placeholder="输入仅对下一次/当前状态生效的临时指令">${escapeHtml(chatSettings.currentCommand || '')}</textarea>
        </section>
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">外部应用消息注入</div>
              <div class="msg-settings-card__desc">开启后会在提示词中注入外部应用上下文。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.externalContextEnabled ? 'is-on' : ''}" data-action="toggle-external-context" type="button" aria-label="外部应用消息注入"></button>
          </div>
        </section>

        <!-- ===== 闲谈应用：时间感知设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">时间感知</div>
              <div class="msg-settings-card__desc">开启后会向 AI 注入当前真实时间，并让角色按早中晚深夜自然聊天。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.timeAwarenessEnabled ? 'is-on' : ''}" data-action="toggle-time-awareness" type="button" aria-label="时间感知"></button>
          </div>
        </section>
        <!-- ===== 闲谈应用：时间感知设置 END ===== -->
        <!-- ==================================================================
             [区域标注·已同步静默审查] 自定义思维链设置
             说明：
             1. 本区域已同步 prompt.js 的默认静默审查方案。
             2. 自定义内容应要求 AI 后台自检，禁止显式输出 <think>...</think>。
             3. 这里只修改设置提示文案，不改 IndexedDB 持久化逻辑。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">自定义思维链</div>
          <div class="msg-settings-card__desc">留空时使用默认静默审查协议；自定义内容也应要求 AI 后台自检，最终回复禁止输出 think 标签、审查过程或幕后说明。</div>
          <textarea class="msg-settings-textarea" data-role="msg-custom-thinking" placeholder="【静默审查】输出前先在后台核对角色卡事实、已知细节、情感事实和消息格式；最终只输出符合通用消息协议的可见回复，禁止输出 <think>、审查步骤或幕后说明。">${escapeHtml(chatSettings.customThinkingInstruction || '')}</textarea>
        </section>

        <!-- ==================================================================
             [区域标注·本次需求3] AI 表情包挂载设置
             说明：只显示分组名称；支持多选；不同用户面具只决定 AI 挂载哪些分组。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">表情包挂载</div>
          <div class="msg-settings-card__desc">选择要挂载给 AI 使用的表情包分组。AI 只能从已挂载分组里选择符合当前聊天情景的表情包发送。</div>
          <div class="msg-settings-sticker-groups">
            ${stickerGroups.length
              ? stickerGroups.map(group => `
                  <button class="msg-settings-sticker-group-btn ${mountedStickerGroupIds.includes(group.id) ? 'is-active' : ''}"
                          data-action="toggle-mounted-sticker-group"
                          data-sticker-group-id="${escapeHtml(group.id)}"
                          type="button">
                    ${escapeHtml(group.name)}
                  </button>
                `).join('')
              : `<div class="msg-settings-sticker-empty">暂无可挂载的表情包分组</div>`}
          </div>
        </section>

        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">每轮回复气泡数量</div>
          <div class="msg-settings-card__desc">控制 AI 每一轮回复必须拆成多少个消息气泡；除非用户当轮明确允许突破，否则 AI 必须严格遵守。</div>
          <div class="msg-settings-number-grid">
            <label class="msg-settings-number-field">
              <span>最低</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-min" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMin || 1)}">
            </label>
            <label class="msg-settings-number-field">
              <span>最高</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-max" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMax || 3)}">
            </label>
          </div>
        </section>
        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== -->

        <!-- ===== 闲谈应用：短期记忆设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">短期记忆</div>
          <div class="msg-settings-card__desc">控制下次请求 AI 时携带之前多少轮对话上文；0 表示不携带历史上文。</div>
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>发送之前轮数</span>
            <input class="msg-settings-number-input" data-role="msg-short-term-memory-rounds" type="number" min="0" step="1" value="${escapeHtml(chatSettings.shortTermMemoryRounds ?? 8)}">
          </label>
        </section>
        <!-- ===== 闲谈应用：短期记忆设置 END ===== -->

        <!-- ==========================================================================
             [区域标注·本次需求4] 清空全部聊天记录入口
             说明：点击后由 index.js 打开应用内确认弹窗；不使用原生浏览器弹窗。
             ========================================================================== -->
        <section class="msg-settings-card msg-settings-danger-card">
          <button class="msg-settings-danger-action" data-action="open-clear-all-messages-modal" type="button">
            <span class="msg-settings-danger-action__icon">${MSG_ICONS.broom}</span>
            <span class="msg-settings-danger-action__text">
              <strong>清空全部聊天记录</strong>
              <em>仅清空当前聊天界面的消息记录</em>
            </span>
          </button>
        </section>
      </div>
    </div>
  `;

  return `
    <div class="msg-page">
      <div class="${conversationClassName}" data-role="msg-conversation">
        ${topBarHtml}
        <div class="${listAreaClassName}" data-role="msg-list">${messagesHtml}</div>
        ${multiSelectBarHtml}
        ${multiSelectMode ? '' : inputBarHtml}
      </div>
      ${settingsPageHtml}
    </div>
  `;
}

/* ========================================================================== */
export function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}


export function getAiBubbleDelayMs(bubbleText, index) {
  const length = String(bubbleText || '').length;
  return Math.min(1300, Math.max(420, 260 + length * 24 + index * 80));
}

/* ========================================================================== */
export async function sendMessage(container, state, db, content, settingsManager, options = {}) {
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
  /* ========================================================================== */
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
      /* [区域标注·已完成·AI识图当前轮媒体] 把本轮用户图片/表情包消息原始字段传给 prompt.js 组装视觉输入。 */
      currentUserRoundMessages: promptPayload.currentUserRoundMessages,
      chatSettings: state.chatPromptSettings,
      /* [区域标注·已修改] 时间感知请求上下文：把最新用户消息时间与最近聊天时间传给 prompt.js，避免 AI 时间停在旧消息发送时 */
      conversationTimeContext: promptPayload.conversationTimeContext,
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
      const visibleText = String(
        message.type === 'sticker'
          ? message.stickerName || message.content || '表情包'
          : (message.type === 'transfer'
              ? message.transferDisplayAmount || message.content || '转账'
              : message.content || '')
      ).trim();
      if (index > 0) await sleep(getAiBubbleDelayMs(visibleText, index));
      state.currentMessages.push(message);
      hasRenderedAiBubble = true;
      session.lastMessage = message.type === 'sticker'
        ? `[表情包] ${message.stickerName || '未命名表情包'}`
        : (message.type === 'transfer'
            ? `[转账] ${message.transferDisplayAmount || message.content || '¥0.00'}`
            : (message.content || '（AI 没有返回内容）'));
      session.lastTime = Date.now();
      await persistCurrentMessages(state, db);
      await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
      appendCurrentMessageBubble(container, state, state.currentMessages[state.currentMessages.length - 1]);
    }

    session.lastMessage = aiMessages[aiMessages.length - 1]?.type === 'sticker'
      ? `[表情包] ${aiMessages[aiMessages.length - 1]?.stickerName || '未命名表情包'}`
      : (aiMessages[aiMessages.length - 1]?.type === 'transfer'
          ? `[转账] ${aiMessages[aiMessages.length - 1]?.transferDisplayAmount || aiMessages[aiMessages.length - 1]?.content || '¥0.00'}`
          : (aiMessages[aiMessages.length - 1]?.content || '（AI 没有返回内容）'));
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

/* ========================================================================== */
export async function persistCurrentMessages(state, db) {
  if (!state.currentChatId) return;
  await dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + state.currentChatId, state.currentMessages);
}

/* ========================================================================== */
export function getMountedStickerItems(state) {
  const data = normalizeStickerData(state.stickerData);
  const mountedGroupIds = Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
    ? Array.from(new Set(state.chatPromptSettings.mountedStickerGroupIds.map(String).filter(Boolean)))
    : [];
  if (!mountedGroupIds.length) return [];
  if (mountedGroupIds.includes('all')) return data.items;
  return data.items.filter(item => mountedGroupIds.includes(String(item.groupId || 'all')));
}


export function getStickerProtocolCandidates(token) {
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


export function resolveStickerProtocolTarget(token, state) {
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

/* ========================================================================== */
export function normalizeStickerLooseMatchText(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[`*_#"“”"'《》（）()\[\]【】{}]/g, '')
    .replace(/(?:资源\s*ID|资源Id|表情名|名称|表情包|表情|贴纸|sticker|发送|发个|发一张|来个|给你|我发|刚才|点错了|没发出去|这回|看清楚|看看|吧|啊|呀|呢|了)/gi, '')
    .replace(/[：:；;，,。.!！？?\s-]+/g, '')
    .toLowerCase()
    .trim();
}


export function findLooseStickerTargetFromText(text, state) {
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


export function createStickerMessagePatchFromTarget(message, sticker) {
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


export function repairAiMessageFormatIfPossible(message, state) {
  if (!message || message.role !== 'assistant') return null;
  if (String(message.type || '') === 'sticker' && String(message.stickerUrl || '').trim()) return null;

  const sticker = findLooseStickerTargetFromText(message.content, state);
  return sticker ? createStickerMessagePatchFromTarget(message, sticker) : null;
}


export function cleanAiProtocolBlockContent(content) {
  return String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
}

/* ==========================================================================
   [区域标注·已完成·角色主动转账协议解析] AI 转账协议内容解析
   说明：
   1. 只解析 `[转账] 角色名：{金额:xxx,备注:xxx}` 对应的大括号内容。
   2. 解析成功后统一生成 type:transfer 结构化消息，持久化仍只走 DB.js / IndexedDB。
   3. 不新增任何本地同步存储，也不改用户手动转账入口逻辑。
   ========================================================================== */
export function parseAiTransferProtocolPayload(content) {
  const normalized = cleanAiProtocolBlockContent(content);
  if (!normalized) return null;

  const bodyMatch = normalized.match(/\{\s*([\s\S]*?)\s*\}/);
  const body = bodyMatch ? String(bodyMatch[1] || '').trim() : normalized;
  if (!body) return null;

  const amountMatch = body.match(/金额\s*[：:]\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const noteMatch = body.match(/备注\s*[：:]\s*([^}]*)/i);
  const transferNote = String(noteMatch?.[1] || '').trim();

  return {
    transferAmount: Number(amount.toFixed(2)),
    transferBaseCny: Number(amount.toFixed(2)),
    transferCurrency: 'CNY',
    transferDisplayAmount: `¥${amount.toFixed(2)}`,
    transferNote,
    content: `¥${amount.toFixed(2)}`
  };
}


export function extractAiProtocolBlocks(rawText) {
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  /* ========================================================================
     [区域标注·已完成·角色主动转账协议解析器] AI 回复通用协议强力解析器
     说明：
     1. 优先寻找任意位置的 [回复]/[表情]/[转账] 协议头，而不是要求整行完全规范。
     2. 兼容漏加 **、漏加反引号、多个协议连写、协议前后夹杂 Markdown 的情况。
     3. 提取后统一转成内部消息对象，聊天界面绝不直接显示原始协议文本。
     ======================================================================== */
  const markerRegex = /(?:\*\*)?\s*`?\s*\[(回复|表情|转账)\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
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


export function buildAiReplyMessages(rawText, state) {
  const protocolBlocks = extractAiProtocolBlocks(rawText);
  if (!protocolBlocks.length) {
    const repairedSticker = findLooseStickerTargetFromText(rawText, state);
    if (repairedSticker) {
      return enforceAiReplyMessageCount([{
        role: 'assistant',
        type: 'sticker',
        content: `[表情包] ${repairedSticker.name}`,
        stickerId: repairedSticker.id,
        stickerName: repairedSticker.name,
        stickerUrl: repairedSticker.url
      }], state.chatPromptSettings);
    }

    return enforceAiReplyMessageCount(
      splitAiReplyIntoBubbles(rawText, state.chatPromptSettings).map(content => ({
        role: 'assistant',
        content
      })),
      state.chatPromptSettings
    );
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

    if (block.type === '转账') {
      const transferPayload = parseAiTransferProtocolPayload(block.content);
      if (transferPayload) {
        builtMessages.push({
          role: 'assistant',
          type: 'transfer',
          ...transferPayload
        });
      }
      /* [区域标注·已完成·角色主动转账协议容错] 转账协议格式不合法时直接丢弃，避免残缺协议原样露出 */
      return;
    }

    splitStrictSentenceBubbles(cleanAiVisibleBubbleText(block.content)).forEach(content => {
      builtMessages.push({
        role: 'assistant',
        content
      });
    });
  });

  return enforceAiReplyMessageCount(
    builtMessages.length
      ? builtMessages
      : [{ role: 'assistant', content: '（AI 没有返回内容）' }],
    state.chatPromptSettings
  );
}


/* ==========================================================================
   [区域标注·已完成·AI识图图片消息发送] 图片消息入列与持久化
   说明：
   1. 图片来源仅来自聊天消息页咖啡功能区“图片”板块：本地 data URL 或用户输入 URL。
   2. 消息对象使用 type:image / imageUrl / imageName / imageSource，随 currentMessages 写入 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
export async function sendImageMessage(container, state, db, imageUrl, settingsManager, options = {}) {
  if (!state.currentChatId || state.isAiSending) return;

  const safeUrl = String(imageUrl || '').trim();
  if (!safeUrl) return;

  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const imageName = String(options.imageName || '').trim() || (safeUrl.startsWith('data:image/') ? '本地图片' : '图片链接');
  const imageMessage = {
    id: `user_image_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'image',
    content: `[图片] ${imageName}`,
    imageUrl: safeUrl,
    imageName,
    imageSource: safeUrl.startsWith('data:image/') ? 'local' : 'url',
    timestamp: Date.now()
  };

  state.currentMessages.push(imageMessage);
  state.stickerPanelOpen = false;
  state.coffeeDockOpen = false;
  session.lastMessage = `[图片] ${imageName}`;
  session.lastTime = Date.now();

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  renderCurrentChatMessage(container, state);

  if (options.triggerAi === true) {
    await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  }
}


export async function sendStickerMessage(container, state, db, stickerId, settingsManager, options = {}) {
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

/* ========================================================================== */
export function renderCurrentChatMessage(container, state, options = {}) {
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

/* ========================================================================== */
export function appendCurrentMessageBubble(container, state, message) {
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

/* ========================================================================== */
export function refreshMessageBubbleRows(container, state, messageIds = []) {
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


export function refreshCurrentMessageListOnly(container, state) {
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


export function updateMultiSelectActionBar(container, state) {
  const bar = container.querySelector('[data-role="msg-multi-action-bar"]');
  if (!bar) return;
  const count = (state.selectedMessageIds || []).length;
  const countEl = bar.querySelector('.msg-multi-action-bar__count');
  if (countEl) countEl.textContent = `已选 ${count} 条`;
  bar.querySelectorAll('[data-action="msg-multi-favorite-selected"], [data-action="msg-multi-delete-selected"], [data-action="msg-multi-forward"]').forEach(btn => {
    btn.toggleAttribute('disabled', count <= 0);
  });
}

/* ========================================================================== */
export function resetMessageSelectionState(state) {
  state.selectedMessageId = '';
  state.multiSelectMode = false;
  state.selectedMessageIds = [];
  /* ===== 闲谈：删除消息二次确认 START ===== */
  state.deleteConfirmMessageId = '';
  /* ===== 闲谈：删除消息二次确认 END ===== */
}


export function getSelectedMessages(state) {
  const selectedSet = new Set((state.selectedMessageIds || []).map(String));
  return (state.currentMessages || []).filter(message => selectedSet.has(String(message.id)));
}


export function refreshCurrentSessionLastMessage(state) {
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const latest = [...(state.currentMessages || [])].reverse().find(item => String(item?.content || '').trim());
  session.lastMessage = latest?.type === 'sticker'
    ? `[表情包] ${latest?.stickerName || '未命名表情包'}`
    : (latest?.type === 'image'
        ? `[图片] ${latest?.imageName || '图片'}`
        : (latest?.type === 'transfer'
            ? `[转账] ${latest?.transferDisplayAmount || latest?.content || '¥0.00'}`
            : (latest?.content || '')));
  session.lastTime = latest?.timestamp || Date.now();
}

/* ========================================================================== */
export async function retryLatestAiReply(container, state, db, settingsManager) {
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
     [区域标注·已完成·魔法棒局部刷新防闪屏] 魔法棒重 roll 立即清空旧 AI 回复
     说明：
     1. 先删除最新一轮 AI 回复并立即写入 DB.js / IndexedDB。
     2. 只刷新消息列表区域，不重建整个聊天消息页壳子，避免点击魔法棒闪屏。
     3. 再调用 API 重新生成最新一轮回复，不保留旧 AI 气泡到返回列表后才消失。
     ======================================================================== */
  refreshCurrentSessionLastMessage(state);
  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);
  refreshCurrentMessageListOnly(container, state);
  await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  /* ===== 闲谈：用户最新一轮消息触发AI END ===== */
}


/* ===== 闲谈：用户最新一轮消息触发AI START ===== */
export function buildPromptPayloadForLatestUserRound(messages = [], shortTermMemoryRounds = 8) {
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
  const latestUserMessage = [...currentRoundMessages].reverse().find(item => Number(item?.timestamp || 0) > 0)
    || [...normalized].reverse().find(item => item.role === 'user' && Number(item?.timestamp || 0) > 0)
    || null;
  const latestAnyMessage = [...normalized].reverse().find(item => Number(item?.timestamp || 0) > 0) || null;
  const userInput = currentRoundMessages.map((item, index) => {
    const content = String(item.content || '').trim();
    return currentRoundMessages.length > 1 ? `第${index + 1}条：${content}` : content;
  }).join('\n');

  const roundLimit = Math.max(0, Math.floor(Number(shortTermMemoryRounds)) || 0);
  const previous = latestUserStart >= 0 ? normalized.slice(0, latestUserStart) : normalized;
  /* [区域标注·已修改] 强化时间感知：即使短期记忆轮数为 0，也继续把必要时间戳随本次 API 请求传给 prompt.js，不额外持久化。 */
  const conversationTimeContext = {
    latestUserTimestamp: Number(latestUserMessage?.timestamp || 0) || 0,
    latestAnyTimestamp: Number(latestAnyMessage?.timestamp || 0) || 0
  };
  const currentUserRoundMessages = currentRoundMessages.map(item => ({
    role: item.role,
    content: item.content,
    type: item.type || '',
    stickerUrl: item.stickerUrl || '',
    stickerName: item.stickerName || '',
    imageUrl: item.imageUrl || '',
    imageName: item.imageName || '',
    timestamp: Number(item.timestamp || 0) || 0
  }));

  if (roundLimit <= 0) {
    return {
      userInput,
      history: [],
      currentUserRoundMessages,
      conversationTimeContext
    };
  }

  const rounds = [];
  let current = [];
  previous.forEach(item => {
    if (item.role === 'user' && current.length) {
      rounds.push(current);
      current = [];
    }
    current.push({
      role: item.role,
      content: item.content,
      type: item.type || '',
      stickerUrl: item.stickerUrl || '',
      stickerName: item.stickerName || '',
      imageUrl: item.imageUrl || '',
      imageName: item.imageName || '',
      /* [区域标注·已修改] 历史消息保留发送时间，供时间感知把“昨天/明天/后天”等相对时间锚定到原消息时间。 */
      timestamp: Number(item.timestamp || 0) || 0
    });
  });
  if (current.length) rounds.push(current);

  return {
    userInput,
    history: rounds.slice(-roundLimit).flat(),
    currentUserRoundMessages,
    conversationTimeContext
  };
}


export function splitAiReplyIntoBubbles(text, chatSettings = {}) {
  const raw = sanitizeAiVisibleReply(text);
  if (!raw) return ['（AI 没有返回内容）'];

  const { min, max } = getReplyBubbleCountRange(chatSettings);

  /* ==========================================================================
     [区域标注·已完成·本次需求2] 严格拆分通用消息协议与问号气泡
     说明：
     1. 只识别 prompt.js 的 **`[回复] 角色名：文字消息内容`** 通用协议。
     2. 无论 AI 是否按格式输出，只要同一段里出现多个问句/感叹句/句号句，就强制拆开。
     3. 同时叠加最少/最多气泡数收口，避免设置页规则只停留在 prompt 层。
  /* ========================================================================== */
  const protocolReplyMatches = extractProtocolReplyContents(raw);

  let parts = protocolReplyMatches.length
    ? protocolReplyMatches
    : raw
        .split(/\n{2,}|(?:\s*<bubble>\s*)|(?:\s*<\/bubble>\s*)|(?:\s*\|\|\|\s*)|(?:\s*---气泡---\s*)/i)
        .map(item => item.trim())
        .filter(Boolean);

  parts = parts
    .map(part => cleanAiVisibleBubbleText(part))
    .filter(Boolean)
    .flatMap(part => splitStrictSentenceBubbles(part));

  if (parts.length <= 1 && raw.length > 28) {
    parts = raw
      .split(/(?<=[，,、；;])\s*/)
      .map(item => cleanAiVisibleBubbleText(item))
      .filter(Boolean);
  }

  while (parts.length < min) {
    let bestIndex = -1;
    let bestParts = [];
    let bestLength = 0;

    parts.forEach((item, index) => {
      const candidateParts = splitSingleBubbleForCount(item);
      if (candidateParts.length <= 1) return;
      if (String(item || '').length > bestLength) {
        bestIndex = index;
        bestParts = candidateParts;
        bestLength = String(item || '').length;
      }
    });

    if (bestIndex < 0 || bestParts.length <= 1) break;
    parts.splice(bestIndex, 1, ...bestParts);
  }

  const cleaned = parts.map(item => cleanAiVisibleBubbleText(item)).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, max) : ['（AI 没有返回内容）'];
}

/* ========================================================================== */
export function sanitizeAiVisibleReply(text) {
  let value = cleanAiVisibleBubbleText(text);

  /* ===== 闲谈：通用消息协议解析 START ===== */
  const protocolReplyMatches = extractProtocolReplyContents(value);
  if (protocolReplyMatches.length) {
    value = protocolReplyMatches
      .map(item => cleanAiVisibleBubbleText(item))
      .filter(Boolean)
      .join('\n');
  }
  /* ===== 闲谈：通用消息协议解析 END ===== */

  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}


export function splitStrictSentenceBubbles(text) {
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

/* ===== 闲谈：用户最新一轮消息触发AI END ===== */

/* ===== 闲谈应用：AI回复拆分为多个气泡 START ===== */
/* ===== 闲谈：通用消息协议解析 START ===== */
export function extractProtocolReplyContents(text) {
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

export function getReplyBubbleCountRange(chatSettings = {}) {
  const min = Math.max(1, Math.floor(Number(chatSettings.replyBubbleMin || 1)) || 1);
  const max = Math.max(min, Math.floor(Number(chatSettings.replyBubbleMax || min)) || min);
  return { min, max };
}

/* ========================================================================== */
export function cleanAiVisibleBubbleText(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/\[\s*消息发送时间\s*[：:][\s\S]*?\]/gi, ' ')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^(思考回复内容|思考内容|检查规则|审查规则|拟定句子|检查结果|最终输出|回复格式|本轮 API 实际请求时间|最近一条已记录的用户消息发送时间|最近一条聊天记录时间|从最近一条用户消息到本轮实际请求已经过去|距上次聊天记录已经过去)\s*[：:]/.test(line))
    .map(line => line.replace(/^(?:第\s*\d+\s*条|气泡\s*\d+|[0-9]+[.)、])\s*/i, '').trim())
    .filter(line => !/^\d{4}年\d{1,2}月\d{1,2}日(?:星期[一二三四五六日天])?\s+\d{1,2}:\d{2}(?::\d{2})?\]$/.test(line))
    .filter(Boolean)
    .join('\n')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
}


export function splitSingleBubbleForCount(text) {
  const value = cleanAiVisibleBubbleText(text);
  if (!value) return [];

  const sentenceParts = splitStrictSentenceBubbles(value);
  if (sentenceParts.length > 1) return sentenceParts;

  const commaParts = value
    .split(/(?<=[，,、；;])\s*/)
    .map(item => item.trim())
    .filter(Boolean);
  if (commaParts.length > 1) return commaParts;

  const spaceParts = value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);
  if (spaceParts.length > 1) return spaceParts;

  if (value.length <= 1) return [value];

  const splitAt = Math.max(1, Math.ceil(value.length / 2));
  return [
    value.slice(0, splitAt).trim(),
    value.slice(splitAt).trim()
  ].filter(Boolean);
}


export function enforceAiReplyMessageCount(messages, chatSettings = {}) {
  const { min, max } = getReplyBubbleCountRange(chatSettings);
  let normalizedMessages = Array.isArray(messages)
    ? messages
        .map(message => {
          if (!message || message.role !== 'assistant') return null;
          if (String(message.type || '') === 'sticker' && String(message.stickerUrl || '').trim()) {
            return message;
          }
          if (String(message.type || '') === 'transfer') {
            return message;
          }
          const content = cleanAiVisibleBubbleText(message.content);
          return content ? { ...message, content } : null;
        })
        .filter(Boolean)
    : [];

  while (normalizedMessages.length < min) {
    let bestIndex = -1;
    let bestParts = [];
    let bestLength = 0;

    normalizedMessages.forEach((message, index) => {
      if (String(message.type || '') === 'sticker') return;
      const parts = splitSingleBubbleForCount(message.content);
      if (parts.length <= 1) return;
      const currentLength = String(message.content || '').length;
      if (currentLength > bestLength) {
        bestIndex = index;
        bestParts = parts;
        bestLength = currentLength;
      }
    });

    if (bestIndex < 0 || bestParts.length <= 1) break;

    const baseMessage = normalizedMessages[bestIndex];
    normalizedMessages.splice(
      bestIndex,
      1,
      ...bestParts.map(content => ({
        ...baseMessage,
        content
      }))
    );
  }

  if (normalizedMessages.length > max) {
    normalizedMessages = normalizedMessages.slice(0, max);
  }

  return normalizedMessages.length
    ? normalizedMessages
    : [{ role: 'assistant', content: '（AI 没有返回内容）' }];
}

/* ========================================================================== */
export function updateCurrentChatSendingUi(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (!msgWrap) return;

  const statusEl = msgWrap.querySelector('.msg-top-bar__status');
  if (statusEl) statusEl.textContent = state.isAiSending ? '正在回复...' : '在线';

  msgWrap.querySelectorAll('[data-role="msg-input"], [data-action="msg-magic"], [data-action="msg-send"]').forEach(el => {
    el.toggleAttribute('disabled', Boolean(state.isAiSending));
  });
}

/* ========================================================================== */
export function syncMessageDockOpenState(container, state) {
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


export function renderMsgStickerPanelGrid(container, state) {
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

/* ========================================================================== */
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

/* ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·AI识图图片弹窗] 图片发送应用内弹窗
   说明：
   1. 替代原生浏览器弹窗，保持闲谈应用统一暖色主题。
   2. 用户可选择本地图片，也可输入图片 URL；确认 URL 后由 index.js 写入当前聊天消息。
   3. 本地图片读取为 data URL 后直接写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function showMessageImageModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>发送图片</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">选择本地图片，或粘贴图片 URL。发送后会在聊天界面显示为图片，AI 也能看到这张图。</div>
      <input class="msg-image-file-input" data-role="msg-image-file-input" type="file" accept="image/*">
      <input class="chat-modal-search" data-role="msg-image-url-input" type="url" placeholder="https://example.com/image.png">
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-send-image-url" type="button">发送链接图片</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-image-url-input"]')?.focus(), 30);
}


/* ==========================================================================
   [区域标注·已完成·本次转账需求] 聊天消息页转账应用内弹窗
   说明：
   1. 弹窗结构与闲谈应用现有 chat-modal 风格保持一致，不使用原生浏览器弹窗。
   2. 余额文案由 index.js 根据当前钱包余额与显示币种实时计算后传入。
   3. 这里只负责渲染转账弹窗，不做 localStorage/sessionStorage 读写，也不做双份存储兜底。
   ========================================================================== */
export function showMessageTransferModal(container, options = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const balanceLabel = String(options.balanceLabel || '').trim() || '¥0.00';
  const currencyCode = String(options.currencyCode || 'CNY').trim().toUpperCase();

  panel.innerHTML = `
    <!-- [区域标注·已完成·本次转账需求] 聊天消息页转账弹窗 -->
    <div class="chat-modal-header">
      <span>转账</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-transfer-modal-body">
      <label class="msg-transfer-modal-field">
        <span class="msg-transfer-modal-field__label">金额</span>
        <input class="chat-modal-search msg-transfer-modal-field__input"
               data-role="msg-transfer-amount-input"
               type="number"
               min="0.01"
               step="0.01"
               placeholder="输入转账金额">
      </label>
      <div class="msg-transfer-modal-balance">
        <span class="msg-transfer-modal-balance__label">钱包余额</span>
        <strong class="msg-transfer-modal-balance__amount">${escapeHtml(balanceLabel)}</strong>
        <span class="msg-transfer-modal-balance__currency">${escapeHtml(currencyCode)}</span>
      </div>
      <label class="msg-transfer-modal-field">
        <span class="msg-transfer-modal-field__label">备注</span>
        <input class="chat-modal-search msg-transfer-modal-field__input"
               data-role="msg-transfer-note-input"
               type="text"
               maxlength="60"
               placeholder="输入想要留言的话">
      </label>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-msg-transfer" type="button">确认转账</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-transfer-amount-input"]')?.focus(), 30);
}

export function showClearAllMessagesModal(container, state) {
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

/* ========================================================================== */
export function showAiFormatRepairResultModal(container, { success = false, title = '', message = '' } = {}) {
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

/* ========================================================================== */
export function showEditMessageModal(container, state, messageId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const message = (state.currentMessages || []).find(item => String(item.id) === String(messageId));
  if (!mask || !panel || !message) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·气泡编辑弹窗] 编辑聊天气泡文字，不使用原生弹窗 -->
    <div class="chat-modal-header">
      <span>编辑消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <textarea class="chat-modal-search" data-role="edit-message-content-input" maxlength="2000" style="min-height:108px;resize:none;">${escapeHtml(message.content || '')}</textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-edit-message" data-message-id="${escapeHtml(messageId)}" type="button">保存</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="edit-message-content-input"]')?.focus(), 30);
}

/* ========================================================================== */
export function showFavoriteSavedModal(container, count) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>收藏完成</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body"><div class="chat-modal-hint">已收藏 ${Number(count || 0)} 条消息，可在用户主页“收藏”折叠栏中查看。</div></div>
    <div class="chat-modal-footer"><button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button></div>
  `;
  mask.classList.remove('is-hidden');
}

/* ========================================================================== */
export function showForwardMessagesModal(container, state) {
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
