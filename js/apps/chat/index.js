// @ts-nocheck
/**
 * 文件名: js/apps/chat/index.js
 * 用途: 闲谈应用入口模块。
 *       负责加载 CSS、初始化数据、渲染四大板块骨架、
 *       管理板块切换、事件代理、聊天消息页面跳转等。
 *       使用 DB.js（IndexedDB）进行持久化存储，禁止浏览器同步键值存储。
 * 架构层: 应用层（由 AppManager 动态加载）
 */

/* ==========================================================================
   [区域标注] 子模块导入
   说明：四大板块 + 聊天消息页面，各自独立 JS 文件
   ========================================================================== */
import {
  TAB_ICONS,
  APP_ID,
  STORE_NAME,
  ARCHIVE_DB_RECORD_ID,
  DATA_KEY_SESSIONS,
  DATA_KEY_HIDDEN_CHAT_IDS,
  DATA_KEY_CONTACTS,
  DATA_KEY_CONTACT_GROUPS,
  DATA_KEY_MOMENTS,
  DATA_KEY_MESSAGES_PREFIX,
  DATA_KEY_CHAT_PROMPT_SETTINGS,
  getCurrentChatPromptSettingsKey,
  DATA_KEY_STICKERS,
  DATA_KEY_WALLET,
  DATA_KEY_FAVORITES,
  PANEL_KEYS,
  PANEL_LABELS,
  PANEL_ICON_KEYS,
  ICON_BACK,
  ICON_CHECK,
  loadCSS,
  removeCSS,
  dbGet,
  dbPut,
  escapeHtml,
  normalizeContactGroups,
  normalizeContacts,
  normalizeStickerData,
  normalizeWalletData,
  normalizeFavoriteData,
  persistWalletData,
  persistFavoriteData,
  loadStickerDataFromDb,
  persistStickerData,
  createUid,
  getBoundRoleCandidates,
  dbGetArchiveData,
  renderModalNotice,
  closeModal
} from './chat-utils.js';
import { chat, normalizeChatPromptSettings } from './prompt.js';
import { renderChatList, getVisibleChatSessions, showAddChatModal, createChatListLongPressHandlers } from './chat-list.js';
/* ======================================================================
   [区域标注·已完成·旁白模式] 导入旁白模式独立模块
   说明：旁白弹窗、设置读取、退出确认、状态检测等均由 chat-aside.js 提供。
   ====================================================================== */
import {
  showAsideEnterModal,
  readAsideSettingsFromModal,
  showAsideExitConfirmModal,
  isAsideModeActive,
  getDefaultAsideSettings,
  normalizeAsideSettings,
  loadAsideModeState,
  persistAsideModeState
} from './chat-aside.js';
import {
  renderContacts,
  showAddContactModal,
  renderContactSearchResults,
  showCreateContactGroupModal,
  showContactGroupPickerModal,
  createContactGroupLongPressHandlers
} from './contacts.js';
import {
  sendMessage,
  persistCurrentMessages,
  repairAiMessageFormatIfPossible,
  repairAiTextMessageFormatIfPossible,
  repairAiQuoteMessageFormatIfPossible,
  repairAiSystemTipFormatIfPossible,
  repairAiVoiceMessageFormatIfPossible,
  repairAiAsideMessageFormatIfPossible,
  sendStickerMessage,
  sendImageMessage,
  renderCurrentChatMessage,
  appendCurrentMessageBubble,
  refreshMessageBubbleRows,
  refreshCurrentMessageListOnly,
  updateMultiSelectActionBar,
  resetMessageSelectionState,
  getSelectedMessages,
  refreshCurrentSessionLastMessage,
  retryLatestAiReply,
  syncMessageDockOpenState,
  syncChatConsoleDock,
  renderMsgStickerPanelGrid,
  syncMountedStickerGroupButtons,
  showAiFormatRepairTypeModal,
  showAiWithdrawnMessageModal,
  showUserWithdrawMessageModal,
  showAiFormatRepairResultModal,
  showEditMessageModal,
  showEditAsideModal,
  showForwardMessagesModal,
  showMessageImageModal,
  showMessageTransferModal,
  showTransferActionModal,
  showChatAvatarUrlModal,
  showChatAvatarCropModal,
  updateChatAvatarCropPreview,
  buildChatAvatarFromCropModal,
  createQuotePayloadFromMessage,
  syncPendingQuoteComposer,
  syncStickerInputSuggestions,
  syncChatMessageSearchPanel,
  scrollToChatSearchResult
} from './chat-message.js';
import {
  clearCurrentChatMessages,
  expireCurrentChatImages,
  showClearAllMessagesModal,
  showClearCurrentChatImagesModal
} from './chat-cleanup-settings.js';
import {
  renderProfile,
  buildProfileFromMask,
  showMaskSwitcherModal,
  renderSubPage,
  calculateSessionRunningChatDays,
  getStickerTargetGroupId,
  getVisibleStickers,
  showCreateStickerGroupModal,
  showStickerPreviewModal,
  showStickerUploadModal,
  parseStickerUrlImportText,
  createStickerGroupLongPressHandlers,
  getVisibleFavoriteItems,
  addMessagesToFavorites,
  showCreateFavoriteGroupModal,
  showCreateFavoriteSubGroupModal,
  showFavoriteFilterModal,
  showFavoritePreviewModal,
  createFavoriteGroupLongPressHandlers,
  createFavoriteCardLongPressHandlers,
  showMoveFavoriteToGroupModal,
  importStickerTextToCurrentGroup,
  readDocxText,
  showWalletRechargeModal,
  showWalletCurrencyModal,
  getWalletDisplayAmount,
  formatWalletMoney
} from './profile.js';
import {
  renderMoments,
  MOMENTS_COMPOSE_MAX_IMAGES,
  createMomentsComposeDraft,
  normalizeMomentsComposeDraft,
  ensureMomentsComposeDraft,
  getMomentsComposeShareTarget,
  buildMomentsComposeShareMessage,
  renderMomentsComposeIntoPage,
  openMomentsComposePage,
  closeMomentsComposePage,
  openMomentsComposeImageUrlModal,
  openMomentsComposeLocationModal,
  openMomentsComposeShareModal,
  openMomentsComposeVisibilityModal,
  createMomentsInteractionState,
  resetMomentsInteractionState,
  getMomentsRenderOptions,
  handleMomentsInteractionAction
} from './moments.js';
/* ==========================================================================
   [区域标注·已完成·语言翻译] 导入语言翻译独立模块
   说明：
   1. 折叠栏 HTML 生成由 chat-message.js 调用 renderTranslationSettingsHtml。
   2. 本入口文件负责事件委托（设置页点击 + 消息气泡双击展开）。
   3. 持久化只使用 DB.js / IndexedDB，禁止 localStorage/sessionStorage。
   ========================================================================== */
import {
  handleTranslationSettingsClick,
  handleTranslationBubbleDblClick,
  normalizeTranslationSettings
} from './chat-translation.js';
/* ==========================================================================
   [区域标注·已完成·心声面板] 导入心声面板模块
   说明：心声面板独立模块，提供面板打开/关闭、心声数据查找等功能。
   ========================================================================== */
import {
  openInnerVoicePanel,
  findInnerVoiceForMessage,
  findLatestInnerVoice,
  isAssistantAvatarClick,
  getMessageIdFromAvatarClick
} from './chat-inner-voice.js';
/* ==========================================================================
   [区域标注·已完成·礼物板块入口接入]
   说明：
   1. 咖啡功能区“礼物”弹窗、直接购买、代付请求均由独立 chat-gift.js 提供。
   2. 本入口文件只负责事件接线与 IndexedDB 持久化流程调度，方便后续只改礼物模块。
   3. 禁止 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
import {
  createGiftPayRequestMessage,
  parseGiftDraftFromModal,
  sendGiftMessage,
  showMessageGiftModal
} from './chat-gift.js';
/* ==========================================================================
   [区域标注·已完成·文字图板块入口接入]
   说明：
   1. 咖啡功能区“文字图”的弹窗、消息构造与悬浮预览由独立 chat-text-image.js 提供。
   2. 本入口文件只负责事件接线与 DB.js / IndexedDB 持久化流程调度。
   3. 禁止 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
import {
  createTextImageMessage,
  openTextImagePreview,
  parseTextImageDraftFromModal,
  showTextImageModal,
  validateTextImageDraft
} from './chat-text-image.js';
/* ==========================================================================
   [区域标注·已完成·语音板块入口接入]
   说明：
   1. 咖啡功能区“语音”的弹窗、消息构造与语音转文字气泡展开由独立 chat-voice.js 提供。
   2. 本入口文件只负责事件接线与 DB.js / IndexedDB 持久化流程调度。
   3. 禁止 localStorage/sessionStorage，不做双份存储兜底，不按长文本字段过滤。
   ========================================================================== */
import {
  createVoiceMessage,
  parseVoiceDraftFromModal,
  showVoiceMessageModal
} from './chat-voice.js';
/* ========================================================================
   [区域标注·已完成·聊天记录导入导出入口接入]
   说明：
   1. 导入/导出 UI、格式构建、JSON 校验均由 chat-export-import.js 独立维护，后续只改该文件即可调整本板块功能。
   2. 本入口文件只负责事件接线与 DB.js / IndexedDB 落库，禁止 localStorage/sessionStorage。
   3. 导入后直接替换当前会话消息并刷新聊天消息页，不写双份兜底，不按长文本字段过滤。
   ======================================================================== */
import {
  exportCurrentChatMessages,
  openChatImportJsonFilePicker,
  readAndValidateChatImportJsonFile,
  showChatExportFormatModal,
  showChatExportImportNoticeModal
} from './chat-export-import.js';

/* ========================================================================
   [区域标注·已完成·本次控制台持久显示与后台记录修复] 聊天日志与显示开关存储键（IndexedDB）
   说明：
   1. 严格使用 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   2. chat_console 保存当前会话日志；chat_console_enabled 只保存用户是否显示聊天页控制台抽屉。
   3. 日志后台记录不依赖显示开关，用户手动关闭开关才隐藏抽屉。
   ======================================================================== */
const DATA_KEY_CHAT_CONSOLE = (maskId, chatId) => `chat_console::${maskId || 'default'}::${chatId || 'none'}`;
const DATA_KEY_CHAT_CONSOLE_ENABLED = (maskId, chatId) => `chat_console_enabled::${maskId || 'default'}::${chatId || 'none'}`;
/* ===== [区域标注·已完成·语言翻译] IndexedDB 数据键 ===== */
const DATA_KEY_CHAT_TRANSLATION_SETTINGS = (maskId, chatId) => `chat_translation_settings::${maskId || 'default'}::${chatId || 'none'}`;

/* ===== [区域标注·本次朋友圈标题栏按钮] Moments 右侧爱心图标，仅用于朋友圈标题栏运行时显示 ===== */
const ICON_MOMENTS_HEART = `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A11.007 11.007 0 0 0 15 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`;

/* ========================================================================
   [区域标注·已完成·本次聊天记录分段加载] 消息页可见数量运行时配置
   说明：
   1. 默认只让聊天界面渲染最新 100 条消息，点击“加载更多消息”后每次增加 100 条。
   2. 该值仅作为当前页面运行时查看状态，不写入 IndexedDB，也不使用 localStorage/sessionStorage。
   3. state.currentMessages 始终保留完整聊天记录，AI 历史上下文不受本区域影响。
   ======================================================================== */
const CHAT_MESSAGE_INITIAL_VISIBLE_COUNT = 100;
const CHAT_MESSAGE_LOAD_MORE_STEP = 100;

function normalizeChatConsoleLogs(logs) {
  return Array.isArray(logs)
    ? logs.slice(-500).map(item => ({
        id: String(item?.id || `log_${Date.now()}_${Math.random().toString(16).slice(2)}`),
        ts: Number(item?.ts || Date.now()) || Date.now(),
        time: String(item?.time || new Date(Number(item?.ts || Date.now())).toLocaleTimeString('zh-CN', { hour12: false })),
        level: String(item?.level || 'info').toLowerCase(),
        text: String(item?.text || '')
      }))
    : [];
}

async function persistCurrentChatConsoleLogs(state, db) {
  if (!state?.currentChatId) return;
  await dbPut(
    db,
    DATA_KEY_CHAT_CONSOLE(state.activeMaskId, state.currentChatId),
    normalizeChatConsoleLogs(state.chatConsoleLogs)
  );
}

async function persistCurrentChatConsoleEnabled(state, db) {
  if (!state?.currentChatId) return;
  await dbPut(
    db,
    DATA_KEY_CHAT_CONSOLE_ENABLED(state.activeMaskId, state.currentChatId),
    Boolean(state.chatConsoleEnabled)
  );
}

async function addChatConsoleLog(container, state, db, level, text) {
  if (!state?.currentChatId) return;
  const ts = Date.now();
  const entry = {
    id: `log_${ts}_${Math.random().toString(16).slice(2)}`,
    ts,
    time: new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }),
    level: String(level || 'info').toLowerCase(),
    text: String(text || '').trim()
  };
  if (!entry.text) return;
  state.chatConsoleLogs = [...state.chatConsoleLogs, entry].slice(-500);
  await persistCurrentChatConsoleLogs(state, db);
  syncChatConsoleDock(container, state);
}

/* ==========================================================================
   [区域标注·已完成·聊天输入框一至三行自适应]
   说明：
   1. 仅同步闲谈消息页底部 data-role="msg-input" 的 textarea 高度。
   2. 初始一行，输入内容增多时最高三行；超过三行后 textarea 内部滚动。
   3. 不涉及任何持久化存储，不使用 localStorage/sessionStorage，不改变图标按钮尺寸。
   ========================================================================== */
function syncMessageInputAutoHeight(input) {
  if (!input?.matches?.('[data-role="msg-input"]')) return;
  input.style.height = 'auto';
  const maxHeight = Number.parseFloat(window.getComputedStyle(input).maxHeight) || 76;
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
}

/* ==========================================================================
   [区域标注·已完成·档案联系人解绑/删除后闲谈级联清理]
   说明：
   1. 当档案应用取消当前面具绑定角色，或删除已绑定角色后，闲谈会同步清理该联系人。
   2. 清理范围仅限当前面具下的通讯录、聊天列表、隐藏列表、朋友圈、收藏来源、当前聊天消息与聊天设置。
   3. 持久化统一只写 DB.js / IndexedDB，不使用 localStorage/sessionStorage，不写双份兜底存储。
   4. 不使用长文本字段过滤逻辑；只按联系人/角色 ID 与旧数据名称做精确级联清理。
   ========================================================================== */
async function syncArchiveBoundContactCleanup(container, state, db, archiveData) {
  const safeArchive = archiveData && typeof archiveData === 'object' ? archiveData : {};
  const masks = Array.isArray(safeArchive.masks) ? safeArchive.masks : [];
  const activeMask = masks.find(mask => String(mask?.id || '') === String(state.activeMaskId || '')) || null;
  const boundRoleIds = new Set(Array.isArray(activeMask?.roleBindingIds) ? activeMask.roleBindingIds.map(String) : []);
  const contacts = normalizeContacts(state.contacts);
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const hiddenChatIds = Array.isArray(state.hiddenChatIds) ? state.hiddenChatIds.map(String) : [];
  const moments = Array.isArray(state.moments) ? state.moments : [];
  const favoriteData = normalizeFavoriteData(state.favoriteData);

  const removedContactIds = new Set();
  const removedContactNames = new Set();

  contacts.forEach(contact => {
    const contactId = String(contact?.id || '').trim();
    const roleId = String(contact?.roleId || contactId).trim();
    if (!roleId || !boundRoleIds.has(roleId)) {
      if (contactId) removedContactIds.add(contactId);
      if (roleId) removedContactIds.add(roleId);
      const name = String(contact?.name || '').trim();
      if (name) removedContactNames.add(name);
    }
  });

  sessions.forEach(session => {
    const sessionId = String(session?.id || '').trim();
    const roleId = String(session?.roleId || sessionId).trim();
    const type = String(session?.type || 'private');
    if (type !== 'group' && roleId && !boundRoleIds.has(roleId)) {
      if (sessionId) removedContactIds.add(sessionId);
      if (roleId) removedContactIds.add(roleId);
      const name = String(session?.name || '').trim();
      if (name) removedContactNames.add(name);
    }
  });

  if (!removedContactIds.size) {
    state.contacts = contacts;
    state.sessions = sessions;
    state.hiddenChatIds = hiddenChatIds;
    state.moments = moments;
    state.favoriteData = favoriteData;
    return false;
  }

  const isRemovedId = value => removedContactIds.has(String(value || '').trim());
  const isRemovedName = value => {
    const name = String(value || '').trim();
    return !!name && removedContactNames.has(name);
  };

  const nextContacts = contacts.filter(contact => {
    const contactId = String(contact?.id || '').trim();
    const roleId = String(contact?.roleId || contactId).trim();
    return !isRemovedId(contactId) && !isRemovedId(roleId);
  });

  const nextSessions = sessions.filter(session => {
    const sessionId = String(session?.id || '').trim();
    const roleId = String(session?.roleId || sessionId).trim();
    return !isRemovedId(sessionId) && !isRemovedId(roleId);
  });

  const nextHiddenChatIds = hiddenChatIds.filter(id => !isRemovedId(id));

  const nextMoments = moments
    .filter(moment => {
      const authorIds = [
        moment?.authorId,
        moment?.authorRoleId,
        moment?.roleId,
        moment?.contactId,
        moment?.userId
      ];
      return !authorIds.some(isRemovedId) && !isRemovedName(moment?.authorName);
    })
    .map(moment => ({
      ...moment,
      likes: Array.isArray(moment?.likes)
        ? moment.likes.filter(like => {
            if (typeof like === 'string') return !isRemovedId(like) && !isRemovedName(like);
            return ![like?.id, like?.roleId, like?.contactId, like?.userId].some(isRemovedId) && !isRemovedName(like?.name || like?.authorName);
          })
        : moment?.likes,
      comments: Array.isArray(moment?.comments)
        ? moment.comments.filter(comment => (
            ![comment?.authorId, comment?.authorRoleId, comment?.roleId, comment?.contactId, comment?.userId].some(isRemovedId)
            && !isRemovedName(comment?.authorName)
          ))
        : moment?.comments
    }));

  const nextFavoriteData = normalizeFavoriteData({
    ...favoriteData,
    items: favoriteData.items.filter(item => !isRemovedId(item?.sourceChatId))
  });

  const removedIds = Array.from(removedContactIds);
  state.contacts = nextContacts;
  state.sessions = nextSessions;
  state.hiddenChatIds = nextHiddenChatIds;
  state.moments = nextMoments;
  state.favoriteData = nextFavoriteData;
  if (isRemovedId(state.currentChatId)) {
    closeChatMessage(container, state);
  }

  await Promise.all([
    dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
    dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(state.activeMaskId), state.hiddenChatIds),
    dbPut(db, DATA_KEY_MOMENTS(state.activeMaskId), state.moments),
    dbPut(db, DATA_KEY_FAVORITES(state.activeMaskId), state.favoriteData),
    ...removedIds.map(id => dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + id, [])),
    ...removedIds.map(id => dbPut(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId, id), null))
  ]);

  return true;
}

/* ==========================================================================
   [区域标注] mount — 应用挂载入口
   说明：由 AppManager 调用，接收容器元素和上下文
   ========================================================================== */
