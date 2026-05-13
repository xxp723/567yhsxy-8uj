// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-autonomous-activity-settings.js
 * 用途: 闲谈应用 — 聊天设置页“自主活动”独立功能模块
 * 架构层: 应用层（闲谈子模块）
 */

import {
  DATA_KEY_MOMENTS,
  DATA_KEY_MESSAGES_PREFIX,
  STORE_NAME,
  dbGet,
  dbPut,
  escapeHtml,
  getCurrentChatPromptSettingsKey,
  createUid
} from './chat-utils.js';
import { refreshMomentsPanel } from './moments.js';

/* ==========================================================================
   [区域标注·已完成·自主活动设置默认值]
   说明：
   1. 本模块集中管理聊天设置页“自主活动”区域，方便后续针对性修改。
   2. 当前设置按“当前面具 + 当前聊天对象”写入 chatPromptSettings。
   3. 持久化统一通过 dbPut -> DB.js / IndexedDB；不使用 localStorage/sessionStorage，不写双份存储兜底。
   4. 默认关闭“主动发朋友圈”；默认时间间隔为 1 小时。
   ========================================================================== */
export const DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS = Object.freeze({
  autonomousMomentsEnabled: false,
  autonomousMomentsIntervalValue: 1,
  autonomousMomentsIntervalUnit: 'hour'
});

export const AUTONOMOUS_ACTIVITY_INTERVAL_UNITS = Object.freeze([
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' }
]);

const WORLDBOOK_DB_RECORD_ID = 'worldbook::all-books';
const AUTONOMOUS_MOMENTS_META_KEY = (maskId, chatId) => `chat_autonomous_moments_meta_${maskId || 'default'}_${chatId || 'default'}`;

function isValidAutonomousActivityUnit(unit = '') {
  return AUTONOMOUS_ACTIVITY_INTERVAL_UNITS.some(item => item.value === unit);
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置规范化]
   说明：
   1. 只规范化“自主活动”相关字段，不改动其它聊天设置字段。
   2. 时间间隔数值最小为 1；单位仅允许“分钟 / 小时”两种应用内分段按钮值。
   3. 不使用浏览器原生选择器，不使用浏览器原生弹窗。
   ========================================================================== */
export function normalizeAutonomousActivitySettings(source = {}) {
  const settings = source && typeof source === 'object' ? source : {};
  const rawValue = Number(settings.autonomousMomentsIntervalValue ?? DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue);
  const intervalValue = Number.isFinite(rawValue)
    ? Math.max(1, Math.floor(rawValue))
    : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue;
  const rawUnit = String(settings.autonomousMomentsIntervalUnit || DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalUnit);

  return {
    autonomousMomentsEnabled: Boolean(settings.autonomousMomentsEnabled),
    autonomousMomentsIntervalValue: intervalValue,
    autonomousMomentsIntervalUnit: isValidAutonomousActivityUnit(rawUnit)
      ? rawUnit
      : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalUnit
  };
}

function ensureStateAutonomousActivitySettings(state) {
  if (!state.chatPromptSettings || typeof state.chatPromptSettings !== 'object') {
    state.chatPromptSettings = {};
  }

  const normalized = normalizeAutonomousActivitySettings(state.chatPromptSettings);
  Object.assign(state.chatPromptSettings, normalized);
  return normalized;
}

async function persistAutonomousActivitySettings(state, db) {
  await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
}

/* ==========================================================================
   [区域标注·已完成·自主活动主动发朋友圈后台工具]
   说明：
   1. 本区只服务“主动发朋友圈”：间隔换算、IndexedDB 元数据、AI 返回 JSON 提取与副 API 请求。
   2. API 配置只读取设置应用里的 settings.api.secondary；不回退主 API，不写双份请求兜底。
   3. 朋友圈、世界书、聊天记录等持久化读写统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   4. 不使用原生弹窗；后台失败只静默记录到 console，避免打断用户与造成页面闪屏。
   ========================================================================== */
function getAutonomousMomentsIntervalMs(settings = {}) {
  const normalized = normalizeAutonomousActivitySettings(settings);
  const value = Math.max(1, Number(normalized.autonomousMomentsIntervalValue || 1) || 1);
  return normalized.autonomousMomentsIntervalUnit === 'minute'
    ? value * 60 * 1000
    : value * 60 * 60 * 1000;
}

