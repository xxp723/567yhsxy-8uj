// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message.js
 * 用途: 闲谈应用 — 聊天消息页面
 *       独立的聊天对话界面，包含消息列表、悬浮输入栏、功能占位区与聊天设置页。
 * 架构层: 应用层（闲谈子模块）
 */

import {
  TAB_ICONS,
  DATA_KEY_SESSIONS,
  DATA_KEY_MESSAGES_PREFIX,
  ARCHIVE_DB_RECORD_ID,
  dbPut,
  dbGetArchiveData,
  escapeHtml,
  normalizeStickerData,
  normalizeWalletData,
  persistWalletData
} from './chat-utils.js';
import { chat } from './prompt.js';
import { getVisibleChatSessions } from './chat-list.js';
import { MSG_ICONS } from './chat-message-icons.js';
import { renderChatMessageSettingsPage } from './chat-message-settings.js';
/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗接入] 导入应用内 API 报错弹窗
   说明：
   1. API 失败、429/503 等状态码、网络错误或空回复时，统一显示应用内弹窗。
   2. 不使用 alert/confirm/prompt 等原生浏览器弹窗。
   3. 弹窗只操作运行时 DOM，不写入聊天记录，不涉及持久化存储。
   ========================================================================== */
import { showApiErrorModal } from '../../core/ui/components/ApiErrorModal.js';
import {
  extractHtmlCardProtocolBlocks,
  sanitizeHtmlCardDocumentForSrcdoc
} from './chat-html-card.js';
/* ==========================================================================
   [区域标注·已完成·礼物板块集成] 导入独立礼物模块
   说明：
   1. 咖啡功能区“礼物”入口、礼物消息摘要与礼物卡片渲染均来自 chat-gift.js。
   2. 本文件只负责消息页挂载与渲染衔接，礼物功能细节请直接修改 chat-gift.js。
   3. 持久化仍由 DB.js / IndexedDB 完成，禁止 localStorage/sessionStorage。
   ========================================================================== */
import {
  createAiGiftMessageFromProtocol,
  getGiftMessageDisplayText,
  isGiftMessage,
  renderGiftBubble,
  renderGiftFeatureButton
} from './chat-gift.js';
/* ==========================================================================
   [区域标注·已完成·文字图板块集成] 导入独立文字图模块
   说明：
   1. 咖啡功能区“文字图”入口、拍立得消息气泡与悬浮预览由 chat-text-image.js / chat-text-image.css 独立维护。
   2. 本文件只负责把文字图消息接入聊天消息页渲染与 AI 上下文组装。
   3. 文字图不写 imageUrl，不触发视觉识别 token；AI 只读取精简图片描述文本。
   4. 持久化仍统一通过 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
import {
  createAiTextImageMessageFromProtocol,
  isTextImageMessage,
  renderTextImageBubble,
  renderTextImageFeatureButton
} from './chat-text-image.js';
/* ==========================================================================
   [区域标注·已完成·语音板块集成] 导入独立语音模块
   说明：
   1. 咖啡功能区“语音”入口、模拟语音气泡与 AI 可见语音上下文由 chat-voice.js 独立维护。
   2. 本文件只负责消息页入口挂载、消息摘要与气泡渲染衔接。
   3. 语音消息随 currentMessages 统一写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
import {
  createAiVoiceMessageFromProtocol,
  getVoiceMessageDisplayText,
  isVoiceMessage,
  parseAiVoiceProtocolPayload,
  renderVoiceBubble,
  renderVoiceFeatureButton
} from './chat-voice.js';
/* ==========================================================================
   [区域标注·已完成·心声面板集成] 导入心声模块提取函数
   说明：
   1. extractInnerVoiceFromRawText 从 AI 原始回复中提取 [心声]{json}[/心声] 并返回清理后文本。
   2. 提取到的心声数据挂到本轮最后一条 AI 消息的 innerVoice 字段，随 currentMessages 写入 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
import {
  extractInnerVoiceFromRawText,
  persistInnerVoiceHistoryEntry
} from './chat-inner-voice.js';
/* ==========================================================================
   [区域标注·已完成·旁白模式] 导入旁白模块函数
   说明：
   1. extractAsideFromRawText — 从 AI 原始回复中提取 [旁白]...[/旁白] 标记内容。
   2. renderAsideBubbleHtml — 生成旁白气泡居中加粗 HTML。
   3. renderAsideExitButtonHtml — 顶栏爱心退出按钮 HTML。
   4. isAsideModeActive — 检测当前 state 是否处于旁白模式。
   ========================================================================== */
import {
  extractAsideFromRawText,
  renderAsideBubbleHtml,
  renderAsideExitButtonHtml,
  isAsideModeActive
} from './chat-aside.js';
/* ==========================================================================
   [区域标注·已完成·语言翻译] 导入语言翻译模块
   ========================================================================== */
import {
  renderTranslationBubbleHtml,
  normalizeTranslationSettings
} from './chat-translation.js';

/* ==========================================================================
   [区域标注·已完成·本次拆分] 聊天消息页弹窗子模块接线
   说明：
   1. 原 chat-message.js 中的图片、转账、头像、撤回、编辑、收藏、转发等弹窗实现，
      已拆分到 chat-message-modals.js。
   2. 本文件只保留 facade 接线层，继续对外提供原有同名导出，避免影响既有调用方。
   3. 后续如需修改这些弹窗，请直接修改 chat-message-modals.js，不要回到本文件追加实现。
   4. 弹窗仍统一沿用应用内样式；不使用 localStorage/sessionStorage。
   ========================================================================== */
import {
  showMessageImageModal as showMessageImageModalModule,
  showMessageTransferModal as showMessageTransferModalModule,
  showTransferActionModal as showTransferActionModalModule,
  showChatAvatarUrlModal as showChatAvatarUrlModalModule,
  showChatAvatarCropModal as showChatAvatarCropModalModule,
  updateChatAvatarCropPreview as updateChatAvatarCropPreviewModule,
  buildChatAvatarFromCropModal as buildChatAvatarFromCropModalModule,
  showAiFormatRepairTypeModal as showAiFormatRepairTypeModalModule,
  showUserWithdrawMessageModal as showUserWithdrawMessageModalModule,
  showAiWithdrawnMessageModal as showAiWithdrawnMessageModalModule,
  showAiFormatRepairResultModal as showAiFormatRepairResultModalModule,
  showEditMessageModal as showEditMessageModalModule,
  showEditAsideModal as showEditAsideModalModule,
  showFavoriteSavedModal as showFavoriteSavedModalModule,
  showForwardMessagesModal as showForwardMessagesModalModule
} from './chat-message-modals.js';
import {
  getMessageDisplayTextForQuote as getMessageDisplayTextForQuoteModule,
  createQuotePayloadFromMessage as createQuotePayloadFromMessageModule,
  renderQuotePreview as renderQuotePreviewModule,
  syncPendingQuoteComposer as syncPendingQuoteComposerModule
} from './chat-message-quote.js';
import {
  getChatSearchMessageText as getChatSearchMessageTextModule,
  getChatSearchMatches as getChatSearchMatchesModule,
  renderChatSearchResultBubble as renderChatSearchResultBubbleModule,
  renderChatMessageSearchResultsHtml as renderChatMessageSearchResultsHtmlModule,
  renderChatMessageSearchPanelHtml as renderChatMessageSearchPanelHtmlModule,
  syncChatMessageSearchPanel as syncChatMessageSearchPanelModule,
  scrollToChatSearchResult as scrollToChatSearchResultModule
} from './chat-message-search.js';
import {
  updateMultiSelectActionBar as updateMultiSelectActionBarModule,
  resetMessageSelectionState as resetMessageSelectionStateModule,
  getSelectedMessages as getSelectedMessagesModule
} from './chat-message-selection.js';
import {
  getVisibleChatConsoleLogs as getVisibleChatConsoleLogsModule,
  renderChatConsoleDockHtml as renderChatConsoleDockHtmlModule,
  getAsideSegmentsFromMessage as getAsideSegmentsFromMessageModule,
  renderMessageBubble as renderMessageBubbleModule,
  renderChatMessage as renderChatMessageModule,
  renderCurrentChatMessage as renderCurrentChatMessageModule,
  appendCurrentMessageBubble as appendCurrentMessageBubbleModule,
  refreshMessageBubbleRows as refreshMessageBubbleRowsModule,
  refreshCurrentMessageListOnly as refreshCurrentMessageListOnlyModule,
  refreshCurrentSessionLastMessage as refreshCurrentSessionLastMessageModule
} from './chat-message-render.js';

/* ==========================================================================
   [区域标注·已完成·收藏页HTML卡片iframe高度自适应] postMessage 监听器
   说明：
   1. iframe 内部的高度上报脚本（chat-html-card.js 注入）通过 postMessage 报告 body 实际高度。
   2. 已把收藏页 .favorite-html-card__iframe 纳入同一高度桥接，展开后按真实 HTML 内容高度自适应，不再依赖固定比例占位。
   3. iframe 内部的交互桥接脚本通过 __miniphone_card_interaction__ 上报按钮/选择等互动。
   4. 高度消息只调整对应 iframe 高度；交互消息转为冒泡 CustomEvent，交给 index.js 写入 DB.js / IndexedDB。
   5. 全局只注册一次，避免重复绑定；使用 event.source 精确匹配 iframe.contentWindow。
   ========================================================================== */
if (!window.__miniphone_card_message_bridge_listener__) {
  window.__miniphone_card_message_bridge_listener__ = true;
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || !String(data.type || '').startsWith('__miniphone_card_')) return;

    const iframes = document.querySelectorAll('.msg-html-card-bubble__frame, .favorite-html-card__iframe');
    for (const iframe of iframes) {
      if (iframe.contentWindow !== event.source) continue;

      if (data.type === '__miniphone_card_height__' && data.height) {
        iframe.style.height = Math.ceil(data.height) + 'px';
        break;
      }

      /* ======================================================================
         [区域标注·已完成·HTML卡片iframe双击收藏桥接]
         说明：iframe 内部 dblclick 不能原生冒泡到聊天页，这里转成父页面可捕获的 dblclick，
               复用 index.js 的 HTML 卡片收藏逻辑，持久化仍只走 DB.js / IndexedDB。
         ====================================================================== */
      if (data.type === '__miniphone_card_dblclick__') {
        iframe.dispatchEvent(new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          view: window
        }));
        break;
      }

      if (data.type === '__miniphone_card_interaction__') {
        iframe.dispatchEvent(new CustomEvent('miniphone-html-card-interaction', {
          bubbles: true,
          detail: {
            messageId: String(iframe.dataset.messageId || ''),
            text: String(data.text || '').trim(),
            value: String(data.value || '').trim(),
            checked: Boolean(data.checked),
            tagName: String(data.tagName || '').trim(),
            role: String(data.role || '').trim(),
            eventType: String(data.eventType || 'click').trim(),
            timestamp: Number(data.timestamp || Date.now()) || Date.now()
          }
        }));
        break;
      }
    }
  });
}

/* ========================================================================
   [区域标注·已完成·本次控制台持久显示与后台记录修复] 聊天控制台日志存储键与工具
   说明：
   1. 与 index.js 保持同一 IndexedDB 键规则，严格只走 DB.js（dbPut）。
   2. 日志队列最多 500 条，超出自动删除旧日志。
   3. 控制台开关只控制聊天页日志抽屉是否显示；当前会话日志始终在后台记录，方便用户随时打开查看。
   ======================================================================== */
const DATA_KEY_CHAT_CONSOLE = (maskId, chatId) => `chat_console::${maskId || 'default'}::${chatId || 'none'}`;

function appendChatConsoleRuntimeLog(state, level, text) {
  if (!state?.currentChatId) return false;
  const payload = String(text || '').trim();
  if (!payload) return false;
  const ts = Date.now();
  const entry = {
    id: `log_${ts}_${Math.random().toString(16).slice(2)}`,
    ts,
    time: new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }),
    level: String(level || 'info').toLowerCase(),
    text: payload
  };
  state.chatConsoleLogs = [...(Array.isArray(state.chatConsoleLogs) ? state.chatConsoleLogs : []), entry].slice(-500);
  return true;
}

async function persistChatConsoleRuntimeLogs(state, db) {
  if (!state?.currentChatId) return;
  await dbPut(
    db,
    DATA_KEY_CHAT_CONSOLE(state.activeMaskId, state.currentChatId),
    Array.isArray(state.chatConsoleLogs) ? state.chatConsoleLogs.slice(-500) : []
  );
}

/* ========================================================================
   [区域标注·已完成·本次角色卡/用户面具上下文修复] AI 请求前刷新档案上下文
   说明：
   1. 每次真正调用 AI 前，都通过 dbGetArchiveData → DB.js / IndexedDB 读取最新档案数据。
   2. 同步刷新角色卡、用户面具、配角、关系网络运行时缓存，避免闲谈应用启动后的旧缓存/空缓存传给 prompt.js。
   3. 同时写入聊天控制台排查日志：角色卡/用户面具是否命中、设定长度、双方关系条数。
   4. 读取失败时仅沿用当前运行时 state，保证聊天流程不中断。
   ======================================================================== */
async function refreshArchiveContextForAiRequest(state, db, session = {}) {
  let latestArchive = null;

  try {
    latestArchive = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);
  } catch (error) {
    appendChatConsoleRuntimeLog(state, 'warn', `档案上下文读取失败，沿用当前缓存：${error?.message || '未知错误'}`);
  }

  const archiveData = latestArchive && typeof latestArchive === 'object' ? latestArchive : {};
  const latestMasks = Array.isArray(archiveData.masks) ? archiveData.masks : state.archiveMasks;
  const latestCharacters = Array.isArray(archiveData.characters) ? archiveData.characters : state.archiveCharacters;
  const latestSupportingRoles = Array.isArray(archiveData.supportingRoles) ? archiveData.supportingRoles : state.archiveSupportingRoles;
  const latestRelations = Array.isArray(archiveData.relations) ? archiveData.relations : state.archiveRelations;

  state.archiveMasks = Array.isArray(latestMasks) ? latestMasks : [];
  state.archiveCharacters = Array.isArray(latestCharacters) ? latestCharacters : [];
  state.archiveSupportingRoles = Array.isArray(latestSupportingRoles) ? latestSupportingRoles : [];
  state.archiveRelations = Array.isArray(latestRelations) ? latestRelations : [];

  const activeMaskId = String(state.activeMaskId || archiveData.activeMaskId || '').trim();
  const currentContact = (state.contacts || []).find(contact => String(contact.id) === String(session.id)) || null;
  const roleIdCandidates = [
    currentContact?.roleId,
    session?.roleId,
    currentContact?.id,
    session?.id
  ].map(value => String(value || '').trim()).filter(Boolean);

  const matchedCharacter = state.archiveCharacters.find(character => roleIdCandidates.includes(String(character?.id || '').trim())) || null;
  const matchedMask = state.archiveMasks.find(mask => String(mask?.id || '').trim() === activeMaskId) || null;

  const countDirectRelations = (ownerType, ownerId) => {
    const safeOwnerId = String(ownerId || '').trim();
    if (!safeOwnerId) return 0;
    return state.archiveRelations.filter(relation => (
      (String(relation?.ownerType || '') === ownerType && String(relation?.ownerId || '') === safeOwnerId)
      || (String(relation?.targetType || '') === ownerType && String(relation?.targetId || '') === safeOwnerId)
    )).length;
  };

  const characterSettingLength = String(matchedCharacter?.personalitySetting || '').trim().length;
  const maskSettingLength = String(matchedMask?.personalitySetting || '').trim().length;
  const characterRelationCount = countDirectRelations('character', matchedCharacter?.id);
  const maskRelationCount = countDirectRelations('mask', matchedMask?.id);

  appendChatConsoleRuntimeLog(
    state,
    'info',
    `档案上下文刷新：角色卡=${matchedCharacter ? '已匹配' : '未匹配'}，人物设定长度=${characterSettingLength}，角色关系=${characterRelationCount}；用户面具=${matchedMask ? '已匹配' : '未匹配'}，用户设定长度=${maskSettingLength}，面具关系=${maskRelationCount}`
  );

  return {
    activeMaskId,
    masks: state.archiveMasks,
    characters: state.archiveCharacters,
    supportingRoles: state.archiveSupportingRoles,
    relations: state.archiveRelations
  };
}

/* ==========================================================================
   [区域标注·已完成·本次拆分] IconPark 图标 SVG 定义
   说明：
   1. 聊天消息页面用到的所有按键图标已拆至 chat-message-icons.js。
   2. 本文件只通过 import { MSG_ICONS } 引用，不再维护内联 SVG 常量。
   3. 图标模块仅导出静态 SVG，不涉及持久化存储。
   ========================================================================== */

/* ==========================================================================
   [区域标注] 工具函数
/* ========================================================================== */
/* escapeHtml 已从 chat-utils.js 导入，不再本地重复定义 */

function formatMsgTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ========================================================================
   [区域标注·已完成·本次聊天记录分段加载] 消息渲染数量控制
   说明：
   1. 聊天界面默认只渲染最新 100 条消息，避免历史消息过多导致页面卡顿。
   2. 点击消息列表顶部居中的“加载更多消息”后，每次再向前显示 100 条旧消息。
   3. 这里只控制“界面渲染/用户查看范围”；state.currentMessages 始终保留完整数组，
      AI 发送历史上下文仍按原有逻辑读取完整 currentMessages，不受本区域影响。
   4. 不读写 localStorage/sessionStorage，不新增任何持久化存储，也不按长文本字段过滤。
   ======================================================================== */
const CHAT_MESSAGE_INITIAL_VISIBLE_COUNT = 100;
const CHAT_MESSAGE_LOAD_MORE_STEP = 100;

function normalizeChatMessageVisibleCount(value) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? count : CHAT_MESSAGE_INITIAL_VISIBLE_COUNT;
}

function getVisibleChatMessagesForRender(messages = [], options = {}) {
  const allMessages = Array.isArray(messages) ? messages : [];
  const visibleCount = normalizeChatMessageVisibleCount(options.chatMessageVisibleCount);
  const visibleMessages = allMessages.length > visibleCount
    ? allMessages.slice(-visibleCount)
    : allMessages.slice();
  const hiddenMessageCount = Math.max(0, allMessages.length - visibleMessages.length);

  return {
    allMessages,
    visibleMessages,
    hiddenMessageCount,
    nextLoadCount: Math.min(CHAT_MESSAGE_LOAD_MORE_STEP, hiddenMessageCount)
  };
}

