/**
 * 文件名: js/apps/archive/index.js
 * 用途: 档案（Archive）应用完整实现（用户面具 / 角色档案 / 配角档案 / 关系网络）
 * 说明:
 *  - 纯前端 localStorage 存储
 *  - 复用主题弹窗风格（managed-resource-modal），不使用浏览器原生 alert/confirm/prompt
 *  - 图标使用 IconPark outline 风格 SVG
 *  - 样式独立文件：js/apps/archive/archive.css（由本模块动态注入）
 */

const ARCHIVE_STORAGE_KEY = 'miniphone_archive_app_data_v1';
const ARCHIVE_ACTIVE_MASK_KEY = 'miniphone_archive_active_mask_id';
const ARCHIVE_STYLE_ID = 'miniphone-archive-style';
const RELATION_SELF_ID = '__archive_self__';

const TAB_META = {
  mask: { title: '用户面具' },
  character: { title: '角色档案' },
  supporting: { title: '配角档案' },
  relation: { title: '关系网络' }
};

function createDefaultData() {
  return {
    masks: [],
    characters: [],
    supportingRoles: [],
    relations: [],
    activeMaskId: '',
    selectedTab: 'mask'
  };
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  const text = String(value ?? '');
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

function readArchiveData() {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return createDefaultData();
    const parsed = JSON.parse(raw);
    return normalizeArchiveData(parsed);
  } catch (_) {
    return createDefaultData();
  }
}

function writeArchiveData(data) {
  const normalized = normalizeArchiveData(data);
  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function normalizeProfile(item, type = 'mask') {
  const roleBindingIds = type === 'mask'
    ? [...new Set(normalizeArray(item?.roleBindingIds).map((id) => normalizeString(id)).filter(Boolean))]
    : undefined;

  return {
    id: normalizeString(item?.id) || uid(type === 'character' ? 'char' : 'mask'),
    name: normalizeString(item?.name),
    gender: normalizeString(item?.gender),
    age: normalizeString(item?.age),
    identity: normalizeString(item?.identity),
    signature: normalizeString(item?.signature),
    contact: normalizeString(item?.contact),
    personalitySetting: normalizeString(item?.personalitySetting),
    avatar: normalizeString(item?.avatar),
    ...(type === 'mask' ? { roleBindingIds } : {})
  };
}

function normalizeSupportingRole(item) {
  return {
    id: normalizeString(item?.id) || uid('support'),
    name: normalizeString(item?.name),
    gender: normalizeString(item?.gender),
    basicSetting: normalizeString(item?.basicSetting),
    avatar: normalizeString(item?.avatar)
  };
}

function normalizeRelation(item) {
  return {
    id: normalizeString(item?.id) || uid('relation'),
    mainRoleId: normalizeString(item?.mainRoleId) || RELATION_SELF_ID,
    supportingRoleId: normalizeString(item?.supportingRoleId),
    description: normalizeString(item?.description)
  };
}

function normalizeArchiveData(raw) {
  const safe = raw && typeof raw === 'object' ? raw : createDefaultData();
  const characters = normalizeArray(safe.characters).map((item) => normalizeProfile(item, 'character'));
  const masks = normalizeArray(safe.masks).map((item) => {
    const normalized = normalizeProfile(item, 'mask');
    normalized.roleBindingIds = normalized.roleBindingIds.filter((roleId) => characters.some((c) => c.id === roleId));
    return normalized;
  });
  const supportingRoles = normalizeArray(safe.supportingRoles).map((item) => normalizeSupportingRole(item));
  const relations = normalizeArray(safe.relations).map((item) => normalizeRelation(item)).filter((item) => item.supportingRoleId);
  const selectedTab = TAB_META[safe.selectedTab] ? safe.selectedTab : 'mask';
  const activeMaskId = masks.some((m) => m.id === safe.activeMaskId) ? safe.activeMaskId : '';

  return {
    masks,
    characters,
    supportingRoles,
    relations,
    activeMaskId,
    selectedTab
  };
}

function pickFirst(source, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function safeAtob(value) {
  try {
    return atob(value);
  } catch (_) {
    return '';
  }
}

function parsePossibleObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const direct = safeJsonParse(text);
  if (direct && typeof direct === 'object') return direct;

  const decoded = safeAtob(text);
  if (decoded) {
    const fromDecoded = safeJsonParse(decoded);
    if (fromDecoded && typeof fromDecoded === 'object') return fromDecoded;
  }

  const jsonLikeMatch = text.match(/\{[\s\S]*\}/);
  if (jsonLikeMatch) {
    const fromSlice = safeJsonParse(jsonLikeMatch[0]);
    if (fromSlice && typeof fromSlice === 'object') return fromSlice;
  }

  return null;
}

function mapImportedRole(rawObj) {
  const root = rawObj?.data && typeof rawObj.data === 'object' ? rawObj.data : rawObj || {};
  const name = pickFirst(root, ['name', 'char_name', 'characterName']);
  const gender = pickFirst(root, ['gender', 'sex']);
  const age = pickFirst(root, ['age']);
  const identity = pickFirst(root, ['identity', 'occupation', 'role', 'persona']);
  const signature = pickFirst(root, ['signature', 'tagline', 'first_mes']);
  const contact = pickFirst(root, ['contact', 'wechat', 'wx']);
  const avatar = pickFirst(root, ['avatar', 'avatar_url', 'image', 'imageUrl']);

  let personalitySetting = pickFirst(root, ['description', 'personalitySetting', 'personality', 'scenario']);
  if (!personalitySetting && typeof root.description === 'object') {
    personalitySetting = JSON.stringify(root.description, null, 2);
  }

  return normalizeProfile({
    id: uid('char'),
    name,
    gender,
    age,
    identity,
    signature,
    contact,
    personalitySetting,
    avatar
  }, 'character');
}

function parsePngTextChunks(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const signature = new Uint8Array(arrayBuffer.slice(0, 8));
  const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
  const valid = pngSig.every((byte, index) => signature[index] === byte);
  if (!valid) throw new Error('PNG 文件头无效');

  const decoder = new TextDecoder('utf-8');
  const chunks = [];
  let offset = 8;

  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset);
    offset += 4;
    const typeBytes = new Uint8Array(arrayBuffer, offset, 4);
    const type = decoder.decode(typeBytes);
    offset += 4;

    if (offset + length + 4 > view.byteLength) break;
    const dataBytes = new Uint8Array(arrayBuffer, offset, length);
    offset += length;
    offset += 4; // crc

    if (type === 'tEXt') {
      const zeroIndex = dataBytes.indexOf(0);
      if (zeroIndex > -1) {
        const keyword = decoder.decode(dataBytes.slice(0, zeroIndex));
        const text = decoder.decode(dataBytes.slice(zeroIndex + 1));
        chunks.push({ type, keyword, text });
      }
    }

    if (type === 'iTXt') {
      let cursor = 0;
      const readNullTerminated = () => {
        const start = cursor;
        while (cursor < dataBytes.length && dataBytes[cursor] !== 0) cursor += 1;
        const result = decoder.decode(dataBytes.slice(start, cursor));
        cursor += 1;
        return result;
      };

      const keyword = readNullTerminated();
      const compressionFlag = dataBytes[cursor] ?? 0;
      cursor += 1; // compression method position follows
      cursor += 1; // compression method
      readNullTerminated(); // language tag
      readNullTerminated(); // translated keyword
      const payload = dataBytes.slice(cursor);

      // 仅处理未压缩 iTXt，压缩情形留作后续扩展
      if (compressionFlag === 0) {
        const text = decoder.decode(payload);
        chunks.push({ type, keyword, text });
      }
    }

    if (type === 'IEND') break;
  }

  return chunks;
}