function trimSlash(url = '') {
  return String(url || '').replace(/\/+$/, '');
}

function normalizeSecondaryApiProfile(apiSettings = {}) {
  const secondary = apiSettings?.secondary && typeof apiSettings.secondary === 'object' ? apiSettings.secondary : {};
  const provider = ['openai', 'deepseek', 'gemini', 'claude'].includes(String(secondary.provider || '').trim())
    ? String(secondary.provider || '').trim()
    : 'gemini';

  const defaultBaseUrlMap = {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    claude: 'https://api.anthropic.com/v1'
  };

  return {
    provider,
    apiKey: String(secondary.apiKey || '').trim(),
    baseUrl: trimSlash(secondary.baseUrl || defaultBaseUrlMap[provider]),
    model: String(secondary.model || '').trim(),
    stream: false,
    temperature: Number.isFinite(Number(apiSettings?.global?.temperature)) ? Number(apiSettings.global.temperature) : 0.8,
    maxTokens: Math.max(256, Math.min(2048, Number(apiSettings?.global?.maxTokens || 1024) || 1024))
  };
}

function extractApiErrorMessage(payload, fallback = 'API 请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload?.error?.message || payload?.error?.msg || payload?.message || payload?.detail || fallback;
}

async function requestAutonomousMomentsOpenAiLike(profile, messages) {
  const response = await fetch(`${trimSlash(profile.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.apiKey}`
    },
    body: JSON.stringify({
      model: profile.model,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      stream: false,
      messages
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

async function requestAutonomousMomentsGemini(profile, messages) {
  const text = messages
    .map(item => `${item.role === 'system' ? '系统' : '用户'}：\n${item.content}`)
    .join('\n\n');
  const url = `${trimSlash(profile.baseUrl)}/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        temperature: profile.temperature,
        maxOutputTokens: profile.maxTokens
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  return String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function requestAutonomousMomentsClaude(profile, messages) {
  const system = messages.find(item => item.role === 'system')?.content || '';
  const userText = messages
    .filter(item => item.role !== 'system')
    .map(item => item.content)
    .join('\n\n');
  const response = await fetch(`${trimSlash(profile.baseUrl)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': profile.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: profile.model,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      system,
      messages: [{ role: 'user', content: userText }]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  return String(payload?.content?.find?.(item => item?.type === 'text')?.text || payload?.content?.[0]?.text || '').trim();
}

async function requestAutonomousMomentsBySecondaryApi(profile, messages) {
  if (!profile.apiKey) throw new Error('副 API Key 不能为空');
  if (!profile.model) throw new Error('请先在设置应用选择副 API 模型');

  if (profile.provider === 'gemini') return requestAutonomousMomentsGemini(profile, messages);
  if (profile.provider === 'claude') return requestAutonomousMomentsClaude(profile, messages);
  return requestAutonomousMomentsOpenAiLike(profile, messages);
}

function extractJsonObjectFromAiText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const direct = (() => {
    try { return JSON.parse(candidate); } catch { return null; }
  })();
  if (direct && typeof direct === 'object') return direct;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
  }

  return null;
}

async function readRawDbRecordValue(db, key) {
  if (!db || !key) return null;
  try {
    const record = await db.get(STORE_NAME, key);
    return record ? (record.data ?? record.value ?? null) : null;
  } catch {
    return null;
  }
}

function getSessionForAutonomousMoments(state = {}) {
  const currentChatId = String(state.currentChatId || '').trim();
  if (!currentChatId) return null;
  return (Array.isArray(state.sessions) ? state.sessions : []).find(session => String(session?.id || '') === currentChatId) || null;
}

function getContactForAutonomousMoments(state = {}, session = {}) {
  const sessionId = String(session?.id || state.currentChatId || '').trim();
  return (Array.isArray(state.contacts) ? state.contacts : []).find(contact => String(contact?.id || '') === sessionId) || null;
}

function getCharacterForAutonomousMoments(state = {}, session = {}, contact = {}) {
  const candidateIds = [
    contact?.roleId,
    session?.roleId,
    contact?.characterId,
    session?.characterId,
    contact?.id,
    session?.id
  ].map(item => String(item || '').trim()).filter(Boolean);
  const characters = Array.isArray(state.archiveCharacters) ? state.archiveCharacters : [];
  return characters.find(character => candidateIds.includes(String(character?.id || '').trim())) || null;
}

function getMaskForAutonomousMoments(state = {}) {
  const maskId = String(state.activeMaskId || '').trim();
  return (Array.isArray(state.archiveMasks) ? state.archiveMasks : []).find(mask => String(mask?.id || '') === maskId) || null;
}

function formatEntityForPrompt(entity = {}, fallbackName = '未命名') {
  if (!entity || typeof entity !== 'object') return fallbackName;
  const lines = [
    `名称：${String(entity.name || entity.nickname || entity.remark || fallbackName).trim() || fallbackName}`,
    entity.gender ? `性别：${entity.gender}` : '',
    entity.age ? `年龄：${entity.age}` : '',
    entity.personality ? `性格：${entity.personality}` : '',
    entity.description ? `描述：${entity.description}` : '',
    entity.background ? `背景：${entity.background}` : '',
    entity.prompt ? `人设提示：${entity.prompt}` : '',
    entity.profile ? `档案：${entity.profile}` : ''
  ].filter(Boolean);
  return lines.join('\n');
}

function getLatestOneDayMessages(messages = [], now = Date.now()) {
  const source = Array.isArray(messages) ? messages : [];
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const withRecentTimestamp = source.filter(item => {
    const timestamp = Number(item?.timestamp || item?.createdAt || 0) || 0;
    return timestamp >= oneDayAgo;
  });
  return (withRecentTimestamp.length ? withRecentTimestamp : source.slice(-30)).slice(-80);
}

function formatMessagesForAutonomousPrompt(messages = []) {
  return (Array.isArray(messages) ? messages : [])
    .map(item => {
      const role = item?.role === 'assistant' ? '角色' : (item?.role === 'user' ? '用户' : '系统');
      const type = String(item?.type || '').trim();
      const content = String(
        type === 'sticker'
          ? `[表情包] ${item?.stickerName || item?.content || ''}`
          : (type === 'image'
              ? `[图片] ${item?.imageName || item?.content || ''}`
              : (item?.content || ''))
      ).trim();
      return content ? `${role}：${content}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function summarizeWorldBooksForAutonomousPrompt(worldBooks = [], character = null) {
  const books = Array.isArray(worldBooks) ? worldBooks : [];
  const characterId = String(character?.id || '').trim();
  const candidates = books.filter(book => {
    if (!book || typeof book !== 'object') return false;
    if (book.enabled === false) return false;
    const boundIds = Array.isArray(book.boundCharacterIds) ? book.boundCharacterIds.map(String) : [];
    return !boundIds.length || !characterId || boundIds.includes(characterId);
  });

  return candidates
    .slice(0, 6)
    .map(book => {
      const entries = Array.isArray(book.entries) ? book.entries : [];
      const entryText = entries
        .filter(entry => entry && entry.enabled !== false)
        .slice(0, 8)
        .map(entry => {
          const title = String(entry.title || entry.name || '').trim();
          const content = String(entry.content || entry.text || entry.description || '').trim();
          return [title, content].filter(Boolean).join('：');
        })
        .filter(Boolean)
        .join('\n');
      const bookName = String(book.name || book.title || '世界书').trim();
      return [bookName ? `【${bookName}】` : '', entryText].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

/* ==========================================================================
   [区域标注·已完成·AI自主发布朋友圈提示词]
   说明：
   1. 本提示词只在“主动发朋友圈”开关开启且到达间隔时构建并注入副 API 请求。
   2. 关闭开关时不会注入本提示词，不会自主调用 API 发布朋友圈。
   3. 提示词要求 AI 严格返回 JSON，便于写入朋友圈 IndexedDB 记录；不暴露 API、系统、提示词或生成过程。
   ========================================================================== */
function buildAutonomousMomentsPrompt({ character, mask, session, contact, worldBooks, messages }) {
  const roleName = String(character?.name || contact?.name || session?.remark || session?.name || '当前角色').trim() || '当前角色';
  const userName = String(mask?.name || mask?.nickname || '用户面具身份').trim() || '用户面具身份';
  const conversationText = formatMessagesForAutonomousPrompt(messages) || '最近一天暂无可用聊天内容。';
  const worldBookText = summarizeWorldBooksForAutonomousPrompt(worldBooks, character) || '当前没有命中的世界书条目。';

  return [
    {
      role: 'system',
      content: `你正在扮演“${roleName}”。现在需要你以这个角色本人的身份，主动发布一条朋友圈动态。

硬性规则：
1. 只根据角色人设、用户面具身份、世界书条目、最近一天对话内容来写。
2. 动态要像角色自己自然发布的日常、感想、吐槽、分享或隐晦情绪，不要像剧情总结。
3. 可以含蓄提到与“${userName}”相关的情绪或事件，但不要替用户发言，不要泄露后台资料。
4. 禁止出现“AI、模型、API、系统、提示词、生成、设定要求”等出戏词。
5. 不要使用 Markdown，不要解释。
6. 只输出一个 JSON 对象，格式必须是：
{"content":"朋友圈正文，1到120字","location":"可选地点，没有就留空"}
7. 不要输出 JSON 以外的任何字符。`
    },
    {
      role: 'user',
      content: `【角色人设】
${formatEntityForPrompt(character || contact || session, roleName)}

【用户面具身份】
${formatEntityForPrompt(mask, userName)}

【世界书条目】
${worldBookText}

【最近一天与用户的对话】
${conversationText}

请现在生成一条符合角色状态的朋友圈动态。`
    }
  ];
}

function normalizeAutonomousMomentPayload(rawPayload = {}) {
  const content = String(rawPayload?.content || rawPayload?.text || rawPayload?.moment || '').trim();
  const location = String(rawPayload?.location || '').trim();
  if (!content) return null;

  return {
    content: content.slice(0, 240),
    location: location.slice(0, 40)
  };
}

async function loadAutonomousMomentsSettingsForCurrentChat(state, db) {
  const currentKey = getCurrentChatPromptSettingsKey(state);
  const stored = await dbGet(db, currentKey);
  if (stored && typeof stored === 'object') {
    state.chatPromptSettings = {
      ...(state.chatPromptSettings || {}),
      ...stored
    };
  }
  return ensureStateAutonomousActivitySettings(state);
}

async function loadMessagesForAutonomousMoments(state, db, session) {
  if (String(state.currentChatId || '') === String(session?.id || '') && Array.isArray(state.currentMessages) && state.currentMessages.length) {
    return state.currentMessages;
  }
  return (await dbGet(db, `${DATA_KEY_MESSAGES_PREFIX(state.activeMaskId)}${session.id}`)) || [];
}

async function publishAutonomousMoment({ state, container, db, settingsManager }) {
  const session = getSessionForAutonomousMoments(state);
  if (!session) return false;

  const settings = await loadAutonomousMomentsSettingsForCurrentChat(state, db);
  if (!settings.autonomousMomentsEnabled) return false;

  const allSettings = settingsManager && typeof settingsManager.getAll === 'function'
    ? await settingsManager.getAll()
    : {};
  const profile = normalizeSecondaryApiProfile(allSettings?.api || {});
  if (!profile.apiKey || !profile.model) return false;

  const now = Date.now();
  const contact = getContactForAutonomousMoments(state, session);
  const character = getCharacterForAutonomousMoments(state, session, contact);
  const mask = getMaskForAutonomousMoments(state);
  const [worldBooks, messages] = await Promise.all([
    readRawDbRecordValue(db, WORLDBOOK_DB_RECORD_ID),
    loadMessagesForAutonomousMoments(state, db, session)
  ]);

  const promptMessages = buildAutonomousMomentsPrompt({
    character,
    mask,
    session,
    contact,
    worldBooks: Array.isArray(worldBooks) ? worldBooks : [],
    messages: getLatestOneDayMessages(messages, now)
  });
  const rawText = await requestAutonomousMomentsBySecondaryApi(profile, promptMessages);
  const parsed = normalizeAutonomousMomentPayload(extractJsonObjectFromAiText(rawText));
  if (!parsed) return false;

  const roleName = String(character?.name || contact?.name || session?.remark || session?.name || '角色').trim() || '角色';
  const roleAvatar = String(contact?.avatar || session?.avatar || character?.avatar || '').trim();
  const nextMoment = {
    id: createUid('moment'),
    authorId: String(character?.id || contact?.roleId || session?.id || '').trim(),
    authorName: roleName,
    authorAvatar: roleAvatar,
    content: parsed.content,
    images: [],
    likes: [],
    comments: [],
    reposts: [],
    shares: [],
    createdAt: now,
    location: parsed.location,
    visibilityMode: 'public',
    visibleContactIds: [],
    visibleContactNames: [],
    autonomousSource: 'chat-autonomous-activity'
  };

  const currentMoments = Array.isArray(state.moments)
    ? state.moments
    : ((await dbGet(db, DATA_KEY_MOMENTS(state.activeMaskId))) || []);
  state.moments = [nextMoment, ...currentMoments];
  await dbPut(db, DATA_KEY_MOMENTS(state.activeMaskId), state.moments);

  if (container?.isConnected && state.activePanel === 'moments') {
    refreshMomentsPanel(container, state);
  }

  await dbPut(db, AUTONOMOUS_MOMENTS_META_KEY(state.activeMaskId, session.id), {
    lastPublishedAt: now,
    lastMomentId: nextMoment.id,
    updatedAt: now
  });

  return true;
}

/* ==========================================================================
   [区域标注·已完成·自主活动主动发朋友圈后台调度]
   说明：
   1. 闲谈应用启动后由 index.js 最小接入本调度；业务逻辑仍集中在本文件。
   2. 开关开启且到达间隔后，才会在后台调用设置应用副 API 并写入朋友圈 IndexedDB。
   3. 调度只使用 setTimeout / visibilitychange / pageshow 进行前端运行时补偿；网页完全关闭期间不会伪造后台线程。
   4. 关闭开关会停止后续调用；不会回退主 API，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function initAutonomousMomentPublisher({
  state = {},
  container = null,
  db = null,
  settingsManager = null
} = {}) {
  let timer = 0;
  let running = false;
  let destroyed = false;

  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const schedule = (delay = 30000) => {
    if (destroyed) return;
    clearTimer();
    timer = window.setTimeout(() => {
      void checkAndPublish();
    }, Math.max(1000, Number(delay) || 30000));
  };

  const checkAndPublish = async () => {
    if (destroyed || running || state.destroyed) return;
    running = true;
    try {
      const session = getSessionForAutonomousMoments(state);
      if (!session) {
        schedule(60000);
        return;
      }

      const settings = await loadAutonomousMomentsSettingsForCurrentChat(state, db);
      const intervalMs = getAutonomousMomentsIntervalMs(settings);
      if (!settings.autonomousMomentsEnabled) {
        schedule(Math.min(intervalMs, 5 * 60 * 1000));
        return;
      }

      const metaKey = AUTONOMOUS_MOMENTS_META_KEY(state.activeMaskId, session.id);
      const meta = (await dbGet(db, metaKey)) || {};
      const lastPublishedAt = Number(meta.lastPublishedAt || 0) || 0;
      const now = Date.now();
      const dueAt = lastPublishedAt > 0 ? lastPublishedAt + intervalMs : now + intervalMs;

      if (now >= dueAt) {
        await publishAutonomousMoment({ state, container, db, settingsManager });
        schedule(intervalMs);
        return;
      }

      schedule(Math.min(Math.max(1000, dueAt - now), 5 * 60 * 1000));
    } catch (error) {
      console.warn('[Chat] 自主活动主动发朋友圈后台发布失败:', error);
      schedule(60000);
    } finally {
      running = false;
    }
  };

  const onVisibilityOrPageShow = () => {
    if (document.visibilityState === 'hidden') return;
    void checkAndPublish();
  };

  document.addEventListener('visibilitychange', onVisibilityOrPageShow);
  window.addEventListener('pageshow', onVisibilityOrPageShow);

  schedule(2500);

  return {
    destroy() {
      destroyed = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibilityOrPageShow);
      window.removeEventListener('pageshow', onVisibilityOrPageShow);
    },
    checkNow() {
      return checkAndPublish();
    }
  };
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置渲染]
   说明：
   1. 参考“头像与备注”板块：外层标题在左上方，内部使用同款暖色卡片与 iPhone 风格滑动开关。
   2. 开启“主动发朋友圈”后，详细设置以抽屉方式向下展开。
   3. 单位选择使用应用内分段按钮，不使用浏览器原生 select。
   4. 本渲染函数不读写持久化存储；保存由本模块事件函数写入 DB.js / IndexedDB。
   ========================================================================== */
export function renderAutonomousActivitySettingsSection(chatSettings = {}) {
  const settings = normalizeAutonomousActivitySettings(chatSettings);
  const drawerId = 'msg-autonomous-activity-drawer';
  const isEnabled = Boolean(settings.autonomousMomentsEnabled);

  return `
        <!-- ==================================================================
             [区域标注·已完成·自主活动主动发朋友圈设置模块]
             说明：
             1. 本区域已拆分到 chat-autonomous-activity-settings.js，后续修改“自主活动/主动发朋友圈”优先改该模块。
             2. “主动发朋友圈”开关与时间间隔保存到当前聊天对象 chatPromptSettings。
             3. 持久化统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage，不写双份存储兜底。
             4. 单位切换使用应用内分段按钮，不使用浏览器原生选择器。
             5. 开关开启后才会由本模块后台调度注入 AI 自主发布朋友圈提示词，并只调用设置应用副 API。
             ================================================================== -->
        <section class="msg-settings-avatar-section msg-autonomous-activity-section" data-role="msg-autonomous-activity-section">
          <div class="msg-settings-section-title">自主活动</div>
          <section class="msg-settings-card msg-settings-avatar-card msg-autonomous-activity-card">
            <div class="msg-settings-row msg-settings-avatar-switch-row">
              <div class="msg-settings-avatar-switch-copy">
                <div class="msg-settings-card__title">主动发朋友圈</div>
                <div class="msg-settings-card__desc">开启后，角色会按设定间隔主动发布朋友圈动态。</div>
              </div>
              <button
                class="msg-ios-switch ${isEnabled ? 'is-on' : ''}"
                data-action="toggle-autonomous-moments"
                type="button"
                aria-label="主动发朋友圈"
                aria-controls="${drawerId}"
                aria-expanded="${isEnabled ? 'true' : 'false'}"></button>
            </div>
            <div
              class="msg-autonomous-activity-drawer ${isEnabled ? 'is-open' : ''}"
              id="${drawerId}"
              data-role="msg-autonomous-activity-drawer"
              aria-hidden="${isEnabled ? 'false' : 'true'}">
              <div class="msg-settings-avatar-divider"></div>
              <div class="msg-autonomous-activity-drawer__inner">
                <div class="msg-settings-card__title">角色主动发布朋友圈动态的时间间隔</div>
                <div class="msg-autonomous-activity-interval-row">
                  <label class="msg-settings-number-field msg-autonomous-activity-interval-value">
                    <span>间隔数值</span>
                    <input
                      class="msg-settings-number-input"
                      data-role="msg-autonomous-moments-interval-value"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      step="1"
                      value="${escapeHtml(settings.autonomousMomentsIntervalValue)}">
                  </label>
                  <div class="msg-autonomous-activity-unit-field">
                    <span>时间单位</span>
                    <div class="msg-autonomous-activity-unit-group" data-role="msg-autonomous-moments-unit-group">
                      ${AUTONOMOUS_ACTIVITY_INTERVAL_UNITS.map(unit => `
                        <button
                          class="msg-autonomous-activity-unit-btn ${settings.autonomousMomentsIntervalUnit === unit.value ? 'is-active' : ''}"
                          data-action="set-autonomous-moments-interval-unit"
                          data-autonomous-unit="${escapeHtml(unit.value)}"
                          type="button">
                          ${escapeHtml(unit.label)}
                        </button>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>`;
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置局部同步]
   说明：
   1. 只同步“自主活动”设置区域的开关、抽屉和单位按钮，不重渲染整个聊天页，避免页面闪屏。
   2. 本函数不做持久化；持久化由点击/输入事件函数负责。
   ========================================================================== */
export function syncAutonomousActivitySettingsSection(container, state) {
  const section = container?.querySelector?.('[data-role="msg-autonomous-activity-section"]');
  if (!section) return;

  const settings = ensureStateAutonomousActivitySettings(state);
  const switchButton = section.querySelector('[data-action="toggle-autonomous-moments"]');
  const drawer = section.querySelector('[data-role="msg-autonomous-activity-drawer"]');
  const valueInput = section.querySelector('[data-role="msg-autonomous-moments-interval-value"]');

  if (switchButton) {
    switchButton.classList.toggle('is-on', settings.autonomousMomentsEnabled);
    switchButton.setAttribute('aria-expanded', settings.autonomousMomentsEnabled ? 'true' : 'false');
  }

  if (drawer) {
    drawer.classList.toggle('is-open', settings.autonomousMomentsEnabled);
    drawer.setAttribute('aria-hidden', settings.autonomousMomentsEnabled ? 'false' : 'true');
  }

  if (valueInput && String(valueInput.value) !== String(settings.autonomousMomentsIntervalValue)) {
    valueInput.value = String(settings.autonomousMomentsIntervalValue);
  }

  section.querySelectorAll('[data-action="set-autonomous-moments-interval-unit"]').forEach(button => {
    button.classList.toggle('is-active', String(button.dataset.autonomousUnit || '') === settings.autonomousMomentsIntervalUnit);
  });
}

/* ==========================================================================
   [区域标注·已完成·自主活动设置点击事件接线]
   说明：
   1. 处理“主动发朋友圈”滑动开关与“分钟 / 小时”单位按钮。
   2. 所有变更立即保存到 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不使用浏览器原生弹窗或原生选择器。
   ========================================================================== */
export async function handleAutonomousActivitySettingsClick({
  action = '',
  target = null,
  state = {},
  container = null,
  db = null
} = {}) {
  if (action === 'toggle-autonomous-moments') {
    ensureStateAutonomousActivitySettings(state);
    state.chatPromptSettings.autonomousMomentsEnabled = !state.chatPromptSettings.autonomousMomentsEnabled;
    ensureStateAutonomousActivitySettings(state);
    await persistAutonomousActivitySettings(state, db);
    syncAutonomousActivitySettingsSection(container, state);
    return true;
  }

  if (action === 'set-autonomous-moments-interval-unit') {
    const unit = String(target?.dataset?.autonomousUnit || '').trim();
    if (!isValidAutonomousActivityUnit(unit)) return true;

    ensureStateAutonomousActivitySettings(state);
    state.chatPromptSettings.autonomousMomentsIntervalUnit = unit;
    ensureStateAutonomousActivitySettings(state);
    await persistAutonomousActivitySettings(state, db);
    syncAutonomousActivitySettingsSection(container, state);
    return true;
  }

  return false;
}

/* ==========================================================================
   [区域标注·已完成·自主活动输入事件接线]
   说明：
   1. 处理“角色主动发布朋友圈动态的时间间隔”数值输入。
   2. 数值最小为 1，保存到当前聊天对象 chatPromptSettings。
   3. 持久化统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   ========================================================================== */
export function handleAutonomousActivitySettingsInput(e, state, container, db) {
  const target = e?.target;
  if (!target?.matches?.('[data-role="msg-autonomous-moments-interval-value"]')) return false;

  ensureStateAutonomousActivitySettings(state);
  const rawValue = Number(target.value || DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue);
  const nextValue = Number.isFinite(rawValue)
    ? Math.max(1, Math.floor(rawValue))
    : DEFAULT_AUTONOMOUS_ACTIVITY_SETTINGS.autonomousMomentsIntervalValue;

  state.chatPromptSettings.autonomousMomentsIntervalValue = nextValue;
  ensureStateAutonomousActivitySettings(state);

  if (String(target.value) !== String(nextValue)) {
    target.value = String(nextValue);
  }

  dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
  syncAutonomousActivitySettingsSection(container, state);
  return true;
}
