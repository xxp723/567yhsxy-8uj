// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-selection.js
 * 用途: 闲谈应用 — 聊天消息页多选状态子模块
 * 架构层: 应用层（闲谈子模块）
 *
 * 说明：
 * 1. 本文件承接 chat-message.js 中与“消息选中态 / 多选底栏”直接相关的轻量逻辑。
 * 2. 只处理运行时 state 与局部 DOM，不涉及 DB.js / IndexedDB 持久化。
 * 3. 不使用 localStorage/sessionStorage，不使用原生浏览器弹窗。
 */

/* ==========================================================================
   [区域标注·已完成·本次拆分] 多选底栏局部同步
   说明：
   1. 只更新当前已挂载的多选底栏计数与按钮禁用态，不重绘整页。
   2. 继续复用既有 data-action 接线，避免影响 chat-event-handlers.js。
   ========================================================================== */
export function updateMultiSelectActionBar(container, state) {
  const bar = container.querySelector('[data-role="msg-multi-action-bar"]');
  if (!bar) return;

  const count = (state.selectedMessageIds || []).length;
  const countEl = bar.querySelector('.msg-multi-action-bar__count');
  if (countEl) countEl.textContent = `已选 ${count} 条`;

  bar
    .querySelectorAll('[data-action="msg-multi-favorite-selected"], [data-action="msg-multi-delete-selected"], [data-action="msg-multi-forward"]')
    .forEach(btn => {
      btn.toggleAttribute('disabled', count <= 0);
    });
}

/* ==========================================================================
   [区域标注·已完成·本次拆分] 重置消息选择状态
   说明：
   1. 统一清空单选态、旁白段选中态、多选态与二次确认态。
   2. 仅修改运行时 state；真正删除/回溯等持久化动作仍由外层流程写入 DB.js / IndexedDB。
   ========================================================================== */
export function resetMessageSelectionState(state) {
  state.selectedMessageId = '';
  /* ========================================================================
     [区域标注·已完成·本次旁白功能栏编辑指向修复] 重置旁白段选中态
     说明：清空当前选中的旁白段 id，避免关闭/切换选择后旁白工具栏残留。
     ======================================================================== */
  state.selectedAsideSegmentId = '';
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

/* ==========================================================================
   [区域标注·已完成·本次拆分] 获取当前选中的消息对象
   说明：
   1. 按 state.selectedMessageIds 从 currentMessages 中筛选选中消息。
   2. 返回顺序与 currentMessages 一致，方便后续收藏、删除、转发复用。
   ========================================================================== */
export function getSelectedMessages(state) {
  const selectedSet = new Set((state.selectedMessageIds || []).map(String));
  return (state.currentMessages || []).filter(message => selectedSet.has(String(message.id)));
}
