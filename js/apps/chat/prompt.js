/**
 * 文件名: js/apps/chat/prompt.js
 * 用途: 闲谈应用 — 提示词组装与聊天 API 调用模块
 * 说明:
 * 1. 本模块只读取项目 Settings/DB.js（IndexedDB）中的设置与聊天上下文。
 * 2. 禁止使用浏览器同步键值存储，也不写双份存储兜底逻辑。
 * 3. 所有提示词区域均用明显注释分隔，便于后续针对性修改。
 * 4. 提示词函数会把已传入/已从 IndexedDB 读取到的有效信息整理成 AI 可读文本。
 */

/* ==========================================================================
   [区域标注] API 服务商基础信息
   说明：与设置应用 js/apps/settings/api.js 的主 API 配置结构保持一致。
   ========================================================================== */
const PROVIDER_DEFAULT_BASE_URL = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  claude: 'https://api.anthropic.com/v1'
};

/* ==========================================================================
   [区域标注] IndexedDB 数据键
   说明：只读取 DB.js 暴露的 IndexedDB 数据，不使用 localStorage/sessionStorage。
   ========================================================================== */
const STORE_NAME = 'appsData';
const ARCHIVE_DB_RECORD_ID = 'archive::archive-data';
const WORLDBOOK_DB_RECORD_ID = 'worldbook::all-books';

/* ==========================================================================
   [区域标注] 世界书递归扫描规则
   说明：
   1. 这里的深度是“递归触发扫描深度”，不是发送给 AI 的文字。
   2. 深度 2 = 用户本次输入触发第 1 层；第 1 层正文继续触发第 2 层；不再扫描第 3 层。
   3. 世界书名称、条目名称、关键词、顺序、递归设置只给代码使用，不发送给 AI。
   ========================================================================== */
const WORLDBOOK_MAX_RECURSION_DEPTH = 2;

/* ==========================================================================
   [区域标注] 通用工具函数
   ========================================================================== */
function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function normalizeProviderId(providerId) {
  return PROVIDER_DEFAULT_BASE_URL[providerId] ? providerId : 'openai';
}

function extractApiErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload?.error?.message || payload?.error?.msg || payload?.message || payload?.detail || fallback;
}

function stripThinkBlocks(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages
        .filter(item => item && (item.role === 'user' || item.role === 'assistant' || item.role === 'system'))
        .map(item => ({ role: item.role, content: String(item.content || '') }))
        .filter(item => item.content.trim())
    : [];
}

function normalizePlainText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function hasReadableValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasReadableValue);
  if (typeof value === 'object') return Object.values(value).some(hasReadableValue);
  return false;
}

function isLikelyLargeMediaField(key, value) {
  const safeKey = String(key || '').toLowerCase();
  const safeValue = String(value || '');
  return (
    ['avatar', 'cover', 'image', 'img', 'photo', 'base64', 'file', 'blob'].some(token => safeKey.includes(token)) ||
    safeValue.startsWith('data:image/') ||
    safeValue.length > 1200
  );
}

function labelizeKey(key) {
  const labels = {
    id: 'ID',
    name: '名称',
    nickname: '昵称',
    signature: '签名',
    description: '描述',
    basicSetting: '基础设定',
    personality: '性格',
    firstMessage: '开场白',
    scenario: '场景',
    contact: '联系方式',
    gender: '性别',
    age: '年龄',
    roleId: '角色ID',
    groupId: '分组ID',
    type: '类型',
    content: '内容',
    notes: '备注',
    remark: '备注',
    relationship: '关系',
    currentCommand: '当前指令',
    customThinkingInstruction: '自定义思维链',
    externalContextEnabled: '外部上下文注入'
  };
  return labels[key] || key;
}

/* ==========================================================================
   [区域标注] AI 可读文本格式化工具
   说明：避免 [object Object]，并跳过头像/图片/base64 等不可读大字段。
   ========================================================================== */
