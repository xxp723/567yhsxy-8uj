// @ts-nocheck
/**
 * 文件名: js/apps/chat/moments.js
 * 用途: 闲谈应用 — 朋友圈板块
 *       Editorial Minimal UI 风格朋友圈渲染，不包含任何持久化存储逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] IconPark 风格图标 SVG 定义
   说明：
   1. 图标均采用 IconPark/字节跳动开源图标的线性风格语义。
   2. 本文件仅内联渲染 SVG，不引入额外依赖。
   ========================================================================== */
const ICONS = {
  /* [区域标注·已完成·本次朋友圈编辑风改造] 点赞/爱心图标 */
  like: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A11.007 11.007 0 0 0 15 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 评论图标 */
  comment: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 图片图标 */
  image: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="2" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="20" r="4" stroke="currentColor" stroke-width="3"/><path d="M42 34L32 24l-8 8l-4-4l-14 12" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 朋友圈空状态图标 */
  earth: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c-5.333 6.667-8 13.333-8 20s2.667 13.333 8 20c5.333-6.667 8-13.333 8-20s-2.667-13.333-8-20Z" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 发布/发送图标 */
  send: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M44 6L22 28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 6L30 42L22 28L6 20L44 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 位置图标 */
  location: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 44S40 30 40 18A16 16 0 1 0 8 18C8 30 24 44 24 44Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="18" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 可见范围/公开图标 */
  globe: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c5 5.5 7.5 12.167 7.5 20S29 38.5 24 44C19 38.5 16.5 31.833 16.5 24S19 9.5 24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 收藏图标 */
  bookmark: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 6h24v36L24 34L12 42V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈编辑风改造] 更多图标 */
  more: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 安全文本与时间工具
   说明：
   1. 仅做渲染所需的 HTML 转义，不做长文本/大媒体字段过滤。
   2. 本区域不读写 localStorage/sessionStorage，也不触碰 IndexedDB。
   ========================================================================== */
