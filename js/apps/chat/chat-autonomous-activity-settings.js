// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-autonomous-activity-settings.js
 * 用途: 闲谈应用 — 聊天设置页“自主活动”独立功能模块
 * 架构层: 应用层（闲谈子模块）
 */

import {
  dbPut,
  escapeHtml,
  getCurrentChatPromptSettingsKey
} from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·自主活动设置默认值]
   说明：
   1. 本模块集中管理聊天设置页“自主活动”区域，方便后续针对性修改。
   2. 当前设置按“当前面具 + 当前聊天对象”写入 chatPromptSettings。
   3. 持久化统一通过 dbPut -> DB.js / IndexedDB；不使用 localStorage/sessionStorage，不写双份存储兜底。
   4. 默认关闭“主动发朋友圈”；默认时间间隔为 1 小时。
   ========================================================================== */
export const DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS = Object.freeze({
  autonomousMomentsEnabled: false,
  autonomousMomentsIntervalValue: 1,
  autonomousMomentsIntervalUnit: 'hour'
});

export const AUTONOMOUS_ACTIVITY_INTERVAL_UNITS = Object.freeze([
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' }
]);

function isValidAutonomousActivityUnit(unit = '') {
  return AUTONOMOUS_ACTIVITY_INTERVAL_UNITS.some(item => item.value === unit);
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置规范化]
   说明：
   1. 只规范化“自主活动”相关字段，不改动其它聊天设置字段。
   2. 时间间隔数值最小为 1；单位仅允许“分钟 / 小时”两种应用内分段按钮值。
   3. 不使用浏览器原生选择器，不使用浏览器原生弹窗。
   ========================================================================== */
export function normalizeAutonomousActivitySettings(source = {}) {
  const settings = source && typeof source === 'object' ? source : {};
  const rawValue = Number(settings.autonomousMomentsIntervalValue ?? DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue);
  const intervalValue = Number.isFinite(rawValue)
    ? Math.max(1, Math.floor(rawValue))
    : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue;
  const rawUnit = String(settings.autonomousMomentsIntervalUnit || DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalUnit);

  return {
    autonomousMomentsEnabled: Boolean(settings.autonomousMomentsEnabled),
    autonomousMomentsIntervalValue: intervalValue,
    autonomousMomentsIntervalUnit: isValidAutonomousActivityUnit(rawUnit)
      ? rawUnit
      : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalUnit
  };
}

function ensureStateAutonomousActivitySettings(state) {
  if (!state.chatPromptSettings || typeof state.chatPromptSettings !== 'object') {
    state.chatPromptSettings = {};
  }

  const normalized = normalizeAutonomousActivitySettings(state.chatPromptSettings);
  Object.assign(state.chatPromptSettings, normalized);
  return normalized;
}

async function persistAutonomousActivitySettings(state, db) {
  await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置渲染]
   说明：
   1. 参考“头像与备注”板块：外层标题在左上方，内部使用同款暖色卡片与 iPhone 风格滑动开关。
   2. 开启“主动发朋友圈”后，详细设置以抽屉方式向下展开。
   3. 单位选择使用应用内分段按钮，不使用浏览器原生 select。
   4. 本渲染函数不读写持久化存储；保存由本模块事件函数写入 DB.js / IndexedDB。
   ========================================================================== */
