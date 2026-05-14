/**
 * 文件名: js/apps/memory/index.js
 * 用途: 旧事（Memory）应用入口模块。
 * 说明:
 * 1. 本文件只负责旧事应用初始化、模块接线与事件分发。
 * 2. 持久化全部经 memory-db.js → AppDataStore → DB.js → IndexedDB。
 * 3. 弹窗全部为应用内自绘弹窗，不调用 alert/confirm/prompt，不使用浏览器原生选择器。
 */
import {
  loadMemoryBootData,
  patchMemoryItem,
  removeMemoryItem,
  upsertMemoryItem
} from './memory-db.js';
import {
  applyFormToggle,
  applyTypeChoice,
  parseMemoryForm,
  renderDeleteModal,
  renderMemoryFormModal
} from './memory-editor.js';
import { getMemoryStats } from './memory-injection.js';
import {
  getSelectedCharacter,
  getSelectedItems,
  getSelectedRecord,
  renderCharacterList
} from './memory-roles.js';
import {
  createDefaultSearchState,
  filterMemoryItems,
  patchSearchState,
  renderSearchPanel,
  resetSearchState
} from './memory-search.js';
import { renderTimeline } from './memory-timeline.js';
import {
  MEMORY_ICONS,
  createToast,
  escapeHtml,
  formatDateTime,
  renderAvatar,
  renderEmptyState,
  renderIconButton,
  renderStatCard
} from './memory-ui.js';

const MEMORY_CSS_ID = 'memory-app-css';
const MEMORY_CSS_HREF = './js/apps/memory/memory.css';

/* ==========================================================================
   [区域标注·已完成·旧事防闪屏样式加载区]
   说明：挂载旧事页面前先加载独立 CSS，避免应用窗口先显示无样式内容。
   ========================================================================== */
function ensureMemoryStyles() {
  return new Promise((resolve) => {
    const existing = document.getElementById(MEMORY_CSS_ID);
    if (existing) {
      if (existing.dataset.loaded === '1' || existing.sheet) {
        resolve();
        return;
      }
      const done = () => {
        existing.dataset.loaded = '1';
        resolve();
      };
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', done, { once: true });
      return;
    }

    const link = document.createElement('link');
    link.id = MEMORY_CSS_ID;
    link.rel = 'stylesheet';
    link.href = MEMORY_CSS_HREF;
    const done = () => {
      link.dataset.loaded = '1';
      resolve();
    };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
    document.head.appendChild(link);
  });
}

/* ==========================================================================
   [区域标注·已完成·旧事统计展示区]
   说明：单角色页统计文案已统一为“总记忆数 / 已注入记忆数 / 永久记忆数 / 高优先级记忆数”。
   ========================================================================== */
function renderStats(items) {
  const stats = getMemoryStats(items);
  return `
    <section class="memory-stats">
      ${renderStatCard('总记忆数', stats.total, MEMORY_ICONS.memory)}
      ${renderStatCard('已注入记忆数', stats.injected, MEMORY_ICONS.link)}
      ${renderStatCard('永久记忆数', stats.permanent, MEMORY_ICONS.pin)}
      ${renderStatCard('高优先级记忆数', stats.highPriority, MEMORY_ICONS.spark)}
    </section>
  `;
}

function renderPlanCards() {
  const cards = [
    ['角色独立记忆库', '旧事只按“角色 → 闲谈记忆库”组织，不建立全局用户面具，也不预建论坛、阅读器等其它应用文件夹。'],
    ['记忆分层', '闲谈记忆分为长期记忆、红线铁则、闪光灯记忆、待确认。长期记忆建议沉淀为 100~200 字精炼摘要。'],
    ['注入规则', '永久记忆每次注入；允许注入只进入低权重候选池；未开启注入的记忆不参与候选。'],
    ['检索方式', '单角色页面支持按关键词与时间范围检索，方便快速定位某段闲谈旧事。']
  ];

  return `
    <section class="memory-plan">
      ${cards.map(([title, desc]) => `
        <article class="memory-plan-card">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(desc)}</p>
        </article>
      `).join('')}
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事单角色闲谈记忆库页面区]
   说明：进入角色后直接展示“闲谈记忆库”，不再显示多应用文件夹。
   ========================================================================== */
function renderMain(state) {
  const character = getSelectedCharacter(state);

  if (state.loading) {
    return renderEmptyState('正在读取旧事', '正在通过 IndexedDB 加载角色与闲谈记忆。', MEMORY_ICONS.memory);
  }

  if (!character) {
    return `
      ${renderEmptyState('请选择角色', '旧事会为每个角色维护独立的闲谈记忆库。', MEMORY_ICONS.user)}
      ${renderPlanCards()}
    `;
  }

  const record = getSelectedRecord(state);
  const items = getSelectedItems(state);
  const filteredItems = filterMemoryItems(items, state.search);

  return `
    <section class="memory-detail-header">
      ${renderIconButton({ action: 'back-to-roles', icon: MEMORY_ICONS.back, label: '返回角色列表', extraClass: 'memory-back-btn' })}
      ${renderAvatar(character)}
      <div class="memory-detail-header__main">
        <div class="memory-detail-header__title">${escapeHtml(character.name)}</div>
        <div class="memory-detail-header__sub">闲谈记忆库 · 更新于 ${escapeHtml(formatDateTime(record?.updatedAt || Date.now()))}</div>
      </div>
      <button class="memory-primary-btn" type="button" data-action="open-add">${MEMORY_ICONS.add}<span>新增</span></button>
    </section>
    ${renderSearchPanel(state.search)}
    ${renderStats(items)}
    <section class="memory-items">
      ${renderTimeline(filteredItems)}
    </section>
  `;
}

function renderApp(root, state) {
  root.innerHTML = `
    <div class="memory-shell">
      <header class="memory-header">
        <div class="memory-header__title">${MEMORY_ICONS.memory}<span>${escapeHtml(state.appMeta?.name || '旧事')}</span></div>
        <p class="memory-header__desc">本次范围已收束为“角色独立闲谈记忆库”：旧事只管理档案角色的闲谈记忆，不建立论坛、阅读器或其它应用文件夹。</p>
      </header>
      <main class="memory-layout">
        <aside class="memory-sidebar">
          <section class="memory-toolbar">
            <div class="memory-section-title">${MEMORY_ICONS.user}<span>角色列表</span></div>
          </section>
          <section class="memory-character-list">
            ${renderCharacterList(state)}
          </section>
        </aside>
        <section class="memory-main">
          ${renderMain(state)}
        </section>
      </main>
    </div>
    ${renderMemoryFormModal(state)}
    ${renderDeleteModal(state)}
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事入口接线区]
   说明：index.js 已收缩为接线层；具体功能分别在 roles/search/timeline/editor/injection/db/ui 文件中维护。
   ========================================================================== */
