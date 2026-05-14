/**
 * 文件名: js/apps/memory/memory-db.js
 * 用途: 旧事应用 IndexedDB 数据访问与结构归一化。
 * 说明: 本文件只通过项目 DB.js / AppDataStore 访问 IndexedDB；不使用浏览器同步存储。
 */
import { AppDataStore } from '../../core/data/AppDataStore.js';
import { normalizeText } from './memory-ui.js';

export const MEMORY_APP_ID = 'memory';
export const ARCHIVE_APP_ID = 'archive';
export const ARCHIVE_DATA_KEY = 'archive-data';

/* ==========================================================================
   [区域标注·已完成·旧事数据结构定义区]
   说明：本次仅保存“角色 → 闲谈记忆库”，不预建论坛/阅读器/其它应用文件夹。
   ========================================================================== */
export function createDefaultCharacterMemory(characterId) {
  return {
    characterId,
    updatedAt: Date.now(),
    chatMemory: {
      items: []
    }
  };
}

export function buildCharacterMemoryKey(characterId) {
  return `character:${characterId}:chat-memory`;
}

export function normalizeMemoryType(type) {
  return ['longterm', 'redline', 'flashbulb', 'pending'].includes(type) ? type : 'longterm';
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 12);
}

export function createMemoryItem(input = {}) {
  const now = Date.now();
  const summary = normalizeText(input.summary);
  const fallbackTitle = summary ? `${summary.slice(0, 18)}${summary.length > 18 ? '…' : ''}` : '新的闲谈记忆';

  return {
    id: normalizeText(input.id) || `mem-${now}-${Math.random().toString(16).slice(2)}`,
    type: normalizeMemoryType(input.type),
    title: normalizeText(input.title) || fallbackTitle,
    summary,
    timelineAt: Number(input.timelineAt) || now,
    emotionTags: normalizeTags(input.emotionTags),
    isPermanent: Boolean(input.isPermanent),
    injectionEnabled: typeof input.injectionEnabled === 'boolean' ? input.injectionEnabled : true,
    isHighPriority: Boolean(input.isHighPriority),
    createdAt: Number(input.createdAt) || now,
    updatedAt: Number(input.updatedAt) || now
  };
}

export function normalizeCharacterMemory(raw, characterId) {
  const safe = raw && typeof raw === 'object' ? raw : createDefaultCharacterMemory(characterId);
  const items = Array.isArray(safe?.chatMemory?.items) ? safe.chatMemory.items : [];

  return {
    characterId,
    updatedAt: Number(safe.updatedAt) || Date.now(),
    chatMemory: {
      items: items.map((item) => createMemoryItem(item))
    }
  };
}

function createStore(db) {
  return new AppDataStore(db);
}

/* ==========================================================================
   [区域标注·已完成·旧事角色来源读取区]
   说明：只读取档案应用标准 IndexedDB 主记录 value.characters 作为角色来源；
         不写档案数据，不写双份兜底，不使用浏览器同步存储。
   ========================================================================== */
export async function loadArchiveCharacters(db) {
  const store = createStore(db);
  const record = await store.get(ARCHIVE_APP_ID, ARCHIVE_DATA_KEY);
  const characters = Array.isArray(record?.value?.characters) ? record.value.characters : [];

  return characters.map((item) => ({
    id: normalizeText(item?.id) || `character-${Math.random().toString(16).slice(2)}`,
    name: normalizeText(item?.name) || '未命名角色',
    avatar: normalizeText(item?.avatar),
    signature: normalizeText(item?.signature),
    identity: normalizeText(item?.identity)
  }));
}

/* ==========================================================================
   [区域标注·已完成·旧事持久化读写区]
   说明：所有旧事记忆只写 memory 应用私有数据，底层为 DB.js 管理的 IndexedDB appsData。
   ========================================================================== */
export async function loadCharacterMemory(db, characterId) {
  const store = createStore(db);
  const record = await store.get(MEMORY_APP_ID, buildCharacterMemoryKey(characterId));
  return normalizeCharacterMemory(record?.value, characterId);
}

export async function saveCharacterMemory(db, characterId, memoryRecord) {
  const store = createStore(db);
  const normalized = normalizeCharacterMemory(
    {
      ...memoryRecord,
      updatedAt: Date.now()
    },
    characterId
  );

  await store.set(MEMORY_APP_ID, buildCharacterMemoryKey(characterId), normalized);
  return normalized;
}

export async function loadMemoryBootData(db) {
  const characters = await loadArchiveCharacters(db);
  const records = await Promise.all(
    characters.map(async (character) => [character.id, await loadCharacterMemory(db, character.id)])
  );

  return {
    characters,
    recordsByCharacterId: Object.fromEntries(records)
  };
}

export async function upsertMemoryItem(db, characterId, itemInput) {
  const record = await loadCharacterMemory(db, characterId);
  const nextItem = createMemoryItem({
    ...itemInput,
    updatedAt: Date.now()
  });
  const index = record.chatMemory.items.findIndex((item) => item.id === nextItem.id);

  if (index >= 0) {
    record.chatMemory.items[index] = {
      ...record.chatMemory.items[index],
      ...nextItem,
      createdAt: record.chatMemory.items[index].createdAt || nextItem.createdAt
    };
  } else {
    record.chatMemory.items.unshift(nextItem);
  }

  return saveCharacterMemory(db, characterId, record);
}

export async function removeMemoryItem(db, characterId, memoryId) {
  const record = await loadCharacterMemory(db, characterId);
  record.chatMemory.items = record.chatMemory.items.filter((item) => item.id !== memoryId);
  return saveCharacterMemory(db, characterId, record);
}

export async function patchMemoryItem(db, characterId, memoryId, patch) {
  const record = await loadCharacterMemory(db, characterId);
  record.chatMemory.items = record.chatMemory.items.map((item) => (
    item.id === memoryId
      ? createMemoryItem({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: Date.now() })
      : item
  ));
  return saveCharacterMemory(db, characterId, record);
}