export async function mount(container, context) {
  const { appMeta, eventBus, db, windowManager, settings } = context;

  /* ==========================================================================
     [区域标注·修改5] 并行预加载 CSS + 档案数据
     说明：先加载 CSS 和档案数据，确定当前激活面具后再加载对应面具的聊天数据
     ========================================================================== */
  await Promise.all([
    loadCSS('./js/apps/chat/chat.css', 'chat-app-css'),
    /* ======================================================================
       [区域标注·已完成·本次朋友圈独立样式预加载] 朋友圈页面专用 CSS
       说明：
       1. 朋友圈 Editorial Minimal UI 样式已拆分到 moments.css。
       2. 挂载阶段与闲谈主样式并行加载，避免首次切到朋友圈时出现无样式闪屏。
       3. 仅服务朋友圈页面，不改变其它闲谈板块样式加载逻辑。
       ====================================================================== */
    loadCSS('./js/apps/chat/moments.css', 'chat-moments-css'),
    /* [区域标注·本次需求5] 等待聊天消息页 CSS 加载完成，避免首次进入消息页时未样式化 */
    loadCSS('./js/apps/chat/chat-message.css', 'chat-msg-css'),
    /* ======================================================================
       [区域标注·已完成·HTML卡片独立样式预加载] 聊天 HTML 卡片专用 CSS
       说明：
       1. 单独拆分 chat-html-card.css，方便后续只改 HTML 卡片样式。
       2. 挂载阶段与聊天主样式并行预加载，减少首次出现卡片时的未样式化闪屏。
       3. 仅服务本次 HTML 卡片功能，不改其它聊天功能样式加载逻辑。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-html-card.css', 'chat-html-card-css'),
    /* ======================================================================
       [区域标注·已完成·心声面板] 加载心声面板 CSS
       说明：与聊天主样式并行预加载，避免首次打开心声面板时的未样式化闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-inner-voice.css', 'chat-inner-voice-css'),
    /* ======================================================================
       [区域标注·已完成·礼物板块独立样式预加载]
       说明：礼物弹窗与礼物卡片样式拆分到 chat-gift.css，挂载时预加载以避免首次打开闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-gift.css', 'chat-gift-css'),
    /* ======================================================================
       [区域标注·已完成·文字图独立样式预加载]
       说明：文字图弹窗、拍立得气泡与无关闭按钮悬浮预览样式拆分到 chat-text-image.css，挂载时预加载以避免首次打开闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-text-image.css', 'chat-text-image-css'),
    /* ======================================================================
       [区域标注·已完成·语音板块独立样式预加载]
       说明：语音弹窗与语音气泡样式拆分到 chat-voice.css，挂载时预加载以避免首次打开闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-voice.css', 'chat-voice-css'),
    /* ======================================================================
       [区域标注·已完成·旁白模式独立样式预加载]
       说明：旁白弹窗、旁白气泡、顶栏退出按钮样式拆分到 chat-aside.css，挂载时预加载以避免首次打开闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-aside.css', 'chat-aside-css'),
    /* ======================================================================
       [区域标注·已完成·语言翻译CSS] 预加载语言翻译折叠栏 & 翻译气泡样式
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-translation.css', 'chat-translation-css'),
    /* ======================================================================
       [区域标注·已完成·聊天记录导入导出CSS] 预加载设置页导入导出板块样式
       说明：样式拆分到 chat-export-import.css，挂载时预加载以避免首次进入聊天设置页闪屏。
       ====================================================================== */
    loadCSS('./js/apps/chat/chat-export-import.css', 'chat-export-import-css')
  ]);

  const archiveRecord = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);

  /* [修改5·修改6] 解析档案数据，获取当前激活面具 */
  const archiveData = (archiveRecord && typeof archiveRecord === 'object') ? archiveRecord : {};
  const archiveMasks = Array.isArray(archiveData.masks) ? archiveData.masks : [];
  /* [区域标注·本次需求2] 缓存角色档案，用于通过绑定角色联系方式搜索添加通讯录 */
  const archiveCharacters = Array.isArray(archiveData.characters) ? archiveData.characters : [];
  /* [区域标注·本次修改4] 缓存档案关系网络，供 prompt.js 注入用户面具身份绑定关系 */
  const archiveSupportingRoles = Array.isArray(archiveData.supportingRoles) ? archiveData.supportingRoles : [];
  const archiveRelations = Array.isArray(archiveData.relations) ? archiveData.relations : [];
  const currentActiveMaskId = archiveData.activeMaskId || '';

  /* [修改5] 按当前面具ID加载对应数据 */
  const [sessions, hiddenChatIds, contacts, contactGroups, moments, stickerData, walletData, favoriteData] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_HIDDEN_CHAT_IDS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACTS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(currentActiveMaskId)),
    dbGet(db, DATA_KEY_MOMENTS(currentActiveMaskId)),
    loadStickerDataFromDb(db),
    dbGet(db, DATA_KEY_WALLET(currentActiveMaskId)),
    dbGet(db, DATA_KEY_FAVORITES(currentActiveMaskId))
  ]);

  /* [区域标注] 应用状态对象 */
  const state = {
    /* [已完成·HTML卡片收藏] 缓存 db 引用，供 handleDoubleClick 等非闭包函数使用 */
    _db: db,
    activePanel: 'chatList',        // 当前激活的板块
    chatSubTab: 'all',              // 聊天列表子TAB: all / private / group
    chatSearchKeyword: '',          // 聊天列表搜索词
    sectionCollapsed: {},           // 折叠状态 {private: false, group: false}
    sessions: sessions || [],       // 聊天会话列表
    /* === [本次修改] 聊天列表长按删除联系人：隐藏列表单独持久化，避免删除通讯录/消息/聊天设置 === */
    hiddenChatIds: Array.isArray(hiddenChatIds) ? hiddenChatIds.map(String) : [],
    contacts: normalizeContacts(contacts), // 通讯录好友列表
    /* [区域标注·本次需求1] 通讯录自定义分组；All 为固定默认分组，不写入数组 */
    contactGroups: normalizeContactGroups(contactGroups),
    activeContactGroupId: 'all',
    moments: moments || [],         // 朋友圈动态列表
    /* ========================================================================
       [区域标注·已完成·本次朋友圈独立发帖页] 朋友圈发帖页运行时状态
       说明：
       1. 仅服务朋友圈独立发帖页，不影响聊天/通讯录/用户主页其它区域。
       2. 草稿、可见范围、多图列表都只保存在当前运行时；正式发送后才统一写入 DB.js / IndexedDB。
       3. 严禁使用 localStorage/sessionStorage，不做双份存储兜底。
       ======================================================================== */
    momentsComposeOpen: false,
    momentsComposeDraft: {
      text: '',
      images: [],
      location: '',
      shareChatId: '',
      visibilityMode: 'public',
      visibleContactIds: []
    },
    /* ========================================================================
       [区域标注·已完成·本次朋友圈点赞评论互动模块化接线] 朋友圈互动运行时 UI 状态
       说明：
       1. index.js 仅挂载评论展开、回复目标等运行时状态。
       2. 点赞、评论展开、发表评论与回复评论的主要逻辑已移至 moments.js。
       3. 数据本体统一通过接线回调写入 DATA_KEY_MOMENTS(activeMaskId) 的 IndexedDB 记录。
       4. 不使用 localStorage/sessionStorage，不做双份存储兜底。
       ======================================================================== */
    ...createMomentsInteractionState(),
    profile: {},                    // 用户资料（由面具数据生成）
    currentChatId: null,            // 当前打开的聊天会话 ID（null 表示未打开）
    currentMessages: [],            // 当前聊天消息列表
    /* ========================================================================
       [区域标注·已完成·本次聊天记录分段加载] 当前聊天界面可见消息数量
       说明：只影响当前页面渲染多少条历史消息；不裁剪 currentMessages，不影响 AI 上下文。
       ======================================================================== */
    chatMessageVisibleCount: CHAT_MESSAGE_INITIAL_VISIBLE_COUNT,
    destroyed: false,               // 是否已销毁
    /* [修改5] 当前激活面具ID */
    activeMaskId: currentActiveMaskId,
    /* [修改5] 档案面具列表缓存 */
    archiveMasks: archiveMasks,
    /* [区域标注·本次需求2] 档案角色列表缓存，用于通讯录搜索 */
    archiveCharacters: archiveCharacters,
    /* [区域标注·本次修改4] 档案配角与关系网络缓存，用于提示词用户面具身份关系网络 */
    archiveSupportingRoles: archiveSupportingRoles,
    archiveRelations: archiveRelations,
    /* [区域标注·已修改] 聊天提示词设置：打开具体聊天对象时按“当前面具 + 当前联系人”从 IndexedDB 读取 */
    chatPromptSettings: normalizeChatPromptSettings(null),
    /* [区域标注·本次需求3] 表情包分组与条目：全局共享资产，只从 IndexedDB 读取 */
    stickerData: normalizeStickerData(stickerData),
    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页运行时状态
       说明：
       1. 钱包余额基础值、显示币种、汇率设置统一只从 DB.js / IndexedDB 读取。
       2. walletDraftCurrency 仅用于弹窗中的临时选择态，不做双份存储。
       ========================================================================== */
    walletData: normalizeWalletData(walletData),
    walletDraftCurrency: '',
    /* [区域标注·已完成·收藏运行时状态] 收藏页数据与选择状态，持久化只走 DB.js / IndexedDB */
    favoriteData: normalizeFavoriteData(favoriteData),
    favoriteMultiSelectMode: false,
    selectedFavoriteIds: [],
    /* [区域标注·本次需求3] 聊天消息页表情包面板运行时状态 */
    stickerPanelOpen: false,
    stickerPanelGroupId: normalizeStickerData(stickerData).activeGroupId || 'all',
    coffeeDockOpen: false,
    /* ======================================================================
       [区域标注·已完成·旁白模式防自动退出修复] 旁白模式运行时状态字段
       说明：
       1. asideModeActive — 当前会话是否处于旁白模式（打开会话时会从 IndexedDB 恢复）。
       2. asideSettings — 旁白人称/风格/字数/显示模式等设置对象。
       3. asideHistory — 旁白模式期间每轮旁白摘要数组，随旁白状态一起写入 IndexedDB。
       4. 只有点击顶栏爱心并确认退出，才会将 active:false 持久化。
       ====================================================================== */
    asideModeActive: false,
    asideSettings: getDefaultAsideSettings(),
    asideHistory: [],
    /* [区域标注·本次需求] 聊天 API 调用状态 */
    isAiSending: false,
    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡选择状态
       说明：仅保存在运行时；消息持久化仍只写 DB.js / IndexedDB。
       ========================================================================== */
    selectedMessageId: '',
    /* ========================================================================
       [区域标注·已完成·本次旁白功能栏编辑指向修复] 当前选中的旁白段 id
       说明：
       1. 用于区分当前打开工具栏的是普通消息气泡还是旁白气泡。
       2. 仅运行时保存，不写入 DB.js / IndexedDB。
       ======================================================================== */
    selectedAsideSegmentId: '',
    multiSelectMode: false,
    selectedMessageIds: [],
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: '',
    /* ===== 闲谈：删除消息二次确认 END ===== */
    /* ========================================================================
       [区域标注·已完成·消息回溯] 气泡功能栏回溯二次确认状态
       说明：
       1. 仅运行时保存当前等待“确认回溯”的消息 ID。
       2. 确认后删除该消息之后的所有消息（含系统小字），并统一写入 DB.js / IndexedDB。
       3. 不使用 localStorage/sessionStorage，不做双份存储兜底。
       ======================================================================== */
    rewindConfirmMessageId: '',
    /* ========================================================================
       [区域标注·已完成·引用回复] 当前输入栏待引用对象
       说明：仅运行时保存；发送消息时 quote 字段随消息对象写入 DB.js / IndexedDB。
       ======================================================================== */
    pendingQuote: null,
    /* ========================================================================
       [区域标注·已完成·聊天记录搜索] 消息页搜索运行时状态
       说明：
       1. 仅在当前聊天消息页运行时保存搜索框开合与关键词，不做持久化存储。
       2. 搜索范围包含用户与 AI 消息气泡；点击结果后回滚到对应消息位置。
       3. 不使用 localStorage/sessionStorage，不使用原生浏览器弹窗或原生选择器。
       ======================================================================== */
    chatMessageSearchOpen: false,
    chatMessageSearchKeyword: '',
    /* [修改4] 用于子页面导航的堆栈标记 */
    subPageView: null,              // null | 'wallet' | 'sticker' | 'chatDaysDetail'
    /* [区域标注·本次需求2] 表情包独立页多选删除运行时状态 */
    stickerMultiSelectMode: false,
    selectedStickerIds: [],
    /* [区域标注·本次需求3] 表情包本地上传临时预览，不持久化；确认后才写入 IndexedDB */
    pendingStickerLocalFile: null,
    /* [区域标注·本次需求3] 表情包独立页单击放大预览延迟计时器；仅运行时使用，不持久化 */
    stickerPreviewClickTimer: 0,

    /* ========================================================================
       [区域标注·已完成·本次控制台持久显示与后台记录修复] 聊天页控制台日志状态
       说明：
       1. chatConsoleEnabled 仅表示控制台抽屉是否显示，按当前会话写入 IndexedDB。
       2. chatConsoleLogs 始终后台记录当前会话日志，最多 500 条。
       3. 禁止 localStorage/sessionStorage，也不做双份存储兜底。
       ======================================================================== */
    chatConsoleEnabled: false,
    chatConsoleExpanded: false,
    chatConsoleWarnErrorOnly: false,
    chatConsoleLogs: [],
    /* ===== [区域标注·已完成·语言翻译] 翻译设置状态 ===== */
    translationSettings: null
  };

  await syncArchiveBoundContactCleanup(container, state, db, archiveData);

  /* [修改4·修改6] 根据当前面具构建 profile 数据 */
  buildProfileFromMask(state);

  /* [区域标注] 渲染应用骨架 HTML */
  container.innerHTML = buildAppShell(state);

  /* [区域标注] 绑定全局事件代理 */
  /* ========================================================================
     [区域标注·已完成·本次返回按钮点击修复] 消息页/设置页返回按钮捕获优先处理
     说明：
     1. 在普通 click 事件代理之前，用捕获阶段优先处理 msg-back 与 msg-settings-back。
     2. 避免返回按钮点击被消息气泡工具栏关闭逻辑、长按指针逻辑或外层桌面手势层抢先消费，导致表现为点击无效。
     3. 本区域只处理这两个返回按钮的运行时导航，不新增/修改任何持久化存储逻辑；仍严格使用 DB.js / IndexedDB。
     ======================================================================== */
  const navigationClickCaptureHandler = (e) => handleChatReturnClickCapture(e, state, container);
  /* ========================================================================
     [区域标注·已完成·HTML卡片交互系统提示持久化] iframe 交互事件监听
     说明：
     1. chat-message.js 会把 HTML 卡片 iframe 内部 postMessage 转成 miniphone-html-card-interaction 事件。
     2. 这里只负责把用户在卡片里的点击/选择生成聊天中间系统提示，并写入 DB.js / IndexedDB。
     3. 不使用 localStorage/sessionStorage，不保留双份兜底存储，不使用原生浏览器弹窗。
     ======================================================================== */
  const htmlCardInteractionHandler = (e) => handleHtmlCardInteraction(e, state, container, db);
  const clickHandler = (e) => handleClick(e, state, container, db, eventBus, windowManager, appMeta, settings);
  const inputHandler = (e) => handleInput(e, state, container, db);
  const keydownHandler = (e) => handleKeydown(e, state, container, db, settings);
  /* [区域标注·已完成·HTML卡片收藏/表情包多选] 双击事件：HTML 卡片收藏写入 DB.js / IndexedDB */
  const dblClickHandler = (e) => handleDoubleClick(e, state, container, db);
  /* [区域标注·本次需求3] 表情包本地上传文件选择事件 */
  const changeHandler = (e) => handleChange(e, state, container, db);
  /* [区域标注·本次需求1] 通讯录分组长按删除事件：使用自定义应用内弹窗，不使用原生 confirm */
  const contactGroupLongPressHandlers = createContactGroupLongPressHandlers(state, container);
  /* [区域标注·本次需求3] 表情包分组长按删除事件：使用自定义应用内弹窗，不使用原生 confirm */
  const stickerGroupLongPressHandlers = createStickerGroupLongPressHandlers(state, container);
  /* [区域标注·已完成·收藏分组长按删除] 应用内确认弹窗，不使用原生 confirm */
  const favoriteGroupLongPressHandlers = createFavoriteGroupLongPressHandlers(state, container);
  /* ==========================================================================
     [区域标注·已完成·收藏卡片长按进入多选] 长按收藏卡片进入多选模式
     说明：替代原双击触发方式，长按 650ms 进入多选并默认选中当前卡片。
     ========================================================================== */
  const favoriteCardLongPressHandlers = createFavoriteCardLongPressHandlers(state, container);
  /* === [本次修改] 聊天列表长按删除联系人：应用内确认弹窗，不使用原生 confirm === */
  const chatListLongPressHandlers = createChatListLongPressHandlers(state, container);
  container.addEventListener('click', navigationClickCaptureHandler, true);
  container.addEventListener('miniphone-html-card-interaction', htmlCardInteractionHandler);
  container.addEventListener('click', clickHandler);
  container.addEventListener('input', inputHandler);
  container.addEventListener('keydown', keydownHandler);
  container.addEventListener('dblclick', dblClickHandler);
  container.addEventListener('change', changeHandler);
  container.addEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', stickerGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', stickerGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', stickerGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', stickerGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', stickerGroupLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', favoriteGroupLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', favoriteGroupLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', favoriteGroupLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', favoriteGroupLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', favoriteGroupLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', favoriteCardLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', favoriteCardLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', favoriteCardLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', favoriteCardLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', favoriteCardLongPressHandlers.contextmenu);
  container.addEventListener('pointerdown', chatListLongPressHandlers.pointerdown);
  container.addEventListener('pointerup', chatListLongPressHandlers.pointerup);
  container.addEventListener('pointercancel', chatListLongPressHandlers.pointercancel);
  container.addEventListener('pointerleave', chatListLongPressHandlers.pointerleave);
  container.addEventListener('contextmenu', chatListLongPressHandlers.contextmenu);

  /* ==========================================================================
     [区域标注·修改5] 监听档案应用面具切换事件
     说明：当用户在档案应用中切换激活面具时，自动刷新闲谈四大板块
           切换前先保存当前面具的数据，切换后加载新面具的数据
     ========================================================================== */
  const onMaskChanged = async (payload) => {
    if (state.destroyed) return;
    const newMaskId = payload?.maskId || '';
    const oldMaskId = state.activeMaskId;

    /* 保存旧面具数据 */
    await saveMaskData(state, db, oldMaskId);

    /* 更新面具 */
    state.activeMaskId = newMaskId;

    /* 重新加载档案数据以获取最新面具列表 */
    const freshArchive = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);
    const freshData = (freshArchive && typeof freshArchive === 'object') ? freshArchive : {};
    state.archiveMasks = Array.isArray(freshData.masks) ? freshData.masks : [];
    /* [区域标注·本次需求2] 面具切换时同步角色档案缓存 */
    state.archiveCharacters = Array.isArray(freshData.characters) ? freshData.characters : [];
    /* [区域标注·本次修改4] 面具切换时同步档案关系网络缓存 */
    state.archiveSupportingRoles = Array.isArray(freshData.supportingRoles) ? freshData.supportingRoles : [];
    state.archiveRelations = Array.isArray(freshData.relations) ? freshData.relations : [];

    /* 加载新面具的数据 */
    await loadMaskData(state, db, newMaskId);

    await syncArchiveBoundContactCleanup(container, state, db, freshData);

    /* 重建 profile */
    buildProfileFromMask(state);

    /* 重新渲染全部板块 */
    container.innerHTML = buildAppShell(state);
  };
  eventBus.on('archive:active-mask-changed', onMaskChanged);

  /* ========================================================================
     [区域标注·已完成·档案联系人解绑/删除后闲谈级联清理事件]
     说明：
     1. 档案应用保存绑定关系或删除角色后，会通知闲谈刷新档案缓存。
     2. 闲谈只清理当前面具下已经不再绑定的联系人及其相关显示数据。
     3. 全程仅使用 DB.js / IndexedDB，不使用浏览器同步键值存储。
     ======================================================================== */
  const onArchiveDataChanged = async (payload) => {
    if (state.destroyed) return;
    const freshData = (payload?.data && typeof payload.data === 'object')
      ? payload.data
      : ((await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID)) || {});
    const freshMasks = Array.isArray(freshData.masks) ? freshData.masks : [];
    state.archiveMasks = freshMasks;
    state.archiveCharacters = Array.isArray(freshData.characters) ? freshData.characters : [];
    state.archiveSupportingRoles = Array.isArray(freshData.supportingRoles) ? freshData.supportingRoles : [];
    state.archiveRelations = Array.isArray(freshData.relations) ? freshData.relations : [];

    const changed = await syncArchiveBoundContactCleanup(container, state, db, freshData);
    if (!changed) return;

    buildProfileFromMask(state);
    container.innerHTML = buildAppShell(state);
  };
  eventBus.on('archive:data-changed', onArchiveDataChanged);

  /* [区域标注] 返回实例（含 destroy 清理函数） */
  return {
    destroy() {
      state.destroyed = true;
      container.removeEventListener('click', navigationClickCaptureHandler, true);
      container.removeEventListener('miniphone-html-card-interaction', htmlCardInteractionHandler);
      container.removeEventListener('click', clickHandler);
      container.removeEventListener('input', inputHandler);
      container.removeEventListener('keydown', keydownHandler);
      container.removeEventListener('dblclick', dblClickHandler);
      container.removeEventListener('change', changeHandler);
      container.removeEventListener('pointerdown', contactGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', contactGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', contactGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', contactGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', contactGroupLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', stickerGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', stickerGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', stickerGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', stickerGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', stickerGroupLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', favoriteGroupLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', favoriteGroupLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', favoriteGroupLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', favoriteGroupLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', favoriteGroupLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', favoriteCardLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', favoriteCardLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', favoriteCardLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', favoriteCardLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', favoriteCardLongPressHandlers.contextmenu);
      container.removeEventListener('pointerdown', chatListLongPressHandlers.pointerdown);
      container.removeEventListener('pointerup', chatListLongPressHandlers.pointerup);
      container.removeEventListener('pointercancel', chatListLongPressHandlers.pointercancel);
      container.removeEventListener('pointerleave', chatListLongPressHandlers.pointerleave);
      container.removeEventListener('contextmenu', chatListLongPressHandlers.contextmenu);
      eventBus.off('archive:active-mask-changed', onMaskChanged);
      eventBus.off('archive:data-changed', onArchiveDataChanged);
      removeCSS('chat-app-css');
      removeCSS('chat-moments-css');
      removeCSS('chat-msg-css');
      removeCSS('chat-html-card-css');
      removeCSS('chat-gift-css');
      removeCSS('chat-text-image-css');
      removeCSS('chat-voice-css');
      removeCSS('chat-inner-voice-css');
      removeCSS('chat-aside-css');
      removeCSS('chat-translation-css');
      removeCSS('chat-export-import-css');
    }
  };
}

/* ==========================================================================
   [区域标注] unmount — 应用卸载
   ========================================================================== */
export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}

/* ==========================================================================
   [区域标注] 构建应用骨架 HTML
   说明：包含顶部栏、四大板块容器、底部悬浮TAB栏、弹窗层
   ========================================================================== */
function buildAppShell(state) {
  const panelTitles = { chatList: 'Chat', contacts: 'Contacts', moments: 'Moments', profile: 'Me' };
  const shellTitle = panelTitles[state.activePanel] || 'Chat';
  const showDefaultAdd = state.activePanel === 'chatList' || state.activePanel === 'contacts';
  const showMomentsActions = state.activePanel === 'moments';

  return `
    <!-- [区域标注] 闲谈应用根容器 -->
    <!-- [区域标注·本次需求2] data-active-panel 用于精确控制通讯录/朋友圈/用户主页标题栏顶部间距 -->
    <div class="chat-app" data-role="chat-app-root" data-active-panel="${state.activePanel}">

      <!-- ================================================================
           [区域标注] 顶部导航栏
           说明：左上角">"返回桌面，中间花体字"Chat"，右上角"+"添加
           ================================================================ -->
      <div class="chat-top-bar">
        <!-- [区域标注·已完成·本次朋友圈标题栏按钮位置调整] 朋友圈页标题左侧爱心与右侧“+”，仅在 Moments 板块显示 -->
        <button class="chat-top-bar__moments-action chat-top-bar__moments-action--left" data-action="moments-notifications" type="button" aria-label="朋友圈互动通知" style="${showMomentsActions ? '' : 'display:none;'}">${ICON_MOMENTS_HEART}</button>
        <!-- [区域标注·本次需求4] Chat/Contacts 标题组：右侧紧跟缩小后的 IconPark "+" 按钮 -->
        <div class="chat-top-bar__title-wrap">
          <button class="chat-top-bar__title" data-action="go-home" type="button">${shellTitle}</button>
          <button class="chat-top-bar__add" data-action="add-chat" type="button" aria-label="添加" style="${showDefaultAdd ? '' : 'display:none;'}">${TAB_ICONS.plus}</button>
        </div>
        <button class="chat-top-bar__moments-action chat-top-bar__moments-action--right" data-action="moments-compose" type="button" aria-label="发布朋友圈" style="${showMomentsActions ? '' : 'display:none;'}">${TAB_ICONS.plus}</button>
      </div>

      <!-- ================================================================
           [区域标注] 聊天列表子TAB栏（All / Private / Group）
           说明：仅在聊天列表板块时显示
           ================================================================ -->
      <div class="chat-tabs" data-role="chat-sub-tabs" style="${state.activePanel === 'chatList' ? '' : 'display:none;'}">
        <button class="chat-tab-btn ${state.chatSubTab === 'all' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="all">All</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'private' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="private">Private</button>
        <button class="chat-tab-btn ${state.chatSubTab === 'group' ? 'is-active' : ''}" data-action="switch-sub-tab" data-sub-tab="group">Group</button>
      </div>

      <!-- ================================================================
           [区域标注] 四大板块内容区
           ================================================================ -->
      <!-- [区域标注] 聊天列表板块 -->
      <div class="chat-panel ${state.activePanel === 'chatList' ? 'is-active' : ''}" data-panel="chatList">
        ${renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed)}
      </div>
      <!-- [区域标注] 通讯录板块 -->
      <div class="chat-panel ${state.activePanel === 'contacts' ? 'is-active' : ''}" data-panel="contacts">
        ${renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId)}
      </div>
      <!-- [区域标注·已完成·本次朋友圈点赞评论互动] 朋友圈板块：传入点赞/评论/回复运行时渲染参数 -->
      <div class="chat-panel ${state.activePanel === 'moments' ? 'is-active' : ''}" data-panel="moments">
        ${renderMoments(state.moments, getMomentsRenderOptions(state))}
      </div>
      <!-- [区域标注] 用户主页板块 -->
      <div class="chat-panel ${state.activePanel === 'profile' ? 'is-active' : ''}" data-panel="profile">
        ${renderProfile(state.profile)}
      </div>

      <!-- ================================================================
           [区域标注] 聊天消息页面容器（初始隐藏，点击聊天条目后显示）
           ================================================================ -->
      <div class="chat-message-page-wrap" data-role="msg-page-wrap" style="display:none;">
      </div>

      <!-- ================================================================
           [区域标注·已完成·图片/HTML卡片单击居中放大] 聊天消息页媒体预览层
           说明：
           1. 仅服务闲谈消息页中的图片消息与 HTML 互动卡片单击居中放大。
           2. 预览层覆盖在聊天消息页内部，关闭时不改聊天消息界面背景，不使用原生浏览器弹窗。
           3. 只使用运行时 DOM，不涉及 localStorage/sessionStorage 或额外持久化存储。
           ================================================================ -->
      <div class="msg-media-zoom-overlay" data-role="msg-media-zoom-overlay">
        <div class="msg-media-zoom-overlay__panel">
          <button class="msg-media-zoom-overlay__close" data-action="msg-media-close-zoom" type="button" aria-label="关闭预览">${TAB_ICONS.close}</button>
          <div class="msg-media-zoom-overlay__body" data-role="msg-media-zoom-body"></div>
        </div>
      </div>

      <!-- ================================================================
           [区域标注] 底部悬浮 TAB 栏（四大板块切换）
           说明：参照图片1 — 暗色圆角胶囊，选中态椭圆扩展变色
           ================================================================ -->
      <div class="chat-bottom-tab" data-role="bottom-tab">
        ${PANEL_KEYS.map((key, idx) => `
          <!-- [区域标注] 底部TAB: ${PANEL_LABELS[idx]} -->
          <button class="chat-bottom-tab__btn ${state.activePanel === key ? 'is-active' : ''}"
                  data-action="switch-panel" data-panel="${key}">
            ${TAB_ICONS[PANEL_ICON_KEYS[idx]]}
            <span>${PANEL_LABELS[idx]}</span>
          </button>
        `).join('')}
      </div>

      <!-- ================================================================
           [区域标注] 应用内弹窗层（替代原生浏览器弹窗）
           说明：用于搜索通讯录好友并添加到聊天列表等场景
           ================================================================ -->
      <div class="chat-modal-mask is-hidden" data-role="modal-mask">
        <div class="chat-modal-panel" data-role="modal-panel">
          <!-- 弹窗内容由 JS 动态填充 -->
        </div>
      </div>

    </div>
  `;
}

/* ==========================================================================
   [区域标注] 刷新指定板块内容
   说明：局部更新板块 innerHTML，避免整页重建
   ========================================================================== */
function refreshPanel(container, state, panelKey) {
  const panelEl = container.querySelector(`[data-panel="${panelKey}"]`);
  if (!panelEl) return;

  switch (panelKey) {
    case 'chatList':
      panelEl.innerHTML = renderChatList(getVisibleChatSessions(state), state.chatSubTab, state.chatSearchKeyword, state.sectionCollapsed);
      break;
    case 'contacts':
      panelEl.innerHTML = renderContacts(state.contacts, state.contactGroups, state.activeContactGroupId);
      break;
    case 'moments':
      panelEl.innerHTML = renderMoments(state.moments, getMomentsRenderOptions(state));
      break;
    case 'profile':
      panelEl.innerHTML = renderProfile(state.profile);
      break;
  }
}

/* ==========================================================================
   [区域标注] 切换底部板块
   ========================================================================== */
