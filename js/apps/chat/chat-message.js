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
  renderTranslationSettingsHtml,
  renderTranslationBubbleHtml,
  normalizeTranslationSettings
} from './chat-translation.js';

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
   [区域标注] IconPark 图标 SVG 定义
   说明：聊天消息页面用到的所有按键图标统一使用 IconPark 风格 SVG。
/* ========================================================================== */
const MSG_ICONS = {
  back: `<svg viewBox="0 0 48 48" fill="none"><path d="M32 36L20 24l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  send: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L25 43l-5-18L2 20L43 5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M20 25l23-20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  magicWand: `<svg viewBox="0 0 48 48" fill="none"><path d="M43 5L5 43" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M35 5l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 6l2 6l6 2l-6 2l-2 6l-2-6l-6-2l6-2l2-6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 24l1.5 4l4 1.5l-4 1.5l-1.5 4l-1.5-4l-4-1.5l4-1.5l1.5-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  coffee: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 20h28v14a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V20Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 24h4a6 6 0 0 1 0 12h-4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6v6M20 6v6M28 6v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·AI识图图片入口] IconPark — 图片按钮图标
     说明：用于聊天消息页咖啡功能区“图片”板块，图标来源保持 IconPark 风格。
  /* ======================================================================== */
  image: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 10h36v28H6V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 30l7-8l6 6l5-5l8 9" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="18" r="3" stroke="currentColor" stroke-width="3"/></svg>`,
  more: `<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="24" r="3" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/><circle cx="36" cy="24" r="3" fill="currentColor"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·聊天记录搜索] IconPark — 顶栏搜索按钮图标
     说明：用于聊天消息界面顶栏三点按钮左侧的聊天记录搜索入口；仅运行时筛选当前消息数组，不涉及持久化存储。
     ======================================================================== */
  search: `<svg viewBox="0 0 48 48" fill="none"><path d="M21 38c9.389 0 17-7.611 17-17S30.389 4 21 4S4 11.611 4 21s7.611 17 17 17Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M33 33l11 11" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  emptyChat: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`,
  sticker: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="3"/><path d="M16 29c2 4 14 4 16 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="20" r="2.5" fill="currentColor"/><circle cx="31" cy="20" r="2.5" fill="currentColor"/></svg>`,
  wallet: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 14h36v28H6V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 14V8h26v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 28h10v8H32a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  bolt: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 4L10 28h14l-4 16l18-24H24l4-16Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·旁白板块入口] IconPark — 旁白按钮图标
     说明：用于聊天消息页咖啡功能区第二行"旁白"板块，图标来源保持 IconPark 风格。
     ======================================================================== */
  aside: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 8h28a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H26l-8 8v-8h-8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 17h12M18 23h8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,

  /* ==========================================================================
     [区域标注·本次修改3] 消息气泡功能栏 IconPark 图标
     说明：单击消息气泡后显示，含修正、删除和多选；“修正”用于 AI 表情包格式补全。
  /* ========================================================================== */
  fixFormat: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 36l4 4l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 6l4 8l8 4l-8 4l-4 8l-4-8l-8-4l8-4l4-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 30l2 4l4 2l-4 2l-2 4l-2-4l-4-2l4-2l2-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  delete: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 11h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 11V7h10v4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 11l2 30h16l2-30" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M21 19v14M27 19v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  multiSelect: `<svg viewBox="0 0 48 48" fill="none"><path d="M20 10h20v20H20V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 18v20h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 20l4 4l7-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* [区域标注·已完成·气泡编辑收藏] IconPark — 编辑 / 收藏按钮图标 */
  edit: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 34v6h6L38 16l-6-6L8 34Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M29 13l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  favorite: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l5.6 11.4L42 19.2l-9 8.8l2.1 12.4L24 34.5l-11.1 5.9L15 28l-9-8.8l12.4-1.8L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  forward: `<svg viewBox="0 0 48 48" fill="none"><path d="M28 10l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 22H20c-8 0-12 4-12 12v4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  broom: `<svg viewBox="0 0 48 48" fill="none"><path d="M30 6l12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M27 9l12 12L18 42H8v-10L27 9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M12 32l4 4M19 25l4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  undo: `<svg viewBox="0 0 48 48" fill="none"><path d="M16 14H6v10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 24c3-9 10-14 20-14c8 0 14 3 18 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M42 34c-3 5-8 8-14 8c-8 0-14-3-18-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·消息回溯] IconPark — 气泡功能栏回溯按钮图标
     说明：用于从当前消息气泡向后删除聊天记录；仅更新当前消息数组并写入 DB.js / IndexedDB。
     ======================================================================== */
  rewind: `<svg viewBox="0 0 48 48" fill="none"><path d="M21 14L8 24l13 10V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M40 14L27 24l13 10V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·用户消息撤回] IconPark — 用户气泡撤回按钮图标
     说明：仅用于用户方消息气泡功能栏；不涉及任何持久化存储读写。
     ======================================================================== */
  withdraw: `<svg viewBox="0 0 48 48" fill="none"><path d="M18 12H8v10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 22c4-9 12-14 23-12c8 2 13 8 13 16c0 10-8 17-18 17c-5 0-10-2-14-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 18L21 28M21 18l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* [区域标注·已完成·气泡功能区复制] IconPark — 复制按钮图标 */
  copy: `<svg viewBox="0 0 48 48" fill="none"><path d="M16 16V8h24v24h-8" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 16h24v24H8V16Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·引用回复] IconPark — 引用按钮图标
     说明：用于消息气泡第二行“引用”按钮；引用数据随消息对象写入 DB.js / IndexedDB。
     ======================================================================== */
  quote: `<svg viewBox="0 0 48 48" fill="none"><path d="M18 10H8v12h10v16H8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 10H30v12h10v16H30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·AI本轮撤回] IconPark — 系统提示修正/查看撤回图标
     说明：服务 AI 撤回系统提示的查看弹窗与“修正→系统提示”；不涉及额外存储。
     ======================================================================== */
  systemTip: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 8h32v26H18L8 42V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 18h16M16 26h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·本次语音掉格式修正入口] IconPark — 文本 / 语音修正按钮图标
     说明：
     1. 用于“修正”分类弹窗的文本格式与语音格式修复。
     2. “语音”修正会把含 [语音] / 【语音】残片的 AI 文字气泡转为语音气泡。
     3. 本区域不涉及任何持久化存储读写；保存仍由 index.js 写入 DB.js / IndexedDB。
     ======================================================================== */
  textRepair: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 10h32M14 10v28M34 10v28M10 38h12M26 38h12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  voiceRepair: `<svg viewBox="0 0 48 48" fill="none"><rect x="17" y="5" width="14" height="24" rx="7" stroke="currentColor" stroke-width="3"/><path d="M10 22c0 8 6 14 14 14s14-6 14-14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 36v7M17 43h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·当前会话头像设置] IconPark — 头像上传 / 链接 / 裁剪图标
     说明：仅用于聊天设置页“当前会话联系人头像”区域；不涉及其它资料头像。
     ======================================================================== */
  userAvatar: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 24a9 9 0 1 0 0-18a9 9 0 0 0 0 18Z" stroke="currentColor" stroke-width="3"/><path d="M8 42a16 16 0 0 1 32 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  upload: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 16L24 6l10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 34v8h32v-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  link: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 29l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M21 14l3-3a10 10 0 0 1 14 14l-3 3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 34l-3 3a10 10 0 0 1-14-14l3-3" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crop: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 4v32a8 8 0 0 0 8 8h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M4 12h24a8 8 0 0 1 8 8v24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M18 18h12v12H18V18Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  /* ========================================================================
     [区域标注·已完成·本次控制台日志开关] IconPark — 控制台日志抽屉图标
     说明：仅服务聊天设置页“查看控制台日志”与聊天页底栏上方日志抽屉。
     ======================================================================== */
  monitor: `<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="8" width="36" height="24" rx="3" stroke="currentColor" stroke-width="3"/><path d="M24 32v8M16 40h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 24l6-7l5 5l9-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l18 32H6L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 18v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="currentColor"/></svg>`
};

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
   [区域标注·已完成·引用回复] 引用消息数据工具
   说明：
   1. 只从当前消息对象提取可读摘要，随回复消息的 quote 字段写入 IndexedDB。
   2. 不使用 localStorage/sessionStorage，不保留双份存储兜底。
   3. 下次如需修改引用预览文案或长度，优先修改本区域。
   ======================================================================== */
function getMessageDisplayTextForQuote(message = {}) {
  const type = String(message?.type || '');
  if (type === 'sticker') return `[表情包] ${String(message?.stickerName || message?.content || '表情包').trim()}`;
  if (isTextImageMessage(message)) return `[文字图] ${String(message?.textImageText || message?.content || '文字图').trim()}`;
  if (isVoiceMessage(message)) return getVoiceMessageDisplayText(message);
  if (type === 'image') return `[图片] ${String(message?.imageName || message?.content || '图片').trim()}`;
  if (type === 'transfer') return `[转账] ${String(message?.transferDisplayAmount || message?.content || '¥0.00').trim()}`;
  if (type === 'gift') return getGiftMessageDisplayText(message);
  if (type === 'card') return `[HTML卡片] ${String(message?.cardTitle || message?.content || '互动卡片').trim()}`;
  if (type === 'transfer_system' || type === 'ai_withdraw_system' || type === 'user_withdraw_system' || type === 'html_card_interaction_system') return String(message?.content || '系统提示').trim();
  return String(message?.content || '').trim();
}

export function createQuotePayloadFromMessage(message = {}, chatSession = {}, userProfile = {}) {
  if (!message?.id) return null;
  const isUser = message.role === 'user';
  const text = getMessageDisplayTextForQuote(message).replace(/\s+/g, ' ').trim();
  return {
    id: String(message.id),
    role: String(message.role || ''),
    senderName: isUser
      ? String(userProfile?.nickname || '我')
      : String(chatSession?.name || '对方'),
    text: text.length > 86 ? `${text.slice(0, 86)}…` : text,
    type: String(message.type || 'text'),
    timestamp: Number(message.timestamp || 0) || 0
  };
}

function renderQuotePreview(quote = {}, variant = 'bubble') {
  const text = String(quote?.text || '').trim();
  if (!text) return '';
  const senderName = String(quote?.senderName || (quote?.role === 'user' ? '我' : '对方')).trim();
  const className = variant === 'composer' ? 'msg-quote-preview msg-quote-preview--composer' : 'msg-quote-preview';
  return `
    <div class="${className}">
      <span class="msg-quote-preview__bar"></span>
      <div class="msg-quote-preview__body">
        <span class="msg-quote-preview__sender">${escapeHtml(senderName)}</span>
        <span class="msg-quote-preview__text">${escapeHtml(text)}</span>
      </div>
    </div>
  `;
}

/* ========================================================================
   [区域标注·已完成·聊天记录搜索文案与回滚定位修复] 搜索匹配与面板渲染工具
   说明：
   1. 只搜索当前运行时 currentMessages，你与对方的消息都纳入范围。
   2. 不写入 IndexedDB，不使用 localStorage/sessionStorage，不做双份存储兜底。
   3. 搜索框不限制输入字数；输入时只局部刷新结果框，不替换正在输入的 input DOM。
   4. 已修复移动端输入法因 input 被 outerHTML 重建而每输入一个字就失焦/收起的问题。
   5. 搜索浮层由 CSS 覆盖在顶栏下方，不挤压消息列表，避免页面整体上移与触摸穿透。
   6. 本次已将空状态说明文字改为“输入关键字后，你与对方的相关消息都会显示在这里。”。
   ======================================================================== */
function getChatSearchMessageText(message = {}) {
  const baseText = getMessageDisplayTextForQuote(message);
  const quoteText = String(message?.quote?.text || '').trim();
  return [baseText, quoteText].filter(Boolean).join(' ');
}

function getChatSearchMatches(messages = [], keyword = '') {
  const query = String(keyword || '').trim().toLowerCase();
  if (!query) return [];
  return (Array.isArray(messages) ? messages : [])
    .map((message, index) => ({
      message,
      index,
      text: getChatSearchMessageText(message)
    }))
    .filter(item => String(item.text || '').toLowerCase().includes(query));
}

function renderChatSearchResultBubble(item = {}, session = {}, userProfile = {}) {
  const message = item.message || {};
  const isUser = message.role === 'user';
  const senderName = isUser
    ? String(userProfile?.nickname || '我')
    : String(session?.remark || session?.name || '对方');
  const text = getChatSearchMessageText(message) || '（空消息）';

  return `
    <button class="msg-search-result ${isUser ? 'msg-search-result--user' : 'msg-search-result--other'}"
            data-action="jump-msg-search-result"
            data-message-id="${escapeHtml(message.id || '')}"
            type="button">
      <span class="msg-search-result__meta">${escapeHtml(senderName)} · 第 ${Number(item.index || 0) + 1} 条</span>
      <span class="msg-search-result__bubble">${escapeHtml(text)}</span>
    </button>
  `;
}

