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
  getSelectedItems,
  getSelectedRecord
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
   [区域标注·已完成·旧事首页身份面具分组区]
   说明：
   1. 首页横向圆形头像来源于档案应用里的用户面具身份字段，不使用旧角色列表 UI。
   2. 仅读取 IndexedDB 启动数据中的角色/档案字段，不新增 localStorage/sessionStorage 或双份存储。
   3. 若旧数据缺少 identity/maskName/profileName 等身份字段，才回退到角色名作为显示占位。
   ========================================================================== */
function getArchiveMaskIdentityName(character = {}) {
  return (
    character.identity
    || character.maskName
    || character.profileName
    || character.personaName
    || character.displayIdentity
    || character.name
    || '未命名身份'
  ).trim();
}

function getArchiveMaskIdentityAvatar(character = {}) {
  return (
    character.identityAvatar
    || character.maskAvatar
    || character.profileAvatar
    || character.personaAvatar
    || character.avatar
    || ''
  ).trim();
}

function buildIdentityGroups(characters = [], recordsByCharacterId = {}) {
  const map = new Map();

  characters.forEach((character) => {
    const identityName = getArchiveMaskIdentityName(character);
    const key = identityName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: identityName,
        avatar: getArchiveMaskIdentityAvatar(character),
        characters: []
      });
    }
    const group = map.get(key);
    const record = recordsByCharacterId?.[character.id];
    const items = Array.isArray(record?.chatMemory?.items) ? record.chatMemory.items : [];
    group.characters.push({
      ...character,
      memoryCount: items.length,
      updatedAt: Number(record?.updatedAt) || 0
    });
  });

  return Array.from(map.values()).map((group) => ({
    ...group,
    memoryCount: group.characters.reduce((sum, item) => sum + item.memoryCount, 0),
    updatedAt: group.characters.reduce((max, item) => Math.max(max, item.updatedAt || 0), 0)
  }));
}

function getSelectedIdentity(state) {
  return (Array.isArray(state.identityGroups) ? state.identityGroups : [])
    .find((item) => item.key === state.selectedIdentityKey) || null;
}

function getSelectedCharacter(state) {
  return (Array.isArray(state.characters) ? state.characters : [])
    .find((character) => character.id === state.selectedCharacterId) || null;
}

function getRoleCardMemoryCount(state, characterId) {
  const items = Array.isArray(state.recordsByCharacterId?.[characterId]?.chatMemory?.items)
    ? state.recordsByCharacterId[characterId].chatMemory.items
    : [];
  return items.length;
}

/* ==========================================================================
   [区域标注·已完成·旧事Chat页面标题栏区]
   说明：
   1. 旧事应用从窗口顶部接管，标题栏位置与闲谈 chat 页面一致。
   2. 标题使用同款居中布局；子页面左侧显示“>”返回按钮，图案由本文件自绘文本按钮承载。
   3. 本区只负责 UI 渲染，不涉及任何持久化读写。
   ========================================================================== */