/* ========================================================================
   [区域标注·已完成·引用回复] 引用消息数据工具
   说明：
   1. 只从当前消息对象提取可读摘要，随回复消息的 quote 字段写入 IndexedDB。
   2. 不使用 localStorage/sessionStorage，不保留双份存储兜底。
   3. 下次如需修改引用预览文案或长度，优先修改本区域。
   ======================================================================== */
function getMessageDisplayTextForQuote(message = {}) {
  return getMessageDisplayTextForQuoteModule(message);
}

export function createQuotePayloadFromMessage(message = {}, chatSession = {}, userProfile = {}) {
  return createQuotePayloadFromMessageModule(message, chatSession, userProfile);
}

function renderQuotePreview(quote = {}, variant = 'bubble') {
  return renderQuotePreviewModule(quote, variant);
}

/* ========================================================================
   [区域标注·已完成·本次拆分] 聊天记录搜索子模块 facade
   说明：
   1. 搜索文案提取、匹配、结果列表与顶栏下浮搜索面板实现，已拆分到 chat-message-search.js。
   2. 本文件仅保留薄接线层，继续维持原函数名，避免影响 renderChatMessage 与外部调用方。
   3. 搜索仍只使用当前运行时消息数组，不写入 IndexedDB，不使用 localStorage/sessionStorage。
   ======================================================================== */
function getChatSearchMessageText(message = {}) {
  return getChatSearchMessageTextModule(message);
}

function getChatSearchMatches(messages = [], keyword = '') {
  return getChatSearchMatchesModule(messages, keyword);
}

function renderChatSearchResultBubble(item = {}, session = {}, userProfile = {}) {
  return renderChatSearchResultBubbleModule(item, session, userProfile);
}

function renderChatMessageSearchResultsHtml(session = {}, messages = [], options = {}) {
  return renderChatMessageSearchResultsHtmlModule(session, messages, options);
}

function renderChatMessageSearchPanelHtml(session = {}, messages = [], options = {}) {
  return renderChatMessageSearchPanelHtmlModule(session, messages, options);
}

/* ==========================================================================
   [区域标注·本次需求3] 聊天页表情包面板数据工具
   说明：All 为固定默认分组；输入栏表情包面板与聊天设置“表情包挂载”共用。
/* ========================================================================== */
function normalizeStickerPanelData(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
  const validGroupIds = new Set(['all', ...groups.map(group => group.id)]);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : (Array.isArray(source.stickers) ? source.stickers : []);
  const items = rawItems
    .map(item => ({
      id: String(item?.id || '').trim(),
      groupId: validGroupIds.has(String(item?.groupId || 'all')) ? String(item?.groupId || 'all') : 'all',
      name: String(item?.name || '').trim(),
      url: String(item?.url || '').trim()
    }))
    .filter(item => item.id && item.name && item.url);

  return { groups, items };
}

function getStickerPanelGroups(rawData) {
  const data = normalizeStickerPanelData(rawData);
  return [{ id: 'all', name: 'All' }, ...data.groups];
}

function getVisibleStickerPanelItems(rawData, groupId = 'all') {
  const data = normalizeStickerPanelData(rawData);
  if (groupId === 'all') return data.items;
  return data.items.filter(item => item.groupId === groupId);
}

/* ========================================================================
   [区域标注·已完成·本次输入框表情包联想按命中显示与防闪屏修复] 输入关键词关联表情包工具
   说明：
   1. 用户在聊天输入框打字时，只按表情包名称包含关系联想：输入“哭”匹配名称含“哭”的表情包，输入“哭哭”只匹配名称含“哭哭”的表情包。
   2. 只有存在命中的表情包时才显示联想窗口；无输入或无命中时直接隐藏，不显示空状态。
   3. 联想窗口只展示表情包列表，不再显示“关联表情包”标题和右侧关联词文字。
   4. 输入变化时优先局部更新已有 scroller 内容，不反复删除并重建整个窗口，避免输入时闪屏。
   5. 联想结果直接来自当前运行时 state.stickerData / IndexedDB 已加载数据，不读取 localStorage/sessionStorage，不做双份存储兜底。
   6. 本区域只做展示与局部 DOM 同步，不按文本长度过滤字段。
   ======================================================================== */
function getStickerInputSuggestionItems(rawData, keyword = '') {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return [];
  const data = normalizeStickerPanelData(rawData);
  return data.items
    .filter(item => String(item.name || '').toLowerCase().includes(query))
    .slice(0, 12);
}

function renderStickerInputSuggestItemsHtml(items = []) {
  return (Array.isArray(items) ? items : []).map(item => `
    <button class="msg-sticker-suggest__item"
            data-action="send-msg-sticker"
            data-sticker-id="${escapeHtml(item.id)}"
            type="button"
            title="${escapeHtml(item.name)}">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
      <span>${escapeHtml(item.name)}</span>
    </button>
  `).join('');
}

function renderStickerInputSuggestDockHtml(keyword = '', rawData = {}) {
  const query = String(keyword || '').trim();
  const items = getStickerInputSuggestionItems(rawData, query);
  if (!query || !items.length) return '';

  return `
    <div class="msg-sticker-suggest" data-role="msg-sticker-suggest" data-suggest-keyword="${escapeHtml(query)}">
      <div class="msg-sticker-suggest__scroller">
        ${renderStickerInputSuggestItemsHtml(items)}
      </div>
    </div>
  `;
}

export function syncStickerInputSuggestions(container, state, keyword = '') {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const shell = msgWrap?.querySelector('.msg-input-shell');
  if (!shell) return false;

  const query = String(keyword || '').trim();
  const items = getStickerInputSuggestionItems(state.stickerData, query);
  const existingSuggest = shell.querySelector('[data-role="msg-sticker-suggest"]');

  if (!query || !items.length) {
    existingSuggest?.remove();
    return true;
  }

  const nextItemsHtml = renderStickerInputSuggestItemsHtml(items);
  if (existingSuggest) {
    existingSuggest.dataset.suggestKeyword = query;
    const scroller = existingSuggest.querySelector('.msg-sticker-suggest__scroller');
    if (scroller) {
      scroller.innerHTML = nextItemsHtml;
      return true;
    }
    existingSuggest.outerHTML = renderStickerInputSuggestDockHtml(query, state.stickerData);
    return true;
  }

  const inputBar = shell.querySelector('.msg-input-bar');
  if (!inputBar) return false;

  inputBar.insertAdjacentHTML('beforebegin', renderStickerInputSuggestDockHtml(query, state.stickerData));
  return true;
}

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 瘦身与渲染模块接线]
   说明：
   1. 单条消息气泡渲染、整页聊天 HTML、旁白拼接与控制台抽屉渲染已统一委托给 chat-message-render.js。
   2. 本文件只保留同名 facade，继续兼容 index.js 与其它既有调用方。
   3. AI 发送流程、协议解析、DB.js / IndexedDB 持久化调度仍保留在本文件。
   ========================================================================== */
function getAsideSegmentsFromMessage(message = {}) {
  return getAsideSegmentsFromMessageModule(message);
}

export function renderMessageBubble(msg, chatSession, options = {}) {
  return renderMessageBubbleModule(msg, chatSession, options);
}

export function renderChatMessage(chatSession, messages, options = {}) {
  return renderChatMessageModule(chatSession, messages, options);
}

/* ========================================================================== */
export function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}


export function getAiBubbleDelayMs(bubbleText, index) {
  const length = String(bubbleText || '').length;
  return Math.min(1300, Math.max(420, 260 + length * 24 + index * 80));
}

/* ==========================================================================
   [区域标注·已完成·本次转账待确认修复] 用户转账待 AI 决策工具
   说明：
   1. 用户发给 AI 的转账保持 pending，直到纸飞机触发 API 后才把待确认状态交给 AI。
   2. AI 可用 [转账] 协议返回“操作:接收/退回”，这里只更新当前消息与钱包数据。
   3. 所有状态和钱包流水只通过 DB.js / IndexedDB 持久化，不使用 localStorage/sessionStorage。
   ========================================================================== */
function getPendingOutgoingTransfers(state) {
  return (Array.isArray(state.currentMessages) ? state.currentMessages : [])
    .filter(message => (
      String(message?.type || '') === 'transfer'
      && String(message?.transferDirection || '') === 'outgoing'
      && String(message?.transferStatus || 'pending') === 'pending'
    ));
}

function buildPendingOutgoingTransferSystemTemp(pendingTransfers = []) {
  const transfers = Array.isArray(pendingTransfers) ? pendingTransfers : [];
  if (!transfers.length) return '';

  const lines = transfers.map((message, index) => (
    `${index + 1}. 转账ID:${String(message.id || '').trim()}；金额:${String(message.transferDisplayAmount || message.content || '¥0.00').trim()}；备注:${String(message.transferNote || '无').trim() || '无'}`
  ));

  return `[SYSTEM_TEMP]
当前有用户已经转给你的待确认转账，用户现在点击纸飞机调用 API，你必须以当前角色的人设、关系阶段和上下文自行决定接收或退回。
待确认转账如下：
${lines.join('\n')}
如果决定接收其中某笔转账，必须输出独立协议块：**\`[转账] 角色名：{操作:接收,转账ID:对应ID}\`**。
如果决定退回其中某笔转账，必须输出独立协议块：**\`[转账] 角色名：{操作:退回,转账ID:对应ID,备注:可选理由}\`**。
该处理协议只用于界面更新，不会显示成普通文字；你仍应另外用 [回复] 协议自然回应用户。
[/SYSTEM_TEMP]`;
}