function renderChatMessageSearchResultsHtml(session = {}, messages = [], options = {}) {
  const keyword = String(options.chatSearchKeyword || '');
  const matches = getChatSearchMatches(messages, keyword);
  const userProfile = options.userProfile || {};

  return keyword
    ? (matches.length
        ? matches.map(item => renderChatSearchResultBubble(item, session, userProfile)).join('')
        : `<div class="msg-search-panel__empty">没有命中“${escapeHtml(keyword)}”</div>`)
    : `<div class="msg-search-panel__empty">输入关键字后，你与对方的相关消息都会显示在这里。</div>`;
}

function renderChatMessageSearchPanelHtml(session = {}, messages = [], options = {}) {
  const searchOpen = Boolean(options.chatSearchOpen);
  const keyword = String(options.chatSearchKeyword || '');

  return `
    <!-- ======================================================================
         [区域标注·已完成·聊天记录搜索文案与回滚定位修复] 顶栏下浮搜索框与命中结果
         说明：
         1. 点击顶栏放大镜后从顶栏下边框向下浮现；搜索仅使用当前运行时消息数组。
         2. 输入时只替换 data-role="msg-search-results" 内容，不替换 input DOM，避免输入法被关闭。
         3. 空状态文案已按本次需求更新为“你与对方”的说明。
         4. 本区域不涉及持久化存储，不使用 localStorage/sessionStorage。
         ====================================================================== -->
    <div class="msg-search-panel ${searchOpen ? 'is-open' : ''}" data-role="msg-search-panel">
      <div class="msg-search-panel__box">
        <span class="msg-search-panel__icon">${MSG_ICONS.search}</span>
        <input class="msg-search-panel__input"
               data-role="msg-search-input"
               type="text"
               value="${escapeHtml(keyword)}"
               placeholder="搜索聊天记录">
      </div>
      <div class="msg-search-panel__results" data-role="msg-search-results">
        ${renderChatMessageSearchResultsHtml(session, messages, options)}
      </div>
    </div>
  `;
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
   [区域标注·本次需求5] 单条消息气泡渲染
   说明：
   1. 导出给 index.js 增量追加消息，避免 AI 每输出一个气泡都整页重绘造成闪屏。
   2. 同时为每条消息补充 data-message-id，供单击功能栏、删除、多选使用。
/* ========================================================================== */
/* ========================================================================
   [区域标注·已完成·旁白固定/穿插位置修复] 旁白字段规范化与气泡拼接
   说明：
   1. 兼容旧字段 asideText，也支持本次新增的 asideSegments 多段旁白。
   2. 固定模式由“绑定到本轮第一条 AI 消息”保证显示在用户消息下方、AI 全部回复上方。
   3. 穿插模式按多段旁白分别绑定到不同 AI 消息，可在回复开头、中间、结尾出现多段旁白。
   4. 本区域只处理运行时渲染，不读写持久化存储；保存仍统一走 DB.js / IndexedDB。
   ======================================================================== */
function getAsideSegmentsFromMessage(message = {}) {
  const rawSegments = Array.isArray(message?.asideSegments) ? message.asideSegments : [];
  const normalizedSegments = rawSegments
    .map((segment, index) => {
      const text = typeof segment === 'string' ? segment : String(segment?.text || '').trim();
      if (!text) return null;
      return {
        id: String(segment?.id || `${message?.id || 'aside'}_${index + 1}`),
        text,
        placement: String(segment?.placement || 'before') === 'after' ? 'after' : 'before'
      };
    })
    .filter(Boolean);

  if (normalizedSegments.length) return normalizedSegments;

  const legacyText = String(message?.asideText || '').trim();
  return legacyText
    ? [{
        id: String(message?.id || 'aside'),
        text: legacyText,
        placement: 'before'
      }]
    : [];
}

function renderMessageAsideHtml(message = {}, placement = 'before') {
  const targetPlacement = placement === 'after' ? 'after' : 'before';
  return getAsideSegmentsFromMessage(message)
    .filter(segment => segment.placement === targetPlacement)
    .map((segment, index) => renderAsideBubbleHtml(segment.text, `${String(segment.id || message?.id || 'aside')}_${targetPlacement}_${index + 1}`))
    .join('');
}

function renderMessageWithAsideHtml(message, chatSession, options = {}) {
  const beforeAsideHtml = renderMessageAsideHtml(message, 'before');
  const bubbleHtml = renderMessageBubble(message, chatSession, options);
  const afterAsideHtml = renderMessageAsideHtml(message, 'after');
  return `${beforeAsideHtml}${bubbleHtml}${afterAsideHtml}`;
}

export function renderMessageBubble(msg, chatSession, options = {}) {
  const session = chatSession || {};
  const name = session.name || '聊天';
  const userProfile = options.userProfile || {};
  const userAvatar = userProfile.avatar || '';
  const userName = userProfile.nickname || '我';
  const selectedMessageId = String(options.selectedMessageId || '');
  const selectedMessageIds = Array.isArray(options.selectedMessageIds) ? options.selectedMessageIds.map(String) : [];
  const multiSelectMode = Boolean(options.multiSelectMode);
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const deleteConfirmMessageId = String(options.deleteConfirmMessageId || '');
  /* ===== 闲谈：删除消息二次确认 END ===== */
  /* ========================================================================
     [区域标注·已完成·消息回溯] 气泡回溯确认态
     说明：点击“回溯”后先显示“确认回溯”，再次确认才删除当前气泡之后的所有消息。
     ======================================================================== */
  const rewindConfirmMessageId = String(options.rewindConfirmMessageId || '');

  const messageId = String(msg?.id || '');
  const isUser = msg?.role === 'user';
  const isAssistant = msg?.role === 'assistant' || msg?.role === 'other';
  const isToolbarOpen = !multiSelectMode && selectedMessageId && selectedMessageId === messageId;
  const isSelected = selectedMessageIds.includes(messageId);
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const isDeleteConfirming = isToolbarOpen && deleteConfirmMessageId === messageId;
  /* ===== 闲谈：删除消息二次确认 END ===== */
  /* ========================================================================
     [区域标注·已完成·消息回溯] 当前气泡是否处于回溯二次确认
     说明：仅运行时状态，不做任何额外持久化；确认后由 index.js 写入 IndexedDB。
     ======================================================================== */
  const isRewindConfirming = isToolbarOpen && rewindConfirmMessageId === messageId;
  const isStickerMessage = String(msg?.type || '') === 'sticker' && String(msg?.stickerUrl || '').trim();
  /* ========================================================================
     [区域标注·已完成·AI识图图片消息渲染 + AI图片点击放大]
     说明：
     1. type:image 的消息来自咖啡功能区“图片”板块或 AI 生图结果。
     2. imageUrl 会随当前聊天记录写入 DB.js / IndexedDB，并在 prompt.js 中作为视觉输入发送给 AI。
     3. 所有图片消息（AI 生成/发送图片）统一支持单击居中放大，交由 index.js 的消息页媒体预览层处理。
     4. 不使用 localStorage/sessionStorage，也不保留双份存储兜底；不使用原生弹窗或原生选择器。
     ======================================================================== */
  const isTextImageBubbleMessage = isTextImageMessage(msg);
  /* ========================================================================
     [区域标注·已完成·语音消息气泡渲染]
     说明：
     1. type=voice_message 的消息来自咖啡功能区“语音”板块。
     2. 默认显示社交软件语音气泡样式；双击后展开语音转文字内容。
     3. 消息字段随 currentMessages 写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const isVoiceBubbleMessage = isVoiceMessage(msg);
  const isImageMessage = String(msg?.type || '') === 'image' && String(msg?.imageUrl || '').trim();
  const isZoomableImage = isImageMessage;
  /* ========================================================================
     [区域标注·已完成·本次转账显示优化] 转账消息类型与状态表现
     说明：
     1. type:transfer 的消息来自聊天消息页咖啡功能区“转账”板块或 AI 转账协议。
     2. 转账气泡不再显示“待处理/已接收/已退回”文字，改用颜色状态和 IconPark 对钩表现已接收。
     3. 持久化仍只走 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
     ======================================================================== */
  const isTransferMessage = String(msg?.type || '') === 'transfer';
  /* ========================================================================
   [区域标注·已完成·礼物消息卡片渲染]
     说明：
     1. type=gift 的消息来自咖啡功能区“礼物”板块，或来自 AI 的 [礼物] 主动送礼协议。
     2. 卡片 UI 由 chat-gift.js 独立维护；本区只负责聊天页渲染衔接。
     ======================================================================== */
  const isGiftBubbleMessage = isGiftMessage(msg);
  /* ========================================================================
     [区域标注·已完成·HTML卡片单张卡片显示修复] AI 互动 HTML 卡片消息
     说明：
     1. 本区域已去掉外层“HTML卡片/可点击互动”标题栏，只显示 iframe 内真正的 HTML 卡片。
     2. iframe 使用 sandbox + srcdoc 展示，保留卡片内原生 HTML/CSS 互动，同时不污染聊天页样式。
     3. iframe 同时写入 frameborder/scrolling/内联 border:0，防止 CSS 加载前出现浏览器默认大边框。
     4. 卡片原始 HTML 与渲染后的 srcdoc 都只保存在当前消息对象中；消息持久化仍统一走 DB.js / IndexedDB。
     ======================================================================== */
  const isHtmlCardMessage = String(msg?.type || '') === 'card' && String(msg?.cardHtml || msg?.content || '').trim();
  const htmlCardSrcdoc = isHtmlCardMessage
    ? sanitizeHtmlCardDocumentForSrcdoc(String(msg?.cardHtml || msg?.content || ''))
    : '';
  /* ========================================================================
     [区域标注·已完成·AI本轮撤回系统提示渲染]
     说明：
     1. transfer_system 继续用于转账系统小字。
     2. ai_withdraw_system 专用于 AI 本轮撤回后生成的微信/QQ式中间小字。
     3. 撤回原文随该消息对象写入当前聊天记录（DB.js / IndexedDB），用户可点开看，AI 上文只读取“撤回了什么”摘要。
     ======================================================================== */
  const isAiWithdrawSystemMessage = String(msg?.type || '') === 'ai_withdraw_system';
  /* ========================================================================
     [区域标注·已完成·用户消息撤回] 用户撤回系统提示小字渲染
     说明：
     1. user_withdraw_system 是用户撤回消息后插入的中间系统小字。
     2. 是否让 AI 看见撤回原文由消息对象 withdrawnVisibleToAi 控制，并随 currentMessages 写入 DB.js / IndexedDB。
     3. 本渲染区只显示“你撤回了一条消息”，不展示撤回原文，避免界面泄露用户选择。
     ======================================================================== */
  const isUserWithdrawSystemMessage = String(msg?.type || '') === 'user_withdraw_system';
  /* ========================================================================
     [区域标注·已完成·HTML卡片交互系统提示渲染]
     说明：
     1. 用户点击 AI HTML 卡片内按钮/选项后，由 index.js 插入本类型系统小字。
     2. 系统小字随 currentMessages 写入 DB.js / IndexedDB；下一轮请求 AI 时会作为用户回应上下文发送。
     3. 本区域只负责复用中间系统提示样式，不使用 localStorage/sessionStorage，不做双份存储兜底。
     ======================================================================== */
  const isHtmlCardInteractionSystemMessage = String(msg?.type || '') === 'html_card_interaction_system';
  const isTransferSystemMessage = String(msg?.type || '') === 'transfer_system' || isAiWithdrawSystemMessage || isUserWithdrawSystemMessage || isHtmlCardInteractionSystemMessage;
  const transferStatus = String(msg?.transferStatus || '').trim() || 'pending';
  const isTransferAccepted = transferStatus === 'accepted';
  /* ========================================================================
     [区域标注·已完成·引用回复] 消息气泡内引用预览
     说明：引用预览是消息对象 quote 字段的展示层，quote 字段随 currentMessages 写入 DB.js / IndexedDB。
     ======================================================================== */
  const quoteHtml = renderQuotePreview(msg?.quote);
  const bubbleInnerHtml = isStickerMessage
    ? `
        <div class="msg-sticker-bubble" title="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
          <img class="msg-sticker-bubble__image" src="${escapeHtml(msg?.stickerUrl || '')}" alt="${escapeHtml(msg?.stickerName || msg?.content || '表情包')}">
        </div>
      `
    : (isTextImageBubbleMessage
        ? renderTextImageBubble(msg)
        : (isVoiceBubbleMessage
            ? renderVoiceBubble(msg)
            : (isImageMessage
        ? `
          <!-- ==================================================================
               [区域标注·已完成·图片单击居中放大入口]
               说明：AI生成图片/发送图片统一挂载 data-action，由 index.js 打开消息页中间预览层，仅放大，不改聊天背景。
               ================================================================== -->
          <div class="msg-image-bubble ${isZoomableImage ? 'msg-image-bubble--zoomable' : ''}"
               ${isZoomableImage ? `data-role="msg-media-zoom-trigger" data-action="msg-media-open-zoom" data-media-kind="image" data-media-src="${escapeHtml(msg?.imageUrl || '')}" data-media-alt="${escapeHtml(msg?.imageName || msg?.content || '图片')}" data-message-id="${escapeHtml(messageId)}"` : ''}
               title="${escapeHtml(msg?.imageName || msg?.content || '图片')}">
            <img class="msg-image-bubble__image" src="${escapeHtml(msg?.imageUrl || '')}" alt="${escapeHtml(msg?.imageName || msg?.content || '图片')}" decoding="async">
          </div>
        `
        : (isTransferMessage
            ? `
              <div class="msg-transfer-bubble msg-transfer-bubble--${escapeHtml(transferStatus)}" title="转账">
                <div class="msg-transfer-bubble__icon">${MSG_ICONS.wallet}</div>
                <div class="msg-transfer-bubble__content">
                  <span class="msg-transfer-bubble__label">转账</span>
                  <strong class="msg-transfer-bubble__amount">${escapeHtml(msg?.transferDisplayAmount || msg?.content || '')}</strong>
                  ${String(msg?.transferNote || '').trim()
                    ? `<span class="msg-transfer-bubble__note">${escapeHtml(msg.transferNote)}</span>`
                    : `<span class="msg-transfer-bubble__note msg-transfer-bubble__note--empty">无备注</span>`}
                </div>
                ${isTransferAccepted ? `<span class="msg-transfer-bubble__check" aria-label="已接收">${MSG_ICONS.check}</span>` : ''}
              </div>
            `
            : (isGiftBubbleMessage
                ? renderGiftBubble(msg)
                : (isHtmlCardMessage
                ? `
                  <div class="msg-html-card-bubble"
                       data-role="msg-media-zoom-trigger"
                       data-action="msg-media-open-zoom"
                       data-media-kind="html-card"
                       data-media-srcdoc="${escapeHtml(htmlCardSrcdoc)}"
                       data-media-alt="${escapeHtml(msg?.cardTitle || msg?.content || 'HTML卡片')}"
                       data-message-id="${escapeHtml(messageId)}">
                    <!-- ======================================================
                         [区域标注·已完成·HTML卡片单张卡片显示修复]
                         说明：不再渲染额外标题栏/徽标/提示，只保留真正的 HTML 卡片 iframe。
                         ====================================================== -->
                    <iframe
                      class="msg-html-card-bubble__frame"
                      data-message-id="${escapeHtml(messageId)}"
                      sandbox="allow-scripts allow-forms allow-popups-to-escape-sandbox"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      frameborder="0"
                      scrolling="no"
                      style="border:0;outline:0;background:transparent;"
                      srcdoc="${escapeHtml(htmlCardSrcdoc)}"
                      title="${escapeHtml(msg?.cardTitle || msg?.content || 'HTML卡片')}"></iframe>
                  </div>
                `
                    : escapeHtml(msg?.content || '')))))));

  if (isTransferSystemMessage) {
    return `
      <!-- ======================================================================
           [区域标注·已完成·系统提示小字删除] 可单击聊天中间系统提示
           说明：单击系统提示文字显示应用内删除选项；确认后由 index.js 写入 DB.js / IndexedDB。
           ====================================================================== -->
      <div class="msg-transfer-system-row ${isToolbarOpen ? 'is-action-open' : ''}"
           data-message-id="${escapeHtml(messageId)}"
           data-action="msg-system-tip-select">
        <span class="msg-transfer-system-row__text">${escapeHtml(msg?.content || '')}</span>
        ${isToolbarOpen ? `
          <div class="msg-system-tip-actions" data-role="msg-bubble-toolbar">
            ${isAiWithdrawSystemMessage ? `
              <button class="msg-system-tip-actions__btn" data-action="msg-system-tip-view-withdrawn" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.systemTip}<span>查看</span>
              </button>
              <button class="msg-system-tip-actions__btn" data-action="msg-system-tip-fix-format" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.fixFormat}<span>修正</span>
              </button>
            ` : ''}
            <button class="msg-system-tip-actions__btn ${isDeleteConfirming ? 'is-confirming' : ''}" data-action="msg-system-tip-delete" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.delete}<span>${isDeleteConfirming ? '取消' : '删除'}</span>
            </button>
            ${isDeleteConfirming ? `
              <button class="msg-system-tip-actions__btn msg-system-tip-actions__btn--confirm" data-action="msg-system-tip-confirm-delete" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.check}<span>确认删除</span>
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <!-- [区域标注·已完成·本次转账需求] 可单击转账消息：${escapeHtml(messageId)} -->
    <div class="msg-bubble-row ${isUser ? 'msg-bubble-row--right' : 'msg-bubble-row--left'} ${multiSelectMode ? 'is-multi-selecting' : ''} ${isSelected ? 'is-selected' : ''}"
         data-message-id="${escapeHtml(messageId)}"
         data-action="${multiSelectMode ? 'msg-multi-toggle' : (isTransferMessage ? 'msg-transfer-open-actions' : 'msg-bubble-select')}">
      ${!isUser ? `<div class="msg-bubble__avatar">${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="">` : escapeHtml((name || '?').charAt(0).toUpperCase())}</div>` : ''}
      <div class="msg-bubble-content">
        ${isToolbarOpen ? `
          <!-- ==================================================================
               [区域标注·已完成·气泡两排功能区] 单击气泡后显示 IconPark 图标功能区
               说明：五列网格，图标在上文字在下；复制按钮位于第二排。点击聊天消息页任意非功能区区域关闭。
               ================================================================== -->
          <div class="msg-bubble-toolbar" data-role="msg-bubble-toolbar">
            ${isAssistant ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--fix-format" data-action="msg-bubble-fix-format" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.fixFormat}<span>修正</span>
              </button>
            ` : ''}
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-edit" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.edit}<span>编辑</span>
            </button>
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-favorite" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.favorite}<span>收藏</span>
            </button>
            ${isUser ? `
              <!-- ==================================================================
                   [区域标注·已完成·用户消息撤回] 用户方消息气泡撤回入口
                   说明：只给用户消息显示撤回按钮；点击后由 index.js 打开应用内弹窗，不使用原生 confirm/prompt。
                   ================================================================== -->
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--withdraw" data-action="msg-bubble-withdraw" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.withdraw}<span>撤回</span>
              </button>
            ` : ''}
            <!-- ===== 闲谈：删除消息二次确认 START ===== -->
            <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--danger ${isDeleteConfirming ? 'is-confirming' : ''}" data-action="msg-bubble-delete" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.delete}<span>${isDeleteConfirming ? '取消' : '删除'}</span>
            </button>
            ${isDeleteConfirming ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--confirm-delete" data-action="msg-bubble-confirm-delete" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.check}<span>确认删除</span>
              </button>
            ` : ''}
            <!-- ===== 闲谈：删除消息二次确认 END ===== -->
            <!-- ==================================================================
                 [区域标注·已完成·消息回溯] 气泡功能栏回溯入口
                 说明：点击后只进入确认态；确认后删除当前气泡之后的所有消息（包含系统小字），并保存到 DB.js / IndexedDB。
                 ================================================================== -->
            <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--rewind ${isRewindConfirming ? 'is-confirming' : ''}" data-action="msg-bubble-rewind" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.rewind}<span>${isRewindConfirming ? '取消' : '回溯'}</span>
            </button>
            ${isRewindConfirming ? `
              <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--confirm-rewind" data-action="msg-bubble-confirm-rewind" data-message-id="${escapeHtml(messageId)}" type="button">
                ${MSG_ICONS.check}<span>确认回溯</span>
              </button>
            ` : ''}
            <button class="msg-bubble-toolbar__btn" data-action="msg-bubble-multi" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.multiSelect}<span>多选</span>
            </button>
            <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--copy" data-action="msg-bubble-copy" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.copy}<span>复制</span>
            </button>
            <!-- ==================================================================
                 [区域标注·已完成·引用回复] 第二行引用按钮
                 说明：点击后把当前消息设为待引用对象，下一条用户消息会携带 quote 字段写入 IndexedDB。
                 ================================================================== -->
            <button class="msg-bubble-toolbar__btn msg-bubble-toolbar__btn--quote" data-action="msg-bubble-quote" data-message-id="${escapeHtml(messageId)}" type="button">
              ${MSG_ICONS.quote}<span>引用</span>
            </button>
          </div>
        ` : ''}
        <div class="msg-bubble ${isUser ? 'msg-bubble--user' : 'msg-bubble--other'} ${isAssistant && msg?.pending ? 'is-pending' : ''} ${isStickerMessage ? 'msg-bubble--sticker' : ''} ${isTextImageBubbleMessage ? 'msg-bubble--text-image' : ''} ${isVoiceBubbleMessage ? 'msg-bubble--voice' : ''} ${isImageMessage ? 'msg-bubble--image' : ''} ${isTransferMessage ? 'msg-bubble--transfer' : ''} ${isGiftBubbleMessage ? 'msg-bubble--gift' : ''} ${isHtmlCardMessage ? 'msg-bubble--html-card' : ''} ${quoteHtml ? 'msg-bubble--with-quote' : ''}">
          ${quoteHtml}
          ${bubbleInnerHtml}
          <!-- ===== [区域标注·已完成·语言翻译] 翻译气泡插入点 START ===== -->
          ${renderTranslationBubbleHtml(msg, options.translationSettings, isUser)}
          <!-- ===== [区域标注·已完成·语言翻译] 翻译气泡插入点 END ===== -->
        </div>
        <span class="msg-bubble__time">${formatMsgTime(msg?.timestamp)}</span>
      </div>
      ${isUser ? `<div class="msg-bubble__avatar msg-bubble__avatar--user">${userAvatar ? `<img src="${escapeHtml(userAvatar)}" alt="${escapeHtml(userName)}">` : `<span>${escapeHtml((userName || '我').charAt(0))}</span>`}</div>` : ''}
      ${multiSelectMode ? `
        <!-- [区域标注·本次需求5] 多选勾选圆点 -->
        <button class="msg-bubble-select-dot ${isSelected ? 'is-selected' : ''}" data-action="msg-multi-toggle" data-message-id="${escapeHtml(messageId)}" type="button" aria-label="选择消息">
          ${isSelected ? MSG_ICONS.check : ''}
        </button>
      ` : ''}
    </div>
  `;
}

/* ==========================================================================
   [区域标注] 渲染聊天消息页面 HTML
   参数：chatSession — 聊天会话对象
         messages — 消息数组 [{id, role, content, timestamp}]
         options.chatSettings — 当前聊天设置
         options.isSending — API 调用中状态
/* ========================================================================== */
export function renderChatMessage(chatSession, messages, options = {}) {
  const session = chatSession || {};
  /* ========================================================================
     [区域标注·已完成·当前会话备注显示名]
     说明：
     1. 聊天界面显示名优先使用当前会话备注，其次使用原联系人名。
     2. 备注仅用于本地 UI 显示，不用于 AI 提示词上下文。
     ======================================================================== */
  const name = String(session.remark ?? '').length ? String(session.remark) : (session.name || '聊天');
  const msgs = messages || [];
  const chatSettings = options.chatSettings || {};
  const isSending = Boolean(options.isSending);

  /* ==========================================================================
     [区域标注·本次需求3] 聊天页表情包面板 / AI 挂载设置
  /* ========================================================================== */
  const stickerData = normalizeStickerPanelData(options.stickerData);
  const stickerPanelGroupId = String(options.stickerPanelGroupId || 'all');
  const stickerPanelOpen = Boolean(options.stickerPanelOpen);
  const coffeeDockOpen = Boolean(options.coffeeDockOpen);
  const stickerGroups = getStickerPanelGroups(stickerData);
  const visibleStickerItems = getVisibleStickerPanelItems(stickerData, stickerPanelGroupId);
  const mountedStickerGroupIds = Array.isArray(chatSettings.mountedStickerGroupIds)
    ? chatSettings.mountedStickerGroupIds.map(String)
    : [];

  /* ========================================================================
     [区域标注·本次需求5] 消息选择状态
     说明：由 index.js 管理，只影响消息工具栏/多选栏显示。
     ======================================================================== */
  /* ===== 闲谈：删除消息二次确认 START ===== */
  const deleteConfirmMessageId = String(options.deleteConfirmMessageId || '');
  /* ===== 闲谈：删除消息二次确认 END ===== */
  /* ========================================================================
     [区域标注·已完成·消息回溯] 聊天消息页回溯确认态
     说明：传给单条气泡渲染；确认按钮由当前选中气泡的功能栏显示。
     ======================================================================== */
  const rewindConfirmMessageId = String(options.rewindConfirmMessageId || '');
  const multiSelectMode = Boolean(options.multiSelectMode);
  const selectedMessageIds = Array.isArray(options.selectedMessageIds) ? options.selectedMessageIds.map(String) : [];
  const selectedCount = selectedMessageIds.length;
  /* ========================================================================
     [区域标注·已完成·引用回复] 输入栏待引用状态
     说明：仅运行时保存待引用对象；真正发送后 quote 字段随消息对象写入 DB.js / IndexedDB。
     ======================================================================== */
  const pendingQuote = options.pendingQuote || null;
  const pendingQuoteHtml = renderQuotePreview(pendingQuote, 'composer');

  /* ========================================================================
     [区域标注·已完成·本次控制台日志开关] 聊天页日志抽屉状态
     说明：日志队列由 index.js 维护；这里仅负责渲染，不涉及持久化实现。
     ======================================================================== */
  const chatConsoleEnabled = Boolean(options.chatConsoleEnabled);
  const chatConsoleExpanded = Boolean(options.chatConsoleExpanded);
  const chatConsoleWarnErrorOnly = Boolean(options.chatConsoleWarnErrorOnly);
  const chatConsoleLogs = Array.isArray(options.chatConsoleLogs) ? options.chatConsoleLogs : [];
  const visibleConsoleLogs = getVisibleChatConsoleLogs(chatConsoleLogs, chatConsoleWarnErrorOnly);

  /* ==========================================================================
     [区域标注] 聊天顶部栏
  /* ========================================================================== */
  const topBarHtml = `
    <div class="msg-top-bar">
      <button class="msg-top-bar__back" data-action="msg-back" type="button">${MSG_ICONS.back}</button>
      <div class="msg-top-bar__user">
        <div class="msg-top-bar__avatar">
          ${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(name)}">` : escapeHtml((name || '?').charAt(0).toUpperCase())}
        </div>
        <div class="msg-top-bar__info">
          <span class="msg-top-bar__name">${escapeHtml(name)}</span>
          <span class="msg-top-bar__status">${isSending ? '正在回复...' : '在线'}</span>
        </div>
      </div>
      <!-- ====================================================================
           [区域标注·已完成·旁白模式] 旁白模式开启时顶栏显示爱心退出按钮
           说明：点击爱心按钮弹出退出旁白模式确认弹窗，由 index.js 处理退出逻辑。
           ==================================================================== -->
      ${isAsideModeActive(options) ? renderAsideExitButtonHtml() : ''}
      <button class="msg-top-bar__search ${options.chatSearchOpen ? 'is-active' : ''}" data-action="toggle-msg-search" type="button" aria-label="搜索聊天记录">${MSG_ICONS.search}</button>
      <button class="msg-top-bar__more" data-action="msg-more" type="button">${MSG_ICONS.more}</button>
    </div>
  `;

  const searchPanelHtml = renderChatMessageSearchPanelHtml(session, msgs, options);

  /* ==========================================================================
     [区域标注·已完成·旁白固定/穿插位置修复] 消息列表区域（含旁白气泡渲染）
     说明：
     1. AI 回复中的 <think>...</think> 已在 prompt.js 里剥离，界面只展示最终回复。
     2. 本区不再把整段旁白统一收集到“全会话第一条 AI 消息”或“最后一条 AI 消息”附近。
     3. displayMode='top' 的旁白按每轮 AI 连续回复分组，固定显示在该轮用户消息下方、第一条 AI/角色消息上方。
     4. displayMode='interleave' 的旁白读取 asideSegments，可按段穿插在对应 AI 文本/表情包/语音/图片等消息前后。
     5. 历史消息回看也复用相同规则；本区域只渲染，不读写 localStorage/sessionStorage。
  /* ========================================================================== */
  let messagesHtml = '';
  if (msgs.length === 0) {
    messagesHtml = `<div class="msg-empty">${MSG_ICONS.emptyChat}<p>还没有消息<br>发送一条消息开始聊天吧</p></div>`;
  } else {
    const asideDisplayMode = String(options.asideDisplayMode || 'top');
    const parts = [];

    for (let index = 0; index < msgs.length; index += 1) {
      const msg = msgs[index];

      if (asideDisplayMode === 'top' && msg?.role === 'assistant') {
        const run = [];
        let cursor = index;
        while (cursor < msgs.length && msgs[cursor]?.role === 'assistant') {
          run.push(msgs[cursor]);
          cursor += 1;
        }

        const runAsideHtml = run
          .flatMap(item => getAsideSegmentsFromMessage(item).map(segment => segment.text))
          .filter(Boolean)
          .map((text, asideIndex) => renderAsideBubbleHtml(text, `${String(run[0]?.id || 'aside_run')}_top_${asideIndex + 1}`))
          .join('');

        if (runAsideHtml) parts.push(runAsideHtml);
        run.forEach(item => parts.push(renderMessageBubble(item, session, options)));
        index = cursor - 1;
        continue;
      }

      parts.push(renderMessageWithAsideHtml(msg, session, options));
    }

    messagesHtml = parts.join('');
  }

  /* ==========================================================================
     [区域标注·已完成·咖啡功能区两行布局与旁白入口]
     说明：
     1. 咖啡功能区分成两行：第一行（图片/文字图/语音/转账），第二行（礼物/旁白）。
     2. "礼物"入口 HTML 来自独立 chat-gift.js，后续只改礼物板块可优先定位该文件。
     3. "旁白"入口暂时只添加 UI 按钮，功能逻辑待后续实现。
     4. 图片、转账、礼物消息都只写入 DB.js / IndexedDB，不使用浏览器同步键值存储。
  /* ========================================================================== */
  const featureDockHtml = `
    <div class="msg-feature-dock ${coffeeDockOpen ? 'is-open' : ''}" data-role="msg-feature-dock">
      <!-- ====================================================================
           [区域标注·已完成·咖啡功能区第一行] 图片 / 文字图 / 语音 / 转账
           ==================================================================== -->
      <div class="msg-feature-dock__row">
        <button class="msg-feature-dock__item" type="button" data-action="open-msg-image-modal" data-feature="image">
          ${MSG_ICONS.image}<span>图片</span>
        </button>
        ${renderTextImageFeatureButton()}
        ${renderVoiceFeatureButton()}
        <button class="msg-feature-dock__item" type="button" data-action="open-msg-transfer-modal" data-feature="transfer">
          ${MSG_ICONS.wallet}<span>转账</span>
        </button>
      </div>
      <!-- ====================================================================
           [区域标注·已完成·咖啡功能区第二行] 礼物 / 旁白
           ==================================================================== -->
      <div class="msg-feature-dock__row">
        ${renderGiftFeatureButton()}
        <button class="msg-feature-dock__item msg-feature-dock__item--aside" type="button" data-action="open-msg-aside-modal" data-feature="aside">
          ${MSG_ICONS.aside}<span>旁白</span>
        </button>
      </div>
    </div>
  `;

  /* ==========================================================================
     [区域标注·本次需求3] 输入栏表情包升起面板
     说明：圆形表情包按钮触发；顶部显示分组，可切换；一行四个排列发送到聊天界面。
  /* ========================================================================== */
  const stickerPanelHtml = `
    <div class="msg-sticker-panel ${stickerPanelOpen ? 'is-open' : ''}" data-role="msg-sticker-panel">
      <div class="msg-sticker-panel__groups">
        ${stickerGroups.map(group => `
          <button class="msg-sticker-panel__group-btn ${stickerPanelGroupId === group.id ? 'is-active' : ''}"
                  data-action="switch-msg-sticker-group"
                  data-sticker-group-id="${escapeHtml(group.id)}"
                  type="button">
            ${escapeHtml(group.name)}
          </button>
        `).join('')}
      </div>
      <div class="msg-sticker-panel__grid">
        ${visibleStickerItems.length
          ? visibleStickerItems.map(item => `
              <button class="msg-sticker-panel__item"
                      data-action="send-msg-sticker"
                      data-sticker-id="${escapeHtml(item.id)}"
                      type="button"
                      title="${escapeHtml(item.name)}">
                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name)}">
                <span>${escapeHtml(item.name)}</span>
              </button>
            `).join('')
          : `<div class="msg-sticker-panel__empty">当前分组暂无表情包</div>`}
      </div>
    </div>
  `;

  /* ==========================================================================
     [区域标注·本次需求5] 多选底部操作栏
     说明：多选模式下用户可删除选中消息或转发给聊天列表中的其他联系人。
  /* ========================================================================== */
  const multiSelectBarHtml = multiSelectMode ? `
    <div class="msg-multi-action-bar" data-role="msg-multi-action-bar">
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-cancel" type="button">${MSG_ICONS.close}<span>取消</span></button>
      <span class="msg-multi-action-bar__count">已选 ${selectedCount} 条</span>
      <!-- [区域标注·已完成·收藏多选底栏] 聊天消息多选后可收藏单条或多条为消息组 -->
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-favorite-selected" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.favorite}<span>收藏</span></button>
      <button class="msg-multi-action-bar__btn msg-multi-action-bar__btn--danger" data-action="msg-multi-delete-selected" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.delete}<span>删除</span></button>
      <button class="msg-multi-action-bar__btn" data-action="msg-multi-forward" type="button" ${selectedCount ? '' : 'disabled'}>${MSG_ICONS.forward}<span>转发</span></button>
    </div>
  ` : '';

  /* ========================================================================
     [区域标注·本次需求1] 多选模式聊天会话显式状态类
     说明：
     1. 进入多选后直接停止渲染底部输入栏，不再依赖 CSS :has() 才隐藏输入栏。
     2. 通过显式类名控制底部留白与层级，修复首次进入多选时底栏不显示的问题。
     ======================================================================== */
  const conversationClassName = multiSelectMode ? 'msg-conversation is-multi-select-mode' : 'msg-conversation';
  const listAreaClassName = multiSelectMode ? 'msg-list-area is-multi-select-mode' : 'msg-list-area';

  /* ==========================================================================
     [区域标注] 悬浮底部输入栏
     说明：四周圆角矩形；左侧咖啡按钮；输入框回车发送；右侧魔法棒与纸飞机。
  /* ========================================================================== */
  const inputBarHtml = `
    <div class="msg-input-shell ${pendingQuoteHtml ? 'has-pending-quote' : ''}">
      ${featureDockHtml}
      ${stickerPanelHtml}
      ${pendingQuoteHtml ? `
        <div class="msg-pending-quote" data-role="msg-pending-quote">
          ${pendingQuoteHtml}
          <button class="msg-pending-quote__cancel" data-action="cancel-msg-quote" type="button" aria-label="取消引用">${MSG_ICONS.close}</button>
        </div>
      ` : ''}

      <!-- ====================================================================
           [区域标注·已完成·本次控制台持久显示与防闪屏修复] 聊天页底栏上方日志抽屉
           说明：开关仅控制显示；日志始终后台记录。抽屉开关/筛选/清空由局部 DOM 同步，避免整页重绘闪屏。
           ==================================================================== -->
      ${renderChatConsoleDockHtml({
        chatConsoleEnabled,
        chatConsoleExpanded,
        chatConsoleWarnErrorOnly,
        visibleConsoleLogs
      })}

      <!-- ====================================================================
           [区域标注·已完成·本次输入框表情包联想按命中显示与防闪屏修复] 输入时联想结果挂载点
           说明：初始渲染保持为空；输入事件由 syncStickerInputSuggestions 按命中结果局部插入/更新/移除，不重绘聊天页，不反复重建已有窗口，避免闪屏。
           ==================================================================== -->

      <div class="msg-input-bar">
        <button class="msg-input-bar__icon-btn" data-action="msg-coffee" type="button">${MSG_ICONS.coffee}</button>
        <button class="msg-input-bar__icon-btn ${stickerPanelOpen ? 'is-active' : ''}" data-action="msg-sticker" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.sticker}</button>
        <!-- ==================================================================
             [区域标注·已完成·聊天输入框一至三行自适应]
             说明：输入控件改为 textarea；初始一行，内容增多时最高三行，超出后输入框内部滚动。
             ================================================================== -->
        <textarea class="msg-input-bar__input" rows="1" placeholder="输入消息..." data-role="msg-input" ${isSending ? 'disabled' : ''}></textarea>
        <button class="msg-input-bar__icon-btn" data-action="msg-magic" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.magicWand}</button>
        <button class="msg-input-bar__icon-btn msg-input-bar__send-btn" data-action="msg-send" type="button" ${isSending ? 'disabled' : ''}>${MSG_ICONS.send}</button>
      </div>
    </div>
  `;

  /* ==========================================================================
     [区域标注] 独立聊天设置页面
     说明：三点按钮进入；所有设置由 index.js 写入 DB.js / IndexedDB。
  /* ========================================================================== */
  const settingsPageHtml = `
    <div class="msg-settings-page" data-role="msg-settings-page" style="display:none;">
      <div class="msg-settings-header">
        <button class="msg-settings-header__back" data-action="msg-settings-back" type="button">${MSG_ICONS.back}</button>
        <div class="msg-settings-header__title">聊天设置</div>
      </div>
      <div class="msg-settings-body">
        <!-- ==================================================================
             [区域标注·已完成·当前会话头像设置]
             说明：
             1. 仅修改当前聊天会话 session.avatar，用于聊天列表与当前聊天界面联系人头像。
             2. 不写入联系人 contact.avatar，不影响通讯录头像或角色原始头像。
             3. 保存逻辑由 index.js 写入 DB.js / IndexedDB；禁止 localStorage/sessionStorage。
             ================================================================== -->
        <section class="msg-settings-card msg-settings-avatar-card">
          <div class="msg-settings-avatar-main">
            <div class="msg-settings-avatar-preview" data-role="msg-settings-avatar-preview">
              ${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(name)}">` : `<span>${escapeHtml((name || '?').charAt(0).toUpperCase())}</span>`}
            </div>
            <div class="msg-settings-avatar-info">
              <div class="msg-settings-card__title">当前会话联系人头像</div>
              <div class="msg-settings-card__desc">只应用到聊天列表和当前聊天界面，不会改动通讯录或联系人原始头像。</div>
            </div>
          </div>
          <div class="msg-settings-avatar-actions">
            <input data-role="msg-avatar-file-input" type="file" accept="image/*" hidden>
            <button class="msg-settings-avatar-action" data-action="open-chat-avatar-local-picker" type="button">
              ${MSG_ICONS.upload}<span>本地上传</span>
            </button>
            <button class="msg-settings-avatar-action" data-action="open-chat-avatar-url-modal" type="button">
              ${MSG_ICONS.link}<span>URL链接</span>
            </button>
          </div>
        </section>

        <!-- ==================================================================
             [区域标注·已完成·当前会话备注输入框]
             说明：
             1. 备注仅作用于当前会话显示名（聊天页/聊天列表），不改通讯录联系人原始名称。
             2. 输入内容不做长度限制；持久化由 index.js 写入 sessions（DB.js / IndexedDB）。
             3. 备注仅本地可见，不写入 AI 可见提示词上下文。
             ================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">备注</div>
          <input
            class="msg-settings-input"
            data-role="msg-session-remark"
            type="text"
            placeholder="输入当前会话备注（仅本地显示）"
            value="${escapeHtml(session.remark || '')}">
          <div class="msg-settings-card__desc">仅对当前会话生效，AI 不可见。</div>
        </section>

        <section class="msg-settings-card">
          <div class="msg-settings-card__title">当前指令</div>
          <textarea class="msg-settings-textarea" data-role="msg-current-command" placeholder="输入仅对下一次/当前状态生效的临时指令">${escapeHtml(chatSettings.currentCommand || '')}</textarea>
        </section>
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">外部应用消息注入</div>
              <div class="msg-settings-card__desc">开启后会在提示词中注入外部应用上下文。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.externalContextEnabled ? 'is-on' : ''}" data-action="toggle-external-context" type="button" aria-label="外部应用消息注入"></button>
          </div>
        </section>

        <!-- ===== 闲谈应用：时间感知设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">时间感知</div>
              <div class="msg-settings-card__desc">开启后角色会感知到真实时间。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.timeAwarenessEnabled ? 'is-on' : ''}" data-action="toggle-time-awareness" type="button" aria-label="时间感知"></button>
          </div>
        </section>

        <!-- ==================================================================
             [区域标注·已完成·HTML卡片设置开关] 聊天设置页 HTML 卡片注入开关
             说明：
             1. 仅当此开关开启时，prompt.js 才会给 AI 注入 HTML 卡片系统提示词。
             2. 开关样式沿用现有 iPhone 风格滑动开关；持久化由 index.js 写入 DB.js / IndexedDB。
             3. 本区域只新增 html 卡片功能相关设置，不修改其它聊天设置行为。
             ================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">HTML卡片</div>
              <div class="msg-settings-card__desc">开启后，角色会在对话中发送趣味性HTML卡片。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.htmlCardEnabled ? 'is-on' : ''}" data-action="toggle-html-card" type="button" aria-label="HTML卡片"></button>
          </div>
        </section>

        <!-- ==================================================================
             [区域标注·已完成·本次控制台日志开关] 聊天设置页新增开关
             说明：开启后在聊天页底栏上方显示日志入口，实时查看发送/API/警告/错误日志。
             ================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">查看控制台日志</div>
              <div class="msg-settings-card__desc">实时显示当前聊天页消息发送情况、API 错误、警告和其它错误。</div>
            </div>
            <button class="msg-ios-switch ${chatConsoleEnabled ? 'is-on' : ''}" data-action="toggle-chat-console" type="button" aria-label="查看控制台日志"></button>
          </div>
        </section>
        <!-- ===== 闲谈应用：时间感知设置 END ===== -->
        <!-- ==================================================================
             [区域标注·已同步静默审查] 自定义思维链设置
             说明：
             1. 本区域已同步 prompt.js 的默认静默审查方案。
             2. 自定义内容应要求 AI 后台自检，禁止显式输出 <think>...</think>。
             3. 这里只修改设置提示文案，不改 IndexedDB 持久化逻辑。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">自定义思维链</div>
          <div class="msg-settings-card__desc">留空时使用默认静默审查协议；自定义内容也应要求 AI 后台自检，最终回复禁止输出 think 标签、审查过程或幕后说明。</div>
          <textarea class="msg-settings-textarea" data-role="msg-custom-thinking" placeholder="【静默审查】输出前先在后台核对角色卡事实、已知细节、情感事实和消息格式；最终只输出符合通用消息协议的可见回复，禁止输出 <think>、审查步骤或幕后说明。">${escapeHtml(chatSettings.customThinkingInstruction || '')}</textarea>
        </section>

        <!-- ==================================================================
             [区域标注·本次需求3] AI 表情包挂载设置
             说明：只显示分组名称；支持多选；不同用户面具只决定 AI 挂载哪些分组。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">表情包挂载</div>
          <div class="msg-settings-card__desc">选择要挂载给 AI 使用的表情包分组。AI 只能从已挂载分组里选择符合当前聊天情景的表情包发送。</div>
          <div class="msg-settings-sticker-groups">
            ${stickerGroups.length
              ? stickerGroups.map(group => `
                  <button class="msg-settings-sticker-group-btn ${mountedStickerGroupIds.includes(group.id) ? 'is-active' : ''}"
                          data-action="toggle-mounted-sticker-group"
                          data-sticker-group-id="${escapeHtml(group.id)}"
                          type="button">
                    ${escapeHtml(group.name)}
                  </button>
                `).join('')
              : `<div class="msg-settings-sticker-empty">暂无可挂载的表情包分组</div>`}
          </div>
        </section>

        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">每轮回复气泡数量</div>
          <div class="msg-settings-card__desc">控制 AI 每一轮回复必须拆成多少个消息气泡；除非用户当轮明确允许突破，否则 AI 必须严格遵守。</div>
          <div class="msg-settings-number-grid">
            <label class="msg-settings-number-field">
              <span>最低</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-min" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMin || 1)}">
            </label>
            <label class="msg-settings-number-field">
              <span>最高</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-max" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMax || 3)}">
            </label>
          </div>
        </section>
        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== -->

        <!-- ===== 闲谈应用：短期记忆设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">短期记忆</div>
          <div class="msg-settings-card__desc">控制下次请求 AI 时携带之前多少轮对话上文；0 表示不携带历史上文。</div>
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>发送之前轮数</span>
            <input class="msg-settings-number-input" data-role="msg-short-term-memory-rounds" type="number" min="0" step="1" value="${escapeHtml(chatSettings.shortTermMemoryRounds ?? 8)}">
          </label>
        </section>
        <!-- ===== 闲谈应用：短期记忆设置 END ===== -->

        <!-- ==========================================================================
             [区域标注·已完成·语言翻译] 语言翻译折叠栏板块
             说明：
             1. 由 chat-translation.js 的 renderTranslationSettingsHtml() 生成 HTML。
             2. 翻译设置独立存储于 IndexedDB，键名 chat_translation_settings::*。
             3. 折叠栏包含总开关、角色/用户语言选择、翻译显示模式选择。
             ========================================================================== -->
        ${renderTranslationSettingsHtml(options.translationSettings, session, options.userProfile?.avatar, options.userProfile?.nickname)}

        <!-- ==========================================================================
             [区域标注·本次需求4] 清空全部聊天记录入口
             说明：点击后由 index.js 打开应用内确认弹窗；不使用原生浏览器弹窗。
             ========================================================================== -->
        <section class="msg-settings-card msg-settings-danger-card">
          <button class="msg-settings-danger-action" data-action="open-clear-all-messages-modal" type="button">
            <span class="msg-settings-danger-action__icon">${MSG_ICONS.broom}</span>
            <span class="msg-settings-danger-action__text">
              <strong>清空全部聊天记录</strong>
              <em>仅清空当前聊天界面的消息记录</em>
            </span>
          </button>
        </section>
      </div>
    </div>
  `;

  return `
    <div class="msg-page">
      <div class="${conversationClassName}" data-role="msg-conversation">
        ${topBarHtml}
        ${searchPanelHtml}
        <div class="${listAreaClassName}" data-role="msg-list">${messagesHtml}</div>
        ${multiSelectBarHtml}
        ${multiSelectMode ? '' : inputBarHtml}
      </div>
      ${settingsPageHtml}
    </div>
  `;
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
  const protocolMarkerRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片)\s*\]|【\s*(语音)\s*】)\s*/g;
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

    /* [区域标注·本次需求] 调用 prompt.js 的 chat()：按指定顺序组装 messages 后调用设置应用主 API */
    appendChatConsoleRuntimeLog(state, 'info', `开始请求 AI：history=${promptPayload.history.length}，currentRound=${promptPayload.currentUserRoundMessages.length}`);
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
        imageGeneratedAt: Date.now() + imageIndex
      }))
      .filter(item => item.imageUrl);

    const aiMessages = bindAsideSegmentsToAiMessages(
      [
        ...buildAiReplyMessages(rawAiText, state, {
          /* [区域标注·已完成·AI文字图/生图互斥前端接收] 生图 API 开启时前端丢弃 [文字图]；未开启时才把 [文字图] 渲染为文字图气泡。 */
          textImageProtocolEnabled: Boolean(result?.textImageProtocolEnabled)
        }),
        ...generatedImageMessages
      ],
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
   [区域标注·已完成·本次语音掉格式修复] 文本/引用/语音掉格式修复工具
   说明：
   1. “修正 → 文本”用于修复普通文字气泡掉格式：裸露 [回复] 协议头、Markdown 加粗/反引号、格式检查前缀或“修正后内容”等说明文字。
   2. “修正 → 语音”用于把含 [语音] / 【语音】残片的 AI 文字气泡修正为 type=voice_message 语音气泡。
   3. 仅修复当前 AI 消息对象，不读取或写入 localStorage/sessionStorage。
   4. 真正持久化仍由 index.js 调用 persistCurrentMessages 写入 DB.js / IndexedDB。
   5. 下次如需扩展其它修正类别，优先在本区域增加独立修复函数。
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


export function cleanAiProtocolBlockContent(content) {
  return String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
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
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  /* ========================================================================
     [区域标注·已完成·本次语音掉格式强容错解析] 宽松协议头识别
     说明：
     1. 协议头仅要求出现 [类型]，不再强依赖“角色名：”紧跟在后。
     2. [语音] 支持 `[ 语音 ]` 与 `【语音】`，AI 掉 Markdown/空格/全角括号时仍会进入语音解析。
     3. 内容中的角色名由 parseProtocolRoleAndContent 二次解析，避免模型轻微掉格式时整段失效。
     4. 卡片仍由 extractHtmlCardProtocolBlocks 负责正文提取；本循环遇到 type=卡片仅做边界截断。
     ======================================================================== */
  const markerRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片)\s*\]|【\s*(语音)\s*】)\s*/g;
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
        content: parsed.content
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
  let hasImageGenerationProtocol = false;
  let hasHtmlCardProtocol = false;
  protocolBlocks.forEach(block => {
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
          withdrawnRoleName: roleName
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
          stickerUrl: sticker.url
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
      if (voiceMessage) builtMessages.push(voiceMessage);
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
        if (textImageMessage) builtMessages.push(textImageMessage);
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
          ...transferPayload
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
      if (giftMessage) builtMessages.push(giftMessage);
      return;
    }

    if (block.type === '引用') {
      /* ======================================================================
         [区域标注·已完成·本次引用掉格式修复] AI [引用] 协议解析
         说明：
         1. 标准 `{引用ID:xxx}文字` 会解析为真实 quote 字段。
         2. 兼容“引用了某人：‘原文’”这类掉格式纯文字，避免截图中的引用说明露成普通气泡。
         3. quote 字段随 AI 消息写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
         ====================================================================== */
      const quoteMatch = String(block.content || '').match(/^\s*\{\s*引用\s*ID\s*[：:]\s*([^}；;，,\s]+)\s*\}\s*([\s\S]*)$/i);
      const looseQuote = quoteMatch ? null : parseLooseAiQuoteText(block.content, block.roleName);
      const quotePayload = quoteMatch
        ? resolveAiQuotePayloadById(state, quoteMatch[1])
        : (looseQuote ? resolveAiQuotePayloadByLooseText(state, looseQuote.quoteText, looseQuote.senderName) : null);
      const replyText = cleanAiVisibleBubbleText(quoteMatch ? quoteMatch[2] : (looseQuote ? looseQuote.replyText : block.content));
      const replyParts = splitStrictSentenceBubbles(replyText);

      if (quotePayload && !replyParts.length) {
        builtMessages.push({
          role: 'assistant',
          content: '',
          quote: quotePayload
        });
        return;
      }

      replyParts.forEach(content => {
        builtMessages.push({
          role: 'assistant',
          content,
          ...(quotePayload ? { quote: quotePayload } : {})
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

    splitStrictSentenceBubbles(cleanAiVisibleBubbleText(block.content)).forEach(content => {
      builtMessages.push({
        role: 'assistant',
        content
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
        cardOrder: index
      });
    });
  }

  if (!builtMessages.length && (hasImageGenerationProtocol || hasHtmlCardProtocol || detectedHtmlCardBlocks.length)) return [];

  return enforceAiReplyMessageCount(
    builtMessages.length
      ? builtMessages
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
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!msgWrap || !session) return;

  /* ===== 闲谈：多选模式滚动锁定 START ===== */
  const listBefore = msgWrap.querySelector('[data-role="msg-list"]');
  const shouldKeepScroll = Boolean(options.keepScroll);
  const previousScrollTop = listBefore ? listBefore.scrollTop : 0;
  /* ===== 闲谈：多选模式滚动锁定 END ===== */

  msgWrap.innerHTML = renderChatMessage(session, state.currentMessages, {
    chatSettings: state.chatPromptSettings,
    isSending: state.isAiSending,
    /* ===== 闲谈应用：语言翻译设置传递到 renderChatMessage START ===== */
    translationSettings: state.translationSettings,
    /* ===== 闲谈应用：语言翻译设置传递到 renderChatMessage END ===== */
    /* ===== 闲谈应用：用户主页头像连接到消息页 START ===== */
    userProfile: state.profile,
    /* ===== 闲谈应用：用户主页头像连接到消息页 END ===== */

    /* [区域标注·本次需求3] 聊天消息页表情包面板数据 */
    stickerData: state.stickerData,
    stickerPanelGroupId: state.stickerPanelGroupId,
    stickerPanelOpen: state.stickerPanelOpen,
    coffeeDockOpen: state.coffeeDockOpen,

    /* [区域标注·本次需求5] 消息气泡功能栏与多选状态 */
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds,
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: state.deleteConfirmMessageId,
    /* [区域标注·已完成·消息回溯] 渲染气泡回溯二次确认态 */
    rewindConfirmMessageId: state.rewindConfirmMessageId,
    /* [区域标注·已完成·引用回复] 渲染输入栏待引用预览 */
    pendingQuote: state.pendingQuote,
    /* ======================================================================
       [区域标注·已完成·本次控制台日志开关] 聊天页日志抽屉渲染参数透传
       说明：由 index.js 维护状态；这里只负责把状态传给 renderChatMessage。
       ====================================================================== */
    chatConsoleEnabled: state.chatConsoleEnabled,
    chatConsoleExpanded: state.chatConsoleExpanded,
    chatConsoleWarnErrorOnly: state.chatConsoleWarnErrorOnly,
    chatConsoleLogs: state.chatConsoleLogs,
    /* ======================================================================
       [区域标注·已完成·聊天记录搜索] 搜索面板渲染参数
       说明：仅运行时 UI 状态，不写入任何持久化存储。
       ====================================================================== */
    chatSearchOpen: state.chatMessageSearchOpen,
    chatSearchKeyword: state.chatMessageSearchKeyword,
    /* ======================================================================
       [区域标注·已完成·旁白模式] 旁白模式状态透传
       说明：传给 renderChatMessage → topBarHtml，控制爱心退出按钮显示。
       ====================================================================== */
    asideModeActive: state.asideModeActive,
    /* ======================================================================
       [区域标注·已完成·旁白固定/穿插位置修复] 旁白显示模式透传
       说明：完整渲染时必须知道 top/interleave，避免固定模式把旁白错误汇总到全会话第一条 AI 消息。
       ====================================================================== */
    asideDisplayMode: state.asideSettings?.displayMode || 'top'
    /* ===== 闲谈：删除消息二次确认 END ===== */
  });

  setTimeout(() => {
    const listArea = msgWrap.querySelector('[data-role="msg-list"]');
    if (!listArea) return;
    /* ===== 闲谈：多选模式滚动锁定 START ===== */
    if (shouldKeepScroll) {
      listArea.scrollTop = previousScrollTop;
      return;
    }
    /* ===== 闲谈：多选模式滚动锁定 END ===== */
    listArea.scrollTop = listArea.scrollHeight;
  }, 30);
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
  if (!message || !state.currentChatId) return;

  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!msgWrap || !listArea || !session) {
    renderCurrentChatMessage(container, state);
    return;
  }

  const emptyEl = listArea.querySelector('.msg-empty');
  if (emptyEl) emptyEl.remove();

  listArea.insertAdjacentHTML('beforeend', renderMessageWithAsideHtml(message, session, {
    userProfile: state.profile,
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds,
    asideDisplayMode: state.asideSettings?.displayMode || 'top',
    /* ===== [区域标注·已完成·语言翻译] 增量追加气泡也传递翻译设置 ===== */
    translationSettings: state.translationSettings,
    /* ===== 闲谈：删除消息二次确认 START ===== */
    deleteConfirmMessageId: state.deleteConfirmMessageId,
    rewindConfirmMessageId: state.rewindConfirmMessageId,
    pendingQuote: state.pendingQuote
    /* ===== 闲谈：删除消息二次确认 END ===== */
  }));
  listArea.scrollTop = listArea.scrollHeight;
}

/* ==========================================================================
   [HTML卡片功能栏防闪屏修复] HTML 卡片工具栏局部同步
   说明：
   1. HTML 卡片气泡内包含 iframe srcdoc；如果打开/关闭功能栏时 outerHTML 替换整条消息行，
      iframe 会被销毁并重新加载，造成用户看到的卡片闪屏。
   2. 本区域只在 HTML 卡片“功能栏开合/确认态变化”时同步工具栏 DOM 与行状态 class，
      保留原有 .msg-html-card-bubble__frame 节点不动，避免 srcdoc 重载。
   3. 非 HTML 卡片、系统提示、多选模式仍走原有局部替换逻辑；本修复不涉及任何持久化存储。
   ========================================================================== */
function syncHtmlCardBubbleToolbarWithoutFrameReload(row, message, session, state) {
  if (!row || !message || state.multiSelectMode) return false;
  if (String(message?.type || '') !== 'card' || !String(message?.cardHtml || message?.content || '').trim()) return false;

  const holder = document.createElement('div');
  holder.innerHTML = renderMessageBubble(message, session, {
    userProfile: state.profile,
    selectedMessageId: state.selectedMessageId,
    multiSelectMode: state.multiSelectMode,
    selectedMessageIds: state.selectedMessageIds,
    deleteConfirmMessageId: state.deleteConfirmMessageId,
    rewindConfirmMessageId: state.rewindConfirmMessageId
  }).trim();

  const nextRow = holder.firstElementChild;
  const content = row.querySelector('.msg-bubble-content');
  const bubble = content?.querySelector('.msg-bubble');
  if (!nextRow || !content || !bubble) return false;

  row.className = nextRow.className;
  if (nextRow.dataset.action) row.dataset.action = nextRow.dataset.action;

  const existingToolbar = Array.from(content.children).find(child => child.matches?.('[data-role="msg-bubble-toolbar"]'));
  const nextToolbar = nextRow.querySelector('[data-role="msg-bubble-toolbar"]');

  if (!nextToolbar) {
    existingToolbar?.remove();
    return true;
  }

  if (existingToolbar) {
    existingToolbar.outerHTML = nextToolbar.outerHTML;
    return true;
  }

  bubble.insertAdjacentHTML('beforebegin', nextToolbar.outerHTML);
  return true;
}

/* ========================================================================== */
export function refreshMessageBubbleRows(container, state, messageIds = []) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!listArea || !session) return false;

  const uniqueIds = Array.from(new Set((messageIds || []).map(id => String(id || '')).filter(Boolean)));
  uniqueIds.forEach(messageId => {
    /* ======================================================================
       [区域标注·已完成·系统提示小字删除] 局部刷新支持系统提示行
       说明：普通气泡和中间系统提示都通过 data-message-id 局部替换，不重绘整页。
       ====================================================================== */
    const row = listArea.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
    if (!row || !message) return;

    if (syncHtmlCardBubbleToolbarWithoutFrameReload(row, message, session, state)) return;

    row.outerHTML = renderMessageBubble(message, session, {
      userProfile: state.profile,
      selectedMessageId: state.selectedMessageId,
      multiSelectMode: state.multiSelectMode,
      selectedMessageIds: state.selectedMessageIds,
      deleteConfirmMessageId: state.deleteConfirmMessageId,
      rewindConfirmMessageId: state.rewindConfirmMessageId
    });
  });

  return true;
}


export function refreshCurrentMessageListOnly(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const listArea = msgWrap?.querySelector('[data-role="msg-list"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!listArea || !session) {
    renderCurrentChatMessage(container, state, { keepScroll: true });
    return;
  }

  const previousScrollTop = listArea.scrollTop;
  listArea.innerHTML = (state.currentMessages || []).length
    ? state.currentMessages.map(message => renderMessageWithAsideHtml(message, session, {
        userProfile: state.profile,
        selectedMessageId: state.selectedMessageId,
        multiSelectMode: state.multiSelectMode,
        selectedMessageIds: state.selectedMessageIds,
        asideDisplayMode: state.asideSettings?.displayMode || 'top',
        deleteConfirmMessageId: state.deleteConfirmMessageId,
        rewindConfirmMessageId: state.rewindConfirmMessageId
      })).join('')
    : `<div class="msg-empty"></div>`;
  listArea.scrollTop = previousScrollTop;
}


export function updateMultiSelectActionBar(container, state) {
  const bar = container.querySelector('[data-role="msg-multi-action-bar"]');
  if (!bar) return;
  const count = (state.selectedMessageIds || []).length;
  const countEl = bar.querySelector('.msg-multi-action-bar__count');
  if (countEl) countEl.textContent = `已选 ${count} 条`;
  bar.querySelectorAll('[data-action="msg-multi-favorite-selected"], [data-action="msg-multi-delete-selected"], [data-action="msg-multi-forward"]').forEach(btn => {
    btn.toggleAttribute('disabled', count <= 0);
  });
}

/* ========================================================================== */
export function resetMessageSelectionState(state) {
  state.selectedMessageId = '';
  state.multiSelectMode = false;
  state.selectedMessageIds = [];
  /* ===== 闲谈：删除消息二次确认 START ===== */
  state.deleteConfirmMessageId = '';
  /* ===== 闲谈：删除消息二次确认 END ===== */
  /* ========================================================================
     [区域标注·已完成·消息回溯] 重置气泡回溯确认态
     说明：仅清空运行时确认态，不涉及持久化；真正回溯由 index.js 写入 IndexedDB。
     ======================================================================== */
  state.rewindConfirmMessageId = '';
}


export function getSelectedMessages(state) {
  const selectedSet = new Set((state.selectedMessageIds || []).map(String));
  return (state.currentMessages || []).filter(message => selectedSet.has(String(message.id)));
}


export function refreshCurrentSessionLastMessage(state) {
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!session) return;

  const latest = [...(state.currentMessages || [])].reverse().find(item => String(item?.content || '').trim());
  session.lastMessage = latest?.type === 'sticker'
        ? `[表情包] ${latest?.stickerName || '未命名表情包'}`
        : (isTextImageMessage(latest)
        ? `[文字图] ${latest?.textImageText || '文字图'}`
        : (isVoiceMessage(latest)
        ? getVoiceMessageDisplayText(latest)
        : (latest?.type === 'image'
        ? `[图片] ${latest?.imageName || '图片'}`
        : (latest?.type === 'transfer'
            ? `[转账] ${latest?.transferDisplayAmount || latest?.content || '¥0.00'}`
            : (latest?.type === 'gift'
                ? getGiftMessageDisplayText(latest)
                : (latest?.content || ''))))));
  session.lastTime = latest?.timestamp || Date.now();
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
      conversationTimeContext
    };
  }

  const rounds = [];
  let current = [];
  previous.forEach(item => {
    if (item.role === 'user' && current.length) {
      rounds.push(current);
      current = [];
    }
    current.push({
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
  });
  if (current.length) rounds.push(current);

  return {
    userInput,
    history: rounds.slice(-roundLimit).flat(),
    currentUserRoundMessages,
    conversationTimeContext
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


export function splitStrictSentenceBubbles(text) {
  const normalized = String(text || '')
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
     ======================================================================== */
  return normalized
    .replace(/([。！？!?]+)(?:\s+|(?=\S))/g, '$1\n')
    .replace(/([…]{2,}|[.。]{3,}|、、、)(?:\s+|(?=\S))/g, '$1\n')
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
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
  return String(text || '')
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
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
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
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const shell = msgWrap?.querySelector('.msg-input-shell');
  if (!shell) return false;

  shell.querySelector('[data-role="msg-pending-quote"]')?.remove();

  const pendingQuoteHtml = renderQuotePreview(state.pendingQuote, 'composer');
  shell.classList.toggle('has-pending-quote', Boolean(pendingQuoteHtml));
  if (!pendingQuoteHtml) return true;

  const inputBar = shell.querySelector('.msg-input-bar');
  if (!inputBar) return false;

  inputBar.insertAdjacentHTML('beforebegin', `
    <div class="msg-pending-quote" data-role="msg-pending-quote">
      ${pendingQuoteHtml}
      <button class="msg-pending-quote__cancel" data-action="cancel-msg-quote" type="button" aria-label="取消引用">${MSG_ICONS.close}</button>
    </div>
  `);
  return true;
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
  const logs = Array.isArray(chatConsoleLogs) ? chatConsoleLogs : [];
  return warnErrorOnly
    ? logs.filter(item => String(item?.level || '').toLowerCase() === 'warn' || String(item?.level || '').toLowerCase() === 'error')
    : logs;
}

function renderChatConsoleDockHtml({
  chatConsoleEnabled = false,
  chatConsoleExpanded = false,
  chatConsoleWarnErrorOnly = false,
  visibleConsoleLogs = []
} = {}) {
  if (!chatConsoleEnabled) return '';

  return `
    <div class="msg-console-dock ${chatConsoleExpanded ? 'is-expanded' : ''}" data-role="msg-console-dock">
      <button class="msg-console-dock__trigger" type="button" data-action="toggle-chat-console-expand">
        <span class="msg-console-dock__title">${MSG_ICONS.monitor}<em>查看控制台 (Log/警告/错误)</em></span>
        <span class="msg-console-dock__meta">${visibleConsoleLogs.length} 条</span>
      </button>
      <div class="msg-console-dock__panel">
        <div class="msg-console-dock__toolbar">
          <button class="msg-console-dock__btn ${chatConsoleWarnErrorOnly ? 'is-active' : ''}" data-action="set-chat-console-filter-warn-error" type="button">${MSG_ICONS.warning}<span>仅 warn/error</span></button>
          <button class="msg-console-dock__btn ${!chatConsoleWarnErrorOnly ? 'is-active' : ''}" data-action="set-chat-console-filter-all" type="button"><span>查看全部</span></button>
          <button class="msg-console-dock__btn" data-action="clear-chat-console-logs" type="button">${MSG_ICONS.broom}<span>清空日志</span></button>
          <button class="msg-console-dock__btn" data-action="copy-chat-console-logs" type="button">${MSG_ICONS.copy}<span>复制</span></button>
        </div>
        <div class="msg-console-dock__list" data-role="msg-console-list">
          ${visibleConsoleLogs.length
            ? visibleConsoleLogs.map(item => `
                <div class="msg-console-log msg-console-log--${escapeHtml(String(item?.level || 'info').toLowerCase())}">
                  <span class="msg-console-log__time">${escapeHtml(String(item?.time || '--:--:--'))}</span>
                  <span class="msg-console-log__level">${escapeHtml(String(item?.level || 'info').toUpperCase())}</span>
                  <span class="msg-console-log__text">${escapeHtml(String(item?.text || ''))}</span>
                </div>
              `).join('')
            : `<div class="msg-console-dock__empty">目前没有日志资料。</div>`}
        </div>
      </div>
    </div>
  `;
}

export function syncChatMessageSearchPanel(container, state) {
  const msgWrap = container.querySelector('[data-role="msg-page-wrap"]');
  const conversation = msgWrap?.querySelector('[data-role="msg-conversation"]');
  const session = state.sessions.find(s => s.id === state.currentChatId);
  if (!conversation || !session) return false;

  const searchOptions = {
    userProfile: state.profile,
    chatSearchOpen: state.chatMessageSearchOpen,
    chatSearchKeyword: state.chatMessageSearchKeyword
  };

  let panel = conversation.querySelector('[data-role="msg-search-panel"]');
  if (!panel) {
    conversation.querySelector('.msg-top-bar')?.insertAdjacentHTML(
      'afterend',
      renderChatMessageSearchPanelHtml(session, state.currentMessages, searchOptions)
    );
    panel = conversation.querySelector('[data-role="msg-search-panel"]');
  }

  if (!panel) return false;

  /* ======================================================================
     [区域标注·已完成·聊天记录搜索输入法与浮层修复] 搜索面板局部同步
     说明：
     1. 输入过程中禁止 outerHTML 替换整个搜索面板，尤其不能替换正在输入的 input。
     2. 这里只同步开合 class、必要的 input value 与结果列表 innerHTML，移动端输入法可连续输入/删除。
     3. 搜索状态仅为运行时 UI 状态，不读写 IndexedDB/localStorage/sessionStorage。
     ====================================================================== */
  panel.classList.toggle('is-open', Boolean(state.chatMessageSearchOpen));

  const searchBtn = conversation.querySelector('[data-action="toggle-msg-search"]');
  if (searchBtn) searchBtn.classList.toggle('is-active', Boolean(state.chatMessageSearchOpen));

  const input = panel.querySelector('[data-role="msg-search-input"]');
  const keyword = String(state.chatMessageSearchKeyword || '');
  if (input && input.value !== keyword) input.value = keyword;

  const results = panel.querySelector('[data-role="msg-search-results"]');
  if (results) {
    results.innerHTML = renderChatMessageSearchResultsHtml(session, state.currentMessages, searchOptions);
  }

  if (state.chatMessageSearchOpen && input && document.activeElement !== input) {
    window.setTimeout(() => {
      if (!state.chatMessageSearchOpen || document.activeElement === input) return;
      input.focus({ preventScroll: true });
      const len = String(input.value || '').length;
      input.setSelectionRange(len, len);
    }, 30);
  }

  return true;
}

export function scrollToChatSearchResult(container, messageId = '') {
  const safeMessageId = String(messageId || '').trim();
  if (!safeMessageId) return false;

  const listArea = container.querySelector('[data-role="msg-list"]');
  const row = listArea?.querySelector(`[data-message-id="${CSS.escape(safeMessageId)}"]`);
  if (!listArea || !row) return false;

  /* ======================================================================
     [区域标注·已完成·聊天记录搜索回滚定位修复]
     说明：
     1. 禁止使用 row.scrollIntoView()，它会连带滚动外层页面/桌面层，造成聊天顶栏被顶上去。
     2. 只计算目标气泡相对 data-role="msg-list" 的位置，并滚动消息列表容器自身。
     3. 不触碰桌面编辑模式、不触发“添加应用与组件”窗口，不涉及任何持久化存储。
     ====================================================================== */
  const listRect = listArea.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const nextScrollTop = listArea.scrollTop
    + (rowRect.top - listRect.top)
    - ((listArea.clientHeight - rowRect.height) / 2);

  listArea.scrollTo({
    top: Math.max(0, Math.min(nextScrollTop, listArea.scrollHeight - listArea.clientHeight)),
    behavior: 'smooth'
  });
  row.classList.remove('is-search-target');
  window.setTimeout(() => row.classList.add('is-search-target'), 20);
  window.setTimeout(() => row.classList.remove('is-search-target'), 1700);
  return true;
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
   [区域标注·已完成·AI识图图片弹窗] 图片发送应用内弹窗
   说明：
   1. 替代原生浏览器弹窗，保持闲谈应用统一暖色主题。
   2. 用户可选择本地图片，也可输入图片 URL；确认 URL 后由 index.js 写入当前聊天消息。
   3. 本地图片读取为 data URL 后直接写入 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function showMessageImageModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>发送图片</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">选择本地图片，或粘贴图片 URL。发送后会在聊天界面显示为图片，AI 也能看到这张图。</div>
      <input class="msg-image-file-input" data-role="msg-image-file-input" type="file" accept="image/*">
      <input class="chat-modal-search" data-role="msg-image-url-input" type="url" placeholder="https://example.com/image.png">
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-send-image-url" type="button">发送链接图片</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-image-url-input"]')?.focus(), 30);
}


/* ==========================================================================
   [区域标注·已完成·本次转账需求] 聊天消息页转账应用内弹窗
   说明：
   1. 弹窗结构与闲谈应用现有 chat-modal 风格保持一致，不使用原生浏览器弹窗。
   2. 余额文案由 index.js 根据当前钱包余额与显示币种实时计算后传入。
   3. 这里只负责渲染转账弹窗，不做 localStorage/sessionStorage 读写，也不做双份存储兜底。
   ========================================================================== */
export function showMessageTransferModal(container, options = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const balanceLabel = String(options.balanceLabel || '').trim() || '¥0.00';
  const currencyCode = String(options.currencyCode || 'CNY').trim().toUpperCase();

  panel.innerHTML = `
    <!-- [区域标注·已完成·本次转账需求] 聊天消息页转账弹窗 -->
    <div class="chat-modal-header">
      <span>转账</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-transfer-modal-body">
      <label class="msg-transfer-modal-field">
        <span class="msg-transfer-modal-field__label">金额</span>
        <input class="chat-modal-search msg-transfer-modal-field__input"
               data-role="msg-transfer-amount-input"
               type="number"
               min="0.01"
               step="0.01"
               placeholder="输入转账金额">
      </label>
      <div class="msg-transfer-modal-balance">
        <span class="msg-transfer-modal-balance__label">钱包余额</span>
        <strong class="msg-transfer-modal-balance__amount">${escapeHtml(balanceLabel)}</strong>
        <span class="msg-transfer-modal-balance__currency">${escapeHtml(currencyCode)}</span>
      </div>
      <label class="msg-transfer-modal-field">
        <span class="msg-transfer-modal-field__label">备注</span>
        <input class="chat-modal-search msg-transfer-modal-field__input"
               data-role="msg-transfer-note-input"
               type="text"
               maxlength="60"
               placeholder="输入想要留言的话">
      </label>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-msg-transfer" type="button">确认转账</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-transfer-amount-input"]')?.focus(), 30);
}

