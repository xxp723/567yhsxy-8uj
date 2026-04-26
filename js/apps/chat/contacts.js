/**
 * 文件名: js/apps/chat/contacts.js
 * 用途: 闲谈应用 — 通讯录板块
 *       显示已添加好友列表，支持自定义分组 TAB 切换、按字母分组等。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 搜索图标（仅保留给弹窗/后续扩展引用，通讯录页内不再渲染搜索框） */
  search: `<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29 29l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] "+" 添加图标（IconPark — Plus） */
  plus: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 8v32M8 24h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 用户图标 */
  user: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 24a10 10 0 1 0 0-20a10 10 0 0 0 0 20Z" stroke="currentColor" stroke-width="3"/><path d="M8 42a16 16 0 0 1 32 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 空状态联系人图标 */
  peoples: `<svg viewBox="0 0 48 48" fill="none"><circle cx="16" cy="16" r="7" stroke="currentColor" stroke-width="3"/><circle cx="33" cy="15" r="5" stroke="currentColor" stroke-width="3"/><path d="M4 40a12 12 0 0 1 24 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M26 39a9 9 0 0 1 18 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

/* ==========================================================================
   [区域标注] 获取联系人首字母（用于分组排序）
   ========================================================================== */
function getInitial(name) {
  const first = (name || '?').charAt(0).toUpperCase();
  if (/[A-Z]/.test(first)) return first;
  return '#';
}

/* ==========================================================================
   [区域标注·本次需求1] 渲染通讯录分组 TAB 栏
   说明：
     - 默认固定显示 All
     - All 旁边显示 "+" 图标按钮，用于创建新分组
     - 自定义分组过多时横向滑动查看
   ========================================================================== */
function renderContactGroupTabs(contactGroups, activeGroupId) {
  const groups = Array.isArray(contactGroups) ? contactGroups : [];
  const activeId = activeGroupId || 'all';

  return `
    <!-- [区域标注·本次需求1] 通讯录分组 TAB 栏 -->
    <div class="contacts-group-tabs" data-role="contacts-group-tabs">
      <div class="contacts-group-tabs__scroller">
        <button class="chat-tab-btn contacts-group-tab-btn ${activeId === 'all' ? 'is-active' : ''}"
                data-action="switch-contact-group"
                data-contact-group-id="all"
                type="button">All</button>
        ${groups.map(group => `
          <!-- [区域标注·本次需求1] 通讯录自定义分组 TAB：长按可删除分组标签，联系人不会被删除 -->
          <button class="chat-tab-btn contacts-group-tab-btn ${activeId === group.id ? 'is-active' : ''}"
                  data-action="switch-contact-group"
                  data-long-press-action="delete-contact-group"
                  data-contact-group-id="${escapeHtml(group.id)}"
                  data-contact-group-name="${escapeHtml(group.name)}"
                  type="button">${escapeHtml(group.name)}</button>
        `).join('')}
        <!-- [区域标注·本次需求1] 新建分组按钮：始终跟随到最新（最右侧）分组右边 -->
        <button class="contacts-group-add-tab"
                data-action="create-contact-group"
                type="button"
                aria-label="新建通讯录分组">${ICONS.plus}</button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注] 渲染通讯录 HTML
   参数：
     contacts — 联系人数组 [{id, name, avatar, signature, groupId}]
     contactGroups — 自定义分组数组 [{id, name}]
     activeContactGroupId — 当前选中的分组 id，默认 all
   ========================================================================== */
export function renderContacts(contacts, contactGroups = [], activeContactGroupId = 'all') {
  const activeGroupId = activeContactGroupId || 'all';

  /* [区域标注·本次需求1] 按当前通讯录分组过滤联系人 */
  const filtered = activeGroupId === 'all'
    ? contacts
    : contacts.filter(c => (c.groupId || '') === activeGroupId);

  /* [区域标注] 按首字母分组 */
  const groups = {};
  filtered.forEach(c => {
    const initial = getInitial(c.name);
    if (!groups[initial]) groups[initial] = [];
    groups[initial].push(c);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  const groupTabsHtml = renderContactGroupTabs(contactGroups, activeGroupId);

  /* [区域标注] 空状态 */
  if (filtered.length === 0) {
    return `
      ${groupTabsHtml}
      <!-- [区域标注] 通讯录空状态 -->
      <div class="chat-list-empty">
        ${ICONS.peoples}
        <p>${activeGroupId === 'all' ? '暂无联系人' : '当前分组暂无联系人'}<br>点击右上角 + 搜索并添加角色</p>
      </div>
    `;
  }

  /* [区域标注] 联系人分组列表 */
  const listHtml = sortedKeys.map(key => `
    <!-- [区域标注] 通讯录字母分组：${key} -->
    <div class="contacts-group">
      <div class="contacts-group__letter">${escapeHtml(key)}</div>
      ${groups[key].map(c => `
        <!-- [区域标注·本次需求2] 联系人条目：点击后打开通讯录分组选择弹窗 -->
        <div class="contacts-item" data-action="view-contact" data-contact-id="${escapeHtml(c.id)}">
          <div class="contacts-item__avatar">
            ${c.avatar
              ? `<img src="${escapeHtml(c.avatar)}" alt="${escapeHtml(c.name)}">`
              : `<span>${escapeHtml((c.name || '?').charAt(0).toUpperCase())}</span>`}
          </div>
          <div class="contacts-item__info">
            <div class="contacts-item__name">${escapeHtml(c.name || '未命名')}</div>
            <div class="contacts-item__sig">${escapeHtml(c.signature || '')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `
    ${groupTabsHtml}
    <!-- [区域标注] 通讯录列表主体 -->
    <div class="contacts-list-area">
      ${listHtml}
    </div>
  `;
}
