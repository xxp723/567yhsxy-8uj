// @ts-nocheck
/**
 * 文件名: js/apps/chat/moments.js
 * 用途: 闲谈应用 — 朋友圈板块
 *       Instagram-like Story Strip / Feed 风格朋友圈渲染，不包含任何持久化存储逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

import { TAB_ICONS, ICON_CHECK } from './chat-utils.js';
import { getVisibleChatSessions } from './chat-list.js';

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] IconPark 风格图标 SVG 定义
   说明：
   1. 图标均采用 IconPark/字节跳动开源图标的线性风格语义。
   2. 本文件仅内联渲染 SVG，不引入额外依赖。
   ========================================================================== */
const ICONS = {
  /* [区域标注·已完成·本次朋友圈动态 Ins 风格互动栏] 点赞/爱心图标 */
  like: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A11.007 11.007 0 0 0 15 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈动态 Ins 风格互动栏] 评论图标 */
  comment: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 40c9.941 0 18-7.163 18-16S33.941 8 24 8S6 15.163 6 24c0 4.144 1.774 7.922 4.686 10.763L9 42l7.543-3.534A19.837 19.837 0 0 0 24 40Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 朋友圈空状态图标 */
  earth: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M4 24h40M24 4c-5.333 6.667-8 13.333-8 20s2.667 13.333 8 20c5.333-6.667 8-13.333 8-20s-2.667-13.333-8-20Z" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 位置图标 */
  location: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 44S40 30 40 18A16 16 0 1 0 8 18C8 30 24 44 24 44Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="24" cy="18" r="5" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·本次朋友圈动态 Ins 风格互动栏] 收藏图标 */
  bookmark: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 6h24v36L24 34L12 42V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈动态 Ins 风格互动栏] 转发图标 */
  repost: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M34 8l6 6l-6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 22v-2a6 6 0 0 1 6-6h26" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 40l-6-6l6-6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 26v2a6 6 0 0 1-6 6H8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·本次朋友圈动态 Ins 风格互动栏] 分享图标（纸飞机） */
  feedShare: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M44 6L24 42l-4-18L4 17L44 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 24L44 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
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
  close: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·已完成·朋友圈发布后 AI 即时互动与评论删除] 删除评论图标（IconPark 风格） */
  deleteComment: `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 11h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 11V7h10v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11l2 30h16l2-30" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M21 20v12M27 20v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·本次朋友圈独立发帖页] 发帖页运行时常量
   ========================================================================== */
export const MOMENTS_COMPOSE_MAX_IMAGES = 9;

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
/* ==========================================================================
   [区域标注·已完成·本次朋友圈头像点击切换动态范围] 头像栏渲染与动态范围切换入口
   说明：
   1. 当前用户头像点击后恢复显示“用户 + 全部联系人”的全部朋友圈动态。
   2. 联系人头像点击后仅显示该联系人的朋友圈动态；再次点击同一联系人头像时取消筛选。
   3. 本区域只维护运行时筛选入口，不新增任何持久化存储读写。
   ========================================================================== */
function renderStoryAvatar(name, avatar, isSelf = false, options = {}) {
  const safeName = escapeHtml(name || (isSelf ? '我的主页' : '未命名'));
  const contactId = String(options?.contactId || '').trim();
  const isSelected = !!options?.isSelected;

  if (isSelf) {
    return `
      <button
        class="moments-story-avatar moments-story-avatar--self ${isSelected ? 'moments-story-avatar--selected' : ''}"
        type="button"
        role="listitem"
        data-action="show-all-moments"
        aria-pressed="${isSelected ? 'true' : 'false'}"
        aria-label="显示全部朋友圈动态：${safeName}"
        title="${safeName}">
        <span class="moments-story-avatar__ring" aria-hidden="true">
          ${avatar
            ? `<img src="${escapeHtml(avatar)}" alt="">`
            : `<span class="moments-story-avatar__initial">${escapeHtml(getInitial(name))}</span>`}
        </span>
        <span class="moments-story-avatar__name">${safeName}</span>
      </button>
    `;
  }

  if (!contactId) {
    return `
      <div class="moments-story-avatar" role="listitem" aria-label="联系人：${safeName}" title="${safeName}">
        <span class="moments-story-avatar__ring" aria-hidden="true">
          ${avatar
            ? `<img src="${escapeHtml(avatar)}" alt="">`
            : `<span class="moments-story-avatar__initial">${escapeHtml(getInitial(name))}</span>`}
        </span>
        <span class="moments-story-avatar__name">${safeName}</span>
      </div>
    `;
  }

  return `
    <button
      class="moments-story-avatar moments-story-avatar--filter ${isSelected ? 'moments-story-avatar--selected' : ''}"
      type="button"
      role="listitem"
      data-action="filter-moments-by-contact"
      data-contact-id="${escapeHtml(contactId)}"
      aria-pressed="${isSelected ? 'true' : 'false'}"
      aria-label="只显示联系人朋友圈动态：${safeName}"
      title="${safeName}">
      <span class="moments-story-avatar__ring" aria-hidden="true">
        ${avatar
          ? `<img src="${escapeHtml(avatar)}" alt="">`
          : `<span class="moments-story-avatar__initial">${escapeHtml(getInitial(name))}</span>`}
      </span>
      <span class="moments-story-avatar__name">${safeName}</span>
    </button>
  `;
}

function renderMomentsStories(profile, contacts, options = {}) {
  const selfName = profile?.nickname || profile?.name || '我的主页';
  const selfAvatar = profile?.avatar || '';
  const activeFilterId = String(options?.activeContactFilterId || '').trim();
  const sortedContacts = (Array.isArray(contacts) ? contacts : [])
    .filter(contact => contact && (contact.name || contact.nickname || contact.contact || contact.avatar))
    .slice()
    .sort((a, b) => {
      const diff = normalizeAddedAt(a?.addedAt) - normalizeAddedAt(b?.addedAt);
      if (diff !== 0) return diff;
      return String(a?.id ?? '').localeCompare(String(b?.id ?? ''), 'zh-Hans-CN');
    });

  return `
    <!-- [区域标注·已完成·本次朋友圈头像点击切换动态范围] 仿 Instagram 横向头像列表与动态范围切换入口 -->
    <section class="moments-story-strip" aria-label="朋友圈头像列表">
      <div class="moments-story-strip__scroller" role="list">
        ${renderStoryAvatar(selfName, selfAvatar, true, { isSelected: !activeFilterId })}
        ${sortedContacts.map(contact => {
          const contactId = String(contact?.id || contact?.roleId || '').trim();
          return renderStoryAvatar(
            contact?.name || contact?.nickname || contact?.contact || '未命名',
            contact?.avatar || '',
            false,
            {
              contactId,
              isSelected: !!contactId && contactId === activeFilterId
            }
          );
        }).join('')}
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

