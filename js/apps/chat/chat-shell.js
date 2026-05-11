// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-shell.js
 * 用途: 闲谈主壳渲染与四大板块切换。
 * 架构层: 应用层子模块（由 index.js 入口接线）
 */

/* ==========================================================================
   [区域标注·已完成·index.js入口拆分] 闲谈主壳渲染与板块切换
   说明：
   1. 从 index.js 拆出主壳 HTML、板块局部刷新与底部 TAB 切换。
   2. 本模块不新增任何持久化逻辑；禁止 localStorage/sessionStorage。
   3. index.js 仅导入本模块完成应用骨架渲染接线。
   ========================================================================== */
import {
  TAB_ICONS,
  PANEL_KEYS,
  PANEL_LABELS,
  PANEL_ICON_KEYS
} from './chat-utils.js';
import { renderChatList, getVisibleChatSessions } from './chat-list.js';
import { renderContacts } from './contacts.js';
import { renderMoments, getMomentsRenderOptions } from './moments.js';
import { renderProfile } from './profile.js';

const ICON_MOMENTS_HEART = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
  <path d="M12 20.2l-1.1-1C5.14 14.02 2 11.16 2 7.65 2 4.8 4.24 2.6 7.1 2.6c1.63 0 3.2.76 4.2 1.96 1-1.2 2.57-1.96 4.2-1.96C18.36 2.6 20.6 4.8 20.6 7.65c0 3.51-3.14 6.37-8.9 11.55l-1.1 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* ==========================================================================
   [区域标注] 构建应用骨架 HTML
   说明：包含顶部栏、四大板块容器、底部悬浮TAB栏、弹窗层
   ========================================================================== */
export function buildAppShell(state) {
  const panelTitles = { chatList: 'Chat', contacts: 'Contacts', moments: 'Moments', profile: 'Me' };
  const shellTitle = panelTitles[state.activePanel] || 'Chat';
  const showDefaultAdd = state.activePanel === 'chatList' || state.activePanel === 'contacts';
  const showMomentsActions = state.activePanel === 'moments';

  return `
    <!-- [区域标注] 闲谈应用根容器 -->
    <!-- [区域标注·本次需求2] data-active-panel 用于精确控制通讯录/朋友圈/用户主页标题栏顶部间距 -->
    <div class="chat-app" data-role="chat-app-root" data-active-panel="${state.activePanel}">

      <!-- ================================================================
           [区域标注] 顶部导航栏
           说明：左上角">"返回桌面，中间花体字"Chat"，右上角"+"添加
           ================================================================ -->
      <div class="chat-top-bar">
        <!-- [区域标注·已完成·本次朋友圈标题栏按钮位置调整] 朋友圈页标题左侧爱心与右侧“+”，仅在 Moments 板块显示 -->
        <button class="chat-top-bar__moments-action chat-top-bar__moments-action--left" data-action="moments-notifications" type="button" aria-label="朋友圈互动通知" style="${showMomentsActions ? '' : 'display:none;'}">${ICON_MOMENTS_HEART}</button>
        <!-- [区域标注·本次需求4] Chat/Contacts 标题组：右侧紧跟缩小后的 IconPark "+" 按钮 -->
        <div class="chat-top-bar__title-wrap">
          <button class="chat-top-bar__title" data-action="go-home" type="button">${shellTitle}</button>
          <button class="chat-top-bar__add" data-action="add-chat" type="button" aria-label="添加" style="${showDefaultAdd ? '' : 'display:none;'}">${TAB_ICONS.plus}</button>
        </div>
        <button class="chat-top-bar__moments-action chat-top-bar__moments-action--right" data-action="moments-compose" type="button" aria-label="发布朋友圈" style="${showMomentsActions ? '' : 'display:none;'}">${TAB_ICONS.plus}</button>
      </div>

      <!-- ================================================================
           [区域标注] 聊天列表子TAB栏（All / Private / Group）
           说明：仅在聊天列表板块时显示
           ================================================================ -->
      <div class="chat-tabs" data-role="chat-sub-tabs" style="${state.activePanel === 'chatList' ? '' : 'display:none;'}">
        <button class="chat-tab-btn ${state.chatSubTab === 'all' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="all">All</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'private' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="private">Private</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'group' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="group">Group</button>
      </div>

      <!-- ================================================================
           [区域标注] 四大板块内容区
           ================================================================ -->
      <!-- [区域标注] 聊天列表板块 -->
      <div class="chat-panel ${state.activePanel === 'chatList' ? 'is-active' : ''}" data-panel="chatList">
        ${renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed)}
      </div>
      <!-- [区域标注] 通讯录板块 -->
      <div class="chat-panel ${state.activePanel === 'contacts' ? 'is-active' : ''}" data-panel="contacts">
        ${renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId)}
      </div>
      <!-- [区域标注·已完成·本次朋友圈点赞评论互动] 朋友圈板块：传入点赞/评论/回复运行时渲染参数 -->
      <div class="chat-panel ${state.activePanel === 'moments' ? 'is-active' : ''}" data-panel="moments">
        ${renderMoments(state.moments, getMomentsRenderOptions(state))}
      </div>
      <!-- [区域标注] 用户主页板块 -->
      <div class="chat-panel ${state.activePanel === 'profile' ? 'is-active' : ''}" data-panel="profile">
        ${renderProfile(state.profile)}
      </div>

      <!-- ================================================================
           [区域标注] 聊天消息页面容器（初始隐藏，点击聊天条目后显示）
           ================================================================ -->
      <div class="chat-message-page-wrap" data-role="msg-page-wrap" style="display:none;">
      </div>

      <!-- ================================================================
           [区域标注·已完成·图片/HTML卡片单击居中放大] 聊天消息页媒体预览层
           说明：
           1. 仅服务闲谈消息页中的图片消息与 HTML 互动卡片单击居中放大。
           2. 预览层覆盖在聊天消息页内部，关闭时不改聊天消息界面背景，不使用原生浏览器弹窗。
           3. 只使用运行时 DOM，不涉及 localStorage/sessionStorage 或额外持久化存储。
           ================================================================ -->
      <div class="msg-media-zoom-overlay" data-role="msg-media-zoom-overlay">
        <div class="msg-media-zoom-overlay__panel">
          <button class="msg-media-zoom-overlay__close" data-action="msg-media-close-zoom" type="button" aria-label="关闭预览">${TAB_ICONS.close}</button>
          <div class="msg-media-zoom-overlay__body" data-role="msg-media-zoom-body"></div>
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 底部悬浮 TAB 栏（四大板块切换）
           说明：参照图片1 — 暗色圆角胶囊，选中态椭圆扩展变色
           ================================================================ -->
      <div class="chat-bottom-tab" data-role="bottom-tab">
        ${PANEL_KEYS.map((key, idx) => `
          <!-- [区域标注] 底部TAB: ${PANEL_LABELS[idx]} -->
          <button class="chat-bottom-tab__btn ${state.activePanel === key ? 'is-active' : ''}"
                  data-action="switch-panel" data-panel="${key}">
            ${TAB_ICONS[PANEL_ICON_KEYS[idx]]}
            <span>${PANEL_LABELS[idx]}</span>
          </button>
        `).join('')}
      </div>

      <!-- ================================================================
           [区域标注] 应用内弹窗层（替代原生浏览器弹窗）
           说明：用于搜索通讯录好友并添加到聊天列表等场景
           ================================================================ -->
      <div class="chat-modal-mask is-hidden" data-role="modal-mask">
        <div class="chat-modal-panel" data-role="modal-panel">
          <!-- 弹窗内容由 JS 动态填充 -->
        </div>
      </div>

    </div>
  `;
}