/* ==========================================================================
   [区域标注·已完成·本次转账需求] 转账消息操作弹窗（接收 / 退回）
   说明：
   1. 用户点击转账消息后使用应用内弹窗处理，不使用原生浏览器弹窗。
   2. 这里只负责 UI；余额变更和消息状态持久化统一由 index.js 写入 DB.js / IndexedDB。
   ========================================================================== */
export function showTransferActionModal(container, options = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const messageId = String(options.messageId || '').trim();
  const amountLabel = String(options.amountLabel || '').trim() || '¥0.00';
  const noteLabel = String(options.note || '').trim();
  const statusLabel = String(options.statusLabel || '').trim() || '待处理';
  const actionHint = String(options.actionHint || '').trim() || '请选择处理方式';
  const canAccept = Boolean(options.canAccept);
  const canReturn = Boolean(options.canReturn);

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>转账操作</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-transfer-action-modal-body">
      <div class="msg-transfer-action-card">
        <div class="msg-transfer-action-card__row">
          <span class="msg-transfer-action-card__label">金额</span>
          <strong class="msg-transfer-action-card__amount">${escapeHtml(amountLabel)}</strong>
        </div>
        <div class="msg-transfer-action-card__row">
          <span class="msg-transfer-action-card__label">状态</span>
          <span class="msg-transfer-action-card__status">${escapeHtml(statusLabel)}</span>
        </div>
        ${noteLabel ? `<div class="msg-transfer-action-card__note">${escapeHtml(noteLabel)}</div>` : ''}
      </div>
      <div class="chat-modal-notice">${escapeHtml(actionHint)}</div>
    </div>
    <div class="chat-modal-footer">
      ${canReturn ? `<button class="chat-modal-btn chat-modal-btn--secondary" data-action="msg-transfer-return" data-message-id="${escapeHtml(messageId)}" type="button">${MSG_ICONS.undo}<span>退回</span></button>` : ''}
      ${canAccept ? `<button class="chat-modal-btn chat-modal-btn--primary" data-action="msg-transfer-accept" data-message-id="${escapeHtml(messageId)}" type="button">${MSG_ICONS.check}<span>接收</span></button>` : ''}
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·当前会话头像设置弹窗]
   说明：
   1. 头像 URL 输入、裁剪预览、原图头像/自动压缩均使用应用内弹窗，不使用原生浏览器弹窗。
   2. 弹窗只产生待保存头像数据；真正保存由 index.js 更新当前 session.avatar 并写入 DB.js / IndexedDB。
   3. URL 原图模式直接保存 URL；裁剪/压缩模式通过 canvas 输出 data:image/jpeg。
   ========================================================================== */
