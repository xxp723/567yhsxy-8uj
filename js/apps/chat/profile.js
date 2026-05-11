// @ts-nocheck
/**
 * 文件名: js/apps/chat/profile.js
 * 用途: 闲谈应用 — 用户主页板块
 *       显示当前用户面具身份的头像、昵称、签名、
 *       统计数据（好友/身份/聊天天数）、钱包/收藏/表情包折叠栏。
 *       联动档案应用的用户面具身份数据。
 * 架构层: 应用层（闲谈子模块）
 */

/* ========================================================================== */
/*   [区域标注] 子模块导入                                                    */
/* ========================================================================== */
import {
  TAB_ICONS,
  ICON_CHECK,
  escapeHtml,
  normalizeStickerData,
  persistStickerData,
  createUid,
  renderModalNotice,
  closeModal
} from './chat-utils.js';
import { chat } from './prompt.js';
import { PROFILE_ICONS as ICONS } from './profile-icons.js';
import { renderWalletSubPage } from './profile-wallet.js';
import { renderFavoriteSubPage } from './profile-favorites.js';

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·钱包对外接口兼容导出]
   说明：保持原 profile.js 的钱包函数导出路径不变，外部模块无需改动导入。
   ========================================================================== */
export {
  renderWalletSubPage,
  getWalletCurrencyMeta,
  getWalletDisplayAmount,
  formatWalletMoney,
  showWalletRechargeModal,
  showWalletCurrencyModal
} from './profile-wallet.js';

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·收藏对外接口兼容导出]
   说明：保持原 profile.js 的收藏函数导出路径不变，外部模块无需改动导入。
   ========================================================================== */
export {
  getFavoriteGroupsWithAll,
  getVisibleFavoriteItems,
  getFavoriteCardTitle,
  addMessagesToFavorites,
  showCreateFavoriteGroupModal,
  showCreateFavoriteSubGroupModal,
  showFavoriteFilterModal,
  showFavoritePreviewModal,
  showDeleteFavoriteGroupModal,
  createFavoriteGroupLongPressHandlers,
  renderFavoriteSubPage,
  createFavoriteCardLongPressHandlers,
  showMoveFavoriteToGroupModal
} from './profile-favorites.js';

/* ========================================================================== */
/*   [区域标注·已完成·闲谈大文件拆分·主页图标接线]                           */
/*   说明：IconPark SVG 已迁移到 profile-icons.js，本文件只负责引用。          */
/* ========================================================================== */

/* ==========================================================================
   [区域标注] 渲染用户主页 HTML
   参数：userProfile — 用户资料对象
         {nickname, avatar, signature, friendsCount, identitiesCount, chatDays}
   说明：
     - [修改1] 去除了封面咖啡色区域，头像向上移动
     - [修改1] 去除了卡片中的说明性文字，只保留图标和数字
     - [已完成·收藏折叠栏] 新增钱包/收藏/表情包折叠栏
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
           [区域标注·已完成·收藏折叠栏] 收藏折叠栏（点击进入独立收藏展示页面）
           说明：位于“钱包”下方、“表情包”上方；样式沿用主页折叠栏。
           ================================================================ -->
      <div class="profile-fold-bar" data-action="open-favorite">
        <span class="profile-fold-bar__icon">${ICONS.favorite}</span>
        <span class="profile-fold-bar__label">收藏</span>
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

/* ========================================================================== */
export function buildProfileFromMask(state) {
  const activeMask = state.archiveMasks.find(m => m.id === state.activeMaskId);

  /* [修改6] 显示当前激活面具的头像和个性签名 */
  state.profile = {
    nickname: activeMask?.name || '我的昵称',
    avatar: activeMask?.avatar || '',
    signature: activeMask?.signature || '点击输入个性签名...',
    /* [修改4] 好友数量 = 当前面具身份通讯录中的好友数 */
    friendsCount: state.contacts.length,
    /* [修改4] 身份数量 = 档案应用中所有用户面具数量 */
    identitiesCount: state.archiveMasks.length,
    /* [区域标注·已完成·本次需求3] 聊天天数 = 当前聊天列表联系人实时累计天数汇总 */
    chatDays: calculateTotalChatDays(state)
  };
}

/* ==========================================================================
   [区域标注·已完成·本次需求3] 用户主页聊天天数卡片统计口径
   说明：
   1. 不再按 sessions.lastTime 去重日期计算，避免主页卡片与详情页口径不一致。
   2. 与“聊天天数详情”统一为：当前聊天列表中未隐藏联系人的实时累计天数总和。
   3. 删除聊天列表联系人后暂停计数；重新加入后从累计值继续计数。
   ========================================================================== */
