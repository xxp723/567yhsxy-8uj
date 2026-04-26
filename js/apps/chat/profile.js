/**
 * 文件名: js/apps/chat/profile.js
 * 用途: 闲谈应用 — 用户主页板块
 *       显示当前用户的个人资料页面，包含封面、头像、昵称、签名、
 *       统计数据等信息。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 定位图标 */
  location: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 44s15-11 15-23a15 15 0 1 0-30 0c0 12 15 23 15 23Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="21" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注] 编辑图标 */
  edit: `<svg viewBox="0 0 48 48" fill="none"><path d="M7 42h36M25.799 11.2l5 5L13 34H8v-5L25.799 11.2Zm5-5l5 5l-5-5Zm0 0l3.536-3.535a1.414 1.414 0 0 1 2 0l3 3a1.414 1.414 0 0 1 0 2L33.799 11.2l-3-5Z" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 好友数量卡片图标（IconPark — People / 用户群组） */
  friends: `<svg viewBox="0 0 48 48" fill="none"><circle cx="19" cy="14" r="7" stroke="currentColor" stroke-width="3"/><path d="M4 40a15 15 0 0 1 30 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="16" r="5" stroke="currentColor" stroke-width="3"/><path d="M44 40a10 10 0 0 0-14-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 身份数量卡片图标（IconPark — IdCard / 身份证） */
  identities: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="22" r="5" stroke="currentColor" stroke-width="3"/><path d="M10 36a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 18h10M30 26h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 聊天天数卡片图标（IconPark — Calendar / 日历） */
  chatDays: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="36" rx="3" stroke="currentColor" stroke-width="3"/><path d="M4 20h40M16 4v8M32 4v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="30" r="2" fill="currentColor"/><circle cx="24" cy="30" r="2" fill="currentColor"/><circle cx="30" cy="30" r="2" fill="currentColor"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
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
           [区域标注] 封面区域（可点击上传封面图片）
           说明：点击后弹出自定义上传弹窗，支持本地/URL上传
                 已移除右上角菜单按钮和右下角"Change Cover"按钮
           ================================================================ -->
      <div class="profile-cover profile-cover--clickable" data-action="upload-cover"
           style="${coverUrl ? `background-image:url('${escapeHtml(coverUrl)}');` : ''}">
      </div>

      <!-- ================================================================
           [区域标注] 头像区域（可点击上传头像图片）
           说明：点击后弹出自定义上传弹窗，支持本地/URL上传
           ================================================================ -->
      <div class="profile-avatar-wrap">
        <div class="profile-avatar profile-avatar--clickable" data-action="upload-avatar">
          ${avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="头像">`
            : `<span class="profile-avatar__placeholder">${escapeHtml(nickname.charAt(0).toUpperCase())}</span>`}
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 昵称区域（居中显示）
           ================================================================ -->
      <div class="profile-nickname profile-nickname--center">${escapeHtml(nickname)}</div>

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
           [区域标注] 统计数据区域（三张方形圆角卡片）
           说明：好友数量、身份数量、聊天天数，三张大小一致的方形圆角卡片
           ================================================================ -->
      <div class="profile-stats-cards">
        <!-- [区域标注] 好友数量卡片 -->
        <div class="profile-stat-card">
          <span class="profile-stat-card__icon">${ICONS.friends}</span>
          <span class="profile-stat-card__number">${friends}</span>
          <span class="profile-stat-card__label">好友数量</span>
        </div>
        <!-- [区域标注] 身份数量卡片 -->
        <div class="profile-stat-card">
          <span class="profile-stat-card__icon">${ICONS.identities}</span>
          <span class="profile-stat-card__number">${identities}</span>
          <span class="profile-stat-card__label">身份数量</span>
        </div>
        <!-- [区域标注] 聊天天数卡片 -->
        <div class="profile-stat-card">
          <span class="profile-stat-card__icon">${ICONS.chatDays}</span>
          <span class="profile-stat-card__number">${chatDays}</span>
          <span class="profile-stat-card__label">聊天天数</span>
        </div>
      </div>

    </div>
  `;
}