export function showChatAvatarUrlModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·当前会话头像URL输入弹窗按钮缩小去图标] -->
    <div class="chat-modal-header">
      <span>头像 URL</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">粘贴图片链接后进入裁剪预览。保存后仅更新当前聊天会话头像。</div>
      <input class="chat-modal-search" data-role="chat-avatar-url-input" type="url" placeholder="https://example.com/avatar.png">
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary msg-avatar-url-modal-btn" data-action="confirm-chat-avatar-url" type="button">继续</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="chat-avatar-url-input"]')?.focus(), 30);
}

export function showChatAvatarCropModal(container, { imageUrl = '', source = 'local', fileName = '' } = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const safeImageUrl = String(imageUrl || '').trim();
  if (!mask || !panel || !safeImageUrl) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·当前会话头像裁剪弹窗按钮缩小去图标] -->
    <div class="chat-modal-header">
      <span>裁剪头像</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-avatar-crop-modal-body"
         data-role="chat-avatar-crop-modal"
         data-avatar-source="${escapeHtml(source)}"
         data-avatar-file-name="${escapeHtml(fileName)}"
         data-avatar-original-url="${escapeHtml(safeImageUrl)}">
      <div class="chat-modal-hint">拖动下方滑杆自由调整裁剪区域；可选择保留原图或自动压缩，避免图片过大造成卡顿。</div>
      <div class="msg-avatar-crop-stage">
        <img class="msg-avatar-crop-image" data-role="chat-avatar-crop-image" src="${escapeHtml(safeImageUrl)}" alt="头像预览">
        <div class="msg-avatar-crop-frame">${MSG_ICONS.crop}</div>
      </div>
      <div class="msg-avatar-crop-controls">
        <label class="msg-avatar-crop-field"><span>缩放</span><input data-role="chat-avatar-crop-zoom" type="range" min="1" max="3" step="0.01" value="1"></label>
        <label class="msg-avatar-crop-field"><span>横向</span><input data-role="chat-avatar-crop-x" type="range" min="-100" max="100" step="1" value="0"></label>
        <label class="msg-avatar-crop-field"><span>纵向</span><input data-role="chat-avatar-crop-y" type="range" min="-100" max="100" step="1" value="0"></label>
      </div>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer msg-avatar-crop-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="save-chat-avatar-original" type="button">原图头像</button>
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="save-chat-avatar-compressed" type="button">自动压缩图片</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="save-chat-avatar-cropped" type="button">保存使用</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  updateChatAvatarCropPreview(container);
}