export async function mount(container, context) {
  await ensureMemoryStyles();

  const state = {
    appMeta: context.appMeta,
    db: context.db,
    characters: [],
    recordsByCharacterId: {},
    selectedCharacterId: '',
    search: createDefaultSearchState(),
    modal: null,
    loading: true
  };

  container.classList.add('memory-app');
  renderApp(container, state);

  const toast = createToast(container);

  const refreshBootData = async ({ keepSelection = true } = {}) => {
    state.loading = true;
    renderApp(container, state);
    try {
      const bootData = await loadMemoryBootData(state.db);
      state.characters = bootData.characters;
      state.recordsByCharacterId = bootData.recordsByCharacterId;
      if (!keepSelection || !state.selectedCharacterId || !state.recordsByCharacterId[state.selectedCharacterId]) {
        state.selectedCharacterId = state.characters[0]?.id || '';
      }
    } catch (error) {
      state.characters = [];
      state.recordsByCharacterId = {};
      toast.show('旧事读取失败，请查看日志');
      console.error('[memory] load failed', error);
    } finally {
      state.loading = false;
      renderApp(container, state);
    }
  };

  const refreshRecordsOnly = async () => {
    const bootData = await loadMemoryBootData(state.db);
    state.characters = bootData.characters;
    state.recordsByCharacterId = bootData.recordsByCharacterId;
  };

  const getItemById = (id) => getSelectedItems(state).find((item) => item.id === id) || null;

  const closeModal = () => {
    state.modal = null;
    renderApp(container, state);
  };

  const handleClick = async (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl || !container.contains(actionEl)) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    if (action === 'select-character') {
      state.selectedCharacterId = id || '';
      resetSearchState(state);
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'back-to-roles') {
      state.selectedCharacterId = '';
      resetSearchState(state);
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'set-time-preset') {
      patchSearchState(state, { timePreset: actionEl.dataset.preset || 'all' });
      renderApp(container, state);
      return;
    }

    if (action === 'open-add') {
      state.modal = { kind: 'form', item: null };
      renderApp(container, state);
      return;
    }

    if (action === 'open-edit') {
      state.modal = { kind: 'form', item: getItemById(id) };
      renderApp(container, state);
      return;
    }

    if (action === 'open-delete') {
      state.modal = { kind: 'delete', item: getItemById(id) };
      renderApp(container, state);
      return;
    }

    if (action === 'close-modal') {
      closeModal();
      return;
    }

    if (action === 'confirm-delete') {
      await removeMemoryItem(state.db, state.selectedCharacterId, id);
      await refreshRecordsOnly();
      state.modal = null;
      toast.show('已删除记忆');
      renderApp(container, state);
      return;
    }

    if (action === 'toggle-injection' || action === 'toggle-permanent') {
      const item = getItemById(id);
      if (!item) return;
      const patch = action === 'toggle-injection'
        ? { injectionEnabled: !item.injectionEnabled }
        : { isPermanent: !item.isPermanent };
      await patchMemoryItem(state.db, state.selectedCharacterId, id, patch);
      await refreshRecordsOnly();
      renderApp(container, state);
      return;
    }

    if (action === 'choose-memory-type') {
      applyTypeChoice(actionEl);
      return;
    }

    if (action === 'form-toggle') {
      applyFormToggle(actionEl);
    }
  };

  const handleInput = (event) => {
    const field = event.target?.dataset?.searchField;
    if (!field) return;
    patchSearchState(state, { [field]: event.target.value });
    renderApp(container, state);
  };

  const handleSubmit = async (event) => {
    const form = event.target.closest('[data-memory-form]');
    if (!form) return;

    event.preventDefault();
    if (!state.selectedCharacterId) return;

    const item = parseMemoryForm(form);
    if (!item.summary) {
      toast.show('请填写记忆摘要');
      return;
    }

    await upsertMemoryItem(state.db, state.selectedCharacterId, item);
    await refreshRecordsOnly();
    state.modal = null;
    toast.show('已保存记忆');
    renderApp(container, state);
  };

  container.addEventListener('click', handleClick);
  container.addEventListener('input', handleInput);
  container.addEventListener('submit', handleSubmit);

  await refreshBootData({ keepSelection: false });

  return {
    destroy() {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('input', handleInput);
      container.removeEventListener('submit', handleSubmit);
      toast.destroy();
      container.classList.remove('memory-app');
      container.innerHTML = '';
    }
  };
}

export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}