function extractRoleObjectFromPngChunks(chunks = []) {
  const candidates = [];

  chunks.forEach((chunk) => {
    const keyword = String(chunk.keyword || '').toLowerCase();
    const text = String(chunk.text || '').trim();
    if (!text) return;

    const maybeObj = parsePossibleObject(text);
    if (maybeObj) candidates.push(maybeObj);

    if (keyword.includes('chara')) {
      const decoded = safeAtob(text);
      if (decoded) {
        const parsed = safeJsonParse(decoded);
        if (parsed && typeof parsed === 'object') candidates.push(parsed);
      }
    }
  });

  return candidates.find((obj) => {
    const root = obj?.data && typeof obj.data === 'object' ? obj.data : obj;
    return !!pickFirst(root, ['description', 'name', 'personality']);
  }) || null;
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function ensureArchiveStylesheet() {
  let link = document.getElementById(ARCHIVE_STYLE_ID);
  if (link) return link;

  link = document.createElement('link');
  link.id = ARCHIVE_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = 'js/apps/archive/archive.css';
  document.head.appendChild(link);
  return link;
}

function icons() {
  return {
    user: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 24a10 10 0 1 0 0-20a10 10 0 0 0 0 20Z" stroke="currentColor" stroke-width="3"/><path d="M8 42a16 16 0 0 1 32 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    people: `<svg viewBox="0 0 48 48" fill="none"><circle cx="16" cy="16" r="7" stroke="currentColor" stroke-width="3"/><circle cx="33" cy="15" r="5" stroke="currentColor" stroke-width="3"/><path d="M4 40a12 12 0 0 1 24 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M26 39a9 9 0 0 1 18 0" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    userBusiness: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 40V14h32v26" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 14V8h12v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 24h32" stroke="currentColor" stroke-width="3"/><path d="M20 30h8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    connection: `<svg viewBox="0 0 48 48" fill="none"><circle cx="12" cy="10" r="4" stroke="currentColor" stroke-width="3"/><circle cx="36" cy="10" r="4" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="38" r="4" stroke="currentColor" stroke-width="3"/><path d="M15.5 12.5L20.5 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M32.5 12.5L27.5 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M22 22L24 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M26 22L24 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    plus: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 10v28M10 24h28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    import: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 20l8 10l8-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    export: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 42V18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 28l8-10l8 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    edit: `<svg viewBox="0 0 48 48" fill="none"><path d="M7 41l3-11L33 7l8 8-23 23L7 41Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
    remove: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 14h24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M17 14V10h14v4" stroke="currentColor" stroke-width="3"/><path d="M16 14l1 24h14l1-24" stroke="currentColor" stroke-width="3"/></svg>`,
    upload: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 34V10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 18l8-8l8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    link: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 29l-4 4a7 7 0 0 0 10 10l4-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M29 19l4-4a7 7 0 0 0-10-10l-4 4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M18 30l12-12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    check: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
  };
}

export async function mount(container, context) {
  ensureArchiveStylesheet();
  const icon = icons();

  const state = {
    data: readArchiveData(),
    activeTab: 'mask',
    selectedMaskId: '',
    selectedCharacterId: '',
    selectedSupportingId: '',
    selectedRelationId: '',
    headerRefs: null
  };

  state.activeTab = TAB_META[state.data.selectedTab] ? state.data.selectedTab : 'mask';

  const appWindow = container.closest('.app-window');
  const header = appWindow?.querySelector('.app-window__header') || null;
  const actionsEl = header?.querySelector('.app-window__actions') || null;
  const closeBtn = header?.querySelector('.app-window__close') || null;
  const titleEl = header?.querySelector('.app-window__title') || null;

  container.innerHTML = `
    <div class="archive-v2">
      <section class="archive-v2__content" id="archive-content"></section>
      <nav class="archive-v2__tabbar" id="archive-tabbar" aria-label="档案应用板块切换"></nav>
    </div>

    <div id="archive-toast" class="archive-toast" aria-live="polite"></div>

    <div id="archive-modal" class="managed-resource-modal hidden" aria-hidden="true"></div>
  `;

  const contentEl = container.querySelector('#archive-content');
  const tabbarEl = container.querySelector('#archive-tabbar');
  const toastEl = container.querySelector('#archive-toast');
  const modalEl = container.querySelector('#archive-modal');

  let modalCleanup = () => {};
  let toastTimer = null;

  const saveData = () => {
    state.data.selectedTab = state.activeTab;
    state.data = writeArchiveData(state.data);

    if (state.data.activeMaskId) {
      localStorage.setItem(ARCHIVE_ACTIVE_MASK_KEY, state.data.activeMaskId);
    } else {
      localStorage.removeItem(ARCHIVE_ACTIVE_MASK_KEY);
    }
  };

  const notify = (message, type = 'info') => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.dataset.type = type;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  };

  const closeModal = () => {
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = '';
    modalCleanup();
    modalCleanup = () => {};
  };

  const openModal = ({
    title = '提示',
    content = '',
    confirmText = '保存',
    confirmClass = 'primary',
    cancelText = '取消',
    showFooter = true,
    onOpen,
    onConfirm
  }) => {
    closeModal();

    modalEl.innerHTML = `
      <div class="managed-resource-modal__mask" data-action="modal-close"></div>
      <div class="managed-resource-modal__panel archive-modal-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="managed-resource-modal__header">
          <span>${escapeHtml(title)}</span>
          <button type="button" class="managed-resource-modal__close" data-action="modal-close" aria-label="关闭">
            ${icon.close}
          </button>
        </div>
        <div class="managed-resource-modal__body archive-modal-body">
          ${content}
          ${showFooter ? `
            <div class="archive-modal-actions">
              <button type="button" class="ui-button" data-action="modal-close">${escapeHtml(cancelText)}</button>
              <button type="button" class="ui-button ${escapeHtml(confirmClass)}" data-action="modal-confirm">${escapeHtml(confirmText)}</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');

    const handleClick = async (event) => {
      const action = event.target.closest('[data-action]')?.getAttribute('data-action');
      if (!action) return;

      if (action === 'modal-close') {
        closeModal();
        return;
      }

      if (action === 'modal-confirm') {
        if (typeof onConfirm === 'function') {
          const shouldClose = await onConfirm(modalEl);
          if (shouldClose === false) return;
        }
        closeModal();
      }
    };

    modalEl.addEventListener('click', handleClick);
    modalCleanup = () => modalEl.removeEventListener('click', handleClick);

    if (typeof onOpen === 'function') onOpen(modalEl, closeModal);
  };

  const openConfirmModal = (message, onConfirm, danger = false) => {
    openModal({
      title: '确认操作',
      content: `<p class="archive-modal-hint">${escapeHtml(message)}</p>`,
      confirmText: danger ? '确认删除' : '确认',
      confirmClass: danger ? 'danger' : 'primary',
      onConfirm: () => {
        onConfirm?.();
      }
    });
  };

  const ensureSelections = () => {
    if (!state.data.masks.some((item) => item.id === state.selectedMaskId)) {
      state.selectedMaskId = state.data.masks[0]?.id || '';
    }
    if (!state.data.characters.some((item) => item.id === state.selectedCharacterId)) {
      state.selectedCharacterId = state.data.characters[0]?.id || '';
    }
    if (!state.data.supportingRoles.some((item) => item.id === state.selectedSupportingId)) {
      state.selectedSupportingId = state.data.supportingRoles[0]?.id || '';
    }
    if (!state.data.relations.some((item) => item.id === state.selectedRelationId)) {
      state.selectedRelationId = state.data.relations[0]?.id || '';
    }
  };

  const getCharacterById = (id) => state.data.characters.find((item) => item.id === id);
  const getSupportingById = (id) => state.data.supportingRoles.find((item) => item.id === id);

  const resolveMainRoleOptions = () => {
    const roleIds = new Set();
    state.data.masks.forEach((mask) => {
      (mask.roleBindingIds || []).forEach((id) => roleIds.add(id));
    });

    const options = [
      { id: RELATION_SELF_ID, label: '用户本人' }
    ];

    [...roleIds].forEach((id) => {
      const role = getCharacterById(id);
      if (role) {
        options.push({
          id: role.id,
          label: role.name || '未命名角色'
        });
      }
    });

    return options;
  };

  const resolveMainRoleName = (mainRoleId) => {
    if (mainRoleId === RELATION_SELF_ID) return '用户本人';
    const role = getCharacterById(mainRoleId);
    return role?.name || '未命名角色';
  };

  const emitActiveMaskChanged = () => {
    const activeMask = state.data.masks.find((item) => item.id === state.data.activeMaskId) || null;
    context.eventBus?.emit('archive:active-mask-changed', {
      maskId: activeMask?.id || '',
      mask: activeMask
    });
  };

  const buildFieldGridHtml = (item) => `
    <div class="archive-grid-fields">
      <div class="archive-mini-box"><label>姓名</label><p>${escapeHtml(item.name || '—')}</p></div>
      <div class="archive-mini-box"><label>性别</label><p>${escapeHtml(item.gender || '—')}</p></div>
      <div class="archive-mini-box"><label>年龄</label><p>${escapeHtml(item.age || '—')}</p></div>
      <div class="archive-mini-box"><label>身份</label><p>${escapeHtml(item.identity || '—')}</p></div>
      <div class="archive-mini-box"><label>一句话签名</label><p>${escapeHtml(item.signature || '—')}</p></div>
      <div class="archive-mini-box"><label>联系方式</label><p>${escapeHtml(item.contact || '—')}</p></div>
    </div>
  `;

  const renderMaskTab = () => {
    const list = state.data.masks;
    if (!list.length) {
      return `
        <div class="archive-empty-card">
          <h3>暂无用户面具</h3>
          <p>点击右上角 + 新增面具身份。</p>
        </div>
      `;
    }

    return list.map((item) => {
      const isActiveMask = item.id === state.data.activeMaskId;
      const boundRoles = (item.roleBindingIds || [])
        .map((id) => getCharacterById(id))
        .filter(Boolean);

      return `
        <article class="archive-profile-card ${state.selectedMaskId === item.id ? 'is-selected' : ''}" data-card-id="${item.id}">
          <header class="archive-profile-card__header">
            <div class="archive-avatar-box ${item.avatar ? 'has-image' : ''}">
              ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '面具头像')}">` : '<span>头像</span>'}
            </div>
            <div class="archive-profile-card__meta">
              <h3>${escapeHtml(item.name || '未命名面具')}</h3>
              <div class="archive-badges">
                ${isActiveMask ? '<span class="archive-badge archive-badge--active">当前生效</span>' : ''}
                <span class="archive-badge">绑定角色 ${boundRoles.length}</span>
              </div>
            </div>
          </header>

          ${buildFieldGridHtml(item)}

          <div class="archive-large-box">
            <label>用户设定</label>
            <p>${escapeHtml(item.personalitySetting || '—')}</p>
          </div>

          <div class="archive-chip-list">
            ${boundRoles.length
              ? boundRoles.map((role) => `<span class="archive-chip">${escapeHtml(role.name || '未命名角色')}</span>`).join('')
              : '<span class="archive-chip archive-chip--muted">尚未绑定角色</span>'}
          </div>

          <footer class="archive-card-actions">
            <button class="ui-button" type="button" data-action="select-mask" data-id="${item.id}">${icon.check}<span>选定</span></button>
            <button class="ui-button" type="button" data-action="edit-mask" data-id="${item.id}">${icon.edit}<span>编辑</span></button>
            <button class="ui-button danger" type="button" data-action="delete-mask" data-id="${item.id}">${icon.remove}<span>删除</span></button>
          </footer>
        </article>
      `;
    }).join('');
  };

  const renderCharacterTab = () => {
    const list = state.data.characters;
    if (!list.length) {
      return `
        <div class="archive-empty-card">
          <h3>暂无角色档案</h3>
          <p>点击右上角 + 新增角色，或使用左上角导入功能。</p>
        </div>
      `;
    }

    return list.map((item) => `
      <article class="archive-profile-card ${state.selectedCharacterId === item.id ? 'is-selected' : ''}" data-card-id="${item.id}">
        <header class="archive-profile-card__header">
          <div class="archive-avatar-box ${item.avatar ? 'has-image' : ''}">
            ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '角色头像')}">` : '<span>头像</span>'}
          </div>
          <div class="archive-profile-card__meta">
            <h3>${escapeHtml(item.name || '未命名角色')}</h3>
            <div class="archive-badges">
              ${state.selectedCharacterId === item.id ? '<span class="archive-badge archive-badge--active">已选中</span>' : ''}
              <span class="archive-badge">联系人字段可供闲谈检索</span>
            </div>
          </div>
        </header>

        ${buildFieldGridHtml(item)}

        <div class="archive-large-box">
          <label>人物设定</label>
          <p>${escapeHtml(item.personalitySetting || '—')}</p>
        </div>

        <footer class="archive-card-actions">
          <button class="ui-button" type="button" data-action="select-character" data-id="${item.id}">${icon.check}<span>选中</span></button>
          <button class="ui-button" type="button" data-action="edit-character" data-id="${item.id}">${icon.edit}<span>编辑</span></button>
          <button class="ui-button danger" type="button" data-action="delete-character" data-id="${item.id}">${icon.remove}<span>删除</span></button>
        </footer>
      </article>
    `).join('');
  };

  const renderSupportingTab = () => {
    const list = state.data.supportingRoles;
    if (!list.length) {
      return `
        <div class="archive-empty-card">
          <h3>暂无配角档案</h3>
          <p>点击右上角 + 新增配角。</p>
        </div>
      `;
    }

    return list.map((item) => `
      <article class="archive-support-card ${state.selectedSupportingId === item.id ? 'is-selected' : ''}">
        <div class="archive-support-card__left">
          <div class="archive-avatar-box archive-avatar-box--small ${item.avatar ? 'has-image' : ''}">
            ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '配角头像')}">` : '<span>头像</span>'}
          </div>
          <div class="archive-support-meta">
            <h3>${escapeHtml(item.name || '未命名配角')}</h3>
            <p>性别：${escapeHtml(item.gender || '—')}</p>
          </div>
        </div>
        <div class="archive-large-box">
          <label>基本设定</label>
          <p>${escapeHtml(item.basicSetting || '—')}</p>
        </div>
        <footer class="archive-card-actions">
          <button class="ui-button" type="button" data-action="select-supporting" data-id="${item.id}">${icon.check}<span>选中</span></button>
          <button class="ui-button" type="button" data-action="edit-supporting" data-id="${item.id}">${icon.edit}<span>编辑</span></button>
          <button class="ui-button danger" type="button" data-action="delete-supporting" data-id="${item.id}">${icon.remove}<span>删除</span></button>
        </footer>
      </article>
    `).join('');
  };

  const renderRelationTab = () => {
    const list = state.data.relations;
    const mainOptions = resolveMainRoleOptions();

    const helper = `
      <div class="archive-inline-helper">
        <span>主角来源：用户本人 / 用户面具绑定角色</span>
        <button class="ui-button" type="button" data-action="add-relation">${icon.plus}<span>新增关系条目</span></button>
      </div>
    `;

    if (!mainOptions.length || state.data.supportingRoles.length === 0) {
      return `
        ${helper}
        <div class="archive-empty-card">
          <h3>关系网络待补充</h3>
          <p>请先准备面具绑定角色（或用户本人）与配角档案，再创建关系条目。</p>
        </div>
      `;
    }

    if (!list.length) {
      return `
        ${helper}
        <div class="archive-empty-card">
          <h3>暂无关系条目</h3>
          <p>点击“新增关系条目”开始构建人物关系网络。</p>
        </div>
      `;
    }

    return `
      ${helper}
      <div class="archive-relation-list">
        ${list.map((item) => {
          const supporting = getSupportingById(item.supportingRoleId);
          return `
            <article class="archive-relation-item ${state.selectedRelationId === item.id ? 'is-selected' : ''}">
              <div class="archive-relation-item__tags">
                <span class="archive-chip">${escapeHtml(resolveMainRoleName(item.mainRoleId))}</span>
                <span class="archive-chip archive-chip--arrow">→</span>
                <span class="archive-chip">${escapeHtml(supporting?.name || '未知配角')}</span>
              </div>
              <p class="archive-relation-item__desc">${escapeHtml(item.description || '未填写关系描述')}</p>
              <footer class="archive-card-actions">
                <button class="ui-button" type="button" data-action="select-relation" data-id="${item.id}">${icon.check}<span>选中</span></button>
                <button class="ui-button" type="button" data-action="edit-relation" data-id="${item.id}">${icon.edit}<span>编辑</span></button>
                <button class="ui-button danger" type="button" data-action="delete-relation" data-id="${item.id}">${icon.remove}<span>删除</span></button>
              </footer>
            </article>
          `;
        }).join('')}
      </div>
    `;
  };

  const renderTabbar = () => {
    return Object.keys(TAB_META).map((key) => {
      const iconSvg = key === 'mask'
        ? icon.user
        : key === 'character'
          ? icon.people
          : key === 'supporting'
            ? icon.userBusiness
            : icon.connection;

      return `
        <button
          class="archive-tab-btn ${state.activeTab === key ? 'is-active' : ''}"
          data-action="switch-tab"
          data-tab="${key}"
          type="button"
          aria-label="${TAB_META[key].title}"
        >
          ${iconSvg}
        </button>
      `;
    }).join('');
  };

  const renderContent = () => {
    ensureSelections();

    const html = state.activeTab === 'mask'
      ? renderMaskTab()
      : state.activeTab === 'character'
        ? renderCharacterTab()
        : state.activeTab === 'supporting'
          ? renderSupportingTab()
          : renderRelationTab();

    contentEl.innerHTML = `
      <section class="archive-tab-panel archive-tab-panel--${state.activeTab}">
        ${html}
      </section>
    `;
    tabbarEl.innerHTML = renderTabbar();
  };

  const createHeaderControls = () => {
    if (!header) return;

    // [模块标注] 档案应用标题栏返回桌面模块：
    // 1) 隐藏原“门形状”关闭按钮，避免与新增按钮重叠
    // 2) 将返回桌面入口改为点击标题文字区域
    if (closeBtn) {
      closeBtn.style.display = 'none';
      closeBtn.setAttribute('aria-hidden', 'true');
    }

    if (titleEl) {
      titleEl.style.pointerEvents = 'auto';
      titleEl.style.cursor = 'pointer';
      titleEl.setAttribute('title', '点击返回桌面');
      titleEl.setAttribute('aria-label', '点击返回桌面');
      titleEl.addEventListener('click', onTitleBackHome);
    }

    if (actionsEl) {
      actionsEl.style.display = 'none';
    }

    let left = header.querySelector('.archive-window-left-actions');
    if (!left) {
      left = document.createElement('div');
      left.className = 'archive-window-left-actions';
      left.innerHTML = `
        <button type="button" class="app-window__action-btn archive-window-btn archive-window-btn--import" aria-label="导入">${icon.import}</button>
        <button type="button" class="app-window__action-btn archive-window-btn archive-window-btn--export" aria-label="导出">${icon.export}</button>
      `;
      header.appendChild(left);
    }

    let right = header.querySelector('.archive-window-right-actions');
    if (!right) {
      right = document.createElement('div');
      right.className = 'archive-window-right-actions';
      right.innerHTML = `
        <button type="button" class="app-window__action-btn archive-window-btn archive-window-btn--add" aria-label="新增">${icon.plus}</button>
      `;
      header.appendChild(right);
    }

    const importBtn = left.querySelector('.archive-window-btn--import');
    const exportBtn = left.querySelector('.archive-window-btn--export');
    const addBtn = right.querySelector('.archive-window-btn--add');

    const onImport = () => {
      if (state.activeTab !== 'character') return;
      openCharacterImportModal();
    };

    const onExport = () => {
      if (state.activeTab !== 'character') return;
      exportSelectedCharacter();
    };

    const onAdd = () => {
      if (state.activeTab === 'mask') {
        openProfileEditor('mask');
        return;
      }
      if (state.activeTab === 'character') {
        openProfileEditor('character');
        return;
      }
      if (state.activeTab === 'supporting') {
        openSupportingEditor();
        return;
      }
      if (state.activeTab === 'relation') {
        return;
      }
    };

    importBtn?.addEventListener('click', onImport);
    exportBtn?.addEventListener('click', onExport);
    addBtn?.addEventListener('click', onAdd);

    state.headerRefs = {
      importBtn,
      exportBtn,
      addBtn,
      onImport,
      onExport,
      onAdd
    };
  };

  const updateHeaderControls = () => {
    const tabTitle = TAB_META[state.activeTab]?.title || '档案';
    context.windowManager?.setTitle(context.appId, tabTitle);

    if (!state.headerRefs) return;
    const { importBtn, exportBtn, addBtn } = state.headerRefs;

    const isCharacter = state.activeTab === 'character';
    const isRelation = state.activeTab === 'relation';

    if (importBtn) importBtn.style.display = isCharacter ? '' : 'none';
    if (exportBtn) exportBtn.style.display = isCharacter ? '' : 'none';
    if (addBtn) addBtn.style.display = isRelation ? 'none' : '';
  };

  const rerender = () => {
    renderContent();
    updateHeaderControls();
    saveData();
  };

  const collectAvatarValue = (scopeEl) => normalizeString(scopeEl.querySelector('[data-role="avatar-hidden"]')?.value);
  const collectInputValue = (scopeEl, role) => normalizeString(scopeEl.querySelector(`[data-role="${role}"]`)?.value);
  const collectTextareaValue = (scopeEl, role) => normalizeString(scopeEl.querySelector(`[data-role="${role}"]`)?.value);

  const bindAvatarFormEvents = (scopeEl) => {
    const hiddenInput = scopeEl.querySelector('[data-role="avatar-hidden"]');
    const preview = scopeEl.querySelector('[data-role="avatar-preview"]');
    const placeholder = scopeEl.querySelector('[data-role="avatar-placeholder"]');
    const localInput = scopeEl.querySelector('[data-role="avatar-file"]');
    const urlInput = scopeEl.querySelector('[data-role="avatar-url"]');
    const uploadBtn = scopeEl.querySelector('[data-action="avatar-upload"]');
    const applyUrlBtn = scopeEl.querySelector('[data-action="avatar-apply-url"]');
    const clearBtn = scopeEl.querySelector('[data-action="avatar-clear"]');

    const syncPreview = () => {
      const value = normalizeString(hiddenInput?.value);
      if (!preview || !placeholder || !hiddenInput) return;

      if (value) {
        preview.src = value;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        preview.removeAttribute('src');
        preview.style.display = 'none';
        placeholder.style.display = 'block';
      }
    };

    uploadBtn?.addEventListener('click', () => localInput?.click());

    localInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const dataUrl = await fileToDataURL(file);
      hiddenInput.value = dataUrl;
      syncPreview();
      event.target.value = '';
    });

    applyUrlBtn?.addEventListener('click', () => {
      if (!hiddenInput || !urlInput) return;
      hiddenInput.value = normalizeString(urlInput.value);
      syncPreview();
    });

    clearBtn?.addEventListener('click', () => {
      if (!hiddenInput || !urlInput) return;
      hiddenInput.value = '';
      urlInput.value = '';
      syncPreview();
    });

    syncPreview();
  };

  const openProfileEditor = (type, currentItem = null) => {
    const isMask = type === 'mask';
    const isEdit = !!currentItem;
    const title = `${isEdit ? '编辑' : '新增'}${isMask ? '用户面具' : '角色档案'}`;

    const roleOptionsHtml = state.data.characters.length
      ? state.data.characters.map((role) => {
        const checked = isMask && (currentItem?.roleBindingIds || []).includes(role.id);
        return `
          <label class="archive-check-item">
            <input type="checkbox" data-role="role-binding" value="${role.id}" ${checked ? 'checked' : ''}>
            <span>${escapeHtml(role.name || '未命名角色')}</span>
          </label>
        `;
      }).join('')
      : '<div class="archive-muted-text">暂无角色档案，创建角色后可绑定。</div>';

    openModal({
      title,
      confirmText: isEdit ? '保存修改' : '创建',
      content: `
        <div class="archive-form-grid">
          <!-- [模块标注] 头像上传模块：支持本地上传 + URL 应用 -->
          <div class="archive-avatar-editor">
            <div class="archive-avatar-preview ${currentItem?.avatar ? 'has-image' : ''}">
              <img data-role="avatar-preview" src="${escapeHtml(currentItem?.avatar || '')}" alt="头像预览" style="${currentItem?.avatar ? '' : 'display:none;'}">
              <span data-role="avatar-placeholder" style="${currentItem?.avatar ? 'display:none;' : ''}">头像</span>
            </div>
            <input data-role="avatar-hidden" type="hidden" value="${escapeHtml(currentItem?.avatar || '')}">
            <input data-role="avatar-file" type="file" accept="image/*" style="display:none;">
            <div class="archive-avatar-editor__actions">
              <button class="ui-button" type="button" data-action="avatar-upload">${icon.upload}<span>上传本地</span></button>
              <button class="ui-button danger" type="button" data-action="avatar-clear">${icon.remove}<span>清空</span></button>
            </div>
            <div class="archive-avatar-editor__url">
              <input data-role="avatar-url" type="url" placeholder="https://example.com/avatar.jpg" value="${escapeHtml(currentItem?.avatar || '')}">
              <button class="ui-button" type="button" data-action="avatar-apply-url">${icon.link}<span>应用URL</span></button>
            </div>
          </div>

          <!-- [模块标注] 双列字段模块：姓名、性别、年龄、身份、签名、联系方式 -->
          <div class="archive-form-row archive-form-row--two">
            <label><span>姓名</span><input data-role="name" type="text" value="${escapeHtml(currentItem?.name || '')}" /></label>
            <label><span>性别</span><input data-role="gender" type="text" value="${escapeHtml(currentItem?.gender || '')}" /></label>
            <label><span>年龄</span><input data-role="age" type="text" value="${escapeHtml(currentItem?.age || '')}" /></label>
            <label><span>身份</span><input data-role="identity" type="text" value="${escapeHtml(currentItem?.identity || '')}" /></label>
            <label><span>一句话签名</span><input data-role="signature" type="text" value="${escapeHtml(currentItem?.signature || '')}" /></label>
            <label><span>${isMask ? '联系方式' : '联系方式（微信号）'}</span><input data-role="contact" type="text" value="${escapeHtml(currentItem?.contact || '')}" /></label>
          </div>

          <label class="archive-form-row">
            <span>${isMask ? '用户设定' : '人物设定'}</span>
            <textarea data-role="personalitySetting" rows="5" placeholder="${isMask ? '请输入用户设定' : '请输入人物设定'}">${escapeHtml(currentItem?.personalitySetting || '')}</textarea>
          </label>

          ${isMask ? `
            <!-- [模块标注] 面具绑定角色模块：支持多选绑定角色档案 -->
            <div class="archive-form-row">
              <span>绑定角色（可多选）</span>
              <div class="archive-check-list">${roleOptionsHtml}</div>
            </div>

            <!-- [模块标注] 当前生效身份开关模块：采用 iPhone 风格滑动开关 -->
            <div class="archive-switch-row">
              <span>保存后设为当前生效身份</span>
              <label class="toggle-switch">
                <input data-role="set-active-mask" type="checkbox" ${state.data.activeMaskId === currentItem?.id ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          ` : ''}
        </div>
      `,
      onOpen: (modalScope) => {
        bindAvatarFormEvents(modalScope);
      },
      onConfirm: (modalScope) => {
        const profile = normalizeProfile({
          id: currentItem?.id || uid(isMask ? 'mask' : 'char'),
          avatar: collectAvatarValue(modalScope),
          name: collectInputValue(modalScope, 'name'),
          gender: collectInputValue(modalScope, 'gender'),
          age: collectInputValue(modalScope, 'age'),
          identity: collectInputValue(modalScope, 'identity'),
          signature: collectInputValue(modalScope, 'signature'),
          contact: collectInputValue(modalScope, 'contact'),
          personalitySetting: collectTextareaValue(modalScope, 'personalitySetting'),
          roleBindingIds: isMask
            ? Array.from(modalScope.querySelectorAll('[data-role="role-binding"]:checked')).map((el) => normalizeString(el.value))
            : undefined
        }, isMask ? 'mask' : 'character');

        if (!profile.name) {
          notify('请至少填写姓名', 'error');
          return false;
        }

        if (isMask) {
          if (isEdit) {
            state.data.masks = state.data.masks.map((item) => item.id === currentItem.id ? profile : item);
          } else {
            state.data.masks.push(profile);
            state.selectedMaskId = profile.id;
          }

          const shouldSetActive = !!modalScope.querySelector('[data-role="set-active-mask"]')?.checked;
          if (shouldSetActive) {
            state.data.activeMaskId = profile.id;
            emitActiveMaskChanged();
          } else if (!state.data.masks.some((m) => m.id === state.data.activeMaskId)) {
            state.data.activeMaskId = '';
            emitActiveMaskChanged();
          }

          notify(isEdit ? '用户面具已更新' : '用户面具已创建', 'success');
        } else {
          if (isEdit) {
            state.data.characters = state.data.characters.map((item) => item.id === currentItem.id ? profile : item);
          } else {
            state.data.characters.push(profile);
            state.selectedCharacterId = profile.id;
          }

          // 同步清理面具绑定中的失效角色
          state.data.masks = state.data.masks.map((mask) => ({
            ...mask,
            roleBindingIds: (mask.roleBindingIds || []).filter((id) => state.data.characters.some((c) => c.id === id))
          }));

          notify(isEdit ? '角色档案已更新' : '角色档案已创建', 'success');
        }

        rerender();
      }
    });
  };

  const openSupportingEditor = (currentItem = null) => {
    const isEdit = !!currentItem;

    openModal({
      title: `${isEdit ? '编辑' : '新增'}配角档案`,
      confirmText: isEdit ? '保存修改' : '创建',
      content: `
        <div class="archive-form-grid">
          <div class="archive-avatar-editor">
            <div class="archive-avatar-preview ${currentItem?.avatar ? 'has-image' : ''}">
              <img data-role="avatar-preview" src="${escapeHtml(currentItem?.avatar || '')}" alt="头像预览" style="${currentItem?.avatar ? '' : 'display:none;'}">
              <span data-role="avatar-placeholder" style="${currentItem?.avatar ? 'display:none;' : ''}">头像</span>
            </div>
            <input data-role="avatar-hidden" type="hidden" value="${escapeHtml(currentItem?.avatar || '')}">
            <input data-role="avatar-file" type="file" accept="image/*" style="display:none;">
            <div class="archive-avatar-editor__actions">
              <button class="ui-button" type="button" data-action="avatar-upload">${icon.upload}<span>上传本地</span></button>
              <button class="ui-button danger" type="button" data-action="avatar-clear">${icon.remove}<span>清空</span></button>
            </div>
            <div class="archive-avatar-editor__url">
              <input data-role="avatar-url" type="url" placeholder="https://example.com/avatar.jpg" value="${escapeHtml(currentItem?.avatar || '')}">
              <button class="ui-button" type="button" data-action="avatar-apply-url">${icon.link}<span>应用URL</span></button>
            </div>
          </div>

          <div class="archive-form-row archive-form-row--two">
            <label><span>姓名</span><input data-role="name" type="text" value="${escapeHtml(currentItem?.name || '')}" /></label>
            <label><span>性别</span><input data-role="gender" type="text" value="${escapeHtml(currentItem?.gender || '')}" /></label>
          </div>

          <label class="archive-form-row">
            <span>基本设定</span>
            <textarea data-role="basicSetting" rows="5" placeholder="请输入配角基本设定">${escapeHtml(currentItem?.basicSetting || '')}</textarea>
          </label>
        </div>
      `,
      onOpen: (modalScope) => {
        bindAvatarFormEvents(modalScope);
      },
      onConfirm: (modalScope) => {
        const item = normalizeSupportingRole({
          id: currentItem?.id || uid('support'),
          avatar: collectAvatarValue(modalScope),
          name: collectInputValue(modalScope, 'name'),
          gender: collectInputValue(modalScope, 'gender'),
          basicSetting: collectTextareaValue(modalScope, 'basicSetting')
        });

        if (!item.name) {
          notify('请至少填写配角姓名', 'error');
          return false;
        }

        if (isEdit) {
          state.data.supportingRoles = state.data.supportingRoles.map((role) => role.id === currentItem.id ? item : role);
        } else {
          state.data.supportingRoles.push(item);
          state.selectedSupportingId = item.id;
        }

        notify(isEdit ? '配角档案已更新' : '配角档案已创建', 'success');
        rerender();
      }
    });
  };

  const openRelationEditor = (currentItem = null) => {
    const isEdit = !!currentItem;
    const mainOptions = resolveMainRoleOptions();
    if (!mainOptions.length || state.data.supportingRoles.length === 0) {
      notify('请先准备主角来源与配角档案', 'error');
      return;
    }

    openModal({
      title: `${isEdit ? '编辑' : '新增'}关系条目`,
      confirmText: isEdit ? '保存修改' : '创建',
      content: `
        <div class="archive-form-grid">
          <label class="archive-form-row">
            <span>主角</span>
            <select data-role="mainRoleId">
              ${mainOptions.map((option) => `
                <option value="${escapeHtml(option.id)}" ${option.id === (currentItem?.mainRoleId || RELATION_SELF_ID) ? 'selected' : ''}>
                  ${escapeHtml(option.label)}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="archive-form-row">
            <span>配角</span>
            <select data-role="supportingRoleId">
              ${state.data.supportingRoles.map((role) => `
                <option value="${escapeHtml(role.id)}" ${role.id === currentItem?.supportingRoleId ? 'selected' : ''}>
                  ${escapeHtml(role.name || '未命名配角')}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="archive-form-row">
            <span>关系描述</span>
            <textarea data-role="description" rows="4" placeholder="例如：好友、同事、暗恋对象">${escapeHtml(currentItem?.description || '')}</textarea>
          </label>
        </div>
      `,
      onConfirm: (modalScope) => {
        const relation = normalizeRelation({
          id: currentItem?.id || uid('relation'),
          mainRoleId: collectInputValue(modalScope, 'mainRoleId') || RELATION_SELF_ID,
          supportingRoleId: collectInputValue(modalScope, 'supportingRoleId'),
          description: collectTextareaValue(modalScope, 'description')
        });

        if (!relation.supportingRoleId) {
          notify('请选择配角', 'error');
          return false;
        }

        if (!relation.description) {
          notify('请填写关系描述', 'error');
          return false;
        }

        if (isEdit) {
          state.data.relations = state.data.relations.map((item) => item.id === currentItem.id ? relation : item);
        } else {
          state.data.relations.push(relation);
          state.selectedRelationId = relation.id;
        }

        notify(isEdit ? '关系条目已更新' : '关系条目已创建', 'success');
        rerender();
      }
    });
  };

  const addCharacterFromImportedObject = (obj, avatarDataUrl = '') => {
    const mapped = mapImportedRole(obj);
    if (avatarDataUrl) mapped.avatar = avatarDataUrl;

    if (!mapped.personalitySetting) {
      notify('导入成功，但未解析到 description，已保留空人物设定', 'info');
    }

    state.data.characters.push(mapped);
    state.selectedCharacterId = mapped.id;
    rerender();
    notify(`已导入角色：${mapped.name || '未命名角色'}`, 'success');
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const fileName = String(file.name || '').toLowerCase();

    if (fileName.endsWith('.json')) {
      const text = await file.text();
      const parsed = safeJsonParse(text);
      if (!parsed) {
        notify('JSON 格式无效，导入失败', 'error');
        return;
      }

      const source = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!source || typeof source !== 'object') {
        notify('JSON 内容无效，导入失败', 'error');
        return;
      }

      addCharacterFromImportedObject(source);
      return;
    }

    if (fileName.endsWith('.png')) {
      const arrayBuffer = await file.arrayBuffer();
      const chunks = parsePngTextChunks(arrayBuffer);
      const roleObj = extractRoleObjectFromPngChunks(chunks);
      const avatarDataUrl = await fileToDataURL(file);

      if (roleObj) {
        addCharacterFromImportedObject(roleObj, avatarDataUrl);
      } else {
        // PNG 解析失败时保底给出提示并允许用户手动补全
        const fallback = normalizeProfile({
          id: uid('char'),
          name: file.name.replace(/\.png$/i, ''),
          personalitySetting: '',
          avatar: avatarDataUrl
        }, 'character');

        state.data.characters.push(fallback);
        state.selectedCharacterId = fallback.id;
        rerender();
        notify('PNG 未解析到标准角色定义，已创建基础角色卡，请手动补全字段', 'info');
      }
      return;
    }

    notify('仅支持 .png 和 .json 文件', 'error');
  };

  const openCharacterImportModal = () => {
    openModal({
      title: '导入角色档案',
      showFooter: false,
      content: `
        <div class="archive-form-grid">
          <p class="archive-modal-hint">支持导入 .png（酒馆角色卡）与 .json。导入后会自动创建角色卡片。</p>
          <input data-role="import-file" type="file" accept=".png,.json,application/json,image/png" style="display:none;">
          <div class="archive-modal-actions archive-modal-actions--single">
            <button class="ui-button primary" type="button" data-action="pick-import-file">${icon.import}<span>选择文件</span></button>
            <button class="ui-button" type="button" data-action="modal-close">${icon.close}<span>关闭</span></button>
          </div>
        </div>
      `,
      onOpen: (modalScope, close) => {
        const pickerBtn = modalScope.querySelector('[data-action="pick-import-file"]');
        const fileInput = modalScope.querySelector('[data-role="import-file"]');

        pickerBtn?.addEventListener('click', () => fileInput?.click());

        fileInput?.addEventListener('change', async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          await handleImportFile(file);
          close();
        });
      }
    });
  };

  const exportSelectedCharacter = () => {
    const target = state.data.characters.find((item) => item.id === state.selectedCharacterId);
    if (!target) {
      notify('请先在角色档案中选中一个角色再导出', 'error');
      return;
    }

    const exportPayload = {
      id: target.id,
      name: target.name,
      gender: target.gender,
      age: target.age,
      identity: target.identity,
      signature: target.signature,
      contact: target.contact,
      personalitySetting: target.personalitySetting,
      avatar: target.avatar
    };

    const safeName = target.name ? target.name.replace(/[\\/:*?"<>|]/g, '_') : '未命名角色';
    downloadJsonFile(`miniphone-role-${safeName}.json`, exportPayload);
    notify(`已导出角色：${target.name || '未命名角色'}`, 'success');
  };

  const onContainerClick = (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const id = actionEl.getAttribute('data-id') || '';

    if (action === 'switch-tab') {
      const nextTab = actionEl.getAttribute('data-tab');
      if (TAB_META[nextTab]) {
        state.activeTab = nextTab;
        rerender();
      }
      return;
    }

    if (action === 'select-mask') {
      state.selectedMaskId = id;
      state.data.activeMaskId = id;
      emitActiveMaskChanged();
      rerender();
      notify('该面具身份已设为当前生效', 'success');
      return;
    }

    if (action === 'edit-mask') {
      const target = state.data.masks.find((item) => item.id === id);
      if (target) openProfileEditor('mask', target);
      return;
    }

    if (action === 'delete-mask') {
      const target = state.data.masks.find((item) => item.id === id);
      if (!target) return;
      openConfirmModal(`确定删除面具“${target.name || '未命名面具'}”吗？`, () => {
        state.data.masks = state.data.masks.filter((item) => item.id !== id);
        if (state.data.activeMaskId === id) {
          state.data.activeMaskId = '';
          emitActiveMaskChanged();
        }
        notify('面具已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'select-character') {
      state.selectedCharacterId = id;
      rerender();
      return;
    }

    if (action === 'edit-character') {
      const target = state.data.characters.find((item) => item.id === id);
      if (target) openProfileEditor('character', target);
      return;
    }

    if (action === 'delete-character') {
      const target = state.data.characters.find((item) => item.id === id);
      if (!target) return;
      openConfirmModal(`确定删除角色“${target.name || '未命名角色'}”吗？`, () => {
        state.data.characters = state.data.characters.filter((item) => item.id !== id);

        state.data.masks = state.data.masks.map((mask) => ({
          ...mask,
          roleBindingIds: (mask.roleBindingIds || []).filter((roleId) => roleId !== id)
        }));

        state.data.relations = state.data.relations.filter((relation) => relation.mainRoleId !== id);
        notify('角色已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'select-supporting') {
      state.selectedSupportingId = id;
      rerender();
      return;
    }

    if (action === 'edit-supporting') {
      const target = state.data.supportingRoles.find((item) => item.id === id);
      if (target) openSupportingEditor(target);
      return;
    }

    if (action === 'delete-supporting') {
      const target = state.data.supportingRoles.find((item) => item.id === id);
      if (!target) return;
      openConfirmModal(`确定删除配角“${target.name || '未命名配角'}”吗？`, () => {
        state.data.supportingRoles = state.data.supportingRoles.filter((item) => item.id !== id);
        state.data.relations = state.data.relations.filter((item) => item.supportingRoleId !== id);
        notify('配角已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'add-relation') {
      openRelationEditor();
      return;
    }

    if (action === 'select-relation') {
      state.selectedRelationId = id;
      rerender();
      return;
    }

    if (action === 'edit-relation') {
      const target = state.data.relations.find((item) => item.id === id);
      if (target) openRelationEditor(target);
      return;
    }

    if (action === 'delete-relation') {
      const target = state.data.relations.find((item) => item.id === id);
      if (!target) return;
      openConfirmModal('确定删除该关系条目吗？', () => {
        state.data.relations = state.data.relations.filter((item) => item.id !== id);
        notify('关系条目已删除', 'success');
        rerender();
      }, true);
    }
  };

  // [模块标注] 标题点击返回桌面行为模块：仅作用于档案应用窗口标题
  const onTitleBackHome = () => {
    context.eventBus?.emit('app:close', { appId: context.appId });
  };

  createHeaderControls();
  rerender();

  container.addEventListener('click', onContainerClick);

  return {
    destroy() {
      container.removeEventListener('click', onContainerClick);
      closeModal();

      if (toastTimer) clearTimeout(toastTimer);

      if (state.headerRefs) {
        const { importBtn, exportBtn, addBtn, onImport, onExport, onAdd } = state.headerRefs;
        importBtn?.removeEventListener('click', onImport);
        exportBtn?.removeEventListener('click', onExport);
        addBtn?.removeEventListener('click', onAdd);
      }

      const left = header?.querySelector('.archive-window-left-actions');
      const right = header?.querySelector('.archive-window-right-actions');
      left?.remove();
      right?.remove();

      if (titleEl) {
        titleEl.removeEventListener('click', onTitleBackHome);
        titleEl.style.pointerEvents = '';
        titleEl.style.cursor = '';
        titleEl.removeAttribute('title');
        titleEl.removeAttribute('aria-label');
      }

      if (closeBtn) {
        closeBtn.style.display = '';
        closeBtn.removeAttribute('aria-hidden');
      }

      if (actionsEl) {
        actionsEl.style.display = '';
      }

      context.windowManager?.setTitle(context.appId, context.appMeta?.name || '档案');
    }
  };
}

export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}
