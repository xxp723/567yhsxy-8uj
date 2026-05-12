// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-event-html-card.js
 * 用途: 闲谈应用 HTML 卡片交互事件处理。
 * 架构层: 应用层子模块（由 chat-event-handlers.js 聚合导出）
 */

/* ==========================================================================
   [区域标注·已完成·chat-event-handlers.js拆分] HTML 卡片交互事件处理
   说明：
   1. 从 chat-event-handlers.js 原样拆出 HTML 卡片交互相关逻辑。
   2. 保持原有业务顺序、消息结构与 DB.js / IndexedDB 持久化链路不变。
   3. 不引入 localStorage/sessionStorage，不增加双份兜底存储。
   ========================================================================== */
import {
  DATA_KEY_SESSIONS,
  dbPut
} from './chat-utils.js';
import {
  persistCurrentMessages,
  appendCurrentMessageBubble
} from './chat-message.js';
import { refreshPanel } from './chat-shell.js';

/* ========================================================================
   [区域标注·已完成·HTML卡片交互系统提示持久化与文案精简] 用户卡片回应入列
   说明：
   1. 用户点击 AI 发送的 HTML 卡片内部按钮/选项后，在聊天消息界面追加一行中间系统提示。
   2. 系统提示 type=html_card_interaction_system、role=user，会随 currentMessages 写入 DB.js / IndexedDB。
   3. 下一轮调用 AI 时，buildPromptPayloadForLatestUserRound 会把该系统提示作为用户最新回应上下文发送给 AI。
   4. 本区域已按本次要求移除“在 HTML 卡片中”前缀，系统小字直接显示“你点击/选择/填写/选中……”，避免文案冗余。
   5. 本区域不使用 localStorage/sessionStorage，不做双份兜底，不使用原生浏览器弹窗。
   ======================================================================== */
export function buildHtmlCardInteractionSystemContent(detail = {}) {
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

export async function handleHtmlCardInteraction(e, state, container, db) {
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