export function updateChatAvatarCropPreview(container) {
  const panel = container.querySelector('[data-role="modal-panel"]');
  const image = panel?.querySelector('[data-role="chat-avatar-crop-image"]');
  if (!image) return;
  const zoom = Number(panel.querySelector('[data-role="chat-avatar-crop-zoom"]')?.value || 1);
  const offsetX = Number(panel.querySelector('[data-role="chat-avatar-crop-x"]')?.value || 0);
  const offsetY = Number(panel.querySelector('[data-role="chat-avatar-crop-y"]')?.value || 0);
  image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
}

export async function buildChatAvatarFromCropModal(container, mode = 'cropped') {
  const panel = container.querySelector('[data-role="modal-panel"]');
  const modal = panel?.querySelector('[data-role="chat-avatar-crop-modal"]');
  const originalUrl = String(modal?.dataset?.avatarOriginalUrl || '').trim();
  if (!modal || !originalUrl) return '';

  if (mode === 'original') return originalUrl;

  const image = panel.querySelector('[data-role="chat-avatar-crop-image"]');
  if (!image) return '';
  await new Promise((resolve, reject) => {
    if (image.complete && image.naturalWidth > 0) {
      resolve();
      return;
    }
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('图片加载失败，请重新选择'));
  });

  const size = mode === 'compressed' ? 256 : 320;
  const quality = mode === 'compressed' ? 0.72 : 0.9;
  const zoom = Math.max(1, Number(panel.querySelector('[data-role="chat-avatar-crop-zoom"]')?.value || 1));
  const offsetX = Number(panel.querySelector('[data-role="chat-avatar-crop-x"]')?.value || 0);
  const offsetY = Number(panel.querySelector('[data-role="chat-avatar-crop-y"]')?.value || 0);
  const stageSize = 220;
  const naturalWidth = image.naturalWidth || size;
  const naturalHeight = image.naturalHeight || size;
  const baseScale = Math.max(stageSize / naturalWidth, stageSize / naturalHeight) * zoom;
  const sourceSize = size / baseScale;
  const centerX = naturalWidth / 2 - offsetX / baseScale;
  const centerY = naturalHeight / 2 - offsetY / baseScale;
  const sx = Math.max(0, Math.min(naturalWidth - sourceSize, centerX - sourceSize / 2));
  const sy = Math.max(0, Math.min(naturalHeight - sourceSize, centerY - sourceSize / 2));
  const sw = Math.min(sourceSize, naturalWidth - sx);
  const sh = Math.min(sourceSize, naturalHeight - sy);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8f4ef';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