function extractAiPendingTransferDecisions(rawText) {
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  const markerRegex = /(?:\*\*)?\s*`?\s*\[转账\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
  const matches = [...visibleText.matchAll(markerRegex)];

  return matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const contentStart = Number(match.index || 0) + String(match[0] || '').length;
      const contentEnd = nextMatch ? Number(nextMatch.index || visibleText.length) : visibleText.length;
      const body = cleanAiProtocolBlockContent(visibleText.slice(contentStart, contentEnd));
      const actionMatch = body.match(/操作\s*[：:]\s*(接收|退回|拒收|拒绝|返回)/i);
      const idMatch = body.match(/转账\s*ID\s*[：:]\s*([^,，;；}\s]+)/i) || body.match(/transfer\s*Id\s*[：:]\s*([^,，;；}\s]+)/i);
      if (!actionMatch || !idMatch) return null;
      const rawAction = String(actionMatch[1] || '').trim();
      return {
        transferId: String(idMatch[1] || '').trim(),
        action: rawAction === '接收' ? 'accepted' : 'returned'
      };
    })
    .filter(item => item && item.transferId && item.action);
}

async function applyAiPendingTransferDecisions(state, db, rawText) {
  const decisions = extractAiPendingTransferDecisions(rawText);
  if (!decisions.length) return false;

  let changed = false;
  const now = Date.now();
  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  const decisionMap = new Map(decisions.map(item => [String(item.transferId), item.action]));

  for (const message of (Array.isArray(state.currentMessages) ? state.currentMessages : [])) {
    if (
      String(message?.type || '') !== 'transfer'
      || String(message?.transferDirection || '') !== 'outgoing'
      || String(message?.transferStatus || 'pending') !== 'pending'
    ) continue;

    const action = decisionMap.get(String(message.id || ''));
    if (!action) continue;

    message.transferStatus = action;
    message.transferHandledAt = now;
    changed = true;

    const roleName = String(message.transferCounterpartyName || session?.name || '对方').trim() || '对方';
    const transferBaseCny = Math.max(0, Number(message.transferBaseCny || 0) || 0);

    if (action === 'returned' && transferBaseCny > 0) {
      state.walletData = normalizeWalletData({
        ...state.walletData,
        balanceBaseCny: Number(state.walletData?.balanceBaseCny || 0) + transferBaseCny,
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
      content: action === 'accepted' ? `${roleName} 已接收` : `${roleName} 已退回`,
      transferStatus: action,
      timestamp: now + 1
    });
  }

  if (!changed) return false;

  if (session) {
    session.lastMessage = '[转账]';
    session.lastTime = now;
  }

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
    persistWalletData(state, db)
  ]);
  return true;
}

/* ========================================================================
   [区域标注·已完成·旁白固定/穿插位置修复] 当前轮旁白段落绑定到 AI 消息
   说明：
   1. 这是本次旁白位置修正的核心：在 AI 消息入列前就把旁白段落绑定到正确消息对象。
   2. 固定模式 top：所有旁白段落绑定到本轮第一条 assistant 消息的 before 位置，
      因此显示为“用户消息下方、本轮 AI/角色所有回复最上方”。
   3. 穿插模式 interleave：根据 AI 原始文本中多段 [旁白] 与 [回复]/[表情]/[语音] 等协议头的先后顺序，
      把旁白绑定到下一条可见 AI 消息前；若旁白位于本轮末尾，则绑定到最后一条 AI 消息后。
   4. 只修改当前运行时消息对象字段 asideText/asideSegments，消息落库仍随 currentMessages 统一写入 DB.js / IndexedDB。
   ======================================================================== */
function bindAsideSegmentsToAiMessages(aiMessages = [], asideSegments = [], displayMode = 'top', rawTextWithAside = '') {
  const messages = Array.isArray(aiMessages) ? aiMessages.map(message => ({ ...message })) : [];
  const segments = (Array.isArray(asideSegments) ? asideSegments : [])
    .map((segment, index) => ({
      id: String(segment?.id || `aside_segment_${index + 1}`),
      text: String(segment?.text || '').trim(),
      startIndex: Number(segment?.startIndex || 0) || 0,
      endIndex: Number(segment?.endIndex || segment?.startIndex || 0) || 0
    }))
    .filter(segment => segment.text);

  if (!messages.length || !segments.length) return messages;

  const attachSegment = (messageIndex, segment, placement = 'before') => {
    const index = Math.max(0, Math.min(messages.length - 1, Number(messageIndex || 0) || 0));
    const target = messages[index];
    const normalizedPlacement = placement === 'after' ? 'after' : 'before';
    const nextSegment = {
      id: `${segment.id}_${normalizedPlacement}`,
      text: segment.text,
      placement: normalizedPlacement
    };
    target.asideSegments = [...(Array.isArray(target.asideSegments) ? target.asideSegments : []), nextSegment];
    target.asideText = getAsideSegmentsFromMessage(target).map(item => item.text).join('\n');
  };

  const firstAssistantIndex = messages.findIndex(message => message?.role === 'assistant');
  const safeFirstIndex = firstAssistantIndex >= 0 ? firstAssistantIndex : 0;

  if (String(displayMode || 'top') !== 'interleave') {
    segments.forEach(segment => attachSegment(safeFirstIndex, segment, 'before'));
    return messages;
  }

  const source = String(rawTextWithAside || '');
  const protocolMarkerRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片)\s*\]|【\s*(语音|文字图)\s*】)\s*/g;
  const protocolMarkers = [...source.matchAll(protocolMarkerRegex)]
    .map(match => Number(match.index || 0))
    .sort((a, b) => a - b);

  if (!protocolMarkers.length) {
    segments.forEach((segment, index) => attachSegment(Math.min(index, messages.length - 1), segment, 'before'));
    return messages;
  }

  segments.forEach(segment => {
    const markersBefore = protocolMarkers.filter(position => position < segment.startIndex).length;
    if (markersBefore >= messages.length) {
      attachSegment(messages.length - 1, segment, 'after');
      return;
    }
    attachSegment(markersBefore, segment, 'before');
  });

  return messages;
}

/* ========================================================================== */
export async function sendMessage(container, state, db, content, settingsManager, options = {}) {
  const userText = String(content || '').trim();
  const triggerAi = options.triggerAi !== false;
  if ((!userText && !options.skipAppendUser) || !state.currentChatId || (triggerAi && state.isAiSending)) return;

  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  /* ======================================================================
     [区域标注·已完成·本次控制台日志开关增强] 用户发送与触发记录
     说明：记录当前聊天页给 AI 的触发情况（文本发送 / 空触发）。
     ====================================================================== */
  if (!options.skipAppendUser) {
    appendChatConsoleRuntimeLog(state, 'info', userText ? `用户发送：${userText}` : '用户发送：空文本');
  } else if (triggerAi) {
    appendChatConsoleRuntimeLog(state, 'info', '触发 AI 回复（不追加用户消息）');
  }

  /* [区域标注·本次需求] 用户消息入列并写入 IndexedDB */
  /* ===== 闲谈：发送消息去重 START ===== */
  let appendedUserMessage = null;
  if (!options.skipAppendUser) {
    const pendingQuote = state.pendingQuote && state.pendingQuote.id ? { ...state.pendingQuote } : null;
    appendedUserMessage = {
      id: `user_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      role: 'user',
      content: userText,
      /* ======================================================================
         [区域标注·已完成·引用回复] 用户引用回复持久化字段
         说明：quote 字段随 currentMessages 写入 DB.js / IndexedDB；发送后清空运行时待引用状态。
         ====================================================================== */
      ...(pendingQuote ? { quote: pendingQuote } : {}),
      timestamp: Date.now()
    };
    state.currentMessages.push(appendedUserMessage);
    state.pendingQuote = null;
    /* ======================================================================
       [区域标注·已完成·本次引用残留修复] 发送后立即移除底栏引用框
       说明：只清理运行时 pendingQuote 与当前 DOM 引用预览；消息 quote 字段已随消息对象写入 IndexedDB。
       ====================================================================== */
    syncPendingQuoteComposer(container, state);
  }
  /* ===== 闲谈：发送消息去重 END ===== */

  await persistCurrentMessages(state, db);

  if (userText) {
    session.lastMessage = userText;
    session.lastTime = Date.now();
    await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
  }

  /* ===== 闲谈：发送消息去重 START ===== */
  if (appendedUserMessage) {
    appendCurrentMessageBubble(container, state, appendedUserMessage);
  }
  /* ===== 闲谈：发送消息去重 END ===== */

  /* ===== 闲谈应用：回车只发送用户消息 START ===== */
  if (!triggerAi) return;
  /* ===== 闲谈应用：回车只发送用户消息 END ===== */

  /* ==========================================================================
     [区域标注·本次修改2] 修复纸飞机发送后闪屏
     说明：问题出在发送后连续两次整页重绘聊天消息页：
           第一次渲染用户消息，第二次仅为了显示“正在回复...”又重建整个 msgWrap。
           这里改为只更新发送状态相关 DOM，不重建聊天页面，避免点击纸飞机后闪屏。
  /* ========================================================================== */
  state.isAiSending = true;
  updateCurrentChatSendingUi(container, state);

  let hasRenderedAiBubble = false;

  try {
    /* ===== 闲谈应用：短期记忆与最新一轮消息 START ===== */
    const promptPayload = buildPromptPayloadForLatestUserRound(state.currentMessages, state.chatPromptSettings.shortTermMemoryRounds);
    /* ===== 闲谈应用：短期记忆与最新一轮消息 END ===== */

    /* ========================================================================
       [区域标注·已完成·本次转账待确认修复] 纸飞机触发时把待确认转账交给 AI 决策
       说明：用户转账不再立即显示“AI 已接收”；仅在本次 API 请求中注入临时状态指令。
       ======================================================================== */
    const pendingOutgoingTransfers = getPendingOutgoingTransfers(state);
    const pendingTransferTemp = buildPendingOutgoingTransferSystemTemp(pendingOutgoingTransfers);
    const userInputForAi = [promptPayload.userInput, pendingTransferTemp].filter(Boolean).join('\n\n');

    /* ========================================================================
       [区域标注·已完成·本次角色卡/用户面具上下文修复] AI 请求前读取最新档案
       说明：确保角色卡及其关系网络、用户面具身份及其关系网络均来自 DB.js / IndexedDB 最新记录，而不是闲谈启动时旧缓存。
       ======================================================================== */
    const latestArchiveDataForAi = await refreshArchiveContextForAiRequest(state, db, session);

    /* ========================================================================
       [区域标注·已完成·需求1·请求轮次日志释义修复] 调用 prompt.js 的 chat()
       说明：
       1. conversationRound 才是“当前聊到第几轮”的用户对话轮次序号。
       2. currentRoundMessages 只表示本轮连续用户消息/撤回提示条数，不再误写成 currentRound，避免误判短期记忆未刷新。
       3. historyRounds/historyMessages 只展示本次短期记忆实际携带范围；不改变 promptPayload.history 的发送内容。
       ======================================================================== */
    appendChatConsoleRuntimeLog(
      state,
      'info',
      `开始请求 AI：conversationRound=第${promptPayload.conversationRoundIndex || 0}轮，historyRounds=${promptPayload.historyRoundCount || 0}，historyMessages=${promptPayload.historyMessageCount ?? promptPayload.history.length}，currentRoundMessages=${promptPayload.currentRoundMessageCount ?? promptPayload.currentUserRoundMessages.length}`
    );
    const result = await chat({
      userInput: userInputForAi,
      history: promptPayload.history,
      /* [区域标注·已完成·AI识图当前轮媒体] 把本轮用户图片/表情包消息原始字段传给 prompt.js 组装视觉输入。 */
      currentUserRoundMessages: promptPayload.currentUserRoundMessages,
      chatSettings: state.chatPromptSettings,
      /* [区域标注·已完成·本次时间断层强化] 时间感知请求上下文：把当前用户轮次、上一条 AI 回复与上一条历史聊天记录时间传给 prompt.js，避免 AI 把凌晨旧语境误当成早上当前语境。 */
      conversationTimeContext: promptPayload.conversationTimeContext,
      settingsManager,
      /* [区域标注·本次需求] 提示词真实上下文：把当前会话/联系人/面具/档案/DB 传给 prompt.js，供 AI 读取有效信息 */
      db,
      activeMaskId: state.activeMaskId,
      currentSession: session,
      currentContact: state.contacts.find(contact => String(contact.id) === String(session.id)) || null,
      /* [区域标注·已完成·本次角色卡/用户面具上下文修复] 传入刚从 IndexedDB 刷新的完整档案上下文 */
      archiveData: latestArchiveDataForAi,
      /* [区域标注·本次需求3] 把全局表情包资产传给 prompt.js，由当前面具挂载分组决定 AI 可用资源 */
      stickerData: state.stickerData,
      /* ======================================================================
         [区域标注·已完成·旁白模式] 旁白模式状态透传给 prompt.js 的 chat()
         说明：
         1. asideModeActive — 旁白模式是否开启，决定 system prompt 是否注入旁白提示词。
         2. asideSettings — 旁白人称/风格/字数/显示模式，供 buildAsideModeSystemPrompt 使用。
         3. asideHistory — 旁白历史摘要数组，退出旁白模式后由 buildAsideHistorySummary 注入上下文。
         ====================================================================== */
      asideModeActive: state.asideModeActive,
      asideSettings: state.asideSettings,
      asideHistory: state.asideHistory
    });

    const rawAiTextOriginal = result?.rawText || result?.text || '';

    /* ========================================================================
       [区域标注·已完成·心声面板集成] 从 AI 原始回复中提取心声数据
       说明：
       1. extractInnerVoiceFromRawText 提取 [心声]{json}[/心声] 并返回去掉心声标签后的纯文本。
       2. 提取到的 innerVoice 对象会挂到本轮最后一条 AI 消息的 innerVoice 字段，随 currentMessages 写入 DB.js / IndexedDB。
       3. cleanedText 作为后续 buildAiReplyMessages 的输入，确保心声 JSON 不会以纯文本气泡显示在聊天界面。
       4. 不使用 localStorage/sessionStorage，不做双份存储兜底。
       ======================================================================== */
    const { innerVoice: extractedInnerVoice, cleanedText: rawAiTextAfterInnerVoice } = extractInnerVoiceFromRawText(rawAiTextOriginal);
    if (extractedInnerVoice) {
      appendChatConsoleRuntimeLog(state, 'info', `心声数据已提取：好感=${extractedInnerVoice.affection}%，醋意=${extractedInnerVoice.jealousy}%，心跳=${extractedInnerVoice.heartbeat}bpm`);
    }

    /* ========================================================================
       [区域标注·已完成·旁白模式] 从 AI 原始回复中提取旁白文本
       说明：
       1. 只在旁白模式开启时才提取 [旁白]...[/旁白] 标记。
       2. 提取后的 asideText 生成旁白气泡，cleanedText 作为后续消息解析输入。
       3. 旁白历史条目追加到 state.asideHistory，退出旁白模式时生成摘要注入上下文。
       4. 不使用 localStorage/sessionStorage，不做双份存储兜底。
       ======================================================================== */
    let rawAiText = rawAiTextAfterInnerVoice;
    let extractedAsideText = '';
    let extractedAsideSegments = [];
    if (isAsideModeActive(state)) {
      const { asideText, asideSegments, cleanedText } = extractAsideFromRawText(rawAiTextAfterInnerVoice);
      extractedAsideText = asideText;
      extractedAsideSegments = Array.isArray(asideSegments) ? asideSegments : [];
      rawAiText = cleanedText;
      if (extractedAsideText) {
        appendChatConsoleRuntimeLog(state, 'info', `旁白文本已提取：${extractedAsideSegments.length || 1} 段：${extractedAsideText.slice(0, 80)}${extractedAsideText.length > 80 ? '…' : ''}`);
      }
    }

    if (!String(rawAiText || '').trim()) {
      /* ======================================================================
         [区域标注·已完成·全局API报错弹窗接入] AI 空回复不入聊天记录
         说明：
         1. 主 API 请求完成但没有返回可展示内容时，只显示应用内报错弹窗。
         2. 不再把“AI 没有返回内容”或任何空回复占位文本发送到聊天界面。
         3. 本区域不写入 localStorage/sessionStorage，不新增双份存储兜底。
         ====================================================================== */
      appendChatConsoleRuntimeLog(state, 'warn', 'AI 返回为空文本，已改为显示 API 报错弹窗');
      showApiErrorModal(container, {
        code: 'empty_response',
        title: 'AI 本轮没有成功回复',
        message: 'API 请求已完成，但本轮 AI 没有返回可展示的聊天内容。'
      });
      return;
    } else {
      appendChatConsoleRuntimeLog(state, 'info', `AI 原始返回长度：${String(rawAiText).length}`);
    }
    const hasAppliedPendingTransferDecision = await applyAiPendingTransferDecisions(state, db, rawAiText);
    if (hasAppliedPendingTransferDecision) {
      refreshCurrentMessageListOnly(container, state);
    }

    /* ========================================================================
       [区域标注·已完成·AI生图] AI 生图结果转为聊天图片消息
       说明：
       1. prompt.js 已根据 AI 的 [图片] 协议调用设置应用中已开启的生图 API。
       2. 这里仅把 generatedImages 转成 type:image 的 assistant 消息，随 currentMessages 写入 DB.js / IndexedDB。
       3. 不使用 localStorage/sessionStorage，不保存双份图片缓存，也不显示原始 [图片] 协议文本。
       ======================================================================== */
    const generatedImageMessages = (Array.isArray(result?.generatedImages) ? result.generatedImages : [])
      .map((item, imageIndex) => ({
        role: 'assistant',
        type: 'image',
        content: `[图片] ${String(item?.imageName || item?.prompt || 'AI 生图').trim()}`,
        imageUrl: String(item?.imageUrl || '').trim(),
        imageName: String(item?.imageName || item?.prompt || 'AI 生图').trim(),
        imageSource: 'ai_generated',
        imagePrompt: String(item?.prompt || '').trim(),
        imageRoleName: String(item?.roleName || session?.name || '对方').trim(),
        imageGeneratedAt: Date.now() + imageIndex,
        /* ====================================================================
           [区域标注·已完成·AI图片与HTML卡片按协议原文顺序显示] AI 生图运行时顺序
           说明：protocolOrder 来自 prompt.js / chat-image-generation.js 对 [图片] 协议原文位置的解析；
                 仅用于本轮显示排序，入库前会剥离，不新增任何持久化字段。
           ==================================================================== */
        __protocolOrder: Number(item?.protocolOrder ?? item?.startIndex ?? imageIndex) || 0,
        __protocolEndIndex: Number(item?.endIndex ?? item?.startIndex ?? imageIndex) || 0
      }))
      .filter(item => item.imageUrl);

    const orderedAiMessages = sortAiMessagesByRuntimeProtocolOrder([
      ...buildAiReplyMessages(rawAiText, state, {
        /* [区域标注·已完成·AI文字图/生图互斥前端接收] 生图 API 开启时前端丢弃 [文字图]；未开启时才把 [文字图] 渲染为文字图气泡。 */
        textImageProtocolEnabled: Boolean(result?.textImageProtocolEnabled)
      }),
      ...generatedImageMessages
    ]);

        const aiMessagesWithoutCurrentUserEcho = filterCurrentUserRoundEchoFromAiMessages(
          orderedAiMessages.map(stripAiRuntimeProtocolOrderFields),
          promptPayload.currentUserRoundMessages
        );

        const aiMessages = bindAsideSegmentsToAiMessages(
          aiMessagesWithoutCurrentUserEcho,
          extractedAsideSegments,
          state.asideSettings?.displayMode || 'top',
          rawAiTextAfterInnerVoice
        );
    if (!aiMessages.length) {
      appendChatConsoleRuntimeLog(state, 'warn', '解析后无可显示消息');
    } else {
      appendChatConsoleRuntimeLog(state, 'info', `解析完成：${aiMessages.length} 条消息${generatedImageMessages.length ? `，含AI生图 ${generatedImageMessages.length} 张` : ''}`);
    }
    for (let index = 0; index < aiMessages.length; index += 1) {
      const message = {
        ...aiMessages[index],
        id: `ai_${Date.now()}_${index}`,
        timestamp: Date.now() + index
      };
      const visibleText = String(
        message.type === 'sticker'
          ? message.stickerName || message.content || '表情包'
          : (message.type === 'transfer'
              ? message.transferDisplayAmount || message.content || '转账'
              : (message.type === 'gift'
                  ? getGiftMessageDisplayText(message)
                  : (message.type === 'image'
                      ? message.imageName || message.content || 'AI 生图'
                      : message.content || '')))
      ).trim();
      if (index > 0) await sleep(getAiBubbleDelayMs(visibleText, index));
      state.currentMessages.push(message);
      appendChatConsoleRuntimeLog(
        state,
        'info',
        message.type === 'sticker'
          ? `AI消息[${index + 1}]：表情包 ${message.stickerName || ''}`.trim()
          : (message.type === 'transfer'
              ? `AI消息[${index + 1}]：转账 ${message.transferDisplayAmount || message.content || ''}`.trim()
              : (message.type === 'gift'
                  ? `AI消息[${index + 1}]：礼物 ${message.giftTitle || message.content || ''}`.trim()
                  : (message.type === 'image'
                      ? (isTextImageMessage(message)
                          ? `AI消息[${index + 1}]：文字图 ${message.textImageText || ''}`.trim()
                          : `AI消息[${index + 1}]：AI生图 ${message.imageName || ''}`.trim())
                      : `AI消息[${index + 1}]：${String(message.content || '').slice(0, 120)}`)))
      );
      hasRenderedAiBubble = true;
      session.lastMessage = message.type === 'sticker'
        ? `[表情包] ${message.stickerName || '未命名表情包'}`
        : (message.type === 'transfer'
            ? `[转账] ${message.transferDisplayAmount || message.content || '¥0.00'}`
            : (message.type === 'gift'
                ? getGiftMessageDisplayText(message)
                : (message.type === 'image'
                    ? (isTextImageMessage(message) ? `[文字图] ${message.textImageText || '文字图'}` : `[图片] ${message.imageName || 'AI 生图'}`)
                    : (message.content || '（AI 没有返回内容）'))));
      session.lastTime = Date.now();
      await persistCurrentMessages(state, db);
      await dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions);
      appendCurrentMessageBubble(container, state, state.currentMessages[state.currentMessages.length - 1]);
    }

    session.lastMessage = aiMessages[aiMessages.length - 1]?.type === 'sticker'
      ? `[表情包] ${aiMessages[aiMessages.length - 1]?.stickerName || '未命名表情包'}`
      : (aiMessages[aiMessages.length - 1]?.type === 'transfer'
          ? `[转账] ${aiMessages[aiMessages.length - 1]?.transferDisplayAmount || aiMessages[aiMessages.length - 1]?.content || '¥0.00'}`
          : (aiMessages[aiMessages.length - 1]?.type === 'gift'
              ? getGiftMessageDisplayText(aiMessages[aiMessages.length - 1])
              : (aiMessages[aiMessages.length - 1]?.type === 'image'
                  ? (isTextImageMessage(aiMessages[aiMessages.length - 1]) ? `[文字图] ${aiMessages[aiMessages.length - 1]?.textImageText || '文字图'}` : `[图片] ${aiMessages[aiMessages.length - 1]?.imageName || 'AI 生图'}`)
                  : (aiMessages[aiMessages.length - 1]?.content || '（AI 没有返回内容）'))));
    session.lastTime = Date.now();

    /* ========================================================================
       [区域标注·已修改·心声每轮生成与独立历史] 保存本轮心声
       说明：
       1. 心声仍挂到本轮最后一条 assistant 消息的 innerVoice 字段，供点击当前气泡头像直接查看。
       2. 同时追加写入独立心声历史键 chat_inner_voice_history::*（DB.js / IndexedDB），因此删除/清空当前聊天消息不会删除心声历史。
       3. 下一轮发给 AI 的 history/currentUserRoundMessages 不包含 innerVoice 字段；心声仅供用户点开面板观看。
       4. 不使用 localStorage/sessionStorage，不做双份存储兜底，不按长文本字段过滤。
       ======================================================================== */
    if (extractedInnerVoice) {
      let innerVoiceMessageId = '';
      for (let i = state.currentMessages.length - 1; i >= 0; i--) {
        if (state.currentMessages[i]?.role === 'assistant') {
          state.currentMessages[i].innerVoice = extractedInnerVoice;
          innerVoiceMessageId = String(state.currentMessages[i]?.id || '');
          break;
        }
      }
      await Promise.all([
        persistCurrentMessages(state, db),
        persistInnerVoiceHistoryEntry(db, state, extractedInnerVoice, innerVoiceMessageId)
      ]);
    }

    /* ========================================================================
       [区域标注·已完成·旁白固定/穿插位置修复] 旁白历史持久化
       说明：
       1. 旁白不再在 AI 全部消息生成结束后挂到“最后一条 assistant 消息”。
       2. 当前轮旁白已在 aiMessages 入列前由 bindAsideSegmentsToAiMessages 绑定到正确位置：
          - 固定模式：绑定到本轮第一条 AI/角色消息之前；
          - 穿插模式：按 AI 原文中多段 [旁白] 的相对位置绑定到对应消息前/后。
       3. 这里仅追加旁白历史，退出旁白模式时生成摘要注入上下文。
       4. 持久化只走 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
       ======================================================================== */
    if (extractedAsideText) {
      if (!Array.isArray(state.asideHistory)) state.asideHistory = [];
      const lastUserMsg = [...state.currentMessages].reverse().find(m => m.role === 'user');
      const lastAiMsg = [...state.currentMessages].reverse().find(m => m.role === 'assistant');
      state.asideHistory.push({
        asideText: extractedAsideText,
        asideSegments: extractedAsideSegments.map(segment => ({ text: String(segment?.text || '').trim() })).filter(segment => segment.text),
        userMessage: lastUserMsg ? String(lastUserMsg.content || '').slice(0, 200) : '',
        aiMessage: lastAiMsg ? String(lastAiMsg.content || '').slice(0, 200) : '',
        timestamp: Date.now()
      });
      await persistCurrentMessages(state, db);
      const asideHistoryKey = `chat_aside_history::${state.activeMaskId}::${state.currentChatId}`;
      await dbPut(db, asideHistoryKey, state.asideHistory);
    }
  } catch (error) {
    /* ========================================================================
       [区域标注·已完成·全局API报错弹窗接入] API 调用失败不写入聊天气泡
       说明：
       1. 429、503、网络错误、配置错误等失败原因统一交给 showApiErrorModal 展示。
       2. 不再把“API 调用失败：...”或“AI 没有返回内容”写入消息界面。
       3. 聊天记录持久化仍只走 DB.js / IndexedDB；本错误弹窗不做任何持久化存储。
       ======================================================================== */
    appendChatConsoleRuntimeLog(state, 'error', `API 调用失败，已显示报错弹窗：${error?.message || '未知错误'}`);
    showApiErrorModal(container, error);
  } finally {
    state.isAiSending = false;
    await Promise.all([
      persistCurrentMessages(state, db),
      dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions),
      persistChatConsoleRuntimeLogs(state, db)
    ]);
    if (hasRenderedAiBubble) {
      updateCurrentChatSendingUi(container, state);
    } else {
      renderCurrentChatMessage(container, state);
    }
  }
}

