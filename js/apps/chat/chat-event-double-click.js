// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-event-double-click.js
 * 用途: 闲谈应用双击事件处理。
 * 架构层: 应用层子模块（由 chat-event-handlers.js 聚合导出）
 */

/* ==========================================================================
   [区域标注·已完成·chat-event-handlers.js拆分] 双击事件处理
   说明：
   1. 从 chat-event-handlers.js 原样拆出双击事件处理逻辑。
   2. 保持原有语音展开、HTML 卡片收藏、翻译气泡双击与贴纸多选链路不变。
   3. 不引入 localStorage/sessionStorage，不增加双份兜底存储。
   ========================================================================== */
import {
  TAB_ICONS,
  escapeHtml,
  normalizeFavoriteData,
  persistFavoriteData,
  createUid
} from './chat-utils.js';
import {
  persistCurrentMessages,
  refreshMessageBubbleRows
} from './chat-message.js';
import { handleTranslationBubbleDblClick } from './chat-translation.js';
import { rerenderCurrentSubPage } from './chat-navigation.js';

export function handleDoubleClick(e, state, container, db) {
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

  if (state.currentChatId && !state.subPageView) {
    const htmlCardBubble = e.target.closest('.msg-html-card-bubble');
    if (htmlCardBubble) {
      const messageId = String(htmlCardBubble.dataset.messageId || htmlCardBubble.closest('[data-message-id]')?.dataset?.messageId || '').trim();
      const message = (state.currentMessages || []).find(item => String(item.id) === messageId);
      if (message && String(message.type || '') === 'card') {
        const cardHtml = String(message.cardHtml || message.content || '').trim();
        if (cardHtml) {
          e.preventDefault();
          e.stopPropagation();
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

  if (state.currentChatId && !state.subPageView) {
    handleTranslationBubbleDblClick(e, container, state.translationSettings);
  }

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
