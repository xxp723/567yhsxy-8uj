/**
 * 文件名: js/apps/archive/index.js
 * 用途: 档案（Archive）应用完整实现（用户面具 / 角色档案 / 配角档案 / 关系网络）
 * 说明:
 *  - 持久化统一走 db.js（IndexedDB）
 *  - 复用主题弹窗风格（managed-resource-modal），不使用浏览器原生 alert/confirm/prompt
 *  - 图标使用 IconPark outline 风格 SVG
 *  - 样式独立文件：js/apps/archive/archive.css（由本模块动态注入）
 *
 * [修改标注·需求1] 联动世情应用：导入角色卡时解析绑定世界书并显示+发送事件
 */

const ARCHIVE_DB_RECORD_ID = 'archive::archive-data';
const ARCHIVE_STYLE_ID = 'miniphone-archive-style';
const RELATION_SELF_ID = '__archive_self__';

const TAB_META = {
  mask: { title: '用户面具' },
  character: { title: '角色档案' },
  supporting: { title: '配角档案' },
  relation: { title: '关系网络' }
};

const RELATION_ENTITY_TYPES = ['mask', 'character', 'supporting'];
const RELATION_ENTITY_TAB_META = {
  mask: { label: '用户', subtitle: '用户' },
  character: { label: '角色', subtitle: '角色' },
  supporting: { label: 'NPC', subtitle: 'NPC' }
};

/* [修改标注·本次问题1] 关系网络主体/对象约束规则 */
const RELATION_ALLOWED_TARGET_TYPES = {
  mask: ['character', 'supporting'],
  character: ['mask', 'supporting'],
  supporting: ['mask', 'character']
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
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}


function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

/* [修改标注·需求1] 规范化角色卡自带的绑定世界书信息，供档案展示与世情应用联动导入 */
function normalizeImportedWorldBooks(value) {
  return normalizeArray(value).map((item, index) => {
    const safe = item && typeof item === 'object' ? item : {};
    const raw = safe.raw && typeof safe.raw === 'object' ? safe.raw : {};
    const name = normalizeString(safe.name) || pickFirst(raw, ['name', 'title']) || `世界书 ${index + 1}`;
    const sourceKey = normalizeString(safe.sourceKey);
    return {
      sourceKey,
      name,
      raw
    };
  }).filter((item) => item.name || Object.keys(item.raw || {}).length);
}

/* [修改标注·需求4] normalizeProfile 新增 greetings 字段（数组），用于存储角色的多条开场白 */
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
    /* [修改标注·需求4] greetings: 开场白数组，每个元素为一条开场白文本 */
    greetings: normalizeArray(item?.greetings).map((g) => normalizeString(g)).filter(Boolean),
    ...(type === 'mask'
      ? { roleBindingIds }
      : { boundWorldBooks: normalizeImportedWorldBooks(item?.boundWorldBooks) })
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
  const legacyMainRoleId = normalizeString(item?.mainRoleId);
  const legacySupportingRoleId = normalizeString(item?.supportingRoleId);

  let ownerType = normalizeString(item?.ownerType);
  let ownerId = normalizeString(item?.ownerId);
  let targetType = normalizeString(item?.targetType);
  let targetId = normalizeString(item?.targetId);

  let userPerception = normalizeString(item?.userPerception);
  let rolePerception = normalizeString(item?.rolePerception);
  const legacyDescription = normalizeString(item?.description);

  // 兼容历史结构：mainRoleId + supportingRoleId + description
  if ((!ownerType || !ownerId || !targetType || !targetId) && legacySupportingRoleId) {
    if (legacyMainRoleId && legacyMainRoleId !== RELATION_SELF_ID) {
      ownerType = 'character';
      ownerId = legacyMainRoleId;
      rolePerception = rolePerception || legacyDescription;
    } else {
      ownerType = 'mask';
      ownerId = '';
      userPerception = userPerception || legacyDescription;
    }

    targetType = 'supporting';
    targetId = legacySupportingRoleId;
  }

  if (!userPerception && !rolePerception && legacyDescription) {
    userPerception = legacyDescription;
  }

  if (!RELATION_ENTITY_TYPES.includes(ownerType)) ownerType = 'mask';
  if (!RELATION_ENTITY_TYPES.includes(targetType)) targetType = 'supporting';

  return {
    id: normalizeString(item?.id) || uid('relation'),
    ownerType,
    ownerId,
    targetType,
    targetId,
    userPerception,
    rolePerception
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
  const relationOwnerExists = (item) => {
    if (item.ownerType === 'mask') return masks.some((mask) => mask.id === item.ownerId);
    if (item.ownerType === 'character') return characters.some((character) => character.id === item.ownerId);
    if (item.ownerType === 'supporting') return supportingRoles.some((supporting) => supporting.id === item.ownerId);
    return false;
  };

  const relationTargetExists = (item) => {
    if (item.targetType === 'mask') return masks.some((mask) => mask.id === item.targetId);
    if (item.targetType === 'character') return characters.some((character) => character.id === item.targetId);
    if (item.targetType === 'supporting') return supportingRoles.some((supporting) => supporting.id === item.targetId);
    return false;
  };

  const fallbackMaskId = masks[0]?.id || '';
  const relations = normalizeArray(safe.relations)
    .map((item) => normalizeRelation(item))
    .map((item) => {
      if (item.ownerType === 'mask' && !item.ownerId) {
        return { ...item, ownerId: fallbackMaskId };
      }
      return item;
    })
    .filter((item) => item.ownerId && item.targetId)
    .filter((item) => relationOwnerExists(item) && relationTargetExists(item));
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

// [模块标注] 酒馆 PNG 角色卡 UTF-8 Base64 解码模块：
// 统一把 PNG 文本块内的 base64 内容先转成字节，再按 UTF-8 解码，修复中文/多字节文本乱码导致的 JSON 解析失败
function safeBase64ToUtf8(value) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (_) {
    return '';
  }
}

function parsePossibleObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const direct = safeJsonParse(text);
  if (direct && typeof direct === 'object') return direct;

  const decoded = safeBase64ToUtf8(text);
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

/* [修改标注·需求4] mapImportedRole：
   - first_mes 不再导入到 signature，改为导入到 greetings[0]
   - 解析 alternate_greetings 数组追加到 greetings
   - signature 仅从 signature / tagline 字段取值 */
function mapImportedRole(rawObj) {
  const root = rawObj?.data && typeof rawObj.data === 'object' ? rawObj.data : rawObj || {};
  const name = pickFirst(root, ['name', 'char_name', 'characterName']);
  const gender = pickFirst(root, ['gender', 'sex']);
  const age = pickFirst(root, ['age']);
  const identity = pickFirst(root, ['identity', 'occupation', 'role', 'persona']);
  /* [修改标注·需求4] signature 不再从 first_mes 取值 */
  const signature = pickFirst(root, ['signature', 'tagline']);
  const contact = pickFirst(root, ['contact', 'wechat', 'wx']);
  const avatar = pickFirst(root, ['avatar', 'avatar_url', 'image', 'imageUrl']);

  let personalitySetting = pickFirst(root, ['description', 'personalitySetting', 'personality', 'scenario']);
  if (!personalitySetting && typeof root.description === 'object') {
    personalitySetting = JSON.stringify(root.description, null, 2);
  }

  /* [修改标注·需求4] 解析酒馆角色卡的 first_mes 和 alternate_greetings，导入到 greetings 数组 */
  const greetings = [];
  const firstMes = pickFirst(root, ['first_mes']);
  if (firstMes) greetings.push(firstMes);
  const altGreetings = normalizeArray(root.alternate_greetings || root.alternateGreetings);
  altGreetings.forEach((g) => {
    const text = normalizeString(g);
    if (text) greetings.push(text);
  });

  return normalizeProfile({
    id: uid('char'),
    name,
    gender,
    age,
    identity,
    signature,
    contact,
    personalitySetting,
    avatar,
    greetings
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
      cursor += 1;
      cursor += 1;
      readNullTerminated();
      readNullTerminated();
      const payload = dataBytes.slice(cursor);

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
      const decoded = safeBase64ToUtf8(text);
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

function compressImageDataUrl(dataUrl, {
  maxEdge = 640,
  quality = 0.82
} = {}) {
  return new Promise((resolve) => {
    const source = String(dataUrl || '');
    if (!source.startsWith('data:image/')) {
      resolve(source);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        if (!width || !height) {
          resolve(source);
          return;
        }

        const longest = Math.max(width, height);
        const scale = longest > maxEdge ? (maxEdge / longest) : 1;
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(source);
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        let compressed = source;
        try {
          compressed = canvas.toDataURL('image/webp', quality);
        } catch (_) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressed.length < source.length ? compressed : source);
      } catch (_) {
        resolve(source);
      }
    };

    img.onerror = () => resolve(source);
    img.src = source;
  });
}

async function fileToDataURL(file) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  if (!String(file?.type || '').startsWith('image/')) {
    return rawDataUrl;
  }

  return compressImageDataUrl(rawDataUrl);
}

/* [修改标注·本次问题1] 档案应用样式预加载守卫：
   进入应用时等待 archive.css 至少完成首次加载（或失败回调），
   避免先渲染无样式结构再“闪一下”套上样式。 */
function ensureArchiveStylesheet() {
  const waitForLink = (link) => new Promise((resolve) => {
    if (!link) {
      resolve(null);
      return;
    }

    if (link.dataset.loaded === '1' || link.sheet) {
      resolve(link);
      return;
    }

    const done = () => {
      link.dataset.loaded = '1';
      link.removeEventListener('load', done);
      link.removeEventListener('error', done);
      resolve(link);
    };

    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  });

  let link = document.getElementById(ARCHIVE_STYLE_ID);
  if (link) return waitForLink(link);

  link = document.createElement('link');
  link.id = ARCHIVE_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = 'js/apps/archive/archive.css';
  document.head.appendChild(link);
  return waitForLink(link);
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
    close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    docDetail: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 6h18l6 6v28H12V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M30 6v8h8" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M18 22h12M18 30h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    seal: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l4.6 4.2l6.1-.9l2.4 5.7l5.7 2.4l-.9 6.1L46 28l-4.2 4.6l.9 6.1l-5.7 2.4l-2.4 5.7l-6.1-.9L24 46l-4.6-4.2l-6.1.9l-2.4-5.7l-5.7-2.4l.9-6.1L2 24l4.2-4.6l-.9-6.1l5.7-2.4l2.4-5.7l6.1.9L24 6Z" fill="currentColor"/><circle cx="24" cy="24" r="8" fill="rgba(255,255,255,0.18)"/><path d="M20 27.5c1.6-3.8 6.4-3.8 8 0M19.5 20.5c1 .9 2.1 1.4 3.3 1.4c1.3 0 2.4-.5 3.5-1.4c.9 1 2 1.5 3.2 1.5" stroke="#F7E7D9" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    /* [修改标注·需求1] 世界书图标 */
    book: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 8h14a4 4 0 0 1 4 4v28a3 3 0 0 0-3-3H6V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M42 8H28a4 4 0 0 0-4 4v28a3 3 0 0 1 3-3h15V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
    /* [修改标注·需求4] 新增图标：折叠箭头、左右切换箭头、消息气泡 —— IconPark */
    chevronDown: `<svg viewBox="0 0 48 48" fill="none"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevronRight: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    left: `<svg viewBox="0 0 48 48" fill="none"><path d="M31 36L19 24L31 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    right: `<svg viewBox="0 0 48 48" fill="none"><path d="M19 12l12 12l-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    message: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 19.5h20M14 27.5h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
  };
}