/* ========================================================================== */
export async function persistCurrentMessages(state, db) {
  if (!state.currentChatId) return;
  await dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + state.currentChatId, state.currentMessages);
}

/* ========================================================================== */
export function getMountedStickerItems(state) {
  const data = normalizeStickerData(state.stickerData);
  const mountedGroupIds = Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
    ? Array.from(new Set(state.chatPromptSettings.mountedStickerGroupIds.map(String).filter(Boolean)))
    : [];
  if (!mountedGroupIds.length) return [];
  if (mountedGroupIds.includes('all')) return data.items;
  return data.items.filter(item => mountedGroupIds.includes(String(item.groupId || 'all')));
}


export function getStickerProtocolCandidates(token) {
  const raw = String(token || '').trim();
  if (!raw) return [];

  /* ========================================================================
     [区域标注·本次需求2] AI 表情包协议目标强力归一化
     说明：
     1. 兼容模型把“资源ID：xxx / 表情名：xxx / xxx”混写进 [表情] 内容。
     2. 只在已挂载表情包中匹配；不编造、不兜底到其它存储。
     3. 目标是防止 AI 表情包因轻微掉格式而在聊天界面显示成纯文本协议。
     ======================================================================== */
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[`*_]+/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();

  const candidates = [
    cleaned,
    cleaned.replace(/^(?:资源\s*ID|资源Id|ID|id|表情名|名称)\s*[：:]\s*/i, '').trim()
  ];

  [...cleaned.matchAll(/(?:资源\s*ID|资源Id|ID|id|表情名|名称)\s*[：:]\s*([^；;，,\n]+)/gi)]
    .forEach(match => candidates.push(String(match[1] || '').trim()));

  [...cleaned.matchAll(/sticker_[A-Za-z0-9_:-]+/g)]
    .forEach(match => candidates.push(String(match[0] || '').trim()));

  cleaned.split(/[；;，,\s]+/).forEach(part => candidates.push(part.trim()));

  return Array.from(new Set(
    candidates
      .map(item => String(item || '').replace(/^["'“”]+|["'“”]+$/g, '').trim())
      .filter(Boolean)
  ));
}


export function resolveStickerProtocolTarget(token, state) {
  const candidates = getStickerProtocolCandidates(token);
  if (!candidates.length) return null;

  const candidateItems = getMountedStickerItems(state);
  for (const normalizedToken of candidates) {
    const byId = candidateItems.find(item => String(item.id) === normalizedToken);
    if (byId) return byId;

    const byName = candidateItems.find(item => String(item.name) === normalizedToken);
    if (byName) return byName;
  }

  return null;
}

/* ========================================================================== */
export function normalizeStickerLooseMatchText(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/[`*_#"“”"'《》（）()\[\]【】{}]/g, '')
    .replace(/(?:资源\s*ID|资源Id|表情名|名称|表情包|表情|贴纸|sticker|发送|发个|发一张|来个|给你|我发|刚才|点错了|没发出去|这回|看清楚|看看|吧|啊|呀|呢|了)/gi, '')
    .replace(/[：:；;，,。.!！？?\s-]+/g, '')
    .toLowerCase()
    .trim();
}


export function findLooseStickerTargetFromText(text, state) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const exact = resolveStickerProtocolTarget(raw, state);
  if (exact) return exact;

  const mountedItems = getMountedStickerItems(state);
  if (!mountedItems.length) return null;

  const hasStickerIntent = /表情|表情包|贴纸|sticker_|资源\s*ID|资源Id|动图|发.*图|发.*包/i.test(raw);
  const rawLower = raw.toLowerCase();

  const byId = mountedItems.find(item => {
    const id = String(item.id || '').trim();
    return id && rawLower.includes(id.toLowerCase());
  });
  if (byId) return byId;

  const rawLoose = normalizeStickerLooseMatchText(raw);
  if (!rawLoose) return null;

  const byName = mountedItems.find(item => {
    const name = String(item.name || '').trim();
    const nameLoose = normalizeStickerLooseMatchText(name);
    return name && (
      raw.includes(name) ||
      (hasStickerIntent && nameLoose.length >= 2 && (rawLoose.includes(nameLoose) || nameLoose.includes(rawLoose)))
    );
  });

  return byName || null;
}


export function createStickerMessagePatchFromTarget(message, sticker) {
  if (!message || !sticker) return null;
  return {
    ...message,
    role: 'assistant',
    type: 'sticker',
    content: `[表情包] ${sticker.name}`,
    stickerId: sticker.id,
    stickerName: sticker.name,
    stickerUrl: sticker.url
  };
}


export function repairAiMessageFormatIfPossible(message, state) {
  if (!message || message.role !== 'assistant') return null;
  if (String(message.type || '') === 'sticker' && String(message.stickerUrl || '').trim()) return null;

  const sticker = findLooseStickerTargetFromText(message.content, state);
  return sticker ? createStickerMessagePatchFromTarget(message, sticker) : null;
}


/* ==========================================================================
   [区域标注·已完成·本次旁白掉格式修正] 文本/引用/语音/旁白掉格式修复工具
   说明：
   1. “修正 → 文本”用于修复普通文字气泡掉格式：裸露 [回复] 协议头、Markdown 加粗/反引号、格式检查前缀或“修正后内容”等说明文字。
   2. “修正 → 语音”用于把含 [语音] / 【语音】残片的 AI 文字气泡修正为 type=voice_message 语音气泡。
   3. “修正 → 旁白”用于把露出“旁白”字样或 [旁白] 残片的 AI 文字气泡修正为旁白气泡。
   4. 仅修复当前 AI 消息对象，不读取或写入 localStorage/sessionStorage。
   5. 真正持久化仍由 index.js 调用 persistCurrentMessages 写入 DB.js / IndexedDB。
   6. 下次如需扩展其它修正类别，优先在本区域增加独立修复函数。
   ========================================================================== */
export function repairAiTextMessageFormatIfPossible(message) {
  if (!message || message.role !== 'assistant') return null;
  if (['sticker', 'image', 'transfer', 'gift'].includes(String(message.type || ''))) return null;

  const before = String(message.content || '');
  const protocolBlocks = extractAiProtocolBlocks(before).filter(block => block.type === '回复');
  const protocolText = protocolBlocks
    .map(block => cleanAiVisibleBubbleText(block.content))
    .filter(Boolean)
    .join('\n');

  const after = cleanAiVisibleBubbleText(protocolText || before)
    .replace(/^\s*(?:以下是)?(?:修正后内容|最终输出|回复格式|检查结果|修正结果|正确格式)\s*[：:]\s*/i, '')
    .replace(/^\s*(?:\*\*)?\s*`?\s*\[\s*回复\s*\]\s*[^：:\n`*]+?\s*[：:]\s*/i, '')
    .replace(/^\s*(?:回复|文字|文本)\s*[：:]\s*/i, '')
    .replace(/(?:`|\*\*)+/g, '')
    .trim();

  if (!after || after === before.trim()) return null;
  return {
    ...message,
    type: '',
    content: after,
    quote: message.quote || null
  };
}


/* ========================================================================
   [区域标注·已完成·本次引用掉格式修复] AI 引用文字转引用气泡工具
   说明：
   1. 修正按钮“引用”已支持 `{引用ID:xxx}` 标准协议，也支持截图中的“› 引用了某人：‘原文’”这类纯文字掉格式。
   2. 能匹配到当前聊天记录原消息时使用真实 quote payload；匹配不到时用文字里的被引用人/原文生成可渲染引用预览。
   3. 只修改当前 AI 消息对象的 content/quote 字段；保存仍由 index.js 写入 DB.js / IndexedDB。
   4. 不使用 localStorage/sessionStorage，不写双份存储兜底，不按长文本字段过滤。
   ======================================================================== */
function normalizeAiQuoteLookupText(value = '') {
  return cleanAiVisibleBubbleText(value)
    .replace(/^[›>]\s*/, '')
    .replace(/^引用(?:了|自)?\s*[^：:「“"'\n]{0,40}\s*[：:]\s*/i, '')
    .replace(/[「」“”"'‘’]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function splitLooseAiQuoteBody(body = '') {
  const value = String(body || '').trim();
  if (!value) return { quoteText: '', replyText: '' };

  const firstChar = value.charAt(0);
  const quotePairs = {
    '“': '”',
    '‘': '’',
    '"': '"',
    "'": "'",
    '「': '」'
  };

  if (quotePairs[firstChar]) {
    const closeChar = quotePairs[firstChar];
    const closeIndex = value.indexOf(closeChar, 1);
    if (closeIndex > 0) {
      return {
        quoteText: value.slice(1, closeIndex).trim(),
        replyText: cleanAiVisibleBubbleText(value.slice(closeIndex + 1).replace(/^[\s：:，,。；;\-—]+/, ''))
      };
    }

    return {
      quoteText: value.slice(1).replace(/[”’"'}」]+$/g, '').trim(),
      replyText: ''
    };
  }

  const lines = value.split(/\n+/).map(item => item.trim()).filter(Boolean);
  if (lines.length > 1) {
    return {
      quoteText: lines[0].replace(/[”’"'}」]+$/g, '').trim(),
      replyText: cleanAiVisibleBubbleText(lines.slice(1).join('\n'))
    };
  }

  return {
    quoteText: value.replace(/[”’"'}」]+$/g, '').trim(),
    replyText: ''
  };
}

function parseLooseAiQuoteText(raw = '', fallbackSenderName = '') {
  const text = cleanAiProtocolBlockContent(raw)
    .replace(/^[›>]\s*/, '')
    .trim();
  if (!/引用/.test(text)) return null;

  const withoutProtocol = text.replace(/^(?:\[\s*引用\s*\]\s*)/i, '').trim();
  const quoteIdMatch = withoutProtocol.match(/\{\s*引用\s*ID\s*[：:]\s*([^}；;，,\s]+)\s*\}\s*([\s\S]*)$/i);
  if (quoteIdMatch) {
    return {
      quoteId: String(quoteIdMatch[1] || '').trim(),
      senderName: String(fallbackSenderName || '').trim(),
      quoteText: '',
      replyText: cleanAiVisibleBubbleText(quoteIdMatch[2])
    };
  }

  const colonMatch = withoutProtocol.match(/^(?:引用(?:了|自)?\s*)?([^：:「“"'\n]{0,40})\s*[：:]\s*([\s\S]*)$/i);
  if (!colonMatch) return null;

  const senderName = String(colonMatch[1] || fallbackSenderName || '')
    .replace(/^引用(?:了|自)?\s*/i, '')
    .trim();
  const { quoteText, replyText } = splitLooseAiQuoteBody(colonMatch[2]);
  if (!quoteText && !replyText) return null;

  return {
    quoteId: '',
    senderName,
    quoteText,
    replyText
  };
}

function resolveAiQuotePayloadByLooseText(state, quoteText = '', senderName = '', sourceMessageId = '') {
  const targetText = String(quoteText || '').trim();
  if (!targetText) return null;

  const session = state.sessions?.find?.(item => String(item.id) === String(state.currentChatId)) || {};
  const normalizedTarget = normalizeAiQuoteLookupText(targetText);
  const messages = Array.isArray(state.currentMessages) ? state.currentMessages : [];

  for (const message of [...messages].reverse()) {
    if (sourceMessageId && String(message?.id || '') === String(sourceMessageId)) continue;

    const payload = createQuotePayloadFromMessage(message, session, state.profile || {});
    const payloadText = String(payload?.text || '').trim();
    const normalizedPayloadText = normalizeAiQuoteLookupText(payloadText);
    const payloadSender = String(payload?.senderName || '').trim();
    const safeSender = String(senderName || '').trim();

    const textMatched = normalizedTarget
      && normalizedPayloadText
      && (normalizedPayloadText.includes(normalizedTarget) || normalizedTarget.includes(normalizedPayloadText));
    const senderMatched = !safeSender || !payloadSender || payloadSender.includes(safeSender) || safeSender.includes(payloadSender);

    if (textMatched && senderMatched) return payload;
  }

  const syntheticText = targetText.replace(/\s+/g, ' ').trim();
  return syntheticText
    ? {
        id: '',
        role: 'assistant',
        senderName: String(senderName || session?.name || '对方').trim() || '对方',
        text: syntheticText.length > 86 ? `${syntheticText.slice(0, 86)}…` : syntheticText,
        type: 'text',
        timestamp: 0
      }
    : null;
}

export function repairAiQuoteMessageFormatIfPossible(message, state) {
  if (!message || message.role !== 'assistant') return null;
  if (['sticker', 'image', 'transfer', 'gift'].includes(String(message.type || ''))) return null;

  const raw = String(message.content || '').trim();
  const quoteMatch = raw.match(/(?:\[\s*引用\s*\]\s*[^：:\n`*]+?\s*[：:]\s*)?\{\s*引用\s*ID\s*[：:]\s*([^}；;，,\s]+)\s*\}\s*([\s\S]*)$/i);
  const looseQuote = quoteMatch ? null : parseLooseAiQuoteText(raw);
  if (!quoteMatch && !looseQuote) return null;

  const quotePayload = quoteMatch
    ? resolveAiQuotePayloadById(state, quoteMatch[1])
    : resolveAiQuotePayloadByLooseText(state, looseQuote.quoteText, looseQuote.senderName, message.id);
  const replyText = cleanAiVisibleBubbleText(quoteMatch ? quoteMatch[2] : looseQuote.replyText);
  if (!quotePayload) return null;

  return {
    ...message,
    type: '',
    content: replyText,
    quote: quotePayload
  };
}

export function repairAiVoiceMessageFormatIfPossible(message) {
  if (!message || message.role !== 'assistant') return null;
  if (isVoiceMessage(message)) return null;
  if (['sticker', 'image', 'transfer', 'gift', 'card'].includes(String(message.type || ''))) return null;

  const raw = String(message.content || message.voiceText || '').trim();
  if (!/(?:\[\s*语音\s*\]|【\s*语音\s*】)/i.test(raw)) return null;

  const voiceBlocks = extractAiProtocolBlocks(raw).filter(block => block.type === '语音');
  const payload = voiceBlocks
    .map(block => parseAiVoiceProtocolPayload(block.content))
    .find(Boolean)
    || parseAiVoiceProtocolPayload(raw);

  if (!payload) return null;

  return {
    ...message,
    role: 'assistant',
    type: 'voice_message',
    voiceExpanded: false,
    ...payload
  };
}

export function repairAiAsideMessageFormatIfPossible(message) {
  if (!message || message.role !== 'assistant') return null;
  if (['sticker', 'image', 'transfer', 'gift', 'card'].includes(String(message.type || ''))) return null;

  const raw = String(message.content || '').trim();
  if (!/旁白/i.test(raw)) return null;

  const { asideText, asideSegments, cleanedText } = extractAsideFromRawText(raw);
  const normalizedSegments = (Array.isArray(asideSegments) ? asideSegments : [])
    .map((segment, index) => ({
      id: String(segment?.id || `${message.id || 'aside_repair'}_${index + 1}`),
      text: String(segment?.text || '').trim(),
      placement: 'before'
    }))
    .filter(segment => segment.text);

  if (!asideText || !normalizedSegments.length) return null;

  return {
    ...message,
    role: 'assistant',
    type: '',
    content: cleanAiVisibleBubbleText(cleanedText || ''),
    asideText,
    asideSegments: normalizedSegments
  };
}

/* ========================================================================
   [区域标注·已完成·AI本轮撤回系统提示修正]
   说明：
   1. “修正 → 系统提示”专门修复 AI 撤回系统小字的显示格式。
   2. 只修改当前消息对象；持久化由 index.js 写入 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不做双份存储兜底。
   ======================================================================== */
export function repairAiSystemTipFormatIfPossible(message) {
  if (!message || String(message.type || '') !== 'ai_withdraw_system') return null;
  const withdrawnText = String(message.withdrawnContent || message.aiVisibleWithdrawnSummary || '').trim();
  if (!withdrawnText) return null;
  const roleName = String(message.withdrawnRoleName || '').trim() || '对方';
  return {
    ...message,
    role: 'user',
    type: 'ai_withdraw_system',
    content: `${roleName} 撤回了一条消息`,
    withdrawnContent: withdrawnText,
    aiVisibleWithdrawnSummary: withdrawnText,
    withdrawnRoleName: roleName
  };
}


/* ========================================================================
   [区域标注·已完成·本次引用回复合并与闭合标签残片清理] AI 协议闭合标签清理工具
   说明：
   1. 统一清理 `[/回复]`、`[/引用]`、`[/语音]`、`[/文字图]`、`[/图片]`、`[/卡片]` 等闭合协议残片。
   2. 仅服务聊天前端协议解析与可见文本清洗，不改 DB.js / IndexedDB 持久化结构。
   3. 本次用于修复“闭合标签单独掉成普通气泡/普通文本”的问题，并为引用+回复合并提供更稳定的前置清洗。
   ======================================================================== */
const AI_PROTOCOL_CLOSING_TAG_REGEX = /(?:\[\s*\/\s*(?:回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片|旁白|心声)\s*\]|【\s*\/\s*(?:语音|文字图)\s*】)/gi;

function stripAiProtocolClosingTags(value = '') {
  return String(value || '').replace(AI_PROTOCOL_CLOSING_TAG_REGEX, ' ');
}

export function cleanAiProtocolBlockContent(content) {
  return stripAiProtocolClosingTags(String(content || ''))
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    /* ======================================================================
       [区域标注·已完成·普通气泡引号保留与省略号残片合并] 协议正文引号保护
       说明：
       1. 不再清理正文首尾的 “ ” / " / '，避免 “预备”一下？ 被显示成 预备”一下？。
       2. 这里只继续清理 Markdown/协议包裹残片；可见聊天正文标点必须原样保留。
       3. 本区域只影响前端运行时解析，不读写 localStorage/sessionStorage，不改持久化结构。
       ====================================================================== */
    .trim();
}

