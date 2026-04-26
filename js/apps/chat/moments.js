/**
 * 文件名: js/apps/chat/moments.js
 * 用途: 闲谈应用 — 朋友圈板块
 *       显示好友动态列表，支持点赞、评论展示等。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 点赞/爱心图标 */
  like: `<svg viewBox="0 0 48 48" fill="none"><path d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A11.007 11.007 0 0 0 15 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 评论图标 */
  comment: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 图片图标 */
  image: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="8" width="36" height="32" rx="2" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="20" r="4" stroke="currentColor" stroke-width="3"/><path d="M42 34L32 24l-8 8l-4-4l-14 12" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 朋友圈空状态图标 */
  earth: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c-5.333 6.667-8 13.333-8 20s2.667 13.333 8 20c5.333-6.667 8-13.333 8-20s-2.667-13.333-8-20Z" stroke="currentColor" stroke-width="3"/></svg>`
};

/* ==========================================================================
   [区域标注] 工具函数
   ========================================================================== */
function escapeHtml(text) {
  const map = { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString();
}

/* ==========================================================================
   [区域标注] 渲染朋友圈 HTML
   参数：moments — 动态数组 [{id, authorName, authorAvatar, content, images, likes, comments, createdAt}]
   ========================================================================== */
export function renderMoments(moments) {
  /* [区域标注] 空状态 */
  if (!moments || moments.length === 0) {
    return `
      <!-- [区域标注] 朋友圈空状态 -->
      <div class="chat-list-empty">
        ${ICONS.earth}
        <p>暂无朋友圈动态<br>好友发布动态后将在此显示</p>
      </div>
    `;
  }

  /* [区域标注] 朋友圈动态列表 */
  return `
    <!-- [区域标注] 朋友圈动态列表容器 -->
    <div class="moments-list">
      ${moments.map(m => `
        <!-- [区域标注] 朋友圈动态条目 -->
        <div class="moments-item" data-moment-id="${m.id}">
          <!-- [区域标注] 动态作者信息 -->
          <div class="moments-item__header">
            <div class="moments-item__avatar">
              ${m.authorAvatar
                ? `<img src="${escapeHtml(m.authorAvatar)}" alt="${escapeHtml(m.authorName)}">`
                : `<span>${escapeHtml((m.authorName || '?').charAt(0).toUpperCase())}</span>`}
            </div>
            <div class="moments-item__author">
              <span class="moments-item__name">${escapeHtml(m.authorName || '未命名')}</span>
              <span class="moments-item__time">${formatTimeAgo(m.createdAt)}</span>
            </div>
          </div>
          <!-- [区域标注] 动态文字内容 -->
          <div class="moments-item__content">
            <p>${escapeHtml(m.content || '')}</p>
          </div>
          <!-- [区域标注] 动态图片区域 -->
          ${(m.images && m.images.length > 0) ? `
            <div class="moments-item__images moments-grid-${Math.min(m.images.length, 3)}">
              ${m.images.slice(0, 9).map(img => `
                <div class="moments-item__img-wrap">
                  <img src="${escapeHtml(img)}" alt="动态图片">
                </div>
              `).join('')}
            </div>
          ` : ''}
          <!-- [区域标注] 动态互动栏（点赞/评论数） -->
          <div class="moments-item__actions">
            <button class="moments-action-btn" data-action="moment-like" data-moment-id="${m.id}">
              ${ICONS.like}
              <span>${m.likes || 0}</span>
            </button>
            <button class="moments-action-btn" data-action="moment-comment" data-moment-id="${m.id}">
              ${ICONS.comment}
              <span>${(m.comments || []).length}</span>
            </button>
          </div>
          <!-- [区域标注] 评论区域 -->
          ${(m.comments && m.comments.length > 0) ? `
            <div class="moments-item__comments">
              ${m.comments.map(c => `
                <div class="moments-comment">
                  <span class="moments-comment__author">${escapeHtml(c.authorName || '匿名')}：</span>
                  <span class="moments-comment__text">${escapeHtml(c.content || '')}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
