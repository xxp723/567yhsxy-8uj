/**
 * 文件名: js/apps/chat/chat-message.js
 * 用途: 闲谈应用 — 聊天消息页面
 *       独立的聊天对话界面，包含消息列表、悬浮输入栏、功能占位区与聊天设置页。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   说明：聊天消息页面用到的所有按键图标统一使用 IconPark 风格 SVG。
   ========================================================================== */
const MSG_ICONS = {
  back: `<svg viewBox="0 0 48 48" fill="none"><path d="M32 36L20 24l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  send: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L25 43l-5-18L2 20L43 5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 25l23-20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  magicWand: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L5 43" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M35 5l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 6l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2l2-6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 24l1.5 4l4 1.5l-4 1.5l-1.5 4l-1.5-4l-4-1.5l4-1.5l1.5-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  coffee: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 20h28v14a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V20Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 24h4a6 6 0 0 1 0 12h-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6v6M20 6v6M28 6v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  more: `<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>`,
  emptyChat: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`,
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3"/><path d="M16 29c2 4 14 4 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="20" r="2.5" fill="currentColor"/><circle cx="31" cy="20" r="2.5" fill="currentColor"/></svg>`,
  wallet: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 14h36v28H6V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 14V8h26v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 28h10v8H32a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  bolt: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 4L10 28h14l-4 16l18-24H24l4-16Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,

  /* ==========================================================================
     [区域标注·本次修改3] 消息气泡功能栏 IconPark 图标
     说明：单击消息气泡后显示，含修正、删除和多选；“修正”用于 AI 表情包格式补全。
     ========================================================================== */
  fixFormat: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 36l4 4l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 6l4 8l8 4l-8 4l-4 8l-4-8l-8-4l8-4l4-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 30l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  delete: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 11h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 11V7h10v4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 11l2 30h16l2-30" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M21 19v14M27 19v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  multiSelect: `<svg viewBox="0 0 48 48" fill="none"><path d="M20 10h20v20H20V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 18v20h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 20l4 4l7-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  forward: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 10l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 22H20c-8 0-12 4-12 12v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  broom: `<svg viewBox="0 0 48 48" fill="none"><path d="M30 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M27 9l12 12L18 42H8v-10L27 9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M12 32l4 4M19 25l4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

function formatMsgTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ==========================================================================
   [区域标注·本次需求3] 聊天页表情包面板数据工具
   说明：All 为固定默认分组；输入栏表情包面板与聊天设置“表情包挂载”共用。
   ========================================================================== */
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
   ========================================================================== */
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
  const bubbleInnerHtml = isStickerMessage
    ? `
        <div class="msg-sticker-bubble" title="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
          <img class="msg-sticker-bubble__image" src="${escapeHtml(msg?.stickerUrl || '')}" alt="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
        </div>
      `
    : escapeHtml(msg?.content || '');

  return `
    <!-- [区域标注·本次需求5] 可单击消息气泡：${escapeHtml(messageId)} -->
    <div class="msg-bubble-row ${isUser ? 'msg-bubble-row--right' : 'msg-bubble-row--left'} ${multiSelectMode ? 'is-multi-selecting' : ''} ${isSelected ? 'is-selected' : ''}"
         data-message-id="${escapeHtml(messageId)}"
         data-action="${multiSelectMode ? 'msg-multi-toggle' : 'msg-bubble-select'}">
      ${!isUser ? `<div class="msg-bubble__avatar">${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="">` : escapeHtml((name || '?').charAt(0).toUpperCase())}</div>` : ''}
      <div class="msg-bubble-content">
        ${isToolbarOpen ? `
          <!-- [区域标注·本次修改3] 消息气泡上方浮现功能栏：AI 消息支持“修正”表情包残缺格式 -->
          <div class="msg-bubble-toolbar" data-role="msg-bubble-toolbar">
            ${isAssistant ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--fix-format" data-action="msg-bubble-fix-format" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.fixFormat}<span>修正</span>
              </button>
            ` : ''}
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
        <div class="msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--other'} ${isAssistant && msg?.pending ? 'is-pending' : ''} ${isStickerMessage ? 'msg-bubble--sticker' : ''}">
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
   ========================================================================== */
export function renderChatMessage(chatSession, messages, options = {}) {
  const session = chatSession || {};
  const name = session.name || '聊天';
  const msgs = messages || [];
  const chatSettings = options.chatSettings || {};
  const isSending = Boolean(options.isSending);

  /* ==========================================================================
     [区域标注·本次需求3] 聊天页表情包面板 / AI 挂载设置
     ========================================================================== */
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
     ========================================================================== */
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
     ========================================================================== */
  const messagesHtml = msgs.length === 0
    ? `<div class="msg-empty">${MSG_ICONS.emptyChat}<p>还没有消息<br>发送一条消息开始聊天吧</p></div>`
    : msgs.map(msg => renderMessageBubble(msg, session, options)).join('');

  /* ==========================================================================
     [区域标注] 咖啡按钮升起功能区
     说明：当前仅做“表情包、转账”等功能占位，后续在此区域扩展。
     ========================================================================== */
  const featureDockHtml = `
    <div class="msg-feature-dock ${coffeeDockOpen ? 'is-open' : ''}" data-role="msg-feature-dock">
      <button class="msg-feature-dock__item" type="button" data-action="msg-feature-placeholder" data-feature="transfer">
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
     ========================================================================== */
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
     ========================================================================== */
  const multiSelectBarHtml = multiSelectMode ? `
    <div class="msg-multi-action-bar" data-role="msg-multi-action-bar">
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-cancel" type="button">${MSG_ICONS.close}<span>取消</span></button>
      <span class="msg-multi-action-bar__count">已选 ${selectedCount} 条</span>
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
     ========================================================================== */
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
     ========================================================================== */
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
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">自定义思维链</div>
          <div class="msg-settings-card__desc">留空时使用默认思维链；回复里的 think 内容会在聊天界面隐藏。</div>
          <textarea class="msg-settings-textarea" data-role="msg-custom-thinking" placeholder="【回复格式】先输出<think>...</think>，再输出最终回复。">${escapeHtml(chatSettings.customThinkingInstruction || '')}</textarea>
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