export function showClearAllMessagesModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  if (!mask || !panel || !session) return;

  panel.innerHTML = `
    <!-- [区域标注·本次需求4] 清空全部聊天记录确认弹窗 -->
    <div class="chat-modal-header">
      <span>清空聊天记录</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">是否清空与“${escapeHtml(session.name || '未命名')}”的全部聊天记录？<br>此操作只清空当前聊天界面的消息，不删除联系人。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-clear-all-messages" type="button">清空</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ========================================================================== */
export function showAiFormatRepairTypeModal(container, messageId = '') {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const safeMessageId = String(messageId || '').trim();
  if (!mask || !panel || !safeMessageId) return;

  panel.innerHTML = `
    <!-- ======================================================================
         [区域标注·已完成·本次引用掉格式修复入口] AI 消息格式修正类别选择
         说明：
         1. “引用”按钮已支持把出现“引用/引用了”文字的 AI 普通气泡修正为引用气泡。
         2. “语音”按钮专门把含 [语音] / 【语音】残片的 AI 文字气泡修正为语音气泡。
         3. “系统提示”按钮专门修复 ai_withdraw_system 中间小字格式。
         4. 仍由 index.js 调用对应 repairAi*FormatIfPossible 后写入 DB.js / IndexedDB。
         5. 不使用 localStorage/sessionStorage，不做双份存储兜底。
         ====================================================================== -->
    <div class="chat-modal-header">
      <span>选择修正类别</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">如果普通文字气泡里露出了“引用/引用了”，请选择“引用”；露出 [语音] 请选择“语音”；普通回复协议掉格式请选择“文本”。修复后只更新当前消息，并通过 DB.js / IndexedDB 保存。</div>
      <div class="msg-format-repair-grid">
        <button class="msg-format-repair-option" data-action="apply-ai-format-repair" data-repair-type="sticker" data-message-id="${escapeHtml(safeMessageId)}" type="button">
          <span class="msg-format-repair-option__icon">${MSG_ICONS.sticker}</span>
          <strong>表情包</strong>
          <em>修复表情包协议或关键词</em>
        </button>
        <button class="msg-format-repair-option" data-action="apply-ai-format-repair" data-repair-type="text" data-message-id="${escapeHtml(safeMessageId)}" type="button">
          <span class="msg-format-repair-option__icon">${MSG_ICONS.textRepair}</span>
          <strong>文本</strong>
          <em>修复裸露协议/修正后内容</em>
        </button>
        <button class="msg-format-repair-option" data-action="apply-ai-format-repair" data-repair-type="voice" data-message-id="${escapeHtml(safeMessageId)}" type="button">
          <span class="msg-format-repair-option__icon">${MSG_ICONS.voiceRepair}</span>
          <strong>语音</strong>
          <em>修复 [语音] 为语音气泡</em>
        </button>
        <button class="msg-format-repair-option" data-action="apply-ai-format-repair" data-repair-type="quote" data-message-id="${escapeHtml(safeMessageId)}" type="button">
          <span class="msg-format-repair-option__icon">${MSG_ICONS.quote}</span>
          <strong>引用</strong>
          <em>修复“引用”文字为引用气泡</em>
        </button>
        <button class="msg-format-repair-option" data-action="apply-ai-format-repair" data-repair-type="system" data-message-id="${escapeHtml(safeMessageId)}" type="button">
          <span class="msg-format-repair-option__icon">${MSG_ICONS.systemTip}</span>
          <strong>系统提示</strong>
          <em>修复撤回小字格式</em>
        </button>
      </div>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}


