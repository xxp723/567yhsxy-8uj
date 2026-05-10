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
  bookmark: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 6h24v36L24 34L12 42V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 返回图标 */
  back: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 发送图标 */
  send: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M44 24L4 6l8 18l-8 18l40-18Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M12 24h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 图片图标 */
  image: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="6" y="8" width="36" height="32" rx="3" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="19" r="3" stroke="currentColor" stroke-width="3"/><path d="M41 33l-11-11l-14 14" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 链接图标 */
  link: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M19 25l10-10a7 7 0 1 1 10 10L29 35" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M29 23L19 33a7 7 0 1 1-10-10L19 13" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 分享图标 */
  share: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="12" cy="24" r="4" stroke="currentColor" stroke-width="3"/><circle cx="36" cy="12" r="4" stroke="currentColor" stroke-width="3"/><circle cx="36" cy="36" r="4" stroke="currentColor" stroke-width="3"/><path d="M15.5 22.5L32.5 13.5M15.5 25.5l17 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 可见范围图标 */
  visible: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 12C13 12 6.5 24 6.5 24S13 36 24 36s17.5-12 17.5-12S35 12 24 12Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="24" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈独立发帖页] 关闭/删除图标 */
  close: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
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

function renderComposeAvatar(name, avatar) {
  const safeName = escapeHtml(name || '当前身份');
  return avatar
    ? `<img src="${escapeHtml(avatar)}" alt="${safeName}">`
    : `<span>${escapeHtml(getInitial(name))}</span>`;
}

function renderComposeImages(images) {
  const list = Array.isArray(images) ? images.filter(item => item?.src).slice(0, 9) : [];
  if (!list.length) {
    return `
      <div class="moments-compose-empty">
        <span class="moments-compose-empty__icon">${ICONS.image}</span>
        <p class="moments-compose-empty__text">支持添加本地图片或 URL 图片，图文可一起发布。</p>
      </div>
    `;
  }

  return `
    <div class="moments-compose-image-grid">
      ${list.map((image, index) => `
        <div class="moments-compose-image-card">
          <img src="${escapeHtml(image.src)}" alt="待发布图片 ${index + 1}">
          <button
            class="moments-compose-image-card__remove"
            type="button"
            data-action="remove-moments-compose-image"
            data-image-id="${escapeHtml(image.id || '')}"
            aria-label="删除图片">
            ${ICONS.close}
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈独立发帖页] 独立发帖页渲染
   参数：
   - draft — 当前发帖草稿（仅运行时）
   - options.profile — 当前已开启用户面具身份资料
   - options.shareTargetName — 已选择的聊天联系人名
   - options.visibilityLabel — 当前可见范围文案
   说明：
   1. 仅负责渲染发帖页，不包含任何持久化存储逻辑。
   2. 发帖身份固定为当前已开启用户面具身份，不提供其它身份切换入口。
   3. 不使用 localStorage/sessionStorage，不使用原生浏览器弹窗/选择器。
   ========================================================================== */
export function renderMomentsComposePage(draft, options = {}) {
  const profile = options?.profile || {};
  const safeDraft = draft && typeof draft === 'object' ? draft : {};
  const text = String(safeDraft.text || '');
  const location = String(safeDraft.location || '').trim();
  const shareTargetName = String(options?.shareTargetName || '').trim();
  const visibilityLabel = String(options?.visibilityLabel || '公开').trim() || '公开';
  const maskName = profile?.nickname || profile?.name || '当前面具身份';
  const maskSignature = String(profile?.signature || '').trim();
  const imageCount = Array.isArray(safeDraft.images) ? safeDraft.images.filter(item => item?.src).length : 0;

  return `
    <!-- [区域标注·已完成·本次朋友圈独立发帖页] 朋友圈独立发帖页 -->
    <section class="moments-compose-page" aria-label="发布朋友圈">
      <header class="moments-compose-top-bar">
        <button class="moments-compose-top-bar__btn" type="button" data-action="moments-compose-back" aria-label="返回">
          ${ICONS.back}
        </button>
        <div class="moments-compose-top-bar__title-wrap">
          <h2 class="moments-compose-top-bar__title">发朋友圈</h2>
          <p class="moments-compose-top-bar__subtitle">仅使用当前已开启的用户面具身份</p>
        </div>
        <button class="moments-compose-top-bar__btn moments-compose-top-bar__btn--send" type="button" data-action="submit-moments-compose" aria-label="发送朋友圈">
          ${ICONS.send}
        </button>
      </header>

      <div class="moments-compose-scroll">
        <section class="moments-compose-identity">
          <span class="moments-compose-identity__avatar">${renderComposeAvatar(maskName, profile?.avatar || '')}</span>
          <div class="moments-compose-identity__meta">
            <strong class="moments-compose-identity__name">${escapeHtml(maskName)}</strong>
            <span class="moments-compose-identity__hint">${escapeHtml(maskSignature || '以当前用户面具身份发布动态')}</span>
          </div>
        </section>

        <section class="moments-compose-block">
          <div class="moments-compose-block__header">
            <h3>图片</h3>
            <span>${imageCount ? `${imageCount}/9` : '可选'}</span>
          </div>
          <div class="moments-compose-media-actions">
            <button class="moments-compose-media-btn" type="button" data-action="open-moments-compose-local-picker">
              ${ICONS.image}
              <span>本地图片</span>
            </button>
            <button class="moments-compose-media-btn" type="button" data-action="open-moments-compose-image-url-modal">
              ${ICONS.link}
              <span>URL 图片</span>
            </button>
          </div>
          <input class="moments-compose-file-input" data-role="moments-compose-local-input" type="file" accept="image/*">
          ${renderComposeImages(safeDraft.images)}
        </section>

        <section class="moments-compose-block">
          <div class="moments-compose-block__header">
            <h3>文字</h3>
            <span>支持纯文本或图文一起发</span>
          </div>
          <textarea
            class="moments-compose-textarea"
            data-role="moments-compose-textarea"
            placeholder="这一刻想分享点什么？"
          >${escapeHtml(text)}</textarea>
        </section>

        <section class="moments-compose-block">
          <div class="moments-compose-options">
            <button class="moments-compose-option" type="button" data-action="open-moments-compose-location-modal">
              <span class="moments-compose-option__icon">${ICONS.location}</span>
              <span class="moments-compose-option__label">所在地点</span>
              <span class="moments-compose-option__value">${escapeHtml(location || '点击添加地点')}</span>
            </button>

            <button class="moments-compose-option" type="button" data-action="open-moments-compose-share-modal">
              <span class="moments-compose-option__icon">${ICONS.share}</span>
              <span class="moments-compose-option__label">分享帖子</span>
              <span class="moments-compose-option__value">${escapeHtml(shareTargetName || '不分享到聊天')}</span>
            </button>

            <button class="moments-compose-option" type="button" data-action="open-moments-compose-visibility-modal">
              <span class="moments-compose-option__icon">${ICONS.visible}</span>
              <span class="moments-compose-option__label">可见范围</span>
              <span class="moments-compose-option__value">${escapeHtml(visibilityLabel)}</span>
            </button>
          </div>
        </section>
      </div>
    </section>
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