export function calculateTotalChatDays(state) {
  return calculatePerFriendChatDays(state).reduce((sum, item) => sum + Number(item.days || 0), 0);
}

/* ==========================================================================
   [区域标注·已完成·本次需求2] 聊天天数详情按“聊天列表联系人”实时计数
   说明：
   1. 只统计已添加到聊天列表且当前未被删除（未隐藏）的联系人。
   2. 每个联系人按“加入聊天列表后的累计自然日”计数。
   3. 联系人从聊天列表删除时计数暂停；重新添加后从原累计值继续计数。
   ========================================================================== */
export function calculateSessionRunningChatDays(session, nowTs) {
  const now = Number(nowTs || Date.now());
  const accumulated = Math.max(0, Number(session?.chatDaysAccumulated || 0));
  const resumedAt = Number(session?.chatDaysLastResumedAt || 0);

  if (Number.isFinite(resumedAt) && resumedAt > 0) {
    const elapsedMs = Math.max(0, now - resumedAt);
    const elapsedDays = Math.floor(elapsedMs / 86400000);
    /* [区域标注·已完成·本次需求3] 首次加入聊天列表当天计为 1 天，避免详情页显示 0 天 */
    const runningDays = accumulated > 0 ? elapsedDays : elapsedDays + 1;
    return accumulated + runningDays;
  }

  const hasChatDayFields = Object.prototype.hasOwnProperty.call(session || {}, 'chatDaysAccumulated')
    || Object.prototype.hasOwnProperty.call(session || {}, 'chatDaysLastResumedAt');
  if (hasChatDayFields || accumulated > 0) return accumulated;

  /* [区域标注·已完成·本次需求3] 兼容旧会话：没有新计数字段时，用已有时间字段补出至少 1 天 */
  const legacyStart = Number(session?.addedAt || session?.createdAt || session?.lastTime || 0);
  if (!Number.isFinite(legacyStart) || legacyStart <= 0) return 0;
  return Math.max(1, Math.floor(Math.max(0, now - legacyStart) / 86400000) + 1);
}

export function calculatePerFriendChatDays(state) {
  const hiddenSet = new Set((state.hiddenChatIds || []).map(id => String(id)));
  const now = Date.now();

  return (state.sessions || [])
    .filter(session => !hiddenSet.has(String(session.id)))
    .map(session => ({
      id: session.id,
      name: session.name || '未命名',
      avatar: session.avatar || '',
      days: calculateSessionRunningChatDays(session, now)
    }));
}