/* ==========================================================================
   [区域标注] 刷新指定板块内容
   说明：局部更新板块 innerHTML，避免整页重建
   ========================================================================== */
export function refreshPanel(container, state, panelKey) {
  const panelEl = container.querySelector(`[data-panel="${panelKey}"]`);
  if (!panelEl) return;

  switch (panelKey) {
    case 'chatList':
      panelEl.innerHTML = renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed);
      break;
    case 'contacts':
      panelEl.innerHTML = renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId);
      break;
    case 'moments':
      panelEl.innerHTML = renderMoments(state.moments, getMomentsRenderOptions(state));
      break;
    case 'profile':
      panelEl.innerHTML = renderProfile(state.profile);
      break;
  }
}

/* ==========================================================================
   [区域标注] 切换底部板块
   ========================================================================== */
export function switchPanel(container, state, panelKey) {
  state.activePanel = panelKey;

  /* [区域标注·本次需求2] 同步当前板块标记，供 CSS 单独调整非聊天列表标题栏顶部间距 */
  const rootEl = container.querySelector('[data-role="chat-app-root"]');
  if (rootEl) rootEl.dataset.activePanel = panelKey;

  /* [区域标注] 更新板块显隐 */
  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) el.classList.toggle('is-active', k === panelKey);
  });

  /* [区域标注] 更新底部TAB选中态 */
  container.querySelectorAll('.chat-bottom-tab__btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.panel === panelKey);
  });

  /* [区域标注] 聊天列表子TAB栏仅在聊天列表板块显示 */
  const subTabsEl = container.querySelector('[data-role="chat-sub-tabs"]');
  if (subTabsEl) subTabsEl.style.display = panelKey === 'chatList' ? '' : 'none';

  /* [区域标注] 顶部标题根据板块切换 */
  const titleEl = container.querySelector('.chat-top-bar__title');
  if (titleEl) {
    const titles = { chatList: 'Chat', contacts: 'Contacts', moments: 'Moments', profile: 'Me' };
    titleEl.textContent = titles[panelKey] || 'Chat';
  }

  /* [区域标注·本次需求2] "+"按钮在聊天列表与通讯录板块显示：聊天列表添加聊天，通讯录搜索添加联系人 */
  const isMomentsPanel = panelKey === 'moments';
  const addBtn = container.querySelector('.chat-top-bar__add');
  if (addBtn) addBtn.style.display = (!isMomentsPanel && (panelKey === 'chatList' || panelKey === 'contacts')) ? '' : 'none';

  /* [区域标注·已完成·本次朋友圈标题栏按钮位置调整] Moments 板块显示标题左爱心右“+”，其它板块隐藏 */
  container.querySelectorAll('.chat-top-bar__moments-action').forEach(btn => {
    btn.style.display = isMomentsPanel ? '' : 'none';
  });
}
