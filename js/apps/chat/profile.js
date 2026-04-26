/**
 * 文件名: js/apps/chat/profile.js
 * 用途: 闲谈应用 — 用户主页板块
 *       显示当前用户的个人资料页面，包含封面、头像、昵称、签名、
 *       统计数据等信息，参照图片4的布局设计。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 定位图标 */
  location: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 44s15-11 15-23a15 15 0 1 0-30 0c0 12 15 23 15 23Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="21" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注] 相机/更换封面图标 */
  camera: `<svg viewBox="0 0 48 48" fill="none"><path d="M15 12l3-6h12l3 6h9a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2h9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="26" r="8" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注] 设置/菜单图标（三横线） */
  menu: `<svg viewBox="0 0 48 48" fill="none"><path d="M7 12h34M7 24h34M7 36h34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 星星/收藏图标 */
  star: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4l6.245 12.651L44 18.583l-10 9.748L36.49 42L24 35.399L11.51 42L14 28.331l-10-9.748l13.755-1.932L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 编辑图标 */
  edit: `<svg viewBox="0 0 48 48" fill="none"><path d="M7 42h36M25.799 11.2l5 5L13 34H8v-5L25.799 11.2Zm5-5l5 5l-5-5Zm0 0l3.536-3.535a1.414 1.414 0 0 1 2 0l3 3a1.414 1.414 0 0 1 0 2L33.799 11.2l-3-5Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

/* ==========================================================================
   [区域标注] 渲染用户主页 HTML
   参数：userProfile — 用户资料对象
         {nickname, avatar, cover, location, title, signature, friendsCount, identitiesCount, chatDays}
   ========================================================================== */
export function renderProfile(userProfile) {
  const p = userProfile || {};
  const nickname    = p.nickname || '我的昵称';
  const avatarUrl   = p.avatar || '';
  const coverUrl    = p.cover || '';
  const location    = p.location || '';
  const title       = p.title || '';
  const signature   = p.signature || '点击输入个性签名...';
  const friends     = p.friendsCount ?? 0;
  const identities  = p.identitiesCount ?? 0;
  const chatDays    = p.chatDays ?? 0;

  return `
    <!-- [区域标注] 用户主页容器 -->
    <div class="profile-page">

      <!-- ================================================================
           [区域标注] 封面区域
           说明：顶部大图封面，右下角有"更换封面"按钮，右上角有菜单按钮
           ================================================================ -->
      <div class="profile-cover" style="${coverUrl ? `background-image:url('${escapeHtml(coverUrl)}');` : ''}">
        <!-- [区域标注] 菜单按钮（右上角） -->
        <button class="profile-cover__menu-btn" data-action="profile-menu">
          ${ICONS.menu}
        </button>
        <!-- [区域标注] 更换封面按钮（右下角） -->
        <button class="profile-cover__change-btn" data-action="change-cover">
          ${ICONS.camera}
          <span>Change Cover</span>
        </button>
      </div>

      <!-- ================================================================
           [区域标注] 头像区域
           说明：圆形头像，居中叠放在封面底部
           ================================================================ -->
      <div class="profile-avatar-wrap">
        <div class="profile-avatar">
          ${avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="头像">`
            : `<span class="profile-avatar__placeholder">${escapeHtml(nickname.charAt(0).toUpperCase())}</span>`}
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 昵称区域
           ================================================================ -->
      <div class="profile-nickname">${escapeHtml(nickname)}</div>

      <!-- ================================================================
           [区域标注] 标签区域（地点 + 头衔）
           ================================================================ -->
      <div class="profile-tags">
        ${location ? `
          <!-- [区域标注] 地点标签 -->
          <span class="profile-tag profile-tag--location">
            ${ICONS.location}
            ${escapeHtml(location)}
          </span>
        ` : ''}
        ${title ? `
          <!-- [区域标注] 头衔标签 -->
          <span class="profile-tag profile-tag--title">${escapeHtml(title)}</span>
        ` : ''}
      </div>

      <!-- ================================================================
           [区域标注] 个性签名
           ================================================================ -->
      <div class="profile-signature" data-action="edit-signature">
        ${escapeHtml(signature)}
      </div>

      <!-- ================================================================
           [区域标注] 统计数据区域
           说明：三列显示好友数量、身份数量、聊天天数
           ================================================================ -->
      <div class="profile-stats">
        <!-- [区域标注] 好友数量 -->
        <div class="profile-stats__item">
          <span class="profile-stats__number">${friends}</span>
          <span class="profile-stats__label">好友数量</span>
        </div>
        <!-- [区域标注] 身份数量 -->
        <div class="profile-stats__item">
          <span class="profile-stats__number">${identities}</span>
          <span class="profile-stats__label">身份数量</span>
        </div>
        <!-- [区域标注] 聊天天数 -->
        <div class="profile-stats__item">
          <span class="profile-stats__number">${chatDays}</span>
          <span class="profile-stats__label">聊天天数</span>
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 功能入口区域
           说明：如"聊天美化"等功能入口卡片
           ================================================================ -->
      <div class="profile-menu-section">
        <!-- [区域标注] 聊天美化入口 -->
        <div class="profile-menu-card" data-action="chat-beautify">
          <span class="profile-menu-card__icon">${ICONS.star}</span>
          <span class="profile-menu-card__text">聊天美化</span>
        </div>
      </div>

    </div>
  `;
}