/* ========================================================================== */
export function showMaskSwitcherModal(container, state, db, eventBus) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const masksHtml = state.archiveMasks.length === 0
    ? `<p style="text-align:center;color:rgba(74,52,42,0.45);font-size:13px;padding:20px 0;">暂无用户面具<br>请先在档案应用中创建面具身份</p>`
    : state.archiveMasks.map(m => {
      const isActive = m.id === state.activeMaskId;
      return `
        <!-- [区域标注·修改4] 面具切换项: ${m.name || '未命名'} -->
        <div class="chat-mask-switch-item ${isActive ? 'is-active' : ''}"
             data-action="switch-mask" data-mask-id="${m.id}">
          <div class="chat-mask-switch-item__avatar">
            ${m.avatar
              ? `<img src="${m.avatar}" alt="">`
              : (m.name || '?').charAt(0).toUpperCase()}
          </div>
          <div class="chat-mask-switch-item__info">
            <div class="chat-mask-switch-item__name">${m.name || '未命名面具'}</div>
            <div class="chat-mask-switch-item__sig">${m.signature || ''}</div>
          </div>
          ${isActive ? `<div class="chat-mask-switch-item__check">${ICON_CHECK}</div>` : ''}
        </div>
      `;
    }).join('');

  panel.innerHTML = `
    <!-- [区域标注·修改4] 面具身份切换弹窗 -->
    <div class="chat-modal-header">
      <span>切换用户身份</span>
      <button class="chat-modal-close" data-action="close-modal">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${masksHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ========================================================================== */
/*   [区域标注·已完成·闲谈大文件拆分·钱包模块接线]                             */
/*   说明：钱包页面、金额格式化与钱包弹窗已迁移到 profile-wallet.js。          */
/* ========================================================================== */

export function renderSubPage(state, pageType) {
  if (pageType === 'wallet') {
    return renderWalletSubPage(state);
  }

  if (pageType === 'favorite') {
    return renderFavoriteSubPage(state);
  }

  if (pageType === 'sticker') {
    return renderStickerSubPage(state);
  }

  if (pageType === 'chatDaysDetail') {
    /* [区域标注·已完成·本次需求3] 聊天天数详情与主页卡片统一使用“当前聊天列表联系人实时累计天数汇总” */
    const friends = calculatePerFriendChatDays(state);
    const totalDays = friends.reduce((sum, item) => sum + Number(item.days || 0), 0);
    const listHtml = friends.length === 0
      ? `<p style="text-align:center;color:rgba(74,52,42,0.45);font-size:13px;padding:20px 0;">暂无聊天记录</p>`
      : friends.map(f => `
          <div class="chat-days-detail-item">
            <div class="chat-days-detail-item__avatar">
              ${f.avatar ? `<img src="${f.avatar}" alt="">` : (f.name || '?').charAt(0).toUpperCase()}
            </div>
            <div class="chat-days-detail-item__info">
              <span class="chat-days-detail-item__name">${f.name}</span>
              <span class="chat-days-detail-item__days">${f.days} 天</span>
            </div>
          </div>
        `).join('');

    return `
      <div class="chat-sub-page">
        <div class="chat-sub-page__header chat-sub-page__header--center">
          <button class="chat-sub-page__title chat-sub-page__title--button" data-action="go-profile" type="button">聊天天数详情</button>
        </div>
        <div class="chat-sub-page__body">
          <div class="chat-days-detail-total">
            <span class="chat-days-detail-total__num">${totalDays}</span>
            <span class="chat-days-detail-total__label">总聊天天数</span>
          </div>
          <div class="chat-days-detail-list">
            ${listHtml}
          </div>
        </div>
      </div>
    `;
  }

  return `<div class="chat-sub-page"><div class="chat-sub-page__header chat-sub-page__header--center"><button class="chat-sub-page__title chat-sub-page__title--button" data-action="go-profile" type="button">未知页面</button></div></div>`;
}

/* ========================================================================== */
export function getStickerGroupsWithAll(state) {
  const data = normalizeStickerData(state.stickerData);
  return [{ id: 'all', name: 'All' }, ...data.groups];
}


export function getStickerTargetGroupId(state) {
  const data = normalizeStickerData(state.stickerData);
  return data.activeGroupId && data.activeGroupId !== 'all'
    ? data.activeGroupId
    : 'all';
}


export function getVisibleStickers(state) {
  const data = normalizeStickerData(state.stickerData);
  if (data.activeGroupId === 'all') return data.items;
  return data.items.filter(item => item.groupId === data.activeGroupId);
}


export function showCreateStickerGroupModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 新建表情包分组弹窗 -->
    <div class="chat-modal-header">
      <span>新建表情包分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <input class="chat-modal-search"
           type="text"
           maxlength="12"
           placeholder="输入分组名称"
           data-role="sticker-group-name-input">
    <div class="chat-modal-notice" data-role="modal-notice"></div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-create-sticker-group" type="button">完成</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => {
    const input = panel.querySelector('[data-role="sticker-group-name-input"]');
    if (input) input.focus();
  }, 30);
}


export function showStickerPreviewModal(container, state, stickerId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const sticker = normalizeStickerData(state.stickerData).items.find(item => String(item.id) === String(stickerId));
  if (!mask || !panel || !sticker) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 表情包独立页单击放大预览弹窗 -->
    <div class="chat-modal-header sticker-preview-modal__header">
      <span>${escapeHtml(sticker.name || '表情包')}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="sticker-preview-modal__body">
      <img class="sticker-preview-modal__image" src="${escapeHtml(sticker.url)}" alt="${escapeHtml(sticker.name || '表情包')}">
    </div>
  `;

  mask.classList.remove('is-hidden');
}