export function renderAutonomousActivitySettingsSection(chatSettings = {}) {
  const settings = normalizeAutonomousActivitySettings(chatSettings);
  const drawerId = 'msg-autonomous-activity-drawer';
  const isEnabled = Boolean(settings.autonomousMomentsEnabled);

  return `
        <!-- ==================================================================
             [区域标注·已完成·自主活动设置模块]
             说明：
             1. 本区域已拆分到 chat-autonomous-activity-settings.js，后续修改“自主活动”优先改该模块。
             2. “主动发朋友圈”开关与时间间隔保存到当前聊天对象 chatPromptSettings。
             3. 持久化统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage，不写双份存储兜底。
             4. 单位切换使用应用内分段按钮，不使用浏览器原生选择器。
             ================================================================== -->
        <section class="msg-settings-avatar-section msg-autonomous-activity-section" data-role="msg-autonomous-activity-section">
          <div class="msg-settings-section-title">自主活动</div>
          <section class="msg-settings-card msg-settings-avatar-card msg-autonomous-activity-card">
            <div class="msg-settings-row msg-settings-avatar-switch-row">
              <div class="msg-settings-avatar-switch-copy">
                <div class="msg-settings-card__title">主动发朋友圈</div>
                <div class="msg-settings-card__desc">开启后，角色会按设定间隔主动发布朋友圈动态。</div>
              </div>
              <button
                class="msg-ios-switch ${isEnabled ? 'is-on' : ''}"
                data-action="toggle-autonomous-moments"
                type="button"
                aria-label="主动发朋友圈"
                aria-controls="${drawerId}"
                aria-expanded="${isEnabled ? 'true' : 'false'}"></button>
            </div>
            <div
              class="msg-autonomous-activity-drawer ${isEnabled ? 'is-open' : ''}"
              id="${drawerId}"
              data-role="msg-autonomous-activity-drawer"
              aria-hidden="${isEnabled ? 'false' : 'true'}">
              <div class="msg-settings-avatar-divider"></div>
              <div class="msg-autonomous-activity-drawer__inner">
                <div class="msg-settings-card__title">角色主动发布朋友圈动态的时间间隔</div>
                <div class="msg-autonomous-activity-interval-row">
                  <label class="msg-settings-number-field msg-autonomous-activity-interval-value">
                    <span>间隔数值</span>
                    <input
                      class="msg-settings-number-input"
                      data-role="msg-autonomous-moments-interval-value"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      step="1"
                      value="${escapeHtml(settings.autonomousMomentsIntervalValue)}">
                  </label>
                  <div class="msg-autonomous-activity-unit-field">
                    <span>时间单位</span>
                    <div class="msg-autonomous-activity-unit-group" data-role="msg-autonomous-moments-unit-group">
                      ${AUTONOMOUS_ACTIVITY_INTERVAL_UNITS.map(unit => `
                        <button
                          class="msg-autonomous-activity-unit-btn ${settings.autonomousMomentsIntervalUnit === unit.value ? 'is-active' : ''}"
                          data-action="set-autonomous-moments-interval-unit"
                          data-autonomous-unit="${escapeHtml(unit.value)}"
                          type="button">
                          ${escapeHtml(unit.label)}
                        </button>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>`;
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置局部同步]
   说明：
   1. 只同步“自主活动”设置区域的开关、抽屉和单位按钮，不重渲染整个聊天页，避免页面闪屏。
   2. 本函数不做持久化；持久化由点击/输入事件函数负责。
   ========================================================================== */
export function syncAutonomousActivitySettingsSection(container, state) {
  const section = container?.querySelector?.('[data-role="msg-autonomous-activity-section"]');
  if (!section) return;

  const settings = ensureStateAutonomousActivitySettings(state);
  const switchButton = section.querySelector('[data-action="toggle-autonomous-moments"]');
  const drawer = section.querySelector('[data-role="msg-autonomous-activity-drawer"]');
  const valueInput = section.querySelector('[data-role="msg-autonomous-moments-interval-value"]');

  if (switchButton) {
    switchButton.classList.toggle('is-on', settings.autonomousMomentsEnabled);
    switchButton.setAttribute('aria-expanded', settings.autonomousMomentsEnabled ? 'true' : 'false');
  }

  if (drawer) {
    drawer.classList.toggle('is-open', settings.autonomousMomentsEnabled);
    drawer.setAttribute('aria-hidden', settings.autonomousMomentsEnabled ? 'false' : 'true');
  }

  if (valueInput && String(valueInput.value) !== String(settings.autonomousMomentsIntervalValue)) {
    valueInput.value = String(settings.autonomousMomentsIntervalValue);
  }

  section.querySelectorAll('[data-action="set-autonomous-moments-interval-unit"]').forEach(button => {
    button.classList.toggle('is-active', String(button.dataset.autonomousUnit || '') === settings.autonomousMomentsIntervalUnit);
  });
}

/* ==========================================================================
   [区域标注·已完成·自主活动点击事件接线]
   说明：
   1. 处理“主动发朋友圈”滑动开关与“分钟 / 小时”单位按钮。
   2. 所有变更立即保存到 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不使用浏览器原生弹窗或原生选择器。
   ========================================================================== */
export async function handleAutonomousActivitySettingsClick({
  action = '',
  target = null,
  state = {},
  container = null,
  db = null
} = {}) {
  if (action === 'toggle-autonomous-moments') {
    ensureStateAutonomousActivitySettings(state);
    state.chatPromptSettings.autonomousMomentsEnabled = !state.chatPromptSettings.autonomousMomentsEnabled;
    ensureStateAutonomousActivitySettings(state);
    await persistAutonomousActivitySettings(state, db);
    syncAutonomousActivitySettingsSection(container, state);
    return true;
  }

  if (action === 'set-autonomous-moments-interval-unit') {
    const unit = String(target?.dataset?.autonomousUnit || '').trim();
    if (!isValidAutonomousActivityUnit(unit)) return true;

    ensureStateAutonomousActivitySettings(state);
    state.chatPromptSettings.autonomousMomentsIntervalUnit = unit;
    ensureStateAutonomousActivitySettings(state);
    await persistAutonomousActivitySettings(state, db);
    syncAutonomousActivitySettingsSection(container, state);
    return true;
  }

  return false;
}

/* ==========================================================================
   [区域标注·已完成·自主活动输入事件接线]
   说明：
   1. 处理“角色主动发布朋友圈动态的时间间隔”数值输入。
   2. 数值最小为 1，保存到当前聊天对象 chatPromptSettings。
   3. 持久化统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   ========================================================================== */
export function handleAutonomousActivitySettingsInput(e, state, container, db) {
  const target = e?.target;
  if (!target?.matches?.('[data-role="msg-autonomous-moments-interval-value"]')) return false;

  ensureStateAutonomousActivitySettings(state);
  const rawValue = Number(target.value || DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue);
  const nextValue = Number.isFinite(rawValue)
    ? Math.max(1, Math.floor(rawValue))
    : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue;

  state.chatPromptSettings.autonomousMomentsIntervalValue = nextValue;
  ensureStateAutonomousActivitySettings(state);

  if (String(target.value) !== String(nextValue)) {
    target.value = String(nextValue);
  }

  dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
  syncAutonomousActivitySettingsSection(container, state);
  return true;
}