/* ========================================================================
   [区域标注·已完成·AI图片与HTML卡片按协议原文顺序显示] 本轮消息运行时排序工具
   说明：
   1. __protocolOrder / __protocolEndIndex 只在本轮 AI 回复解析与排序时使用，写入 currentMessages 前会剥离。
   2. AI 生图与 HTML 卡片都按原文中 [图片]/[卡片] 协议位置插回文字、语音、礼物等消息之间，不再统一落到本轮最下方。
   3. 本区域不读写持久化存储；消息最终仍只通过 DB.js / IndexedDB 保存，不使用 localStorage/sessionStorage。
   ======================================================================== */
function getAiRuntimeProtocolOrder(message = {}, fallbackIndex = 0) {
  const value = Number(message?.__protocolOrder);
  return Number.isFinite(value) ? value : Number(fallbackIndex || 0);
}

function sortAiMessagesByRuntimeProtocolOrder(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map((message, index) => ({
      message,
      index,
      order: getAiRuntimeProtocolOrder(message, index)
    }))
    .sort((a, b) => (a.order - b.order) || (a.index - b.index))
    .map(item => item.message);
}

function stripAiRuntimeProtocolOrderFields(message = {}) {
  const {
    __protocolOrder,
    __protocolEndIndex,
    __protocolIndex,
    ...cleanMessage
  } = message || {};
  return cleanMessage;
}

/* ==========================================================================
   [区域标注·已完成·本次用户本轮消息回显拦截] AI 普通文字回复去除本轮用户原话回显
   说明：
   1. 只处理普通 assistant 文字气泡；不处理表情、图片、语音、礼物、转账、卡片、撤回系统提示、文字图等特殊类型。
   2. 若 AI 普通文字气泡与本轮某条用户原话一致，则直接丢弃该气泡。
   3. 若 AI 普通文字气泡开头先复述本轮某条用户原话，再接真正回复，则剥离开头复述，仅保留后续回复。
   4. 拦截发生在消息落库/渲染前，因此不会闪屏，也不会把重复内容写入 DB.js / IndexedDB。
   ========================================================================== */
function normalizeCurrentUserEchoCompareText(value = '') {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/[`*_]/g, '')
    .replace(/[“”"'‘’「」『』《》〈〉（）()【】\[\]{}]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，,。.!！？?、；;：:~～…\-—]/g, '')
    .toLowerCase()
    .trim();
}

function getCurrentUserRoundComparableTexts(currentUserRoundMessages = []) {
  return (Array.isArray(currentUserRoundMessages) ? currentUserRoundMessages : [])
    .filter(message => String(message?.role || '') === 'user' && !String(message?.type || '').trim())
    .map(message => {
      const raw = String(message?.content || '').trim();
      const normalized = normalizeCurrentUserEchoCompareText(raw);
      return raw && normalized ? { raw, normalized } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.normalized.length - a.normalized.length) || (b.raw.length - a.raw.length));
}

function stripLeadingCurrentUserEchoFromAiText(aiText = '', currentUserTexts = []) {
  const sourceText = String(aiText || '').trim();
  const comparableTexts = Array.isArray(currentUserTexts) ? currentUserTexts : [];
  if (!sourceText || !comparableTexts.length) return sourceText;

  const getLeadingEchoCutIndex = (text, comparable) => {
    const targetNormalized = String(comparable?.normalized || '').trim();
    if (!targetNormalized) return -1;

    let collected = '';
    for (let index = 0; index < text.length; index += 1) {
      const normalizedChar = normalizeCurrentUserEchoCompareText(text.charAt(index));
      if (!normalizedChar) continue;

      collected += normalizedChar;
      if (!targetNormalized.startsWith(collected)) return -1;

      if (collected === targetNormalized) {
        let cutIndex = index + 1;
        const trailingMatch = text
          .slice(cutIndex)
          .match(/^[\s\u3000，,。.!！？?、；;：:~～…\-—"'“”‘’「」『』《》〈〉（）()【】\[\]{}]+/);
        if (trailingMatch) cutIndex += trailingMatch[0].length;
        return cutIndex;
      }
    }

    return -1;
  };

  let remaining = sourceText;
  let previousText = '';

  while (remaining && remaining !== previousText) {
    previousText = remaining;
    let matchedCutIndex = -1;

    comparableTexts.forEach(item => {
      const currentCutIndex = getLeadingEchoCutIndex(remaining, item);
      if (currentCutIndex > matchedCutIndex) matchedCutIndex = currentCutIndex;
    });

    if (matchedCutIndex < 0) break;
    remaining = remaining.slice(matchedCutIndex).trim();
  }

  return remaining;
}

function filterCurrentUserRoundEchoFromAiMessages(aiMessages = [], currentUserRoundMessages = []) {
  const messages = Array.isArray(aiMessages) ? aiMessages : [];
  const currentUserTexts = getCurrentUserRoundComparableTexts(currentUserRoundMessages);
  if (!currentUserTexts.length) return messages;

  return messages.reduce((list, message) => {
    if (!message || String(message?.role || '') !== 'assistant') {
      list.push(message);
      return list;
    }

    if (String(message?.type || '').trim()) {
      list.push(message);
      return list;
    }

    const originalText = String(message?.content || '').trim();
    if (!originalText) {
      list.push(message);
      return list;
    }

    const normalizedOriginalText = normalizeCurrentUserEchoCompareText(originalText);
    if (currentUserTexts.some(item => item.normalized === normalizedOriginalText)) {
      return list;
    }

    const strippedText = stripLeadingCurrentUserEchoFromAiText(originalText, currentUserTexts);
    if (!strippedText) {
      return list;
    }

    list.push(strippedText === originalText ? message : { ...message, content: strippedText });
    return list;
  }, []);
}

/* ==========================================================================
   [区域标注·已完成·角色主动转账协议解析] AI 转账协议内容解析
   说明：
   1. 只解析 `[转账] 角色名：{金额:xxx,备注:xxx}` 对应的大括号内容。
   2. 解析成功后统一生成 type:transfer 结构化消息，持久化仍只走 DB.js / IndexedDB。
   3. 不新增任何本地同步存储，也不改用户手动转账入口逻辑。
   ========================================================================== */
export function parseAiTransferProtocolPayload(content) {
  const normalized = cleanAiProtocolBlockContent(content);
  if (!normalized) return null;

  const bodyMatch = normalized.match(/\{\s*([\s\S]*?)\s*\}/);
  const body = bodyMatch ? String(bodyMatch[1] || '').trim() : normalized;
  if (!body) return null;

  const amountMatch = body.match(/金额\s*[：:]\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const noteMatch = body.match(/备注\s*[：:]\s*([^}]*)/i);
  const transferNote = String(noteMatch?.[1] || '').trim();

  return {
    transferAmount: Number(amount.toFixed(2)),
    transferBaseCny: Number(amount.toFixed(2)),
    transferCurrency: 'CNY',
    transferDisplayAmount: `¥${amount.toFixed(2)}`,
    transferNote,
    content: `¥${amount.toFixed(2)}`
  };
}


export function resolveAiQuotePayloadById(state, quoteId = '') {
  const targetId = String(quoteId || '').trim();
  if (!targetId) return null;
  const session = state.sessions?.find?.(item => String(item.id) === String(state.currentChatId)) || {};
  const message = (state.currentMessages || []).find(item => String(item.id) === targetId);
  return message ? createQuotePayloadFromMessage(message, session, state.profile || {}) : null;
}


/* ==========================================================================
   [区域标注·已完成·本次消息掉格式修复] 通用协议段落解析辅助
   说明：
   1. 兼容 AI 漏写“角色名：”或漏写“：”时仍可识别协议块，避免 [表情]/[引用]/[回复] 整段掉成普通文本。
   2. 只做运行时解析，不改持久化结构；消息落库仍统一走 DB.js / IndexedDB。
   ========================================================================== */
function parseProtocolRoleAndContent(raw = '', type = '') {
  const text = cleanAiProtocolBlockContent(raw);
  if (!text) return { roleName: '', content: '' };

  const typeName = String(type || '').trim();

  /* [引用] 常见掉格式：{引用ID:xxx}正文（漏角色名） */
  if (typeName === '引用' && /^\s*\{\s*引用\s*ID\s*[：:]/i.test(text)) {
    return { roleName: '', content: text };
  }

  /* 标准：角色名：内容（角色名 1-40 字）
     [区域标注·已完成·本次表情包前置空回复修复]
     说明：如果 AI 输出 `[回复] 角色名：` 后紧跟 `[表情]`，这里返回空 content，让 extractAiProtocolBlocks 丢弃该空回复块，
           避免聊天界面单独显示“角色名：”文字气泡。 */
  const roleAndContentMatch = text.match(/^([^：:\n`*]{1,40})\s*[：:]\s*([\s\S]*)$/);
  if (roleAndContentMatch) {
    const roleName = String(roleAndContentMatch[1] || '').trim();
    const content = cleanAiProtocolBlockContent(roleAndContentMatch[2] || '');
    if (roleName) return { roleName, content };
  }

  return { roleName: '', content: text };
}

export function extractAiProtocolBlocks(rawText) {
  const visibleText = stripAiProtocolClosingTags(String(rawText || ''))
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  /* ========================================================================
     [区域标注·已完成·本次语音掉格式强容错解析] 宽松协议头识别
     说明：
     1. 协议头仅要求出现 [类型]，不再强依赖“角色名：”紧跟在后。
     2. [语音] / [文字图] 同时支持方括号与全角书名号写法：`[ 语音 ]` / `[ 文字图 ]` / `【语音】` / `【文字图】`。
     3. 内容中的角色名由 parseProtocolRoleAndContent 二次解析，避免模型轻微掉格式时整段失效。
     4. 卡片仍由 extractHtmlCardProtocolBlocks 负责正文提取；本循环遇到 type=卡片仅做边界截断。
     ======================================================================== */
  const markerRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片)\s*\]|【\s*(语音|文字图)\s*】)\s*/g;
  const matches = [...visibleText.matchAll(markerRegex)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const contentStart = Number(match.index || 0) + String(match[0] || '').length;
      const contentEnd = nextMatch ? Number(nextMatch.index || visibleText.length) : visibleText.length;
      const type = String(match[1] || match[2] || '').trim();
      const parsed = parseProtocolRoleAndContent(visibleText.slice(contentStart, contentEnd), type);
      return {
        type,
        roleName: parsed.roleName,
        content: parsed.content,
        /* ====================================================================
           [区域标注·已完成·AI图片与HTML卡片按协议原文顺序显示] 普通协议块运行时顺序
           说明：保留每个协议头在 AI 原文里的位置，供本轮把图片/HTML卡片插回正确聊天节奏。
           ==================================================================== */
        __protocolOrder: Number(match.index || 0) || 0,
        __protocolEndIndex: contentEnd,
        __protocolIndex: index
      };
    })
    .filter(item => item.type && item.content);
}


