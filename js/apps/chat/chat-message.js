/**
 * 文件名: js/apps/chat/chat-message.js
 * 用途: 闲谈应用 — 聊天消息页面
 *       独立的聊天对话界面，包含消息列表、悬浮输入栏等。
 *       参照图片3的布局设计。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   说明：聊天消息页面用到的所有图标
   ========================================================================== */
const MSG_ICONS = {
  /* [区域标注] 返回箭头图标 */
  back: `<svg viewBox="0 0 48 48" fill="none"><path d="M32 36L20 24l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 纸飞机发送图标 */
  send: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L25 43l-5-18L2 20L43 5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 25l23-20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 魔术棒图标 */
  magicWand: `<svg viewBox="0 0 48 48" fill="none"><path d="M20 6l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2l2-6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M12 28l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 22l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 咖啡图标 */
  coffee: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 20h28v14a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V20Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 24h4a6 6 0 0 1 0 12h-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6v6M20 6v6M28 6v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 更多/三个点图标 */
  more: `<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>`,
  /* [区域标注] 空消息图标 */
  emptyChat: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`
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
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/* ==========================================================================
   [区域标注] 渲染聊天消息页面 HTML
   参数：chatSession — 聊天会话对象 {id, name, avatar, type}
         messages — 消息数组 [{id, role, content, timestamp, senderAvatar}]
            role: 'user' 表示用户发送, 'other' 表示对方发送
   ========================================================================== */
export function renderChatMessage(chatSession, messages) {
  const session = chatSession || {};
  const name = session.name || '聊天';
  const msgs = messages || [];

  /* [区域标注] 聊天顶部栏（头部信息区） */
  const topBarHtml = `
    <!-- [区域标注] 聊天消息页面顶部栏 -->
    <div class="msg-top-bar">
      <!-- [区域标注] 返回按钮 -->
      <button class="msg-top-bar__back" data-action="msg-back">
        ${MSG_ICONS.back}
      </button>
      <!-- [区域标注] 对方头像+名字+状态 -->
      <div class="msg-top-bar__user">
        <div class="msg-top-bar__avatar">
          ${session.avatar
            ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(name)}">`
            : escapeHtml((name || '?').charAt(0).toUpperCase())}
        </div>
        <div class="msg-top-bar__info">
          <span class="msg-top-bar__name">${escapeHtml(name)}</span>
          <span class="msg-top-bar__status">在线</span>
        </div>
      </div>
      <!-- [区域标注] 更多操作按钮 -->
      <button class="msg-top-bar__more" data-action="msg-more">
        ${MSG_ICONS.more}
      </button>
    </div>
  `;

  /* [区域标注] 消息列表区域 */
  let messagesHtml = '';
  if (msgs.length === 0) {
    /* [区域标注] 消息列表空状态 */
    messagesHtml = `
      <div class="msg-empty">
        ${MSG_ICONS.emptyChat}
        <p>还没有消息<br>发送一条消息开始聊天吧</p>
      </div>
    `;
  } else {
    /* [区域标注] 消息气泡列表 */
    messagesHtml = msgs.map(msg => {
      const isUser = msg.role === 'user';
      return `
        <!-- [区域标注] 单条消息 — ${isUser ? '用户发送' : '对方发送'} -->
        <div class="msg-bubble-row ${isUser ? 'msg-bubble-row--right' : 'msg-bubble-row--left'}">
          ${!isUser ? `
            <!-- [区域标注] 对方头像 -->
            <div class="msg-bubble__avatar">
              ${session.avatar
                ? `<img src="${escapeHtml(session.avatar)}" alt="">`
                : escapeHtml((name || '?').charAt(0).toUpperCase())}
            </div>
          ` : ''}
          <div class="msg-bubble-content">
            <!-- [区域标注] 消息气泡 -->
            <div class="msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--other'}">
              ${escapeHtml(msg.content || '')}
            </div>
            <!-- [区域标注] 消息时间 -->
            <span class="msg-bubble__time">${formatMsgTime(msg.timestamp)}</span>
          </div>
          ${isUser ? `
            <!-- [区域标注] 用户头像 -->
            <div class="msg-bubble__avatar msg-bubble__avatar--user">
              <span>我</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /* [区域标注] 悬浮底部输入栏 */
  const inputBarHtml = `
    <!-- [区域标注] 聊天消息悬浮底部输入栏 -->
    <div class="msg-input-bar">
      <!-- [区域标注] 咖啡图标按钮（最左侧） -->
      <button class="msg-input-bar__icon-btn" data-action="msg-coffee">
        ${MSG_ICONS.coffee}
      </button>
      <!-- [区域标注] 消息输入框 -->
      <input type="text" class="msg-input-bar__input" placeholder="输入消息..." data-role="msg-input">
      <!-- [区域标注] 魔术棒图标按钮 -->
      <button class="msg-input-bar__icon-btn" data-action="msg-magic">
        ${MSG_ICONS.magicWand}
      </button>
      <!-- [区域标注] 纸飞机发送图标按钮（最右侧） -->
      <button class="msg-input-bar__icon-btn msg-input-bar__send-btn" data-action="msg-send">
        ${MSG_ICONS.send}
      </button>
    </div>
  `;

  /* [区域标注] 组装完整聊天消息页面 */
  return `
    <!-- [区域标注] 聊天消息页面容器 -->
    <div class="msg-page">
      ${topBarHtml}
      <!-- [区域标注] 消息列表滚动区域 -->
      <div class="msg-list-area" data-role="msg-list">
        ${messagesHtml}
      </div>
      ${inputBarHtml}
    </div>
  `;
}