export function showStickerUploadModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  state.pendingStickerLocalFile = null;
  const activeGroup = getStickerGroupsWithAll(state).find(group => group.id === getStickerTargetGroupId(state));

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 添加表情包弹窗 -->
    <div class="chat-modal-header">
      <span>添加表情包到 ${escapeHtml(activeGroup?.name || 'All')}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body chat-upload-modal-body sticker-upload-modal-body">
      <label class="chat-upload-option">
        <span class="chat-upload-option__icon">${TAB_ICONS.upload}</span>
        <span class="chat-upload-option__text">本地上传 jpg / png / gif</span>
        <input class="sticker-local-file-input" data-role="sticker-local-file-input" type="file" accept="image/jpeg,image/png,image/gif" hidden>
      </label>
      <input class="chat-modal-search" data-role="sticker-local-name-input" type="text" maxlength="24" placeholder="本地表情包名称">
      <div class="sticker-local-preview" data-role="sticker-local-preview"></div>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-add-local-sticker" type="button">添加本地表情包</button>

      <div class="sticker-import-divider"></div>

      <!-- ===== 闲谈表情包本地文件导入：txt/docx 批量导入 START ===== -->
      <label class="chat-upload-option">
        <span class="chat-upload-option__icon">${TAB_ICONS.fileText}</span>
        <span class="chat-upload-option__text">导入本地文件 txt / docx</span>
        <input class="sticker-import-file-input" data-role="sticker-import-file-input" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      </label>
      <div class="chat-modal-hint">文件内容支持“名称：图片URL”“名称 图片URL”或每行一个图片URL，导入后会自动加入当前分组。</div>
      <!-- ===== 闲谈表情包本地文件导入：txt/docx 批量导入 END ===== -->

      <div class="sticker-import-divider"></div>

      <label class="chat-upload-url-label">
        <span class="chat-upload-url-label__icon">${TAB_ICONS.link}</span>
        <span>URL 链接导入（支持单个 / 批量，一行一个）</span>
      </label>
      <textarea class="sticker-url-import-input"
                data-role="sticker-url-import-input"
                placeholder="开心：https://e.com/happy.jpg&#10;伤心：https://o.com/sad.jpg&#10;https://e.com/cute.gif"></textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-add-url-stickers" type="button">导入 URL</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}


export function parseStickerUrlImportText(text) {
  return String(text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      /* [区域标注·本次需求3] URL 解析：同时兼容 .jpg 与用户示例里的 ,jpg 写法 */
      const urlMatch = line.match(/https?:\/\/\S+[\.,](?:jpg|jpeg|png|gif)(?:[?#]\S*)?/i);
      if (!urlMatch) return null;
      const url = normalizeStickerUrl(urlMatch[0].replace(/[，,。；;）)]$/, ''));
      if (!isAllowedStickerUrl(url)) return null;

      const beforeUrl = line.slice(0, urlMatch.index).trim();
      const name = beforeUrl
        .replace(/[：:]\s*$/, '')
        .trim() || extractStickerNameFromUrl(url);

      return { name, url };
    })
    .filter(Boolean);
}

/* ===== 闲谈表情包本地文件导入：txt/docx 解析 END ===== */

export function showDeleteStickerGroupModal(container, state, groupId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const data = normalizeStickerData(state.stickerData);
  const group = data.groups.find(item => item.id === groupId);
  if (!mask || !panel || !group) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求3] 删除表情包分组确认弹窗 -->
    <div class="chat-modal-header">
      <span>删除表情包分组</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否删除“${escapeHtml(group.name)}”分组？<br>分组内表情包不会删除，会移动到 All。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-delete-sticker-group" data-sticker-group-id="${escapeHtml(group.id)}" type="button">删除</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}


export function createStickerGroupLongPressHandlers(state, container) {
  let timer = null;
  let pressedTarget = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pressedTarget = null;
  };

  const openDeleteModal = () => {
    const target = pressedTarget;
    if (!target) return;

    const groupId = target.dataset.stickerGroupId || '';
    const data = normalizeStickerData(state.stickerData);
    const exists = groupId && groupId !== 'all' && data.groups.some(group => group.id === groupId);
    if (!exists) return;

    target.dataset.longPressTriggered = '1';
    showDeleteStickerGroupModal(container, state, groupId);
    clearTimer();
  };

  return {
    pointerdown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target.closest('[data-long-press-action="delete-sticker-group"]');
      if (!target) return;

      clearTimer();
      pressedTarget = target;
      timer = window.setTimeout(openDeleteModal, 650);
    },
    pointerup: clearTimer,
    pointercancel: clearTimer,
    pointerleave: clearTimer,
    contextmenu(e) {
      if (e.target.closest('[data-long-press-action="delete-sticker-group"]')) {
        e.preventDefault();
      }
    }
  };
}


