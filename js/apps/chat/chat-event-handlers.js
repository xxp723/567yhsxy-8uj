// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-event-handlers.js
 * 用途: 闲谈应用事件代理处理器聚合出口。
 * 架构层: 应用层子模块（由 index.js 入口接线）
 */

/* ==========================================================================
   [区域标注·已完成·chat-event-handlers.js拆分] 事件代理处理模块聚合出口
   说明：
   1. 原 chat-event-handlers.js 已按事件职责拆分为 click / input / change / keyboard / double-click / html-card 子模块。
   2. 本文件保留原有导出 API，供 index.js 继续按既有方式绑定/解绑事件，避免影响现有接线。
   3. 持久化仍只使用 DB.js / IndexedDB；禁止 localStorage/sessionStorage，不写双份兜底。
   ========================================================================== */

export {
  buildHtmlCardInteractionSystemContent,
  handleHtmlCardInteraction
} from './chat-event-html-card.js';

export { handleClick } from './chat-event-click.js';

export { handleInput } from './chat-event-input.js';

export { handleChange } from './chat-event-change.js';

export { handleKeydown } from './chat-event-keyboard.js';

export { handleDoubleClick } from './chat-event-double-click.js';
