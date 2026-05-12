// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-event-keyboard.js
 * 用途: 闲谈应用键盘事件处理。
 * 架构层: 应用层子模块（由 chat-event-handlers.js 聚合导出）
 */

/* ==========================================================================
   [区域标注·已完成·chat-event-handlers.js拆分] 键盘事件处理
   说明：
   1. 从 chat-event-handlers.js 原样拆出键盘事件处理逻辑。
   2. 保持原有 Enter / Shift+Enter 行为、发送链路与 DB.js / IndexedDB 调用不变。
   3. 不引入 localStorage/sessionStorage，不增加双份兜底存储。
   ========================================================================== */
import { sendMessage, syncStickerInputSuggestions } from './chat-message.js';
import { syncMessageInputAutoHeight } from './chat-state.js';

/* ==========================================================================
   [区域标注·已完成·聊天输入框一至三行自适应]
   说明：Enter 仍沿用原发送行为；Shift+Enter 保留 textarea 原生换行，用于手动输入多行。
   ========================================================================== */
export async function handleKeydown(e, state, container, db, settingsManager) {
  const target = e.target;

  if (target?.matches?.('[data-role="favorite-search-input"]')) return;
  if (!target?.matches?.('[data-role="msg-input"]')) return;
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

  e.preventDefault();
  const value = target.value;
  target.value = '';
  syncMessageInputAutoHeight(target);
  syncStickerInputSuggestions(container, state, '');
  await sendMessage(container, state, db, value, settingsManager, { triggerAi: false });
}