/* ========================================================================
   [区域标注·已完成·用户消息撤回] 用户消息撤回确认弹窗
   说明：
   1. 使用闲谈应用内 chat-modal 样式，不使用浏览器原生弹窗或原生选择器。
   2. 用户可选择“AI 不可见 / AI 可见”；真正撤回和 IndexedDB 持久化由 index.js 处理。
   3. 点击撤回按钮只打开本弹窗，不重绘聊天页，避免闪屏。
   ======================================================================== */
export function showUserWithdrawMessageModal(container, message = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const messageId = String(message?.id || '').trim();
  if (!mask || !panel || !messageId) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·用户消息撤回] 应用内撤回确认弹窗 -->
    <div class="chat-modal-header">
      <span>撤回消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">撤回后聊天界面会显示“你撤回了一条消息”。请选择下一轮对方回复时是否允许对方看见这条被撤回的原文。</div>
      <div class="msg-withdrawn-content">${escapeHtml(getMessageDisplayTextForQuote(message) || '（空消息）')}</div>
    </div>
    <div class="chat-modal-footer msg-user-withdraw-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary msg-user-withdraw-modal-btn" data-action="confirm-user-withdraw-message" data-message-id="${escapeHtml(messageId)}" data-ai-visible="0" type="button">撤回，对方不可见</button>
      <button class="chat-modal-btn chat-modal-btn--primary msg-user-withdraw-modal-btn" data-action="confirm-user-withdraw-message" data-message-id="${escapeHtml(messageId)}" data-ai-visible="1" type="button">撤回，对方可见</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ========================================================================
   [区域标注·已完成·本次撤回弹窗称谓文案调整] 对方撤回查看弹窗
   说明：你点击对方撤回系统提示后查看原文；应用内弹窗，不使用原生浏览器弹窗。
   ======================================================================== */
