// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-event-input.js
 * 用途: 闲谈应用输入事件处理。
 * 架构层: 应用层子模块（由 chat-event-handlers.js 聚合导出）
 */

/* ==========================================================================
   [区域标注·已完成·chat-event-handlers.js拆分] 输入事件处理
   说明：
   1. 从 chat-event-handlers.js 原样拆出输入事件处理逻辑。
   2. 保持原有输入分支顺序、刷新逻辑与 DB.js / IndexedDB 持久化调用不变。
   3. 不引入 localStorage/sessionStorage，不增加双份兜底存储。
   ========================================================================== */
import {
  DATA_KEY_FAVORITES,
  DATA_KEY_SESSIONS,
  getCurrentChatPromptSettingsKey,
  dbPut,
  normalizeFavoriteData
} from './chat-utils.js';
import { handleContactsInput } from './contacts.js';
import {
  syncStickerInputSuggestions,
  syncChatMessageSearchPanel
} from './chat-message.js';
import { refreshPanel } from './chat-shell.js';
import { refreshFavoriteSearchResultsOnly } from './chat-navigation.js';
import {
  syncMessageInputAutoHeight
} from './chat-state.js';
import {
  normalizeMomentsComposeDraft,
  ensureMomentsComposeDraft
} from './moments.js';
import { updateChatAvatarCropPreview } from './chat-message.js';
import { handleAutonomousActivitySettingsInput } from './chat-autonomous-activity-settings.js';

export function handleInput(e, state, container, db) {
  const target = e.target;

  /* ==========================================================================
     [区域标注·已完成·自主活动设置输入接线]
     说明：
     1. 本区只把“自主活动”模块的时间间隔输入转交给 chat-autonomous-activity-settings.js。
     2. 实际规范化、局部同步与 DB.js / IndexedDB 持久化均在独立模块内完成。
     3. 不使用 localStorage/sessionStorage，不改动其它聊天设置输入分支。
     ========================================================================== */
  if (handleAutonomousActivitySettingsInput(e, state, container, db)) return;

  if (target.matches('[data-role="msg-input"]')) {
    syncMessageInputAutoHeight(target);
    syncStickerInputSuggestions(container, state, target.value || '');
    return;
  }

  if (target.matches('[data-role="moments-compose-textarea"]')) {
    const draft = ensureMomentsComposeDraft(state);
    state.momentsComposeDraft = normalizeMomentsComposeDraft({
      ...draft,
      text: target.value || ''
    });
    return;
  }

  if (target.matches('[data-role="msg-search-input"]')) {
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

  if (handleContactsInput(e, state, container)) return;

  if (target.matches('[data-role="favorite-search-input"]')) {
    const data = normalizeFavoriteData(state.favoriteData);
    state.favoriteData = { ...data, searchKeyword: target.value || '' };
    dbPut(db, DATA_KEY_FAVORITES(state.activeMaskId), normalizeFavoriteData(state.favoriteData));
    refreshFavoriteSearchResultsOnly(container, state);
    return;
  }

  if (target.matches('[data-role="chat-avatar-crop-zoom"], [data-role="chat-avatar-crop-x"], [data-role="chat-avatar-crop-y"]')) {
    updateChatAvatarCropPreview(container);
    return;
  }

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
  }
}
