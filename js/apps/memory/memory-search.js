/**
 * 文件名: js/apps/memory/memory-search.js
 * 用途: 旧事应用单角色页搜索功能。
 * 说明:
 * 1. 本文件只负责搜索栏渲染、搜索状态与结果过滤。
 * 2. 不使用浏览器原生日期选择器；自定义时间段使用普通文本输入 YYYY-MM-DD。
 */
import {
  MEMORY_ICONS,
  escapeHtml,
  formatDateOnly,
  getMemoryTypeMeta,
  normalizeText,
  parseDateText
} from './memory-ui.js';

export const MEMORY_TIME_PRESETS = {
  all: { label: '全部', days: 0 },
  today: { label: '今天', days: 1 },
  seven: { label: '最近7天', days: 7 },
  thirty: { label: '最近30天', days: 30 },
  custom: { label: '自定义时间段', days: -1 }
};

/* ==========================================================================
   [区域标注·已完成·旧事搜索状态区]
   说明：单角色页搜索条件集中在这里维护，后续改搜索模式只改本区。
   ========================================================================== */
export function createDefaultSearchState() {
  return {
    keyword: '',
    timePreset: 'all',
    customStartDate: '',
    customEndDate: ''
  };
}

export function resetSearchState(state) {
  state.search = createDefaultSearchState();
}

export function patchSearchState(state, patch = {}) {
  state.search = {
    ...createDefaultSearchState(),
    ...(state.search || {}),
    ...patch
  };
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getEndOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function getTimeRange(search = {}) {
  const preset = search.timePreset || 'all';

  if (preset === 'today') {
    return { startTime: getStartOfToday(), endTime: getEndOfToday() };
  }

  if (preset === 'seven' || preset === 'thirty') {
    const days = MEMORY_TIME_PRESETS[preset].days;
    return {
      startTime: getStartOfToday() - (days - 1) * 24 * 60 * 60 * 1000,
      endTime: getEndOfToday()
    };
  }

  if (preset === 'custom') {
    return {
      startTime: parseDateText(search.customStartDate, false),
      endTime: parseDateText(search.customEndDate, true)
    };
  }

  return { startTime: 0, endTime: 0 };
}

/* ==========================================================================
   [区域标注·已完成·旧事搜索过滤与面板精简区]
   说明：
   1. 关键词仍搜索标题 / 摘要 / 情绪标签；时间搜索 timelineAt 字段。
   2. 单个应用记忆页已删除“搜索闲谈记忆”标题和输入框说明文字，只保留简洁搜索栏。
   ========================================================================== */
export function filterMemoryItems(items = [], search = {}) {
  const keyword = normalizeText(search.keyword).toLowerCase();
  const { startTime, endTime } = getTimeRange(search);

  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      const time = Number(item.timelineAt) || 0;
      if (startTime && time < startTime) return false;
      if (endTime && time > endTime) return false;

      if (!keyword) return true;
      const haystack = [
        item.title,
        item.summary,
        getMemoryTypeMeta(item.type).label,
        ...(Array.isArray(item.emotionTags) ? item.emotionTags : [])
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => Number(b.timelineAt || 0) - Number(a.timelineAt || 0));
}

export function renderSearchPanel(search = createDefaultSearchState()) {
  const safe = { ...createDefaultSearchState(), ...search };
  const presetButtons = Object.entries(MEMORY_TIME_PRESETS).map(([key, meta]) => `
    <button class="memory-filter-chip ${safe.timePreset === key ? 'is-active' : ''}" type="button" data-action="set-time-preset" data-preset="${escapeHtml(key)}">
      ${escapeHtml(meta.label)}
    </button>
  `).join('');

  return `
    <section class="memory-search-panel">
      <label class="memory-search">
        ${MEMORY_ICONS.search}
        <input data-search-field="keyword" type="text" value="${escapeHtml(safe.keyword)}" placeholder="">
      </label>
      <div class="memory-time-search">
        <div class="memory-time-search__head">
          ${MEMORY_ICONS.calendar}
          <span>按时间搜索</span>
        </div>
        <div class="memory-filter-chips">
          ${presetButtons}
        </div>
        ${safe.timePreset === 'custom' ? `
          <div class="memory-custom-range">
            <label class="memory-date-filter">
              <span>开始</span>
              <input data-search-field="customStartDate" type="text" value="${escapeHtml(safe.customStartDate)}" placeholder="${escapeHtml(formatDateOnly(Date.now()))}">
            </label>
            <label class="memory-date-filter">
              <span>结束</span>
              <input data-search-field="customEndDate" type="text" value="${escapeHtml(safe.customEndDate)}" placeholder="${escapeHtml(formatDateOnly(Date.now()))}">
            </label>
          </div>
        ` : ''}
      </div>
    </section>
  `;
}