export function showAiWithdrawnMessageModal(container, message = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·本次撤回弹窗称谓文案调整] 对方撤回查看弹窗 -->
    <div class="chat-modal-header">
      <span>撤回的消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">这条内容已被对方撤回；你可查看原文，后续对方只能看到自己撤回了什么。</div>
      <div class="msg-withdrawn-content">${escapeHtml(message.withdrawnContent || message.aiVisibleWithdrawnSummary || '')}</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

export function showAiFormatRepairResultModal(container, { success = false, title = '', message = '' } = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·本次修正分类弹窗] AI 消息格式修正结果提示弹窗 -->
    <div class="chat-modal-header">
      <span>${escapeHtml(title || (success ? '修正完成' : '无法修正'))}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">${escapeHtml(message || (success ? '已将这条 AI 消息修正为表情包消息。' : '未识别到可匹配的已挂载表情包格式或关键词。'))}</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ========================================================================== */
export function showEditMessageModal(container, state, messageId) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const message = (state.currentMessages || []).find(item => String(item.id) === String(messageId));
  if (!mask || !panel || !message) return;

  panel.innerHTML = `
    <!-- [区域标注·气泡编辑弹窗] 编辑聊天气泡文字，不使用原生弹窗 -->
    <div class="chat-modal-header">
      <span>编辑消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <textarea class="chat-modal-search" data-role="edit-message-content-input" maxlength="2000" style="min-height:108px;resize:none;">${escapeHtml(message.content || '')}</textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-edit-message" data-message-id="${escapeHtml(messageId)}" type="button">保存</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="edit-message-content-input"]')?.focus(), 30);
}

/* ========================================================================== */
export function showFavoriteSavedModal(container, count) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>收藏完成</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body"><div class="chat-modal-hint">已收藏 ${Number(count || 0)} 条消息，可在用户主页“收藏”折叠栏中查看。</div></div>
    <div class="chat-modal-footer"><button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button></div>
  `;
  mask.classList.remove('is-hidden');
}

/* ========================================================================== */
export function showForwardMessagesModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const selectedMessages = getSelectedMessages(state);
  const targets = getVisibleChatSessions(state).filter(session => String(session.id) !== String(state.currentChatId));

  const targetHtml = targets.length
    ? targets.map(session => `
        <!-- [区域标注·本次需求5] 可转发联系人：${escapeHtml(session.name || '未命名')} -->
        <button class="chat-forward-target" data-action="confirm-forward-messages" data-chat-id="${escapeHtml(session.id)}" type="button">
          <span class="chat-forward-target__avatar">
            ${session.avatar
              ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(session.name || '')}">`
              : escapeHtml((session.name || '?').charAt(0).toUpperCase())}
          </span>
          <span class="chat-forward-target__name">${escapeHtml(session.name || '未命名')}</span>
          <span class="chat-forward-target__icon">${TAB_ICONS.forward}</span>
        </button>
      `).join('')
    : `<div class="chat-modal-hint">暂无其它可转发的聊天联系人。</div>`;

  panel.innerHTML = `
    <!-- [区域标注·本次需求5] 多选消息转发弹窗 -->
    <div class="chat-modal-header">
      <span>转发 ${selectedMessages.length} 条消息</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      ${targetHtml}
    </div>
  `;

  mask.classList.remove('is-hidden');
}