function formatReadableValue(value, indent = 0) {
  const pad = '  '.repeat(indent);

  if (!hasReadableValue(value)) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        const formatted = formatReadableValue(item, indent + 1);
        return formatted ? `${pad}${index + 1}. ${formatted}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key, val]) => hasReadableValue(val) && !isLikelyLargeMediaField(key, val))
      .map(([key, val]) => {
        const formatted = formatReadableValue(val, indent + 1);
        if (!formatted) return '';
        const label = labelizeKey(key);
        return typeof val === 'object'
          ? `${pad}${label}：\n${formatted}`
          : `${pad}${label}：${formatted}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function createPromptSection(title, content) {
  const text = normalizePlainText(content);
  return text ? `【${title}】\n${text}` : '';
}

function formatNamedObject(title, source, preferredKeys = []) {
  if (!source || typeof source !== 'object') return '';

  const lines = [];
  preferredKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key) && hasReadableValue(source[key]) && !isLikelyLargeMediaField(key, source[key])) {
      const value = formatReadableValue(source[key]);
      if (value) lines.push(`${labelizeKey(key)}：${value}`);
    }
  });

  Object.entries(source).forEach(([key, value]) => {
    if (preferredKeys.includes(key)) return;
    if (!hasReadableValue(value) || isLikelyLargeMediaField(key, value)) return;
    const formatted = formatReadableValue(value);
    if (formatted) lines.push(`${labelizeKey(key)}：${formatted}`);
  });

  return createPromptSection(title, lines.join('\n'));
}

async function readDbRecordValue(db, id) {
  if (!db || typeof db.get !== 'function') return null;
  try {
    const record = await db.get(STORE_NAME, id);
    return record ? (record.value ?? record.data ?? null) : null;
  } catch {
    return null;
  }
}

function normalizeWorldBooks(rawBooks) {
  return Array.isArray(rawBooks) ? rawBooks : [];
}

function normalizeArchiveData(rawArchive) {
  const archive = rawArchive && typeof rawArchive === 'object' ? rawArchive : {};
  return {
    ...archive,
    masks: Array.isArray(archive.masks) ? archive.masks : [],
    characters: Array.isArray(archive.characters) ? archive.characters : [],
    activeMaskId: archive.activeMaskId || ''
  };
}

function getWorldBookKeywordMatchText(sourceText = '') {
  return String(sourceText || '').toLowerCase();
}

function getWorldBookEntryKeywords(entry) {
  return Array.isArray(entry?.keywords)
    ? entry.keywords.map(item => String(item || '').trim()).filter(Boolean)
    : [];
}

function isWorldBookEntryKeywordMatched(entry, sourceText = '') {
  const keywords = getWorldBookEntryKeywords(entry);

  /* [世界书触发规则] 关键词触发但没有关键词时不发送，避免空关键词条目被误注入。 */
  if (!keywords.length) return false;

  const haystack = getWorldBookKeywordMatchText(sourceText);
  return keywords.some(keyword => haystack.includes(keyword.toLowerCase()));
}

function canWorldBookEntryActivate(entry, sourceText = '', { allowAlways = true } = {}) {
  if (!entry || entry.enabled === false) return false;
  if (entry.triggerType === 'always') return allowAlways;
  return isWorldBookEntryKeywordMatched(entry, sourceText);
}

function isWorldBookAvailableForCharacter(book, characterId) {
  if (!book || book.enabled === false) return false;
  if (book.type === 'global') return true;

  const boundIds = Array.isArray(book.boundCharacterIds)
    ? book.boundCharacterIds.map(String)
    : (book.boundCharacterId ? [String(book.boundCharacterId)] : []);

  return Boolean(characterId && boundIds.includes(String(characterId)));
}

function getCurrentCharacterId(context = {}) {
  const session = context.currentSession || {};
  const contact = context.currentContact || {};
  return String(session.roleId || session.id || contact.roleId || contact.id || context.currentCharacterId || '').trim();
}

function getCurrentCharacter(context = {}) {
  const characterId = getCurrentCharacterId(context);
  const characters = Array.isArray(context.archiveData?.characters) ? context.archiveData.characters : [];
  return characters.find(item => String(item?.id || '') === characterId) || context.currentCharacter || null;
}

