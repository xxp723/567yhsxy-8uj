// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-quote.js
 * 用途: 闲谈应用 — 聊天消息页引用回复子模块
 * 架构层: 应用层子模块（由 chat-message.js 统一导出/接线）
 */

import { escapeHtml } from './chat-utils.js';
import { MSG_ICONS } from './chat-message-icons.js';
import {
  getGiftMessageDisplayText
} from './chat-gift.js';
import {
  isTextImageMessage
} from './chat-text-image.js';
import {
  getVoiceMessageDisplayText,
  isVoiceMessage
} from './chat-voice.js';

/* ========================================================================
   [区域标注·已完成·本次拆分] 引用回复摘要工具
   说明：
   1. 只从当前消息对象提取可读摘要，随回复消息的 quote 字段写入 IndexedDB。
   2. 不使用 localStorage/sessionStorage，不保留双份存储兜底。
   3. 后续如需修改引用预览文案或长度，优先修改本文件。
   ======================================================================== */
export function getMessageDisplayTextForQuote(message = {}) {
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

export function renderQuotePreview(quote = {}, variant = 'bubble') {
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
   [区域标注·已完成·本次拆分] 输入栏引用预览局部同步
   说明：
   1. 点击“引用”或“取消引用”时只更新底栏引用框，不再重绘整个聊天消息页。
   2. 用户发送后会立即清除 DOM 中的引用框，避免 quote 已发送但底栏残留。
   3. 仅使用运行时 state.pendingQuote；持久化仍只随消息对象 quote 字段写入 DB.js / IndexedDB。
   ======================================================================== */
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
