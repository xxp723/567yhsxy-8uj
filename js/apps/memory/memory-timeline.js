/**
 * 文件名: js/apps/memory/memory-timeline.js
 * 用途: 旧事应用闲谈记忆时间线功能。
 * 说明:
 * 1. 本文件负责记忆条目排序、时间线渲染、标签与状态展示。
 * 2. 编辑、删除、开关动作只输出 data-action，由 index.js 统一接线。
 */
import {
  MEMORY_ICONS,
  escapeHtml,
  formatDateTime,
  getMemoryTypeMeta,
  renderBadge,
  renderEmptyState,
  renderIconButton,
  renderSwitchButton
} from './memory-ui.js';

/* ==========================================================================
   [区域标注·已完成·旧事时间线排序区]
   说明：闲谈记忆按 timelineAt 倒序展示，后续改排序规则只改本区。
   ========================================================================== */
export function sortTimelineItems(items = []) {
  return [...(Array.isArray(items) ? items : [])]
    .sort((a, b) => Number(b.timelineAt || 0) - Number(a.timelineAt || 0));
}

function renderStatusBadges(item) {
  const badges = [];
  if (item.type === 'longterm' && item.isPermanent) {
    badges.push(renderBadge('重点固定注入', MEMORY_ICONS.pin));
  } else if (item.injectionEnabled) {
    badges.push(renderBadge('允许注入', MEMORY_ICONS.link));
  }
  return badges.length ? `<div class="memory-badges">${badges.join('')}</div>` : '';
}

/* ==========================================================================
   [区域标注·已完成·本次旧事大总结卡片对钩多选态渲染区]
   说明：
   1. 大总结模式下整张记忆卡片可点选，选中态用 IconPark 风格“对钩”与卡片描边显示。
   2. 不再在页面主体显示大号“大总结”图标；固定底部栏负责全选、总结、删除、取消、回溯。
   3. 编辑、删除、开关动作仍只输出 data-action，由 index.js 统一走应用内逻辑与 IndexedDB 持久化。
   ========================================================================== */
export function renderMemoryItem(item, { grandSummaryMode = false, selectedIds = new Set() } = {}) {
  const meta = getMemoryTypeMeta(item.type);
  const tags = Array.isArray(item.emotionTags) ? item.emotionTags : [];
  const typeLabel = item.type === 'longterm' && item.isPermanent ? '重点长期' : meta.label;
  const selected = selectedIds.has(item.id);
  const grandSummaryAttrs = grandSummaryMode
    ? `data-action="toggle-grand-summary-item" aria-pressed="${selected ? 'true' : 'false'}" aria-label="${selected ? '取消选择这条记忆' : '选择这条记忆'}"`
    : '';

  return `
    <article class="memory-item-card ${grandSummaryMode ? 'is-grand-summary-selectable' : ''} ${selected ? 'is-grand-summary-selected' : ''}" data-id="${escapeHtml(item.id)}" ${grandSummaryAttrs}>
      ${grandSummaryMode ? `
        <span class="memory-grand-summary-check ${selected ? 'is-selected' : ''}" aria-hidden="true">
          ${selected ? MEMORY_ICONS.check : ''}
        </span>
      ` : ''}
      <div class="memory-item-card__top">
        <div class="memory-item-card__body">
          <div class="memory-item-card__title-row">
            <div class="memory-item-card__meta">${escapeHtml(typeLabel)} · ${escapeHtml(formatDateTime(item.timelineAt))}</div>
            <div class="memory-item-actions memory-item-actions--top">
              ${renderIconButton({ action: 'cycle-memory-type', id: item.id, icon: MEMORY_ICONS.cycle, label: '切换记忆类型', extraClass: 'memory-card-action' })}
              ${renderIconButton({ action: 'open-edit', id: item.id, icon: MEMORY_ICONS.feather, label: '编辑这段记忆', extraClass: 'memory-card-action' })}
            </div>
          </div>
          ${renderStatusBadges(item)}
          <div class="memory-item-card__summary">${escapeHtml(item.summary || '未填写摘要')}</div>
          ${tags.length ? `
            <div class="memory-tags">
              ${tags.map((tag) => `<span class="memory-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="memory-item-card__footer">
        <div class="memory-switch-group">
          <span class="memory-switch-label">允许注入</span>
          ${renderSwitchButton({ action: 'toggle-injection', id: item.id, active: item.injectionEnabled, label: '切换允许注入' })}
        </div>
        <div class="memory-item-actions memory-item-actions--bottom">
          ${renderIconButton({ action: 'open-delete', id: item.id, icon: MEMORY_ICONS.remove, label: '删除这段记忆', danger: true, extraClass: 'memory-card-action' })}
        </div>
      </div>
    </article>
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事大总结多选时间线渲染区]
   说明：
   1. 大总结模式下每条记忆显示应用内自绘选择按钮，不使用浏览器原生 checkbox/select。
   2. 多选按钮只输出 data-action，由 index.js 统一调用副 API 与 IndexedDB 写入逻辑。
   ========================================================================== */
export function renderTimeline(items = [], options = {}) {
  const sorted = sortTimelineItems(items);
  if (!sorted.length) {
    return renderEmptyState(
      '没有匹配的闲谈记忆',
      '可以新增一条记忆，或调整关键词与时间范围。',
      MEMORY_ICONS.search
    );
  }

  return `
    <section class="memory-timeline ${options.grandSummaryMode ? 'is-grand-summary-mode' : ''}">
      ${sorted.map((item) => renderMemoryItem(item, options)).join('')}
    </section>
  `;
}