function switchPanel(container, state, panelKey) {
  state.activePanel = panelKey;

  /* [区域标注·本次需求2] 同步当前板块标记，供 CSS 单独调整非聊天列表标题栏顶部间距 */
  const rootEl = container.querySelector('[data-role="chat-app-root"]');
  if (rootEl) rootEl.dataset.activePanel = panelKey;

  /* [区域标注] 更新板块显隐 */
  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) el.classList.toggle('is-active', k === panelKey);
  });

  /* [区域标注] 更新底部TAB选中态 */
  container.querySelectorAll('.chat-bottom-tab__btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.panel === panelKey);
  });

  /* [区域标注] 聊天列表子TAB栏仅在聊天列表板块显示 */
  const subTabsEl = container.querySelector('[data-role="chat-sub-tabs"]');
  if (subTabsEl) subTabsEl.style.display = panelKey === 'chatList' ? '' : 'none';

  /* [区域标注] 顶部标题根据板块切换 */
  const titleEl = container.querySelector('.chat-top-bar__title');
  if (titleEl) {
    const titles = { chatList: 'Chat', contacts: 'Contacts', moments: 'Moments', profile: 'Me' };
    titleEl.textContent = titles[panelKey] || 'Chat';
  }

  /* [区域标注·本次需求2] "+"按钮在聊天列表与通讯录板块显示：聊天列表添加聊天，通讯录搜索添加联系人 */
  const isMomentsPanel = panelKey === 'moments';
  const addBtn = container.querySelector('.chat-top-bar__add');
  if (addBtn) addBtn.style.display = (!isMomentsPanel && (panelKey === 'chatList' || panelKey === 'contacts')) ? '' : 'none';

  /* [区域标注·已完成·本次朋友圈标题栏按钮位置调整] Moments 板块显示标题左爱心右“+”，其它板块隐藏 */
  container.querySelectorAll('.chat-top-bar__moments-action').forEach(btn => {
    btn.style.display = isMomentsPanel ? '' : 'none';
  });
}

/* ==========================================================================
   [区域标注] 打开聊天消息页面
   说明：隐藏主界面，显示独立的聊天消息页面
   ========================================================================== */
async function openChatMessage(container, state, db, chatId) {
  const session = state.sessions.find(s => s.id === chatId);
  if (!session) return;

  state.currentChatId = chatId;
  resetMessageSelectionState(state);
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;
  state.pendingQuote = null;
  /* [区域标注·已完成·聊天记录搜索] 进入会话时重置搜索框，避免上一个聊天的关键词残留 */
  state.chatMessageSearchOpen = false;
  state.chatMessageSearchKeyword = '';
  /* ========================================================================
     [区域标注·已完成·本次聊天记录分段加载] 进入会话重置为默认最新 100 条
     说明：只重置本次查看范围；完整聊天记录稍后仍从 IndexedDB 载入 currentMessages。
     ======================================================================== */
  state.chatMessageVisibleCount = CHAT_MESSAGE_INITIAL_VISIBLE_COUNT;

  /* [区域标注] 从 IndexedDB 加载该会话的消息记录 */
  state.currentMessages = (await dbGet(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + chatId)) || [];

  /* ========================================================================
     [区域标注·已完成·旁白模式防自动退出修复] 打开会话时恢复旁白模式状态
     说明：
     1. 旁白模式 active/settings/history 按“当前面具 + 当前会话”从 DB.js / IndexedDB 读取。
     2. 这样闲谈应用重新挂载、刷新或重新进入会话时，不会在未点击爱心的情况下自动退出旁白模式。
     3. 不使用 localStorage/sessionStorage，不写双份兜底，不使用长文本字段过滤。
     ======================================================================== */
  const asideModeState = await loadAsideModeState(db, state.activeMaskId, chatId);
  state.asideModeActive = Boolean(asideModeState?.active);
  state.asideSettings = normalizeAsideSettings(asideModeState?.settings || getDefaultAsideSettings());
  state.asideHistory = Array.isArray(asideModeState?.history) ? asideModeState.history : [];

  /* ===== 闲谈聊天设置按联系人独立存储 START ===== */
  state.chatPromptSettings = normalizeChatPromptSettings(await dbGet(db, DATA_KEY_CHAT_PROMPT_SETTINGS(state.activeMaskId, chatId)));
  /* ===== 闲谈聊天设置按联系人独立存储 END ===== */

  /* ========================================================================
     [区域标注·已完成·本次进入聊天消息页防闪屏修复] 先离屏渲染消息页，再同帧切换显隐
     说明：
     1. 不再先隐藏主界面后等待下一帧显示消息页，避免中间出现空白帧造成闪屏。
     2. 消息页容器先以不可见态完成渲染；下一帧同一批 DOM 操作里隐藏主界面并显示消息页。
     3. 仅调整从聊天列表进入聊天消息页的显示时序；不改其它功能，不新增任何持久化存储逻辑。
     4. 持久化仍只使用 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const panels = container.querySelectorAll('.chat-panel');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  /* ========================================================================
     [区域标注·已完成·本次控制台持久显示与后台记录修复] 进入会话时恢复控制台状态
     说明：
     1. 日志和显示开关均按“当前面具 + 当前会话”从 IndexedDB 读取。
     2. 不再因退出/重进聊天页面把已开启的控制台重置为关闭。
     3. 抽屉展开态仍为运行时临时状态，进入页面默认收起以保持界面稳定。
     ======================================================================== */
  state.chatConsoleLogs = normalizeChatConsoleLogs(await dbGet(db, DATA_KEY_CHAT_CONSOLE(state.activeMaskId, chatId)));
  state.chatConsoleEnabled = Boolean(await dbGet(db, DATA_KEY_CHAT_CONSOLE_ENABLED(state.activeMaskId, chatId)));
  state.chatConsoleExpanded = false;
  /* ===== [区域标注·已完成·语言翻译] 从 IndexedDB 加载翻译设置 ===== */
  state.translationSettings = normalizeTranslationSettings(await dbGet(db, DATA_KEY_CHAT_TRANSLATION_SETTINGS(state.activeMaskId, chatId)));

  if (msgWrap) {
    msgWrap.style.display = 'flex';
    msgWrap.style.visibility = 'hidden';
    msgWrap.style.opacity = '0';
    msgWrap.style.pointerEvents = 'none';
    renderCurrentChatMessage(container, state);
    window.requestAnimationFrame(() => {
      if (state.currentChatId !== chatId) return;

      if (topBar) topBar.style.display = 'none';
      if (subTabs) subTabs.style.display = 'none';
      if (bottomTab) bottomTab.style.display = 'none';
      panels.forEach(p => p.style.display = 'none');

      msgWrap.style.visibility = '';
      msgWrap.style.opacity = '';
      msgWrap.style.pointerEvents = '';
    });
  }

  /* [区域标注] 滚动到消息底部 */
  setTimeout(() => {
    const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
    if (listArea) listArea.scrollTop = listArea.scrollHeight;
  }, 50);
}

/* ==========================================================================
   [区域标注] 关闭聊天消息页面，返回聊天列表
   ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·当前会话头像设置保存]
   说明：
   1. 只更新当前会话 session.avatar，让聊天列表与当前聊天界面使用该头像。
   2. 不修改 contacts/contact.avatar，不影响通讯录头像或联系人原始头像。
   3. 持久化只调用 dbPut → DATA_KEY_SESSIONS → DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   ========================================================================== */
async function saveCurrentChatSessionAvatar(container, state, db, avatarUrl) {
  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  const safeAvatarUrl = String(avatarUrl || '').trim();
  if (!session || !safeAvatarUrl) return false;

  session.avatar = safeAvatarUrl;
  session.avatarUpdatedAt = Date.now();
  await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);

  const preview = container.querySelector('[data-role="msg-settings-avatar-preview"]');
  if (preview) {
    preview.innerHTML = `<img src="${escapeHtml(safeAvatarUrl)}" alt="${escapeHtml(session.name || '')}">`;
  }

  const topAvatar = container.querySelector('.msg-top-bar__avatar');
  if (topAvatar) {
    topAvatar.innerHTML = `<img src="${escapeHtml(safeAvatarUrl)}" alt="${escapeHtml(session.name || '')}">`;
  }

  container.querySelectorAll('.msg-bubble-row--left .msg-bubble__avatar').forEach(avatarEl => {
    avatarEl.innerHTML = `<img src="${escapeHtml(safeAvatarUrl)}" alt="${escapeHtml(session.name || '')}">`;
  });

  refreshPanel(container, state, 'chatList');
  return true;
}

function closeChatMessage(container, state) {
  state.currentChatId = null;
  state.currentMessages = [];
  /* ===== 闲谈聊天设置按联系人独立存储 START ===== */
  state.chatPromptSettings = normalizeChatPromptSettings(null);
  /* ===== 闲谈聊天设置按联系人独立存储 END ===== */
  resetMessageSelectionState(state);
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;
  state.pendingQuote = null;
  /* [区域标注·已完成·聊天记录搜索] 退出消息页时清空搜索运行时状态，不写任何持久化存储 */
  state.chatMessageSearchOpen = false;
  state.chatMessageSearchKeyword = '';
  /* ========================================================================
     [区域标注·已完成·本次聊天记录分段加载] 退出消息页时恢复默认可见数量
     说明：运行时查看范围不持久化，下次进入仍默认显示最新 100 条。
     ======================================================================== */
  state.chatMessageVisibleCount = CHAT_MESSAGE_INITIAL_VISIBLE_COUNT;

  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = '';
  if (subTabs) subTabs.style.display = state.activePanel === 'chatList' ? '' : 'none';
  if (bottomTab) bottomTab.style.display = '';

  /* [区域标注] 恢复板块显示 */
  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) {
      el.style.display = '';
      el.classList.toggle('is-active', k === state.activePanel);
    }
  });

  if (msgWrap) {
    msgWrap.style.display = 'none';
    msgWrap.innerHTML = '';
  }
}

/* ========================================================================
   [区域标注·已完成·本次返回按钮点击修复] 捕获阶段返回导航
   说明：
   1. 仅拦截聊天消息页返回聊天列表按钮（data-action="msg-back"）与聊天设置页返回消息列表按钮（data-action="msg-settings-back"）。
   2. 捕获阶段立即执行导航并 stopPropagation，防止后续气泡工具栏关闭逻辑、长按逻辑或外层桌面手势层把点击吞掉。
   3. 本区域只修改运行时 UI 显隐/重渲染；不读写 localStorage/sessionStorage，也不新增 IndexedDB 写入。
   ======================================================================== */
function handleChatReturnClickCapture(e, state, container) {
  const target = e.target?.closest?.('[data-action="msg-back"], [data-action="msg-settings-back"]');
  if (!target || !container.contains(target)) return;

  const action = String(target.dataset.action || '');
  e.preventDefault();
  e.stopPropagation();

  if (action === 'msg-back') {
    closeChatMessage(container, state);
    refreshPanel(container, state, 'chatList');
    return;
  }

  if (action === 'msg-settings-back') {
    renderCurrentChatMessage(container, state);
  }
}

/* ========================================================================
   [区域标注·已完成·HTML卡片交互系统提示持久化与文案精简] 用户卡片回应入列
   说明：
   1. 用户点击 AI 发送的 HTML 卡片内部按钮/选项后，在聊天消息界面追加一行中间系统提示。
   2. 系统提示 type=html_card_interaction_system、role=user，会随 currentMessages 写入 DB.js / IndexedDB。
   3. 下一轮调用 AI 时，buildPromptPayloadForLatestUserRound 会把该系统提示作为用户最新回应上下文发送给 AI。
   4. 本区域已按本次要求移除“在 HTML 卡片中”前缀，系统小字直接显示“你点击/选择/填写/选中……”，避免文案冗余。
   5. 本区域不使用 localStorage/sessionStorage，不做双份兜底，不使用原生浏览器弹窗。
   ======================================================================== */
function buildHtmlCardInteractionSystemContent(detail = {}) {
  const label = String(detail.text || detail.value || 'HTML卡片元素').replace(/\s+/g, ' ').trim() || 'HTML卡片元素';
  const tagName = String(detail.tagName || '').toLowerCase();
  const role = String(detail.role || '').toLowerCase();
  const eventType = String(detail.eventType || 'click').toLowerCase();
  const value = String(detail.value || '').replace(/\s+/g, ' ').trim();
  const isChoiceLike = ['checkbox', 'radio', 'switch'].includes(role);

  if (tagName === 'select' && value) {
    return `你选择了「${label}」：${value}`;
  }

  if ((tagName === 'textarea' || tagName === 'input') && value && eventType === 'change') {
    return `你填写了「${label}」：${value}`;
  }

  if (isChoiceLike) {
    return `你${detail.checked ? '选中了' : '取消了'}「${label}」`;
  }

  return `你点击了「${label}」`;
}

