// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-console.js
 * 用途: 闲谈应用 — 聊天消息页控制台日志子模块
 *       承载聊天消息页运行时控制台日志键、日志追加与 IndexedDB 持久化逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 继续拆分] 聊天控制台日志键与持久化工具
   说明：
   1. 本模块从 chat-message.js 中拆出，只负责聊天消息页运行时控制台日志相关逻辑。
   2. 所有持久化仍统一通过 chat-utils.js 的 dbPut → DB.js / IndexedDB。
   3. 严禁使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
import { dbPut } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·本次控制台持久显示与后台记录修复] 聊天控制台日志存储键
   说明：
   1. 与 index.js / chat-state.js 保持同一 IndexedDB 键规则。
   2. 当前文件只导出聊天消息页需要的日志键与操作函数。
   ========================================================================== */
export const DATA_KEY_CHAT_CONSOLE = (maskId, chatId) => `chat_console::${maskId || 'default'}::${chatId || 'none'}`;

export function appendChatConsoleRuntimeLog(state, level, text) {
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

export async function persistChatConsoleRuntimeLogs(state, db) {
  if (!state?.currentChatId) return;
  await dbPut(
    db,
    DATA_KEY_CHAT_CONSOLE(state.activeMaskId, state.currentChatId),
    Array.isArray(state.chatConsoleLogs) ? state.chatConsoleLogs.slice(-500) : []
  );
}
