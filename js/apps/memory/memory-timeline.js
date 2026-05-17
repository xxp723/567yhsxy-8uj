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
   [区域标注·已完成·旧事时间线条目渲染区]
   说明：
   1. 每条记忆已去除事件标题展示，仅展示摘要、时间、情绪标签、注入状态与编辑入口。
   2. 条目底部只保留“允许注入”滑动开关；重点长期由编辑弹窗中的类型按钮维护。
   ========================================================================== */
export function renderMemoryItem(item) {
  const meta = getMemoryTypeMeta(item.type);
  const tags = Array.isArray(item.emotionTags) ? item.emotionTags : [];
  const typeLabel = item.type === 'longterm' && item.isPermanent ? '重点长期' : meta.label;

  return `
    <article class="memory-item-card" data-id="${escapeHtml(item.id)}">
      <div class="memory-item-card__top">
        <span class="memory-item-card__type" title="${escapeHtml(typeLabel)}">${meta.icon}</span>
        <div class="memory-item-card__body">
          <div class="memory-item-card__title-row">
            <div class="memory-item-card__meta">${escapeHtml(typeLabel)} · ${escapeHtml(formatDateTime(item.timelineAt))}</div>
            <div class="memory-actions">
              ${renderIconButton({ action: 'open-edit', id: item.id, icon: MEMORY_ICONS.edit, label: '编辑记忆' })}
              ${renderIconButton({ action: 'open-delete', id: item.id, icon: MEMORY_ICONS.remove, label: '删除记忆', danger: true })}
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
      </div>
    </article>
  `;
}

export function renderTimeline(items = []) {
  const sorted = sortTimelineItems(items);
  if (!sorted.length) {
    return renderEmptyState(
      '没有匹配的闲谈记忆',
      '可以新增一条记忆，或调整关键词与时间范围。',
      MEMORY_ICONS.search
    );
  }

  return `
    <section class="memory-timeline">
      ${sorted.map((item) => renderMemoryItem(item)).join('')}
    </section>
  `;
}
