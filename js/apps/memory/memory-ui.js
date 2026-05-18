/**
 * 文件名: js/apps/memory/memory-ui.js
 * 用途: 旧事应用通用 UI 片段与 IconPark 风格图标集合。
 * 说明:
 * 1. 本文件只负责展示辅助，不读写持久化数据。
 * 2. 所有按钮图标统一使用 IconPark 字节跳动开源图标的 outline 视觉风格内联 SVG。
 */

/* ==========================================================================
   [区域标注·已完成·旧事IconPark图标区]
   说明：所有旧事按钮/状态图案统一从这里引用，后续换图标只改本区。
   ========================================================================== */
export const MEMORY_ICONS = {
  back: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  add: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 10V38M10 24H38" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M21 36C29.2843 36 36 29.2843 36 21C36 12.7157 29.2843 6 21 6C12.7157 6 6 12.7157 6 21C6 29.2843 12.7157 36 21 36Z" stroke="currentColor" stroke-width="4"/><path d="M32 32L42 42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" stroke-width="4"/><path d="M24 12V25L33 30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 42H17L41 18L31 8L7 32V42Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M28 11L38 21" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  remove: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 13H38" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 13V9H30V13" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M14 19L16 41H32L34 19" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M21 24V35M27 24V35" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  save: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 5H34L41 12V43H9V5Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M17 5V18H31V5" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M16 43V29H32V43" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M14 14L34 34M34 14L14 34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 24C29.5228 24 34 19.5228 34 14C34 8.47715 29.5228 4 24 4C18.4772 4 14 8.47715 14 14C14 19.5228 18.4772 24 24 24Z" stroke="currentColor" stroke-width="4"/><path d="M8 44C8 35.1634 15.1634 28 24 28C32.8366 28 40 35.1634 40 44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  chat: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M6 10C6 7.79086 7.79086 6 10 6H38C40.2091 6 42 7.79086 42 10V30C42 32.2091 40.2091 34 38 34H19L8 42V34H10C7.79086 34 6 32.2091 6 30V10Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M15 18H33M15 26H27" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  memory: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 10H38V38H10V10Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M17 4V12M31 4V12M17 36V44M31 36V44M4 17H12M4 31H12M36 17H44M36 31H44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 20H30V30H18V20Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
  pin: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M30 4L44 18L34 20L26 28L20 42L18 30L6 28L20 22L28 14L30 4Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M20 14L22 12C26.4183 7.58172 33.5817 7.58172 38 12C42.4183 16.4183 42.4183 23.5817 38 28L34 32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M28 34L26 36C21.5817 40.4183 14.4183 40.4183 10 36C5.58172 31.5817 5.58172 24.4183 10 20L14 16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 30L30 18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 4L29 19L44 24L29 29L24 44L19 29L4 24L19 19L24 4Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
  warning: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 5L46 43H2L24 5Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 18V29M24 35V36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  calendar: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 10H40V42H8V10Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M16 6V14M32 6V14M8 20H40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M16 28H18M23 28H25M30 28H32M16 35H18M23 35H25M30 35H32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  clear: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 24C10 16.268 16.268 10 24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24Z" stroke="currentColor" stroke-width="4"/><path d="M18 18L30 30M30 18L18 30" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  cycle: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M36 15C32.8 10.8 27.8 8 22 8C12.6 8 5 15.6 5 25" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M36 6V15H27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 33C15.2 37.2 20.2 40 26 40C35.4 40 43 32.4 43 23" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M12 42V33H21" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  feather: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M42 6C30 6 18 12 12 24C8.5 31 8 38 8 42C12 42 19 41.5 26 38C38 32 44 20 42 6Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M30 18L8 42" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M20 30H11M27 23H18" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'
};

/* ==========================================================================
   [区域标注·已完成·旧事安全文本工具区]
   说明：统一转义用户可编辑文本，避免记忆标题/摘要/标签注入 HTML。
   ========================================================================== */
