/**
 * 文件名: js/apps/memory/memory-roles.js
 * 用途: 旧事应用角色列表页功能。
 * 说明:
 * 1. 本文件只负责角色列表页渲染与角色统计展示。
 * 2. 数据由 index.js 传入，不在这里读写持久化存储。
 */
import { getMemoryStats } from './memory-injection.js';
import {
  MEMORY_ICONS,
  escapeHtml,
  formatDateTime,
  renderAvatar,
  renderEmptyState
} from './memory-ui.js';

/* ==========================================================================
   [区域标注·已完成·旧事角色列表统计区]
   说明：角色卡只显示头像、角色名、总记忆数、允许注入数、重点长期数、最近更新时间。
   ========================================================================== */
export function getCharacterMemoryItems(state, characterId) {
  const record = state.recordsByCharacterId?.[characterId];
  return Array.isArray(record?.chatMemory?.items) ? record.chatMemory.items : [];
}

export function getCharacterUpdatedAt(state, characterId) {
  const record = state.recordsByCharacterId?.[characterId];
  return Number(record?.updatedAt) || 0;
}

export function renderCharacterList(state) {
  const characters = Array.isArray(state.characters) ? state.characters : [];
  if (!characters.length) {
    return renderEmptyState(
      '暂无角色档案',
      '旧事会读取档案应用中的角色列表。请先在档案应用创建角色，再回来管理闲谈记忆。',
      MEMORY_ICONS.user
    );
  }

  return characters.map((character) => {
    const items = getCharacterMemoryItems(state, character.id);
    const stats = getMemoryStats(items);
    const updatedAt = getCharacterUpdatedAt(state, character.id);
    const active = character.id === state.selectedCharacterId;

    return `
      <button class="memory-character-card ${active ? 'is-active' : ''}" type="button" data-action="select-character" data-id="${escapeHtml(character.id)}">
        ${renderAvatar(character)}
        <span class="memory-character-card__main">
          <span class="memory-character-card__name">${escapeHtml(character.name)}</span>
          <span class="memory-character-card__stats">
            <span>总记忆数 ${escapeHtml(stats.total)}</span>
            <span>允许注入 ${escapeHtml(stats.injected)}</span>
            <span>重点长期 ${escapeHtml(stats.focusLongterm)}</span>
          </span>
          <span class="memory-character-card__meta">最近更新：${escapeHtml(updatedAt ? formatDateTime(updatedAt) : '暂无')}</span>
        </span>
      </button>
    `;
  }).join('');
}

export function getSelectedCharacter(state) {
  return (Array.isArray(state.characters) ? state.characters : [])
    .find((character) => character.id === state.selectedCharacterId) || null;
}

export function getSelectedRecord(state) {
  return state.recordsByCharacterId?.[state.selectedCharacterId] || null;
}

export function getSelectedItems(state) {
  const record = getSelectedRecord(state);
  return Array.isArray(record?.chatMemory?.items) ? record.chatMemory.items : [];
}
