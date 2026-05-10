// @ts-nocheck
/**
 * 文件名: js/apps/chat/moments.js
 * 用途: 闲谈应用 — 朋友圈板块
 *       Instagram-like Story Strip / Feed 风格朋友圈渲染，不包含任何持久化存储逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] IconPark 风格图标 SVG 定义
   说明：
   1. 图标均采用 IconPark/字节跳动开源图标的线性风格语义。
   2. 本文件仅内联渲染 SVG，不引入额外依赖。
   ========================================================================== */
const ICONS = {
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 点赞/爱心图标 */
  like: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A11.007 11.007 0 0 0 15 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 评论图标 */
  comment: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈空状态图标 */
  earth: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c-5.333 6.667-8 13.333-8 20s2.667 13.333 8 20c5.333-6.667 8-13.333 8-20s-2.667-13.333-8-20Z" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 位置图标 */
  location: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 44S40 30 40 18A16 16 0 1 0 8 18C8 30 24 44 24 44Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="18" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 收藏图标 */
  bookmark: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 6h24v36L24 34L12 42V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 安全文本、时间与排序工具
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

function normalizeAddedAt(value) {
  const time = normalizeTimestamp(value);
  return Number.isFinite(time) ? time : 0;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈标题栏下方头像横滑栏] 仿 Instagram 头像栏渲染
   说明：
   1. 第一枚头像固定渲染当前已开启用户面具身份头像，不提供删除入口。
   2. 后续头像由 index.js 传入 state.contacts 运行时渲染，不新增任何持久化读写。
   3. 联系人按 addedAt 从旧到新由左向右排列；最新添加项位于更右侧，满足从右往左查看添加顺序。
   ========================================================================== */
function renderStoryAvatar(name, avatar, isSelf = false) {
  const safeName = escapeHtml(name || (isSelf ? '我的主页' : '未命名'));
  const label = isSelf ? `当前身份：${safeName}` : `联系人：${safeName}`;

  return `
    <div class="moments-story-avatar ${isSelf ? 'moments-story-avatar--self' : ''}" role="listitem" aria-label="${label}" title="${safeName}">
      <span class="moments-story-avatar__ring" aria-hidden="true">
        ${avatar
          ? `<img src="${escapeHtml(avatar)}" alt="">`
          : `<span class="moments-story-avatar__initial">${escapeHtml(getInitial(name))}</span>`}
      </span>
      <span class="moments-story-avatar__name">${safeName}</span>
    </div>
  `;
}

function renderMomentsStories(profile, contacts) {
  const selfName = profile?.nickname || profile?.name || '我的主页';
  const selfAvatar = profile?.avatar || '';
  const sortedContacts = (Array.isArray(contacts) ? contacts : [])
    .filter(contact => contact && (contact.name || contact.nickname || contact.contact || contact.avatar))
    .slice()
    .sort((a, b) => {
      const diff = normalizeAddedAt(a?.addedAt) - normalizeAddedAt(b?.addedAt);
      if (diff !== 0) return diff;
      return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), 'zh-Hans-CN');
    });

  return `
    <!-- [区域标注·已完成·本次朋友圈标题栏下方头像横滑栏] 仿 Instagram 横向头像列表 -->
    <section class="moments-story-strip" aria-label="朋友圈头像列表">
      <div class="moments-story-strip__scroller" role="list">
        ${renderStoryAvatar(selfName, selfAvatar, true)}
        ${sortedContacts.map(contact => renderStoryAvatar(
          contact?.name || contact?.nickname || contact?.contact || '未命名',
          contact?.avatar || '',
          false
        )).join('')}
      </div>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 头像/图片/评论局部渲染
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
    <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 动态图片区域 -->
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
    <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 评论区域 -->
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
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 单条动态卡片渲染
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
    <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈动态卡片 -->
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

      <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 互动栏（保留原 data-action） -->
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
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 空状态渲染
   ========================================================================== */
function renderEmptyState(profile, contacts) {
  return `
    <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈页面容器与空状态 -->
    <div class="moments-page" aria-label="朋友圈">
      ${renderMomentsStories(profile, contacts)}
      <div class="moments-empty-state">
        <div class="moments-empty-state__body">
          <span class="moments-empty-state__icon">${ICONS.earth}</span>
          <h3 class="moments-empty-state__title">No stories yet</h3>
          <p class="moments-empty-state__text">暂无朋友圈动态。好友发布动态后，将以极简杂志版式显示在这里。</p>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 渲染朋友圈 HTML
   参数：
   - moments — 动态数组 [{id, authorName, authorAvatar, content, images, likes, comments, createdAt}]
   - options.profile — 当前已开启用户面具身份资料
   - options.contacts — 当前通讯录联系人数组
   说明：
   1. 只负责朋友圈页面渲染，不包含存储读写。
   2. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   3. 不使用原生浏览器弹窗/选择器。
   ========================================================================== */
export function renderMoments(moments, options = {}) {
  const list = Array.isArray(moments) ? moments : [];
  const profile = options?.profile || {};
  const contacts = Array.isArray(options?.contacts) ? options.contacts : [];

  if (list.length === 0) {
    return renderEmptyState(profile, contacts);
  }

  return `
    <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈页面容器 -->
    <div class="moments-page" aria-label="朋友圈">
      ${renderMomentsStories(profile, contacts)}

      <!-- [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈动态列表 -->
      <div class="moments-feed">
        ${list.map(renderMomentCard).join('')}
      </div>
    </div>
  `;
}
