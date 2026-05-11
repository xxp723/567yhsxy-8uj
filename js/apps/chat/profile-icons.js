// @ts-nocheck
/**
 * 文件名: js/apps/chat/profile-icons.js
 * 用途: 闲谈应用 — 用户主页相关 IconPark SVG 图标集中定义。
 *       profile.js / profile-wallet.js 等子模块统一从这里引用图标，避免大文件内重复维护。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·主页图标模块]
   说明：
   1. 本文件只集中维护用户主页、钱包、收藏、表情包相关 IconPark SVG 图标。
   2. 不包含持久化逻辑，不使用浏览器本地同步存储接口。
   3. 后续需要替换图标时优先修改本区域。
   ========================================================================== */
export const PROFILE_ICONS = {
  /* [区域标注] 好友数量卡片图标（IconPark — People / 用户群组） */
  friends: `<svg viewBox="0 0 48 48" fill="none"><circle cx="19" cy="14" r="7" stroke="currentColor" stroke-width="3"/><path d="M4 40a15 15 0 0 1 30 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="36" cy="16" r="5" stroke="currentColor" stroke-width="3"/><path d="M44 40a10 10 0 0 0-14-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 身份数量卡片图标（IconPark — IdCard / 身份证） */
  identities: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" stroke-width="3"/><circle cx="18" cy="22" r="5" stroke="currentColor" stroke-width="3"/><path d="M10 36a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 18h10M30 26h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注] 聊天天数卡片图标（IconPark — Calendar / 日历） */
  chatDays: `<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="36" rx="3" stroke="currentColor" stroke-width="3"/><path d="M4 20h40M16 4v8M32 4v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="30" r="2" fill="currentColor"/><circle cx="24" cy="30" r="2" fill="currentColor"/><circle cx="30" cy="30" r="2" fill="currentColor"/></svg>`,
  /* [区域标注] 钱包折叠栏图标（IconPark — Wallet / 钱包） */
  wallet: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="3"/><path d="M6 18h36" stroke="currentColor" stroke-width="3"/><circle cx="34" cy="28" r="3" stroke="currentColor" stroke-width="3"/><path d="M14 10V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="3"/></svg>`,
  /* [区域标注·已完成·收藏折叠栏] 收藏折叠栏图标（IconPark — Star / 收藏） */
  favorite: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l5.6 11.4L42 19.2l-9 8.8l2.1 12.4L24 34.5l-11.1 5.9L15 28l-9-8.8l12.4-1.8L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* [区域标注] 表情包折叠栏图标（IconPark — EmotionHappy / 笑脸） */
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="3"/><path d="M16 28c2 4 6 6 8 6s6-2 8-6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="19" r="2" fill="currentColor"/><circle cx="31" cy="19" r="2" fill="currentColor"/></svg>`,
  /* [区域标注] 折叠栏右侧箭头图标（IconPark — ChevronRight） */
  chevronRight: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* ========================================================================== */
  /* [区域标注·已完成·收藏多选底栏] IconPark 图标：分组 / 移动 / 全选 / 删除 / 取消 */
  /* 说明：用于收藏独立页多选模式悬浮底栏按钮。 */
  /* ========================================================================== */
  folderPlus: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 10h14l4 4h18v24H6V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 24v10M19 29h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  transfer: `<svg viewBox="0 0 48 48" fill="none"><path d="M42 19H6m28-8l8 8-8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 29h36M14 37l-8-8 8-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  checkOne: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="3"/><path d="M15 24l6 6 12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  deleteIcon: `<svg viewBox="0 0 48 48" fill="none"><path d="M9 10h30M18 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 14v26a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V14" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  closeSmall: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ======================================================================== */
  /* [区域标注·已完成·本次钱包需求] 钱包独立页 IconPark 图标 */
  /* 说明：余额展示、充值、汇率切换等按钮图案统一使用 IconPark 风格 SVG。 */
  /* ======================================================================== */
  walletCard: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 14h36v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 14V8h24v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M30 26h12v8H30a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  exchange: `<svg viewBox="0 0 48 48" fill="none"><path d="M7 16h28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M27 8l8 8l-8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M41 32H13" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 24l-8 8l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  recharge: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M24 15v18M15 24h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·已完成·本次钱包流水需求] IconPark — 钱包流水图标 */
  ledger: `<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="6" width="32" height="36" rx="3" stroke="currentColor" stroke-width="3"/><path d="M16 16h16M16 24h16M16 32h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ======================================================================== */
  /* [区域标注·已完成·收藏HTML卡片展开跳转上下文] IconPark — 跳转到原聊天上下文 */
  /* 说明：用于收藏页 HTML 卡片展开后的顶部“跳转”按钮。 */
  /* ======================================================================== */
  jumpToChat: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 38L38 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 10h16v16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 34v4H10V10h4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