function getCurrentMask(context = {}) {
  const activeMaskId = context.activeMaskId || context.archiveData?.activeMaskId || '';
  const masks = Array.isArray(context.archiveData?.masks) ? context.archiveData.masks : [];
  return masks.find(item => String(item?.id || '') === String(activeMaskId)) || context.currentMask || null;
}

async function collectPromptRuntimeContext({
  db,
  activeMaskId = '',
  currentSession = null,
  currentContact = null,
  archiveData = null,
  worldBooks = null,
  userInput = '',
  history = [],
  settings = {}
} = {}) {
  const [archiveRecord, worldBookRecord] = await Promise.all([
    archiveData ? Promise.resolve(archiveData) : readDbRecordValue(db, ARCHIVE_DB_RECORD_ID),
    worldBooks ? Promise.resolve(worldBooks) : readDbRecordValue(db, WORLDBOOK_DB_RECORD_ID)
  ]);

  const normalizedArchive = normalizeArchiveData(archiveRecord);
  const normalizedWorldBooks = normalizeWorldBooks(worldBookRecord);
  const safeActiveMaskId = activeMaskId || normalizedArchive.activeMaskId || '';

  const context = {
    db,
    activeMaskId: safeActiveMaskId,
    currentSession,
    currentContact,
    archiveData: normalizedArchive,
    worldBooks: normalizedWorldBooks,
    userInput,
    history,
    settings
  };

  return {
    ...context,
    currentCharacterId: getCurrentCharacterId(context),
    currentCharacter: getCurrentCharacter(context),
    currentMask: getCurrentMask(context)
  };
}

/* ==========================================================================
   [区域标注] 聊天设置默认值
   说明：设置页写入 IndexedDB 后会覆盖这些默认值。
   ========================================================================== */
export function getDefaultChatPromptSettings() {
  return {
    externalContextEnabled: false,
    currentCommand: '',
    customThinkingInstruction: ''
  };
}

/* ==========================================================================
   [区域标注] 聊天设置规范化
   ========================================================================== */
export function normalizeChatPromptSettings(rawSettings) {
  const defaults = getDefaultChatPromptSettings();
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  return {
    externalContextEnabled: Boolean(source.externalContextEnabled),
    currentCommand: String(source.currentCommand || defaults.currentCommand),
    customThinkingInstruction: String(source.customThinkingInstruction || defaults.customThinkingInstruction)
  };
}

/* ==========================================================================
   [提示词区域 1] 世界书置顶条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“置顶”的条目。
   ========================================================================== */
export function getWorldBookTop(context = {}) {
  return formatWorldBookEntriesByPosition('top', context);
}

/* ==========================================================================
   [提示词区域 2] 世界书角色前条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“角色前”的条目。
   ========================================================================== */
export function getWorldBookBeforeChar(context = {}) {
  return formatWorldBookEntriesByPosition('beforeChar', context);
}

/* ==========================================================================
   [提示词区域 3] 角色卡人设
   说明：角色卡具体人设以及所绑定的关系网络信息。
   ========================================================================== */
export function getCharacterCard(context = {}) {
  const character = context.currentCharacter || getCurrentCharacter(context);
  return formatNamedObject('角色卡人设', character, [
    'name',
    'gender',
    'age',
    'signature',
    'description',
    'basicSetting',
    'personality',
    'scenario',
    'firstMessage',
    'relationship',
    'contact'
  ]);
}

/* ==========================================================================
   [提示词区域 4] 用户面具身份
   说明：角色卡所绑定的用户面具身份。
   ========================================================================== */
export function getUserPersona(context = {}) {
  const mask = context.currentMask || getCurrentMask(context);
  return formatNamedObject('用户面具身份', mask, [
    'name',
    'nickname',
    'signature',
    'description',
    'basicSetting',
    'personality'
  ]);
}

/* ==========================================================================
   [提示词区域 5] 角色记忆
   说明：把当前会话、联系人备注等可读信息整理给 AI。
   ========================================================================== */