function renderMemoryTopBar({ title = 'Memory', backAction = '' } = {}) {
  return `
    <header class="memory-chat-top-bar">
      ${backAction
        ? `<button class="memory-top-back" type="button" data-action="${escapeHtml(backAction)}" aria-label="返回上一级">></button>`
        : ''}
      <div class="memory-chat-top-bar__title-wrap">
        <div class="memory-chat-top-bar__title">${escapeHtml(title)}</div>
      </div>
    </header>
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事统计展示区]
   说明：闲谈记忆页统计文案统一为“总记忆数 / 已注入记忆数 / 永久记忆数 / 高优先级记忆数”。
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

/* ==========================================================================
   [区域标注·已完成·旧事首页渲染区]
   说明：首页为 ins 风格横向圆形身份头像，下方为该身份角色记忆卡片（一行两卡、竖向滚动、隐藏滚动条）。
   ========================================================================== */
function renderIdentityHome(state) {
  const identities = Array.isArray(state.identityGroups) ? state.identityGroups : [];
  const selectedIdentity = getSelectedIdentity(state);

  const identityRail = identities.length
    ? identities.map((identity) => {
      const active = identity.key === state.selectedIdentityKey;
      return `
        <button
          class="memory-identity-chip ${active ? 'is-active' : ''}"
          type="button"
          data-action="select-identity"
          data-id="${escapeHtml(identity.key)}"
        >
          ${renderAvatar({ name: identity.label, avatar: identity.avatar }, 'memory-identity-chip__avatar')}
          <span class="memory-identity-chip__name">${escapeHtml(identity.label)}</span>
          <span class="memory-identity-chip__meta">${escapeHtml(identity.memoryCount)} 条</span>
        </button>
      `;
    }).join('')
    : renderEmptyState(
      '暂无身份面具',
      '请先在档案应用创建带有身份信息的角色，旧事会自动读取并展示。',
      MEMORY_ICONS.user
    );

  const roleCards = selectedIdentity
    ? selectedIdentity.characters.map((character) => `
      <button
        class="memory-role-card"
        type="button"
        data-action="open-role-library"
        data-id="${escapeHtml(character.id)}"
      >
        <div class="memory-role-card__head">
          ${renderAvatar(character, 'memory-role-card__avatar')}
          <div class="memory-role-card__title-wrap">
            <div class="memory-role-card__title">${escapeHtml(character.name)}</div>
            <div class="memory-role-card__sub">${escapeHtml(selectedIdentity.label)}</div>
          </div>
        </div>
        <div class="memory-role-card__line"></div>
        <div class="memory-role-card__foot">
          <span>${escapeHtml(getRoleCardMemoryCount(state, character.id))} 条记忆</span>
          <span>${escapeHtml(character.updatedAt ? formatDateTime(character.updatedAt) : '暂无更新')}</span>
        </div>
      </button>
    `).join('')
    : `
      <section class="memory-role-placeholder">
        ${renderEmptyState('请选择身份', '点击上方圆形身份头像后，在这里查看该身份下的角色记忆卡片。', MEMORY_ICONS.chat)}
      </section>
    `;

  return `
    <section class="memory-home">
      ${renderMemoryTopBar({ title: 'Memory' })}
      <section class="memory-home__intro">
        <p>身份面具与角色记忆库</p>
      </section>
      <section class="memory-identity-rail" aria-label="身份头像横向滑动区">
        ${identityRail}
      </section>
      <section class="memory-role-cards" aria-label="角色记忆卡片区">
        ${roleCards}
      </section>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·角色记忆库页面区]
   说明：标题为“xxx的记忆库”，左侧为“>”返回按钮；应用卡片一行两列，目前只提供闲谈应用入口。
   ========================================================================== */
