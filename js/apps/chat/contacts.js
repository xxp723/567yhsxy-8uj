/**
 * 文件名: js/apps/chat/contacts.js
 * 用途: 闲谈应用 — 通讯录板块
 *       显示已添加好友列表，支持搜索、按字母分组等。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 搜索图标 */
  search: `<svg viewBox="0 0 48 48" fill="none"><circle cx="21" cy="21" r="11" stroke="currentColor" stroke-width="3"/><path d="M29 29l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
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
   [区域标注] 渲染通讯录 HTML
   参数：contacts — 联系人数组 [{id, name, avatar, signature}]
         searchKeyword — 搜索关键词
   ========================================================================== */
export function renderContacts(contacts, searchKeyword) {
  const keyword = (searchKeyword || '').toLowerCase().trim();

  /* [区域标注] 过滤联系人 */
  const filtered = contacts.filter(c => {
    if (keyword && !(c.name || '').toLowerCase().includes(keyword)) return false;
    return true;
  });

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

  /* [区域标注] 搜索栏 */
  const searchBarHtml = `
    <!-- [区域标注] 通讯录搜索栏 -->
    <div class="chat-search-bar">
      ${ICONS.search}
      <input type="text" placeholder="搜索联系人..." data-role="contacts-search-input" value="${escapeHtml(searchKeyword || '')}">
    </div>
  `;

  /* [区域标注] 空状态 */
  if (filtered.length === 0) {
    return `
      ${searchBarHtml}
      <!-- [区域标注] 通讯录空状态 -->
      <div class="chat-list-empty">
        ${ICONS.peoples}
        <p>暂无联系人<br>前往档案应用添加角色后即可在此查看</p>
      </div>
    `;
  }

  /* [区域标注] 联系人分组列表 */
  const listHtml = sortedKeys.map(key => `
    <!-- [区域标注] 通讯录分组：${key} -->
    <div class="contacts-group">
      <div class="contacts-group__letter">${escapeHtml(key)}</div>
      ${groups[key].map(c => `
        <!-- [区域标注] 联系人条目：${escapeHtml(c.name)} -->
        <div class="contacts-item" data-action="view-contact" data-contact-id="${c.id}">
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
    ${searchBarHtml}
    <!-- [区域标注] 通讯录列表主体 -->
    <div class="contacts-list-area">
      ${listHtml}
    </div>
  `;
}