export function getMemories(context = {}) {
  const lines = [];
  const session = context.currentSession || {};
  const contact = context.currentContact || {};

  if (hasReadableValue(session)) {
    const sessionText = formatReadableValue({
      会话名称: session.name,
      会话类型: session.type,
      最近消息: session.lastMessage
    });
    if (sessionText) lines.push(`当前会话：\n${sessionText}`);
  }

  if (hasReadableValue(contact)) {
    const contactText = formatReadableValue({
      联系人名称: contact.name,
      联系人签名: contact.signature,
      联系方式: contact.contact,
      备注: contact.remark || contact.notes
    });
    if (contactText) lines.push(`联系人资料：\n${contactText}`);
  }

  return createPromptSection('角色记忆与当前关系资料', lines.join('\n\n'));
}

/* ==========================================================================
   [提示词区域 6] 世界书角色后条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“角色后”的条目。
   ========================================================================== */
export function getWorldBookAfterChar(context = {}) {
  return formatWorldBookEntriesByPosition('afterChar', context);
}

/* ==========================================================================
   [提示词区域 6-A] 世界书条目格式化
   说明：
   1. 按位置、启用状态、绑定角色、关键词触发规则筛选世界书。
   2. 关键词触发只匹配“用户本次输入”；历史消息不参与触发。
   3. 支持最多 2 层递归扫描；递归控制字段只由代码使用。
   4. 最终只发送条目正文给 AI，不发送世界书名称、条目名称或触发元信息。
   ========================================================================== */