async function handleHtmlCardInteraction(e, state, container, db) {
  if (!state.currentChatId) return;
  const detail = e.detail || {};
  const sourceMessageId = String(detail.messageId || '').trim();
  const sourceMessage = (state.currentMessages || []).find(message => String(message.id) === sourceMessageId);
  if (!sourceMessage || String(sourceMessage.type || '') !== 'card') return;

  e.stopPropagation();

  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  if (!session) return;

  const now = Date.now();
  const content = buildHtmlCardInteractionSystemContent(detail);
  const systemMessage = {
    id: `html_card_interaction_system_${now}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'html_card_interaction_system',
    content,
    htmlCardSourceMessageId: sourceMessageId,
    htmlCardInteractionText: String(detail.text || '').trim(),
    htmlCardInteractionValue: String(detail.value || '').trim(),
    htmlCardInteractionChecked: Boolean(detail.checked),
    htmlCardInteractionTagName: String(detail.tagName || '').trim(),
    htmlCardInteractionRole: String(detail.role || '').trim(),
    htmlCardInteractionEventType: String(detail.eventType || 'click').trim(),
    timestamp: now
  };

  state.currentMessages.push(systemMessage);
  session.lastMessage = content;
  session.lastTime = now;

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  appendCurrentMessageBubble(container, state, systemMessage);
  refreshPanel(container, state, 'chatList');
}

/* ==========================================================================
   [区域标注] 点击事件代理处理器
   说明：统一处理应用内所有按钮/列表项的点击事件
   ========================================================================== */
async function handleClick(e, state, container, db, eventBus, windowManager, appMeta, settingsManager) {
  /* ========================================================================
     [区域标注·已完成·心声面板] 角色头像点击事件委托 —— 打开心声面板
     说明：
     1. 使用事件委托而非逐个绑定 addEventListener，避免头像更新时重复绑定。
     2. 单击左侧（AI 角色）头像，弹出心声面板。
     3. 优先查找该消息所在轮次的心声数据，若无则查找最新心声。
     4. 心声面板不设关闭按钮，点击面板外区域自动关闭。
     ======================================================================== */
  if (state.currentChatId && isAssistantAvatarClick(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    const messageId = getMessageIdFromAvatarClick(e.target);
    const messages = state.currentMessages || [];
    const innerVoice = messageId
      ? findInnerVoiceForMessage(messages, messageId)
      : findLatestInnerVoice(messages);
    if (innerVoice) {
      /* ======================================================================
         [区域标注·已完成·心声面板日期时间传入]
         说明：
         1. 仅为心声面板传入当前点击消息时间，用于在心声面板上显示日期和时间。
         2. 不新增任何持久化存储；历史心声仍只读取 DB.js / IndexedDB。
         3. 不改其它闲谈点击逻辑，避免影响未提到的区域。
         ====================================================================== */
      const innerVoiceMessage = messageId
        ? messages.find(message => String(message?.id || '') === String(messageId))
        : [...messages].reverse().find(message => message?.role === 'assistant' && message?.innerVoice);
      const currentSession = (state.sessions || []).find(session => String(session.id) === String(state.currentChatId)) || {};
      openInnerVoicePanel(container, innerVoice, {
        db,
        maskId: state.activeMaskId,
        chatId: state.currentChatId,
        chatName: String(currentSession.remark || currentSession.name || ''),
        createdAt: Number(innerVoiceMessage?.timestamp || Date.now()) || Date.now()
      });
    }
    return;
  }

  const target = e.target.closest('[data-action]');

  /* ========================================================================
     [区域标注·已完成·本次收藏HTML卡片悬浮放大修复]
     说明：
     1. 收藏独立页存在已悬浮放大的 HTML 卡片时，点击任何非 HTML 卡片区域都会先关闭悬浮卡片。
     2. 关闭动作只移除运行时 DOM class，不读写 IndexedDB，不使用 localStorage/sessionStorage。
     3. 关闭后阻止本次底层点击动作，避免点普通收藏卡片时同时触发预览或其它页面跳转。
     ======================================================================== */
  if (
    state.subPageView === 'favorite'
    && container.querySelector('.favorite-html-card.is-expanded')
    && !e.target.closest('.favorite-html-card')
  ) {
    e.preventDefault();
    container.querySelectorAll('.favorite-html-card.is-expanded').forEach(item => item.classList.remove('is-expanded'));
    return;
  }

  /* ========================================================================
     [区域标注·已完成·气泡/系统提示功能区关闭逻辑]
     说明：
     1. 功能区打开后，点击聊天消息页任意非功能区区域都会关闭功能区。
     2. 仅使用运行时状态与局部 DOM 刷新，不涉及任何持久化存储。
     3. 不使用原生浏览器弹窗，不影响其它板块点击逻辑。
     ======================================================================== */
  const openedMessageId = String(state.selectedMessageId || '');
  if (
    state.currentChatId
    && openedMessageId
    && !state.multiSelectMode
    && !e.target.closest('[data-role="msg-bubble-toolbar"]')
    && e.target.closest('[data-role="msg-page-wrap"]')
  ) {
    const clickedAction = String(target?.dataset?.action || '');
    const clickedMessageId = String(target?.dataset?.messageId || '');
    const previousDeleteConfirmId = state.deleteConfirmMessageId;
    const previousRewindConfirmId = state.rewindConfirmMessageId;
    /* ======================================================================
       [区域标注·已完成·返回按钮拦截修复] 聊天消息页/设置页返回按钮优先导航
       说明：
       1. 当消息功能区已打开时，点击“返回聊天列表(msg-back)”或“设置返回消息页(msg-settings-back)”必须继续进入下方 switch 导航逻辑。
       2. 这里只把这两个返回按钮列为关闭功能区拦截白名单，并阻止事件继续冒泡到外层手势/桌面层。
       3. 本修复仅调整运行时点击处理顺序，不涉及持久化存储；仍只使用 DB.js / IndexedDB。
       ====================================================================== */
    const shouldBypassCloseIntercept = ['msg-back', 'msg-settings-back', 'msg-media-open-zoom', 'msg-media-close-zoom', 'open-msg-text-image-preview', 'moments-compose'].includes(clickedAction);
    if (shouldBypassCloseIntercept) {
      e.preventDefault();
      e.stopPropagation();
    }
    const shouldOnlyClose = !['msg-bubble-select', 'msg-system-tip-select'].includes(clickedAction) || clickedMessageId === openedMessageId;
    state.selectedMessageId = '';
    state.selectedAsideSegmentId = '';
    state.deleteConfirmMessageId = '';
    state.rewindConfirmMessageId = '';
    refreshMessageBubbleRows(container, state, [openedMessageId, previousDeleteConfirmId, previousRewindConfirmId, clickedMessageId]);
    if (shouldOnlyClose && !shouldBypassCloseIntercept) return;
  }

  if (!target) return;
  const action = target.dataset.action;

  switch (action) {
    /* [区域标注] 返回桌面 */
    case 'go-home':
      eventBus.emit('app:close', { appId: APP_ID });
      break;

    /* [区域标注] 切换底部板块 */
    case 'switch-panel': {
      const panelKey = target.dataset.panel;
      if (panelKey && PANEL_KEYS.includes(panelKey)) {
        switchPanel(container, state, panelKey);
      }
      break;
    }

    /* [区域标注] 切换聊天列表子TAB */
    case 'switch-sub-tab': {
      const subTab = target.dataset.subTab;
      if (subTab) {
        state.chatSubTab = subTab;
        /* 更新子TAB按钮选中态 */
        container.querySelectorAll('.chat-tab-btn').forEach(btn => {
          btn.classList.toggle('is-active', btn.dataset.subTab === subTab);
        });
        refreshPanel(container, state, 'chatList');
      }
      break;
    }

    /* [区域标注] 折叠/展开聊天列表分区 */
    case 'toggle-section': {
      const key = target.dataset.sectionKey;
      if (key) {
        state.sectionCollapsed[key] = !state.sectionCollapsed[key];
        refreshPanel(container, state, 'chatList');
      }
      break;
    }

    /* [区域标注] 打开聊天对话 */
    case 'open-chat': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const chatId = target.dataset.chatId;
      if (chatId) {
        await openChatMessage(container, state, db, chatId);
      }
      break;
    }

    /* [区域标注·本次需求2] 右上角"+"：聊天列表添加聊天；通讯录搜索添加联系人 */
    case 'add-chat':
      if (state.activePanel === 'contacts') {
        showAddContactModal(container, state);
      } else {
        showAddChatModal(container, state);
      }
      break;

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 朋友圈标题右侧“+”：打开独立发帖页 */
    case 'moments-compose':
      openMomentsComposePage(container, state);
      break;

    /* ========================================================================
       [区域标注·已完成·本次朋友圈点赞评论互动模块化接线] 朋友圈点赞/评论/回复事件接线
       说明：
       1. index.js 只负责事件委托、应用内提示与 DB.js / IndexedDB 持久化回调接线。
       2. 点赞、评论展开、发表评论、回复评论的主要逻辑已移至 moments.js。
       3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
       ======================================================================== */
    case 'moment-like':
    case 'moment-comment':
    case 'moment-reply-comment':
    case 'cancel-moment-reply':
    case 'submit-moment-comment':
      await handleMomentsInteractionAction({
        action,
        target,
        state,
        container,
        createUid,
        showNotice: message => renderModalNotice(container, message),
        persistMoments: () => dbPut(db, DATA_KEY_MOMENTS(state.activeMaskId), Array.isArray(state.moments) ? state.moments : [])
      });
      break;

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页返回：关闭独立发帖页并保留当前草稿 */
    case 'moments-compose-back':
      closeMomentsComposePage(container, state, PANEL_KEYS);
      break;

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页发送：写入朋友圈并可选分享到聊天 */
    case 'submit-moments-compose': {
      const draft = ensureMomentsComposeDraft(state);
      const text = String(draft.text || '').trim();
      const draftImages = Array.isArray(draft.images) ? draft.images.filter(item => item?.src).slice(0, MOMENTS_COMPOSE_MAX_IMAGES) : [];
      /* [区域标注·已完成·朋友圈个别人可见发布修复] 提交时同时识别联系人 id / roleId，避免已选联系人被过滤为空导致纸飞机无法发表。 */
      const validVisibleContactIds = new Set(
        (Array.isArray(state.contacts) ? state.contacts : [])
          .flatMap(contact => [
            String(contact?.id || '').trim(),
            String(contact?.roleId || '').trim()
          ])
          .filter(Boolean)
      );
      const visibleContactIds = Array.from(new Set(
        (Array.isArray(draft.visibleContactIds) ? draft.visibleContactIds : [])
          .map(id => String(id || '').trim())
          .filter(id => validVisibleContactIds.has(id))
      ));

      if (!text && !draftImages.length) {
        renderModalNotice(container, '请先输入文字或添加图片');
        break;
      }

      if (draft.visibilityMode === 'contacts' && !visibleContactIds.length) {
        renderModalNotice(container, '请选择可见的通讯录联系人');
        break;
      }

      const now = Date.now();
      const authorName = String(state.profile?.nickname || state.profile?.name || '当前面具身份').trim() || '当前面具身份';
      const authorAvatar = String(state.profile?.avatar || '').trim();
      const shareTarget = getMomentsComposeShareTarget(state);
      const nextMoment = {
        id: createUid('moment'),
        authorId: String(state.activeMaskId || '').trim(),
        authorName,
        authorAvatar,
        content: text,
        images: draftImages.map(item => String(item.src || '').trim()).filter(Boolean),
        likes: [],
        comments: [],
        createdAt: now,
        location: String(draft.location || '').trim(),
        visibilityMode: draft.visibilityMode,
        visibleContactIds,
        shareChatId: shareTarget ? String(shareTarget.id || '').trim() : '',
        shareChatName: shareTarget ? (String(shareTarget.remark || shareTarget.name || '').trim() || '未命名聊天') : ''
      };

      state.moments = [nextMoment, ...(Array.isArray(state.moments) ? state.moments : [])];
      resetMomentsInteractionState(state);

      const tasks = [
        dbPut(db, DATA_KEY_MOMENTS(state.activeMaskId), state.moments)
      ];

      if (shareTarget) {
        const shareMessage = {
          id: createUid('moment_share'),
          role: 'user',
          content: buildMomentsComposeShareMessage({
            ...draft,
            text,
            images: draftImages
          }),
          timestamp: now
        };
        const targetKey = DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + shareTarget.id;
        const targetMessages = (await dbGet(db, targetKey)) || [];
        targetMessages.push(shareMessage);
        shareTarget.lastMessage = shareMessage.content;
        shareTarget.lastTime = now;

        tasks.push(
          dbPut(db, targetKey, targetMessages),
          dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
        );
      }

      await Promise.all(tasks);
      refreshPanel(container, state, 'moments');
      if (shareTarget) refreshPanel(container, state, 'chatList');
      closeMomentsComposePage(container, state, PANEL_KEYS, { resetDraft: true });
      break;
    }

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页图片入口 */
    case 'open-moments-compose-local-picker': {
      const input = container.querySelector('[data-role="moments-compose-local-input"]');
      if (input) {
        input.value = '';
        input.click();
      }
      break;
    }

    case 'open-moments-compose-image-url-modal':
      openMomentsComposeImageUrlModal(container);
      break;

    case 'confirm-moments-compose-image-url': {
      const draft = ensureMomentsComposeDraft(state);
      if (draft.images.length >= MOMENTS_COMPOSE_MAX_IMAGES) {
        renderModalNotice(container, `最多只能添加 ${MOMENTS_COMPOSE_MAX_IMAGES} 张图片`);
        break;
      }

      const input = container.querySelector('[data-role="moments-compose-image-url-input"]');
      const imageUrl = String(input?.value || '').trim();
      if (!/^https?:\/\/\S+/i.test(imageUrl) && !/^data:image\//i.test(imageUrl)) {
        renderModalNotice(container, '请输入有效的图片 URL');
        break;
      }

      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        images: [
          ...draft.images,
          {
            id: createUid('moments_compose_image'),
            src: imageUrl,
            name: '链接图片'
          }
        ]
      });
      closeModal(container);
      renderMomentsComposeIntoPage(container, state);
      break;
    }

    case 'remove-moments-compose-image': {
      const imageId = String(target.dataset.imageId || '').trim();
      const draft = ensureMomentsComposeDraft(state);
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        images: draft.images.filter(item => String(item?.id || '').trim() !== imageId)
      });
      renderMomentsComposeIntoPage(container, state);
      break;
    }

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页地点弹窗 */
    case 'open-moments-compose-location-modal':
      openMomentsComposeLocationModal(container, state);
      break;

    case 'confirm-moments-compose-location': {
      const draft = ensureMomentsComposeDraft(state);
      const input = container.querySelector('[data-role="moments-compose-location-input"]');
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        location: String(input?.value || '').trim()
      });
      closeModal(container);
      renderMomentsComposeIntoPage(container, state);
      break;
    }

    case 'clear-moments-compose-location': {
      const draft = ensureMomentsComposeDraft(state);
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        location: ''
      });
      closeModal(container);
      renderMomentsComposeIntoPage(container, state);
      break;
    }

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页分享目标弹窗 */
    case 'open-moments-compose-share-modal':
      openMomentsComposeShareModal(container, state);
      break;

    case 'select-moments-compose-share': {
      const draft = ensureMomentsComposeDraft(state);
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        shareChatId: String(target.dataset.chatId || '').trim()
      });
      closeModal(container);
      renderMomentsComposeIntoPage(container, state);
      break;
    }

    /* [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页可见范围弹窗 */
    case 'open-moments-compose-visibility-modal':
      openMomentsComposeVisibilityModal(container, state);
      break;

    case 'set-moments-compose-visibility-mode': {
      const draft = ensureMomentsComposeDraft(state);
      const visibilityMode = String(target.dataset.visibilityMode || 'public') === 'contacts' ? 'contacts' : 'public';
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        visibilityMode,
        visibleContactIds: visibilityMode === 'contacts' ? draft.visibleContactIds : []
      });
      renderMomentsComposeIntoPage(container, state);
      openMomentsComposeVisibilityModal(container, state);
      break;
    }

    case 'toggle-moments-compose-visible-contact': {
      const draft = ensureMomentsComposeDraft(state);
      const contactId = String(target.dataset.contactId || '').trim();
      if (!contactId) break;

      const selectedSet = new Set(draft.visibleContactIds.map(id => String(id || '').trim()).filter(Boolean));
      if (selectedSet.has(contactId)) {
        selectedSet.delete(contactId);
      } else {
        selectedSet.add(contactId);
      }

      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...draft,
        visibilityMode: 'contacts',
        visibleContactIds: Array.from(selectedSet)
      });
      renderMomentsComposeIntoPage(container, state);
      openMomentsComposeVisibilityModal(container, state);
      break;
    }

    /* [区域标注·已完成·本次朋友圈标题栏按钮位置调整] 朋友圈标题左侧爱心：互动通知入口 */
    case 'moments-notifications':
      renderModalNotice(container, '暂无互动通知');
      break;

    /* [区域标注] 关闭弹窗 */
    case 'close-modal':
      closeModal(container);
      break;

    /* [区域标注] 弹窗中选择好友添加到聊天列表 */
    case 'select-contact-for-chat': {
      const contactId = target.dataset.contactId;
      const contact = state.contacts.find(c => c.id === contactId);
      if (contact) {
        const existedSession = state.sessions.find(s => s.id === contactId);
        if (existedSession) {
          /* ==========================================================================
             [区域标注·已完成·本次需求3] 重新加入聊天列表：聊天天数恢复实时计数（续算）
             说明：
             1. 联系人此前被从聊天列表删除时会暂停计数（见 confirm-delete-chat-list-contact）。
             2. 重新加入时不重置历史累计值，仅更新续算起点时间。
             3. 主页卡片与详情页统一读取该实时计数字段，避免总数不一致。
             ========================================================================== */
          existedSession.chatDaysAccumulated = Math.max(0, Number(existedSession.chatDaysAccumulated || 0));
          existedSession.chatDaysLastResumedAt = Date.now();
          state.hiddenChatIds = state.hiddenChatIds.filter(id => String(id) !== String(contactId));
          await Promise.all([
            dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
            dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(state.activeMaskId), state.hiddenChatIds)
          ]);
        } else {
          /* [区域标注] 创建新聊天会话 */
          const now = Date.now();
          const newSession = {
            id: contact.id,
            name: contact.name || '未命名',
            avatar: contact.avatar || '',
            type: 'private',
            lastMessage: '',
            lastTime: now,
            unread: 0,
            /* ==========================================================================
               [区域标注·已完成·本次需求3] 新联系人加入聊天列表：初始化聊天天数实时计数字段
               说明：
               1. chatDaysAccumulated：暂停前累计天数（初始为0）。
               2. chatDaysLastResumedAt：当前计数起点（初次加入时从当前时间开始计数）。
               3. 详情页会把首次加入当天显示为 1 天，后续按自然日累加。
               ========================================================================== */
            chatDaysAccumulated: 0,
            chatDaysLastResumedAt: now
          };
          state.sessions.push(newSession);
          await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
        }

        buildProfileFromMask(state);
        closeModal(container);
        refreshPanel(container, state, 'chatList');
        refreshPanel(container, state, 'profile');

        /* [区域标注] 自动打开新创建或恢复显示的聊天 */
        await openChatMessage(container, state, db, contact.id);
      }
      break;
    }

    /* ==========================================================================
       === [本次修改] 聊天列表长按删除联系人：确认后仅从聊天列表隐藏 ===
       ========================================================================== */
    case 'confirm-delete-chat-list-contact': {
      const chatId = target.dataset.chatId || '';
      const session = chatId ? state.sessions.find(item => String(item.id) === String(chatId)) : null;
      if (!session) break;

      /* ==========================================================================
         [区域标注·已完成·本次需求3] 从聊天列表删除联系人：聊天天数暂停计数
         说明：
         1. 删除联系人时不删除会话数据，仅写入 hiddenChatIds 隐藏会话。
         2. 同步把“运行中天数”结算到 chatDaysAccumulated，并清空续算起点实现暂停。
         3. 重新加入聊天列表时再设置新的 chatDaysLastResumedAt 继续计数。
         4. 结算口径复用详情页计算函数，保证主页卡片、详情页、暂停值三者一致。
         ========================================================================== */
      const now = Date.now();
      session.chatDaysAccumulated = calculateSessionRunningChatDays(session, now);
      session.chatDaysLastResumedAt = 0;

      const hiddenSet = new Set(Array.isArray(state.hiddenChatIds) ? state.hiddenChatIds.map(String) : []);
      hiddenSet.add(String(chatId));
      state.hiddenChatIds = Array.from(hiddenSet);

      await Promise.all([
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
        dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(state.activeMaskId), state.hiddenChatIds)
      ]);

      buildProfileFromMask(state);
      closeModal(container);
      refreshPanel(container, state, 'chatList');
      refreshPanel(container, state, 'profile');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 通讯录分组 TAB 切换
       ========================================================================== */
    case 'switch-contact-group': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const groupId = target.dataset.contactGroupId || 'all';
      const exists = groupId === 'all' || state.contactGroups.some(group => group.id === groupId);
      state.activeContactGroupId = exists ? groupId : 'all';
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 打开新建通讯录分组弹窗
       ========================================================================== */
    case 'create-contact-group':
      showCreateContactGroupModal(container);
      break;

    /* ==========================================================================
       [区域标注·本次需求1] 确认创建通讯录分组
       ========================================================================== */
    case 'confirm-create-contact-group': {
      const input = container.querySelector('[data-role="contact-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入分组名称');
        break;
      }
      const group = { id: createUid('contact_group'), name };
      state.contactGroups.push(group);
      state.activeContactGroupId = group.id;
      await dbPut(db, DATA_KEY_CONTACT_GROUPS(state.activeMaskId), state.contactGroups);
      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求1] 确认删除通讯录分组标签
       说明：只删除分组标签；该分组下联系人 groupId 清空，联系人继续保留在 All。
       ========================================================================== */
    case 'confirm-delete-contact-group': {
      const groupId = target.dataset.contactGroupId || '';
      const exists = groupId && state.contactGroups.some(group => group.id === groupId);
      if (!exists) break;

      state.contactGroups = state.contactGroups.filter(group => group.id !== groupId);
      state.contacts = state.contacts.map(contact => (
        contact.groupId === groupId ? { ...contact, groupId: '' } : contact
      ));
      if (state.activeContactGroupId === groupId) state.activeContactGroupId = 'all';

      await Promise.all([
        dbPut(db, DATA_KEY_CONTACT_GROUPS(state.activeMaskId), state.contactGroups),
        dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts)
      ]);

      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 从搜索结果添加角色到通讯录
       ========================================================================== */
    case 'add-contact-from-search': {
      const roleId = target.dataset.roleId;
      const role = getBoundRoleCandidates(state).find(item => item.id === roleId);
      if (!role) {
        renderModalNotice(container, '未找到可添加的绑定角色');
        break;
      }
      if (!state.contacts.some(contact => contact.id === role.id)) {
        state.contacts.push({
          id: role.id,
          roleId: role.id,
          name: role.name || '未命名角色',
          avatar: role.avatar || '',
          signature: role.signature || role.basicSetting || '',
          contact: role.contact || '',
          groupId: '',
          addedAt: Date.now()
        });
        await dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts);
        buildProfileFromMask(state);
        refreshPanel(container, state, 'contacts');
        refreshPanel(container, state, 'profile');
        refreshPanel(container, state, 'moments');
      }
      showContactGroupPickerModal(container, state, role.id);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 点击联系人后打开通讯录分组选择弹窗
       ========================================================================== */
    case 'view-contact': {
      const contactId = target.dataset.contactId;
      if (contactId) showContactGroupPickerModal(container, state, contactId);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求2] 保存联系人所属通讯录分组
       ========================================================================== */
    case 'assign-contact-group': {
      const contactId = target.dataset.contactId;
      const groupId = target.dataset.contactGroupId || '';
      const safeGroupId = groupId && state.contactGroups.some(group => group.id === groupId) ? groupId : '';
      state.contacts = state.contacts.map(contact => (
        contact.id === contactId ? { ...contact, groupId: safeGroupId } : contact
      ));
      await dbPut(db, DATA_KEY_CONTACTS(state.activeMaskId), state.contacts);
      closeModal(container);
      refreshPanel(container, state, 'contacts');
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次返回按钮点击修复] 返回聊天列表按钮兜底
       说明：主要处理已移至 handleChatReturnClickCapture 捕获阶段；此处保留兜底，
             确保非捕获路径下仍能关闭消息页并返回聊天列表。
       ======================================================================== */
    case 'msg-back':
      e.preventDefault();
      e.stopPropagation();
      closeChatMessage(container, state);
      refreshPanel(container, state, 'chatList');
      break;

    /* ========================================================================
       [区域标注·已完成·输入框表情包名称联想] 聊天消息页面 — 发送按钮
       说明：
       1. 发送文字或仅触发 AI 回复前，清空输入框并局部移除联想表情包条。
       2. 不重绘聊天消息页，避免输入栏与页面闪屏。
       3. 本区域不涉及持久化存储，不使用 localStorage/sessionStorage。
       ======================================================================== */
    case 'msg-send': {
      const input = container.querySelector('[data-role="msg-input"]');
      const value = String(input?.value || '').trim();
      if (input) {
        input.value = '';
        syncMessageInputAutoHeight(input);
      }
      syncStickerInputSuggestions(container, state, '');

      await addChatConsoleLog(container, state, db, 'info', value ? `发送消息：${value}` : '发送触发：仅请求 AI 回复');

      /* ===== 闲谈应用：纸飞机触发AI回复 START ===== */
      if (value) {
        await sendMessage(container, state, db, value, settingsManager, { triggerAi: true });
      } else {
        await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
      }
      /* ===== 闲谈应用：纸飞机触发AI回复 END ===== */
      break;
    }

    /* [区域标注·本次需求] 聊天消息页面 — 咖啡按钮：切换升起功能区 */
    case 'msg-coffee':
      state.coffeeDockOpen = !state.coffeeDockOpen;
      if (state.coffeeDockOpen) state.stickerPanelOpen = false;
      syncMessageDockOpenState(container, state);
      break;

    /* ========================================================================
       [区域标注·已完成·AI识图图片入口] 咖啡功能区 — 打开图片发送弹窗
       说明：应用内弹窗提供本地图片上传和图片 URL 输入，不使用原生浏览器弹窗。
       ======================================================================== */
    case 'open-msg-image-modal':
      showMessageImageModal(container);
      break;

    /* ========================================================================
       [区域标注·已完成·本次转账需求] 咖啡功能区 — 打开转账弹窗
       说明：
       1. 弹窗余额实时读取当前钱包余额与当前显示币种。
       2. 使用应用内统一弹窗，不使用原生浏览器弹窗。
       ======================================================================== */
    case 'open-msg-transfer-modal': {
      const walletDisplay = getWalletDisplayAmount(state.walletData || {});
      showMessageTransferModal(container, {
        balanceLabel: formatWalletMoney(walletDisplay.value, walletDisplay.currency.code),
        currencyCode: walletDisplay.currency.code
      });
      break;
    }

    /* ========================================================================
       [区域标注·已完成·文字图弹窗打开]
       说明：咖啡功能区“文字图”入口打开应用内弹窗，不使用浏览器原生弹窗/选择器。
       ======================================================================== */
    case 'open-msg-text-image-modal':
      showTextImageModal(container);
      break;

    /* ========================================================================
       [区域标注·已完成·语音弹窗打开]
       说明：咖啡功能区“语音”入口打开应用内弹窗，不使用浏览器原生弹窗/选择器。
       ======================================================================== */
    case 'open-msg-voice-modal':
      showVoiceMessageModal(container);
      break;

    /* ========================================================================
       [区域标注·已完成·语音保存发送并标记 AI 上下文]
       说明：
       1. 语音弹窗保存后立即作为 type=voice_message 用户消息入列，并通过 DB.js / IndexedDB 持久化。
       2. 消息 content 使用“用户发送了一条语音消息，语音转文字内容：...”格式，明确告诉 AI 这是用户语音消息。
       3. 保存后不自动请求 AI；用户点击纸飞机时再把该语音消息作为当前轮用户上下文发送给 AI。
       4. 不使用 localStorage/sessionStorage，不写双份存储兜底，不按长文本字段过滤。
       ======================================================================== */
    case 'confirm-msg-voice': {
      if (!state.currentChatId || state.isAiSending) break;
      const voiceText = parseVoiceDraftFromModal(container);
      if (!voiceText) {
        renderModalNotice(container, '请输入语音文字内容');
        break;
      }

      const session = state.sessions.find(s => String(s.id) === String(state.currentChatId));
      const voiceMessage = createVoiceMessage(voiceText);
      if (!session || !voiceMessage) break;

      state.currentMessages.push(voiceMessage);
      state.coffeeDockOpen = false;
      state.stickerPanelOpen = false;
      session.lastMessage = '[语音]';
      session.lastTime = voiceMessage.timestamp;

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      appendCurrentMessageBubble(container, state, voiceMessage);
      syncMessageDockOpenState(container, state);
      refreshPanel(container, state, 'chatList');
      break;
    }

    /* ========================================================================
       [区域标注·已修改·文字图保存发送改为仅入列不自动请求AI]
       说明：
       1. 文字图保存后仍立即作为 type:image 用户消息入列，并通过 DB.js / IndexedDB 持久化。
       2. 消息 content 仍使用精简格式“用户发送了一张文字图图片，图片内容：...”，供用户后续点击纸飞机时再带给 AI。
       3. 本区域已移除“发送文字图后立即调用 API”的旧逻辑；必须等待用户手动点击纸飞机按钮才触发 AI 回复。
       4. 不写 imageUrl，不生成真实图片，不使用 localStorage/sessionStorage，也不做双份存储兜底。
       ======================================================================== */
    case 'confirm-msg-text-image': {
      if (!state.currentChatId || state.isAiSending) break;
      const text = parseTextImageDraftFromModal(container);
      if (!validateTextImageDraft(container, text)) break;

      const session = state.sessions.find(s => String(s.id) === String(state.currentChatId));
      const textImageMessage = createTextImageMessage(text);
      if (!session || !textImageMessage) break;

      state.currentMessages.push(textImageMessage);
      state.coffeeDockOpen = false;
      state.stickerPanelOpen = false;
      session.lastMessage = '[文字图]';
      session.lastTime = textImageMessage.timestamp;

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      appendCurrentMessageBubble(container, state, textImageMessage);
      syncMessageDockOpenState(container, state);
      refreshPanel(container, state, 'chatList');
      break;
    }

    /* ========================================================================
       [区域标注·已完成·文字图悬浮预览]
       说明：点击文字图消息后显示无关闭按钮悬浮图片；点击外侧遮罩关闭。
       ======================================================================== */
    case 'open-msg-text-image-preview': {
      const messageId = String(target.dataset.messageId || '').trim();
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (message) {
        e.preventDefault();
        e.stopPropagation();
        openTextImagePreview(container, message);
      }
      break;
    }

    /* ========================================================================
       [区域标注·已完成·礼物弹窗打开]
       说明：
       1. 咖啡功能区“礼物”入口打开应用内弹窗，不使用原生浏览器弹窗/选择器。
       2. 弹窗显示当前用户面具身份的钱包余额，余额来自 state.walletData（IndexedDB 已加载数据）。
       3. 弹窗 UI 与礼物字段由 chat-gift.js 独立维护。
       ======================================================================== */
    /* ======================================================================
       [区域标注·已完成·旁白模式] 打开旁白模式确认弹窗
       说明：点击咖啡功能区"旁白"按钮后打开旁白设置弹窗。
       ====================================================================== */
    case 'open-msg-aside-modal':
      showAsideEnterModal(container, state.asideSettings);
      break;

    /* ======================================================================
       [区域标注·已完成·旁白模式] 旁白弹窗内选项按钮——角色人称切换
       ====================================================================== */
    case 'set-aside-role-person': {
      const group = target.closest('[data-role="aside-role-person-group"]');
      if (group) {
        group.querySelectorAll('.aside-option-btn').forEach(b => b.classList.remove('is-active'));
        target.classList.add('is-active');
      }
      break;
    }

    /* ======================================================================
       [区域标注·已完成·旁白模式] 旁白弹窗内选项按钮——用户人称切换
       ====================================================================== */
    case 'set-aside-user-person': {
      const group = target.closest('[data-role="aside-user-person-group"]');
      if (group) {
        group.querySelectorAll('.aside-option-btn').forEach(b => b.classList.remove('is-active'));
        target.classList.add('is-active');
      }
      break;
    }

    /* ======================================================================
       [区域标注·已完成·旁白模式] 旁白弹窗内选项按钮——显示模式切换
       ====================================================================== */
    case 'set-aside-display-mode': {
      const group = target.closest('[data-role="aside-display-mode-group"]');
      if (group) {
        group.querySelectorAll('.aside-option-btn').forEach(b => b.classList.remove('is-active'));
        target.classList.add('is-active');
      }
      break;
    }

    /* ======================================================================
       [区域标注·已完成·旁白模式防自动退出修复] 确认进入旁白模式
       说明：
       1. 从弹窗读取设置，激活旁白模式，并立即写入 DB.js / IndexedDB。
       2. 后续重新进入会话会恢复 active:true，避免未点击爱心却自动退出。
       3. 不使用 localStorage/sessionStorage，不写双份兜底。
       ====================================================================== */
    case 'confirm-enter-aside-mode': {
      const asideSettings = readAsideSettingsFromModal(container);
      state.asideModeActive = true;
      state.asideSettings = asideSettings;
      state.asideHistory = [];
      await persistAsideModeState(db, state.activeMaskId, state.currentChatId, {
        active: true,
        settings: state.asideSettings,
        history: state.asideHistory
      });
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ======================================================================
       [区域标注·已完成·旁白模式] 点击顶栏爱心按钮——弹出退出旁白确认弹窗
       ====================================================================== */
    case 'exit-aside-mode':
      showAsideExitConfirmModal(container);
      break;

    /* ======================================================================
       [区域标注·已完成·旁白模式防自动退出修复] 确认退出旁白模式
       说明：
       1. 只有用户点击顶栏爱心并确认退出时，才把 active:false 写入 IndexedDB。
       2. 保留 asideHistory 供上下文摘要使用，不清空历史。
       3. 不使用 localStorage/sessionStorage，不写双份兜底。
       ====================================================================== */
    case 'confirm-exit-aside-mode':
      state.asideModeActive = false;
      await persistAsideModeState(db, state.activeMaskId, state.currentChatId, {
        active: false,
        settings: state.asideSettings,
        history: state.asideHistory
      });
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;

    case 'open-msg-gift-modal': {
      const walletDisplay = getWalletDisplayAmount(state.walletData || {});
      const activeMask = (state.archiveMasks || []).find(mask => String(mask?.id || '') === String(state.activeMaskId)) || {};
      showMessageGiftModal(container, {
        balanceLabel: formatWalletMoney(walletDisplay.value, walletDisplay.currency.code),
        currencyCode: walletDisplay.currency.code,
        maskName: String(activeMask?.name || state.profile?.nickname || '当前面具身份')
      });
      break;
    }

    /* ========================================================================
       [区域标注·已完成·礼物直接购买与代付请求卡片化]
       说明：
       1. 商品名称与价格均在应用内弹窗中输入；价格必须大于 0 且不超过当前钱包余额。
       2. “给对方买”扣减钱包并发送 type=gift 礼物卡片消息，统一写入 DB.js / IndexedDB。
       3. “请求代付”不扣用户钱包，改为先入列 type=gift 礼物卡片消息，再触发 AI 回复，避免聊天界面出现裸文本。
       4. 不使用 localStorage/sessionStorage，不做双份存储兜底，不按长文本字段过滤。
       ======================================================================== */
    case 'confirm-msg-gift-buy':
    case 'request-msg-gift-pay': {
      if (!state.currentChatId) break;

      const walletDisplay = getWalletDisplayAmount(state.walletData || {});
      const draft = parseGiftDraftFromModal(container, walletDisplay, state.walletData || {});
      const giftTitle = String(draft.giftTitle || '').trim();
      const giftPrice = Number(draft.giftPrice || 0);
      const giftBaseCny = Number(draft.giftBaseCny || 0);
      const currentBaseCny = Math.max(0, Number(state.walletData?.balanceBaseCny || 0) || 0);

      if (!giftTitle) {
        renderModalNotice(container, '请输入商品名称');
        break;
      }

      if (!Number.isFinite(giftPrice) || giftPrice <= 0) {
        renderModalNotice(container, '请输入大于 0 的礼物价格');
        break;
      }

      if (!Number.isFinite(Number(draft.displayRate || 0)) || Number(draft.displayRate || 0) <= 0 || !Number.isFinite(giftBaseCny)) {
        renderModalNotice(container, '当前钱包币种汇率不可用，请先切换币种后重试');
        break;
      }

      if (giftBaseCny > currentBaseCny + 1e-8) {
        renderModalNotice(container, '礼物价格不能超过当前钱包余额');
        break;
      }

      const giftDisplayPrice = formatWalletMoney(giftPrice, draft.currencyCode);
      const normalizedDraft = {
        ...draft,
        giftDisplayPrice
      };

      if (action === 'confirm-msg-gift-buy') {
        const sent = await sendGiftMessage(container, state, db, normalizedDraft, { formatWalletMoney });
        if (!sent) {
          renderModalNotice(container, '当前聊天不存在，无法发送礼物');
          break;
        }

        const latestGiftMessage = state.currentMessages[state.currentMessages.length - 1];
        closeModal(container);
        appendCurrentMessageBubble(container, state, latestGiftMessage);
        syncMessageDockOpenState(container, state);
        refreshPanel(container, state, 'chatList');
        break;
      }

      const session = state.sessions.find(s => String(s.id) === String(state.currentChatId));
      if (!session) {
        renderModalNotice(container, '当前聊天不存在，无法发送礼物代付请求');
        break;
      }

      const giftPayRequestMessage = createGiftPayRequestMessage(normalizedDraft);
      state.currentMessages.push(giftPayRequestMessage);
      state.coffeeDockOpen = false;
      state.stickerPanelOpen = false;
      session.lastMessage = `[礼物代付请求] ${giftTitle}${giftDisplayPrice ? ` · ${giftDisplayPrice}` : ''}`;
      session.lastTime = giftPayRequestMessage.timestamp;

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      appendCurrentMessageBubble(container, state, giftPayRequestMessage);
      syncMessageDockOpenState(container, state);
      refreshPanel(container, state, 'chatList');
      await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次转账待确认修复] 咖啡功能区 — 确认转账并写入 IndexedDB
       说明：
       1. 金额输入按当前钱包显示币种解释，再换算回 balanceBaseCny 扣减。
       2. 用户给 AI 的转账发出后只记录为 pending，不再立即显示“对方已接收”。
       3. 等用户点击“纸飞机”触发 API 后，由 AI 根据角色卡人设与上下文自行决定接收或退回。
       4. 钱包余额、当前聊天消息、聊天列表最近消息统一持久化到 DB.js / IndexedDB。
       ======================================================================== */
    case 'confirm-msg-transfer': {
      if (!state.currentChatId) break;
      const session = state.sessions.find(s => s.id === state.currentChatId);
      if (!session) break;

      const amountInput = container.querySelector('[data-role="msg-transfer-amount-input"]');
      const noteInput = container.querySelector('[data-role="msg-transfer-note-input"]');
      const transferAmount = Number(String(amountInput?.value || '').trim());
      const transferNote = String(noteInput?.value || '').trim();

      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        renderModalNotice(container, '请输入大于 0 的转账金额');
        break;
      }

      const walletDisplay = getWalletDisplayAmount(state.walletData || {});
      const displayCurrencyCode = walletDisplay.currency.code;
      const rates = state.walletData?.rates && typeof state.walletData.rates === 'object' ? state.walletData.rates : {};
      const displayRate = displayCurrencyCode === 'CNY'
        ? 1
        : Math.max(0, Number(rates[displayCurrencyCode] || 0) || 0);

      if (!Number.isFinite(displayRate) || displayRate <= 0) {
        renderModalNotice(container, '当前钱包币种汇率不可用，请先切换币种后重试');
        break;
      }

      const transferBaseCny = displayCurrencyCode === 'CNY'
        ? transferAmount
        : (transferAmount / displayRate);

      const currentBaseCny = Math.max(0, Number(state.walletData?.balanceBaseCny || 0) || 0);
      if (transferBaseCny > currentBaseCny + 1e-8) {
        renderModalNotice(container, '钱包余额不足');
        break;
      }

      const now = Date.now();
      const nextBaseCny = Math.max(0, currentBaseCny - transferBaseCny);
      const transferDisplayAmount = formatWalletMoney(transferAmount, displayCurrencyCode);

      state.walletData = normalizeWalletData({
        ...state.walletData,
        balanceBaseCny: nextBaseCny,
        /* ========================================================================
           [区域标注·已完成·本次钱包流水需求] 钱包实时流水记录（用户转账支出）
           说明：仅写入 walletData.ledger，并通过 persistWalletData 落盘到 IndexedDB。
           ======================================================================== */
        ledger: [
          {
            id: `wallet_ledger_${now}_${Math.random().toString(16).slice(2)}`,
            kind: 'transfer',
            direction: 'out',
            title: `转账给 ${String(session.name || '对方').trim() || '对方'}`,
            amountBaseCny: Number(transferBaseCny.toFixed(2)),
            timestamp: now
          },
          ...(Array.isArray(state.walletData?.ledger) ? state.walletData.ledger : [])
        ],
        updatedAt: now
      });

      const transferMessage = {
        id: `user_transfer_${now}_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        type: 'transfer',
        /* [区域标注·已完成·本次转账待确认修复] 用户发起转账后保持待确认，等待纸飞机触发 AI 自行处理 */
        transferDirection: 'outgoing',
        transferStatus: 'pending',
        transferCounterpartyName: String(session.name || '').trim(),
        content: transferDisplayAmount,
        transferDisplayAmount,
        transferCurrency: displayCurrencyCode,
        transferAmount: Number(transferAmount.toFixed(walletDisplay.currency.precision)),
        transferBaseCny: Number(transferBaseCny.toFixed(2)),
        transferNote,
        timestamp: now
      };

      state.currentMessages.push(transferMessage);
      state.coffeeDockOpen = false;
      state.stickerPanelOpen = false;
      session.lastMessage = '[转账]';
      session.lastTime = now;

      await Promise.all([
        persistWalletData(state, db),
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    case 'confirm-send-image-url': {
      const input = container.querySelector('[data-role="msg-image-url-input"]');
      const imageUrl = String(input?.value || '').trim();
      if (!/^https?:\/\/\S+/i.test(imageUrl) && !/^data:image\//i.test(imageUrl)) {
        renderModalNotice(container, '请输入有效的图片 URL');
        break;
      }
      await sendImageMessage(container, state, db, imageUrl, settingsManager, {
        imageName: '链接图片',
        triggerAi: false
      });
      closeModal(container);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次转账需求] 点击转账气泡打开“接收/退回”操作弹窗
       说明：
       1. 对 pending 状态开放操作；accepted/returned 仅展示当前状态。
       2. 弹窗与状态流转只使用应用内 UI + DB.js / IndexedDB 持久化。
       ======================================================================== */
    case 'msg-transfer-open-actions': {
      const messageId = String(target.dataset.messageId || '').trim();
      const transferMessage = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (!transferMessage || String(transferMessage.type || '') !== 'transfer') break;

      const transferStatus = String(transferMessage.transferStatus || 'pending').trim();
      const statusLabel = transferStatus === 'accepted' ? '已完成' : (transferStatus === 'returned' ? '已关闭' : '等待操作');
      const canOperate = transferStatus === 'pending';

      showTransferActionModal(container, {
        messageId,
        amountLabel: String(transferMessage.transferDisplayAmount || transferMessage.content || '¥0.00'),
        note: String(transferMessage.transferNote || ''),
        statusLabel,
        actionHint: canOperate ? '请选择接收或退回' : `当前转账状态：${statusLabel}`,
        canAccept: canOperate,
        canReturn: canOperate
      });
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次转账需求] 确认接收转账
       说明：
       1. incoming（AI→用户）接收后才给用户钱包加余额。
       2. outgoing（用户→AI）接收表示 AI 已收款，不变更钱包余额（扣款已在发起时完成）。
       ======================================================================== */
    case 'msg-transfer-accept': {
      const messageId = String(target.dataset.messageId || '').trim();
      if (!messageId) break;

      const messageIndex = (state.currentMessages || []).findIndex(item => String(item.id) === messageId);
      if (messageIndex < 0) break;

      const transferMessage = state.currentMessages[messageIndex];
      if (String(transferMessage.type || '') !== 'transfer') break;
      if (String(transferMessage.transferStatus || 'pending') !== 'pending') {
        closeModal(container);
        break;
      }

      const now = Date.now();
      const transferDirection = String(transferMessage.transferDirection || '').trim() || (transferMessage.role === 'assistant' ? 'incoming' : 'outgoing');
      const transferBaseCny = Math.max(0, Number(transferMessage.transferBaseCny || 0) || 0);

      state.currentMessages[messageIndex] = {
        ...transferMessage,
        transferDirection,
        transferStatus: 'accepted',
        transferHandledAt: now
      };

      if (transferDirection === 'incoming' && transferBaseCny > 0) {
        state.walletData = normalizeWalletData({
          ...state.walletData,
          balanceBaseCny: Number(state.walletData?.balanceBaseCny || 0) + transferBaseCny,
          /* ========================================================================
             [区域标注·已完成·本次钱包流水需求] 钱包实时流水记录（接收收入）
             说明：仅在 incoming 转账被接收时记一条收入流水。
             ======================================================================== */
          ledger: [
            {
              id: `wallet_ledger_${now}_${Math.random().toString(16).slice(2)}`,
              kind: 'transfer',
              direction: 'in',
              title: `收到 ${String(transferMessage.transferCounterpartyName || '对方').trim() || '对方'} 转账`,
              amountBaseCny: Number(transferBaseCny.toFixed(2)),
              timestamp: now
            },
            ...(Array.isArray(state.walletData?.ledger) ? state.walletData.ledger : [])
          ],
          updatedAt: now
        });
      }

      /* ========================================================================
         [区域标注·已完成·本次转账显示优化] 接收转账后生成中间系统小字
         说明：让用户侧界面与后续 AI 上下文都能看到“你已接收”，不显示原状态文字。
         ======================================================================== */
      state.currentMessages.push({
        id: `transfer_system_${now}_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        type: 'transfer_system',
        content: transferDirection === 'incoming' ? '你已接收' : '对方已接收',
        timestamp: now + 1
      });

      const session = state.sessions.find(s => s.id === state.currentChatId);
      if (session) {
        session.lastMessage = '[转账]';
        session.lastTime = now;
      }

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
        persistWalletData(state, db)
      ]);

      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次转账显示优化] 确认退回转账 + 生成中间系统小字
       说明：
       1. incoming（AI→用户）退回：只改状态，不变更用户钱包，并插入“你已退回”系统通知供 AI 上下文读取。
       2. outgoing（用户→AI）退回：退款到用户钱包，并插入“角色名 已退回”系统通知。
       ======================================================================== */
    case 'msg-transfer-return': {
      const messageId = String(target.dataset.messageId || '').trim();
      if (!messageId) break;

      const messageIndex = (state.currentMessages || []).findIndex(item => String(item.id) === messageId);
      if (messageIndex < 0) break;

      const transferMessage = state.currentMessages[messageIndex];
      if (String(transferMessage.type || '') !== 'transfer') break;
      if (String(transferMessage.transferStatus || 'pending') !== 'pending') {
        closeModal(container);
        break;
      }

      const now = Date.now();
      const transferDirection = String(transferMessage.transferDirection || '').trim() || (transferMessage.role === 'assistant' ? 'incoming' : 'outgoing');
      const transferBaseCny = Math.max(0, Number(transferMessage.transferBaseCny || 0) || 0);

      state.currentMessages[messageIndex] = {
        ...transferMessage,
        transferDirection,
        transferStatus: 'returned',
        transferHandledAt: now
      };

      const session = state.sessions.find(s => s.id === state.currentChatId);
      const roleName = String(transferMessage.transferCounterpartyName || session?.name || '对方').trim() || '对方';

      if (transferDirection === 'outgoing' && transferBaseCny > 0) {
        state.walletData = normalizeWalletData({
          ...state.walletData,
          balanceBaseCny: Number(state.walletData?.balanceBaseCny || 0) + transferBaseCny,
          /* ========================================================================
             [区域标注·已完成·本次钱包流水需求] 钱包实时流水记录（转账退回收入）
             说明：用户发出的转账被退回时，钱包记一条收入流水。
             ======================================================================== */
          ledger: [
            {
              id: `wallet_ledger_${now}_${Math.random().toString(16).slice(2)}`,
              kind: 'transfer',
              direction: 'in',
              title: `${roleName} 退回转账`,
              amountBaseCny: Number(transferBaseCny.toFixed(2)),
              timestamp: now
            },
            ...(Array.isArray(state.walletData?.ledger) ? state.walletData.ledger : [])
          ],
          updatedAt: now
        });
      }

      state.currentMessages.push({
        id: `transfer_system_${now}_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        type: 'transfer_system',
        content: transferDirection === 'incoming' ? '你已退回' : `${roleName} 已退回`,
        timestamp: now + 1
      });

      if (session) {
        session.lastMessage = '[转账]';
        session.lastTime = now;
      }

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
        persistWalletData(state, db)
      ]);

      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·本次需求3] 聊天消息页底栏表情包按钮 / 分组切换 / 发送
       ======================================================================== */
    case 'msg-sticker':
      state.stickerPanelOpen = !state.stickerPanelOpen;
      if (state.stickerPanelOpen) {
        state.coffeeDockOpen = false;
        state.stickerPanelGroupId = state.stickerPanelGroupId || normalizeStickerData(state.stickerData).activeGroupId || 'all';
      }
      syncMessageDockOpenState(container, state);
      break;

    case 'switch-msg-sticker-group':
      state.stickerPanelGroupId = target.dataset.stickerGroupId || 'all';
      renderMsgStickerPanelGrid(container, state);
      break;

    case 'send-msg-sticker':
      /* ========================================================================
         [区域标注·已完成·输入框表情包名称联想] 点选联想/面板表情包后发送
         说明：
         1. 点选表情包只发送表情包消息，不触发 AI；用户点击纸飞机后才调用 API。
         2. 若来自输入框联想条，发送后清空输入框并局部移除联想结果。
         3. 本区域不新增持久化存储，不使用 localStorage/sessionStorage。
         ======================================================================== */
      await sendStickerMessage(container, state, db, target.dataset.stickerId, settingsManager, { triggerAi: false });
      {
        const input = container.querySelector('[data-role="msg-input"]');
        if (input) {
          input.value = '';
          syncMessageInputAutoHeight(input);
        }
        syncStickerInputSuggestions(container, state, '');
      }
      break;

    /* [区域标注·本次需求] 聊天消息页面 — 魔法棒按钮：删除最新 AI 回复并重新回复 */
    case 'msg-magic':
      await retryLatestAiReply(container, state, db, settingsManager);
      break;

    /* ========================================================================
       [区域标注·已完成·聊天记录搜索] 顶栏放大镜按钮：打开/关闭搜索框
       说明：
       1. 点击放大镜后，搜索框从顶栏下方浮现；再次点击会清空关键词并关闭。
       2. 搜索仅使用当前 state.currentMessages 运行时数据，不读写任何持久化存储。
       3. 结果点击跳转逻辑见 jump-msg-search-result；界面局部同步，避免页面闪屏。
       ======================================================================== */
    case 'toggle-msg-search':
      /* ========================================================================
         [聊天记录搜索防穿透修复]
         说明：
         1. 搜索按钮只控制闲谈消息页搜索面板，不允许点击事件继续冒泡到桌面层。
         2. 配合 chat-message.js 中“只滚动消息列表容器”的定位修复，避免触发桌面编辑模式的“添加应用与组件”窗口。
         3. 本区域仅处理运行时 UI 事件，不涉及任何持久化存储。
         ======================================================================== */
      e.preventDefault();
      e.stopPropagation();
      state.chatMessageSearchOpen = !state.chatMessageSearchOpen;
      if (!state.chatMessageSearchOpen) state.chatMessageSearchKeyword = '';
      syncChatMessageSearchPanel(container, state);
      break;

    /* ========================================================================
       [聊天记录搜索] 搜索结果气泡点击：回滚到对应消息位置
       说明：点击透明结果框内任意命中气泡后，聊天消息列表平滑滚动到该消息气泡。
       ======================================================================== */
    case 'jump-msg-search-result': {
      /* ========================================================================
         [聊天记录搜索结果点击防穿透修复]
         说明：
         1. 点击搜索结果后只回滚当前聊天消息列表，不让点击事件冒泡到桌面编辑模式。
         2. 回滚定位由 chat-message.js 限定在 data-role="msg-list" 容器内完成。
         3. 不使用原生弹窗，不读写任何持久化存储。
         ======================================================================== */
      e.preventDefault();
      e.stopPropagation();
      const messageId = String(target.dataset.messageId || '').trim();
      if (messageId) scrollToChatSearchResult(container, messageId);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次聊天记录分段加载] 顶部“加载更多消息”按钮
       说明：
       1. 每次点击只把当前界面可见消息数量增加 100 条，再局部重渲染消息页。
       2. state.currentMessages 不被裁剪，AI 发送历史上下文仍保留完整聊天记录。
       3. 本运行时状态不写入 IndexedDB，不使用 localStorage/sessionStorage。
       ======================================================================== */
    case 'load-more-chat-messages': {
      e.preventDefault();
      e.stopPropagation();
      const total = Array.isArray(state.currentMessages) ? state.currentMessages.length : 0;
      const currentVisible = Math.max(CHAT_MESSAGE_INITIAL_VISIBLE_COUNT, Math.floor(Number(state.chatMessageVisibleCount || 0)) || CHAT_MESSAGE_INITIAL_VISIBLE_COUNT);
      state.chatMessageVisibleCount = Math.min(total, currentVisible + CHAT_MESSAGE_LOAD_MORE_STEP);
      renderCurrentChatMessage(container, state, { preservePrependPosition: true });
      break;
    }

    /* [区域标注·本次需求] 聊天消息页面 — 三点设置按钮：进入独立聊天设置页 */
    case 'msg-more': {
      const conversation = container.querySelector('[data-role="msg-conversation"]');
      const settingsPage = container.querySelector('[data-role="msg-settings-page"]');
      if (conversation) conversation.style.display = 'none';
      if (settingsPage) settingsPage.style.display = 'flex';
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·当前会话头像设置入口]
       说明：本地上传/URL 上传均进入应用内裁剪弹窗，不使用原生浏览器弹窗。
       ========================================================================== */
    case 'open-chat-avatar-local-picker': {
      const input = container.querySelector('[data-role="msg-avatar-file-input"]');
      if (input) {
        input.value = '';
        input.click();
      }
      break;
    }

    case 'open-chat-avatar-url-modal':
      showChatAvatarUrlModal(container);
      break;

    case 'confirm-chat-avatar-url': {
      const input = container.querySelector('[data-role="chat-avatar-url-input"]');
      const imageUrl = String(input?.value || '').trim();
      if (!/^https?:\/\/\S+/i.test(imageUrl) && !/^data:image\//i.test(imageUrl)) {
        renderModalNotice(container, '请输入有效的图片 URL');
        break;
      }
      showChatAvatarCropModal(container, {
        imageUrl,
        source: 'url',
        fileName: '链接头像'
      });
      break;
    }

    case 'save-chat-avatar-original':
    case 'save-chat-avatar-compressed':
    case 'save-chat-avatar-cropped': {
      try {
        const mode = action === 'save-chat-avatar-original'
          ? 'original'
          : (action === 'save-chat-avatar-compressed' ? 'compressed' : 'cropped');
        const avatarUrl = await buildChatAvatarFromCropModal(container, mode);
        if (!avatarUrl) {
          renderModalNotice(container, '头像生成失败，请重新选择图片');
          break;
        }
        const saved = await saveCurrentChatSessionAvatar(container, state, db, avatarUrl);
        if (!saved) {
          renderModalNotice(container, '当前会话不存在，无法保存头像');
          break;
        }
        closeModal(container);
      } catch (error) {
        renderModalNotice(container, error?.message || '头像保存失败；如使用跨域 URL，请选择“原图头像”或换用本地上传');
      }
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·聊天记录导入导出] 聊天设置页 — 打开导出格式选择弹窗
       说明：弹窗沿用闲谈应用内 chat-modal 样式，不使用原生 alert/confirm/prompt 或浏览器原生选择器。
       ========================================================================== */
    case 'open-chat-export-modal':
      showChatExportFormatModal(container);
      break;

    /* ==========================================================================
       [区域标注·已完成·聊天记录导入导出] 聊天设置页 — 执行当前会话导出
       说明：
       1. 仅导出当前聊天设置页对应联系人 state.currentMessages。
       2. 导出不写任何持久化存储；JSON/HTML/TXT 构建由 chat-export-import.js 负责。
       ========================================================================== */
    case 'confirm-chat-export': {
      try {
        const format = String(target.dataset.exportFormat || '').trim();
        const count = exportCurrentChatMessages(state, format);
        showChatExportImportNoticeModal(container, {
          title: '导出完成',
          message: `已导出当前联系人 ${count} 条聊天记录。`
        });
      } catch (error) {
        showChatExportImportNoticeModal(container, {
          title: '导出失败',
          message: error?.message || '聊天记录导出失败，请稍后重试。'
        });
      }
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·聊天记录导入导出] 聊天设置页 — 打开 JSON 导入文件选择
       说明：仅触发本板块隐藏文件输入；JSON 校验与落库在 handleChange 中完成。
       ========================================================================== */
    case 'open-chat-import-json-picker':
      if (!openChatImportJsonFilePicker(container)) {
        showChatExportImportNoticeModal(container, {
          title: '导入失败',
          message: '当前页面未找到导入入口，请重新进入聊天设置页后再试。'
        });
      }
      break;

    /* ==========================================================================
       [区域标注·本次需求4] 聊天设置页 — 打开清空全部聊天记录确认弹窗
       ========================================================================== */
    case 'open-clear-current-chat-images-modal':
      showClearCurrentChatImagesModal(container, state);
      break;

    case 'open-clear-all-messages-modal':
      showClearAllMessagesModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·本次需求4] 聊天设置页 — 确认清空当前聊天全部记录
       ========================================================================== */
    case 'confirm-clear-current-chat-images': {
      /* ======================================================================
         [区域标注·已完成·清理本窗口图片事件]
         说明：
         1. 只清理当前聊天窗口 type:image 消息里的 imageUrl，并标记 imageExpired。
         2. 图片描述字段保留，后续 AI 历史上下文仍可读取文字描述。
         3. 持久化只调用 persistCurrentMessages/dbPut → DB.js / IndexedDB，不使用 localStorage/sessionStorage。
         ====================================================================== */
      const { changedIds } = expireCurrentChatImages(state.currentMessages);
      if (!changedIds.length) {
        closeModal(container);
        break;
      }

      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      closeModal(container);
      refreshMessageBubbleRows(container, state, changedIds);
      break;
    }

    case 'confirm-clear-all-messages': {
      clearCurrentChatMessages(state);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·图片/HTML卡片单击居中放大]
       说明：
       1. AI 生成图片 / 发送图片 / HTML 互动卡片统一用应用内消息页预览层居中放大。
       2. 仅放大媒体内容，不修改聊天消息界面背景，不使用原生浏览器弹窗。
       3. 只使用运行时 DOM 同步，不涉及 localStorage/sessionStorage 或额外持久化存储。
       ========================================================================== */
    case 'msg-media-open-zoom': {
      const mediaKind = String(target.dataset.mediaKind || '').trim();
      const mediaSrc = String(target.dataset.mediaSrc || '').trim();
      const mediaSrcdoc = String(target.dataset.mediaSrcdoc || '').trim();
      const mediaAlt = String(target.dataset.mediaAlt || '').trim() || '预览内容';
      const zoomOverlay = container.querySelector('[data-role="msg-media-zoom-overlay"]');
      const zoomBody = container.querySelector('[data-role="msg-media-zoom-body"]');
      if (!zoomOverlay || !zoomBody) break;

      const isImage = mediaKind === 'image' && mediaSrc;
      const isHtmlCard = mediaKind === 'html-card' && mediaSrcdoc;
      if (!isImage && !isHtmlCard) break;

      e.preventDefault();
      e.stopPropagation();

      zoomBody.innerHTML = isImage
        ? `<img class="msg-media-zoom-image" src="${escapeHtml(mediaSrc)}" alt="${escapeHtml(mediaAlt)}" decoding="async">`
        : `
          <iframe
            class="msg-media-zoom-frame"
            sandbox="allow-forms allow-popups-to-escape-sandbox"
            loading="lazy"
            referrerpolicy="no-referrer"
            srcdoc="${escapeHtml(mediaSrcdoc)}"
            title="${escapeHtml(mediaAlt)}"></iframe>
        `;
      zoomOverlay.classList.add('is-open');
      break;
    }

    case 'msg-media-close-zoom': {
      const zoomOverlay = container.querySelector('[data-role="msg-media-zoom-overlay"]');
      const zoomBody = container.querySelector('[data-role="msg-media-zoom-body"]');
      if (!zoomOverlay || !zoomBody) break;
      e.preventDefault();
      e.stopPropagation();
      zoomOverlay.classList.remove('is-open');
      zoomBody.innerHTML = '';
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·气泡两排功能区] 单击消息气泡 — 显示气泡上方功能栏
       说明：再次点击当前气泡或消息页非功能区区域的关闭逻辑已统一放在 handleClick 顶部。
       ========================================================================== */
    case 'msg-bubble-select': {
      const messageId = String(target.dataset.messageId || '');
      if (!messageId) break;
      /* ======================================================================
         [区域标注·已完成·本次旁白功能栏编辑指向修复] 区分旁白段与普通消息气泡选中态
         说明：
         1. 点击旁白气泡时记录真实旁白段 id，只打开该旁白的功能栏。
         2. 点击普通消息气泡时清空 selectedAsideSegmentId，只打开普通消息功能栏。
         3. 所有状态仅保存在运行时，不写入 DB.js / IndexedDB。
         ====================================================================== */
      const asideBubble = target.closest('.msg-aside-bubble');
      const asideSegmentId = String(asideBubble?.dataset?.asideSegmentId || '').trim();
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 START ===== */
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.multiSelectMode = false;
      state.selectedMessageIds = [];
      state.selectedMessageId = messageId;
      state.selectedAsideSegmentId = asideSegmentId;
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = '';
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 END ===== */
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·系统提示小字删除] 单击中间系统提示 — 显示删除选项
       说明：只作用于聊天中间系统提示小字；确认后统一写入 DB.js / IndexedDB。
       ========================================================================== */
    case 'msg-system-tip-select': {
      const messageId = String(target.dataset.messageId || '');
      if (!messageId) break;
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.multiSelectMode = false;
      state.selectedMessageIds = [];
      state.selectedMessageId = messageId;
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = '';
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·本次修正分类弹窗] 消息气泡工具栏 → 打开修正类别弹窗
       说明：
       1. 点击“修正”先打开应用内分类弹窗，不使用原生浏览器弹窗。
       2. 弹窗按钮包括：表情包、文本、引用、系统提示。
       3. 真正写入仍只调用 persistCurrentMessages/dbPut → DB.js / IndexedDB。
       ========================================================================== */
    case 'msg-bubble-fix-format':
    case 'msg-system-tip-fix-format': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      showAiFormatRepairTypeModal(container, messageId);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·AI本轮撤回查看弹窗] 系统提示小字 → 查看 AI 撤回原文
       说明：使用应用内弹窗展示撤回内容；消息数据已在当前聊天记录中，不读取其它存储。
       ======================================================================== */
    case 'msg-system-tip-view-withdrawn': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (!message || String(message.type || '') !== 'ai_withdraw_system') break;
      showAiWithdrawnMessageModal(container, message);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·语音掉格式修正接线] 应用 AI 消息格式分类修复
       说明：
       1. 根据弹窗中选择的类别，仅修复当前 AI 消息对象。
       2. 已接入“语音”类别：含 [语音] / 【语音】残片的 AI 文字气泡可修正为语音气泡。
       3. 真正保存仍只调用 persistCurrentMessages/dbPut → DB.js / IndexedDB；不使用 localStorage/sessionStorage。
       ========================================================================== */
    case 'apply-ai-format-repair': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const repairType = String(target.dataset.repairType || 'sticker');
      const messageIndex = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (messageIndex < 0) break;

      const sourceMessage = state.currentMessages[messageIndex];
      const repairedMessage = repairType === 'text'
        ? repairAiTextMessageFormatIfPossible(sourceMessage, state)
        : (repairType === 'quote'
            ? repairAiQuoteMessageFormatIfPossible(sourceMessage, state)
            : (repairType === 'system'
                ? repairAiSystemTipFormatIfPossible(sourceMessage, state)
                : (repairType === 'voice'
                    ? repairAiVoiceMessageFormatIfPossible(sourceMessage, state)
                    : (repairType === 'aside'
                        ? repairAiAsideMessageFormatIfPossible(sourceMessage, state)
                        : repairAiMessageFormatIfPossible(sourceMessage, state)))));

      const repairLabel = repairType === 'text'
        ? '文本'
        : (repairType === 'quote'
            ? '引用'
            : (repairType === 'system'
                ? '系统提示'
                : (repairType === 'voice'
                    ? '语音'
                    : (repairType === 'aside' ? '旁白' : '表情包'))));

      if (!repairedMessage) {
        showAiFormatRepairResultModal(container, {
          success: false,
          title: '无法修正',
          message: `未识别到可修复的${repairLabel}掉格式内容。请确认这条 AI 消息中仍保留对应协议残片或可匹配内容。`
        });
        break;
      }

      state.currentMessages[messageIndex] = repairedMessage;
      state.deleteConfirmMessageId = '';
      state.selectedMessageId = messageId;
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshMessageBubbleRows(container, state, [messageId]);
      showAiFormatRepairResultModal(container, {
        success: true,
        title: '修正完成',
        message: `已完成${repairLabel}格式修正，并保存到当前聊天记录。`
      });
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·气泡编辑] 消息气泡功能栏 — 编辑文字并同步后续 AI 上文
       ========================================================================== */
    case 'msg-bubble-edit': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const asideBubble = target.closest('.msg-aside-bubble');
      const asideSegmentId = String(
        target.dataset.asideSegmentId
        || asideBubble?.dataset?.asideSegmentId
        || state.selectedAsideSegmentId
        || ''
      ).trim();
      /* ======================================================================
         [区域标注·已完成·本次旁白编辑弹窗指向修复] 旁白编辑入口分流
         说明：
         1. 若编辑按钮来自旁白功能栏，则打开旁白专用编辑弹窗，只编辑 asideSegments/asideText。
         2. 其它情况保持原普通消息编辑逻辑，只编辑 message.content。
         ====================================================================== */
      if (messageId && asideBubble && asideSegmentId) {
        showEditAsideModal(container, state, messageId, asideSegmentId);
        break;
      }
      if (messageId) showEditMessageModal(container, state, messageId);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·用户消息撤回] 消息气泡功能栏 → 打开撤回确认弹窗
       说明：
       1. 只允许撤回用户方消息；AI 消息不显示也不处理该入口。
       2. 弹窗使用闲谈应用内统一样式，不使用浏览器原生弹窗/选择器。
       3. 真正删除原气泡与写入系统小字在 confirm-user-withdraw-message 中完成。
       ======================================================================== */
    case 'msg-bubble-withdraw': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (!message || message.role !== 'user' || String(message.type || '') === 'user_withdraw_system') break;
      showUserWithdrawMessageModal(container, message);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·用户消息撤回] 确认撤回用户消息并写入 IndexedDB
       说明：
       1. 删除被撤回的用户原消息，并在原位置插入 user_withdraw_system 系统小字。
       2. withdrawnVisibleToAi=false 时，后续 AI 只收到“当前对话中的用户撤回了一条消息”提示，不收到原文。
       3. withdrawnVisibleToAi=true 时，后续 AI 会收到撤回提示与撤回原文，用于下一轮自然回应。
       4. 当前聊天记录与会话摘要统一只通过 DB.js / IndexedDB 持久化，不使用 localStorage/sessionStorage。
       ======================================================================== */
    case 'confirm-user-withdraw-message': {
      const messageId = String(target.dataset.messageId || '').trim();
      const messageIndex = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (messageIndex < 0) break;

      const sourceMessage = state.currentMessages[messageIndex];
      if (!sourceMessage || sourceMessage.role !== 'user' || String(sourceMessage.type || '') === 'user_withdraw_system') break;

      const now = Date.now();
      const withdrawnVisibleToAi = String(target.dataset.aiVisible || '0') === '1';
      const withdrawnText = String(
        sourceMessage.type === 'sticker'
          ? `[表情包] ${sourceMessage.stickerName || sourceMessage.content || ''}`
          : (sourceMessage.type === 'image'
              ? `[图片] ${sourceMessage.imageName || sourceMessage.content || ''}`
              : (sourceMessage.type === 'transfer'
                  ? `[转账] ${sourceMessage.transferDisplayAmount || sourceMessage.content || ''}`
                  : (sourceMessage.content || '')))
      ).trim();

      state.currentMessages.splice(messageIndex, 1, {
        id: `user_withdraw_system_${now}_${Math.random().toString(16).slice(2)}`,
        role: 'user',
        type: 'user_withdraw_system',
        content: '你撤回了一条消息',
        withdrawnContent: withdrawnText,
        withdrawnVisibleToAi,
        withdrawnAt: now,
        originalMessageId: messageId,
        timestamp: now
      });

      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      refreshCurrentMessageListOnly(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次引用防闪屏修复] 消息气泡工具栏 → 引用回复
       说明：
       1. 点击“引用”只局部同步底栏引用框和当前气泡工具栏，不再整页重绘，避免闪屏。
       2. 用户发送后 sendMessage 会立即清空 state.pendingQuote 并移除底栏引用框。
       3. quote 字段只随消息对象写入 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
       ======================================================================== */
    case 'msg-bubble-quote': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      const session = state.sessions.find(item => String(item.id) === String(state.currentChatId)) || {};
      if (!message) break;

      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.pendingQuote = createQuotePayloadFromMessage(message, session, state.profile || {});
      state.selectedMessageId = '';
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = '';
      state.coffeeDockOpen = false;
      state.stickerPanelOpen = false;

      syncMessageDockOpenState(container, state);
      if (!syncPendingQuoteComposer(container, state)) {
        renderCurrentChatMessage(container, state, { keepScroll: true });
      } else {
        refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      }
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次引用防闪屏修复] 取消底栏引用回复
       说明：只局部移除底栏引用框，不重绘整个聊天界面。
       ======================================================================== */
    case 'cancel-msg-quote': {
      state.pendingQuote = null;
      if (!syncPendingQuoteComposer(container, state)) {
        renderCurrentChatMessage(container, state, { keepScroll: true });
      }
      break;
    }

    case 'confirm-edit-message': {
      const messageId = String(target.dataset.messageId || '');
      const input = container.querySelector('[data-role="edit-message-content-input"]');
      const value = String(input?.value || '').trim();
      if (!messageId || !value) {
        renderModalNotice(container, '请输入消息内容');
        break;
      }
      const index = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (index < 0) break;
      state.currentMessages[index] = { ...state.currentMessages[index], content: value, editedAt: Date.now() };
      state.selectedMessageId = messageId;
      state.selectedAsideSegmentId = '';
      state.deleteConfirmMessageId = '';
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      closeModal(container);
      refreshMessageBubbleRows(container, state, [messageId]);
      break;
    }

    /* ======================================================================
       [区域标注·已完成·本次旁白编辑弹窗指向修复] 保存旁白编辑结果
       说明：
       1. 只更新当前 owner 消息上的 asideSegments[].text，并同步兼容字段 asideText。
       2. 不改动所属 AI 消息正文 content。
       3. 持久化仍统一只走 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
       ====================================================================== */
    case 'confirm-edit-aside': {
      const messageId = String(target.dataset.messageId || '').trim();
      const asideSegmentId = String(target.dataset.asideSegmentId || '').trim();
      const input = container.querySelector('[data-role="edit-aside-content-input"]');
      const value = String(input?.value || '').trim();
      if (!messageId || !asideSegmentId || !value) {
        renderModalNotice(container, '请输入旁白内容');
        break;
      }

      const index = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (index < 0) break;

      const sourceMessage = state.currentMessages[index] || {};
      const nextAsideSegments = Array.isArray(sourceMessage.asideSegments)
        ? sourceMessage.asideSegments.map((segment, segmentIndex) => {
            const fallbackId = String(segment?.id || `${sourceMessage?.id || 'aside'}_${segmentIndex + 1}`);
            return fallbackId === asideSegmentId
              ? { ...segment, id: fallbackId, text: value }
              : { ...segment, id: fallbackId };
          })
        : [];

      const hasMatchedAsideSegment = nextAsideSegments.some(segment => String(segment?.id || '') === asideSegmentId);
      if (!hasMatchedAsideSegment && !String(sourceMessage.asideText || '').trim()) break;

      state.currentMessages[index] = {
        ...sourceMessage,
        asideSegments: hasMatchedAsideSegment ? nextAsideSegments : sourceMessage.asideSegments,
        asideText: hasMatchedAsideSegment
          ? nextAsideSegments
              .map(segment => String(segment?.text || '').trim())
              .filter(Boolean)
              .join('\n')
          : value,
        editedAt: Date.now()
      };
      state.selectedMessageId = messageId;
      state.selectedAsideSegmentId = asideSegmentId;
      state.deleteConfirmMessageId = '';
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      closeModal(container);
      refreshMessageBubbleRows(container, state, [messageId]);
      break;
    }

    /* ==========================================================================
       [区域标注·本次修复3-已完成] 气泡收藏入口：单条消息直接收藏并局部刷新，避免闪屏
       说明：
       1. 点击“收藏”后直接把当前气泡收藏到当前面具的收藏数据。
       2. 不再切入多选模式，不触发整页 renderCurrentChatMessage 重绘。
       3. 收藏完成后仅局部刷新当前气泡行状态，保持界面稳定。
       ========================================================================== */
    case 'msg-bubble-favorite': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (!message) break;

      await addMessagesToFavorites(container, state, db, [message]);

      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.selectedMessageId = '';
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = '';
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·气泡功能区复制] 消息气泡功能栏 — 复制本条消息内容
       说明：复制只使用剪贴板 API / 临时 DOM，不写入任何持久化存储。
       ========================================================================== */
    case 'msg-bubble-copy': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (!message) break;

      const copyText = String(
        message.type === 'sticker'
          ? (message.stickerName || message.content || '')
          : (message.type === 'image'
              ? (message.imageName || message.content || '')
              : (message.type === 'transfer'
                  ? (message.transferDisplayAmount || message.content || '')
                  : (message.content || '')))
      ).trim();
      if (!copyText) break;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(copyText);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = copyText;
          textarea.setAttribute('readonly', 'readonly');
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          textarea.remove();
        }
      } catch (error) {
        break;
      }

      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.selectedMessageId = '';
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = '';
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 删除单条消息
       ========================================================================== */
    case 'msg-bubble-delete': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 START ===== */
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.deleteConfirmMessageId = state.deleteConfirmMessageId === messageId ? '' : messageId;
      state.rewindConfirmMessageId = '';
      state.selectedMessageId = messageId;
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      /* ===== 闲谈：气泡功能区局部刷新防闪屏 END ===== */
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·系统提示小字删除] 系统提示小字 — 删除选项二次确认
       ========================================================================== */
    case 'msg-system-tip-delete': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      state.deleteConfirmMessageId = state.deleteConfirmMessageId === messageId ? '' : messageId;
      state.selectedMessageId = messageId;
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, messageId]);
      break;
    }

    /* ===== 闲谈：删除消息二次确认 START ===== */
    case 'msg-bubble-confirm-delete': {
      const messageId = String(target.dataset.messageId || state.deleteConfirmMessageId || state.selectedMessageId || '');
      if (!messageId || state.deleteConfirmMessageId !== messageId) break;
      state.currentMessages = (state.currentMessages || []).filter(message => String(message.id) !== messageId);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshCurrentMessageListOnly(container, state);
      break;
    }
    /* ===== 闲谈：删除消息二次确认 END ===== */

    /* ========================================================================
       [区域标注·已完成·消息回溯] 消息气泡功能栏 — 回溯二次确认
       说明：
       1. 第一次点击只进入确认态，避免误触。
       2. 再次点击“取消”会关闭确认态，不删除任何消息。
       3. 只刷新相关气泡行，不重绘整页，避免页面闪屏。
       ======================================================================== */
    case 'msg-bubble-rewind': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      const previousSelectedId = state.selectedMessageId;
      const previousDeleteConfirmId = state.deleteConfirmMessageId;
      const previousRewindConfirmId = state.rewindConfirmMessageId;
      state.selectedMessageId = messageId;
      state.deleteConfirmMessageId = '';
      state.rewindConfirmMessageId = state.rewindConfirmMessageId === messageId ? '' : messageId;
      refreshMessageBubbleRows(container, state, [previousSelectedId, previousDeleteConfirmId, previousRewindConfirmId, messageId]);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·消息回溯] 确认回溯并写入 IndexedDB
       说明：
       1. 保留当前点击气泡，删除其后的所有消息，包括中间系统小字提示。
       2. 同步刷新当前会话最近消息摘要，并通过 persistCurrentMessages/dbPut 写入 DB.js / IndexedDB。
       3. 不使用 localStorage/sessionStorage，不写任何双份兜底存储。
       ======================================================================== */
    case 'msg-bubble-confirm-rewind': {
      const messageId = String(target.dataset.messageId || state.rewindConfirmMessageId || state.selectedMessageId || '');
      if (!messageId || state.rewindConfirmMessageId !== messageId) break;
      const messageIndex = (state.currentMessages || []).findIndex(message => String(message.id) === messageId);
      if (messageIndex < 0) break;

      state.currentMessages = (state.currentMessages || []).slice(0, messageIndex + 1);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshCurrentMessageListOnly(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·系统提示小字删除] 系统提示小字 — 确认删除
       说明：删除后只更新当前聊天消息并持久化到 DB.js / IndexedDB。
       ========================================================================== */
    case 'msg-system-tip-confirm-delete': {
      const messageId = String(target.dataset.messageId || state.deleteConfirmMessageId || state.selectedMessageId || '');
      if (!messageId || state.deleteConfirmMessageId !== messageId) break;
      state.currentMessages = (state.currentMessages || []).filter(message => String(message.id) !== messageId);
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      refreshCurrentMessageListOnly(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 消息气泡功能栏 — 进入多选模式
       ========================================================================== */
    case 'msg-bubble-multi': {
      const messageId = String(target.dataset.messageId || state.selectedMessageId || '');
      if (!messageId) break;
      state.selectedMessageId = '';
      state.selectedAsideSegmentId = '';
      state.deleteConfirmMessageId = '';
      state.multiSelectMode = true;
      state.selectedMessageIds = [messageId];
      renderCurrentChatMessage(container, state, { keepScroll: true });
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 勾选/取消勾选消息
       ========================================================================== */
    case 'msg-multi-toggle': {
      const messageId = String(target.dataset.messageId || '');
      if (!messageId) break;
      const selectedSet = new Set((state.selectedMessageIds || []).map(String));
      if (selectedSet.has(messageId)) {
        selectedSet.delete(messageId);
      } else {
        selectedSet.add(messageId);
      }
      state.selectedMessageIds = Array.from(selectedSet);
      /* ===== 闲谈：多选勾选局部刷新防闪屏 START ===== */
      refreshMessageBubbleRows(container, state, [messageId]);
      updateMultiSelectActionBar(container, state);
      /* ===== 闲谈：多选勾选局部刷新防闪屏 END ===== */
      break;
    }

    /* [区域标注·本次需求5] 多选模式 — 取消 */
    case 'msg-multi-cancel':
      resetMessageSelectionState(state);
      renderCurrentChatMessage(container, state, { keepScroll: true });
      break;

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 删除选中消息组
       ========================================================================== */
    case 'msg-multi-delete-selected': {
      const selectedSet = new Set((state.selectedMessageIds || []).map(String));
      if (!selectedSet.size) break;
      state.currentMessages = (state.currentMessages || []).filter(message => !selectedSet.has(String(message.id)));
      resetMessageSelectionState(state);
      refreshCurrentSessionLastMessage(state);
      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* [区域标注·已完成·聊天消息收藏] 多选模式 — 收藏为单条/消息组卡片 */
    case 'msg-multi-favorite-selected': {
      const selectedMessages = getSelectedMessages(state);
      if (!selectedMessages.length) break;
      await addMessagesToFavorites(container, state, db, selectedMessages);
      resetMessageSelectionState(state);
      renderCurrentChatMessage(container, state, { keepScroll: true });
      break;
    }

    /* [区域标注·本次需求5] 多选模式 — 打开转发联系人弹窗 */
    case 'msg-multi-forward':
      if ((state.selectedMessageIds || []).length) showForwardMessagesModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·本次需求5] 多选模式 — 确认转发到其它聊天联系人
       ========================================================================== */
    case 'confirm-forward-messages': {
      const targetChatId = String(target.dataset.chatId || '');
      const targetSession = state.sessions.find(session => String(session.id) === targetChatId);
      const selectedMessages = getSelectedMessages(state);
      if (!targetSession || !selectedMessages.length) break;

      const targetKey = DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + targetChatId;
      const targetMessages = (await dbGet(db, targetKey)) || [];
      const now = Date.now();
      const forwardedMessages = selectedMessages.map((message, index) => ({
        id: `forward_${now}_${index}`,
        role: 'user',
        content: String(message.content || ''),
        timestamp: now + index
      })).filter(message => message.content.trim());

      targetMessages.push(...forwardedMessages);
      targetSession.lastMessage = forwardedMessages[forwardedMessages.length - 1]?.content || targetSession.lastMessage || '';
      targetSession.lastTime = now;

      await Promise.all([
        dbPut(db, targetKey, targetMessages),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      resetMessageSelectionState(state);
      closeModal(container);
      renderCurrentChatMessage(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·已完成·本次返回按钮点击修复] 聊天设置返回消息页按钮兜底
       说明：主要处理已移至 handleChatReturnClickCapture 捕获阶段；此处保留兜底，
             确保非捕获路径下仍能从设置页回到聊天消息列表。
       ======================================================================== */
    case 'msg-settings-back':
      e.preventDefault();
      e.stopPropagation();
      renderCurrentChatMessage(container, state);
      break;

    /* [区域标注·本次需求] 聊天设置页 — iPhone 风格开关 */
    case 'toggle-external-context':
      state.chatPromptSettings.externalContextEnabled = !state.chatPromptSettings.externalContextEnabled;
      await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
      target.classList.toggle('is-on', state.chatPromptSettings.externalContextEnabled);
      break;

    /* ===== 闲谈应用：时间感知设置开关 START ===== */
    case 'toggle-time-awareness':
      state.chatPromptSettings.timeAwarenessEnabled = !state.chatPromptSettings.timeAwarenessEnabled;
      await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
      target.classList.toggle('is-on', state.chatPromptSettings.timeAwarenessEnabled);
      break;

    /* ========================================================================
       [区域标注·已完成·HTML卡片开关持久化] 聊天设置页 HTML 卡片开关
       说明：
       1. 只把 htmlCardEnabled 写入当前“面具 + 会话对象”的 chatPromptSettings。
       2. 持久化严格只走 DB.js / IndexedDB，不使用 localStorage/sessionStorage，不保留双份兜底。
       3. prompt.js 会据此决定是否注入 HTML 卡片系统提示词；本区域不改其它设置逻辑。
       ======================================================================== */
    case 'toggle-html-card':
      state.chatPromptSettings.htmlCardEnabled = !state.chatPromptSettings.htmlCardEnabled;
      await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
      target.classList.toggle('is-on', state.chatPromptSettings.htmlCardEnabled);
      break;

    /* ========================================================================
       [区域标注·已完成·本次控制台持久显示与防闪屏修复] 日志开关与抽屉操作
       说明：
       1. 开关状态按当前会话写入 IndexedDB；退出再进入不会自动关闭。
       2. 当前会话日志始终后台记录，开关关闭只隐藏抽屉，不停止记录。
       3. 展开/收起、筛选、清空均局部同步控制台 DOM，避免整页重绘闪屏。
       ======================================================================== */
    case 'toggle-chat-console':
      state.chatConsoleEnabled = !state.chatConsoleEnabled;
      if (!state.chatConsoleEnabled) state.chatConsoleExpanded = false;
      await persistCurrentChatConsoleEnabled(state, db);
      syncChatConsoleDock(container, state);
      target.classList.toggle('is-on', state.chatConsoleEnabled);
      break;

    case 'toggle-chat-console-expand':
      state.chatConsoleExpanded = !state.chatConsoleExpanded;
      syncChatConsoleDock(container, state);
      break;

    case 'set-chat-console-filter-warn-error':
      state.chatConsoleWarnErrorOnly = true;
      syncChatConsoleDock(container, state);
      break;

    case 'set-chat-console-filter-all':
      state.chatConsoleWarnErrorOnly = false;
      syncChatConsoleDock(container, state);
      break;

    case 'clear-chat-console-logs':
      state.chatConsoleLogs = [];
      await persistCurrentChatConsoleLogs(state, db);
      syncChatConsoleDock(container, state);
      break;

    case 'copy-chat-console-logs': {
      const text = (state.chatConsoleLogs || []).map(item => `[${item.time}] ${String(item.level || 'info').toUpperCase()} ${item.text}`).join('\n');
      if (!text) break;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        }
      } catch (_) {}
      break;
    }
    /* ===== 闲谈应用：时间感知设置开关 END ===== */

    /* ========================================================================
       [区域标注·本次需求3] 设置页表情包挂载切换
       ======================================================================== */
    case 'toggle-mounted-sticker-group': {
      const groupId = String(target.dataset.stickerGroupId || '').trim();
      if (!groupId) break;
      const current = new Set(Array.isArray(state.chatPromptSettings.mountedStickerGroupIds) ? state.chatPromptSettings.mountedStickerGroupIds.map(String) : []);
      if (current.has(groupId)) {
        current.delete(groupId);
      } else {
        if (groupId === 'all') {
          current.clear();
          current.add('all');
        } else {
          current.delete('all');
          current.add(groupId);
        }
      }
      state.chatPromptSettings.mountedStickerGroupIds = Array.from(current);
      await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
      syncMountedStickerGroupButtons(container, state);
      break;
    }

    /* [区域标注·本次需求] 功能区占位按钮：当前不弹窗、不调用原生 alert */
    case 'msg-feature-placeholder':
      break;

    /* ==========================================================================
       [区域标注·修改1] 钱包折叠栏 — 点击进入钱包子页面
       ========================================================================== */
    case 'open-wallet':
      openSubPage(container, state, 'wallet');
      break;

    /* ==========================================================================
       [区域标注·已完成·收藏入口] 收藏折叠栏 — 点击进入收藏子页面
       ========================================================================== */
    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页 — 打开充值弹窗
       ========================================================================== */
    case 'open-wallet-recharge-modal':
      showWalletRechargeModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页 — 确认充值并写入 IndexedDB
       说明：充值输入金额按人民币累加到 balanceBaseCny。
       ========================================================================== */
    case 'confirm-wallet-recharge': {
      const input = container.querySelector('[data-role="wallet-recharge-input"]');
      const amount = Number(String(input?.value || '').trim());
      if (!Number.isFinite(amount) || amount <= 0) {
        renderModalNotice(container, '请输入大于 0 的充值金额');
        break;
      }
      const now = Date.now();
      state.walletData = normalizeWalletData({
        ...state.walletData,
        balanceBaseCny: Number(state.walletData?.balanceBaseCny || 0) + amount,
        /* ========================================================================
           [区域标注·已完成·本次钱包流水需求] 钱包实时流水记录（充值收入）
           说明：充值成功后写入一条收入流水。
           ======================================================================== */
        ledger: [
          {
            id: `wallet_ledger_${now}_${Math.random().toString(16).slice(2)}`,
            kind: 'recharge',
            direction: 'in',
            title: '钱包充值',
            amountBaseCny: Number(amount.toFixed(2)),
            timestamp: now
          },
          ...(Array.isArray(state.walletData?.ledger) ? state.walletData.ledger : [])
        ],
        updatedAt: now
      });
      await persistWalletData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页 — 打开币种切换弹窗
       ========================================================================== */
    case 'open-wallet-currency-modal':
      state.walletDraftCurrency = String(state.walletData?.displayCurrency || 'CNY').toUpperCase();
      showWalletCurrencyModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页 — 选择弹窗中的目标币种
       ========================================================================== */
    case 'select-wallet-currency': {
      const currencyCode = String(target.dataset.walletCurrency || 'CNY').toUpperCase();
      state.walletDraftCurrency = currencyCode;
      showWalletCurrencyModal(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·本次钱包需求] 钱包页 — 保存显示币种并实时更新单位标识
       ========================================================================== */
    case 'confirm-wallet-currency': {
      const nextCurrency = String(state.walletDraftCurrency || state.walletData?.displayCurrency || 'CNY').toUpperCase();
      state.walletData = normalizeWalletData({
        ...state.walletData,
        displayCurrency: nextCurrency,
        updatedAt: Date.now()
      });
      state.walletDraftCurrency = '';
      await persistWalletData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'open-favorite':
      openSubPage(container, state, 'favorite');
      break;

    /* ==========================================================================
       [区域标注·已完成·本次收藏HTML卡片悬浮放大修复]
       说明：
       1. 收藏页 HTML 固定分组中的 HTML 卡片，单击封面后以悬浮层方式在当前收藏页面放大 iframe 内容。
       2. 点击非 HTML 卡片区域（如收藏页空白、普通收藏卡片、分组栏等）由下方全局收起逻辑关闭悬浮卡片。
       3. 仅切换运行时 DOM class，不读写 IndexedDB，不使用 localStorage/sessionStorage。
       ========================================================================== */
    case 'toggle-favorite-html-card-zoom': {
      if (state.subPageView !== 'favorite') break;

      const card = target.closest('.favorite-html-card');
      if (!card) break;

      e.preventDefault();

      const isExpanded = card.classList.contains('is-expanded');
      container.querySelectorAll('.favorite-html-card.is-expanded').forEach(item => {
        if (item !== card) item.classList.remove('is-expanded');
      });
      card.classList.toggle('is-expanded', !isExpanded);
      break;
    }

    /* ==========================================================================
       [区域标注·已完成·收藏HTML卡片展开跳转上下文]
       说明：
       1. 点击收藏页 HTML 卡片展开面板顶部“跳转”按钮，打开原聊天并滚动到来源 HTML 卡片消息。
       2. 仅读取收藏项已有 sourceChatId/sourceMessageId/sourceContextMessageIds 字段，不新增持久化字段。
       3. 跳转过程只使用 DB.js / IndexedDB 加载原聊天消息，不使用 localStorage/sessionStorage。
       4. 不使用浏览器原生弹窗；若来源消息已不存在，则保持在原聊天页面当前位置。
       ========================================================================== */
    case 'jump-favorite-html-card-source': {
      if (state.subPageView !== 'favorite') break;

      e.preventDefault();
      e.stopPropagation();

      const favoriteId = String(target.dataset.favoriteId || '').trim();
      const favoriteItem = normalizeFavoriteData(state.favoriteData).items.find(item => String(item.id) === favoriteId);
      const sourceChatId = String(target.dataset.sourceChatId || favoriteItem?.sourceChatId || '').trim();
      const sourceMessageId = String(target.dataset.sourceMessageId || favoriteItem?.sourceMessageId || '').trim();
      if (!sourceChatId) break;

      state.subPageView = null;
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      await openChatMessage(container, state, db, sourceChatId);

      const existingMessageIds = new Set((state.currentMessages || []).map(message => String(message.id || '')));
      const contextMessageIds = Array.isArray(favoriteItem?.sourceContextMessageIds)
        ? favoriteItem.sourceContextMessageIds.map(id => String(id || '').trim()).filter(Boolean)
        : [];
      const jumpMessageId = existingMessageIds.has(sourceMessageId)
        ? sourceMessageId
        : contextMessageIds.find(id => existingMessageIds.has(id));

      if (jumpMessageId) {
        window.setTimeout(() => scrollToChatSearchResult(container, jumpMessageId), 120);
      }
      break;
    }

    /* ==========================================================================
       [区域标注·修改1] 表情包折叠栏 — 点击进入表情包子页面
       ========================================================================== */
    case 'open-sticker':
      openSubPage(container, state, 'sticker');
      break;

    /* ==========================================================================
       [区域标注·修改4] 身份数量卡片 — 点击弹窗切换面具身份
       ========================================================================== */
    case 'open-mask-switcher':
      showMaskSwitcherModal(container, state, db, eventBus);
      break;

    /* ==========================================================================
       [区域标注·修改4] 聊天天数卡片 — 点击进入聊天天数详情子页面
       ========================================================================== */
    case 'open-chat-days-detail':
      openSubPage(container, state, 'chatDaysDetail');
      break;

    /* ==========================================================================
       [区域标注·修改4] 好友数量卡片 — 点击（预留，可进入好友列表）
       ========================================================================== */
    case 'open-friends-detail':
      /* 切换到通讯录板块 */
      switchPanel(container, state, 'contacts');
      break;

    /* ==========================================================================
       [区域标注·修改2] 子页面点击标题返回用户主页
       ========================================================================== */
    case 'go-profile':
      closeSubPage(container, state);
      break;

    /* ==========================================================================
       [区域标注·已完成·HTML固定分组切换]
       说明：
       1. 收藏独立页固定分组支持 all 与 html；html 不写入自定义 groups，但必须允许点击切换。
       2. 自定义分组仍按 data.groups 校验；非法分组回退 all。
       3. 分组状态持久化只调用 persistFavoriteData → DB.js / IndexedDB。
       ========================================================================== */
    case 'switch-favorite-group': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const data = normalizeFavoriteData(state.favoriteData);
      const groupId = target.dataset.favoriteGroupId || 'all';
      const exists = groupId === 'all' || groupId === 'html' || data.groups.some(group => group.id === groupId);
      state.favoriteData = { ...data, activeGroupId: exists ? groupId : 'all' };
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      await persistFavoriteData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'create-favorite-group':
      showCreateFavoriteGroupModal(container);
      break;

    case 'confirm-create-favorite-group': {
      const input = container.querySelector('[data-role="favorite-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入分组名称');
        break;
      }
      const data = normalizeFavoriteData(state.favoriteData);
      const group = { id: createUid('favorite_group'), name };
      state.favoriteData = { ...data, groups: [...data.groups, group], activeGroupId: group.id };
      await persistFavoriteData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-delete-favorite-group': {
      const groupId = target.dataset.favoriteGroupId || '';
      const data = normalizeFavoriteData(state.favoriteData);
      if (!groupId || groupId === 'all') break;
      state.favoriteData = {
        ...data,
        groups: data.groups.filter(group => group.id !== groupId),
        subGroups: data.subGroups.map(group => group.parentGroupId === groupId ? { ...group, parentGroupId: 'all' } : group),
        items: data.items.map(item => item.groupId === groupId ? { ...item, groupId: 'all', subGroupId: '', updatedAt: Date.now() } : item),
        activeGroupId: data.activeGroupId === groupId ? 'all' : data.activeGroupId
      };
      await persistFavoriteData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'toggle-favorite-search': {
      const data = normalizeFavoriteData(state.favoriteData);
      state.favoriteData = { ...data, searchOpen: !data.searchOpen };
      await persistFavoriteData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'open-favorite-filter':
      showFavoriteFilterModal(container, state);
      break;

    case 'set-favorite-sort': {
      const sortMode = target.dataset.favoriteSort || 'updatedAt';
      const data = normalizeFavoriteData(state.favoriteData);
      state.favoriteData = { ...data, sortMode };
      await persistFavoriteData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'open-favorite-preview': {
      const favoriteId = target.dataset.favoriteId || '';
      if (favoriteId) showFavoritePreviewModal(container, state, favoriteId);
      break;
    }

    case 'toggle-favorite-item': {
      if (!state.favoriteMultiSelectMode) break;
      const favoriteId = target.dataset.favoriteId || '';
      const selected = new Set((state.selectedFavoriteIds || []).map(String));
      selected.has(favoriteId) ? selected.delete(favoriteId) : selected.add(favoriteId);
      state.selectedFavoriteIds = Array.from(selected);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'favorite-multi-cancel':
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      rerenderCurrentSubPage(container, state);
      break;

    case 'favorite-multi-select-all': {
      const visibleIds = getVisibleFavoriteItems(state).map(item => String(item.id));
      const selected = new Set((state.selectedFavoriteIds || []).map(String));
      const isAllSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
      state.selectedFavoriteIds = isAllSelected ? [] : visibleIds;
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'favorite-multi-delete': {
      const selected = new Set((state.selectedFavoriteIds || []).map(String));
      if (!selected.size) break;
      const data = normalizeFavoriteData(state.favoriteData);
      state.favoriteData = { ...data, items: data.items.filter(item => !selected.has(String(item.id))) };
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      await persistFavoriteData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'favorite-multi-group':
      if ((state.selectedFavoriteIds || []).length) showCreateFavoriteSubGroupModal(container);
      break;

    /* ==========================================================================
       [区域标注·已完成·收藏移动] 多选模式 — 打开"移动到分组"弹窗
       说明：选中收藏卡片后点击"移动"按钮，弹窗列出所有已有大分组供选择。
       ========================================================================== */
    case 'favorite-multi-move':
      if ((state.selectedFavoriteIds || []).length) showMoveFavoriteToGroupModal(container, state);
      break;

    /* ==========================================================================
       [区域标注·已完成·收藏移动确认] 确认将选中收藏卡片移动到目标大分组
       说明：修改选中卡片的 groupId 为目标分组，清除 subGroupId，退出多选模式。
       ========================================================================== */
    case 'confirm-move-favorite-to-group': {
      const targetGroupId = target.dataset.favoriteTargetGroupId || 'all';
      const selected = new Set((state.selectedFavoriteIds || []).map(String));
      if (!selected.size) break;
      const data = normalizeFavoriteData(state.favoriteData);
      const now = Date.now();
      state.favoriteData = {
        ...data,
        items: data.items.map(item =>
          selected.has(String(item.id))
            ? { ...item, groupId: targetGroupId, subGroupId: '', updatedAt: now }
            : item
        )
      };
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      await persistFavoriteData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-create-favorite-sub-group': {
      const input = container.querySelector('[data-role="favorite-sub-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入小分组名称');
        break;
      }

      /* ==========================================================================
         [区域标注·已完成·本次需求2] 收藏再分组：合并选中卡片并生成一张新卡片
         说明：
         1. 不再只给原卡片写 subGroupId 标记。
         2. 将已选收藏卡片按选择顺序合并为一张新收藏卡片。
         3. 每张原卡片的消息组之间插入“————”分隔消息。
         4. 删除原已选卡片，只保留合并后的新卡片；持久化仅走 DB.js / IndexedDB。
         ========================================================================== */
      const data = normalizeFavoriteData(state.favoriteData);
      const selectedIds = (state.selectedFavoriteIds || []).map(String).filter(Boolean);
      const selectedItems = selectedIds
        .map(id => data.items.find(item => String(item.id) === id))
        .filter(Boolean);

      if (selectedItems.length < 2) {
        renderModalNotice(container, '请至少选择两张收藏卡片进行再分组');
        break;
      }

      const now = Date.now();
      const subGroup = { id: createUid('favorite_sub_group'), parentGroupId: data.activeGroupId || 'all', name, createdAt: now };
      const mergedMessages = [];
      selectedItems.forEach((item, itemIndex) => {
        if (itemIndex > 0) {
          mergedMessages.push({
            id: createUid('fav_separator'),
            role: 'system',
            type: 'separator',
            content: '————',
            stickerName: '',
            stickerUrl: '',
            timestamp: now + mergedMessages.length
          });
        }

        (Array.isArray(item.messages) ? item.messages : []).forEach(message => {
          mergedMessages.push({
            id: createUid('fav_msg'),
            role: String(message.role || 'user'),
            type: String(message.type || ''),
            content: String(message.type === 'sticker' ? (message.content || message.stickerName || '[表情包]') : message.content || ''),
            stickerName: String(message.stickerName || ''),
            stickerUrl: String(message.stickerUrl || ''),
            timestamp: Number(message.timestamp || now)
          });
        });
      });

      const selectedSet = new Set(selectedIds);
      const mergedItem = {
        id: createUid('favorite'),
        name,
        groupId: data.activeGroupId || 'all',
        subGroupId: subGroup.id,
        messages: mergedMessages,
        createdAt: now,
        updatedAt: now,
        sourceChatId: selectedItems.every(item => String(item.sourceChatId || '') === String(selectedItems[0]?.sourceChatId || ''))
          ? String(selectedItems[0]?.sourceChatId || '')
          : ''
      };

      state.favoriteData = {
        ...data,
        subGroups: [...data.subGroups, subGroup],
        items: [...data.items.filter(item => !selectedSet.has(String(item.id))), mergedItem]
      };
      state.favoriteMultiSelectMode = false;
      state.selectedFavoriteIds = [];
      await persistFavoriteData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·本次需求3] 表情包独立页面：分组切换、新建分组、添加表情包
       ========================================================================== */
    case 'switch-sticker-group': {
      if (target.dataset.longPressTriggered === '1') {
        delete target.dataset.longPressTriggered;
        break;
      }
      const groupId = target.dataset.stickerGroupId || 'all';
      const data = normalizeStickerData(state.stickerData);
      const exists = groupId === 'all' || data.groups.some(group => group.id === groupId);
      state.stickerData = { ...data, activeGroupId: exists ? groupId : 'all' };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'create-sticker-group':
      showCreateStickerGroupModal(container);
      break;

    case 'confirm-create-sticker-group': {
      const input = container.querySelector('[data-role="sticker-group-name-input"]');
      const name = String(input?.value || '').trim();
      if (!name) {
        renderModalNotice(container, '请输入分组名称');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const group = { id: createUid('sticker_group'), name };
      state.stickerData = {
        ...data,
        groups: [...data.groups, group],
        activeGroupId: group.id
      };
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'open-sticker-upload-modal':
      showStickerUploadModal(container, state);
      break;

    case 'confirm-add-local-sticker': {
      const pending = state.pendingStickerLocalFile;
      const nameInput = container.querySelector('[data-role="sticker-local-name-input"]');
      const name = String(nameInput?.value || pending?.name || '').trim();
      if (!pending?.url) {
        renderModalNotice(container, '请先选择本地表情包文件');
        break;
      }
      if (!name) {
        renderModalNotice(container, '请给这个表情包命名');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const now = Date.now();
      state.stickerData = {
        ...data,
        items: [
          ...data.items,
          {
            id: createUid('sticker'),
            groupId: getStickerTargetGroupId(state),
            name,
            url: pending.url,
            source: 'local',
            createdAt: now
          }
        ]
      };
      state.pendingStickerLocalFile = null;
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-add-url-stickers': {
      const textarea = container.querySelector('[data-role="sticker-url-import-input"]');
      const parsed = parseStickerUrlImportText(textarea?.value || '');
      if (!parsed.length) {
        renderModalNotice(container, '请输入 jpg、png、gif 格式的有效 URL；支持“描述：url”“描述 url”或完整 URL');
        break;
      }

      const data = normalizeStickerData(state.stickerData);
      const targetGroupId = getStickerTargetGroupId(state);
      const now = Date.now();
      const newItems = parsed.map((item, index) => ({
        id: createUid('sticker'),
        groupId: targetGroupId,
        name: item.name,
        url: item.url,
        source: 'url',
        createdAt: now + index
      }));

      state.stickerData = {
        ...data,
        items: [...data.items, ...newItems]
      };
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'confirm-delete-sticker-group': {
      const groupId = target.dataset.stickerGroupId || '';
      const data = normalizeStickerData(state.stickerData);
      const exists = groupId && data.groups.some(group => group.id === groupId);
      if (!exists) break;

      state.stickerData = {
        ...data,
        groups: data.groups.filter(group => group.id !== groupId),
        items: data.items.map(item => item.groupId === groupId ? { ...item, groupId: 'all' } : item),
        activeGroupId: data.activeGroupId === groupId ? 'all' : data.activeGroupId
      };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      closeModal(container);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ========================================================================
       [区域标注·本次需求3] 表情包独立页单击放大预览
       说明：
       1. 单击普通表情包时打开应用内预览弹窗，不使用原生浏览器弹窗。
       2. 延迟 260ms 是为了给既有“双击进入多选删除”留出取消单击的时间。
       ======================================================================== */
    case 'open-sticker-preview': {
      if (state.stickerMultiSelectMode) break;
      const stickerId = String(target.dataset.stickerId || '').trim();
      if (!stickerId) break;
      if (state.stickerPreviewClickTimer) window.clearTimeout(state.stickerPreviewClickTimer);
      state.stickerPreviewClickTimer = window.setTimeout(() => {
        state.stickerPreviewClickTimer = 0;
        showStickerPreviewModal(container, state, stickerId);
      }, 260);
      break;
    }

    /* ========================================================================
       [区域标注·本次需求2] 表情包独立页多选删除
       说明：双击任意表情包进入多选删除态；支持单选、多选、全选与批量删除。
       ======================================================================== */
    case 'toggle-sticker-multi-item': {
      if (!state.stickerMultiSelectMode) break;
      const stickerId = String(target.dataset.stickerId || '').trim();
      if (!stickerId) break;
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      if (selectedSet.has(stickerId)) {
        selectedSet.delete(stickerId);
      } else {
        selectedSet.add(stickerId);
      }
      state.selectedStickerIds = Array.from(selectedSet);
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'sticker-multi-cancel':
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      rerenderCurrentSubPage(container, state);
      break;

    case 'sticker-multi-select-all': {
      const visibleStickerIds = getVisibleStickers(state).map(item => String(item.id));
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      const isAllSelected = visibleStickerIds.length > 0 && visibleStickerIds.every(id => selectedSet.has(id));
      state.selectedStickerIds = isAllSelected ? [] : visibleStickerIds;
      rerenderCurrentSubPage(container, state);
      break;
    }

    case 'sticker-multi-delete-selected': {
      const selectedSet = new Set((state.selectedStickerIds || []).map(String));
      if (!selectedSet.size) break;
      const data = normalizeStickerData(state.stickerData);
      state.stickerData = {
        ...data,
        items: data.items.filter(item => !selectedSet.has(String(item.id)))
      };
      state.stickerMultiSelectMode = false;
      state.selectedStickerIds = [];
      await persistStickerData(state, db);
      rerenderCurrentSubPage(container, state);
      break;
    }

    /* ==========================================================================
       [区域标注·修改4] 面具切换弹窗中选择面具
       ========================================================================== */
    case 'switch-mask': {
      const maskId = target.dataset.maskId;
      if (maskId && maskId !== state.activeMaskId) {
        await performMaskSwitch(container, state, db, eventBus, maskId);
      }
      closeModal(container);
      break;
    }

    default:
      /* ========================================================================
         [区域标注·已完成·语言翻译] 翻译设置折叠栏事件委托
         说明：
         1. 翻译折叠栏中的所有开关、下拉选择、显示模式按钮点击事件统一委托到此处。
         2. handleTranslationSettingsClick 内部会判断 data-action 前缀 "trans-" 并处理。
         3. 持久化只使用 DB.js / IndexedDB，禁止 localStorage/sessionStorage。
         ======================================================================== */
      if (state.currentChatId && action && action.startsWith('trans-')) {
        await handleTranslationSettingsClick(e, target, action, state, container, db);
      }
      break;
  }
}

/* ==========================================================================
   [区域标注·修改5] 保存当前面具的聊天数据到 IndexedDB
   说明：在切换面具前调用，确保旧面具的数据不会丢失
   ========================================================================== */
async function saveMaskData(state, db, maskId) {
  await Promise.all([
    dbPut(db, DATA_KEY_SESSIONS(maskId), state.sessions),
    /* === [本次修改] 聊天列表长按删除联系人：隐藏状态保存到 IndexedDB === */
    dbPut(db, DATA_KEY_HIDDEN_CHAT_IDS(maskId), state.hiddenChatIds),
    dbPut(db, DATA_KEY_CONTACTS(maskId), state.contacts),
    /* [区域标注·本次需求1] 持久化通讯录自定义分组到 IndexedDB（禁止浏览器同步键值存储） */
    dbPut(db, DATA_KEY_CONTACT_GROUPS(maskId), state.contactGroups),
    dbPut(db, DATA_KEY_MOMENTS(maskId), state.moments),
    /* [区域标注·已完成·本次钱包需求] 切换面具前保存当前面具钱包数据 */
    dbPut(db, DATA_KEY_WALLET(maskId), normalizeWalletData(state.walletData)),
    /* [区域标注·已完成·收藏持久化] 切换面具前保存当前面具收藏数据 */
    dbPut(db, DATA_KEY_FAVORITES(maskId), normalizeFavoriteData(state.favoriteData))
  ]);
}

/* ==========================================================================
   [区域标注·修改5] 加载指定面具的聊天数据
   说明：在切换面具后调用，从 IndexedDB 恢复该面具的数据
   ========================================================================== */
async function loadMaskData(state, db, maskId) {
  const [sessions, hiddenChatIds, contacts, contactGroups, moments, walletData, favoriteData] = await Promise.all([
    dbGet(db, DATA_KEY_SESSIONS(maskId)),
    dbGet(db, DATA_KEY_HIDDEN_CHAT_IDS(maskId)),
    dbGet(db, DATA_KEY_CONTACTS(maskId)),
    dbGet(db, DATA_KEY_CONTACT_GROUPS(maskId)),
    dbGet(db, DATA_KEY_MOMENTS(maskId)),
    dbGet(db, DATA_KEY_WALLET(maskId)),
    dbGet(db, DATA_KEY_FAVORITES(maskId))
  ]);
  state.sessions = sessions || [];
  /* === [本次修改] 聊天列表长按删除联系人：切换面具时恢复对应隐藏状态 === */
  state.hiddenChatIds = Array.isArray(hiddenChatIds) ? hiddenChatIds.map(String) : [];
  state.contacts = normalizeContacts(contacts);
  /* [区域标注·本次需求1] 切换面具时同步加载该面具的通讯录分组 */
  state.contactGroups = normalizeContactGroups(contactGroups);
  state.activeContactGroupId = 'all';
  state.moments = moments || [];
  state.momentsComposeOpen = false;
  state.momentsComposeDraft = createMomentsComposeDraft();
  resetMomentsInteractionState(state);
  state.currentChatId = null;
  state.currentMessages = [];
  state.chatMessageVisibleCount = CHAT_MESSAGE_INITIAL_VISIBLE_COUNT;
  resetMessageSelectionState(state);
  /* [区域标注·已完成·本次钱包需求] 切换面具时同步加载对应钱包数据 */
  state.walletData = normalizeWalletData(walletData);
  state.walletDraftCurrency = '';
  state.favoriteData = normalizeFavoriteData(favoriteData);
  state.favoriteMultiSelectMode = false;
  state.selectedFavoriteIds = [];
  /* [区域标注·已修改] 聊天提示词设置已改为按“当前面具 + 当前聊天对象”独立读取；切换面具时不再加载面具级通用设置 */
  state.chatPromptSettings = normalizeChatPromptSettings(null);
  state.pendingStickerLocalFile = null;
  state.stickerPanelOpen = false;
  state.stickerPanelGroupId = 'all';
  state.coffeeDockOpen = false;
  state.pendingQuote = null;
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];
}

/* ==========================================================================
   [区域标注·修改4·修改5] 执行面具切换
   说明：保存旧面具数据 → 更新面具ID → 加载新面具数据 → 重建profile → 重渲染
         同时通知档案应用更新 activeMaskId
   ========================================================================== */
async function performMaskSwitch(container, state, db, eventBus, newMaskId) {
  const oldMaskId = state.activeMaskId;

  /* [修改5] 保存旧面具数据 */
  await saveMaskData(state, db, oldMaskId);

  /* 更新面具ID */
  state.activeMaskId = newMaskId;

  /* [区域标注·已完成·本次面具持久化修复] 将新激活面具写回档案应用的 IndexedDB 记录，避免下次进入闲谈时回到默认面具 */
  try {
    const latestArchive = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);
    const nextArchiveData = {
      ...(latestArchive && typeof latestArchive === 'object' ? latestArchive : {}),
      activeMaskId: newMaskId
    };
    /* ======================================================================
       [修改标注·已完成·本次需求1·档案主记录写回修复]
       说明：
       1. 切换闲谈用户面具时需要同步档案应用的 activeMaskId。
       2. archive::archive-data 是档案应用主记录，必须保持档案应用使用的 value 结构。
       3. 禁止用闲谈 dbPut() 写该记录；dbPut() 会写成 data 字段并覆盖原 value，
          导致档案应用重进后读不到 masks/characters，页面回到初始状态。
       4. 本区只使用 DB.js / IndexedDB，不使用 localStorage/sessionStorage，也不写双份存储。
       5. 若 IndexedDB 中已存在旧错误 data 结构，上方 dbGetArchiveData 已兼容读出，
          此处会统一修正回 value 结构。
       ====================================================================== */
    await db?.put?.('appsData', {
      id: ARCHIVE_DB_RECORD_ID,
      appId: 'archive',
      key: 'archive-data',
      value: nextArchiveData,
      updatedAt: Date.now()
    });
  } catch (_) {
    // 保持界面流程继续执行，避免面具切换被持久化失败阻断
  }

  /* [修改5] 加载新面具数据 */
  await loadMaskData(state, db, newMaskId);

  /* [修改4·修改6] 重建 profile */
  buildProfileFromMask(state);

  /* 通知档案应用同步 activeMaskId */
  eventBus.emit('archive:active-mask-changed', { maskId: newMaskId });

  /* 重新渲染全部板块 */
  container.innerHTML = buildAppShell(state);
}

/* ==========================================================================
   [区域标注·修改1] 打开子页面（钱包 / 表情包 / 聊天天数详情）
   说明：隐藏主界面元素，在内容区显示独立子页面
   ========================================================================== */
function openSubPage(container, state, pageType) {
  state.subPageView = pageType;
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];
  state.favoriteMultiSelectMode = false;
  state.selectedFavoriteIds = [];

  const topBar = container.querySelector('.chat-top-bar');
  const subTabs = container.querySelector('[data-role="chat-sub-tabs"]');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const panels = container.querySelectorAll('.chat-panel');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = 'none';
  if (subTabs) subTabs.style.display = 'none';
  if (bottomTab) bottomTab.style.display = 'none';
  panels.forEach(p => p.style.display = 'none');

  if (msgWrap) {
    msgWrap.style.display = 'flex';
    msgWrap.innerHTML = renderSubPage(state, pageType);
  }
}

/* ==========================================================================
   [区域标注·修改1] 关闭子页面，返回用户主页
   ========================================================================== */
function closeSubPage(container, state) {
  state.subPageView = null;
  state.walletDraftCurrency = '';
  state.stickerMultiSelectMode = false;
  state.selectedStickerIds = [];
  state.favoriteMultiSelectMode = false;
  state.selectedFavoriteIds = [];

  const topBar = container.querySelector('.chat-top-bar');
  const bottomTab = container.querySelector('[data-role="bottom-tab"]');
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');

  if (topBar) topBar.style.display = '';
  if (bottomTab) bottomTab.style.display = '';

  PANEL_KEYS.forEach(k => {
    const el = container.querySelector(`[data-panel="${k}"]`);
    if (el) {
      el.style.display = '';
      el.classList.toggle('is-active', k === state.activePanel);
    }
  });

  if (msgWrap) {
    msgWrap.style.display = 'none';
    msgWrap.innerHTML = '';
  }
}

function rerenderCurrentSubPage(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (msgWrap && state.subPageView) {
    msgWrap.innerHTML = renderSubPage(state, state.subPageView);
  }
}

/* ==========================================================================
   [区域标注·已完成·本次需求1] 收藏独立页搜索结果局部刷新
   说明：
   1. 搜索输入时只替换收藏卡片网格，不重建搜索 input。
   2. 保持移动端输入法焦点，允许连续删除多个字。
   3. 持久化仍只写 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
function refreshFavoriteSearchResultsOnly(container, state) {
  if (state.subPageView !== 'favorite') return;
  const currentGrid = container.querySelector('.favorite-grid');
  if (!currentGrid) return;

  const draft = document.createElement('div');
  draft.innerHTML = renderSubPage(state, 'favorite');
  const nextGrid = draft.querySelector('.favorite-grid');
  if (nextGrid) currentGrid.innerHTML = nextGrid.innerHTML;
}

/* ==========================================================================
   [区域标注] 输入事件代理处理器
   说明：处理搜索框等输入事件
   ========================================================================== */
function handleInput(e, state, container, db) {
  const target = e.target;

  /* ========================================================================
     [区域标注·已完成·输入框表情包名称联想] 聊天消息输入框实时联想
     说明：
     1. 用户在消息输入框输入文字时，按表情包名称包含关系局部显示匹配结果。
     2. 例如输入“哭”匹配名称含“哭”的表情包；输入“哭哭”只匹配名称含“哭哭”的表情包。
     3. 只调用 syncStickerInputSuggestions 局部插入/移除联想条，不重绘聊天页，避免闪屏。
     4. 本区域只读取运行时 state.stickerData，不写持久化存储，不使用 localStorage/sessionStorage。
     ======================================================================== */
  if (target.matches('[data-role="msg-input"]')) {
    syncMessageInputAutoHeight(target);
    syncStickerInputSuggestions(container, state, target.value || '');
    return;
  }

  /* ========================================================================
     [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页文字输入同步
     说明：只更新运行时草稿，不做持久化；正式发布时再统一写入 DB.js / IndexedDB。
     ======================================================================== */
  if (target.matches('[data-role="moments-compose-textarea"]')) {
    const draft = ensureMomentsComposeDraft(state);
    state.momentsComposeDraft = normalizeMomentsComposeDraft({
      ...draft,
      text: target.value || ''
    });
    return;
  }

  /* [区域标注] 聊天列表搜索输入 */
  if (target.matches('[data-role="msg-search-input"]')) {
    /* ========================================================================
       [区域标注·已完成·聊天记录搜索文案与防穿透修复] 搜索框输入：实时命中聊天记录
       说明：
       1. 不限制输入字数；你与对方的消息均由 chat-message.js 根据当前消息列表匹配。
       2. 只局部刷新顶栏下方搜索结果面板，不重绘整个聊天页，避免闪屏。
       3. 输入事件不冒泡到桌面层，避免搜索浮层操作误触发“添加应用与组件”窗口。
       4. 仅保存为运行时状态，不使用 localStorage/sessionStorage。
       ======================================================================== */
    e.stopPropagation();
    state.chatMessageSearchKeyword = target.value || '';
    syncChatMessageSearchPanel(container, state);
    return;
  }

  if (target.matches('[data-role="chat-search-input"]')) {
    state.chatSearchKeyword = target.value || '';
    refreshPanel(container, state, 'chatList');
    return;
  }

  /* [区域标注] 弹窗中搜索输入 */
  if (target.matches('[data-role="modal-search"]')) {
    const keyword = (target.value || '').toLowerCase();
    const body = container.querySelector('[data-role="modal-body"]');
    if (!body) return;
    body.querySelectorAll('.chat-modal-contact').forEach(item => {
      const nameEl = item.querySelector('.chat-modal-contact__name');
      const name = (nameEl?.textContent || '').toLowerCase();
      item.style.display = name.includes(keyword) ? '' : 'none';
    });
    return;
  }

  /* ==========================================================================
     [区域标注·本次需求2] 通讯录弹窗联系方式搜索输入
     说明：只在弹窗内搜索，通讯录页面内不保留搜索框
     ========================================================================== */
  if (target.matches('[data-role="contact-add-search-input"]')) {
    renderContactSearchResults(container, state, target.value || '');
    return;
  }

  if (target.matches('[data-role="favorite-search-input"]')) {
    /* ==========================================================================
       [区域标注·已完成·本次需求1] 收藏搜索输入：不重建输入框，避免键盘关闭
       说明：
       1. 每次输入/删除只更新收藏数据与卡片网格。
       2. 不调用 rerenderCurrentSubPage，避免搜索 input 被替换导致输入法收起。
       3. 持久化仅写入 DB.js / IndexedDB。
       ========================================================================== */
    const data = normalizeFavoriteData(state.favoriteData);
    state.favoriteData = { ...data, searchKeyword: target.value || '' };
    dbPut(db, DATA_KEY_FAVORITES(state.activeMaskId), normalizeFavoriteData(state.favoriteData));
    refreshFavoriteSearchResultsOnly(container, state);
    return;
  }

  /* ==========================================================================
     [区域标注·已完成·当前会话头像裁剪预览]
     说明：滑杆只更新应用内裁剪预览，不写入任何持久化存储。
     ========================================================================== */
  if (target.matches('[data-role="chat-avatar-crop-zoom"], [data-role="chat-avatar-crop-x"], [data-role="chat-avatar-crop-y"]')) {
    updateChatAvatarCropPreview(container);
    return;
  }

  /* ==========================================================================
     [区域标注·已修改] 聊天设置输入按联系人独立持久化
     说明：当前指令、自定义思维链统一写入“当前面具 + 当前聊天对象”的 IndexedDB 记录。
     ========================================================================== */
  /* ==========================================================================
     [区域标注·已完成·当前会话备注输入持久化]
     说明：
     1. 备注只写入当前会话 session.remark（DB.js / IndexedDB），不改 contacts/contact.name。
     2. 备注仅用于本地 UI 显示，不写入 chatPromptSettings，AI 不可见。
     3. 输入不做长度限制；随输入实时保存并同步聊天页顶部昵称与聊天列表名称。
     ========================================================================== */
  if (target.matches('[data-role="msg-session-remark"]')) {
    const currentSession = (state.sessions || []).find(item => String(item.id) === String(state.currentChatId));
    if (!currentSession) return;
    currentSession.remark = target.value ?? '';
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);

    const remarkDisplayName = String(currentSession.remark ?? '').length
      ? String(currentSession.remark)
      : String(currentSession.name || '聊天');

    const topNameEl = container.querySelector('.msg-top-bar__name');
    if (topNameEl) topNameEl.textContent = remarkDisplayName;

    refreshPanel(container, state, 'chatList');
    return;
  }

  if (target.matches('[data-role="msg-current-command"]')) {
    state.chatPromptSettings.currentCommand = target.value || '';
    dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
    return;
  }

  if (target.matches('[data-role="msg-custom-thinking"]')) {
    state.chatPromptSettings.customThinkingInstruction = target.value || '';
    dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
    return;
  }

  /* ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== */
  if (target.matches('[data-role="msg-reply-bubble-min"], [data-role="msg-reply-bubble-max"], [data-role="msg-short-term-memory-rounds"]')) {
    const minInput = container.querySelector('[data-role="msg-reply-bubble-min"]');
    const maxInput = container.querySelector('[data-role="msg-reply-bubble-max"]');
    const memoryInput = container.querySelector('[data-role="msg-short-term-memory-rounds"]');

    const min = Math.max(1, Math.floor(Number(minInput?.value || 1)) || 1);
    const max = Math.max(min, Math.floor(Number(maxInput?.value || min)) || min);
    const rounds = Math.max(0, Math.floor(Number(memoryInput?.value || 0)) || 0);

    state.chatPromptSettings.replyBubbleMin = min;
    state.chatPromptSettings.replyBubbleMax = max;
    state.chatPromptSettings.shortTermMemoryRounds = rounds;

    if (minInput && String(minInput.value) !== String(min)) minInput.value = String(min);
    if (maxInput && String(maxInput.value) !== String(max)) maxInput.value = String(max);
    if (memoryInput && String(memoryInput.value) !== String(rounds)) memoryInput.value = String(rounds);

    dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
    return;
  }
  /* ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== */
}

/* ==========================================================================
   [区域标注·本次需求3] 表情包本地上传 change 处理
   说明：读取为 data URL 后仅暂存在运行时，用户点击确认才写入 IndexedDB。
   ========================================================================== */
async function handleChange(e, state, container, db) {
  const target = e.target;

  /* ========================================================================
     [区域标注·已完成·聊天记录导入导出] JSON 导入文件读取、校验与 IndexedDB 落库
     说明：
     1. 仅接受 chat-export-import.js 从聊天设置页导出的 JSON。
     2. 导入后直接替换当前联系人会话消息，并通过 persistCurrentMessages/dbPut 写入 DB.js / IndexedDB。
     3. 不使用 localStorage/sessionStorage，不写双份兜底，不按长文本字段过滤消息内容。
     ======================================================================== */
  if (target?.matches?.('[data-role="chat-import-json-file-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    try {
      const importedMessages = await readAndValidateChatImportJsonFile(file, state);
      state.currentMessages = Array.isArray(importedMessages) ? importedMessages : [];
      resetMessageSelectionState(state);
      state.chatMessageVisibleCount = CHAT_MESSAGE_INITIAL_VISIBLE_COUNT;
      refreshCurrentSessionLastMessage(state);

      await Promise.all([
        persistCurrentMessages(state, db),
        dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
      ]);

      closeModal(container);
      renderCurrentChatMessage(container, state);
    } catch (error) {
      showChatExportImportNoticeModal(container, {
        title: '导入失败',
        message: error?.message || '聊天记录导入失败，请确认 JSON 文件来源。'
      });
    } finally {
      target.value = '';
    }
    return;
  }

  /* ========================================================================
     [区域标注·已完成·当前会话头像本地上传]
     说明：
     1. 从聊天设置页头像板块选择本地图片后读取为 data URL，并进入应用内裁剪弹窗。
     2. 只暂存于弹窗预览；点击保存后才写入当前 session.avatar → DB.js / IndexedDB。
     3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
     ======================================================================== */
  if (target?.matches?.('[data-role="msg-avatar-file-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    if (!/^image\//i.test(file.type || '')) {
      renderModalNotice(container, '请选择图片文件');
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = String(reader.result || '');
      if (!imageUrl.startsWith('data:image/')) {
        renderModalNotice(container, '图片读取失败，请重新选择');
        return;
      }
      showChatAvatarCropModal(container, {
        imageUrl,
        source: 'local',
        fileName: file.name || '本地头像'
      });
    };
    reader.onerror = () => renderModalNotice(container, '图片读取失败，请重新选择');
    reader.readAsDataURL(file);
    return;
  }

  /* ========================================================================
     [区域标注·已完成·AI识图本地图片上传] 聊天消息页图片文件选择
     说明：
     1. 从咖啡功能区“图片”弹窗选择本地图片后读取为 data URL。
     2. 直接作为 type:image 消息写入当前聊天记录并持久化到 DB.js / IndexedDB。
     3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
     ======================================================================== */
  if (target?.matches?.('[data-role="msg-image-file-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    if (!/^image\//i.test(file.type || '')) {
      renderModalNotice(container, '请选择图片文件');
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageUrl = String(reader.result || '');
      if (!imageUrl.startsWith('data:image/')) {
        renderModalNotice(container, '图片读取失败，请重新选择');
        return;
      }
      await sendImageMessage(container, state, db, imageUrl, null, {
        imageName: file.name || '本地图片',
        triggerAi: false
      });
      closeModal(container);
    };
    reader.onerror = () => renderModalNotice(container, '图片读取失败，请重新选择');
    reader.readAsDataURL(file);
    return;
  }
 

  /* ========================================================================
     [区域标注·已完成·本次朋友圈独立发帖页接线] 发帖页本地图片选择
     说明：
     1. 读取本地图片为 data URL 后仅写入运行时草稿。
     2. 正式发布时才统一写入朋友圈与可选聊天分享的 IndexedDB 数据。
     3. 不使用 localStorage/sessionStorage，不保留双份兜底存储。
     ======================================================================== */
  if (target?.matches?.('[data-role="moments-compose-local-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    const draft = ensureMomentsComposeDraft(state);
    if (draft.images.length >= MOMENTS_COMPOSE_MAX_IMAGES) {
      renderModalNotice(container, `最多只能添加 ${MOMENTS_COMPOSE_MAX_IMAGES} 张图片`);
      target.value = '';
      return;
    }

    if (!/^image\//i.test(file.type || '')) {
      renderModalNotice(container, '请选择图片文件');
      target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = String(reader.result || '');
      if (!imageUrl.startsWith('data:image/')) {
        renderModalNotice(container, '图片读取失败，请重新选择');
        target.value = '';
        return;
      }

      const latestDraft = ensureMomentsComposeDraft(state);
      state.momentsComposeDraft = normalizeMomentsComposeDraft({
        ...latestDraft,
        images: [
          ...latestDraft.images,
          {
            id: createUid('moments_compose_image'),
            src: imageUrl,
            name: file.name || '本地图片'
          }
        ]
      });
      target.value = '';
      renderMomentsComposeIntoPage(container, state);
    };
    reader.onerror = () => {
      renderModalNotice(container, '图片读取失败，请重新选择');
      target.value = '';
    };
    reader.readAsDataURL(file);
    return;
  }

  /* ===== 闲谈表情包本地文件导入：txt/docx change 处理 START ===== */
  if (target?.matches?.('[data-role="sticker-import-file-input"]')) {
    const file = target.files?.[0];
    if (!file) return;

    try {
      const fileName = String(file.name || '').toLowerCase();
      const text = fileName.endsWith('.docx')
        ? await readDocxText(file)
        : await file.text();
      await importStickerTextToCurrentGroup(container, state, db, text);
    } catch (error) {
      renderModalNotice(container, error?.message || '本地文件导入失败');
    } finally {
      target.value = '';
    }
    return;
  }
  /* ===== 闲谈表情包本地文件导入：txt/docx change 处理 END ===== */

  if (!target?.matches?.('[data-role="sticker-local-file-input"]')) return;

  const file = target.files?.[0];
  if (!file) return;

  if (!/^image\/(jpeg|png|gif)$/i.test(file.type || '')) {
    renderModalNotice(container, '本地上传仅支持 jpg、png、gif 格式');
    target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result || '');
    state.pendingStickerLocalFile = {
      name: file.name.replace(/\.(jpg|jpeg|png|gif)$/i, ''),
      url
    };

    const nameInput = container.querySelector('[data-role="sticker-local-name-input"]');
    if (nameInput && !String(nameInput.value || '').trim()) {
      nameInput.value = state.pendingStickerLocalFile.name;
    }

    const preview = container.querySelector('[data-role="sticker-local-preview"]');
    if (preview) {
      preview.innerHTML = `
        <img src="${escapeHtml(url)}" alt="${escapeHtml(state.pendingStickerLocalFile.name)}">
        <span>${escapeHtml(state.pendingStickerLocalFile.name)}</span>
      `;
    }
  };
  reader.readAsDataURL(file);
}

/* ==========================================================================
   [区域标注·已完成·聊天输入框一至三行自适应]
   说明：Enter 仍沿用原发送行为；Shift+Enter 保留 textarea 原生换行，用于手动输入多行。
   ========================================================================== */
async function handleKeydown(e, state, container, db, settingsManager) {
  const target = e.target;

  /* ==========================================================================
     [区域标注·已完成·本次需求1] 收藏搜索框删除键不拦截
     说明：
     1. 已移除“长按删除键一次性清空并重渲染”的逻辑。
     2. Backspace/Delete 交给系统输入法原生处理，允许连续自由删除多个字。
     3. 实时筛选由 input 事件局部刷新卡片网格完成，不会关闭键盘。
     ========================================================================== */
  if (target?.matches?.('[data-role="favorite-search-input"]')) return;

  if (!target?.matches?.('[data-role="msg-input"]')) return;
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

  e.preventDefault();
  const value = target.value;
  target.value = '';
  syncMessageInputAutoHeight(target);
  syncStickerInputSuggestions(container, state, '');
  /* ===== 闲谈应用：回车只发送用户消息 START ===== */
  await sendMessage(container, state, db, value, settingsManager, { triggerAi: false });
  /* ===== 闲谈应用：回车只发送用户消息 END ===== */
}

/* ==========================================================================
   [HTML卡片双击收藏到固定分组]
   说明：
   1. 在聊天消息页双击 .msg-html-card-bubble，将角色发送的 HTML 卡片原样收藏到用户主页收藏独立页的 html 固定分组。
   2. 收藏数据包含 favoriteKind='html-card'、cardHtml、cardTitle、sourceMessageId、sourceContextMessageIds、sourceChatId。
   3. sourceContextMessageIds 记录卡片前后相邻消息；收藏页跳转前会校验这些来源消息是否仍存在。
   4. 持久化只走传入的 DB.js / IndexedDB 实例，不使用 localStorage/sessionStorage，不写双份兜底存储。
   ========================================================================== */
function handleDoubleClick(e, state, container, db) {
  /* ========================================================================
     [区域标注·已完成·语音气泡双击展开/收起]
     说明：
     1. 双击 type=voice_message 语音气泡时，在气泡下方展开/收起模拟语音转文字内容。
     2. 展开状态 voiceExpanded 随当前聊天记录写入 DB.js / IndexedDB，刷新后保持一致。
     3. 只局部刷新当前气泡行，避免页面闪屏；不使用 localStorage/sessionStorage。
     ======================================================================== */
  const voiceBubble = e.target.closest('[data-action="toggle-msg-voice-transcript"]');
  if (state.currentChatId && voiceBubble) {
    const messageId = String(voiceBubble.dataset.messageId || voiceBubble.closest('[data-message-id]')?.dataset?.messageId || '').trim();
    const messageIndex = (state.currentMessages || []).findIndex(item => String(item.id) === messageId);
    if (messageIndex >= 0 && String(state.currentMessages[messageIndex]?.type || '') === 'voice_message') {
      e.preventDefault();
      e.stopPropagation();
      state.currentMessages[messageIndex] = {
        ...state.currentMessages[messageIndex],
        voiceExpanded: !Boolean(state.currentMessages[messageIndex].voiceExpanded)
      };
      persistCurrentMessages(state, db);
      refreshMessageBubbleRows(container, state, [messageId]);
      return;
    }
  }

  /* --- 聊天消息页 HTML 卡片双击收藏 --- */
  if (state.currentChatId && !state.subPageView) {
    const htmlCardBubble = e.target.closest('.msg-html-card-bubble');
    if (htmlCardBubble) {
      const messageId = String(htmlCardBubble.dataset.messageId || htmlCardBubble.closest('[data-message-id]')?.dataset?.messageId || '').trim();
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (message && String(message.type || '') === 'card') {
        const cardHtml = String(message.cardHtml || message.content || '').trim();
        if (cardHtml) {
          /* 标记为已处理，防止冒泡到表情包多选逻辑 */
          e.preventDefault();
          e.stopPropagation();
          /* 异步收藏，不阻塞 UI；持久化只使用 DB.js / IndexedDB */
          (async () => {
            const data = normalizeFavoriteData(state.favoriteData);
            const now = Date.now();
            const messageIndex = (state.currentMessages || []).findIndex(item => String(item.id) === messageId);
            const sourceContextMessageIds = [messageIndex - 1, messageIndex, messageIndex + 1]
              .map(index => state.currentMessages?.[index]?.id)
              .map(id => String(id || '').trim())
              .filter(Boolean);
            const item = {
              id: createUid('favorite'),
              name: String(message.cardTitle || '[HTML卡片]').slice(0, 24),
              groupId: 'html',
              subGroupId: '',
              messages: [],
              favoriteKind: 'html-card',
              cardHtml,
              cardTitle: String(message.cardTitle || 'HTML 卡片'),
              sourceMessageId: messageId,
              sourceContextMessageIds,
              sourceChatId: String(state.currentChatId || ''),
              createdAt: now,
              updatedAt: now
            };
            state.favoriteData = { ...data, items: [...data.items, item] };
            await persistFavoriteData(state, db);
            /* 使用已有弹窗基础设施显示收藏成功提示 */
            const mask = container.querySelector('[data-role="modal-mask"]');
            const panel = container.querySelector('[data-role="modal-panel"]');
            if (mask && panel) {
              panel.innerHTML = `
                <div class="chat-modal-header">
                  <span>已收藏</span>
                  <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
                </div>
                <div class="chat-modal-body" style="align-items:center;padding:18px 0 8px 0;">
                  <p style="margin:0;font-size:14px;color:#4A342A;font-weight:600;">HTML 卡片已收藏到「html」分组</p>
                </div>
              `;
              mask.classList.remove('is-hidden');
              setTimeout(() => { if (!mask.classList.contains('is-hidden')) mask.classList.add('is-hidden'); }, 1600);
            }
          })();
          return;
        }
      }
    }
  }

  /* ===== [区域标注·已完成·语言翻译] 双击消息气泡展开/收起翻译 ===== */
  if (state.currentChatId && !state.subPageView) {
    handleTranslationBubbleDblClick(e, container, state.translationSettings);
  }

  /* --- 表情包独立页双击进入多选删除 --- */
  if (state.subPageView !== 'sticker') return;
  if (state.stickerPreviewClickTimer) {
    window.clearTimeout(state.stickerPreviewClickTimer);
    state.stickerPreviewClickTimer = 0;
  }
  const target = e.target.closest('[data-sticker-id]');
  if (!target) return;

  const stickerId = String(target.dataset.stickerId || '').trim();
  if (!stickerId) return;

  state.stickerMultiSelectMode = true;
  state.selectedStickerIds = [stickerId];
  rerenderCurrentSubPage(container, state);
}
