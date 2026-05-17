// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-memory-settings.js
 * 用途: 闲谈应用 — 聊天设置页“记忆设置”独立 UI 渲染模块
 * 架构层: 应用层（闲谈子模块）
 */

import { escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·本次新增：记忆设置独立渲染模块]
   说明：
   1. 本模块只负责聊天设置页“记忆设置”板块的 UI 渲染，方便后续单独修改短期记忆与长期记忆界面。
   2. “短期记忆”已从 chat-message-settings.js 的“聊天控制”板块迁移到本模块，继续保留原 data-role="msg-short-term-memory-rounds"。
   3. “长期记忆”当前只做 UI 样式：总结轮数、自动总结开关、手动总结开关；暂不接入保存、总结或提示词逻辑。
   4. 本模块不读写 DB.js / IndexedDB，不使用 localStorage/sessionStorage，不写双份存储兜底，不做长文本字段过滤。
   5. 抽屉展开继续复用既有 data-action="toggle-settings-sticker-drawer" 与 .msg-settings-chat-control-item 事件接线，避免新增无关事件和页面闪屏。
   ========================================================================== */

const ICONPARK_ARROW_RIGHT = `
  <svg viewBox="0 0 48 48" fill="none">
    <path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

/* ==========================================================================
   [区域标注·已完成·本次新增：记忆设置板块入口]
   说明：
   1. 样式参考“聊天控制”板块：左上角标题 + 暖色卡片 + 行分割线 + IconPark 风格右箭头抽屉。
   2. 开关统一复用聊天设置页 iPhone 风格 .msg-ios-switch；当前仅展示 UI，不绑定新的持久化动作。
   3. 如后续要接入长期记忆保存逻辑，可优先在本文件中补充 data-role / data-action，再由事件层写入 DB.js / IndexedDB。
   ========================================================================== */
export function renderChatMemorySettingsSection(chatSettings = {}) {
  return `
    <!-- ==================================================================
         [区域标注·已完成·本次新增：聊天设置页记忆设置板块]
         说明：
         1. 本板块由 chat-memory-settings.js 独立渲染，位于“聊天控制”板块下方。
         2. “短期记忆”已迁移到这里；“长期记忆”当前只做 UI 样式。
         3. 不新增 localStorage/sessionStorage，不新增持久化兜底，不使用原生弹窗或原生选择器。
         ================================================================== -->
    <section class="msg-settings-chat-control-section msg-settings-memory-section">
      <div class="msg-settings-section-title">记忆设置</div>
      <section class="msg-settings-card msg-settings-chat-control-card msg-settings-memory-card">
        ${renderShortTermMemoryItem(chatSettings)}
        <div class="msg-settings-avatar-divider"></div>
        ${renderLongTermMemoryItem(chatSettings)}
      </section>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次迁移：短期记忆小版块]
   说明：
   1. 本小版块已从“聊天控制”迁移到“记忆设置”。
   2. 原 data-role="msg-short-term-memory-rounds" 保持不变，既有保存逻辑继续按原链路写入 DB.js / IndexedDB。
   3. 这里只移动 UI，不修改短期记忆按轮截取、提示词拼装或任何持久化代码。
   ========================================================================== */
function renderShortTermMemoryItem(chatSettings = {}) {
  return `
    <div class="msg-settings-chat-control-item">
      <button
        class="msg-settings-row msg-settings-chat-control-toggle"
        data-action="toggle-settings-sticker-drawer"
        type="button"
        aria-label="展开短期记忆"
        aria-expanded="false">
        <span class="msg-settings-card__title">短期记忆</span>
        <span class="msg-settings-chat-control-arrow" aria-hidden="true">
          ${ICONPARK_ARROW_RIGHT}
        </span>
      </button>
      <div class="msg-settings-chat-control-drawer" data-role="settings-short-term-memory-drawer">
        <div class="msg-settings-chat-control-drawer__inner">
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>发送之前轮数</span>
            <input class="msg-settings-number-input" data-role="msg-short-term-memory-rounds" type="number" min="0" step="1" value="${escapeHtml(chatSettings.shortTermMemoryRounds ?? 8)}">
          </label>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次新增：长期记忆小版块 UI]
   说明：
   1. 本小版块当前只做 UI：总结轮数、自动总结开关、手动总结开关。
   2. “总结轮数”含义预留为总结当前聊天消息页中的 N 轮消息；一轮 = 连续用户消息组 + 角色本轮回复消息组。
   3. 自动总结 / 手动总结开关当前不绑定 data-action，避免误触发未实现逻辑；后续接入时请在本区域补充事件与 DB.js / IndexedDB 保存。
   4. 本区域不读写 localStorage/sessionStorage，不做双份存储兜底，不做长文本过滤。
   ========================================================================== */
function renderLongTermMemoryItem(chatSettings = {}) {
  const summaryRounds = chatSettings.longTermMemorySummaryRounds ?? 8;
  const autoSummaryEnabled = Boolean(chatSettings.longTermMemoryAutoSummaryEnabled);
  const manualSummaryEnabled = Boolean(chatSettings.longTermMemoryManualSummaryEnabled);

  return `
    <div class="msg-settings-chat-control-item">
      <button
        class="msg-settings-row msg-settings-chat-control-toggle"
        data-action="toggle-settings-sticker-drawer"
        type="button"
        aria-label="展开长期记忆"
        aria-expanded="false">
        <span class="msg-settings-card__title">长期记忆</span>
        <span class="msg-settings-chat-control-arrow" aria-hidden="true">
          ${ICONPARK_ARROW_RIGHT}
        </span>
      </button>
      <div class="msg-settings-chat-control-drawer" data-role="settings-long-term-memory-drawer">
        <div class="msg-settings-chat-control-drawer__inner">
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>总结轮数</span>
            <input class="msg-settings-number-input" data-role="msg-long-term-memory-summary-rounds" type="number" min="1" step="1" value="${escapeHtml(summaryRounds)}">
          </label>
          <div class="msg-settings-avatar-divider"></div>
          <div class="msg-settings-row msg-settings-chat-control-console-row">
            <div class="msg-settings-card__title">自动总结</div>
            <button class="msg-ios-switch ${autoSummaryEnabled ? 'is-on' : ''}" data-role="msg-long-term-memory-auto-summary-switch" type="button" aria-label="自动总结"></button>
          </div>
          <div class="msg-settings-avatar-divider"></div>
          <div class="msg-settings-row msg-settings-chat-control-console-row">
            <div class="msg-settings-card__title">手动总结</div>
            <button class="msg-ios-switch ${manualSummaryEnabled ? 'is-on' : ''}" data-role="msg-long-term-memory-manual-summary-switch" type="button" aria-label="手动总结"></button>
          </div>
        </div>
      </div>
    </div>
  `;
}