function getWorldBookCandidateEntriesByPosition(position, context = {}) {
  const books = Array.isArray(context.worldBooks) ? context.worldBooks : [];
  const characterId = context.currentCharacterId || getCurrentCharacterId(context);

  return books
    .filter(book => isWorldBookAvailableForCharacter(book, characterId))
    .flatMap(book => {
      const entries = Array.isArray(book.entries) ? book.entries : [];
      return entries
        .filter(entry => entry?.position === position && entry.enabled !== false)
        .map(entry => ({ ...entry, __worldBookId: book.id || '' }));
    })
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function collectActivatedWorldBookEntries(position, context = {}) {
  const candidates = getWorldBookCandidateEntriesByPosition(position, context);
  const activated = [];
  const activatedIds = new Set();
  const initialSourceText = String(context.userInput || '');
  let scanSources = [initialSourceText];
  let stopFurtherRecursion = false;

  for (let depth = 1; depth <= WORLDBOOK_MAX_RECURSION_DEPTH && scanSources.length && !stopFurtherRecursion; depth += 1) {
    const nextScanSources = [];
    const allowAlways = depth === 1;

    candidates.forEach((entry, index) => {
      const entryKey = String(entry.id || `${entry.__worldBookId || 'book'}::${position}::${index}`);
      if (activatedIds.has(entryKey)) return;

      const matched = scanSources.some(sourceText => canWorldBookEntryActivate(entry, sourceText, { allowAlways }));
      if (!matched) return;

      const content = normalizePlainText(entry.content);
      if (!content) return;

      activatedIds.add(entryKey);
      activated.push(entry);

      if (entry.preventFurtherRecursion) {
        stopFurtherRecursion = true;
        return;
      }

      if (!entry.disableRecursion) {
        nextScanSources.push(content);
      }
    });

    scanSources = nextScanSources;
  }

  return activated.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function formatWorldBookEntriesByPosition(position, context = {}) {
  const chunks = collectActivatedWorldBookEntries(position, context)
    .map(entry => normalizePlainText(entry.content))
    .filter(Boolean);

  const sectionTitleMap = {
    top: '世界书置顶条目',
    beforeChar: '世界书角色前条目',
    afterChar: '世界书角色后条目'
  };

  return createPromptSection(sectionTitleMap[position] || '世界书条目', chunks.join('\n\n'));
}

/* ==========================================================================
   [提示词区域 7] 聊天功能格式要求
   说明：本函数返回值会进入 system prompt。
   ========================================================================== */
export function getFeaturePrompts() {
  return [
    /* --------------------------------------------------------------------------
       [功能规则·临时状态指令 SYSTEM_TEMP]
       说明：这段规则固定放在 getFeaturePrompts 返回值最前面。
       -------------------------------------------------------------------------- */
    `当收到的用户消息中出现以 [SYSTEM_TEMP] 开头、[/SYSTEM_TEMP] 结尾的段落时，
这是当前最高优先级的临时状态指令。
你必须严格遵从并立即调整语气或状态，但这段指令本身绝不能出现在回复里。
同时这段指令不能覆盖或删除【可用聊天动作格式】里的任何格式规则，
除非指令自己明确要求使用或禁止某种特定格式。`,

    /* --------------------------------------------------------------------------
       [功能规则·可用聊天动作格式]
       说明：以后在这里追加表情包、转账、动作等聊天功能格式要求。
       -------------------------------------------------------------------------- */
    ''
  ].filter(Boolean).join('\n\n');
}

/* ==========================================================================
   [提示词区域 8] 外部应用上下文
   说明：只在聊天设置中开启“外部应用消息注入”时注入。
   ========================================================================== */
export function getExternalContext({ enabled = false, context = {} } = {}) {
  if (!enabled) return '';

  const archive = context.archiveData || {};
  const characterCount = Array.isArray(archive.characters) ? archive.characters.length : 0;
  const maskCount = Array.isArray(archive.masks) ? archive.masks.length : 0;
  const worldBookCount = Array.isArray(context.worldBooks) ? context.worldBooks.length : 0;

  return createPromptSection('外部应用上下文', [
    `当前激活面具ID：${context.activeMaskId || '未设置'}`,
    `档案应用：${maskCount} 个用户面具，${characterCount} 个角色档案。`,
    `世情应用：${worldBookCount} 本世界书可供筛选。`
  ].join('\n'));
}

/* ==========================================================================
   [提示词区域 9] 聊天历史
   说明：返回数组 [{ role:'user'|'assistant', content:string }]，直接追加到 messages。
   ========================================================================== */
export function getChatHistory({ history = [] } = {}) {
  return normalizeMessages(history).filter(item => item.role === 'user' || item.role === 'assistant');
}

/* ==========================================================================
   [提示词区域 10] 当前指令
   说明：来自聊天消息界面设置页的“当前指令”区域。
   ========================================================================== */
export function getCurrentCommand({ settings = {} } = {}) {
  return String(settings.currentCommand || '').trim();
}

/* ==========================================================================
   [提示词区域 12] 思维链指令
   说明：如果聊天设置“自定义思维链”留空，则使用默认思维链。
   注意：界面层会隐藏 <think>...</think> 内容，只展示最终回复。
   ========================================================================== */
export function getThinkingInstruction({ settings = {} } = {}) {
  const custom = String(settings.customThinkingInstruction || '').trim();
  return custom || '【回复格式】先输出<think>你的内心判断</think>，再输出最终回复。';
}

/* ==========================================================================
   [核心函数] buildSystemPrompt
   说明：按用户指定顺序拼接所有系统级设定，作为 messages[0] 的 system 内容。
   ========================================================================== */
export function buildSystemPrompt({ settings = {}, context = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const runtimeContext = { ...context, settings: normalizedSettings };

  return [
    getWorldBookTop(runtimeContext),
    getWorldBookBeforeChar(runtimeContext),
    getCharacterCard(runtimeContext),
    getUserPersona(runtimeContext),
    getMemories(runtimeContext),
    getWorldBookAfterChar(runtimeContext),
    getFeaturePrompts(),
    getExternalContext({ enabled: normalizedSettings.externalContextEnabled, context: runtimeContext }),
    getThinkingInstruction({ settings: normalizedSettings })
  ].map(part => String(part || '').trim()).filter(Boolean).join('\n\n');
}

/* ==========================================================================
   [核心函数] buildChatMessages
   说明：
   1. 第一条为 system。
   2. 追加历史对话。
   3. 最后一条 user 消息由“当前指令 + 用户输入”组成。
   ========================================================================== */
export function buildChatMessages({ userInput, history = [], settings = {}, context = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const systemPrompt = buildSystemPrompt({ settings: normalizedSettings, context: { ...context, userInput, history } });
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push(...getChatHistory({ history }));

  const currentCommand = getCurrentCommand({ settings: normalizedSettings });
  const rawUserInput = String(userInput || '').trim();
  const finalUserContent = currentCommand
    ? `[SYSTEM_TEMP]${currentCommand}[/SYSTEM_TEMP]\n\n${rawUserInput}`
    : rawUserInput;

  if (finalUserContent.trim()) {
    messages.push({ role: 'user', content: finalUserContent });
  }

  return messages;
}

/* ==========================================================================
   [设置读取区域] 获取主 API 配置
   说明：只使用设置应用中的主 API；副 API 留给之后其它功能绑定。
   ========================================================================== */
async function getPrimaryApiConfig(settingsManager) {
  const allSettings = settingsManager && typeof settingsManager.getAll === 'function'
    ? await settingsManager.getAll()
    : {};

  const api = allSettings?.api || {};
  const global = api.global || {};
  const primary = api.primary || {};
  const provider = normalizeProviderId(primary.provider || 'openai');

  return {
    provider,
    apiKey: String(primary.apiKey || ''),
    baseUrl: String(primary.baseUrl || PROVIDER_DEFAULT_BASE_URL[provider]),
    model: String(primary.model || ''),
    stream: Boolean(primary.stream),
    temperature: Number.isFinite(Number(global.temperature)) ? Number(global.temperature) : 0.7,
    maxTokens: Number.isFinite(Number(global.maxTokens)) ? Number(global.maxTokens) : 2048
  };
}

/* ==========================================================================
   [API 调用区域] OpenAI / DeepSeek 兼容接口
   ========================================================================== */
async function requestOpenAiLike(profile, messages) {
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

  return payload?.choices?.[0]?.message?.content || '';
}

/* ==========================================================================
   [API 调用区域] Gemini 接口
   说明：将 system 与历史消息压平成文本，兼容 Gemini generateContent。
   ========================================================================== */
async function requestGemini(profile, messages) {
  const url = `${trimSlash(profile.baseUrl)}/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;
  const mergedText = messages.map(item => `${item.role.toUpperCase()}:\n${item.content}`).join('\n\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: mergedText }] }],
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

  return payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/* ==========================================================================
   [API 调用区域] Claude 接口
   说明：Claude system 单独传入，其余 user/assistant 作为 messages。
   ========================================================================== */
async function requestClaude(profile, messages) {
  const systemPrompt = messages.find(item => item.role === 'system')?.content || '';
  const claudeMessages = messages
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .map(item => ({ role: item.role, content: item.content }));

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
      system: systemPrompt,
      messages: claudeMessages
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  return payload?.content?.find?.(item => item?.type === 'text')?.text || payload?.content?.[0]?.text || '';
}

/* ==========================================================================
   [核心函数] chat
   说明：读取 IndexedDB 上下文，构建 messages 后调用设置应用“主 API”，并返回 AI 最终回复文本。
   ========================================================================== */
export async function chat({
  userInput,
  history = [],
  chatSettings = {},
  settingsManager,
  db,
  activeMaskId = '',
  currentSession = null,
  currentContact = null,
  archiveData = null,
  worldBooks = null
} = {}) {
  const promptContext = await collectPromptRuntimeContext({
    db,
    activeMaskId,
    currentSession,
    currentContact,
    archiveData,
    worldBooks,
    userInput,
    history,
    settings: chatSettings
  });

  const messages = buildChatMessages({
    userInput,
    history,
    settings: chatSettings,
    context: promptContext
  });

  const profile = await getPrimaryApiConfig(settingsManager);

  if (!profile.apiKey) {
    throw new Error('主 API Key 不能为空，请先在设置应用的 API 设置中保存并确认连接。');
  }

  if (!profile.model) {
    throw new Error('主 API 模型不能为空，请先在设置应用的 API 设置中拉取并选择模型。');
  }

  let rawText = '';
  switch (profile.provider) {
    case 'openai':
    case 'deepseek':
      rawText = await requestOpenAiLike(profile, messages);
      break;
    case 'gemini':
      rawText = await requestGemini(profile, messages);
      break;
    case 'claude':
      rawText = await requestClaude(profile, messages);
      break;
    default:
      throw new Error(`不支持的主 API 服务商：${profile.provider}`);
  }

  return {
    messages,
    rawText,
    text: stripThinkBlocks(rawText)
  };
}