export function buildAiReplyMessages(rawText, state, options = {}) {
  /* ========================================================================
     [区域标注·已完成·AI文字图/生图互斥前端渲染入口]
     说明：
     1. textImageProtocolEnabled=true 时才接收 [文字图] 并转成文字图气泡。
     2. 生图 API 开启后 textImageProtocolEnabled=false，前端直接丢弃 [文字图]，只接收 generatedImages 产生的 [图片] 消息。
     3. 文字图消息仍随 currentMessages 统一写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const textImageProtocolEnabled = Boolean(options.textImageProtocolEnabled);

  /* ========================================================================
     [区域标注·已完成·HTML卡片开关关闭时阻断卡片协议落库]
     说明：
     1. 只有当前聊天设置 htmlCardEnabled=true 时，才允许把 AI 的 [卡片] 协议解析为 type:card 消息。
     2. 开关关闭时即使模型误输出 [卡片]，这里也不会继续落库、渲染或注入 HTML 卡片。
     3. 这样可与 prompt.js 的提示词修复形成双保险：既不再向模型暴露卡片协议，也不再接收关闭状态下误输出的卡片结果。
     ======================================================================== */
  const htmlCardFeatureEnabled = Boolean(state?.chatPromptSettings?.htmlCardEnabled);
  const protocolBlocks = extractAiProtocolBlocks(rawText);
  const detectedHtmlCardBlocks = extractHtmlCardProtocolBlocks(rawText);
  const htmlCardBlocks = htmlCardFeatureEnabled ? detectedHtmlCardBlocks : [];
  if (!protocolBlocks.length && !htmlCardBlocks.length) {
    /* ======================================================================
       [区域标注·已完成·本次语音掉格式强容错解析] 无标准协议块时的语音兜底解析
       说明：
       1. 只要 AI 原文中出现 [语音] / 【语音】，前端优先尝试转为语音消息气泡。
       2. 解析成功后不再把原始 [语音] 文本渲染为普通气泡，严防截图中这类掉格式问题。
       3. 仅转换当前运行时消息对象；落库仍随 currentMessages 写入 DB.js / IndexedDB。
       ====================================================================== */
    if (/(?:\[\s*语音\s*\]|【\s*语音\s*】)/i.test(String(rawText || ''))) {
      const voicePayload = parseAiVoiceProtocolPayload(rawText);
      if (voicePayload) {
        return enforceAiReplyMessageCount([{
          role: 'assistant',
          type: 'voice_message',
          voiceExpanded: false,
          ...voicePayload
        }], state.chatPromptSettings);
      }
    }

    /* ======================================================================
       [区域标注·已完成·本次文字图掉格式解析增强] 无标准协议块时的文字图兜底解析
       说明：
       1. 当模型仍输出 `[文字图]` / `【文字图】`，但整体格式不足以进入标准协议块识别时，前端仍尝试转成文字图气泡。
       2. 仅在 textImageProtocolEnabled=true 时启用；生图 API 开启后依旧丢弃文字图协议，避免双份视觉通道。
       3. 文字图内容清洗复用 chat-text-image.js 的 createAiTextImageMessageFromProtocol / normalizeTextImageText，不改持久化结构。
       ====================================================================== */
    if (textImageProtocolEnabled && /(?:\[\s*文字图\s*\]|【\s*文字图\s*】)/i.test(String(rawText || ''))) {
      const textImageMessage = createAiTextImageMessageFromProtocol(rawText);
      if (textImageMessage) {
        return enforceAiReplyMessageCount([textImageMessage], state.chatPromptSettings);
      }
    }

    const repairedSticker = findLooseStickerTargetFromText(rawText, state);
    if (repairedSticker) {
      return enforceAiReplyMessageCount([{
        role: 'assistant',
        type: 'sticker',
        content: `[表情包] ${repairedSticker.name}`,
        stickerId: repairedSticker.id,
        stickerName: repairedSticker.name,
        stickerUrl: repairedSticker.url
      }], state.chatPromptSettings);
    }

    return enforceAiReplyMessageCount(
      splitAiReplyIntoBubbles(rawText, state.chatPromptSettings).map(content => ({
        role: 'assistant',
        content
      })),
      state.chatPromptSettings
    );
  }

  const builtMessages = [];
  const skippedProtocolIndexes = new Set();
  let hasImageGenerationProtocol = false;
  let hasHtmlCardProtocol = false;
  protocolBlocks.forEach((block, blockIndex) => {
    if (skippedProtocolIndexes.has(Number(block?.__protocolIndex ?? blockIndex))) return;
    if (block.type === '撤回') {
      /* ======================================================================
         [区域标注·已完成·AI本轮撤回协议解析]
         说明：
         1. AI 只能撤回本轮已经生成的 assistant 消息；系统提示不会被后续撤回误删。
         2. prompt.js 已强约束 AI 多条撤回必须输出多条 [撤回]；这里仍兼容旧模型的 {目标:全部}/{条数:N}。
         3. 无论旧模型写单条批量撤回还是多条独立撤回，最终都逐条追加 ai_withdraw_system 系统小字，禁止合并成“撤回了N条消息”。
         ====================================================================== */
      const body = cleanAiProtocolBlockContent(block.content);
      const countMatch = body.match(/条数\s*[：:]\s*(\d+)/i);
      const targetAll = /目标\s*[：:]\s*(全部|所有|all)/i.test(body);
      const countFromBody = Math.max(1, Math.floor(Number(countMatch?.[1] || 1)) || 1);
      const requestedWithdrawCount = targetAll
        ? builtMessages.filter(message => message?.role === 'assistant').length
        : countFromBody;
      const roleName = String(block.roleName || '').trim() || '对方';

      for (let i = 0; i < requestedWithdrawCount; i += 1) {
        const withdrawIndex = builtMessages
          .map((message, index) => ({ message, index }))
          .reverse()
          .find(item => item.message?.role === 'assistant')?.index;

        if (withdrawIndex === undefined) break;

        const [removedMessage] = builtMessages.splice(withdrawIndex, 1);
        const withdrawnText = String(
          removedMessage.type === 'sticker'
            ? `[表情包] ${removedMessage.stickerName || removedMessage.content || ''}`
            : (removedMessage.type === 'transfer'
                ? `[转账] ${removedMessage.transferDisplayAmount || removedMessage.content || ''}`
                : (removedMessage.type === 'gift'
                    ? getGiftMessageDisplayText(removedMessage)
                    : (removedMessage.content || '')))
        ).trim();
        if (!withdrawnText) continue;

          builtMessages.push({
            role: 'user',
            type: 'ai_withdraw_system',
            content: `${roleName} 撤回了一条消息`,
            withdrawnContent: withdrawnText,
            aiVisibleWithdrawnSummary: withdrawnText,
            withdrawnRoleName: roleName,
            __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
            __protocolEndIndex: block.__protocolEndIndex
          });
      }
      return;
    }

    if (block.type === '表情') {
      const sticker = resolveStickerProtocolTarget(block.content, state) || findLooseStickerTargetFromText(block.content, state);
      if (sticker) {
        builtMessages.push({
          role: 'assistant',
          type: 'sticker',
          content: `[表情包] ${sticker.name}`,
          stickerId: sticker.id,
          stickerName: sticker.name,
          stickerUrl: sticker.url,
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
          __protocolEndIndex: block.__protocolEndIndex
        });
      }
      /* [区域标注·本次修改2] 表情协议无有效匹配时直接丢弃原始协议，避免 sticker_id 或残缺协议以纯文本气泡露出 */
      return;
    }

    if (block.type === '语音') {
      /* ======================================================================
         [区域标注·已完成·AI语音消息协议渲染]
         说明：
         1. AI 输出 [语音] 时转为 type=voice_message 结构化消息，复用 chat-voice.js 的语音气泡。
         2. 协议格式为 `[语音] 角色名：{时长:xx}语音转写文本`；解析失败直接丢弃，避免原始协议露出。
         3. 语音消息随 currentMessages 统一写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
         ====================================================================== */
      const voiceMessage = createAiVoiceMessageFromProtocol(block);
      if (voiceMessage) {
        builtMessages.push({
          ...voiceMessage,
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
          __protocolEndIndex: block.__protocolEndIndex
        });
      }
      return;
    }

    if (block.type === '文字图') {
      /* ======================================================================
         [区域标注·已完成·AI文字图协议渲染]
         说明：
         1. 仅在生图 API 未开启/配置不完整时接收 [文字图]。
         2. 生图 API 已开启时禁发文字图；若模型误输出，本区直接丢弃，避免双份视觉通道。
         3. 文字图复用 chat-text-image.js 的消息结构，不写 imageUrl，不触发视觉识别 token。
         ====================================================================== */
      if (textImageProtocolEnabled) {
        const textImageMessage = createAiTextImageMessageFromProtocol(block.content);
        if (textImageMessage) {
          builtMessages.push({
            ...textImageMessage,
            __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
            __protocolEndIndex: block.__protocolEndIndex
          });
        }
      }
      return;
    }

    if (block.type === '图片') {
      /* ======================================================================
         [区域标注·已完成·AI生图] 丢弃原始 [图片] 协议文本
         说明：
         1. 真正图片消息来自 prompt.js 返回的 generatedImages，并在 sendMessage 中转成 type:image。
         2. 这里不把 [图片] 协议内容显示为普通文本，避免聊天界面露出协议或生图提示词。
         3. 如果本轮只有 [图片] 协议，函数返回空数组，让 generatedImages 独立成为本轮消息。
         ====================================================================== */
      hasImageGenerationProtocol = true;
      return;
    }

    if (block.type === '转账') {
      const transferPayload = parseAiTransferProtocolPayload(block.content);
      if (transferPayload) {
        builtMessages.push({
          role: 'assistant',
          type: 'transfer',
          /* [区域标注·已完成·本次转账需求] AI 发起转账默认待用户处理 */
          transferDirection: 'incoming',
          transferStatus: 'pending',
          transferCounterpartyName: String(block.roleName || '').trim(),
          ...transferPayload,
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
          __protocolEndIndex: block.__protocolEndIndex
        });
      }
      /* [区域标注·已完成·角色主动转账协议容错] 转账协议格式不合法时直接丢弃，避免残缺协议原样露出 */
      return;
    }

    if (block.type === '礼物') {
      /* ======================================================================
         [区域标注·已完成·AI主动送礼物协议解析]
         说明：
         1. AI 输出 [礼物] 时转为 type:gift 结构化消息，复用现有礼物卡片渲染。
         2. 礼物标题与小字备注由 chat-gift.js 解析；消息持久化仍只走 DB.js / IndexedDB。
         3. 协议格式不合法时直接丢弃，避免残缺 [礼物] 协议露出为普通文本。
         ====================================================================== */
      const giftMessage = createAiGiftMessageFromProtocol(block);
      if (giftMessage) {
        builtMessages.push({
          ...giftMessage,
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
          __protocolEndIndex: block.__protocolEndIndex
        });
      }
      return;
    }

    if (block.type === '引用') {
      /* ======================================================================
         [区域标注·已完成·本次引用回复合并修复] AI [引用] + [回复] 协议合并解析
         说明：
         1. 当 AI 先输出 [引用]，再紧跟 [回复] 时，前端会直接合并成同一条带 quote 的引用回复气泡。
         2. 若 [引用] 自身已带正文，则优先使用 [引用] 内正文；否则自动吞并下一条 [回复] 的正文，避免拆成两个气泡。
         3. 仍兼容 `{引用ID:xxx}` 标准协议与“引用了某人：原文”宽松掉格式文本。
         ====================================================================== */
      const quoteMatch = String(block.content || '').match(/^\s*\{\s*引用\s*ID\s*[：:]\s*([^}；;，,\s]+)\s*\}\s*([\s\S]*)$/i);
      const looseQuote = quoteMatch ? null : parseLooseAiQuoteText(block.content, block.roleName);
      const quotePayload = quoteMatch
        ? resolveAiQuotePayloadById(state, quoteMatch[1])
        : (looseQuote ? resolveAiQuotePayloadByLooseText(state, looseQuote.quoteText, looseQuote.senderName) : null);

      let replyText = cleanAiVisibleBubbleText(quoteMatch ? quoteMatch[2] : (looseQuote ? looseQuote.replyText : block.content));

      if (!replyText) {
        const nextBlock = protocolBlocks[blockIndex + 1];
        if (nextBlock?.type === '回复') {
          const nextReplyText = cleanAiVisibleBubbleText(nextBlock.content);
          if (nextReplyText) {
            replyText = nextReplyText;
            skippedProtocolIndexes.add(Number(nextBlock?.__protocolIndex ?? (blockIndex + 1)));
          }
        }
      }

      const replyParts = splitStrictSentenceBubbles(replyText);

      if (quotePayload && !replyParts.length) {
        builtMessages.push({
          role: 'assistant',
          content: '',
          quote: quotePayload,
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length),
          __protocolEndIndex: block.__protocolEndIndex
        });
        return;
      }

      replyParts.forEach((content, replyIndex) => {
        builtMessages.push({
          role: 'assistant',
          content,
          ...(quotePayload ? { quote: quotePayload } : {}),
          __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length) + replyIndex / 1000,
          __protocolEndIndex: block.__protocolEndIndex
        });
      });
      return;
    }

    /* ========================================================================
       [区域标注·已完成·HTML卡片开关关闭时阻断卡片协议落库]
       说明：
       1. [卡片] 协议不走普通文本消息入列。
       2. 只有 htmlCardEnabled=true 时，才会在下方 htmlCardBlocks 分支转成 type:card。
       3. 开关关闭时即使模型误输出 [卡片]，这里也会直接跳过，避免 HTML 卡片继续渲染。
       ======================================================================== */
    if (block.type === '卡片') return;

    splitStrictSentenceBubbles(cleanAiVisibleBubbleText(block.content)).forEach((content, replyIndex) => {
      builtMessages.push({
        role: 'assistant',
        content,
        __protocolOrder: getAiRuntimeProtocolOrder(block, builtMessages.length) + replyIndex / 1000,
        __protocolEndIndex: block.__protocolEndIndex
      });
    });
  });

  if (htmlCardBlocks.length) {
    hasHtmlCardProtocol = true;
    htmlCardBlocks.forEach((block, index) => {
      const safeHtml = String(block?.html || '').trim();
      if (!safeHtml) return;
      builtMessages.push({
        role: 'assistant',
        type: 'card',
        content: `[HTML卡片] ${String(block?.roleName || '').trim() || '互动卡片'}`,
        cardRoleName: String(block?.roleName || '').trim(),
        cardTitle: `${String(block?.roleName || '').trim() || '互动'}的卡片`,
        cardHtml: safeHtml,
        cardOrder: index,
        /* ====================================================================
           [区域标注·已完成·AI图片与HTML卡片按协议原文顺序显示] HTML 卡片运行时顺序
           说明：protocolOrder 来自 chat-html-card.js 对 [卡片] 协议原文位置的解析；
                 仅用于本轮排序，写入 IndexedDB 前会统一剥离。
           ==================================================================== */
        __protocolOrder: Number(block?.protocolOrder ?? block?.startIndex ?? index) || 0,
        __protocolEndIndex: Number(block?.endIndex ?? block?.startIndex ?? index) || 0
      });
    });
  }

  if (!builtMessages.length && (hasImageGenerationProtocol || hasHtmlCardProtocol || detectedHtmlCardBlocks.length)) return [];

  return enforceAiReplyMessageCount(
    builtMessages.length
      ? sortAiMessagesByRuntimeProtocolOrder(builtMessages)
      : [{ role: 'assistant', content: '（AI 没有返回内容）' }],
    state.chatPromptSettings
  );
}


/* ==========================================================================
   [区域标注·已完成·AI识图图片消息发送] 图片消息入列与持久化
   说明：
   1. 图片来源仅来自聊天消息页咖啡功能区“图片”板块：本地 data URL 或用户输入 URL。
   2. 消息对象使用 type:image / imageUrl / imageName / imageSource，随 currentMessages 写入 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
const CHAT_IMAGE_MAX_SIDE = 768;
const CHAT_IMAGE_JPEG_QUALITY = 0.72;

function isLocalImageDataUrlForChat(value = '') {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(value || '').trim());
}

function formatApproxKb(value = '') {
  return `${Math.max(1, Math.round(String(value || '').length / 1024))}KB`;
}

async function compressLocalImageDataUrlForChat(dataUrl = {}) {
  const source = String(dataUrl || '').trim();
  if (!isLocalImageDataUrlForChat(source)) return source;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = source;
  });

  const sourceWidth = Number(image.naturalWidth || image.width || 0);
  const sourceHeight = Number(image.naturalHeight || image.height || 0);
  if (!sourceWidth || !sourceHeight) return source;

  const scale = Math.min(1, CHAT_IMAGE_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;

  /* [区域标注·本次修改·本地图片省token] 透明 PNG/WebP 转 JPEG 前铺浅色底，避免透明区域变黑；最长边限制为 768px。 */
  ctx.fillStyle = '#f8f4ef';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const compressed = canvas.toDataURL('image/jpeg', CHAT_IMAGE_JPEG_QUALITY);
  return compressed && compressed.length < source.length ? compressed : source;
}

export async function sendImageMessage(container, state, db, imageUrl, settingsManager, options = {}) {
  if (!state.currentChatId || state.isAiSending) return;

  let safeUrl = String(imageUrl || '').trim();
  if (!safeUrl) return;

  if (isLocalImageDataUrlForChat(safeUrl)) {
    const originalUrl = safeUrl;
    try {
      safeUrl = await compressLocalImageDataUrlForChat(safeUrl);
      if (safeUrl !== originalUrl) {
        appendChatConsoleRuntimeLog(state, 'info', `本地图片已压缩：${formatApproxKb(originalUrl)} → ${formatApproxKb(safeUrl)}`);
      }
    } catch (error) {
      appendChatConsoleRuntimeLog(state, 'warn', `本地图片压缩失败，保留原图：${error?.message || '未知错误'}`);
      safeUrl = originalUrl;
    }
  }

  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const imageName = String(options.imageName || '').trim() || (safeUrl.startsWith('data:image/') ? '本地图片' : '图片链接');
  const imageMessage = {
    id: `user_image_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'image',
    content: `[图片] ${imageName}`,
    imageUrl: safeUrl,
    imageName,
    imageSource: safeUrl.startsWith('data:image/') ? 'local' : 'url',
    timestamp: Date.now()
  };

  state.currentMessages.push(imageMessage);
  state.stickerPanelOpen = false;
  state.coffeeDockOpen = false;
  session.lastMessage = `[图片] ${imageName}`;
  session.lastTime = Date.now();

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  renderCurrentChatMessage(container, state);

  if (options.triggerAi === true) {
    await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  }
}


export async function sendStickerMessage(container, state, db, stickerId, settingsManager, options = {}) {
  if (!state.currentChatId || state.isAiSending) return;

  const data = normalizeStickerData(state.stickerData);
  const sticker = data.items.find(item => String(item.id) === String(stickerId));
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!sticker || !session) return;

  const stickerMessage = {
    id: `user_sticker_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'sticker',
    content: `[表情包] ${sticker.name}`,
    stickerId: sticker.id,
    stickerName: sticker.name,
    stickerUrl: sticker.url,
    timestamp: Date.now()
  };

  state.currentMessages.push(stickerMessage);
  state.stickerPanelOpen = false;
  state.coffeeDockOpen = false;
  session.lastMessage = `[表情包] ${sticker.name}`;
  session.lastTime = Date.now();

  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  /* ========================================================================
     [区域标注·已完成·本次表情包发送防闪屏修复] 表情包消息局部追加
     说明：
     1. 点选表情包后只增量追加当前表情包气泡，不再 renderCurrentChatMessage 整页重绘。
     2. 表情包面板与咖啡面板只同步 class 开关，避免发送瞬间闪屏。
     3. 消息与会话仍只写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  appendCurrentMessageBubble(container, state, stickerMessage);
  syncMessageDockOpenState(container, state);

  /* ========================================================================
     [区域标注·本次需求1] 发送表情包后禁止立即调用 API
     说明：
     1. 用户点选表情包只把表情包作为 user 消息入列并写入 IndexedDB。
     2. 只有纸飞机按钮或魔法棒等显式触发点传入 triggerAi:true 时，才允许调用 API。
     3. 不做双份存储兜底，不使用 localStorage/sessionStorage。
     ======================================================================== */
  if (options.triggerAi === true) {
    await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  }
}

/* ========================================================================== */
export function renderCurrentChatMessage(container, state, options = {}) {
  return renderCurrentChatMessageModule(container, state, options);
}

/* ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·旁白固定/穿插位置修复] 旧版当前轮旁白插入函数（兼容保留）
   说明：
   1. 本次修复后，旁白已在 AI 消息入列前通过 bindAsideSegmentsToAiMessages 绑定到消息对象。
   2. appendCurrentMessageBubble 会随消息一起渲染旁白，不再依赖“AI 全部回复结束后再插入旁白”的旧流程。
   3. 本函数仅为旧调用兼容保留；当前主流程不再调用它，避免旁白总落在最后一条 AI 消息附近。
   4. 不做任何持久化读写；持久化仍统一走 DB.js / IndexedDB。
   ========================================================================== */
function syncCurrentAsideBubble(container, asideText = '', messageId = '') {
  const text = String(asideText || '').trim();
  const safeMessageId = String(messageId || '').trim();
  if (!text || !safeMessageId) return false;

  const listArea = container.querySelector('[data-role="msg-list"]');
  const targetRow = listArea?.querySelector(`[data-message-id="${CSS.escape(safeMessageId)}"]`);
  if (!listArea || !targetRow) return false;

  const asideSelector = `.msg-aside-bubble[data-aside-id="${CSS.escape(safeMessageId)}"]`;
  const existingAside = listArea.querySelector(asideSelector);
  const asideHtml = renderAsideBubbleHtml(text, safeMessageId);

  if (existingAside) {
    existingAside.outerHTML = asideHtml;
  } else {
    targetRow.insertAdjacentHTML('beforebegin', asideHtml);
  }

  listArea.scrollTop = listArea.scrollHeight;
  return true;
}

export function appendCurrentMessageBubble(container, state, message) {
  return appendCurrentMessageBubbleModule(container, state, message);
}

/* ========================================================================== */
export function refreshMessageBubbleRows(container, state, messageIds = []) {
  return refreshMessageBubbleRowsModule(container, state, messageIds);
}


export function refreshCurrentMessageListOnly(container, state) {
  return refreshCurrentMessageListOnlyModule(container, state);
}


/* ==========================================================================
   [区域标注·已完成·本次拆分] 聊天消息页多选状态子模块 facade
   说明：
   1. 多选底栏计数、重置选中态、获取已选消息逻辑已拆分到 chat-message-selection.js。
   2. 本文件仅保留同名导出接线层，继续兼容 chat-event-handlers.js / chat-navigation.js / chat-state.js 等既有调用方。
   3. 只处理运行时状态，不新增任何持久化存储。
   ========================================================================== */
export function updateMultiSelectActionBar(container, state) {
  return updateMultiSelectActionBarModule(container, state);
}

/* ========================================================================== */
export function resetMessageSelectionState(state) {
  return resetMessageSelectionStateModule(state);
}


export function getSelectedMessages(state) {
  return getSelectedMessagesModule(state);
}


export function refreshCurrentSessionLastMessage(state) {
  return refreshCurrentSessionLastMessageModule(state);
}

