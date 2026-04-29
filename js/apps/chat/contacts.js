// @ts-nocheck
/**
 * 文件名: js/apps/chat/contacts.js
 * 用途: 闲谈应用 — 通讯录板块
 *       显示已添加好友列表，支持自定义分组 TAB 切换、按字母分组等。
 * 架构层: 应用层（闲谈子模块）
 */

import { TAB_ICONS, ICON_CHECK, escapeHtml, findRoleByContact } from './chat-utils.js';

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

/* ==========================================================================
   [区域标注·本次需求2] 显示"添加联系人"弹窗
   ========================================================================== */
export function showAddContactModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录搜索添加联系人弹窗 -->
    <div class="chat-modal-header">
      <span>添加联系人</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           inputmode="numeric"
           maxlength="11"
           placeholder="输入绑定角色的11位联系方式"
           data-role="contact-add-search-input">
    <div class="chat-modal-body" data-role="contact-search-results">
      <div class="chat-modal-hint">请输入 11 位数字联系方式，搜索当前面具身份绑定的角色。</div>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="contact-add-search-input"]');
    if (input) input.focus();
  }, 30);
}

/* ==========================================================================
   [区域标注·本次需求2] 渲染联系人搜索结果
   ========================================================================== */
export function renderContactSearchResults(container, state, rawValue) {
  const body = container.querySelector('[data-role="contact-search-results"]');
  if (!body) return;

  const contactNumber = String(rawValue || '').replace(/\D/g, '').slice(0, 11);
  const input = container.querySelector('[data-role="contact-add-search-input"]');
  if (input && input.value !== contactNumber) input.value = contactNumber;

  if (!contactNumber) {
    body.innerHTML = `<div class="chat-modal-hint">请输入 11 位数字联系方式，搜索当前面具身份绑定的角色。</div>`;
    return;
  }

  if (!/^\d{11}$/.test(contactNumber)) {
    body.innerHTML = `<div class="chat-modal-hint">联系方式需为 11 位数字。</div>`;
    return;
  }

  const role = findRoleByContact(state, contactNumber);
  if (!role) {
    body.innerHTML = `<div class="chat-modal-hint">未搜索到当前面具绑定的角色。</div>`;
    return;
  }

  const alreadyAdded = state.contacts.some(contact => contact.id === role.id);
  body.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录搜索结果角色：${escapeHtml(role.name || '未命名角色')} -->
    <div class="chat-contact-search-result">
      <div class="chat-contact-search-result__avatar">
        ${role.avatar
          ? `<img src="${escapeHtml(role.avatar)}" alt="${escapeHtml(role.name || '')}">`
          : escapeHtml((role.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-contact-search-result__info">
        <div class="chat-contact-search-result__name">${escapeHtml(role.name || '未命名角色')}</div>
        <div class="chat-contact-search-result__contact">${escapeHtml(role.contact || '')}</div>
      </div>
      <button class="chat-contact-search-result__add ${alreadyAdded ? 'is-added' : ''}"
              data-action="${alreadyAdded ? 'view-contact' : 'add-contact-from-search'}"
              data-role-id="${escapeHtml(role.id)}"
              data-contact-id="${escapeHtml(role.id)}"
              type="button"
              aria-label="${alreadyAdded ? '选择分组' : '添加联系人'}">
        ${alreadyAdded ? ICON_CHECK : TAB_ICONS.plus}
      </button>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·本次需求1] 新建通讯录分组弹窗
   ========================================================================== */
export function showCreateContactGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求1] 新建通讯录分组弹窗 -->
    <div class="chat-modal-header">
      <span>新建分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           maxlength="12"
           placeholder="输入分组名称"
           data-role="contact-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-contact-group" type="button">完成</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="contact-group-name-input"]');
    if (input) input.focus();
  }, 30);
}

/* ==========================================================================
   [区域标注·本次需求2] 通讯录联系人分组选择弹窗
   ========================================================================== */
export function showContactGroupPickerModal(container, state, contactId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const contact = state.contacts.find(item => item.id === contactId);
  if (!mask || !panel || !contact) return;

  const groups = Array.isArray(state.contactGroups) ? state.contactGroups : [];
  const currentGroupId = contact.groupId || '';

  const groupButtonsHtml = [
    { id: '', name: 'All' },
    ...groups
  ].map(group => {
    const isActive = currentGroupId === group.id;
    return `
      <!-- [区域标注·本次需求2] 联系人分组选择项：${escapeHtml(group.name)} -->
      <button class="chat-contact-group-choice ${isActive ? 'is-active' : ''}"
              data-action="assign-contact-group"
              data-contact-id="${escapeHtml(contact.id)}"
              data-contact-group-id="${escapeHtml(group.id)}"
              type="button">
        <span>${escapeHtml(group.name)}</span>
        ${isActive ? `<i>${ICON_CHECK}</i>` : ''}
      </button>
    `;
  }).join('');

  panel.innerHTML = `
    <!-- [区域标注·本次需求2] 通讯录联系人分组选择弹窗 -->
    <div class="chat-modal-header">
      <span>选择分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-contact-group-picker-head">
      <div class="chat-contact-group-picker-head__avatar">
        ${contact.avatar
          ? `<img src="${escapeHtml(contact.avatar)}" alt="${escapeHtml(contact.name || '')}">`
          : escapeHtml((contact.name || '?').charAt(0).toUpperCase())}
      </div>
      <div class="chat-contact-group-picker-head__info">
        <div class="chat-contact-group-picker-head__name">${escapeHtml(contact.name || '未命名')}</div>
        <div class="chat-contact-group-picker-head__tip">选择此联系人所在的通讯录分组</div>
      </div>
    </div>
    <div class="chat-modal-body">
      ${groupButtonsHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次需求1] 删除通讯录分组确认弹窗
   ========================================================================== */
export function showDeleteContactGroupModal(container, state, groupId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const group = state.contactGroups.find(item => item.id === groupId);
  if (!mask || !panel || !group) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求1] 删除通讯录分组确认弹窗 -->
    <div class="chat-modal-header">
      <span>删除分组标签</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否删除“${escapeHtml(group.name)}”分组标签？<br>分组内联系人不会被删除，之后只会在 All 中显示。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-contact-group" data-contact-group-id="${escapeHtml(group.id)}" type="button">删除</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·本次需求1] 通讯录分组长按处理器
   ========================================================================== */
export function createContactGroupLongPressHandlers(state, container) {
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

    const groupId = target.dataset.contactGroupId || '';
    const exists = groupId && groupId !== 'all' && state.contactGroups.some(group => group.id === groupId);
    if (!exists) return;

    target.dataset.longPressTriggered = '1';
    showDeleteContactGroupModal(container, state, groupId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-contact-group"]');
      if (!target) return;

      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-contact-group"]')) {
        e.preventDefault();
      }
    }
  };
}
