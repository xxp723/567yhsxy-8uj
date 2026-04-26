/**
 * 文件名: js/apps/chat/chat-list.js
 * 用途: 闲谈应用 — 聊天列表板块
 *       管理所有聊天会话的显示、All/Private/Group 三个子TAB切换、
 *       折叠分组标题、搜索过滤等功能。
 * 架构层: 应用层（闲谈子模块）
 */

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

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

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
    if (keyword && !(s.name || '').toLowerCase().includes(keyword)) return false;
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
    <!-- [区域标注] 聊天条目：${escapeHtml(session.name)} -->
    <div class="chat-item" data-action="open-chat" data-chat-id="${session.id}">
      <div class="chat-item__avatar">
        ${session.avatar
          ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(session.name)}">`
          : escapeHtml((session.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-item__info">
        <div class="chat-item__name">${escapeHtml(session.name || '未命名')}</div>
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