/* ========================================================================== */
export async function retryLatestAiReply(container, state, db, settingsManager) {
  if (!state.currentChatId || state.isAiSending) return;

  for (let i = state.currentMessages.length - 1; i >= 0; i -= 1) {
    if (state.currentMessages[i]?.role === 'assistant') {
      state.currentMessages.splice(i, 1);
      continue;
    }
    break;
  }

  /* ===== 闲谈：用户最新一轮消息触发AI START =====
     说明：魔法棒重新回复使用“用户最新一轮消息”触发。
     sendMessage(skipAppendUser) 会基于 state.currentMessages 调用 buildPromptPayloadForLatestUserRound，
     自动把末尾连续 user 消息合并为“用户最新一轮消息”。 */
  const latestUserRound = [];
  for (let i = state.currentMessages.length - 1; i >= 0; i -= 1) {
    const item = state.currentMessages[i];
    if (item?.role !== 'user') break;
    if (String(item.content || '').trim()) latestUserRound.unshift(item);
  }
  if (!latestUserRound.length) {
    renderCurrentChatMessage(container, state);
    return;
  }

  /* ========================================================================
     [区域标注·已完成·魔法棒局部刷新防闪屏] 魔法棒重 roll 立即清空旧 AI 回复
     说明：
     1. 先删除最新一轮 AI 回复并立即写入 DB.js / IndexedDB。
     2. 只刷新消息列表区域，不重建整个聊天消息页壳子，避免点击魔法棒闪屏。
     3. 再调用 API 重新生成最新一轮回复，不保留旧 AI 气泡到返回列表后才消失。
     ======================================================================== */
  refreshCurrentSessionLastMessage(state);
  await Promise.all([
    persistCurrentMessages(state, db),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);
  refreshCurrentMessageListOnly(container, state);
  await sendMessage(container, state, db, '', settingsManager, { skipAppendUser: true, triggerAi: true });
  /* ===== 闲谈：用户最新一轮消息触发AI END ===== */
}


/* ===== 闲谈：用户最新一轮消息触发AI START ===== */
export function buildPromptPayloadForLatestUserRound(messages = [], shortTermMemoryRounds = 8) {
  const normalized = Array.isArray(messages)
    ? messages.filter(item => item && (item.role === 'user' || item.role === 'assistant') && String(item.content || '').trim())
    : [];

  let latestUserStart = -1;
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (normalized[i].role !== 'user') continue;
    latestUserStart = i;
    while (latestUserStart > 0 && normalized[latestUserStart - 1]?.role === 'user') {
      latestUserStart -= 1;
    }
    break;
  }

  /* 用户最新一轮消息 = 消息末尾往前连续的 user 消息组，而不是最后一条 user 消息 */
  let currentRoundMessages = latestUserStart >= 0 ? normalized.slice(latestUserStart).filter(item => item.role === 'user') : [];
  /* ========================================================================
     [区域标注·已完成·用户消息撤回] 最近撤回事件并入下一轮 AI 请求
     说明：
     1. 用户可能撤回较早位置的气泡，但撤回行为发生在当前时刻；下一轮 AI 仍必须收到这条撤回提示。
     2. withdrawnAt / timestamp 晚于最近 AI 消息的 user_withdraw_system 会并入 currentRoundMessages。
     3. 这里只组装请求上下文，不新增存储；消息对象仍随 currentMessages 写入 DB.js / IndexedDB。
     ======================================================================== */
  const latestAssistantTimestamp = normalized
    .filter(item => item.role === 'assistant')
    .reduce((max, item) => Math.max(max, Number(item?.timestamp || 0) || 0), 0);
  const currentRoundIdSet = new Set(currentRoundMessages.map(item => String(item?.id || '')).filter(Boolean));
  const recentWithdrawMessages = normalized
    .filter(item => (
      String(item?.type || '') === 'user_withdraw_system'
      && !currentRoundIdSet.has(String(item?.id || ''))
      && (Number(item?.withdrawnAt || item?.timestamp || 0) || 0) > latestAssistantTimestamp
    ));
  if (recentWithdrawMessages.length) {
    currentRoundMessages = [...currentRoundMessages, ...recentWithdrawMessages]
      .sort((a, b) => (Number(a?.timestamp || a?.withdrawnAt || 0) || 0) - (Number(b?.timestamp || b?.withdrawnAt || 0) || 0));
  }
  const latestUserMessage = [...currentRoundMessages].reverse().find(item => Number(item?.timestamp || 0) > 0)
    || [...normalized].reverse().find(item => item.role === 'user' && Number(item?.timestamp || 0) > 0)
    || null;
  const latestAnyMessage = [...normalized].reverse().find(item => Number(item?.timestamp || 0) > 0) || null;
  /* ========================================================================
     [AI撤回时间感知增强] 撤回系统小字发送给 AI 的文本规则
     说明：
     1. user_withdraw_system 必须把系统提示小字自身的发送时间传给 AI，避免 AI 把早上的撤回提示误认成当前刚发生。
     2. withdrawnVisibleToAi=false：只提示对方在指定时间撤回且你看不见原文，引导 AI 结合本轮 API 实际请求时间判断“刚才/之前”。
     3. withdrawnVisibleToAi=true：提示对方在指定时间撤回且你看得见原文，并附撤回原文；禁止默认使用“刚才/刚刚”。
     4. 该字段随 currentMessages 写入 DB.js / IndexedDB；本区只做请求上下文组装，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const formatWithdrawSystemTipTimeForAi = (timestamp) => {
    const value = Number(timestamp || 0) || 0;
    if (!value) return '未知时间';
    const date = new Date(value);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const getAiVisibleContentForMessage = (item = {}, options = {}) => {
    if (String(item?.type || '') === 'user_withdraw_system') {
      const systemTipTime = formatWithdrawSystemTipTimeForAi(item.withdrawnAt || item.timestamp);
      const timeAwareInstruction = `【系统提示小字发送时间：${systemTipTime}】当前对话对象在上述时间撤回了一条消息。请务必把这个时间当作撤回系统提示小字发生的时间，并结合“本轮 API 实际请求时间”判断间隔；如果已经过去较久，不要说“刚才/刚刚撤回”，应改用“之前撤回的消息”等符合时间差的表达。`;
      const base = `${timeAwareInstruction}\n你看不见撤回原文。可用一句自然互动回应，例如“您之前撤回的消息我看到了，撤回了什么呀？”`;
      if (!item.withdrawnVisibleToAi) return base;
      const withdrawnText = String(item.withdrawnContent || '').trim();
      return withdrawnText ? `${timeAwareInstruction}\n你看得见撤回原文。若间隔较久，可用一句自然互动回应，例如“您之前撤回的消息我看到了”。\n撤回的消息内容：${withdrawnText}` : base;
    }
    if (String(item?.type || '') === 'gift') {
      /* ======================================================================
         [区域标注·已完成·礼物消息AI上下文摘要化]
         说明：
         1. 礼物代付请求在“当前轮用户消息”中保留完整请求文案，确保 AI 能理解是否代付。
         2. 礼物消息进入历史上下文后仅发送短摘要，避免重复携带长文造成 token 浪费。
         3. 仅处理 type=gift，不影响其它消息类型。
         ====================================================================== */
      const isHistorySummary = Boolean(options.historySummary);
      const giftRequestType = String(item?.giftRequestType || '').trim();
      if (isHistorySummary) {
        const title = String(item?.giftTitle || '礼物').trim();
        const priceLabel = String(item?.giftDisplayPrice || '').trim();
        const prefix = giftRequestType === 'pay_request' ? '[礼物代付请求]' : '[礼物]';
        return `${prefix} ${title}${priceLabel ? ` · ${priceLabel}` : ''}`;
      }
      return String(item?.giftAiPromptText || item?.content || '').trim();
    }
    return String(item.content || '').trim();
  };

  const userInput = currentRoundMessages.map((item, index) => {
    const content = getAiVisibleContentForMessage(item, { historySummary: false });
    return currentRoundMessages.length > 1 ? `第${index + 1}条：${content}` : content;
  }).join('\n');

  const roundLimit = Math.max(0, Math.floor(Number(shortTermMemoryRounds)) || 0);
  const currentRoundMessageIds = new Set(currentRoundMessages.map(item => String(item?.id || '')).filter(Boolean));
  const previous = (latestUserStart >= 0 ? normalized.slice(0, latestUserStart) : normalized)
    .filter(item => !currentRoundMessageIds.has(String(item?.id || '')));

  /* ========================================================================
     [区域标注·已完成·需求1·控制台轮次统计元数据]
     说明：
     1. conversationRoundIndex 按“连续 user 消息组 = 1 轮”统计当前会话总用户轮次，用于控制台显示真正聊到第几轮。
     2. currentRoundMessageCount 仅表示本轮用户连续发送的消息条数，以及被并入本轮的撤回系统提示条数。
     3. 本区域只返回运行时日志元数据，不新增持久化存储，不改变 history/currentUserRoundMessages 的 AI 请求内容。
     ======================================================================== */
  const countUserConversationRounds = (items = []) => {
    let count = 0;
    let previousRole = '';
    (Array.isArray(items) ? items : []).forEach(item => {
      if (item?.role === 'user' && previousRole !== 'user') count += 1;
      previousRole = String(item?.role || '');
    });
    return count;
  };
  const conversationRoundIndex = countUserConversationRounds(normalized);
  const currentRoundMessageCount = currentRoundMessages.length;

  /* ========================================================================
     [区域标注·已完成·本次时间断层强化] 时间感知运行时上下文
     说明：
     1. 即使短期记忆轮数为 0，也继续把必要时间戳随本次 API 请求传给 prompt.js，不额外持久化。
     2. currentUserRound* 表示用户本轮实际回复时间；previousLatest* 表示排除本轮用户消息后的上一段聊天时间。
     3. previousLatestAssistantTimestamp 专门用于判断“上一轮 AI 凌晨回复 → 用户早上才回”的真实跨度，避免 AI 继续停留在凌晨语境劝睡。
     4. 本区只做运行时计算，不使用 localStorage/sessionStorage，不写双份存储兜底。
     ======================================================================== */
  const previousLatestAnyMessage = [...previous].reverse().find(item => Number(item?.timestamp || 0) > 0) || null;
  const previousLatestUserMessage = [...previous].reverse().find(item => item.role === 'user' && Number(item?.timestamp || 0) > 0) || null;
  const previousLatestAssistantMessage = [...previous].reverse().find(item => item.role === 'assistant' && Number(item?.timestamp || 0) > 0) || null;
  const currentRoundTimestamps = currentRoundMessages
    .map(item => Number(item?.timestamp || 0) || 0)
    .filter(Boolean);
  const conversationTimeContext = {
    latestUserTimestamp: Number(latestUserMessage?.timestamp || 0) || 0,
    latestAnyTimestamp: Number(latestAnyMessage?.timestamp || 0) || 0,
    currentUserRoundFirstTimestamp: currentRoundTimestamps.length ? Math.min(...currentRoundTimestamps) : 0,
    currentUserRoundLastTimestamp: currentRoundTimestamps.length ? Math.max(...currentRoundTimestamps) : 0,
    previousLatestAnyTimestamp: Number(previousLatestAnyMessage?.timestamp || 0) || 0,
    previousLatestUserTimestamp: Number(previousLatestUserMessage?.timestamp || 0) || 0,
    previousLatestAssistantTimestamp: Number(previousLatestAssistantMessage?.timestamp || 0) || 0
  };
  const currentUserRoundMessages = currentRoundMessages.map(item => ({
    /* ======================================================================
       [区域标注·已完成·AI引用回复] 当前轮用户消息可引用 ID
       说明：把消息 id 传给 prompt.js，AI 可用 [引用] 协议引用用户最新一轮消息；不新增存储。
       ====================================================================== */
    id: item.id || '',
    role: item.role,
      content: getAiVisibleContentForMessage(item, { historySummary: false }),
    quote: item.quote || null,
    type: item.type || '',
    stickerUrl: item.stickerUrl || '',
    stickerName: item.stickerName || '',
    imageUrl: item.imageUrl || '',
    imageName: item.imageName || '',
    timestamp: Number(item.timestamp || 0) || 0
  }));

  if (roundLimit <= 0) {
    return {
      userInput,
      history: [],
      currentUserRoundMessages,
      conversationTimeContext,
      /* [区域标注·已完成·需求1·短期记忆为0时日志元数据] 仅供控制台展示，不影响 AI 请求历史内容。 */
      conversationRoundIndex,
      currentRoundMessageCount,
      historyRoundCount: 0,
      historyMessageCount: 0
    };
  }

  const toHistoryPromptItem = (item = {}) => ({
    /* ======================================================================
       [区域标注·已完成·AI引用回复] 历史消息可引用 ID
       说明：把消息 id 传给 prompt.js，AI 可用 [引用] 协议引用短期记忆范围内的消息；不新增存储。
       ====================================================================== */
    id: item.id || '',
    role: item.role,
    content: getAiVisibleContentForMessage(item, { historySummary: true }),
    quote: item.quote || null,
    type: item.type || '',
    stickerUrl: item.stickerUrl || '',
    stickerName: item.stickerName || '',
    imageUrl: item.imageUrl || '',
    imageName: item.imageName || '',
    /* [区域标注·已修改] 历史消息保留发送时间，供时间感知把“昨天/明天/后天”等相对时间锚定到原消息时间。 */
    timestamp: Number(item.timestamp || 0) || 0
  });

  /* ========================================================================
     [区域标注·已完成·本次短期记忆按轮截取修复] 历史消息按真实对话轮分组
     说明：
     1. 一轮 = 连续用户消息组 + 随后 AI 返回消息组；用户连续发多条不拆轮，AI 多气泡回复也不拆轮。
     2. 短期记忆设置 shortTermMemoryRounds 表示“历史轮数”，不是“历史消息条数”。
     3. 这里先按轮选择最近 N 轮，再展开为 prompt.js/API 需要的扁平 messages 数组。
     4. 本区只处理运行时请求上下文，不新增持久化存储，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const rounds = [];
  let current = [];
  let currentHasAssistantMessages = false;

  previous.forEach(item => {
    if (item.role === 'user' && current.length && currentHasAssistantMessages) {
      rounds.push(current);
      current = [];
      currentHasAssistantMessages = false;
    }

    current.push(toHistoryPromptItem(item));

    if (item.role === 'assistant') {
      currentHasAssistantMessages = true;
    }
  });
  if (current.length) rounds.push(current);

  /* ========================================================================
     [区域标注·已完成·本次短期记忆按轮截取修复] 短期记忆日志统计
     说明：
     1. selectedHistoryRounds 是本次短期记忆实际携带的历史轮次数组，historyRoundCount 按“轮”统计。
     2. historyMessageCount 按最终展开后的 history 消息条数统计，仅用于排查 token 与气泡拆分数量。
     3. 发送给 AI 时仍是扁平 messages 数组，但截取边界已按“最近 N 轮历史”计算，不再按 N 条消息卡掉早期轮次。
     ======================================================================== */
  const selectedHistoryRounds = rounds.slice(-roundLimit);
  const selectedHistoryMessages = selectedHistoryRounds.flat();

  return {
    userInput,
    history: selectedHistoryMessages,
    currentUserRoundMessages,
    conversationTimeContext,
    conversationRoundIndex,
    currentRoundMessageCount,
    historyRoundCount: selectedHistoryRounds.length,
    historyMessageCount: selectedHistoryMessages.length
  };
}


export function splitAiReplyIntoBubbles(text, chatSettings = {}) {
  const raw = sanitizeAiVisibleReply(text);
  if (!raw) return ['（AI 没有返回内容）'];

  const { min, max } = getReplyBubbleCountRange(chatSettings);

  /* ==========================================================================
     [区域标注·已完成·本次需求2] 通用消息协议拆分与自然断句
     说明：
     1. 只识别 prompt.js 的 **`[回复] 角色名：文字消息内容`** 通用协议。
     2. 不强制给句末补标点；保留 AI 原有口语化短句（含无句号结尾）以避免“每句都带标点”。
     3. 拆分优先使用协议块与自然断句，再叠加最少/最多气泡数收口，避免设置页规则只停留在 prompt 层。
  /* ========================================================================== */
  const protocolReplyMatches = extractProtocolReplyContents(raw);

  let parts = protocolReplyMatches.length
    ? protocolReplyMatches
    : raw
        .split(/\n{2,}|(?:\s*<bubble>\s*)|(?:\s*<\/bubble>\s*)|(?:\s*\|\|\|\s*)|(?:\s*---气泡---\s*)/i)
        .map(item => item.trim())
        .filter(Boolean);

  parts = parts
    .map(part => cleanAiVisibleBubbleText(part))
    .filter(Boolean)
    .flatMap(part => splitStrictSentenceBubbles(part));

  if (parts.length <= 1 && raw.length > 28) {
    parts = raw
      .split(/(?<=[，,、；;])\s*/)
      .map(item => cleanAiVisibleBubbleText(item))
      .filter(Boolean);
  }

  while (parts.length < min) {
    let bestIndex = -1;
    let bestParts = [];
    let bestLength = 0;

    parts.forEach((item, index) => {
      const candidateParts = splitSingleBubbleForCount(item);
      if (candidateParts.length <= 1) return;
      if (String(item || '').length > bestLength) {
        bestIndex = index;
        bestParts = candidateParts;
        bestLength = String(item || '').length;
      }
    });

    if (bestIndex < 0 || bestParts.length <= 1) break;
    parts.splice(bestIndex, 1, ...bestParts);
  }

  const cleaned = parts.map(item => cleanAiVisibleBubbleText(item)).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, max) : ['（AI 没有返回内容）'];
}

/* ========================================================================== */
export function sanitizeAiVisibleReply(text) {
  let value = cleanAiVisibleBubbleText(text);

  /* ===== 闲谈：通用消息协议解析 START ===== */
  const protocolReplyMatches = extractProtocolReplyContents(value);
  if (protocolReplyMatches.length) {
    value = protocolReplyMatches
      .map(item => cleanAiVisibleBubbleText(item))
      .filter(Boolean)
      .join('\n');
  }
  /* ===== 闲谈：通用消息协议解析 END ===== */

  return value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}