export function renderStickerSubPage(state) {
  const data = normalizeStickerData(state.stickerData);
  const groups = getStickerGroupsWithAll(state);
  const visibleStickers = getVisibleStickers(state);
  const selectedStickerIds = Array.isArray(state.selectedStickerIds) ? state.selectedStickerIds.map(String) : [];
  const selectedStickerSet = new Set(selectedStickerIds);
  const allVisibleSelected = visibleStickers.length > 0 && visibleStickers.every(item => selectedStickerSet.has(String(item.id)));

  const groupTabsHtml = groups.map(group => `
    <!-- [区域标注·本次需求3] 表情包分组：${escapeHtml(group.name)} -->
    <button class="chat-tab-btn sticker-group-tab-btn ${data.activeGroupId === group.id ? 'is-active' : ''}"
            data-action="switch-sticker-group"
            data-sticker-group-id="${escapeHtml(group.id)}"
            ${group.id !== 'all' ? 'data-long-press-action="delete-sticker-group"' : ''}
            type="button">
      ${escapeHtml(group.name)}
    </button>
  `).join('');

  const stickerGridHtml = visibleStickers.length
    ? visibleStickers.map(item => `
        <!-- [区域标注·本次需求3] 表情包独立页单击放大预览项：${escapeHtml(item.name)} -->
        <button class="sticker-grid-item ${state.stickerMultiSelectMode ? 'is-multi-selecting' : ''} ${selectedStickerSet.has(String(item.id)) ? 'is-selected' : ''}"
                data-action="${state.stickerMultiSelectMode ? 'toggle-sticker-multi-item' : 'open-sticker-preview'}"
                data-sticker-id="${escapeHtml(item.id)}"
                type="button"
                title="${escapeHtml(item.name)}">
          <div class="sticker-grid-item__thumb">
            <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
            ${state.stickerMultiSelectMode ? `<span class="sticker-grid-item__check">${selectedStickerSet.has(String(item.id)) ? ICON_CHECK : ''}</span>` : ''}
          </div>
          <div class="sticker-grid-item__name">${escapeHtml(item.name)}</div>
        </button>
      `).join('')
    : `<div class="sticker-empty">${TAB_ICONS.sticker}<p>当前分组还没有表情包<br>点击右上角 + 添加</p></div>`;

  const stickerMultiBarHtml = state.stickerMultiSelectMode ? `
    <!-- [区域标注·本次需求2] 表情包独立页多选删除悬浮底栏 -->
    <div class="sticker-multi-action-bar">
      <button class="sticker-multi-action-bar__btn" data-action="sticker-multi-cancel" type="button">${TAB_ICONS.close}<span>取消</span></button>
      <span class="sticker-multi-action-bar__count">已选 ${selectedStickerIds.length} 个</span>
      <button class="sticker-multi-action-bar__btn" data-action="sticker-multi-select-all" type="button">${allVisibleSelected ? ICON_CHECK : TAB_ICONS.plus}<span>${allVisibleSelected ? '取消全选' : '全选'}</span></button>
      <button class="sticker-multi-action-bar__btn sticker-multi-action-bar__btn--danger" data-action="sticker-multi-delete-selected" type="button" ${selectedStickerIds.length ? '' : 'disabled'}>${TAB_ICONS.close}<span>删除</span></button>
    </div>
  ` : '';

  return `
    <div class="chat-sub-page sticker-sub-page">
      <!-- ===== 用户主页表情包独立页面：标题栏 START ===== -->
      <div class="chat-sub-page__header chat-sub-page__header--center sticker-sub-page__header">
        <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">表情包</button>
        <button class="sticker-page-add-btn" data-action="open-sticker-upload-modal" type="button" aria-label="添加表情包">${TAB_ICONS.plus}</button>
      </div>
      <!-- ===== 用户主页表情包独立页面：标题栏 END ===== -->

      <!-- ===== 用户主页表情包独立页面：固定分组栏 START ===== -->
      <div class="sticker-group-tabs">
        <div class="sticker-group-tabs__scroller">
          ${groupTabsHtml}
          <button class="sticker-group-add-tab" data-action="create-sticker-group" type="button" aria-label="新建表情包分组">${TAB_ICONS.plus}</button>
        </div>
      </div>
      <!-- ===== 用户主页表情包独立页面：固定分组栏 END ===== -->

      <!-- ===== 用户主页表情包独立页面：可滚动表情包列表 START ===== -->
      <div class="sticker-list-scroll ${state.stickerMultiSelectMode ? 'is-multi-selecting' : ''}">
        <div class="sticker-grid">
          ${stickerGridHtml}
        </div>
      </div>
      <!-- ===== 用户主页表情包独立页面：可滚动表情包列表 END ===== -->

      ${stickerMultiBarHtml}
    </div>
  `;
}