export function escapeHtml(value) {
  const amp = String.fromCharCode(38);
  return String(value ?? '')
    .replaceAll('&', `${amp}amp;`)
    .replaceAll('<', `${amp}lt;`)
    .replaceAll('>', `${amp}gt;`)
    .replaceAll('"', `${amp}quot;`)
    .replaceAll("'", `${amp}#39;`);
}

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function parseTagInput(value) {
  return normalizeText(value)
    .split(/[，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 12);
}

export function formatDateTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateOnly(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ==========================================================================
   [区域标注·已完成·旧事应用内时间选择器工具区]
   说明：
   1. 旧事的发生时间与自定义时间筛选统一走应用内时间选择器，不使用浏览器原生日期/时间选择器。
   2. 本区只负责日期时间格式、选项生成与按钮渲染，不读写 localStorage/sessionStorage，也不做持久化兜底。
   ========================================================================== */
export function getDateParts(value, { includeTime = false, endOfDay = false } = {}) {
  const parsed = parseDateText(value, endOfDay);
  const date = new Date(parsed || Date.now());
  const pad = (n) => String(n).padStart(2, '0');

  return {
    year: date.getFullYear(),
    month: pad(date.getMonth() + 1),
    day: pad(date.getDate()),
    hour: pad(date.getHours()),
    minute: pad(date.getMinutes()),
    text: includeTime ? formatDateTime(date.getTime()) : formatDateOnly(date.getTime())
  };
}

export function buildDateText(parts = {}, { includeTime = false, endOfDay = false } = {}) {
  const now = getDateParts(Date.now(), { includeTime, endOfDay });
  const year = Number(parts.year) || now.year;
  const month = String(parts.month || now.month).padStart(2, '0');
  const day = String(parts.day || now.day).padStart(2, '0');

  if (!includeTime) return `${year}-${month}-${day}`;

  const hour = String(parts.hour ?? (endOfDay ? '23' : now.hour)).padStart(2, '0');
  const minute = String(parts.minute ?? (endOfDay ? '59' : now.minute)).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function renderDateTimePickerButton({
  field,
  value,
  label = '打开时间选择器',
  includeTime = false,
  endOfDay = false,
  searchField = ''
} = {}) {
  const safeValue = normalizeText(value) || buildDateText({}, { includeTime, endOfDay });
  const display = includeTime ? formatDateTime(parseDateText(safeValue) || Date.now()) : safeValue;
  return `
    <button class="memory-date-picker-trigger" type="button" data-action="open-time-picker" data-picker-field="${escapeHtml(field)}" data-picker-include-time="${includeTime ? 'true' : 'false'}" data-picker-end-of-day="${endOfDay ? 'true' : 'false'}" ${searchField ? `data-picker-search-field="${escapeHtml(searchField)}"` : ''} aria-label="${escapeHtml(label)}">
      ${MEMORY_ICONS.calendar}
      <span>${escapeHtml(display)}</span>
    </button>
    <input type="hidden" name="${escapeHtml(field)}" ${searchField ? `data-search-field="${escapeHtml(searchField)}"` : ''} value="${escapeHtml(safeValue)}">
  `;
}

export function renderTimePickerModal(picker) {
  if (!picker) return '';

  const parts = getDateParts(picker.value, {
    includeTime: Boolean(picker.includeTime),
    endOfDay: Boolean(picker.endOfDay)
  });
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, index) => currentYear - 5 + index);
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
  const renderOptions = (name, values, active) => `
    <div class="memory-time-picker__column" data-picker-part="${escapeHtml(name)}">
      ${values.map((item) => `
        <button class="memory-time-picker__option ${String(item) === String(active) ? 'is-active' : ''}" type="button" data-action="set-time-picker-part" data-picker-part="${escapeHtml(name)}" data-picker-value="${escapeHtml(item)}">${escapeHtml(item)}</button>
      `).join('')}
    </div>
  `;

  return `
    <section class="memory-form-modal memory-time-picker-modal" role="dialog" aria-modal="true" aria-label="时间选择器">
      <div class="memory-form-modal__panel memory-form-modal__panel--compact">
        <div class="memory-form-modal__head">
          <h3>时间选择器</h3>
          ${renderIconButton({ action: 'close-time-picker', icon: MEMORY_ICONS.close, label: '关闭时间选择器' })}
        </div>
        <div class="memory-time-picker">
          ${renderOptions('year', years, parts.year)}
          ${renderOptions('month', months, parts.month)}
          ${renderOptions('day', days, parts.day)}
          ${picker.includeTime ? renderOptions('hour', hours, parts.hour) : ''}
          ${picker.includeTime ? renderOptions('minute', minutes, parts.minute) : ''}
        </div>
        <div class="memory-form-modal__foot">
          <button class="memory-primary-btn" type="button" data-action="apply-time-picker">${MEMORY_ICONS.save}<span>确定</span></button>
        </div>
      </div>
    </section>
  `;
}

export function parseDateText(value, endOfDay = false) {
  const text = normalizeText(value);
  if (!text) return 0;
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!match) return 0;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    match[4] ? Number(match[4]) : endOfDay ? 23 : 0,
    match[5] ? Number(match[5]) : endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

/* ==========================================================================
   [区域标注·已完成·旧事记忆类型展示区]
   说明：集中维护记忆类型名称、图标与说明，后续改类型文案只改这里。
   ========================================================================== */
export const MEMORY_TYPE_META = {
  longterm: {
    label: '长期记忆',
    icon: MEMORY_ICONS.memory,
    desc: '100~200字精炼摘要，适合沉淀稳定关系与事件脉络。'
  },
  redline: {
    label: '红线铁则',
    icon: MEMORY_ICONS.warning,
    desc: '独立高优先级规则，会稳定参与注入。'
  },
  flashbulb: {
    label: '闪光灯记忆',
    icon: MEMORY_ICONS.spark,
    desc: '强情绪冲击瞬间，在相关语境中作为高优先级候选。'
  },
  pending: {
    label: '待确认',
    icon: MEMORY_ICONS.chat,
    desc: '需要确认后再进入正式记忆与注入流程。'
  }
};

export function getMemoryTypeMeta(type) {
  return MEMORY_TYPE_META[type] || MEMORY_TYPE_META.longterm;
}

/* ==========================================================================
   [区域标注·已完成·旧事通用渲染片段区]
   说明：卡片、空状态、统计块、开关均在这里集中维护，功能文件只传数据。
   ========================================================================== */
export function renderIconButton({ action, id = '', icon, label, danger = false, extraClass = '', extraAttrs = '' }) {
  return `
    <button class="memory-icon-btn ${danger ? 'is-danger' : ''} ${extraClass}" type="button" data-action="${escapeHtml(action)}" ${id ? `data-id="${escapeHtml(id)}"` : ''} ${extraAttrs} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      ${icon}
    </button>
  `;
}

export function renderSwitchButton({ action, id, active, label, extraAttrs = '' }) {
  return `
    <button class="memory-ios-switch ${active ? 'is-on' : ''}" type="button" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" ${extraAttrs} aria-pressed="${active ? 'true' : 'false'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="memory-ios-switch__track"><span class="memory-ios-switch__thumb"></span></span>
    </button>
  `;
}

export function renderStatCard(label, value, icon = '') {
  return `
    <article class="memory-stat-card">
      ${icon ? `<span class="memory-stat-card__icon">${icon}</span>` : ''}
      <span class="memory-stat-card__value">${escapeHtml(value)}</span>
      <span class="memory-stat-card__label">${escapeHtml(label)}</span>
    </article>
  `;
}

export function renderEmptyState(title, desc, icon = MEMORY_ICONS.memory) {
  return `
    <section class="memory-empty">
      <div class="memory-empty__icon">${icon}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
    </section>
  `;
}

export function renderAvatar(character, extraClass = '') {
  const name = normalizeText(character?.name) || '未命名';
  const avatar = normalizeText(character?.avatar);
  if (avatar) {
    return `<span class="memory-avatar ${extraClass} has-image"><img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}"></span>`;
  }
  return `<span class="memory-avatar ${extraClass}">${MEMORY_ICONS.user}</span>`;
}

export function renderBadge(label, icon = '') {
  return `<span class="memory-badge">${icon}<span>${escapeHtml(label)}</span></span>`;
}

export function createToast(root) {
  let timer = 0;
  const el = document.createElement('div');
  el.className = 'memory-toast';
  el.setAttribute('aria-live', 'polite');
  root.appendChild(el);

  return {
    show(message) {
      window.clearTimeout(timer);
      el.textContent = String(message || '');
      el.classList.add('is-show');
      timer = window.setTimeout(() => el.classList.remove('is-show'), 1800);
    },
    destroy() {
      window.clearTimeout(timer);
      el.remove();
    }
  };
}
