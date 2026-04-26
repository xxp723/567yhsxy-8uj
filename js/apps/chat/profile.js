/**
 * 文件名: js/apps/chat/profile.js
 * 用途: 闲谈应用 — 用户主页板块
 *       显示当前用户面具身份的头像、昵称、签名、
 *       统计数据（好友/身份/聊天天数）、钱包/表情包折叠栏。
 *       联动档案应用的用户面具身份数据。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注] IconPark 图标 SVG 定义
   ========================================================================== */
const ICONS = {
  /* [区域标注] 好友数量卡片图标（IconPark — People / 用户群组） */
  friends: `<svg viewBox="0 0 48 48" fill="none"><circle cx="19" cy="14" r="7" stroke="currentColor" stroke-width="3"/><path d="M4 40a15 15 0 0 1 30 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="16" r="5" stroke="currentColor" stroke-width="3"/><path d="M44 40a10 10 0 0 0-14-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 身份数量卡片图标（IconPark — IdCard / 身份证） */
  identities: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="22" r="5" stroke="currentColor" stroke-width="3"/><path d="M10 36a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 18h10M30 26h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 聊天天数卡片图标（IconPark — Calendar / 日历） */
  chatDays: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="36" rx="3" stroke="currentColor" stroke-width="3"/><path d="M4 20h40M16 4v8M32 4v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="30" r="2" fill="currentColor"/><circle cx="24" cy="30" r="2" fill="currentColor"/><circle cx="30" cy="30" r="2" fill="currentColor"/></svg>`,
  /* [区域标注] 钱包折叠栏图标（IconPark — Wallet / 钱包） */
  wallet: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="3"/><path d="M6 18h36" stroke="currentColor" stroke-width="3"/><circle cx="34" cy="28" r="3" stroke="currentColor" stroke-width="3"/><path d="M14 10V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注] 表情包折叠栏图标（IconPark — EmotionHappy / 笑脸） */
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M16 28c2 4 6 6 8 6s6-2 8-6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="19" r="2" fill="currentColor"/><circle cx="31" cy="19" r="2" fill="currentColor"/></svg>`,
  /* [区域标注] 折叠栏右侧箭头图标（IconPark — ChevronRight） */
  chevronRight: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
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
         {nickname, avatar, signature, friendsCount, identitiesCount, chatDays}
   说明：
     - [修改1] 去除了封面咖啡色区域，头像向上移动
     - [修改1] 去除了卡片中的说明性文字，只保留图标和数字
     - [修改1] 新增钱包/表情包折叠栏
     - [修改2] 卡片居中展示
     - [修改3] 去除头像点击上传弹窗（无 data-action="upload-avatar"）
     - [修改4] 卡片数据由外部实时传入（好友数量/身份数量/聊天天数）
     - [修改4] 身份数量卡片可点击切换面具
     - [修改4] 聊天天数卡片可点击查看详情
     - [修改6] 显示当前激活面具的头像和个性签名
   ========================================================================== */
export function renderProfile(userProfile) {
  const p = userProfile || {};
  const nickname    = p.nickname || '我的昵称';
  const avatarUrl   = p.avatar || '';
  const signature   = p.signature || '点击输入个性签名...';
  const friends     = p.friendsCount ?? 0;
  const identities  = p.identitiesCount ?? 0;
  const chatDays    = p.chatDays ?? 0;

  return `
    <!-- [区域标注] 用户主页容器 -->
    <div class="profile-page">

      <!-- ================================================================
           [区域标注·修改1] 封面区域已移除（原咖啡色渐变区域）
           ================================================================ -->

      <!-- ================================================================
           [区域标注·修改3] 头像区域（只读展示，不可点击上传）
           说明：显示当前激活面具的头像（修改6）
           ================================================================ -->
      <div class="profile-avatar-wrap profile-avatar-wrap--no-cover">
        <div class="profile-avatar">
          ${avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="头像">`
            : `<span class="profile-avatar__placeholder">${escapeHtml(nickname.charAt(0).toUpperCase())}</span>`}
        </div>
      </div>

      <!-- ================================================================
           [区域标注·修改6] 昵称区域 — 显示当前激活面具的名称
           ================================================================ -->
      <div class="profile-nickname profile-nickname--center">${escapeHtml(nickname)}</div>

      <!-- ================================================================
           [区域标注·修改6] 个性签名 — 显示当前激活面具的签名
           ================================================================ -->
      <div class="profile-signature">
        ${escapeHtml(signature)}
      </div>

      <!-- ================================================================
           [区域标注·修改1·修改2·修改4] 统计数据区域（三张方形圆角卡片）
           说明：
             - 去除了卡片中的说明性文字（修改1）
             - 卡片容器居中展示（修改2）
             - 数据由外部实时传入（修改4）
             - 身份数量卡片点击弹窗切换面具（修改4）
             - 聊天天数卡片点击查看详情（修改4）
           ================================================================ -->
      <div class="profile-stats-cards">
        <!-- [区域标注·修改4] 好友数量卡片 — 显示当前面具身份的好友数 -->
        <div class="profile-stat-card" data-action="open-friends-detail">
          <span class="profile-stat-card__icon">${ICONS.friends}</span>
          <span class="profile-stat-card__number">${friends}</span>
        </div>
        <!-- [区域标注·修改4] 身份数量卡片 — 点击弹窗切换面具身份 -->
        <div class="profile-stat-card" data-action="open-mask-switcher">
          <span class="profile-stat-card__icon">${ICONS.identities}</span>
          <span class="profile-stat-card__number">${identities}</span>
        </div>
        <!-- [区域标注·修改4] 聊天天数卡片 — 点击查看每个好友的聊天天数 -->
        <div class="profile-stat-card" data-action="open-chat-days-detail">
          <span class="profile-stat-card__icon">${ICONS.chatDays}</span>
          <span class="profile-stat-card__number">${chatDays}</span>
        </div>
      </div>

      <!-- ================================================================
           [区域标注·修改1] 钱包折叠栏（点击进入新独立界面）
           说明：样式参照图2的折叠栏设计 — 左侧图标+文字，右侧箭头
           ================================================================ -->
      <div class="profile-fold-bar" data-action="open-wallet">
        <span class="profile-fold-bar__icon">${ICONS.wallet}</span>
        <span class="profile-fold-bar__label">钱包</span>
        <span class="profile-fold-bar__arrow">${ICONS.chevronRight}</span>
      </div>

      <!-- ================================================================
           [区域标注·修改1] 表情包折叠栏（点击进入新独立界面）
           说明：样式参照图2的折叠栏设计 — 左侧图标+文字，右侧箭头
           ================================================================ -->
      <div class="profile-fold-bar" data-action="open-sticker">
        <span class="profile-fold-bar__icon">${ICONS.sticker}</span>
        <span class="profile-fold-bar__label">表情包</span>
        <span class="profile-fold-bar__arrow">${ICONS.chevronRight}</span>
      </div>

    </div>
  `;
}