/* ========================================================================== */
/*   [区域标注·已完成·闲谈大文件拆分·收藏模块接线]                             */
/*   说明：收藏页面、收藏分组、HTML收藏卡片、多选与移动弹窗已迁移到 profile-favorites.js。 */
/* ========================================================================== */

/* ========================================================================== */
export async function importStickerTextToCurrentGroup(container, state, db, text) {
  const parsed = parseStickerUrlImportText(text);
  if (!parsed.length) {
    renderModalNotice(container, '未解析到有效表情包；请使用“名称：图片URL”或每行一个图片URL');
    return;
  }

  const data = normalizeStickerData(state.stickerData);
  const targetGroupId = getStickerTargetGroupId(state);
  const now = Date.now();
  const newItems = parsed.map((item, index) => ({
    id: createUid('sticker'),
    groupId: targetGroupId,
    name: item.name,
    url: item.url,
    source: 'file-import',
    createdAt: now + index
  }));

  state.stickerData = {
    ...data,
    items: [...data.items, ...newItems]
  };
  await persistStickerData(state, db);
  closeModal(container);

  /* ========================================================================
     [区域标注·本次修复2-已完成] 表情包导入后页面刷新修复（避免未定义函数导致后续页面异常）
     说明：profile.js 内不直接调用 index.js 私有函数，改为就地刷新子页面容器。
     ======================================================================== */
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (msgWrap && state.subPageView === 'sticker') {
    msgWrap.innerHTML = renderStickerSubPage(state);
  }
}


export async function readDocxText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entry = findZipEntry(bytes, 'word/document.xml');
  if (!entry) throw new Error('未找到 docx 正文内容');

  const xmlBytes = entry.compression === 0
    ? entry.data
    : await inflateRawZipData(entry.data);

  return parseDocxXmlText(new TextDecoder('utf-8').decode(xmlBytes));
}


export function parseDocxXmlText(xmlText) {
  return String(xmlText || '')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map(line => decodeXmlText(line).trim())
    .filter(Boolean)
    .join('\n');
}


export function findZipEntry(bytes, fileName) {
  const decoder = new TextDecoder('utf-8');
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (bytes[index] !== 0x50 || bytes[index + 1] !== 0x4b || bytes[index + 2] !== 0x05 || bytes[index + 3] !== 0x06) continue;

    const view = new DataView(bytes.buffer, bytes.byteOffset + index, 22);
    const centralDirSize = view.getUint32(12, true);
    const centralDirOffset = view.getUint32(16, true);
    let offset = centralDirOffset;
    const end = centralDirOffset + centralDirSize;

    while (offset < end && bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x01 && bytes[offset + 3] === 0x02) {
      const entryView = new DataView(bytes.buffer, bytes.byteOffset + offset, 46);
      const compression = entryView.getUint16(10, true);
      const compressedSize = entryView.getUint32(20, true);
      const fileNameLength = entryView.getUint16(28, true);
      const extraLength = entryView.getUint16(30, true);
      const commentLength = entryView.getUint16(32, true);
      const localHeaderOffset = entryView.getUint32(42, true);
      const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

      if (name === fileName) {
        const localView = new DataView(bytes.buffer, bytes.byteOffset + localHeaderOffset, 30);
        const localNameLength = localView.getUint16(26, true);
        const localExtraLength = localView.getUint16(28, true);
        const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
        return {
          compression,
          data: bytes.slice(dataStart, dataStart + compressedSize)
        };
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    break;
  }
  return null;
}


export async function inflateRawZipData(compressedData) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('当前浏览器不支持 docx 解压解析，请改用 txt 导入');
  }

  const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}


export function decodeXmlText(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}


export function normalizeStickerUrl(url) {
  return String(url || '').trim().replace(/,(jpg|jpeg|png|gif)(?=([?#]|$))/i, '.$1');
}


export function isAllowedStickerUrl(url) {
  return /^https?:\/\/.+\.(jpg|jpeg|png|gif)(?:[?#].*)?$/i.test(normalizeStickerUrl(url));
}


export function extractStickerNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const fileName = decodeURIComponent((parsed.pathname.split('/').pop() || '表情包').replace(/\.(jpg|jpeg|png|gif)$/i, ''));
    return fileName || '表情包';
  } catch {
    return '表情包';
  }
}