function renderRoleLibrary(state) {
  const character = getSelectedCharacter(state);

  if (!character) {
    return renderEmptyState('角色不存在', '请选择有效角色后再进入记忆库。', MEMORY_ICONS.warning);
  }

  return `
    <section class="memory-library">
      ${renderMemoryTopBar({ title: `${character.name}的记忆库`, backAction: 'back-to-home' })}
      <section class="memory-library-grid">
        <button class="memory-app-card is-chat" type="button" data-action="open-chat-memory" data-id="${escapeHtml(character.id)}">
          <div class="memory-app-card__icon">${MEMORY_ICONS.chat}</div>
          <div class="memory-app-card__title">闲谈应用</div>
          <div class="memory-app-card__desc">查看与搜索该角色的闲谈记忆</div>
        </button>
        <article class="memory-app-card is-placeholder" aria-hidden="true">
          <div class="memory-app-card__icon">${MEMORY_ICONS.memory}</div>
          <div class="memory-app-card__title">敬请期待</div>
          <div class="memory-app-card__desc">其它应用记忆卡片后续扩展</div>
        </article>
      </section>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·角色闲谈记忆页面区]
   说明：标题左侧“>”返回角色记忆库，顶部搜索栏，命中后只显示对应卡片；下方时间线按时间顺序并用竖线串联。
   ========================================================================== */
function renderChatMemory(state) {
  const character = getSelectedCharacter(state);
  if (!character) {
    return renderEmptyState('角色不存在', '请选择有效角色后再查看闲谈记忆。', MEMORY_ICONS.warning);
  }

  const record = getSelectedRecord(state);
  const items = getSelectedItems(state);
  const filteredItems = filterMemoryItems(items, state.search);

  return `
    <section class="memory-chat-page">
      ${renderMemoryTopBar({ title: `${character.name}的记忆库`, backAction: 'back-to-library' })}
      <section class="memory-chat-page__meta">
        <span>${MEMORY_ICONS.chat} 闲谈应用</span>
        <span>更新于 ${escapeHtml(formatDateTime(record?.updatedAt || Date.now()))}</span>
      </section>
      ${renderSearchPanel(state.search)}
      ${renderStats(items)}
      <section class="memory-items">
        ${renderTimeline(filteredItems)}
      </section>
      <button class="memory-primary-btn memory-floating-add" type="button" data-action="open-add">
        ${MEMORY_ICONS.add}<span>新增记忆</span>
      </button>
    </section>
  `;
}

function renderMainByStage(state) {
  if (state.loading) {
    return renderEmptyState('正在读取旧事', '正在通过 IndexedDB 加载身份、角色与闲谈记忆。', MEMORY_ICONS.memory);
  }

  if (state.stage === 'role-library') {
    return renderRoleLibrary(state);
  }

  if (state.stage === 'chat-memory') {
    return renderChatMemory(state);
  }

  return renderIdentityHome(state);
}

function renderApp(root, state) {
  root.innerHTML = `
    <div class="memory-shell">
      <main class="memory-layout memory-layout--single">
        ${renderMainByStage(state)}
      </main>
    </div>
    ${renderMemoryFormModal(state)}
    ${renderDeleteModal(state)}
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事入口接线区]
   说明：index.js 只保留接线与页面状态机，持久化仍全部走 memory-db.js（IndexedDB）。
   ========================================================================== */
export async function mount(container, context) {
  await ensureMemoryStyles();

  const state = {
    appMeta: context.appMeta,
    db: context.db,
    characters: [],
    identityGroups: [],
    recordsByCharacterId: {},
    selectedIdentityKey: '',
    selectedCharacterId: '',
    stage: 'home',
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
      state.identityGroups = buildIdentityGroups(state.characters, state.recordsByCharacterId);

      if (!keepSelection) {
        state.selectedIdentityKey = state.identityGroups[0]?.key || '';
        state.selectedCharacterId = '';
        state.stage = 'home';
      } else {
        if (state.selectedIdentityKey && !state.identityGroups.some((item) => item.key === state.selectedIdentityKey)) {
          state.selectedIdentityKey = state.identityGroups[0]?.key || '';
        }
        if (state.selectedCharacterId && !state.characters.some((item) => item.id === state.selectedCharacterId)) {
          state.selectedCharacterId = '';
          state.stage = 'home';
        }
      }
    } catch (error) {
      state.characters = [];
      state.identityGroups = [];
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
    state.identityGroups = buildIdentityGroups(state.characters, state.recordsByCharacterId);
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

    if (action === 'select-identity') {
      state.selectedIdentityKey = id || '';
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'open-role-library') {
      state.selectedCharacterId = id || '';
      state.stage = 'role-library';
      resetSearchState(state);
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'open-chat-memory') {
      state.selectedCharacterId = id || state.selectedCharacterId;
      state.stage = 'chat-memory';
      resetSearchState(state);
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'back-to-home') {
      state.stage = 'home';
      state.selectedCharacterId = '';
      resetSearchState(state);
      state.modal = null;
      renderApp(container, state);
      return;
    }

    if (action === 'back-to-library') {
      state.stage = 'role-library';
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