function mergeAiPunctuationOnlyBubbleFragments(parts = []) {
  /* ========================================================================
     [区域标注·已完成·普通气泡引号保留与省略号残片合并] 省略号残片合并
     说明：
     1. 修复 AI 输出连续点号/省略号后，又残留单独 "." / "。" / "…" 时被拆成独立气泡的问题。
     2. 只合并“纯标点残片”，不合并正常文字句子，不改变多句回复的原有拆泡逻辑。
     3. 本区域只处理前端运行时解析；不读写 localStorage/sessionStorage，不做双份存储兜底。
     ======================================================================== */
  const merged = [];
  (Array.isArray(parts) ? parts : []).forEach(part => {
    const value = String(part || '').trim();
    if (!value) return;

    if (merged.length && /^[.。…]+$/.test(value)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}${value}`;
      return;
    }

    merged.push(value);
  });
  return merged;
}

export function splitStrictSentenceBubbles(text) {
  const normalized = stripAiProtocolClosingTags(String(text || ''))
    /* ===== 闲谈：通用消息协议解析 START ===== */
    .replace(/\*\*`?\s*\[回复\]\s*[^：:\n`]+?\s*[：:]\s*/g, '')
    .replace(/`?\*\*/g, '')
    /* ===== 闲谈：通用消息协议解析 END ===== */
    .replace(/\r\n/g, '\n')
    .trim();

  if (!normalized) return [];

  /* ========================================================================
     [区域标注·已完成·本次句末标点非强制] 仅按自然分隔切气泡
     说明：
     1. 这里仅基于已有换行和已有终止标点做分句，不给文本追加任何句末标点。
     2. 若 AI 输出是无句号口语短句（如“行 我马上来”“哈哈哈”），保持原样，不做“补句号”。
     3. 已补充省略号/连续点号后的纯标点残片合并，避免一个 "." 被拆成独立消息气泡。
     ======================================================================== */
  return mergeAiPunctuationOnlyBubbleFragments(
    normalized
      .replace(/([。！？!?]+)(?:\s+|(?=\S))/g, '$1\n')
      .replace(/([…]{2,}|[.。]{3,}|、、、)(?:\s+|(?=\S))/g, '$1\n')
      .split(/\n+/)
      .map(item => item.trim())
      .filter(Boolean)
  );
}

/* ===== 闲谈：用户最新一轮消息触发AI END ===== */

/* ===== 闲谈应用：AI回复拆分为多个气泡 START ===== */
/* ===== 闲谈：通用消息协议解析 START ===== */
export function extractProtocolReplyContents(text) {
  /*
   * ========================================================================
   * [区域标注·本次需求2] 通用消息协议强力约束入口
   * 说明：
   * 1. 统一复用 extractAiProtocolBlocks，不再维护两套容易分叉的协议正则。
   * 2. 只取 [回复] 内容，保证“回复文字消息”不再把协议头原样显示到聊天界面。
   * 3. 这里只负责解析可见文本，不做任何持久化存储。
   * ======================================================================== */
  return extractAiProtocolBlocks(text)
    .filter(block => block.type === '回复')
    .map(block => String(block.content || '').trim())
    .filter(Boolean);
}

/* ===== 闲谈：通用消息协议解析 END ===== */

export function getReplyBubbleCountRange(chatSettings = {}) {
  const min = Math.max(1, Math.floor(Number(chatSettings.replyBubbleMin || 1)) || 1);
  const max = Math.max(min, Math.floor(Number(chatSettings.replyBubbleMax || min)) || min);
  return { min, max };
}

/* ========================================================================== */
export function cleanAiVisibleBubbleText(text) {
  return stripAiProtocolClosingTags(String(text || ''))
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    /* ======================================================================
       [区域标注·已更新·本次消息掉格式修复] 清理裸露通用协议残片（覆盖漏角色名场景）
       说明：
       1. 兼容清理 `[回复] 内容` / `[表情] 内容` / `[引用]{引用ID:...}内容` 等漏写角色名的协议残片。
       2. 兼容清理 `[回复] 角色名 内容`（漏冒号）等前缀噪音，避免协议头残留进聊天气泡。
       3. 新增清理“{user_xxx...}正文”这类掉格式前缀，避免角色占位串直接显示在消息气泡。
       ====================================================================== */
    .replace(/^\s*(?:以下是)?(?:修正后内容|最终输出|回复格式|检查结果|修正结果|正确格式)\s*[：:]\s*/i, '')
    .replace(/^\s*(?:\*\*)?\s*`?\s*\[\s*(?:回复|表情|引用|礼物|转账|撤回|语音|文字图|图片)\s*\]\s*(?:[^：:\n`*]{1,40}\s*[：:]\s*)?/i, '')
    .replace(/^\s*\{(?:user|assistant|role|character|mask)_[^}\n]{3,120}\}\s*/i, '')
    .replace(/(?:`|\*\*)+/g, '')
    .replace(/\[\s*消息发送时间\s*[：:][\s\S]*?\]/gi, ' ')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^(思考回复内容|思考内容|检查规则|审查规则|拟定句子|检查结果|最终输出|回复格式|本轮 API 实际请求时间|最近一条已记录的用户消息发送时间|最近一条聊天记录时间|从最近一条用户消息到本轮实际请求已经过去|距上次聊天记录已经过去)\s*[：:]/.test(line))
    .map(line => line.replace(/^(?:第\s*\d+\s*条|气泡\s*\d+|[0-9]+[.)、])\s*/i, '').trim())
    .filter(line => !/^\d{4}年\d{1,2}月\d{1,2}日(?:星期[一二三四五六日天])?\s+\d{1,2}:\d{2}(?::\d{2})?\]$/.test(line))
    .filter(Boolean)
    .join('\n')
    /* ======================================================================
       [区域标注·已完成·普通气泡引号保留与省略号残片合并] 可见正文引号保护
       说明：
       1. 不再删除气泡正文首尾引号，避免中文前引号、英文引号被前端清洗误删。
       2. 协议头、闭合标签、Markdown 包裹符仍在上方清理；这里保留用户实际看到的正文标点。
       3. 本区域不涉及任何持久化存储，不使用 localStorage/sessionStorage。
       ====================================================================== */
    .trim();
}


export function splitSingleBubbleForCount(text) {
  const value = cleanAiVisibleBubbleText(text);
  if (!value) return [];

  const sentenceParts = splitStrictSentenceBubbles(value);
  if (sentenceParts.length > 1) return sentenceParts;

  const commaParts = value
    .split(/(?<=[，,、；;])\s*/)
    .map(item => item.trim())
    .filter(Boolean);
  if (commaParts.length > 1) return commaParts;

  const spaceParts = value
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);
  if (spaceParts.length > 1) return spaceParts;

  if (value.length <= 1) return [value];

  const splitAt = Math.max(1, Math.ceil(value.length / 2));
  return [
    value.slice(0, splitAt).trim(),
    value.slice(splitAt).trim()
  ].filter(Boolean);
}


export function enforceAiReplyMessageCount(messages, chatSettings = {}) {
  const { min, max } = getReplyBubbleCountRange(chatSettings);
  let normalizedMessages = Array.isArray(messages)
    ? messages
        .map(message => {
          if (!message) return null;
          /* ==================================================================
             [区域标注·已完成·AI本轮撤回逐条系统提示保留]
             说明：ai_withdraw_system 是撤回后给用户/后续 AI 看的中间系统小字，不参与 AI 气泡数量裁剪，也不能因为 role:user 被过滤。
             ================================================================== */
          if (String(message.type || '') === 'ai_withdraw_system') return message;
          if (message.role !== 'assistant') return null;
          if (String(message.type || '') === 'sticker' && String(message.stickerUrl || '').trim()) {
            return message;
          }
          if (isTextImageMessage(message)) {
            return message;
          }
          if (isVoiceMessage(message)) {
            return message;
          }
          if (String(message.type || '') === 'transfer') {
            return message;
          }
          if (String(message.type || '') === 'gift') {
            return message;
          }
          if (String(message.type || '') === 'card' && String(message.cardHtml || message.content || '').trim()) {
            return message;
          }
          const content = cleanAiVisibleBubbleText(message.content);
          if (!content && message.quote && String(message.quote.text || '').trim()) {
            return { ...message, content: '' };
          }
          return content ? { ...message, content } : null;
        })
        .filter(Boolean)
    : [];

  while (normalizedMessages.length < min) {
    let bestIndex = -1;
    let bestParts = [];
    let bestLength = 0;

    normalizedMessages.forEach((message, index) => {
      if (String(message.type || '') === 'sticker' || String(message.type || '') === 'ai_withdraw_system' || isTextImageMessage(message) || isVoiceMessage(message) || String(message.type || '') === 'card' || String(message.type || '') === 'transfer' || String(message.type || '') === 'gift') return;
      const parts = splitSingleBubbleForCount(message.content);
      if (parts.length <= 1) return;
      const currentLength = String(message.content || '').length;
      if (currentLength > bestLength) {
        bestIndex = index;
        bestParts = parts;
        bestLength = currentLength;
      }
    });

    if (bestIndex < 0 || bestParts.length <= 1) break;

    const baseMessage = normalizedMessages[bestIndex];
    normalizedMessages.splice(
      bestIndex,
      1,
      ...bestParts.map(content => ({
        ...baseMessage,
        content
      }))
    );
  }

  const countableMessages = normalizedMessages.filter(message => String(message.type || '') !== 'ai_withdraw_system');
  if (countableMessages.length > max) {
    let keptCountable = 0;
    normalizedMessages = normalizedMessages.filter(message => {
      if (String(message.type || '') === 'ai_withdraw_system') return true;
      keptCountable += 1;
      return keptCountable <= max;
    });
  }

  return normalizedMessages.length
    ? normalizedMessages
    : [{ role: 'assistant', content: '（AI 没有返回内容）' }];
}

/* ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·本次引用防闪屏修复] 输入栏引用预览局部同步
   说明：
   1. 点击“引用”或“取消引用”时只更新底栏引用框，不再重绘整个聊天消息页。
   2. 用户发送后会立即清除 DOM 中的引用框，避免 quote 已发送但底栏残留。
   3. 仅使用运行时 state.pendingQuote；持久化仍只随消息对象 quote 字段写入 DB.js / IndexedDB。
   ========================================================================== */
export function syncPendingQuoteComposer(container, state) {
  return syncPendingQuoteComposerModule(container, state);
}


export function updateCurrentChatSendingUi(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (!msgWrap) return;

  const statusEl = msgWrap.querySelector('.msg-top-bar__status');
  if (statusEl) statusEl.textContent = state.isAiSending ? '正在回复...' : '在线';

  msgWrap.querySelectorAll('[data-role="msg-input"], [data-action="msg-magic"], [data-action="msg-send"]').forEach(el => {
    el.toggleAttribute('disabled', Boolean(state.isAiSending));
  });
}

/* ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·本次控制台持久显示与防闪屏修复] 控制台抽屉局部渲染工具
   说明：
   1. 与完整 renderChatMessage 复用同一 HTML 结构，保证主题 UI 风格一致。
   2. 开关关闭只移除抽屉 DOM，不清空 state.chatConsoleLogs；日志继续后台记录。
   3. 展开/关闭、筛选、清空日志时仅替换抽屉区域，避免聊天页整页重绘闪屏。
   ========================================================================== */
function getVisibleChatConsoleLogs(chatConsoleLogs = [], warnErrorOnly = false) {
  return getVisibleChatConsoleLogsModule(chatConsoleLogs, warnErrorOnly);
}

function renderChatConsoleDockHtml(options = {}) {
  return renderChatConsoleDockHtmlModule(options);
}

export function syncChatMessageSearchPanel(container, state) {
  return syncChatMessageSearchPanelModule(container, state);
}

export function scrollToChatSearchResult(container, messageId = '') {
  return scrollToChatSearchResultModule(container, messageId);
}

/* ========================================================================== */
export function syncChatConsoleDock(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const shell = msgWrap?.querySelector('.msg-input-shell');
  if (!shell) return false;

  const existingDock = shell.querySelector('[data-role="msg-console-dock"]');
  const visibleLogs = getVisibleChatConsoleLogs(state.chatConsoleLogs, state.chatConsoleWarnErrorOnly);
  const nextHtml = renderChatConsoleDockHtml({
    chatConsoleEnabled: state.chatConsoleEnabled,
    chatConsoleExpanded: state.chatConsoleExpanded,
    chatConsoleWarnErrorOnly: state.chatConsoleWarnErrorOnly,
    visibleConsoleLogs: visibleLogs
  });

  if (!nextHtml) {
    existingDock?.remove();
    return true;
  }

  if (existingDock) {
    existingDock.outerHTML = nextHtml;
    return true;
  }

  const inputBar = shell.querySelector('.msg-input-bar');
  if (!inputBar) return false;
  inputBar.insertAdjacentHTML('beforebegin', nextHtml);
  return true;
}

/* ========================================================================== */
export function syncMessageDockOpenState(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  if (!msgWrap) return;

  const coffeeDock = msgWrap.querySelector('[data-role="msg-feature-dock"]');
  const stickerPanel = msgWrap.querySelector('[data-role="msg-sticker-panel"]');
  const coffeeBtn = msgWrap.querySelector('[data-action="msg-coffee"]');
  const stickerBtn = msgWrap.querySelector('[data-action="msg-sticker"]');

  if (coffeeDock) coffeeDock.classList.toggle('is-open', Boolean(state.coffeeDockOpen));
  if (stickerPanel) stickerPanel.classList.toggle('is-open', Boolean(state.stickerPanelOpen));
  if (coffeeBtn) coffeeBtn.classList.toggle('is-active', Boolean(state.coffeeDockOpen));
  if (stickerBtn) stickerBtn.classList.toggle('is-active', Boolean(state.stickerPanelOpen));
}


export function renderMsgStickerPanelGrid(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const panel = msgWrap?.querySelector('[data-role="msg-sticker-panel"]');
  const grid = panel?.querySelector('.msg-sticker-panel__grid');
  if (!grid) {
    renderCurrentChatMessage(container, state, { keepScroll: true });
    return;
  }

  const data = normalizeStickerData(state.stickerData);
  const groupId = String(state.stickerPanelGroupId || 'all');
  const visibleItems = groupId === 'all'
    ? data.items
    : data.items.filter(item => String(item.groupId || 'all') === groupId);

  panel.querySelectorAll('.msg-sticker-panel__group-btn').forEach(btn => {
    btn.classList.toggle('is-active', String(btn.dataset.stickerGroupId || 'all') === groupId);
  });

  grid.innerHTML = visibleItems.length
    ? visibleItems.map(item => `
        <!-- ===== 闲谈聊天底栏防闪屏：局部刷新表情包项 START ===== -->
        <button class="msg-sticker-panel__item"
                data-action="send-msg-sticker"
                data-sticker-id="${escapeHtml(item.id)}"
                type="button"
                title="${escapeHtml(item.name)}">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
          <span>${escapeHtml(item.name)}</span>
        </button>
        <!-- ===== 闲谈聊天底栏防闪屏：局部刷新表情包项 END ===== -->
      `).join('')
    : `<div class="msg-sticker-panel__empty">当前分组暂无表情包</div>`;
}

/* ========================================================================== */
export function syncMountedStickerGroupButtons(container, state) {
  const selectedSet = new Set(
    Array.isArray(state.chatPromptSettings?.mountedStickerGroupIds)
      ? state.chatPromptSettings.mountedStickerGroupIds.map(String)
      : []
  );

  container.querySelectorAll('[data-action="toggle-mounted-sticker-group"]').forEach(btn => {
    btn.classList.toggle('is-active', selectedSet.has(String(btn.dataset.stickerGroupId || '')));
  });
}

/* ========================================================================== */
/* ==========================================================================
   [区域标注·已完成·本次拆分] 聊天消息页弹窗 facade 导出层
   说明：
   1. 原 chat-message.js 尾部的图片、转账、头像、撤回、编辑、收藏、转发等弹窗实现，
      已迁移到 chat-message-modals.js。
   2. 本区域只保留同名薄包装导出，继续兼容 chat-event-handlers.js / profile-favorites.js 等既有调用方。
   3. 后续如果需要修改这些弹窗，请直接修改 chat-message-modals.js，不要在本文件恢复大段实现。
   4. 本次拆分不引入 localStorage/sessionStorage；弹窗样式仍统一沿用应用内主题。
   ========================================================================== */
export function showMessageImageModal(container) {
  return showMessageImageModalModule(container);
}


/* ==========================================================================
   [区域标注·已完成·本次转账需求] 聊天消息页转账应用内弹窗
   说明：
   1. 弹窗结构与闲谈应用现有 chat-modal 风格保持一致，不使用原生浏览器弹窗。
   2. 余额文案由 index.js 根据当前钱包余额与显示币种实时计算后传入。
   3. 这里只负责渲染转账弹窗，不做 localStorage/sessionStorage 读写，也不做双份存储兜底。
   ========================================================================== */
export function showMessageTransferModal(container, options = {}) {
  return showMessageTransferModalModule(container, options);
}

/* ==========================================================================
   [区域标注·已完成·本次转账需求] 转账消息操作弹窗（接收 / 退回）
   说明：
   1. 用户点击转账消息后使用应用内弹窗处理，不使用原生浏览器弹窗。
   2. 这里只负责 UI；余额变更和消息状态持久化统一由 index.js 写入 DB.js / IndexedDB。
   ========================================================================== */
export function showTransferActionModal(container, options = {}) {
  return showTransferActionModalModule(container, options);
}

/* ==========================================================================
   [区域标注·已完成·当前会话头像设置弹窗]
   说明：
   1. 头像 URL 输入、裁剪预览、原图头像/自动压缩均使用应用内弹窗，不使用原生浏览器弹窗。
   2. 弹窗只产生待保存头像数据；真正保存由 index.js 更新当前 session.avatar 并写入 DB.js / IndexedDB。
   3. URL 原图模式直接保存 URL；裁剪/压缩模式通过 canvas 输出 data:image/jpeg。
   ========================================================================== */
export function showChatAvatarUrlModal(container) {
  return showChatAvatarUrlModalModule(container);
}

export function showChatAvatarCropModal(container, { imageUrl = '', source = 'local', fileName = '' } = {}) {
  return showChatAvatarCropModalModule(container, { imageUrl, source, fileName });
}

export function updateChatAvatarCropPreview(container) {
  return updateChatAvatarCropPreviewModule(container);
}

export async function buildChatAvatarFromCropModal(container, mode = 'cropped') {
  return buildChatAvatarFromCropModalModule(container, mode);
}

/* ========================================================================== */
export function showAiFormatRepairTypeModal(container, messageId = '') {
  return showAiFormatRepairTypeModalModule(container, messageId);
}


/* ========================================================================
   [区域标注·已完成·用户消息撤回] 用户消息撤回确认弹窗
   说明：
   1. 使用闲谈应用内 chat-modal 样式，不使用浏览器原生弹窗或原生选择器。
   2. 用户可选择“AI 不可见 / AI 可见”；真正撤回和 IndexedDB 持久化由 index.js 处理。
   3. 点击撤回按钮只打开本弹窗，不重绘聊天页，避免闪屏。
   ======================================================================== */
export function showUserWithdrawMessageModal(container, message = {}) {
  return showUserWithdrawMessageModalModule(container, message);
}

/* ========================================================================
   [区域标注·已完成·本次撤回弹窗称谓文案调整] 对方撤回查看弹窗
   说明：你点击对方撤回系统提示后查看原文；应用内弹窗，不使用原生浏览器弹窗。
   ======================================================================== */
export function showAiWithdrawnMessageModal(container, message = {}) {
  return showAiWithdrawnMessageModalModule(container, message);
}

export function showAiFormatRepairResultModal(container, { success = false, title = '', message = '' } = {}) {
  return showAiFormatRepairResultModalModule(container, { success, title, message });
}

/* ========================================================================== */
export function showEditMessageModal(container, state, messageId) {
  return showEditMessageModalModule(container, state, messageId);
}

/* ==========================================================================
   [区域标注·已完成·本次旁白编辑弹窗指向修复] 旁白专用编辑弹窗
   说明：
   1. 只读取并编辑 owner 消息上的 asideSegments[].text / 兼容 asideText，不读取 message.content。
   2. 弹窗沿用闲谈应用 chat-modal 主题样式，不使用浏览器原生弹窗或原生选择器。
   3. 保存 action 为 confirm-edit-aside，由 index.js 写回 currentMessages 并通过 DB.js / IndexedDB 持久化。
   ========================================================================== */
export function showEditAsideModal(container, state, messageId, asideSegmentId) {
  return showEditAsideModalModule(container, state, messageId, asideSegmentId);
}

/* ========================================================================== */
export function showFavoriteSavedModal(container, count) {
  return showFavoriteSavedModalModule(container, count);
}

/* ========================================================================== */
export function showForwardMessagesModal(container, state) {
  return showForwardMessagesModalModule(container, state);
}