function escapeHtml(text) {
  const map = {
    '&': '\u0026amp;',
    '<': '\u0026lt;',
    '>': '\u0026gt;',
    '"': '\u0026quot;',
    "'": '\u0026#39;'
  };
  return String(text ?? '').replace(/[&<>"']/g, c => map[c] || c);
}

function normalizeTimestamp(ts) {
  if (!ts) return 0;
  const value = typeof ts === 'number' ? ts : Date.parse(ts);
  if (!Number.isFinite(value)) return 0;
  return value > 0 && value < 10000000000 ? value * 1000 : value;
}

function formatTimeAgo(ts) {
  const time = normalizeTimestamp(ts);
  if (!time) return '刚刚';

  const diff = Math.max(0, Date.now() - time);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;

  return new Date(time).toLocaleDateString();
}

function getInitial(name) {
  const chars = Array.from(String(name || '?').trim());
  return (chars[0] || '?').toUpperCase();
}

function getCount(value) {
  if (Array.isArray(value)) return value.length;
  const num = Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 顶部杂志风标题区渲染
   ========================================================================== */
function renderEditorialHero(count) {
  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 顶部杂志风标题区 -->
    <section class="moments-editorial-hero" aria-label="朋友圈概览">
      <p class="moments-editorial-hero__eyebrow">SOCIAL EDITION</p>
      <div class="moments-editorial-hero__main">
        <h2 class="moments-editorial-hero__title">Moments</h2>
        <div class="moments-editorial-hero__meta">
          <span class="moments-editorial-hero__count">${count}</span>
          <span>stories<br>in feed</span>
        </div>
      </div>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈可复用控件] 静态发布入口渲染
   说明：
   1. 仅展示朋友圈发布入口视觉样式，不绑定真实发布/上传逻辑。
   2. 文本输入使用极简下划线样式，不使用浏览器原生弹窗或选择器。
   ========================================================================== */
function renderComposeCard() {
  return `
    <!-- [区域标注·已完成·本次朋友圈可复用控件] 静态发布入口 -->
    <section class="moments-compose-card" aria-label="朋友圈发布入口">
      <div class="moments-compose-card__top">
        <span class="moments-compose-card__icon">${ICONS.send}</span>
        <div class="moments-compose-card__field">
          <input class="moments-underline-input" type="text" placeholder="Write a quiet update..." aria-label="朋友圈发布占位输入" readonly>
        </div>
      </div>
      <div class="moments-compose-card__tools">
        <div class="moments-tool-row" aria-label="发布工具">
          <button class="moments-tool-chip" type="button" aria-label="添加图片">
            ${ICONS.image}
            <span>Photo</span>
          </button>
          <button class="moments-tool-chip" type="button" aria-label="添加位置">
            ${ICONS.location}
            <span>Place</span>
          </button>
          <button class="moments-tool-chip" type="button" aria-label="公开可见">
            ${ICONS.globe}
            <span>Public</span>
          </button>
        </div>
        <button class="moments-switch is-on" type="button" aria-label="朋友圈公开开关" aria-pressed="true"></button>
      </div>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈可复用控件] 基础控件展示区渲染
   说明：
   1. 分段按钮、单选按钮、滑动开关仅作为可复用视觉基础，不接入真实筛选/隐私逻辑。
   2. 点击时由 CSS 提供按压反馈；当前选中态为静态示例。
   ========================================================================== */
function renderControlLab() {
  return `
    <!-- [区域标注·已完成·本次朋友圈可复用控件] 控件展示区 -->
    <section class="moments-control-lab" aria-label="朋友圈基础控件">
      <div class="moments-control-lab__row">
        <span class="moments-control-lab__label">VIEW</span>
        <div class="moments-segmented-control" role="group" aria-label="动态筛选示例">
          <button class="moments-segmented-btn is-active" type="button" aria-pressed="true">All</button>
          <button class="moments-segmented-btn" type="button" aria-pressed="false">Friends</button>
          <button class="moments-segmented-btn" type="button" aria-pressed="false">Mine</button>
        </div>
      </div>
      <div class="moments-control-lab__row">
        <span class="moments-control-lab__label">PRIVACY</span>
        <div class="moments-radio-group" role="radiogroup" aria-label="可见范围示例">
          <button class="moments-radio-option is-active" type="button" role="radio" aria-checked="true">
            <span class="moments-radio-dot"></span>
            <span>Public</span>
          </button>
          <button class="moments-radio-option" type="button" role="radio" aria-checked="false">
            <span class="moments-radio-dot"></span>
            <span>Close</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 头像/图片/评论局部渲染
   ========================================================================== */
function renderAvatar(authorName, authorAvatar) {
  const safeName = escapeHtml(authorName || '未命名');

  return `
    <span class="moments-avatar" aria-label="${safeName}">
      ${authorAvatar
        ? `<img src="${escapeHtml(authorAvatar)}" alt="${safeName}">`
        : `<span>${escapeHtml(getInitial(authorName))}</span>`}
    </span>
  `;
}

function renderImageGrid(images) {
  const safeImages = Array.isArray(images) ? images.slice(0, 9).filter(Boolean) : [];
  if (safeImages.length === 0) return '';

  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 动态图片区域 -->
    <div class="moments-card__images moments-card__images--${safeImages.length}">
      ${safeImages.map((img, index) => `
        <div class="moments-card__image-wrap">
          <img src="${escapeHtml(img)}" alt="动态图片 ${index + 1}">
        </div>
      `).join('')}
    </div>
  `;
}

function renderComments(comments) {
  const list = Array.isArray(comments) ? comments : [];
  if (list.length === 0) return '';

  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 评论区域 -->
    <div class="moments-comments">
      ${list.map(c => `
        <div class="moments-comment">
          <span class="moments-comment__author">${escapeHtml(c.authorName || '匿名')}：</span>
          <span class="moments-comment__text">${escapeHtml(c.content || '')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 单条动态卡片渲染
   说明：保留 moment-like / moment-comment data-action，兼容现有事件委托。
   ========================================================================== */
function renderMomentCard(moment) {
  const id = escapeHtml(moment?.id ?? '');
  const authorName = moment?.authorName || '未命名';
  const content = escapeHtml(moment?.content || '');
  const comments = Array.isArray(moment?.comments) ? moment.comments : [];
  const likeCount = getCount(moment?.likes);
  const commentCount = comments.length;
  const subline = escapeHtml(moment?.location || 'Daily note · Public');

  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 朋友圈动态卡片 -->
    <article class="moments-card" data-moment-id="${id}">
      <header class="moments-card__header">
        ${renderAvatar(authorName, moment?.authorAvatar)}
        <div class="moments-card__author">
          <div class="moments-card__name-row">
            <span class="moments-card__name">${escapeHtml(authorName)}</span>
            <span class="moments-card__time">${escapeHtml(formatTimeAgo(moment?.createdAt))}</span>
          </div>
          <div class="moments-card__subline">
            ${ICONS.location}
            <span>${subline}</span>
          </div>
        </div>
      </header>

      <div class="moments-card__body">
        ${content ? `<p class="moments-card__content">${content}</p>` : ''}
        ${renderImageGrid(moment?.images)}
      </div>

      <!-- [区域标注·已完成·本次朋友圈编辑风改造] 互动栏（保留原 data-action） -->
      <div class="moments-card__actions">
        <div class="moments-card__action-group">
          <button class="moments-action-btn" type="button" data-action="moment-like" data-moment-id="${id}" aria-label="点赞">
            ${ICONS.like}
            <span>${likeCount}</span>
          </button>
          <button class="moments-action-btn" type="button" data-action="moment-comment" data-moment-id="${id}" aria-label="评论">
            ${ICONS.comment}
            <span>${commentCount}</span>
          </button>
        </div>
        <button class="moments-action-btn moments-action-btn--quiet" type="button" aria-label="收藏">
          ${ICONS.bookmark}
        </button>
      </div>

      ${renderComments(comments)}
    </article>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 空状态渲染
   ========================================================================== */
function renderEmptyState() {
  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 朋友圈空状态 -->
    <div class="moments-empty-state">
      ${renderEditorialHero(0)}
      ${renderComposeCard()}
      ${renderControlLab()}
      <div class="moments-divider" aria-hidden="true"></div>
      <div class="moments-empty-state__body">
        <span class="moments-empty-state__icon">${ICONS.earth}</span>
        <h3 class="moments-empty-state__title">No stories yet</h3>
        <p class="moments-empty-state__text">暂无朋友圈动态。好友发布动态后，将以极简杂志版式显示在这里。</p>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈编辑风改造] 渲染朋友圈 HTML
   参数：moments — 动态数组 [{id, authorName, authorAvatar, content, images, likes, comments, createdAt}]
   说明：
   1. 只负责朋友圈页面渲染，不包含存储读写。
   2. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   3. 不使用原生浏览器弹窗/选择器。
   ========================================================================== */
export function renderMoments(moments) {
  const list = Array.isArray(moments) ? moments : [];

  if (list.length === 0) {
    return renderEmptyState();
  }

  return `
    <!-- [区域标注·已完成·本次朋友圈编辑风改造] 朋友圈页面容器 -->
    <div class="moments-page" aria-label="朋友圈">
      ${renderEditorialHero(list.length)}
      ${renderComposeCard()}
      ${renderControlLab()}
      <div class="moments-divider" aria-hidden="true"></div>

      <!-- [区域标注·已完成·本次朋友圈编辑风改造] 朋友圈动态列表 -->
      <div class="moments-feed">
        ${list.map(renderMomentCard).join('')}
      </div>
    </div>
  `;
}