export async function mount(container, context) {
  /* [修改标注·本次问题1] 等待样式资源进入可用状态后再挂载内容，减少首屏无样式闪烁 */
  await ensureArchiveStylesheet();
  const icon = icons();

  const state = {
    data: createDefaultData(),
    activeTab: 'mask',
    selectedMaskId: '',
    selectedCharacterId: '',
    selectedSupportingId: '',
    selectedRelationId: '',
    selectedRelationOwnerKey: '',
    relationEntityTab: 'mask',
    relationExpandedKeys: {},
    headerRefs: null,
    characterImageRatioMap: {},
    characterViewMode: 'list',
    /* [修改标注·需求6] 用户面具和配角档案也采用列表/详情切换模式 */
    maskViewMode: 'list',
    supportingViewMode: 'list'
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

    <!-- [模块标注] 角色档案直接导入模块：点击导入按钮后直接拉起本地文件 -->
    <input id="archive-character-import-input" type="file" accept=".png,.json,application/json,image/png" style="display:none;">

    <div id="archive-toast" class="archive-toast" aria-live="polite"></div>

    <div id="archive-modal" class="managed-resource-modal hidden" aria-hidden="true"></div>
  `;

  const contentEl = container.querySelector('#archive-content');
  const tabbarEl = container.querySelector('#archive-tabbar');
  const importInputEl = container.querySelector('#archive-character-import-input');
  const toastEl = container.querySelector('#archive-toast');
  const modalEl = container.querySelector('#archive-modal');

  let modalCleanup = () => {};
  let toastTimer = null;

  // [模块标注] 主界面图片比例识别模块：
  // 仅用于“用户面具 / 角色档案”主界面列表卡片展示比例判断；
  // 若图片更接近竖版，则显示竖向长卡；否则按正方形卡片展示。
  const detectImageShape = (avatar) => {
    const src = normalizeString(avatar);
    if (!src) return Promise.resolve('square');
    if (state.characterImageRatioMap[src]) return Promise.resolve(state.characterImageRatioMap[src]);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        const ratio = width && height ? height / width : 1;
        const shape = ratio >= 1.2 ? 'portrait' : 'square';
        state.characterImageRatioMap[src] = shape;
        resolve(shape);
      };
      img.onerror = () => {
        state.characterImageRatioMap[src] = 'square';
        resolve('square');
      };
      img.src = src;
    });
  };

  const syncCharacterImageShapes = async () => {
    const profileItems = [...state.data.masks, ...state.data.characters];
    const tasks = profileItems
      .map((item) => normalizeString(item.avatar))
      .filter(Boolean)
      .filter((avatar, index, array) => array.indexOf(avatar) === index)
      .map((avatar) => detectImageShape(avatar));

    if (!tasks.length) return;
    await Promise.all(tasks);
    if (state.activeTab === 'mask' || state.activeTab === 'character') {
      renderContent();
    }
  };

  const hasArchiveContent = (data) => {
    const safe = normalizeArchiveData(data);
    return safe.masks.length > 0
      || safe.characters.length > 0
      || safe.supportingRoles.length > 0
      || safe.relations.length > 0
      || !!safe.activeMaskId;
  };

  const loadPersistedArchiveData = async () => {
    try {
      const record = await context.db?.get?.('appsData', ARCHIVE_DB_RECORD_ID);
      if (record?.value && hasArchiveContent(record.value)) {
        return normalizeArchiveData(record.value);
      }
    } catch (_) {
      // IndexedDB 读取失败，返回默认数据
    }
    return createDefaultData();
  };

  const persistArchiveData = async () => {
    state.data.selectedTab = state.activeTab;
    const normalized = normalizeArchiveData(state.data);
    state.data = normalized;

    try {
      await context.db?.put?.('appsData', {
        id: ARCHIVE_DB_RECORD_ID,
        appId: context.appId,
        key: 'archive-data',
        value: normalized,
        updatedAt: Date.now()
      });
    } catch (_) {
      // 忽略 IndexedDB 写入失败，避免阻断 UI
    }
  };

  const saveData = () => {
    void persistArchiveData();
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

  const getMaskById = (id) => state.data.masks.find((item) => item.id === id);
  const getCharacterById = (id) => state.data.characters.find((item) => item.id === id);
  const getSupportingById = (id) => state.data.supportingRoles.find((item) => item.id === id);

  const getEntitiesByType = (type) => {
    if (type === 'mask') return state.data.masks;
    if (type === 'character') return state.data.characters;
    if (type === 'supporting') return state.data.supportingRoles;
    return [];
  };

  const getEntityByTypeAndId = (type, id) => {
    if (type === 'mask') return getMaskById(id);
    if (type === 'character') return getCharacterById(id);
    if (type === 'supporting') return getSupportingById(id);
    return null;
  };

  const getEntityDisplayName = (type, id) => {
    const entity = getEntityByTypeAndId(type, id);
    return entity?.name || '未命名';
  };

  const getEntityValueLabel = (value) => {
    const [type, ...rest] = String(value || '').split(':');
    const id = rest.join(':');
    return getEntityDisplayName(type, id);
  };

  const buildRelationOwnerKey = (type, id) => `${type}:${id}`;

  const parseRelationEntityValue = (value) => {
    const [type, ...rest] = String(value || '').split(':');
    return {
      type: RELATION_ENTITY_TYPES.includes(type) ? type : 'mask',
      id: rest.join(':')
    };
  };

  /* [修改标注·本次问题1] 按关系网络板块限制可选主体 */
  const getRelationOwnerOptionsByTab = (ownerType) => {
    return getEntitiesByType(ownerType).map((item) => ({
      value: `${ownerType}:${item.id}`,
      type: ownerType,
      id: item.id,
      label: item.name || '未命名'
    }));
  };

  /* [修改标注·本次问题1] 按主体类型限制可选对象 */
  const getRelationTargetOptionsByOwner = (ownerType, ownerId = '') => {
    const allowedTypes = RELATION_ALLOWED_TARGET_TYPES[ownerType] || [];
    return allowedTypes.flatMap((type) => {
      return getEntitiesByType(type).map((item) => ({
        value: `${type}:${item.id}`,
        type,
        id: item.id,
        label: item.name || '未命名'
      }));
    }).filter((item) => !(item.type === ownerType && item.id === ownerId));
  };

  /* [修改标注·本次问题1] 以当前实体视角解析关系认知（支持 owner/target 双向同步展示） */
  const resolveRelationPerspective = (relation, currentType, currentId) => {
    const isOwnerSide = relation.ownerType === currentType && relation.ownerId === currentId;
    const isTargetSide = relation.targetType === currentType && relation.targetId === currentId;
    if (!isOwnerSide && !isTargetSide) return null;

    const counterpartType = isOwnerSide ? relation.targetType : relation.ownerType;
    const counterpartId = isOwnerSide ? relation.targetId : relation.ownerId;
    const currentPerception = isOwnerSide ? relation.userPerception : relation.rolePerception;
    const counterpartPerception = isOwnerSide ? relation.rolePerception : relation.userPerception;

    return {
      relationId: relation.id,
      counterpartType,
      counterpartId,
      counterpartName: getEntityDisplayName(counterpartType, counterpartId),
      counterpartTypeLabel: RELATION_ENTITY_TAB_META[counterpartType]?.subtitle || '人物',
      currentPerception,
      counterpartPerception
    };
  };

  /* [修改标注·需求2] 关系网络系统提示词构建器：
     仅供后续聊天/AI 注入使用，不渲染到用户界面。若角色绑定了用户面具，会将该面具身份一起写入提示词。 */
  const buildRelationSystemPrompt = (ownerType, ownerId) => {
    const owner = getEntityByTypeAndId(ownerType, ownerId);
    if (!owner) return '';

    const ownerName = owner.name || '未命名';
    const ownerTypeLabel = RELATION_ENTITY_TAB_META[ownerType]?.subtitle || '人物';
    const boundMasks = ownerType === 'character'
      ? state.data.masks.filter((mask) => (mask.roleBindingIds || []).includes(ownerId))
      : [];

    const ownerRelations = state.data.relations.filter((item) => item.ownerType === ownerType && item.ownerId === ownerId);
    const relationLines = ownerRelations.map((item) => {
      const targetName = getEntityDisplayName(item.targetType, item.targetId);
      const targetTypeLabel = RELATION_ENTITY_TAB_META[item.targetType]?.subtitle || '人物';
      return `- 与${targetTypeLabel}「${targetName}」：${item.userPerception || '未填写'}；对方认知：${item.rolePerception || '未填写'}`;
    });

    return [
      `这是${ownerTypeLabel}「${ownerName}」的人际关系网络资料。`,
      boundMasks.length ? `该角色当前绑定的用户面具身份：${boundMasks.map((item) => item.name || '未命名面具').join('、')}。` : '',
      relationLines.length ? '请将以下关系网络作为角色认知与互动上下文的一部分：' : '',
      ...relationLines
    ].filter(Boolean).join('\n');
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
      <div class="archive-mini-box"><label>个性签名</label><p>${escapeHtml(item.signature || '—')}</p></div>
      <div class="archive-mini-box"><label>联系方式</label><p>${escapeHtml(item.contact || '—')}</p></div>
    </div>
  `;

  const resolveProfileCardShapeClass = (item) => {
    const avatar = normalizeString(item?.avatar);
    const shape = avatar ? (state.characterImageRatioMap[avatar] || 'square') : 'square';
    return shape === 'portrait' ? 'is-portrait' : 'is-square';
  };

  // [模块标注] 档案摘要列表模块：
  // 用户面具 / 角色档案 / 配角档案在板块中显示摘要卡；
  // 其中用户面具 / 角色档案支持根据上传图片比例自动切换为竖版卡或正方卡。
  const renderCompactProfileList = (items, selectedId, actionName, emptyLabel, enableShapeMode = false) => `
    <div class="archive-compact-list ${enableShapeMode ? 'archive-compact-list--shape-aware' : ''}">
      ${items.map((item) => {
        const shapeClass = enableShapeMode ? resolveProfileCardShapeClass(item) : '';
        return `
          <button
            class="archive-compact-card ${shapeClass} ${selectedId === item.id ? 'is-selected' : ''}"
            type="button"
            data-action="${actionName}"
            data-id="${item.id}"
          >
            <div class="archive-avatar-box archive-avatar-box--small ${enableShapeMode ? 'archive-avatar-box--adaptive' : ''} ${item.avatar ? 'has-image' : ''}">
              ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || emptyLabel)}">` : '<span>头像</span>'}
            </div>
            <span class="archive-compact-card__name">${escapeHtml(item.name || '未命名')}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;

  /* [修改标注·需求6] 用户面具详情改为与角色档案一致的纸质展开样式
     [修改标注·需求7] 面具生效开关移到详情页关闭按钮下方，删除"选定"按钮 */
  const buildMaskDetailCard = (item) => {
    const isActiveMask = item.id === state.data.activeMaskId;
    const boundRoles = (item.roleBindingIds || [])
      .map((id) => getCharacterById(id))
      .filter(Boolean);

    return `
      <article class="archive-character-paper" data-card-id="${item.id}">
        <!-- 右上角关闭按钮 -->
        <button class="archive-paper-close-btn" type="button" data-action="close-mask-detail" aria-label="关闭详情返回列表">
          ${icon.close}
        </button>

        <!-- [修改标注·需求7] 面具生效开关在关闭按钮下方 -->
        <div class="archive-mask-active-toggle" style="position:absolute;top:52px;right:12px;z-index:5;">
          <label class="toggle-switch" title="${isActiveMask ? '当前已生效' : '点击设为生效身份'}">
            <input data-role="mask-active-toggle" data-id="${item.id}" type="checkbox" ${isActiveMask ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <i class="archive-paper-corner archive-paper-corner--tl"></i>
        <i class="archive-paper-corner archive-paper-corner--tr"></i>
        <i class="archive-paper-corner archive-paper-corner--bl"></i>
        <i class="archive-paper-corner archive-paper-corner--br"></i>

        <header class="archive-character-paper__header">
          <div class="archive-character-paper__title-block">
            <!-- [修改标注·需求4] 角色名上方改为斜体花体英文"秘密档案" -->
            <span class="archive-character-paper__en-name">Secret Files</span>
            <h3>${escapeHtml(item.name || '未命名面具')}</h3>
            <div class="archive-badges archive-badges--paper">
              ${isActiveMask ? '<span class="archive-badge archive-badge--active">当前生效</span>' : ''}
            </div>
          </div>
          <div class="archive-character-paper__actions" aria-label="面具操作">
            <button class="archive-character-paper__icon-btn" type="button" data-action="edit-mask" data-id="${item.id}" aria-label="编辑面具">
              ${icon.edit}
            </button>
            <button class="archive-character-paper__icon-btn is-danger" type="button" data-action="delete-mask" data-id="${item.id}" aria-label="删除面具">
              ${icon.remove}
            </button>
          </div>
        </header>

        <hr class="archive-paper-divider">

        <section class="archive-character-paper__hero">
          <div class="archive-character-paper__photo ${item.avatar ? 'has-image' : ''}">
            ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '面具头像')}">` : '<span>头像</span>'}
          </div>
          <div class="archive-character-paper__summary">
            <div class="archive-character-paper__summary-grid archive-character-paper__summary-grid--side">
              <div class="archive-character-paper__field">
                <!-- [修改标注·需求3] 去除英文标题 -->
                <label>性别</label>
                <p>${escapeHtml(item.gender || '—')}</p>
              </div>
              <div class="archive-character-paper__field">
                <label>年龄</label>
                <p>${escapeHtml(item.age || '—')}</p>
              </div>
              <div class="archive-character-paper__field">
                <label>身份</label>
                <p>${escapeHtml(item.identity || '—')}</p>
              </div>
              <div class="archive-character-paper__field">
                <label>联系方式</label>
                <p>${escapeHtml(item.contact || '—')}</p>
              </div>
            </div>
          </div>
        </section>

        <hr class="archive-paper-divider">

        <section class="archive-character-paper__section">
          <div class="archive-character-paper__section-title">
            <!-- [修改标注·需求3] 改名为个性签名，去除英文 -->
            <span>个性签名</span>
          </div>
          <div class="archive-character-paper__content">
            <p>${escapeHtml(item.signature || '—')}</p>
          </div>
        </section>

        <section class="archive-character-paper__section archive-setting-section" data-collapsed="true">
          <div class="archive-character-paper__section-title archive-setting-toggle" data-action="toggle-setting" style="cursor:pointer;">
            <!-- [修改标注·需求3] 去除英文标题 -->
            <span>用户设定</span>
            <i class="archive-setting-chevron">${icon.chevronRight}</i>
          </div>
          <div class="archive-setting-body" style="display:none;">
            <div class="archive-character-paper__content archive-character-paper__content--fixed">
              <p>${escapeHtml(item.personalitySetting || '—')}</p>
            </div>
          </div>
        </section>

        <div class="archive-chip-list" style="position:relative;z-index:1;">
          ${boundRoles.length
            ? boundRoles.map((role) => `<span class="archive-chip">${escapeHtml(role.name || '未命名角色')}</span>`).join('')
            : '<span class="archive-chip archive-chip--muted">尚未绑定角色</span>'}
        </div>
      </article>
    `;
  };

  const buildCharacterDetailCard = (item) => `
    <article class="archive-profile-card is-selected" data-card-id="${item.id}">
      <header class="archive-profile-card__header">
        <div class="archive-avatar-box ${item.avatar ? 'has-image' : ''}">
          ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '角色头像')}">` : '<span>头像</span>'}
        </div>
        <div class="archive-profile-card__meta">
          <h3>${escapeHtml(item.name || '未命名角色')}</h3>
          <div class="archive-badges">
            <span class="archive-badge archive-badge--active">已选中</span>
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
  `;

  // [模块标注] 角色档案双列错落卡片列表模块：
  // 改为两列错落分布（masonry式）网格，支持上下滚动。移除底部默认展示详情的行为。
  // [模块标注] 角色档案双列错落卡片列表模块：
  // 所有偶数列（0-based 奇数 index）卡片向下偏移，形成错落效果
  const renderCharacterProfileList = (items) => `
    <div class="archive-character-grid" aria-label="角色档案列表">
      ${items.map((item, index) => {
        const shapeClass = resolveProfileCardShapeClass(item);
        const staggerClass = index % 2 === 1 ? 'is-staggered-top' : '';
        return `
          <button
            class="archive-character-grid-card ${shapeClass} ${staggerClass}"
            type="button"
            data-action="show-character-detail"
            data-id="${item.id}"
            aria-label="查看${escapeHtml(item.name || '未命名角色')}档案"
          >
            <div class="archive-character-grid-card__media ${item.avatar ? 'has-image' : ''}">
              ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '角色头像')}">` : `<span>${icon.docDetail}</span>`}
            </div>
            <div class="archive-character-grid-card__meta">
              <strong>${escapeHtml(item.name || '未命名')}</strong>
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  // [模块标注] 角色档案复古纸质详情模块：
  // [模块标注] 角色档案详情关闭返回模块
  // [模块标注] 角色档案头像右侧基础信息模块
  // [模块标注] 角色档案人物设定固定容器模块
  /* [修改标注·需求1] 去除姓名栏，仅保留顶部放大加粗的 h3 标题
     [修改标注·需求2] 去除"角色登记档案表"和"Internal Character Archives"字样，编辑/删除按钮保持右侧
     [修改标注·需求3] 头像左侧，性别/年龄/身份/联系方式在右侧；一句话签名和人物设定在头像下方
     [修改标注·需求4c] 人物设定下方新增"开场白"可折叠栏 */
  const buildCharacterArchivePaper = (item) => {
    const greetings = normalizeArray(item.greetings);
    const firstGreeting = greetings.length > 0 ? greetings[0] : '';
    const hasMultipleGreetings = greetings.length > 1;

    return `
    <article class="archive-character-paper" data-card-id="${item.id}">
      <!-- [模块标注] 角色档案右上角关闭按钮 -->
      <button class="archive-paper-close-btn" type="button" data-action="close-character-detail" aria-label="关闭详情返回列表">
        ${icon.close}
      </button>

      <!-- [模块标注] 角色档案纸张装饰角花 -->
      <i class="archive-paper-corner archive-paper-corner--tl"></i>
      <i class="archive-paper-corner archive-paper-corner--tr"></i>
      <i class="archive-paper-corner archive-paper-corner--bl"></i>
      <i class="archive-paper-corner archive-paper-corner--br"></i>

      <!-- [修改标注·需求3] 去除纸张底部装饰性水印印章圆圈 -->

      <!-- [修改标注·需求2] 姓名上方添加英文装饰名 + 去除 eyebrow 和 subtitle -->
      <header class="archive-character-paper__header">
        <div class="archive-character-paper__title-block">
          <!-- [修改标注·需求4] 角色名上方改为斜体花体英文"秘密档案" -->
          <span class="archive-character-paper__en-name">Secret Files</span>
          <h3>${escapeHtml(item.name || '未命名角色')}</h3>
        </div>
        <div class="archive-character-paper__actions" aria-label="角色档案操作">
          <button class="archive-character-paper__icon-btn" type="button" data-action="edit-character" data-id="${item.id}" aria-label="编辑角色">
            ${icon.edit}
          </button>
          <button class="archive-character-paper__icon-btn is-danger" type="button" data-action="delete-character" data-id="${item.id}" aria-label="删除角色">
            ${icon.remove}
          </button>
        </div>
      </header>

      <!-- [模块标注] 纸张装饰分割线 -->
      <hr class="archive-paper-divider">

      <!-- [修改标注·需求3] 头像左侧，性别/年龄/身份/联系方式在头像右侧 -->
      <section class="archive-character-paper__hero">
        <div class="archive-character-paper__photo ${item.avatar ? 'has-image' : ''}">
          ${item.avatar
            ? `<div class="archive-character-paper__photo-bg" role="img" aria-label="${escapeHtml(item.name || '角色头像')}" style="background-image:url('${escapeHtml(item.avatar)}');"></div>`
            : `<span>${icon.docDetail}</span>`}
        </div>

        <div class="archive-character-paper__summary">
          <div class="archive-character-paper__summary-grid archive-character-paper__summary-grid--side">
            <!-- [修改标注·需求1] 已去除姓名栏 -->
            <div class="archive-character-paper__field">
              <!-- [修改标注·需求3] 去除英文标题 -->
              <label>性别</label>
              <p>${escapeHtml(item.gender || '—')}</p>
            </div>
            <div class="archive-character-paper__field">
              <label>年龄</label>
              <p>${escapeHtml(item.age || '—')}</p>
            </div>
            <div class="archive-character-paper__field">
              <label>身份</label>
              <p>${escapeHtml(item.identity || '—')}</p>
            </div>
            <div class="archive-character-paper__field">
              <label>联系方式</label>
              <p>${escapeHtml(item.contact || '—')}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- [模块标注] 纸张装饰分割线 -->
      <hr class="archive-paper-divider">

      <!-- [修改标注·需求3] 一句话签名在头像下方 -->
      <section class="archive-character-paper__section">
        <div class="archive-character-paper__section-title">
          <!-- [修改标注·需求3] 改名为个性签名，去除英文 -->
          <span>个性签名</span>
        </div>
        <div class="archive-character-paper__content">
          <p>${escapeHtml(item.signature || '—')}</p>
        </div>
      </section>

      <!-- [修改标注·需求1] 人物设定改为折叠栏样式 + 印章改为展开/收起图标 -->
      <section class="archive-character-paper__section archive-setting-section" data-collapsed="true">
        <div class="archive-character-paper__section-title archive-setting-toggle" data-action="toggle-setting" style="cursor:pointer;">
          <!-- [修改标注·需求3] 去除英文标题 -->
          <span>人物设定</span>
          <i class="archive-setting-chevron">${icon.chevronRight}</i>
        </div>
        <div class="archive-setting-body" style="display:none;">
          <div class="archive-character-paper__content archive-character-paper__content--fixed">
            <p>${escapeHtml(item.personalitySetting || '—')}</p>
          </div>
        </div>
      </section>

      <!-- [修改标注·需求4c] 开场白折叠栏：点击标题展开/收起；多开场白时显示切换按钮 -->
      <section class="archive-character-paper__section archive-greeting-section" data-collapsed="true">
        <div class="archive-character-paper__section-title archive-greeting-toggle" data-action="toggle-greeting" style="cursor:pointer;">
          <!-- [修改标注·需求3] 去除英文标题 -->
          <span>开场白${greetings.length > 0 ? ' (' + greetings.length + ')' : ''}</span>
          <!-- [修改标注·需求1] 查看全部按钮移到右侧，使用图标代替文字 -->
          <span style="display:flex;align-items:center;gap:4px;">
            ${hasMultipleGreetings ? `<button class="archive-character-paper__icon-btn" type="button" data-action="open-greeting-preview" data-id="${item.id}" aria-label="查看全部开场白" style="width:26px;height:26px;" title="查看全部开场白">${icon.message}</button>` : ''}
            <i class="archive-greeting-chevron">${icon.chevronRight}</i>
          </span>
        </div>
        <div class="archive-greeting-body" style="display:none;">
          ${greetings.length > 0 ? `
            <div class="archive-character-paper__content archive-character-paper__content--fixed">
              <p>${escapeHtml(firstGreeting)}</p>
            </div>
          ` : `
            <div class="archive-character-paper__content">
              <p style="color:var(--archive-subtext);">暂无开场白</p>
            </div>
          `}
        </div>
      </section>

      <!-- [修改标注·本次需求2] 绑定世界书改为折叠栏，显示世情局部板块所有世界书，点击切换绑定状态 -->
      ${(() => {
        const localBooks = getLocalWorldBooks();
        if (!localBooks.length) return '';
        return `
      <section class="archive-character-paper__section archive-worldbook-section archive-setting-section" data-collapsed="true">
        <div class="archive-character-paper__section-title archive-setting-toggle" data-action="toggle-setting" style="cursor:pointer;">
          <!-- [修改标注·本次需求·修改1] 去除绑定世界书上方的大图标，仅保留文字 -->
          <span>绑定世界书</span>
          <i class="archive-setting-chevron">${icon.chevronRight}</i>
        </div>
        <div class="archive-setting-body" style="display:none;">
          <div class="archive-wb-bind-list">
            ${localBooks.map(wb => {
              const isBound = wb.boundCharacterIds.includes(item.id);
              return `<button type="button" class="archive-wb-bind-chip ${isBound ? 'is-bound' : ''}" data-action="toggle-wb-bind" data-book-id="${wb.id}" data-char-id="${item.id}">${escapeHtml(wb.name)}</button>`;
            }).join('')}
          </div>
        </div>
      </section>`;
      })()}
    </article>
  `;
  };

  /* [修改标注·需求6] 配角档案详情改为与角色档案一致的纸质展开样式 */
  const buildSupportingDetailCard = (item) => `
    <article class="archive-character-paper" data-card-id="${item.id}">
      <button class="archive-paper-close-btn" type="button" data-action="close-supporting-detail" aria-label="关闭详情返回列表">
        ${icon.close}
      </button>

      <i class="archive-paper-corner archive-paper-corner--tl"></i>
      <i class="archive-paper-corner archive-paper-corner--tr"></i>
      <i class="archive-paper-corner archive-paper-corner--bl"></i>
      <i class="archive-paper-corner archive-paper-corner--br"></i>

      <header class="archive-character-paper__header">
        <div class="archive-character-paper__title-block">
          <!-- [修改标注·需求4] 角色名上方改为斜体花体英文"秘密档案" -->
          <span class="archive-character-paper__en-name">Secret Files</span>
          <h3>${escapeHtml(item.name || '未命名配角')}</h3>
        </div>
        <div class="archive-character-paper__actions" aria-label="配角操作">
          <button class="archive-character-paper__icon-btn" type="button" data-action="edit-supporting" data-id="${item.id}" aria-label="编辑配角">
            ${icon.edit}
          </button>
          <button class="archive-character-paper__icon-btn is-danger" type="button" data-action="delete-supporting" data-id="${item.id}" aria-label="删除配角">
            ${icon.remove}
          </button>
        </div>
      </header>

      <hr class="archive-paper-divider">

      <section class="archive-character-paper__hero">
        <div class="archive-character-paper__photo ${item.avatar ? 'has-image' : ''}">
          ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name || '配角头像')}">` : '<span>头像</span>'}
        </div>
        <div class="archive-character-paper__summary">
          <div class="archive-character-paper__summary-grid archive-character-paper__summary-grid--side">
            <div class="archive-character-paper__field">
              <!-- [修改标注·需求3] 去除英文标题 -->
              <label>姓名</label>
              <p>${escapeHtml(item.name || '—')}</p>
            </div>
            <div class="archive-character-paper__field">
              <label>性别</label>
              <p>${escapeHtml(item.gender || '—')}</p>
            </div>
          </div>
        </div>
      </section>

      <hr class="archive-paper-divider">

      <section class="archive-character-paper__section archive-setting-section" data-collapsed="true">
        <div class="archive-character-paper__section-title archive-setting-toggle" data-action="toggle-setting" style="cursor:pointer;">
          <!-- [修改标注·需求3] 去除英文标题 -->
          <span>基本设定</span>
          <i class="archive-setting-chevron">${icon.chevronRight}</i>
        </div>
        <div class="archive-setting-body" style="display:none;">
          <div class="archive-character-paper__content archive-character-paper__content--fixed">
            <p>${escapeHtml(item.basicSetting || '—')}</p>
          </div>
        </div>
      </section>
    </article>
  `;

  /* [修改标注·需求6] 用户面具改为点击卡片展开详情（与角色档案一致的列表/详情切换模式） */
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

    const selected = list.find((item) => item.id === state.selectedMaskId) || list[0];

    if (state.maskViewMode === 'detail' && selected) {
      return `
        <section class="archive-character-panel">
          <section class="archive-character-detail-section">
            ${buildMaskDetailCard(selected)}
          </section>
        </section>
      `;
    }

    return `
      <section class="archive-character-panel">
        ${renderCompactProfileList(list, '', 'open-mask-detail', '面具头像', true)}
      </section>
    `;
  };

  // [模块标注] 角色档案点击展开详情模块
  // 在内容区内互相替换，不将详情页面放在底部TAB栏上层
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

    const selected = list.find((item) => item.id === state.selectedCharacterId) || list[0];

    if (state.characterViewMode === 'detail' && selected) {
      return `
        <section class="archive-character-panel">
          <section class="archive-character-detail-section">
            ${buildCharacterArchivePaper(selected)}
          </section>
        </section>
      `;
    }

    return `
      <section class="archive-character-panel">
        ${renderCharacterProfileList(list)}
      </section>
    `;
  };

  /* [修改标注·需求6] 配角档案改为点击卡片展开详情（与角色档案一致的列表/详情切换模式） */
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

    const selected = list.find((item) => item.id === state.selectedSupportingId) || list[0];

    if (state.supportingViewMode === 'detail' && selected) {
      return `
        <section class="archive-character-panel">
          <section class="archive-character-detail-section">
            ${buildSupportingDetailCard(selected)}
          </section>
        </section>
      `;
    }

    return `
      <section class="archive-character-panel">
        ${renderCompactProfileList(list, '', 'open-supporting-detail', '配角头像')}
      </section>
    `;
  };

  const renderRelationTab = () => {
    const ownerCards = getEntitiesByType(state.relationEntityTab)
      .map((item) => {
        const relationCount = state.data.relations.filter((relation) => {
          return (
            (relation.ownerType === state.relationEntityTab && relation.ownerId === item.id)
            || (relation.targetType === state.relationEntityTab && relation.targetId === item.id)
          );
        }).length;

        return {
          key: buildRelationOwnerKey(state.relationEntityTab, item.id),
          id: item.id,
          type: state.relationEntityTab,
          name: item.name || '未命名',
          avatar: item.avatar || '',
          relationCount
        };
      })
      .filter((item) => item.relationCount > 0);

    if (!ownerCards.some((item) => item.key === state.selectedRelationOwnerKey)) {
      state.selectedRelationOwnerKey = ownerCards[0]?.key || '';
    }

    const [selectedOwnerType = '', selectedOwnerId = ''] = state.selectedRelationOwnerKey.split(':');
    const selectedOwner = ownerCards.find((item) => item.key === state.selectedRelationOwnerKey) || null;

    const perspectiveRelations = selectedOwner
      ? state.data.relations
        .map((relation) => resolveRelationPerspective(relation, selectedOwnerType, selectedOwnerId))
        .filter(Boolean)
      : [];

    const groupedRelations = perspectiveRelations.reduce((acc, item) => {
      const key = buildRelationOwnerKey(item.counterpartType, item.counterpartId);
      const current = acc.get(key) || {
        key,
        counterpartType: item.counterpartType,
        counterpartId: item.counterpartId,
        counterpartName: item.counterpartName,
        counterpartTypeLabel: item.counterpartTypeLabel,
        items: []
      };
      current.items.push(item);
      acc.set(key, current);
      return acc;
    }, new Map());

    const relationGroups = Array.from(groupedRelations.values());

    return `
      <section class="archive-relation-layout">
        <div class="archive-relation-tabs" aria-label="关系网络分类">
          ${RELATION_ENTITY_TYPES.map((type) => `
            <button
              class="archive-relation-tabs__btn ${state.relationEntityTab === type ? 'is-active' : ''}"
              type="button"
              data-action="switch-relation-entity-tab"
              data-tab="${type}"
            >
              ${escapeHtml(RELATION_ENTITY_TAB_META[type].label)}
            </button>
          `).join('')}
        </div>

        ${ownerCards.length ? `
          <div class="archive-relation-owner-list">
            ${ownerCards.map((item) => `
              <button
                class="archive-relation-owner-card ${state.selectedRelationOwnerKey === item.key ? 'is-selected' : ''}"
                type="button"
                data-action="select-relation-owner"
                data-owner-key="${item.key}"
              >
                <div class="archive-avatar-box archive-avatar-box--small ${item.avatar ? 'has-image' : ''}">
                  ${item.avatar ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.name)}">` : '<span>头像</span>'}
                </div>
                <div class="archive-relation-owner-card__meta">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span>${escapeHtml(RELATION_ENTITY_TAB_META[item.type].subtitle)} · ${item.relationCount} 条关系</span>
                </div>
                <i class="archive-relation-owner-card__arrow">${icon.chevronRight}</i>
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="archive-empty-card">
            <h3>暂无${escapeHtml(RELATION_ENTITY_TAB_META[state.relationEntityTab].label)}关系卡片</h3>
            <p>点击标题栏右上角 + 新增关系网络后，会按用户 / 角色 / NPC 自动归类显示。</p>
          </div>
        `}

        ${selectedOwner ? `
          <div class="archive-relation-list">
            ${relationGroups.map((group) => {
              const isExpanded = !!state.relationExpandedKeys[group.key];
              return `
                <article class="archive-relation-item archive-relation-accordion ${isExpanded ? 'is-expanded' : ''}">
                  <button
                    class="archive-relation-accordion__head"
                    type="button"
                    data-action="toggle-relation-group"
                    data-group-key="${group.key}"
                  >
                    <div class="archive-relation-item__title">
                      <strong>${escapeHtml(group.counterpartName)}</strong>
                      <span>${escapeHtml(group.counterpartTypeLabel)} · ${group.items.length} 条消息</span>
                    </div>
                    <i class="archive-relation-accordion__arrow">${isExpanded ? icon.chevronDown : icon.chevronRight}</i>
                  </button>

                  <div class="archive-relation-accordion__body" style="${isExpanded ? '' : 'display:none;'}">
                    ${group.items.map((item, index) => {
                      const selfName = selectedOwner?.name || '未命名';
                      const otherName = item.counterpartName;
                      const systemPrompt = buildRelationSystemPrompt(selectedOwnerType, selectedOwnerId);
                      return `
                        <section class="archive-relation-detail-item">
                          <div class="archive-relation-detail-item__head">
                            <strong>${escapeHtml(otherName)} · 关系记录 ${index + 1}</strong>
                            <div class="archive-relation-detail-item__tools">
                              <button class="archive-character-paper__icon-btn" type="button" data-action="edit-relation" data-id="${item.relationId}" aria-label="编辑关系">${icon.edit}</button>
                              <button class="archive-character-paper__icon-btn is-danger" type="button" data-action="delete-relation" data-id="${item.relationId}" aria-label="删除关系">${icon.remove}</button>
                            </div>
                          </div>
                          <div class="archive-relation-cognition">
                            <label>${escapeHtml(selfName)}对${escapeHtml(otherName)}的关系认知</label>
                            <p>${escapeHtml(item.currentPerception || '未填写')}</p>
                          </div>
                          <div class="archive-relation-cognition">
                            <label>${escapeHtml(otherName)}对${escapeHtml(selfName)}的关系认知</label>
                            <p>${escapeHtml(item.counterpartPerception || '未填写')}</p>
                          </div>
                          <div hidden>${escapeHtml(systemPrompt)}</div>
                        </section>
                      `;
                    }).join('')}
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        ` : ''}
      </section>
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
      importInputEl?.click();
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
        openRelationEditor();
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

    if (importBtn) importBtn.style.display = isCharacter ? '' : 'none';
    if (exportBtn) exportBtn.style.display = isCharacter ? '' : 'none';
    if (addBtn) addBtn.style.display = '';
  };

  const rerender = () => {
    renderContent();
    updateHeaderControls();
    saveData();
    syncCharacterImageShapes();
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
            <span class="archive-check-item__control" aria-hidden="true">${icon.check}</span>
            <span class="archive-check-item__text">${escapeHtml(role.name || '未命名角色')}</span>
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
            <!-- [修改标注·需求3] "一句话签名"改名为"个性签名" -->
            <label><span>个性签名</span><input data-role="signature" type="text" value="${escapeHtml(currentItem?.signature || '')}" /></label>
            <!-- [修改标注·需求5] 去除编辑框里的"（微信号）"文字 -->
            <label><span>联系方式</span><input data-role="contact" type="text" value="${escapeHtml(currentItem?.contact || '')}" /></label>
          </div>

          <label class="archive-form-row">
            <span>${isMask ? '用户设定' : '人物设定'}</span>
            <textarea data-role="personalitySetting" rows="5" placeholder="${isMask ? '请输入用户设定' : '请输入人物设定'}">${escapeHtml(currentItem?.personalitySetting || '')}</textarea>
          </label>

          ${!isMask ? `
          <!-- [修改标注·需求4d] 开场白编辑区域：多行文本框 + 选择/新增/删除按钮 -->
          <div class="archive-form-row archive-greeting-editor" data-greeting-index="0">
            <span>开场白</span>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span class="archive-greeting-editor-label" style="font-size:11px;color:var(--archive-subtext);">第 1 / ${Math.max((currentItem?.greetings || []).length, 1)} 条</span>
              <button type="button" class="archive-character-paper__icon-btn" data-action="greeting-editor-prev" aria-label="上一条开场白" style="width:26px;height:26px;">${icon.left}</button>
              <button type="button" class="archive-character-paper__icon-btn" data-action="greeting-editor-next" aria-label="下一条开场白" style="width:26px;height:26px;">${icon.right}</button>
              <button type="button" class="archive-character-paper__icon-btn" data-action="greeting-editor-add" aria-label="新增开场白" style="width:26px;height:26px;">${icon.plus}</button>
              <button type="button" class="archive-character-paper__icon-btn is-danger" data-action="greeting-editor-delete" aria-label="删除当前开场白" style="width:26px;height:26px;">${icon.remove}</button>
            </div>
            <textarea data-role="greeting-text" rows="4" placeholder="请输入开场白内容">${escapeHtml((currentItem?.greetings || [])[0] || '')}</textarea>
          </div>
          ` : ''}

          ${isMask ? `
            <!-- [模块标注] 面具绑定角色模块：支持多选绑定角色档案 -->
            <div class="archive-form-row">
              <span>绑定角色（可多选）</span>
              <div class="archive-check-list">${roleOptionsHtml}</div>
            </div>

            <!-- [修改标注·需求6] 已移除编辑窗口的"保存后设为当前生效身份"开关，仅保留展示页面上的生效开关 -->
          ` : ''}
        </div>
      `,
      onOpen: (modalScope) => {
        bindAvatarFormEvents(modalScope);

        /* [修改标注·需求4d] 开场白编辑器交互逻辑：切换/新增/删除开场白 */
        if (!isMask) {
          const greetingsData = [...(currentItem?.greetings || [])];
          if (!greetingsData.length) greetingsData.push('');
          let gIndex = 0;

          const syncGreetingUI = () => {
            const editor = modalScope.querySelector('.archive-greeting-editor');
            if (!editor) return;
            const textarea = editor.querySelector('[data-role="greeting-text"]');
            const label = editor.querySelector('.archive-greeting-editor-label');
            if (textarea) textarea.value = greetingsData[gIndex] || '';
            if (label) label.textContent = `第 ${gIndex + 1} / ${greetingsData.length} 条`;
            editor.setAttribute('data-greeting-index', String(gIndex));
          };

          const saveCurrentGreeting = () => {
            const textarea = modalScope.querySelector('[data-role="greeting-text"]');
            if (textarea) greetingsData[gIndex] = normalizeString(textarea.value);
          };

          // Store greetingsData on modalScope for onConfirm to access
          modalScope.__greetingsData = greetingsData;
          modalScope.__saveCurrentGreeting = saveCurrentGreeting;

          modalScope.addEventListener('click', (e) => {
            const act = e.target.closest('[data-action]')?.getAttribute('data-action');
            if (act === 'greeting-editor-prev' && gIndex > 0) {
              saveCurrentGreeting();
              gIndex--;
              syncGreetingUI();
            }
            if (act === 'greeting-editor-next' && gIndex < greetingsData.length - 1) {
              saveCurrentGreeting();
              gIndex++;
              syncGreetingUI();
            }
            if (act === 'greeting-editor-add') {
              saveCurrentGreeting();
              greetingsData.push('');
              gIndex = greetingsData.length - 1;
              syncGreetingUI();
            }
            if (act === 'greeting-editor-delete') {
              if (greetingsData.length <= 1) {
                greetingsData[0] = '';
                gIndex = 0;
                syncGreetingUI();
                return;
              }
              greetingsData.splice(gIndex, 1);
              if (gIndex >= greetingsData.length) gIndex = greetingsData.length - 1;
              syncGreetingUI();
            }
          });
        }
      },
      onConfirm: (modalScope) => {
        /* [修改标注·需求4d] 收集开场白数据 */
        let greetings = [];
        if (!isMask && modalScope.__saveCurrentGreeting) {
          modalScope.__saveCurrentGreeting();
          greetings = (modalScope.__greetingsData || []).filter((g) => normalizeString(g));
        }

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
          greetings: !isMask ? greetings : undefined,
          /* [修改标注·需求1] 编辑角色档案时保留导入角色卡自带的绑定世界书元数据 */
          boundWorldBooks: !isMask ? (currentItem?.boundWorldBooks || []) : undefined,
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
    const lockedOwnerType = isEdit
      ? currentItem.ownerType
      : (RELATION_ENTITY_TYPES.includes(state.relationEntityTab) ? state.relationEntityTab : 'mask');

    const ownerOptions = getRelationOwnerOptionsByTab(lockedOwnerType);
    if (!ownerOptions.length) {
      notify(`请先创建至少一个${RELATION_ENTITY_TAB_META[lockedOwnerType]?.label || '关系主体'}`, 'error');
      return;
    }

    const defaultOwnerValue = isEdit
      ? `${currentItem.ownerType}:${currentItem.ownerId}`
      : (state.selectedRelationOwnerKey && state.selectedRelationOwnerKey.startsWith(`${lockedOwnerType}:`)
        ? state.selectedRelationOwnerKey
        : ownerOptions[0].value);

    const defaultOwner = parseRelationEntityValue(defaultOwnerValue);
    const initialTargetOptions = getRelationTargetOptionsByOwner(defaultOwner.type, defaultOwner.id);
    if (!initialTargetOptions.length) {
      notify('当前关系主体没有可选关系对象，请先补充其它类型档案', 'error');
      return;
    }

    const defaultTargetValue = isEdit
      ? `${currentItem.targetType}:${currentItem.targetId}`
      : initialTargetOptions[0].value;

    openModal({
      title: `${isEdit ? '编辑' : '新增'}关系条目`,
      confirmText: isEdit ? '保存修改' : '创建',
      content: `
        <div class="archive-form-grid">
          <label class="archive-form-row">
            <span>关系主体（锁定为${escapeHtml(RELATION_ENTITY_TAB_META[lockedOwnerType]?.label || '主体')}）</span>
            <input type="hidden" data-role="relation-owner" value="${escapeHtml(defaultOwnerValue)}">
            <button class="archive-relation-picker-trigger" type="button" data-action="open-owner-picker">
              <span data-role="relation-owner-trigger-text">${escapeHtml(getEntityValueLabel(defaultOwnerValue))}</span>
              <i>${icon.chevronRight}</i>
            </button>
            <div class="archive-relation-picker-modal hidden" data-role="owner-picker-modal">
              <div class="archive-relation-picker-modal__panel">
                <div class="archive-relation-picker-modal__header">
                  <strong>选择关系主体</strong>
                  <button class="archive-character-paper__icon-btn" type="button" data-action="close-owner-picker" aria-label="关闭">${icon.close}</button>
                </div>
                <div class="archive-relation-picker-modal__list" data-role="owner-picker-options"></div>
              </div>
            </div>
          </label>

          <label class="archive-form-row">
            <span>关系对象</span>
            <input type="hidden" data-role="relation-target" value="${escapeHtml(defaultTargetValue)}">
            <button class="archive-relation-picker-trigger" type="button" data-action="open-target-picker">
              <span data-role="relation-target-trigger-text">${escapeHtml(getEntityValueLabel(defaultTargetValue))}</span>
              <i>${icon.chevronRight}</i>
            </button>
            <div class="archive-relation-picker-modal hidden" data-role="target-picker-modal">
              <div class="archive-relation-picker-modal__panel">
                <div class="archive-relation-picker-modal__header">
                  <strong>选择关系对象</strong>
                  <button class="archive-character-paper__icon-btn" type="button" data-action="close-target-picker" aria-label="关闭">${icon.close}</button>
                </div>
                <div class="archive-relation-picker-modal__list" data-role="target-picker-options"></div>
              </div>
            </div>
          </label>

          <label class="archive-form-row">
            <span data-role="owner-perception-label">关系主体对关系对象的认知</span>
            <textarea data-role="owner-perception" rows="4" placeholder="请输入关系主体对对方的关系认知">${escapeHtml(currentItem?.userPerception || '')}</textarea>
          </label>

          <label class="archive-form-row">
            <span data-role="target-perception-label">关系对象对关系主体的认知</span>
            <textarea data-role="target-perception" rows="4" placeholder="请输入关系对象对对方的关系认知">${escapeHtml(currentItem?.rolePerception || '')}</textarea>
          </label>
        </div>
      `,
      onOpen: (modalScope) => {
        const ownerInput = modalScope.querySelector('[data-role="relation-owner"]');
        const targetInput = modalScope.querySelector('[data-role="relation-target"]');
        const ownerText = modalScope.querySelector('[data-role="relation-owner-trigger-text"]');
        const targetText = modalScope.querySelector('[data-role="relation-target-trigger-text"]');
        const ownerOptionsHost = modalScope.querySelector('[data-role="owner-picker-options"]');
        const targetOptionsHost = modalScope.querySelector('[data-role="target-picker-options"]');
        const ownerModal = modalScope.querySelector('[data-role="owner-picker-modal"]');
        const targetModal = modalScope.querySelector('[data-role="target-picker-modal"]');
        const ownerPerceptionLabel = modalScope.querySelector('[data-role="owner-perception-label"]');
        const targetPerceptionLabel = modalScope.querySelector('[data-role="target-perception-label"]');

        const hideOwnerPicker = () => ownerModal?.classList.add('hidden');
        const hideTargetPicker = () => targetModal?.classList.add('hidden');

        const renderOwnerPicker = () => {
          const options = getRelationOwnerOptionsByTab(lockedOwnerType);
          if (ownerOptionsHost) {
            ownerOptionsHost.innerHTML = options.map((option) => `
              <button
                type="button"
                class="archive-relation-picker-option ${normalizeString(ownerInput?.value) === option.value ? 'is-active' : ''}"
                data-action="pick-owner"
                data-value="${escapeHtml(option.value)}"
              >
                <strong>${escapeHtml(option.label)}</strong>
                <span>${escapeHtml(RELATION_ENTITY_TAB_META[option.type]?.subtitle || '人物')}</span>
              </button>
            `).join('');
          }
        };

        const renderTargetPicker = () => {
          const owner = parseRelationEntityValue(ownerInput?.value);
          const options = getRelationTargetOptionsByOwner(owner.type, owner.id);
          if (targetOptionsHost) {
            targetOptionsHost.innerHTML = options.map((option) => `
              <button
                type="button"
                class="archive-relation-picker-option ${normalizeString(targetInput?.value) === option.value ? 'is-active' : ''}"
                data-action="pick-target"
                data-value="${escapeHtml(option.value)}"
              >
                <strong>${escapeHtml(option.label)}</strong>
                <span>${escapeHtml(RELATION_ENTITY_TAB_META[option.type]?.subtitle || '人物')}</span>
              </button>
            `).join('');
          }
          if (!options.some((option) => option.value === normalizeString(targetInput?.value))) {
            targetInput.value = options[0]?.value || '';
          }
        };

        const syncRelationEditor = () => {
          renderOwnerPicker();
          renderTargetPicker();

          const ownerName = getEntityValueLabel(ownerInput?.value);
          const targetName = getEntityValueLabel(targetInput?.value);
          if (ownerText) ownerText.textContent = ownerName;
          if (targetText) targetText.textContent = targetName;

          if (ownerPerceptionLabel) ownerPerceptionLabel.textContent = `${ownerName}对${targetName}的关系认知`;
          if (targetPerceptionLabel) targetPerceptionLabel.textContent = `${targetName}对${ownerName}的关系认知`;
        };

        modalScope.addEventListener('click', (event) => {
          const action = event.target.closest('[data-action]')?.getAttribute('data-action');
          if (!action) return;

          if (action === 'open-owner-picker') {
            ownerModal?.classList.remove('hidden');
            return;
          }
          if (action === 'open-target-picker') {
            targetModal?.classList.remove('hidden');
            return;
          }
          if (action === 'close-owner-picker') {
            hideOwnerPicker();
            return;
          }
          if (action === 'close-target-picker') {
            hideTargetPicker();
            return;
          }
          if (action === 'pick-owner') {
            const next = normalizeString(event.target.closest('[data-value]')?.getAttribute('data-value'));
            if (!next) return;
            ownerInput.value = next;
            hideOwnerPicker();
            syncRelationEditor();
            return;
          }
          if (action === 'pick-target') {
            const next = normalizeString(event.target.closest('[data-value]')?.getAttribute('data-value'));
            if (!next) return;
            targetInput.value = next;
            hideTargetPicker();
            syncRelationEditor();
          }
        });

        syncRelationEditor();
      },
      onConfirm: (modalScope) => {
        const owner = parseRelationEntityValue(collectInputValue(modalScope, 'relation-owner'));
        const target = parseRelationEntityValue(collectInputValue(modalScope, 'relation-target'));

        if (!owner.id || !target.id) {
          notify('请选择完整的关系主体与关系对象', 'error');
          return false;
        }

        if (owner.type === target.type && owner.id === target.id) {
          notify('关系主体与关系对象不能是同一张卡片', 'error');
          return false;
        }

        const allowedTypes = RELATION_ALLOWED_TARGET_TYPES[owner.type] || [];
        if (!allowedTypes.includes(target.type)) {
          notify('当前关系主体与关系对象类型不符合规则', 'error');
          return false;
        }

        const relation = normalizeRelation({
          id: currentItem?.id || uid('relation'),
          ownerType: owner.type,
          ownerId: owner.id,
          targetType: target.type,
          targetId: target.id,
          userPerception: collectTextareaValue(modalScope, 'owner-perception'),
          rolePerception: collectTextareaValue(modalScope, 'target-perception')
        });

        if (!relation.userPerception && !relation.rolePerception) {
          notify('请至少填写一侧的关系认知', 'error');
          return false;
        }

        if (isEdit) {
          state.data.relations = state.data.relations.map((item) => item.id === currentItem.id ? relation : item);
        } else {
          state.data.relations.push(relation);
          state.selectedRelationId = relation.id;
        }

        state.relationEntityTab = relation.ownerType;
        state.selectedRelationOwnerKey = buildRelationOwnerKey(relation.ownerType, relation.ownerId);
        const expandedKey = buildRelationOwnerKey(relation.targetType, relation.targetId);
        state.relationExpandedKeys[expandedKey] = true;

        notify(isEdit ? '关系条目已更新' : '关系条目已创建', 'success');
        rerender();
      }
    });
  };

  /* [修改标注·需求1] 从角色卡对象中提取世界书数据（兼容常见字段与数组结构） */
  const extractWorldBooksFromCharCard = (rawObj) => {
    const root = rawObj?.data && typeof rawObj.data === 'object' ? rawObj.data : rawObj || {};
    const extensions = root.extensions && typeof root.extensions === 'object' ? root.extensions : {};
    const books = [];
    const seen = new Set();

    const pushBook = (candidate) => {
      if (!candidate) return;
      if (Array.isArray(candidate)) {
        candidate.forEach(pushBook);
        return;
      }
      if (typeof candidate !== 'object') return;

      const entries = candidate.entries;
      const entryCount = Array.isArray(entries)
        ? entries.length
        : (entries && typeof entries === 'object' ? Object.keys(entries).length : 0);

      const signature = JSON.stringify({
        name: pickFirst(candidate, ['name', 'title']),
        entryCount,
        keys: Object.keys(candidate).sort()
      });

      if (seen.has(signature)) return;
      seen.add(signature);
      books.push(candidate);
    };

    pushBook(root.character_book);
    pushBook(root.world);
    pushBook(root.worldBooks);
    pushBook(root.world_books);
    pushBook(extensions.world);
    pushBook(extensions.worldBooks);
    pushBook(extensions.world_books);
    pushBook(extensions.lorebooks);

    return books;
  };

  /* [修改标注·需求1] 解析角色卡世界书名称，导入后立即供档案详情页显示 */
  const getImportedWorldBookName = (worldBook, index = 0) => {
    const root = worldBook && typeof worldBook === 'object' ? worldBook : {};
    return pickFirst(root, ['name', 'title']) || `世界书 ${index + 1}`;
  };

  /* 世情应用世界书数据缓存（从 IndexedDB 加载） */
  const WORLD_BOOK_DB_RECORD_ID = 'worldbook::all-books';
  let _worldBookCache = [];
  const loadWorldBookCache = async () => {
    try {
      const all = await context.db?.getAll?.('appsData');
      const rec = all?.find(x => x.id === WORLD_BOOK_DB_RECORD_ID);
      if (rec?.value && Array.isArray(rec.value)) _worldBookCache = rec.value;
      else _worldBookCache = [];
    } catch (_) {
      _worldBookCache = [];
    }
  };

  /* [修改标注·本次需求1] 角色卡导入后在档案应用内立即落地世界书到 IndexedDB（worldbook::all-books） */
  const normalizeWorldBookEntryFromRaw = (rawEntry = {}, index = 0) => {
    const safe = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
    const keywords = Array.isArray(safe.keywords)
      ? safe.keywords
      : Array.isArray(safe.key)
        ? safe.key
        : typeof safe.keywords === 'string'
          ? safe.keywords.split(/[,，\s]+/)
          : typeof safe.key === 'string'
            ? safe.key.split(/[,，\s]+/)
            : [];

    let position = 'afterChar';
    if (safe.position === 4 || safe.position === 'top') position = 'top';
    if (safe.position === 0 || safe.position === 'before_char' || safe.position === 'beforeChar') position = 'beforeChar';

    return {
      id: normalizeString(safe.id) || uid('e'),
      name: pickFirst(safe, ['name', 'title', 'comment']) || `条目 ${index + 1}`,
      content: normalizeString(safe.content),
      position,
      triggerType: (safe.triggerType === 'always' || safe.constant === true || safe.constant === 1) ? 'always' : 'keyword',
      keywords: keywords.map((k) => normalizeString(k)).filter(Boolean),
      order: Number.isFinite(Number(safe.order))
        ? Number(safe.order)
        : (Number.isFinite(Number(safe.insertion_order)) ? Number(safe.insertion_order) : 100),
      enabled: typeof safe.enabled === 'boolean' ? safe.enabled : (safe.disable !== true),
      disableRecursion: !!safe.disableRecursion || !!safe.disable,
      preventFurtherRecursion: !!safe.preventFurtherRecursion || !!safe.preventRecursion
    };
  };

  const parseWorldBookEntriesFromRaw = (rawWorldBook) => {
    const safe = rawWorldBook && typeof rawWorldBook === 'object' ? rawWorldBook : {};
    const entriesRaw = Array.isArray(safe.entries)
      ? safe.entries
      : (safe.entries && typeof safe.entries === 'object' ? Object.values(safe.entries) : []);
    return entriesRaw.map((entry, index) => normalizeWorldBookEntryFromRaw(entry, index));
  };

  const buildImportedWorldBookRecord = ({ raw, name, characterId, sourceKey }) => {
    const safeRaw = raw && typeof raw === 'object' ? raw : {};
    return {
      id: uid('book'),
      name: normalizeString(name) || pickFirst(safeRaw, ['name', 'title']) || '角色卡世界书',
      enabled: typeof safeRaw.enabled === 'boolean' ? safeRaw.enabled : !(safeRaw.disable === true || safeRaw.disable === 1),
      type: 'local',
      boundCharacterIds: characterId ? [characterId] : [],
      archiveSourceCharacterId: characterId || null,
      archiveSourceKey: sourceKey || uid('archivewb'),
      entries: parseWorldBookEntriesFromRaw(safeRaw),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  };

  const upsertImportedWorldBooksForCharacter = async (character) => {
    const targetCharacterId = normalizeString(character?.id);
    const importedBooks = normalizeArray(character?.boundWorldBooks);
    if (!targetCharacterId || !importedBooks.length) return;

    let changed = false;
    const worldBooks = Array.isArray(_worldBookCache) ? [..._worldBookCache] : [];

    importedBooks.forEach((item, index) => {
      const raw = item?.raw && typeof item.raw === 'object' ? item.raw : null;
      if (!raw) return;

      const sourceKey = normalizeString(item?.sourceKey) || `${targetCharacterId}::${index}`;
      const existed = worldBooks.find((book) => {
        return book?.archiveSourceCharacterId === targetCharacterId && book?.archiveSourceKey === sourceKey;
      });

      if (existed) {
        const parsedEntries = parseWorldBookEntriesFromRaw(raw);
        existed.name = normalizeString(item?.name) || existed.name || pickFirst(raw, ['name', 'title']) || '角色卡世界书';
        existed.type = 'local';
        existed.enabled = typeof raw.enabled === 'boolean' ? raw.enabled : existed.enabled;
        existed.entries = parsedEntries.length ? parsedEntries : normalizeArray(existed.entries);
        if (!Array.isArray(existed.boundCharacterIds)) existed.boundCharacterIds = [];
        if (!existed.boundCharacterIds.includes(targetCharacterId)) {
          existed.boundCharacterIds.push(targetCharacterId);
        }
        existed.archiveSourceCharacterId = targetCharacterId;
        existed.archiveSourceKey = sourceKey;
        existed.updatedAt = Date.now();
        changed = true;
        return;
      }

      worldBooks.push(buildImportedWorldBookRecord({
        raw,
        name: item?.name,
        characterId: targetCharacterId,
        sourceKey
      }));
      changed = true;
    });

    if (!changed) return;

    _worldBookCache = worldBooks;
    try {
      await context.db?.put?.('appsData', {
        id: WORLD_BOOK_DB_RECORD_ID,
        appId: 'worldbook',
        key: 'all-books',
        value: worldBooks,
        updatedAt: Date.now()
      });
    } catch (_) {
      // 忽略写入失败，保持档案 UI 可继续工作
    }
  };

  const getCharacterWorldBookNames = (characterId) => {
    const fallbackNames = normalizeArray(
      state.data.characters.find((item) => item.id === characterId)?.boundWorldBooks
    ).map((item) => normalizeString(item.name)).filter(Boolean);

    const activeBoundNames = _worldBookCache
      .filter((book) => {
        const bids = Array.isArray(book?.boundCharacterIds) ? book.boundCharacterIds : [];
        return bids.includes(characterId);
      })
      .map((book) => normalizeString(book?.name || '未命名世界书'))
      .filter(Boolean);

    return [...new Set([...fallbackNames, ...activeBoundNames])];
  };

  const getLocalWorldBooks = () => {
    return _worldBookCache.filter((book) => book?.type === 'local').map((book) => ({
      id: book.id,
      name: normalizeString(book.name || '未命名世界书'),
      boundCharacterIds: Array.isArray(book.boundCharacterIds) ? book.boundCharacterIds : []
    }));
  };

  const toggleWorldBookBinding = async (bookId, characterId) => {
    const book = _worldBookCache.find((b) => b.id === bookId);
    if (!book) return;
    if (!Array.isArray(book.boundCharacterIds)) book.boundCharacterIds = [];

    const idx = book.boundCharacterIds.indexOf(characterId);
    const isUnbinding = idx >= 0;

    if (isUnbinding) {
      book.boundCharacterIds.splice(idx, 1);

      /* [修改标注·本次需求1] 真正解绑时同步移除角色档案内对应的世界书来源，避免世情应用再次从档案数据补绑定 */
      const archiveSourceCharacterId = normalizeString(book.archiveSourceCharacterId);
      const archiveSourceKey = normalizeString(book.archiveSourceKey);

      state.data.characters = state.data.characters.map((character) => {
        if (character.id !== characterId) return character;

        const nextBoundWorldBooks = normalizeArray(character.boundWorldBooks).filter((item, itemIndex) => {
          const itemSourceKey = normalizeString(item?.sourceKey) || `${character.id}::${itemIndex}`;
          const matchedBySourceKey = archiveSourceKey && itemSourceKey === archiveSourceKey;
          const matchedByName = !archiveSourceKey && normalizeString(item?.name) === normalizeString(book.name);
          return !(archiveSourceCharacterId === characterId && (matchedBySourceKey || matchedByName));
        });

        return {
          ...character,
          boundWorldBooks: nextBoundWorldBooks
        };
      });
    } else {
      book.boundCharacterIds.push(characterId);
    }

    book.updatedAt = Date.now();
    try {
      await context.db?.put?.('appsData', {
        id: WORLD_BOOK_DB_RECORD_ID,
        appId: 'worldbook',
        key: 'all-books',
        value: _worldBookCache,
        updatedAt: Date.now()
      });
    } catch (_) {
      // ignore
    }
  };

  const addCharacterFromImportedObject = async (obj, avatarDataUrl = '') => {
    const mapped = mapImportedRole(obj);
    if (avatarDataUrl) mapped.avatar = avatarDataUrl;

    if (!mapped.personalitySetting) {
      notify('导入成功，但未解析到 description，已保留空人物设定', 'info');
    }

    /* [修改标注·需求1] 导入角色卡后立即记录其自带的绑定世界书，便于档案页即时显示与世情联动 */
    const worldBooks = extractWorldBooksFromCharCard(obj);
    mapped.boundWorldBooks = worldBooks.map((worldBook, index) => ({
      sourceKey: `${mapped.id}::${index}`,
      name: getImportedWorldBookName(worldBook, index),
      raw: worldBook
    }));

    state.data.characters.push(mapped);
    state.selectedCharacterId = mapped.id;

    /* [修改标注·本次需求1] 角色导入后立即把绑定世界书写入 IndexedDB，避免必须先进入世情应用才可见 */
    await upsertImportedWorldBooksForCharacter(mapped);

    /* [修改标注·需求1] 解析角色卡中的世界书，发送事件给世情应用 */
    if (mapped.boundWorldBooks.length > 0) {
      context.eventBus?.emit('character:imported', {
        characterId: mapped.id,
        characterName: mapped.name,
        worldBooks: mapped.boundWorldBooks
      });
    }

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

      await addCharacterFromImportedObject(source);
      return;
    }

    if (fileName.endsWith('.png')) {
      const arrayBuffer = await file.arrayBuffer();
      const chunks = parsePngTextChunks(arrayBuffer);
      const roleObj = extractRoleObjectFromPngChunks(chunks);
      const avatarDataUrl = await fileToDataURL(file);

      if (roleObj) {
        await addCharacterFromImportedObject(roleObj, avatarDataUrl);
      } else {
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

  const handleImportInputChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleImportFile(file);
    event.target.value = '';
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
        /* [修改标注·需求6] 切换tab时重置所有viewMode为list */
        state.characterViewMode = 'list';
        state.maskViewMode = 'list';
        state.supportingViewMode = 'list';
        rerender();
      }
      return;
    }

    if (action === 'show-mask-detail') {
      state.selectedMaskId = id;
      rerender();
      return;
    }

    /* [修改标注·需求6] 面具列表点击卡片展开详情 */
    if (action === 'open-mask-detail') {
      state.selectedMaskId = id;
      state.maskViewMode = 'detail';
      rerender();
      return;
    }

    /* [修改标注·需求6] 面具详情关闭返回列表 */
    if (action === 'close-mask-detail') {
      state.maskViewMode = 'list';
      rerender();
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
        state.data.relations = state.data.relations.filter((relation) => {
          return !(
            (relation.ownerType === 'mask' && relation.ownerId === id)
            || (relation.targetType === 'mask' && relation.targetId === id)
          );
        });
        if (state.data.activeMaskId === id) {
          state.data.activeMaskId = '';
          emitActiveMaskChanged();
        }
        notify('面具已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'show-character-detail') {
      state.selectedCharacterId = id;
      state.characterViewMode = 'detail';
      rerender();
      return;
    }

    if (action === 'close-character-detail') {
      state.characterViewMode = 'list';
      rerender();
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

      // [模块标注] 角色档案删除确认弹窗模块：
      // 展开态与列表态统一复用应用内确认弹窗，避免误删，不使用浏览器原生弹窗。
      openConfirmModal(`确定删除角色“${target.name || '未命名角色'}”吗？`, () => {
        state.data.characters = state.data.characters.filter((item) => item.id !== id);

        state.data.masks = state.data.masks.map((mask) => ({
          ...mask,
          roleBindingIds: (mask.roleBindingIds || []).filter((roleId) => roleId !== id)
        }));

        state.data.relations = state.data.relations.filter((relation) => {
          return !(
            (relation.ownerType === 'character' && relation.ownerId === id)
            || (relation.targetType === 'character' && relation.targetId === id)
          );
        });
        state.characterViewMode = 'list';
        notify('角色已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'show-supporting-detail') {
      state.selectedSupportingId = id;
      rerender();
      return;
    }

    /* [修改标注·需求6] 配角列表点击卡片展开详情 */
    if (action === 'open-supporting-detail') {
      state.selectedSupportingId = id;
      state.supportingViewMode = 'detail';
      rerender();
      return;
    }

    /* [修改标注·需求6] 配角详情关闭返回列表 */
    if (action === 'close-supporting-detail') {
      state.supportingViewMode = 'list';
      rerender();
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
        state.data.relations = state.data.relations.filter((relation) => {
          return !(
            (relation.ownerType === 'supporting' && relation.ownerId === id)
            || (relation.targetType === 'supporting' && relation.targetId === id)
          );
        });
        notify('配角已删除', 'success');
        rerender();
      }, true);
      return;
    }

    if (action === 'add-relation') {
      openRelationEditor();
      return;
    }

    if (action === 'switch-relation-entity-tab') {
      const nextTab = actionEl.getAttribute('data-tab');
      if (RELATION_ENTITY_TYPES.includes(nextTab)) {
        state.relationEntityTab = nextTab;
        state.selectedRelationOwnerKey = '';
        state.relationExpandedKeys = {};
        rerender();
      }
      return;
    }

    if (action === 'select-relation-owner') {
      state.selectedRelationOwnerKey = actionEl.getAttribute('data-owner-key') || '';
      state.relationExpandedKeys = {};
      rerender();
      return;
    }

    if (action === 'toggle-relation-group') {
      const key = actionEl.getAttribute('data-group-key') || '';
      if (!key) return;
      state.relationExpandedKeys[key] = !state.relationExpandedKeys[key];
      renderContent();
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
      return;
    }

    /* [修改标注·需求1] 人物设定折叠栏：点击标题展开/收起 */
    if (action === 'toggle-setting') {
      const section = actionEl.closest('.archive-setting-section');
      if (!section) return;
      const body = section.querySelector('.archive-setting-body');
      const chevron = section.querySelector('.archive-setting-chevron');
      const isCollapsed = section.getAttribute('data-collapsed') === 'true';
      if (isCollapsed) {
        section.setAttribute('data-collapsed', 'false');
        if (body) body.style.display = '';
        if (chevron) chevron.innerHTML = icon.chevronDown;
      } else {
        section.setAttribute('data-collapsed', 'true');
        if (body) body.style.display = 'none';
        if (chevron) chevron.innerHTML = icon.chevronRight;
      }
      return;
    }

    /* [修改标注·本次需求2] 点击世界书名称切换绑定状态（灰色↔白色） */
    if (action === 'toggle-wb-bind') {
      const bookId = actionEl.getAttribute('data-book-id');
      const charId = actionEl.getAttribute('data-char-id');
      if (bookId && charId) {
        toggleWorldBookBinding(bookId, charId);
        /* 切换按钮样式 */
        actionEl.classList.toggle('is-bound');
      }
      return;
    }

    /* [修改标注·需求4c] 开场白折叠栏：点击标题展开/收起 */
    if (action === 'toggle-greeting') {
      const section = actionEl.closest('.archive-greeting-section');
      if (!section) return;
      const body = section.querySelector('.archive-greeting-body');
      const chevron = section.querySelector('.archive-greeting-chevron');
      const isCollapsed = section.getAttribute('data-collapsed') === 'true';
      if (isCollapsed) {
        section.setAttribute('data-collapsed', 'false');
        if (body) body.style.display = '';
        if (chevron) chevron.innerHTML = icon.chevronDown;
      } else {
        section.setAttribute('data-collapsed', 'true');
        if (body) body.style.display = 'none';
        if (chevron) chevron.innerHTML = icon.chevronRight;
      }
      return;
    }

    /* [修改标注·需求4e] 多开场白预览弹窗：点击查看全部开场白 */
    if (action === 'open-greeting-preview') {
      const target = state.data.characters.find((item) => item.id === id);
      if (!target) return;
      openGreetingPreviewModal(target);
      return;
    }
  };

  /* [修改标注·需求4e] 多开场白预览弹窗函数 */
  const openGreetingPreviewModal = (character) => {
    const greetings = normalizeArray(character.greetings);
    if (!greetings.length) {
      notify('该角色暂无开场白', 'info');
      return;
    }
    let currentIndex = 0;

    const renderPreviewContent = (index) => {
      return `
        <div class="archive-greeting-preview-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <button type="button" class="archive-character-paper__icon-btn" data-action="greeting-prev" ${index <= 0 ? 'disabled style="opacity:0.3;"' : ''} aria-label="上一条">${icon.left}</button>
          <span style="font-size:12px;color:var(--archive-subtext);">第 ${index + 1} / ${greetings.length} 条</span>
          <button type="button" class="archive-character-paper__icon-btn" data-action="greeting-next" ${index >= greetings.length - 1 ? 'disabled style="opacity:0.3;"' : ''} aria-label="下一条">${icon.right}</button>
        </div>
        <!-- [修改标注·需求2] 开场白预览窗口高度放大 -->
        <div class="archive-character-paper__content archive-character-paper__content--fixed" style="min-height:220px;height:auto;max-height:50vh;">
          <p>${escapeHtml(greetings[index])}</p>
        </div>
      `;
    };

    openModal({
      title: `${escapeHtml(character.name || '角色')} - 开场白预览`,
      showFooter: false,
      content: `<div id="greeting-preview-container">${renderPreviewContent(0)}</div>`,
      onOpen: (modalScope) => {
        const handlePreviewClick = (event) => {
          const previewAction = event.target.closest('[data-action]')?.getAttribute('data-action');
          if (previewAction === 'greeting-prev' && currentIndex > 0) {
            currentIndex--;
            const container = modalScope.querySelector('#greeting-preview-container');
            if (container) container.innerHTML = renderPreviewContent(currentIndex);
          }
          if (previewAction === 'greeting-next' && currentIndex < greetings.length - 1) {
            currentIndex++;
            const container = modalScope.querySelector('#greeting-preview-container');
            if (container) container.innerHTML = renderPreviewContent(currentIndex);
          }
        };
        modalScope.addEventListener('click', handlePreviewClick);
      }
    });
  };

  // [模块标注] 标题点击返回桌面行为模块：仅作用于档案应用窗口标题
  const onTitleBackHome = () => {
    context.eventBus?.emit('app:close', { appId: context.appId });
  };

  await loadWorldBookCache();
  state.data = await loadPersistedArchiveData();
  state.activeTab = TAB_META[state.data.selectedTab] ? state.data.selectedTab : 'mask';

  createHeaderControls();
  rerender();

  container.addEventListener('click', onContainerClick);

  /* [修改标注·需求7] 面具生效开关事件处理 —— 切换面具的全局生效状态 */
  const onMaskToggleChange = (event) => {
    const toggle = event.target.closest('[data-role="mask-active-toggle"]');
    if (!toggle) return;
    const maskId = toggle.getAttribute('data-id');
    if (!maskId) return;
    if (toggle.checked) {
      state.data.activeMaskId = maskId;
    } else {
      state.data.activeMaskId = '';
    }
    emitActiveMaskChanged();
    saveData();
    rerender();
  };
  container.addEventListener('change', onMaskToggleChange);

  importInputEl?.addEventListener('change', handleImportInputChange);

  return {
    destroy() {
      container.removeEventListener('click', onContainerClick);
      container.removeEventListener('change', onMaskToggleChange);
      importInputEl?.removeEventListener('change', handleImportInputChange);
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