/* ==========================================================================
   [区域标注·已完成·本次朋友圈个别人可见名单显示] 动态右上角可见联系人渲染工具
   说明：
   1. 仅根据动态里的 visibleContactIds 与当前通讯录 contacts 做运行时匹配。
   2. visibleContactNames 仅作为已发布动态的姓名快照兜底展示，不新增任何存储通道。
   3. 本区域不包含任何持久化存储读写，不使用 localStorage/sessionStorage。
   ========================================================================== */
function getMomentVisibleContactNames(moment, contacts = []) {
  if (String(moment?.visibilityMode || 'public') !== 'contacts') return [];

  const visibleSet = new Set(
    (Array.isArray(moment?.visibleContactIds) ? moment.visibleContactIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  );

  const matchedNames = (Array.isArray(contacts) ? contacts : [])
    .filter(contact => {
      const contactId = String(contact?.id || '').trim();
      const roleId = String(contact?.roleId || '').trim();
      return visibleSet.has(contactId) || visibleSet.has(roleId);
    })
    .map(contact => String(contact?.name || contact?.nickname || contact?.contact || '').trim())
    .filter(Boolean);

  const storedNames = Array.isArray(moment?.visibleContactNames)
    ? moment.visibleContactNames.map(name => String(name || '').trim()).filter(Boolean)
    : [];

  return Array.from(new Set([...matchedNames, ...storedNames]));
}

function renderMomentVisibleContactsBadge(moment, contacts = []) {
  const names = getMomentVisibleContactNames(moment, contacts);
  if (!names.length) return '';

  const label = `可见：${names.join('、')}`;
  return `
    <div class="moments-card__visibility-badge" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
      ${ICONS.visible}
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·朋友圈发布后 AI 即时互动与评论删除] 点赞、评论、回复与删除渲染工具
   说明：
   1. 本区域只生成 DOM 字符串，不包含任何持久化存储读写。
   2. 点赞/评论/回复/删除数据由 index.js 通过 DB.js/IndexedDB 统一保存。
   3. 评论删除按钮仅渲染 IconPark 风格图标，不使用文字按钮，不使用原生浏览器弹窗。
   4. 不使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
function getViewerId(options = {}) {
  return String(options?.viewerId || options?.profile?.id || options?.profile?.maskId || options?.profile?.name || 'self').trim() || 'self';
}

function isLikedByViewer(likes, viewerId) {
  const safeViewerId = String(viewerId || '').trim();
  if (!safeViewerId) return false;

  if (Array.isArray(likes)) {
    return likes.some(item => {
      if (typeof item === 'string' || typeof item === 'number') return String(item) === safeViewerId;
      return String(item?.id || item?.viewerId || item?.authorId || '') === safeViewerId;
    });
  }

  return false;
}

function getCommentTotal(comments) {
  const list = Array.isArray(comments) ? comments : [];
  return list.reduce((total, comment) => {
    const replies = Array.isArray(comment?.replies) ? comment.replies.length : 0;
    return total + 1 + replies;
  }, 0);
}

function renderCommentReplies(replies) {
  const list = Array.isArray(replies) ? replies : [];
  if (!list.length) return '';

  return `
    <div class="moments-comment__replies">
      ${list.map(reply => `
        <div class="moments-comment-reply">
          <span class="moments-comment__author">${escapeHtml(reply?.authorName || '匿名')}：</span>
          <span class="moments-comment__text">${escapeHtml(reply?.content || '')}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderComments(comments, options = {}) {
  const list = Array.isArray(comments) ? comments : [];
  const momentId = escapeHtml(options?.momentId ?? '');
  const isExpanded = !!options?.isExpanded;
  if (!isExpanded && list.length === 0) return '';

  const replyTarget = options?.replyTarget || null;
  const replyTargetCommentId = String(replyTarget?.commentId || '');
  const replyTargetName = String(replyTarget?.authorName || '').trim();
  const placeholder = replyTargetCommentId
    ? `回复 ${replyTargetName || '这条评论'}…`
    : '写下你的评论…';

  return `
    <!-- [区域标注·已完成·朋友圈发布后 AI 即时互动与评论删除] 评论列表、评论输入框、回复入口与单条删除图标 -->
    <div class="moments-comments ${isExpanded ? 'moments-comments--expanded' : ''}">
      ${list.length ? list.map(c => {
        const commentId = escapeHtml(c?.id ?? '');
        const isReplying = replyTargetCommentId && String(c?.id || '') === replyTargetCommentId;
        return `
          <div class="moments-comment ${isReplying ? 'moments-comment--replying' : ''}">
            <div class="moments-comment__main">
              <span class="moments-comment__body">
                <span class="moments-comment__author">${escapeHtml(c?.authorName || '匿名')}：</span>
                <span class="moments-comment__text">${escapeHtml(c?.content || '')}</span>
              </span>
              <button
                class="moments-comment__reply-btn"
                type="button"
                data-action="moment-reply-comment"
                data-moment-id="${momentId}"
                data-comment-id="${commentId}"
                data-comment-author="${escapeHtml(c?.authorName || '匿名')}"
                aria-label="回复 ${escapeHtml(c?.authorName || '这条评论')}">
                回复
              </button>
              <button
                class="moments-comment__delete-btn"
                type="button"
                data-action="moment-delete-comment"
                data-moment-id="${momentId}"
                data-comment-id="${commentId}"
                aria-label="删除 ${escapeHtml(c?.authorName || '这条评论')} 的评论">
                ${ICONS.deleteComment}
              </button>
            </div>
            ${renderCommentReplies(c?.replies)}
          </div>
        `;
      }).join('') : '<p class="moments-comments__empty">还没有评论，来说点什么吧。</p>'}

      ${isExpanded ? `
        <div class="moments-comment-composer" data-moment-id="${momentId}">
          ${replyTargetCommentId ? `
            <div class="moments-comment-composer__replying">
              <span>正在回复 ${escapeHtml(replyTargetName || '这条评论')}</span>
              <button class="moments-comment-composer__cancel" type="button" data-action="cancel-moment-reply" data-moment-id="${momentId}" aria-label="取消回复">取消</button>
            </div>
          ` : ''}
          <div class="moments-comment-composer__row">
            <textarea
              class="moments-comment-composer__input"
              data-role="moment-comment-input"
              data-moment-id="${momentId}"
              rows="1"
              placeholder="${escapeHtml(placeholder)}"></textarea>
            <button
              class="moments-comment-composer__send"
              type="button"
              data-action="submit-moment-comment"
              data-moment-id="${momentId}"
              aria-label="发送评论">
              ${ICONS.send}
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈分享转发删除互动] 转发动态预览渲染
   说明：
   1. 仅在朋友圈动态卡片内部渲染转发来源摘要，不包含任何持久化存储读写。
   2. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
function renderMomentRepostPreview(moment) {
  const sourceMomentId = String(moment?.repostSourceMomentId || '').trim();
  if (!sourceMomentId) return '';

  const sourceAuthorName = String(moment?.repostSourceAuthorName || '原动态作者').trim() || '原动态作者';
  const sourceContent = String(moment?.repostSourceContent || '').trim();
  const sourceLocation = String(moment?.repostSourceLocation || '').trim();
  const sourceTimeText = formatTimeAgo(moment?.repostSourceCreatedAt);
  const sourceImages = Array.isArray(moment?.repostSourceImages)
    ? moment.repostSourceImages.map(item => String(item || '').trim()).filter(Boolean).slice(0, 9)
    : [];

  return `
    <!-- [区域标注·已完成·本次朋友圈分享转发删除互动] 转发来源动态预览 -->
    <div class="moments-card__repost-preview" aria-label="转发来源动态">
      <div class="moments-card__repost-meta">
        <strong>${escapeHtml(sourceAuthorName)}</strong>
        <span>${escapeHtml(sourceTimeText)}</span>
      </div>
      ${sourceContent ? `<p class="moments-card__repost-text">${escapeHtml(sourceContent)}</p>` : ''}
      ${sourceLocation ? `<p class="moments-card__repost-location">@${escapeHtml(sourceLocation)}</p>` : ''}
      ${renderImageGrid(sourceImages)}
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈分享转发删除互动] 单条动态卡片渲染
   说明：保留 moment-like / moment-comment data-action，并新增分享 / 转发 / 删除互动入口。
   ========================================================================== */
function renderMomentCard(moment, options = {}) {
  const id = escapeHtml(moment?.id ?? '');
  const rawId = String(moment?.id ?? '');
  const authorName = moment?.authorName || '未命名';
  const content = escapeHtml(moment?.content || '');
  const comments = Array.isArray(moment?.comments) ? moment.comments : [];
  const viewerId = getViewerId(options);
  const isLiked = isLikedByViewer(moment?.likes, viewerId);
  const likeCount = getCount(moment?.likes);
  const commentCount = getCommentTotal(comments);
  const repostCount = getCount(moment?.reposts ?? moment?.repostCount);
  const shareCount = getCount(moment?.shares ?? moment?.shareCount);
  const subline = escapeHtml(moment?.location || 'Daily note · Public');
  const visibilityNamesHtml = renderMomentVisibleContactsBadge(moment, options?.contacts);
  const expandedIds = Array.isArray(options?.expandedCommentIds) ? options.expandedCommentIds.map(item => String(item)) : [];
  const isCommentExpanded = expandedIds.includes(rawId);
  const replyTarget = options?.replyTarget && String(options.replyTarget.momentId || '') === rawId
    ? options.replyTarget
    : null;

  return `
    <!-- [区域标注·已完成·本次朋友圈点赞评论互动] 朋友圈动态卡片点赞/评论/回复互动 -->
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
        ${visibilityNamesHtml}
      </header>

      <div class="moments-card__body">
        ${content ? `<p class="moments-card__content">${content}</p>` : ''}
        ${renderImageGrid(moment?.images)}
        ${renderMomentRepostPreview(moment)}
      </div>

      <!-- [区域标注·已完成·本次朋友圈分享转发删除互动] 互动栏（点赞/评论保留原 data-action，并新增转发/分享/删除入口） -->
      <div class="moments-card__actions">
        <div class="moments-card__action-group" aria-label="动态互动">
          <button class="moments-action-btn ${isLiked ? 'moments-action-btn--liked' : ''}" type="button" data-action="moment-like" data-moment-id="${id}" aria-label="${isLiked ? '取消点赞' : '点赞'}" aria-pressed="${isLiked ? 'true' : 'false'}">
            ${ICONS.like}
            <span>${likeCount}</span>
          </button>
          <button class="moments-action-btn ${isCommentExpanded ? 'moments-action-btn--active' : ''}" type="button" data-action="moment-comment" data-moment-id="${id}" aria-label="评论" aria-expanded="${isCommentExpanded ? 'true' : 'false'}">
            ${ICONS.comment}
            <span>${commentCount}</span>
          </button>
          <button class="moments-action-btn" type="button" data-action="open-moment-repost-modal" data-moment-id="${id}" aria-label="转发">
            ${ICONS.repost}
            ${repostCount ? `<span>${repostCount}</span>` : ''}
          </button>
          <button class="moments-action-btn" type="button" data-action="open-moment-share-modal" data-moment-id="${id}" aria-label="分享">
            ${ICONS.feedShare}
            ${shareCount ? `<span>${shareCount}</span>` : ''}
          </button>
        </div>
        <button class="moments-action-btn moments-action-btn--bookmark" type="button" data-action="open-moment-delete-modal" data-moment-id="${id}" aria-label="删除动态">
          ${ICONS.bookmark}
        </button>
      </div>

      ${renderComments(comments, {
        momentId: rawId,
        isExpanded: isCommentExpanded,
        replyTarget
      })}
    </article>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈图1区域去除与头像横滑栏] 空状态渲染
   ========================================================================== */
function renderEmptyState(profile, contacts, options = {}) {
  const activeContactFilterId = String(options?.activeContactFilterId || '').trim();

  return `
    <!-- [区域标注·已完成·本次朋友圈联系人头像动态筛选] 朋友圈页面容器与空状态 -->
    <div class="moments-page" aria-label="朋友圈">
      ${renderMomentsStories(profile, contacts, { activeContactFilterId })}
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
   [区域标注·已完成·本次朋友圈独立发帖页] 草稿运行时工具
   说明：
   1. 仅处理草稿、文案、可见范围与发帖页/弹窗渲染。
   2. 不包含任何 IndexedDB 持久化写入。
   ========================================================================== */
export function createMomentsComposeDraft() {
  return {
    text: '',
    images: [],
    location: '',
    shareChatId: '',
    visibilityMode: 'public',
    visibleContactIds: []
  };
}

export function normalizeMomentsComposeDraft(draft) {
  const safeDraft = draft && typeof draft === 'object' ? draft : {};
  return {
    text: String(safeDraft.text || ''),
    images: Array.isArray(safeDraft.images)
      ? safeDraft.images
          .map((item, index) => ({
            id: String(item?.id || `moments_compose_image_${index + 1}`),
            src: String(item?.src || '').trim(),
            name: String(item?.name || '').trim()
          }))
          .filter(item => item.src)
          .slice(0, MOMENTS_COMPOSE_MAX_IMAGES)
      : [],
    location: String(safeDraft.location || '').trim(),
    shareChatId: String(safeDraft.shareChatId || '').trim(),
    visibilityMode: String(safeDraft.visibilityMode || 'public') === 'contacts' ? 'contacts' : 'public',
    visibleContactIds: Array.from(new Set(
      Array.isArray(safeDraft.visibleContactIds)
        ? safeDraft.visibleContactIds.map(id => String(id || '').trim()).filter(Boolean)
        : []
    ))
  };
}

export function ensureMomentsComposeDraft(state) {
  state.momentsComposeDraft = normalizeMomentsComposeDraft(state.momentsComposeDraft);
  return state.momentsComposeDraft;
}

function getMomentsComposeShareSessions(state) {
  return getVisibleChatSessions(state).filter(session => session && String(session.id || '').trim());
}

export function getMomentsComposeShareTarget(state) {
  const draft = ensureMomentsComposeDraft(state);
  return getMomentsComposeShareSessions(state).find(session => String(session.id) === String(draft.shareChatId)) || null;
}

export function getMomentsComposeShareTargetName(state) {
  const targetSession = getMomentsComposeShareTarget(state);
  if (!targetSession) return '';
  return String(targetSession.remark || targetSession.name || '').trim() || '未命名聊天';
}

export function getMomentsComposeVisibilityLabel(state) {
  const draft = ensureMomentsComposeDraft(state);
  if (draft.visibilityMode !== 'contacts') return '公开';

  const visibleSet = new Set(
    (Array.isArray(draft.visibleContactIds) ? draft.visibleContactIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  );

  const pickedNames = (Array.isArray(state.contacts) ? state.contacts : [])
    .filter(contact => {
      const contactId = String(contact?.id || '').trim();
      const roleId = String(contact?.roleId || '').trim();
      return visibleSet.has(contactId) || visibleSet.has(roleId);
    })
    .map(contact => String(contact?.name || contact?.nickname || contact?.contact || '').trim())
    .filter(Boolean);

  if (!pickedNames.length) return '通讯录中个别人能看';
  if (pickedNames.length <= 2) return `通讯录中个别人能看（${pickedNames.join('、')}）`;
  return `通讯录中个别人能看（${pickedNames.slice(0, 2).join('、')}等${pickedNames.length}人）`;
}

export function buildMomentsComposeShareMessage(draft) {
  const text = String(draft?.text || '').trim();
  const imageCount = Array.isArray(draft?.images) ? draft.images.filter(item => item?.src).length : 0;
  const location = String(draft?.location || '').trim();

  const summaryParts = [];
  if (text) summaryParts.push(text);
  if (imageCount > 0) summaryParts.push(`[图片x${imageCount}]`);
  if (location) summaryParts.push(`@${location}`);

  return summaryParts.length
    ? `我分享了一条朋友圈动态：${summaryParts.join(' ')}`
    : '我分享了一条朋友圈动态';
}

/* ==========================================================================
   [区域标注·已完成·朋友圈发布后 AI 即时互动与评论删除] 互动状态、事件处理与局部刷新
   说明：
   1. 本区域集中维护朋友圈点赞、评论展开、发表评论、回复评论与单条评论删除的主要逻辑。
   2. 本模块不直接 import DB.js，不直接调用 dbPut；持久化由 index.js 传入 persistMoments 回调接线。
   3. 评论删除不使用原生浏览器弹窗；点击 IconPark 删除图标后直接删除单条评论并局部刷新。
   4. 不使用 localStorage/sessionStorage，不写双份存储兜底，不做长文本字段过滤。
   ========================================================================== */
export function createMomentsInteractionState() {
  return {
    momentsExpandedCommentIds: [],
    momentsReplyTarget: null
  };
}

export function resetMomentsInteractionState(state) {
  if (!state) return;
  state.momentsExpandedCommentIds = [];
  state.momentsReplyTarget = null;
}

export function getMomentsViewerId(state) {
  return String(state?.activeMaskId || state?.profile?.id || state?.profile?.maskId || state?.profile?.name || 'self').trim() || 'self';
}

export function getMomentsViewerName(state) {
  return String(state?.profile?.nickname || state?.profile?.name || '当前面具身份').trim() || '当前面具身份';
}

export function getMomentsRenderOptions(state) {
  return {
    profile: state?.profile || {},
    contacts: Array.isArray(state?.contacts) ? state.contacts : [],
    viewerId: getMomentsViewerId(state),
    expandedCommentIds: Array.isArray(state?.momentsExpandedCommentIds) ? state.momentsExpandedCommentIds : [],
    replyTarget: state?.momentsReplyTarget || null,
    activeContactFilterId: String(state?.momentsContactFilterId || '').trim()
  };
}

function getMomentById(state, momentId) {
  const safeMomentId = String(momentId || '').trim();
  const list = Array.isArray(state?.moments) ? state.moments : [];
  const index = list.findIndex(moment => String(moment?.id || '') === safeMomentId);
  return { index, moment: index >= 0 ? list[index] : null };
}

function normalizeMomentLikes(likes) {
  if (Array.isArray(likes)) return likes.slice();
  const count = Math.max(0, Math.floor(Number(likes || 0)) || 0);
  return Array.from({ length: count }, (_, index) => ({
    id: `legacy_like_${index + 1}`,
    name: '已点赞'
  }));
}

export function refreshMomentsPanel(container, state, options = {}) {
  const panelEl = container?.querySelector?.('[data-panel="moments"]');
  if (!panelEl) return;

  const momentsPage = panelEl.querySelector('.moments-page');
  const scrollTop = Number(momentsPage?.scrollTop || 0);
  panelEl.innerHTML = renderMoments(state?.moments, getMomentsRenderOptions(state));

  const nextMomentsPage = panelEl.querySelector('.moments-page');
  if (nextMomentsPage) nextMomentsPage.scrollTop = scrollTop;

  if (options?.focusMomentId) {
    window.setTimeout(() => {
      const input = Array.from(panelEl.querySelectorAll('[data-role="moment-comment-input"]'))
        .find(item => String(item.dataset.momentId || '') === String(options.focusMomentId || ''));
      if (input) input.focus();
    }, 0);
  }
}

async function toggleMomentLike({ target, state, container, persistMoments }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  const { moment } = getMomentById(state, momentId);
  if (!moment) return;

  const viewerId = getMomentsViewerId(state);
  const viewerName = getMomentsViewerName(state);
  const likes = normalizeMomentLikes(moment.likes);
  const existed = likes.some(item => {
    if (typeof item === 'string' || typeof item === 'number') return String(item) === viewerId;
    return String(item?.id || item?.viewerId || item?.authorId || '') === viewerId;
  });

  moment.likes = existed
    ? likes.filter(item => {
        if (typeof item === 'string' || typeof item === 'number') return String(item) !== viewerId;
        return String(item?.id || item?.viewerId || item?.authorId || '') !== viewerId;
      })
    : [
        ...likes,
        {
          id: viewerId,
          name: viewerName,
          likedAt: Date.now()
        }
      ];

  await persistMoments?.();
  refreshMomentsPanel(container, state);
}

function toggleMomentComments({ target, state, container }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  if (!momentId) return;

  const expandedSet = new Set((Array.isArray(state.momentsExpandedCommentIds) ? state.momentsExpandedCommentIds : []).map(String));
  if (expandedSet.has(momentId)) {
    expandedSet.delete(momentId);
    if (String(state.momentsReplyTarget?.momentId || '') === momentId) state.momentsReplyTarget = null;
  } else {
    expandedSet.add(momentId);
  }

  state.momentsExpandedCommentIds = Array.from(expandedSet);
  refreshMomentsPanel(container, state, { focusMomentId: expandedSet.has(momentId) ? momentId : '' });
}

function setMomentReplyTarget({ target, state, container }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  const commentId = String(target?.dataset?.commentId || '').trim();
  if (!momentId || !commentId) return;

  state.momentsExpandedCommentIds = Array.from(new Set([
    ...(Array.isArray(state.momentsExpandedCommentIds) ? state.momentsExpandedCommentIds.map(String) : []),
    momentId
  ]));
  state.momentsReplyTarget = {
    momentId,
    commentId,
    authorName: String(target.dataset.commentAuthor || '匿名').trim() || '匿名'
  };
  refreshMomentsPanel(container, state, { focusMomentId: momentId });
}

function cancelMomentReply({ target, state, container }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  state.momentsReplyTarget = null;
  refreshMomentsPanel(container, state, { focusMomentId: momentId });
}

async function deleteMomentComment({ target, state, container, persistMoments }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  const commentId = String(target?.dataset?.commentId || '').trim();
  const { moment } = getMomentById(state, momentId);
  if (!moment || !commentId) return;

  const comments = Array.isArray(moment.comments) ? moment.comments : [];
  const nextComments = comments.filter(comment => String(comment?.id || '') !== commentId);
  if (nextComments.length === comments.length) return;

  moment.comments = nextComments;
  if (String(state.momentsReplyTarget?.momentId || '') === momentId && String(state.momentsReplyTarget?.commentId || '') === commentId) {
    state.momentsReplyTarget = null;
  }

  await persistMoments?.();
  refreshMomentsPanel(container, state);
}

async function submitMomentComment({ target, state, container, createUid, showNotice, persistMoments, onCommentSubmitted }) {
  const momentId = String(target?.dataset?.momentId || '').trim();
  const { moment } = getMomentById(state, momentId);
  if (!moment) return;

  const card = target.closest('.moments-card');
  const input = card?.querySelector('[data-role="moment-comment-input"]');
  const content = String(input?.value || '').trim();
  if (!content) {
    showNotice?.('请输入评论内容');
    return;
  }

  const now = Date.now();
  const viewerId = getMomentsViewerId(state);
  const viewerName = getMomentsViewerName(state);
  const comments = Array.isArray(moment.comments) ? moment.comments.slice() : [];
  const replyTarget = state.momentsReplyTarget && String(state.momentsReplyTarget.momentId || '') === momentId
    ? state.momentsReplyTarget
    : null;

  let committedComment = null;
  let committedReply = null;

  if (replyTarget?.commentId) {
    const replyCommentId = String(replyTarget.commentId);
    const nextReply = {
      id: createUid?.('moment_reply') || `moment_reply_${now}`,
      authorId: viewerId,
      authorName: viewerName,
      content,
      createdAt: now
    };
    moment.comments = comments.map(comment => {
      if (String(comment?.id || '') !== replyCommentId) return comment;
      return {
        ...comment,
        replies: [
          ...(Array.isArray(comment?.replies) ? comment.replies : []),
          nextReply
        ]
      };
    });
    committedReply = nextReply;
  } else {
    committedComment = {
      id: createUid?.('moment_comment') || `moment_comment_${now}`,
      authorId: viewerId,
      authorName: viewerName,
      content,
      createdAt: now,
      replies: []
    };
    moment.comments = [
      ...comments,
      committedComment
    ];
  }

  state.momentsExpandedCommentIds = Array.from(new Set([
    ...(Array.isArray(state.momentsExpandedCommentIds) ? state.momentsExpandedCommentIds.map(String) : []),
    momentId
  ]));
  state.momentsReplyTarget = null;

  await persistMoments?.();

  if (typeof onCommentSubmitted === 'function') {
    void onCommentSubmitted({
      state,
      container,
      momentId,
      moment,
      comment: committedComment || committedReply,
      replyTarget,
      viewerId,
      viewerName,
      content
    });
  }

  refreshMomentsPanel(container, state, { focusMomentId: momentId });
}

export async function handleMomentsInteractionAction(options = {}) {
  const action = String(options.action || options.target?.dataset?.action || '');
  switch (action) {
    case 'moment-like':
      await toggleMomentLike(options);
      return true;
    case 'moment-comment':
      toggleMomentComments(options);
      return true;
    case 'moment-reply-comment':
      setMomentReplyTarget(options);
      return true;
    case 'cancel-moment-reply':
      cancelMomentReply(options);
      return true;
    case 'moment-delete-comment':
      await deleteMomentComment(options);
      return true;
    case 'submit-moment-comment':
      await submitMomentComment(options);
      return true;
    default:
      return false;
  }
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
            <button class="moments-compose-option ${location ? 'is-selected' : ''}" type="button" data-action="open-moments-compose-location-modal" aria-pressed="${location ? 'true' : 'false'}">
              <span class="moments-compose-option__icon">${ICONS.location}</span>
              <span class="moments-compose-option__label">所在地点</span>
              <span class="moments-compose-option__value">${escapeHtml(location || '点击添加地点')}</span>
            </button>

            <button class="moments-compose-option ${shareTargetName ? 'is-selected' : ''}" type="button" data-action="open-moments-compose-share-modal" aria-pressed="${shareTargetName ? 'true' : 'false'}">
              <span class="moments-compose-option__icon">${ICONS.share}</span>
              <span class="moments-compose-option__label">分享帖子</span>
              <span class="moments-compose-option__value">${escapeHtml(shareTargetName || '不分享到聊天')}</span>
            </button>

            <button class="moments-compose-option ${visibilityLabel !== '公开' ? 'is-selected' : ''}" type="button" data-action="open-moments-compose-visibility-modal" aria-pressed="${visibilityLabel !== '公开' ? 'true' : 'false'}">
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

export function renderMomentsComposeIntoPage(container, state) {
  const draft = ensureMomentsComposeDraft(state);
  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const panels = container.querySelectorAll('.chat-panel');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = 'none';
  if (subTabs) subTabs.style.display = 'none';
  if (bottomTab) bottomTab.style.display = 'none';
  panels.forEach(panel => {
    panel.style.display = 'none';
  });

  if (msgWrap) {
    msgWrap.style.display = 'flex';
    msgWrap.innerHTML = renderMomentsComposePage(draft, {
      profile: state.profile,
      shareTargetName: getMomentsComposeShareTargetName(state),
      visibilityLabel: getMomentsComposeVisibilityLabel(state)
    });
  }
}

export function openMomentsComposePage(container, state) {
  state.momentsComposeOpen = true;
  renderMomentsComposeIntoPage(container, state);
}

export function closeMomentsComposePage(container, state, panelKeys, options = {}) {
  state.momentsComposeOpen = false;
  if (options?.resetDraft) {
    state.momentsComposeDraft = createMomentsComposeDraft();
  }

  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = '';
  if (subTabs) subTabs.style.display = state.activePanel === 'chatList' ? '' : 'none';
  if (bottomTab) bottomTab.style.display = '';

  (Array.isArray(panelKeys) ? panelKeys : []).forEach(key => {
    const panel = container.querySelector(`[data-panel="${key}"]`);
    if (!panel) return;
    panel.style.display = '';
    panel.classList.toggle('is-active', key === state.activePanel);
  });

  if (msgWrap) {
    msgWrap.style.display = 'none';
    msgWrap.innerHTML = '';
  }
}

export function openMomentsComposeImageUrlModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>添加 URL 图片</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <label class="chat-modal-field">
        <span class="chat-modal-field__label">图片链接</span>
        <input class="chat-modal-input" data-role="moments-compose-image-url-input" type="url" placeholder="https://example.com/image.jpg">
      </label>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-moments-compose-image-url" type="button">添加图片</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function openMomentsComposeLocationModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const draft = ensureMomentsComposeDraft(state);
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>所在地点</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <label class="chat-modal-field">
        <span class="chat-modal-field__label">地点名称</span>
        <input class="chat-modal-input" data-role="moments-compose-location-input" type="text" value="${escapeHtml(draft.location)}" placeholder="例如：上海 · 静安">
      </label>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn" data-action="clear-moments-compose-location" type="button">清空</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-moments-compose-location" type="button">保存地点</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function openMomentsComposeShareModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const draft = ensureMomentsComposeDraft(state);
  const sessions = getMomentsComposeShareSessions(state);
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>分享帖子</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <button
        class="chat-modal-contact moments-theme-choice ${draft.shareChatId ? '' : 'is-selected'}"
        data-action="select-moments-compose-share"
        data-chat-id=""
        type="button"
        aria-pressed="${draft.shareChatId ? 'false' : 'true'}">
        <span class="chat-modal-contact__name">不分享到聊天</span>
        <span class="chat-modal-contact__meta">${draft.shareChatId ? '' : ICON_CHECK}</span>
      </button>
      ${sessions.length ? sessions.map(session => {
        const sessionName = escapeHtml(String(session?.remark || session?.name || '未命名聊天').trim() || '未命名聊天');
        const sessionMeta = escapeHtml(String(session?.lastMessage || '').trim() || '聊天列表中的联系人');
        const isSelected = String(session?.id || '') === String(draft.shareChatId || '');
        return `
          <button
            class="chat-modal-contact moments-theme-choice ${isSelected ? 'is-selected' : ''}"
            data-action="select-moments-compose-share"
            data-chat-id="${escapeHtml(String(session?.id || ''))}"
            type="button"
            aria-pressed="${isSelected ? 'true' : 'false'}">
            <span>
              <span class="chat-modal-contact__name">${sessionName}</span>
              <span class="chat-modal-contact__meta">${sessionMeta}</span>
            </span>
            <span class="chat-modal-contact__meta">${isSelected ? ICON_CHECK : ''}</span>
          </button>
        `;
      }).join('') : '<p class="chat-modal-empty">当前聊天列表暂无可分享联系人。</p>'}
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function openMomentsComposeVisibilityModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const draft = ensureMomentsComposeDraft(state);
  const contacts = Array.isArray(state.contacts) ? state.contacts : [];
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>可见范围</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-actions">
        <button
          class="chat-modal-btn moments-theme-choice-btn ${draft.visibilityMode === 'public' ? 'chat-modal-btn--primary is-selected' : ''}"
          data-action="set-moments-compose-visibility-mode"
          data-visibility-mode="public"
          type="button">
          公开
        </button>
        <button
          class="chat-modal-btn moments-theme-choice-btn ${draft.visibilityMode === 'contacts' ? 'chat-modal-btn--primary is-selected' : ''}"
          data-action="set-moments-compose-visibility-mode"
          data-visibility-mode="contacts"
          type="button">
          通讯录中个别人能看
        </button>
      </div>
      ${draft.visibilityMode === 'contacts' ? `
        <div class="chat-modal-section">
          ${(contacts.length ? contacts : []).map(contact => {
            const contactId = String(contact?.id || '').trim();
            const roleId = String(contact?.roleId || '').trim();
            const contactName = escapeHtml(String(contact?.name || contact?.nickname || contact?.contact || '未命名联系人').trim() || '未命名联系人');
            const checked = draft.visibleContactIds.includes(contactId) || (!!roleId && draft.visibleContactIds.includes(roleId));
            return `
              <button
                class="chat-modal-contact moments-theme-choice ${checked ? 'is-selected' : ''}"
                data-action="toggle-moments-compose-visible-contact"
                data-contact-id="${escapeHtml(contactId || roleId)}"
                type="button"
                aria-pressed="${checked ? 'true' : 'false'}">
                <span class="chat-modal-contact__name">${contactName}</span>
                <span class="chat-modal-contact__meta">${checked ? ICON_CHECK : ''}</span>
              </button>
            `;
          }).join('') || '<p class="chat-modal-empty">当前通讯录暂无可选联系人。</p>'}
        </div>
      ` : ''}
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">完成</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·朋友圈左上角爱心即时 AI 发布弹窗]
   说明：
   1. 点击朋友圈页面左上角 IconPark 爱心按钮后，使用本区应用内弹窗选择通讯录联系人。
   2. 支持多选或单选联系人；不使用原生浏览器弹窗，不使用浏览器原生选择器。
   3. 本区只维护运行时选择状态，不写入持久化存储；确认发布后的 IndexedDB 写入由事件模块调用自主活动模块完成。
   4. 爱心即时发布不再依赖聊天设置里的“主动发朋友圈”开关；该开关只控制后台主动定时发布。
   5. 联系人选项使用朋友圈主题色与明确选中态，便于区分已选/未选。
   6. 底部已移除“取消”按钮，仅保留右上角关闭按钮，避免重复操作入口。
   ========================================================================== */
function getInstantAutonomousMomentSelectedIds(state = {}) {
  return Array.from(new Set(
    (Array.isArray(state.instantAutonomousMomentContactIds) ? state.instantAutonomousMomentContactIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  ));
}

export function openInstantAutonomousMomentContactsModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const contacts = Array.isArray(state.contacts) ? state.contacts : [];
  const selectedIds = getInstantAutonomousMomentSelectedIds(state);
  const selectedSet = new Set(selectedIds);

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>让联系人即时发朋友圈</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-section">
        <p class="chat-modal-contact__name">选择通讯录联系人</p>
        <p class="chat-modal-contact__meta">可一次选择多位，也可以只选择一位。确认后会直接为所选联系人生成并发布朋友圈；无需开启聊天设置里的“主动发朋友圈”开关，并且只调用设置应用副 API。</p>
      </div>
      ${contacts.length ? contacts.map(contact => {
        const contactId = String(contact?.id || contact?.roleId || '').trim();
        const contactName = escapeHtml(String(contact?.name || contact?.nickname || contact?.contact || '未命名联系人').trim() || '未命名联系人');
        const contactMeta = escapeHtml(String(contact?.remark || contact?.contact || contact?.roleName || '点击切换选择').trim() || '点击切换选择');
        const checked = selectedSet.has(contactId);
        return `
          <button
            class="chat-modal-contact moments-theme-choice ${checked ? 'is-selected' : ''}"
            data-action="toggle-instant-autonomous-moment-contact"
            data-contact-id="${escapeHtml(contactId)}"
            type="button"
            aria-pressed="${checked ? 'true' : 'false'}">
            <span>
              <span class="chat-modal-contact__name">${contactName}</span>
              <span class="chat-modal-contact__meta">${contactMeta}</span>
            </span>
            <span class="chat-modal-contact__meta">${checked ? ICON_CHECK : ''}</span>
          </button>
        `;
      }).join('') : '<p class="chat-modal-empty">当前通讯录暂无可选联系人。</p>'}
      <p class="chat-modal-notice" data-role="modal-notice"></p>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-instant-autonomous-moments" type="button">立即发布</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function toggleInstantAutonomousMomentContact(state, contactId) {
  const safeContactId = String(contactId || '').trim();
  if (!safeContactId) return;

  const selectedSet = new Set(getInstantAutonomousMomentSelectedIds(state));
  if (selectedSet.has(safeContactId)) {
    selectedSet.delete(safeContactId);
  } else {
    selectedSet.add(safeContactId);
  }
  state.instantAutonomousMomentContactIds = Array.from(selectedSet);
}

export function getInstantAutonomousMomentContactIds(state) {
  return getInstantAutonomousMomentSelectedIds(state);
}

/* ==========================================================================
   [区域标注·已完成·本次朋友圈分享转发删除互动] 动态分享 / 转发 / 删除弹窗
   说明：
   1. 仅渲染应用内 chat-modal，不使用原生浏览器弹窗或选择器。
   2. 分享目标、转发文案、删除确认均由点击事件模块接管后续 DB.js / IndexedDB 持久化。
   3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
export function openMomentShareModal(container, state, momentId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const { moment } = getMomentById(state, momentId);
  const sessions = getVisibleChatSessions(state).filter(session => session && String(session.id || '').trim());
  if (!mask || !panel || !moment) return;

  const authorName = String(moment?.authorName || '未命名').trim() || '未命名';
  const previewText = String(moment?.content || '').trim();
  const previewMeta = [
    previewText || '这条动态没有正文',
    Array.isArray(moment?.images) && moment.images.length ? `[图片x${moment.images.length}]` : '',
    String(moment?.location || '').trim() ? `@${String(moment.location || '').trim()}` : ''
  ].filter(Boolean).join(' ');

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>分享到聊天</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-section">
        <p class="chat-modal-contact__name">${escapeHtml(authorName)} 的动态</p>
        <p class="chat-modal-contact__meta">${escapeHtml(previewMeta || '选择一个聊天窗口进行分享')}</p>
      </div>
      ${sessions.length ? sessions.map(session => {
        const sessionId = String(session?.id || '').trim();
        const sessionName = escapeHtml(String(session?.remark || session?.name || '未命名聊天').trim() || '未命名聊天');
        const sessionMeta = escapeHtml(String(session?.lastMessage || '').trim() || '点击后立即分享到该聊天');
        return `
          <button
            class="chat-modal-contact"
            data-action="share-moment-to-chat"
            data-chat-id="${escapeHtml(sessionId)}"
            data-moment-id="${escapeHtml(String(moment?.id || ''))}"
            type="button">
            <span>
              <span class="chat-modal-contact__name">${sessionName}</span>
              <span class="chat-modal-contact__meta">${sessionMeta}</span>
            </span>
            <span class="chat-modal-contact__meta">${ICONS.send}</span>
          </button>
        `;
      }).join('') : '<p class="chat-modal-empty">当前聊天列表暂无可分享联系人。</p>'}
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function openMomentRepostModal(container, state, momentId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const { moment } = getMomentById(state, momentId);
  if (!mask || !panel || !moment) return;

  const sourceAuthorName = String(moment?.authorName || '未命名').trim() || '未命名';
  const sourceContent = String(moment?.content || '').trim();

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>转发到朋友圈</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <label class="chat-modal-field">
        <span class="chat-modal-field__label">转发文案</span>
        <textarea
          class="chat-modal-input"
          data-role="moment-repost-text-input"
          rows="4"
          placeholder="写点转发时想说的话…"></textarea>
      </label>
      <div class="chat-modal-section">
        <p class="chat-modal-contact__name">原动态：${escapeHtml(sourceAuthorName)}</p>
        <p class="chat-modal-contact__meta">${escapeHtml(sourceContent || '这条动态没有正文')}</p>
      </div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-moment-repost" data-moment-id="${escapeHtml(String(moment?.id || ''))}" type="button">确认转发</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

export function openMomentDeleteModal(container, state, momentId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const { moment } = getMomentById(state, momentId);
  if (!mask || !panel || !moment) return;

  const authorName = String(moment?.authorName || '未命名').trim() || '未命名';
  const content = String(moment?.content || '').trim();

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>删除确认</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-section">
        <p class="chat-modal-contact__name">确定删除这条动态吗？</p>
        <p class="chat-modal-contact__meta">${escapeHtml(`${authorName}：${content || '这条动态没有正文'}`)}</p>
      </div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-moment" data-moment-id="${escapeHtml(String(moment?.id || ''))}" type="button">删除动态</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
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
/* ==========================================================================
   [区域标注·已完成·本次朋友圈联系人头像动态筛选] 联系人动态过滤工具
   说明：
   1. 仅在渲染阶段根据当前运行时筛选条件过滤朋友圈动态。
   2. 已删除动态不显示：兼容 deleted / isDeleted / deletedAt 软删除标记。
   3. 不改动点赞、评论、回复、删除、分享、转发等原有动态内部逻辑。
   ========================================================================== */
function isDeletedMoment(moment) {
  if (!moment || typeof moment !== 'object') return true;
  if (moment.deleted === true) return true;
  if (moment.isDeleted === true) return true;
  if (moment.deletedAt) return true;
  return false;
}

function isMomentOwnedByContact(moment, contactFilterId, contacts = []) {
  const safeFilterId = String(contactFilterId || '').trim();
  if (!safeFilterId) return true;

  const authorIdCandidates = [
    moment?.authorId,
    moment?.authorRoleId,
    moment?.roleId,
    moment?.contactId,
    moment?.userId
  ]
    .map(id => String(id || '').trim())
    .filter(Boolean);

  if (authorIdCandidates.includes(safeFilterId)) return true;

  const matchedContact = (Array.isArray(contacts) ? contacts : []).find(contact => {
    const contactId = String(contact?.id || '').trim();
    const roleId = String(contact?.roleId || '').trim();
    return contactId === safeFilterId || roleId === safeFilterId;
  });

  if (!matchedContact) return false;

  const matchedContactIds = new Set(
    [matchedContact?.id, matchedContact?.roleId]
      .map(id => String(id || '').trim())
      .filter(Boolean)
  );

  return authorIdCandidates.some(id => matchedContactIds.has(id));
}

export function renderMoments(moments, options = {}) {
  const sourceList = Array.isArray(moments) ? moments : [];
  const profile = options?.profile || {};
  const contacts = Array.isArray(options?.contacts) ? options.contacts : [];
  const activeContactFilterId = String(options?.activeContactFilterId || '').trim();
  const list = sourceList.filter(moment => (
    !isDeletedMoment(moment)
    && isMomentOwnedByContact(moment, activeContactFilterId, contacts)
  ));

  if (list.length === 0) {
    return renderEmptyState(profile, contacts, { activeContactFilterId });
  }

  return `
    <!-- [区域标注·已完成·本次朋友圈联系人头像动态筛选] 朋友圈页面容器 -->
    <div class="moments-page" aria-label="朋友圈">
      ${renderMomentsStories(profile, contacts, { activeContactFilterId })}

      <!-- [区域标注·已完成·本次朋友圈联系人头像动态筛选] 朋友圈动态列表 -->
      <div class="moments-feed">
        ${list.map(moment => renderMomentCard(moment, options)).join('')}
      </div>
    </div>
  `;
}
