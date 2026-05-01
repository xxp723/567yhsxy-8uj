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

/* ==========================================================================
   [区域标注·已修改] AI 表情包挂载提示词数据工具
   说明：
   1. 表情包资源来自 DB.js / IndexedDB 中的全局共享资产。
   2. mountedStickerGroupIds 来自“当前面具 + 当前聊天对象”的独立聊天设置，不再作为所有联系人通用设置。
   3. system prompt 只注入当前聊天对象已挂载分组下的有效表情包资源。
   ========================================================================== */
function normalizeStickerPromptData(rawData) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map(group => ({
          id: String(group?.id || '').trim(),
          name: String(group?.name || '').trim()
        }))
        .filter(group => group.id && group.name)
    : [];
  const validGroupIds = new Set(['all', ...groups.map(group => group.id)]);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : (Array.isArray(source.stickers) ? source.stickers : []);
  const items = rawItems
    .map(item => ({
      id: String(item?.id || '').trim(),
      groupId: validGroupIds.has(String(item?.groupId || 'all')) ? String(item?.groupId || 'all') : 'all',
      name: String(item?.name || '').trim(),
      url: String(item?.url || '').trim()
    }))
    .filter(item => item.id && item.name && item.url);

  return { groups, items };
}

/* ==========================================================================
   ===== 闲谈：通用消息协议格式 START =====
   说明：
   1. 新回复协议统一使用 **`[类型] 角色名：内容`**。
   2. 已开放 [回复]/[表情]/[引用]/[转账]，其中 [引用] 用于微信/QQ 式引用回复。
   ========================================================================== */
const CHAT_PROTOCOL_REPLY_FORMAT = '**`[回复] 角色名：文字消息内容`**';
const CHAT_PROTOCOL_AVAILABLE_FORMATS = [
  '**`[回复] 角色名：文字消息内容`**',
  '**`[表情] 角色名：表情名或资源ID`**',
  '**`[引用] 角色名：{引用ID:xxx}文字消息内容`**',
  '**`[转账] 角色名：{金额:xxx,备注:xxx}`**',
  '**`[图片] 角色名：图片描述或资源ID`**',
  '**`[语音] 角色名：{时长:xx}语音转写文本`**'
];
/* ===== 闲谈：通用消息协议格式 END ===== */

/* ==========================================================================
   [区域标注·已完成·AI识图多模态消息工具]
   说明：
   1. 只使用聊天消息记录中已经写入 DB.js / IndexedDB 的 stickerUrl / imageUrl。
   2. 不读取 localStorage/sessionStorage，不写双份存储兜底。
   3. 内部统一使用 OpenAI 兼容的 content parts；各 API 请求器再转换为自身格式。
   ========================================================================== */
function isImageDataUrl(url = '') {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url || '').trim());
}

function parseImageDataUrl(url = '') {
  const match = String(url || '').trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  return match ? { mimeType: match[1], data: match[2] } : null;
}

function guessImageMimeType(url = '') {
  const value = String(url || '').split('?')[0].split('#')[0].toLowerCase();
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.png')) return 'image/png';
  return 'image/png';
}

function getMessageVisualUrl(message = {}) {
  if (String(message?.type || '') === 'sticker') return String(message?.stickerUrl || '').trim();
  if (String(message?.type || '') === 'image') return String(message?.imageUrl || '').trim();
  return '';
}

function getMessageVisualLabel(message = {}) {
  if (String(message?.type || '') === 'sticker') return `用户发送了一张表情包：${message?.stickerName || message?.content || '未命名表情包'}`;
  if (String(message?.type || '') === 'image') return `用户发送了一张图片：${message?.imageName || message?.content || '图片'}`;
  return '';
}

function createVisionMessageContent(message = {}, textContent = '') {
  const text = String(textContent || '').trim();
  const visualUrl = getMessageVisualUrl(message);
  if (!visualUrl || message.role !== 'user') return text;

  const visualLabel = getMessageVisualLabel(message);
  return [
    { type: 'text', text: [text, visualLabel].filter(Boolean).join('\n') || visualLabel || '用户发送了一张图片。' },
    { type: 'image_url', image_url: { url: visualUrl } }
  ];
}

function hasMessageContent(content) {
  if (Array.isArray(content)) {
    return content.some(part => {
      if (part?.type === 'text') return String(part.text || '').trim();
      if (part?.type === 'image_url') return String(part.image_url?.url || '').trim();
      return false;
    });
  }
  return String(content || '').trim();
}

function getTextFromMessageContent(content) {
  if (Array.isArray(content)) {
    return content
      .filter(part => part?.type === 'text')
      .map(part => String(part.text || '').trim())
      .filter(Boolean)
      .join('\n');
  }
  return String(content || '');
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages
        .filter(item => item && (item.role === 'user' || item.role === 'assistant' || item.role === 'system'))
        .map(item => ({ role: item.role, content: Array.isArray(item.content) ? item.content : String(item.content || '') }))
        .filter(item => hasMessageContent(item.content))
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

/* ========================================================================
   [区域标注·已完成·本次需求1] 档案长文本字段不过滤修复
   说明：
   1. 角色档案/用户面具的 personalitySetting 是有效长文本，不再因超过 1200 字被误判为媒体字段。
   2. 配角档案的 basicSetting、关系备注等文本字段也允许长文本进入 prompt。
   3. 头像、图片、base64、文件、blob 等媒体字段仍继续过滤，避免把不可读大资源发给 AI。
   ======================================================================== */
function isArchivePromptTextField(key) {
  const safeKey = String(key || '').trim();
  return [
    'personalitySetting',
    'basicSetting',
    'description',
    'scenario',
    'notes',
    'remark',
    'ownerNote',
    'targetNote',
    'content'
  ].includes(safeKey);
}

function isLikelyLargeMediaField(key, value) {
  const safeKey = String(key || '').toLowerCase();
  const safeValue = String(value || '');

  if (isArchivePromptTextField(key)) return false;

  return (
    ['avatar', 'cover', 'image', 'img', 'photo', 'base64', 'file', 'blob'].some(token => safeKey.includes(token)) ||
    safeValue.startsWith('data:image/')
  );
}

function labelizeKey(key) {
  const labels = {
    id: 'ID',
    name: '姓名',
    nickname: '昵称',
    signature: '个性签名',
    description: '描述',
    basicSetting: '基本设定',
    personality: '性格',
    firstMessage: '开场白',
    greetings: '开场白',
    scenario: '场景',
    identity: '身份',
    personalitySetting: '人物设定',
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

/* ========================================================================
   [区域标注·已完成·本次需求1] 档案字段按对象类型显示标签
   说明：
   1. personalitySetting 是档案应用复用字段。
   2. 角色档案中显示为“人物设定”，用户面具中显示为“用户设定”。
   3. 配角档案只使用姓名、性别、联系方式、基本设定四项，其中 basicSetting 显示为“基本设定”。
   ======================================================================== */
function labelizeArchivePromptKey(key, entityType = '') {
  if (key === 'personalitySetting' && entityType === 'mask') return '用户设定';
  if (key === 'personalitySetting' && entityType === 'character') return '人物设定';
  if (key === 'basicSetting' && entityType === 'supporting') return '基本设定';
  return labelizeKey(key);
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

/* ==========================================================================
   [区域标注·已完成·AI引用回复提示词格式化]
   说明：
   1. 只把消息对象里已有的 id / quote / content 整理进本轮 API 请求，不新增任何持久化存储。
   2. quote 字段随聊天消息对象保存在 DB.js / IndexedDB；这里仅做 AI 可读格式转换。
   3. AI 如需引用回复，必须使用 [引用] 协议，并填写本区暴露的“可引用消息ID”。
   ========================================================================== */
function formatPromptQuoteLine(quote = {}) {
  const quoteText = normalizePlainText(quote?.text);
  if (!quoteText) return '';

  const senderName = normalizePlainText(quote?.senderName || (quote?.role === 'user' ? '我' : '对方')) || '对方';
  const quoteId = normalizePlainText(quote?.id);
  return `> 当前消息引用了${quoteId ? `消息ID:${quoteId}，` : ''}${senderName}的原消息：“${quoteText}”`;
}

function formatMessageTextWithQuoteForPrompt(message = {}, fallbackContent = '') {
  const content = normalizePlainText(fallbackContent || message?.content);
  const quoteLine = formatPromptQuoteLine(message?.quote);
  const messageId = normalizePlainText(message?.id);
  const type = normalizePlainText(message?.type) || 'text';
  const idLine = messageId ? `[可引用消息ID:${messageId}；消息类型:${type}]` : '';

  return [idLine, quoteLine, content].filter(Boolean).join('\n');
}

function extractSystemTempBlocks(text = '') {
  return String(text || '').match(/\[SYSTEM_TEMP\][\s\S]*?\[\/SYSTEM_TEMP\]/g) || [];
}

function buildCurrentUserPromptContent(rawUserInput = '', currentUserRoundMessages = []) {
  const formattedRoundMessages = Array.isArray(currentUserRoundMessages)
    ? currentUserRoundMessages
        .map(item => formatMessageTextWithQuoteForPrompt(item))
        .filter(Boolean)
        .join('\n\n')
    : '';

  if (!formattedRoundMessages) return normalizePlainText(rawUserInput);

  const systemTempBlocks = extractSystemTempBlocks(rawUserInput);
  return [formattedRoundMessages, ...systemTempBlocks].filter(Boolean).join('\n\n');
}

/* ==========================================================================
   [角色卡字段读取工具区·已完成] 档案字段中文化与可读格式化
   说明：
   1. 档案应用实际把角色正文主要保存为 personalitySetting，把身份保存为 identity，把开场白保存为 greetings。
   2. 本区只负责读取/格式化字段，不单独生成 prompt；实际发送位置见“提示词区域 2”。
   3. 本区不新增持久化存储，不使用 localStorage/sessionStorage，也不写双份兜底。
   ========================================================================== */
function getCharacterPromptFieldValue(character, key) {
  if (!character || typeof character !== 'object') return '';

  return character[key];
}

function getCharacterPromptFieldEntries(character, keys = [], entityType = 'character') {
  const seenLabels = new Set();

  return keys
    .map(key => {
      const value = getCharacterPromptFieldValue(character, key);
      if (!hasReadableValue(value) || isLikelyLargeMediaField(key, value)) return null;

      const label = labelizeArchivePromptKey(key, entityType);
      const formatted = formatReadableValue(value);
      if (!formatted) return null;

      const signature = `${label}::${formatted}`;
      if (seenLabels.has(signature)) return null;
      seenLabels.add(signature);

      return { key, label, value, formatted };
    })
    .filter(Boolean);
}

/* ==========================================================================
   [区域标注·已完成·本次需求2] 档案性别字段 AI 理解工具
   说明：
   1. 只读取档案应用已写入 IndexedDB 的 gender 字符串，不新增存储，不使用 localStorage/sessionStorage。
   2. 当性别为“双性”时，补充精简释义仅供 AI 理解；最终回复不得把释义当系统说明暴露给用户。
   3. 明确警告 AI 不得认错用户面具、角色档案中的性别。
   ========================================================================== */
function createArchiveGenderPromptNote(entity, entityLabel = '档案对象') {
  const gender = normalizePlainText(entity?.gender);
  if (!gender) return '';

  const commonRule = `【${entityLabel}性别识别硬约束】
- 档案字段“性别：${gender}”是硬事实，必须严格按此识别，禁止认错性别、擅自改性别或用刻板印象覆盖档案填写内容。`;

  if (gender !== '双性') return commonRule;

  return `${commonRule}
- 当性别为“双性”时，仅供 AI 理解的核心认知如下：
  ## 核心认知
  - {{user}}的外观与社会性别为男性，但具有双性生殖系统。
  - 俗称“双性男”或“Cuntboy”，拥有女性生殖器但保留了男性的部分关键构造（如前列腺）。
  - 外观特征：整体外观为男性，平胸、喉结、男性骨架与肌肉；仅在脱下裤子暴露生殖器时显露双性特征。
- 以上“双性”释义只用于你理解档案设定，禁止在最终回复中机械复述说明文字，除非用户明确询问相关设定。`;
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
    /* [区域标注·已完成·本次需求1] 档案关系网络注入修复：保留配角档案与关系网络，避免发送给 AI 的关系上下文为空字符串 */
    supportingRoles: Array.isArray(archive.supportingRoles) ? archive.supportingRoles : [],
    relations: Array.isArray(archive.relations) ? archive.relations : [],
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

/* ==========================================================================
   [区域标注·已完成·本次需求1] 当前聊天角色档案匹配修复
   说明：
   1. 优先使用通讯录保存的 roleId / 会话 roleId 精确匹配档案应用 characters[].id。
   2. 再使用 contact.id / session.id 兼容旧数据；最后按联系人/会话名称兜底匹配。
   3. 本区只读取已传入或 IndexedDB 中的档案数据，不使用 localStorage/sessionStorage。
   4. 不向 AI 发送角色开场白 greetings，也不发送角色绑定世界书名称 boundWorldBooks。
   ========================================================================== */
function getCurrentCharacterId(context = {}) {
  const session = context.currentSession || {};
  const contact = context.currentContact || {};
  const characters = Array.isArray(context.archiveData?.characters) ? context.archiveData.characters : [];
  const candidateIds = [
    contact.roleId,
    session.roleId,
    context.currentCharacterId,
    contact.id,
    session.id
  ].map(item => String(item || '').trim()).filter(Boolean);

  const matchedId = candidateIds.find(candidateId => (
    characters.some(character => String(character?.id || '') === candidateId)
  ));

  return matchedId || candidateIds[0] || '';
}

function getCurrentCharacter(context = {}) {
  const characterId = getCurrentCharacterId(context);
  const characters = Array.isArray(context.archiveData?.characters) ? context.archiveData.characters : [];
  const byId = characters.find(item => String(item?.id || '') === characterId);
  if (byId) return byId;

  const session = context.currentSession || {};
  const contact = context.currentContact || {};
  const candidateNames = [
    contact.name,
    session.name
  ].map(item => normalizePlainText(item)).filter(Boolean);

  return characters.find(character => candidateNames.includes(normalizePlainText(character?.name))) || context.currentCharacter || null;
}

function getCurrentMask(context = {}) {
  const activeMaskId = context.activeMaskId || context.archiveData?.activeMaskId || '';
  const masks = Array.isArray(context.archiveData?.masks) ? context.archiveData.masks : [];
  return masks.find(item => String(item?.id || '') === String(activeMaskId)) || context.currentMask || null;
}

/* ==========================================================================
   [区域标注·已完成·本次需求1] 用户面具/角色/配角关系网络档案详情注入修复
   说明：
   1. 读取档案应用写入 IndexedDB 的 masks / characters / supportingRoles / relations。
   2. 同时支持当前对象作为 owner 或 target 的双向关系，避免关系网络为空。
   3. 关系网络会发送关系对象类型、名称、关系标签、当前视角备注，并补充关系对象档案摘要。
   4. 角色档案只注入姓名、性别、年龄、身份、联系方式、个性签名、人物设定。
   5. 用户面具只注入姓名、性别、年龄、身份、联系方式、个性签名、用户设定。
   6. 配角档案只注入姓名、性别、联系方式、基本设定四项，禁止编造或补充不存在字段。
   7. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
function getArchiveEntityListByType(context = {}, type = '') {
  const archive = context.archiveData || {};
  if (type === 'mask') return Array.isArray(archive.masks) ? archive.masks : [];
  if (type === 'character') return Array.isArray(archive.characters) ? archive.characters : [];
  if (type === 'supporting') return Array.isArray(archive.supportingRoles) ? archive.supportingRoles : [];
  return [];
}

function getArchiveEntityName(context = {}, type = '', id = '') {
  const entity = getArchiveEntityListByType(context, type).find(item => String(item?.id || '') === String(id || ''));
  return entity?.name || entity?.nickname || '未命名';
}

function getArchiveEntityPromptFieldsByType(type = '') {
  if (type === 'mask') {
    return ['name', 'gender', 'age', 'identity', 'contact', 'signature', 'personalitySetting'];
  }

  if (type === 'character') {
    return ['name', 'gender', 'age', 'identity', 'contact', 'signature', 'personalitySetting'];
  }

  if (type === 'supporting') {
    return ['name', 'gender', 'contact', 'basicSetting'];
  }

  return [];
}

function formatArchiveEntitySummaryForPrompt(context = {}, type = '', id = '') {
  const entity = getArchiveEntityListByType(context, type).find(item => String(item?.id || '') === String(id || ''));
  const keys = getArchiveEntityPromptFieldsByType(type);
  if (!entity || !keys.length) return '';

  const lines = getCharacterPromptFieldEntries(entity, keys, type)
    .map(entry => `  ${entry.label}：${entry.formatted}`)
    .filter(Boolean);

  return lines.length ? `  关系对象档案：\n${lines.join('\n')}` : '';
}

function getRelationDisplayText(type = '', custom = '') {
  const safeType = String(type || '').trim();
  const safeCustom = String(custom || '').trim();
  if (safeType === '自定义') return safeCustom || '自定义关系';
  return safeType || safeCustom || '未设定';
}

function formatArchiveRelationNetworkForEntity(context = {}, entityType = '', entityId = '', title = '关系网络') {
  const safeType = String(entityType || '').trim();
  const safeId = String(entityId || '').trim();
  const relations = Array.isArray(context.archiveData?.relations) ? context.archiveData.relations : [];
  if (!safeType || !safeId || !relations.length) return '';

  const typeLabels = {
    mask: '用户面具',
    character: '角色',
    supporting: '配角'
  };

  const lines = relations
    .map(item => {
      const isOwnerSide = item?.ownerType === safeType && String(item?.ownerId || '') === safeId;
      const isTargetSide = item?.targetType === safeType && String(item?.targetId || '') === safeId;
      if (!isOwnerSide && !isTargetSide) return '';

      const counterpartType = isOwnerSide ? item.targetType : item.ownerType;
      const counterpartId = isOwnerSide ? item.targetId : item.ownerId;
      const counterpartName = getArchiveEntityName(context, counterpartType, counterpartId);
      const counterpartTypeLabel = typeLabels[counterpartType] || '人物';
      const relationLabel = isOwnerSide
        ? getRelationDisplayText(item.ownerRelationType, item.ownerRelationCustom)
        : getRelationDisplayText(item.targetRelationType, item.targetRelationCustom);
      const note = normalizePlainText(isOwnerSide ? item.ownerNote : item.targetNote);
      const counterpartSummary = formatArchiveEntitySummaryForPrompt(context, counterpartType, counterpartId);

      return [
        `- 与${counterpartTypeLabel}「${counterpartName}」：${relationLabel}${note ? `；当前视角备注：${note}` : ''}`,
        counterpartSummary
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean);

  return lines.length ? `${title}：\n${lines.join('\n')}` : '';
}

function formatUserPersonaRelationNetwork(context = {}, mask = null) {
  const maskId = String(mask?.id || context.activeMaskId || '').trim();
  return formatArchiveRelationNetworkForEntity(context, 'mask', maskId, '用户面具身份绑定的关系网络');
}

/* ==========================================================================
   [区域标注·已完成·本次需求1] 角色卡绑定关系网络格式化
   说明：读取档案应用写入 IndexedDB 的 relations，注入当前要扮演角色的关系网与关系对象档案摘要。
   ========================================================================== */
function formatCharacterRelationNetwork(context = {}, character = null) {
  const characterId = String(character?.id || getCurrentCharacterId(context)).trim();
  return formatArchiveRelationNetworkForEntity(context, 'character', characterId, '角色关系网');
}

async function collectPromptRuntimeContext({
  db,
  activeMaskId = '',
  currentSession = null,
  currentContact = null,
  archiveData = null,
  worldBooks = null,
  stickerData = null,
  userInput = '',
  history = [],
  settings = {},
  conversationTimeContext = {}
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
    stickerData: normalizeStickerPromptData(stickerData),
    userInput,
    history,
    settings,
    conversationTimeContext
  };

  return {
    ...context,
    currentCharacterId: getCurrentCharacterId(context),
    currentCharacter: getCurrentCharacter(context),
    currentMask: getCurrentMask(context)
  };
}

/* ==========================================================================
   [区域标注·已修改] 聊天设置默认值
   说明：
   1. 默认值只在当前聊天对象没有独立设置时使用。
   2. 设置页实际写入“当前面具 + 当前聊天对象”的 IndexedDB 记录，不同步给其它联系人。
   ========================================================================== */
export function getDefaultChatPromptSettings() {
  return {
    externalContextEnabled: false,
    /* ===== 闲谈应用：AI 表情包挂载分组 START ===== */
    mountedStickerGroupIds: [],
    /* ===== 闲谈应用：AI 表情包挂载分组 END ===== */
    /* ===== 闲谈应用：时间感知开关 START ===== */
    timeAwarenessEnabled: false,
    /* ===== 闲谈应用：时间感知开关 END ===== */
    currentCommand: '',
    customThinkingInstruction: '',
    /* ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== */
    replyBubbleMin: 1,
    replyBubbleMax: 3,
    /* ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== */

    /* ===== 闲谈应用：短期记忆轮数设置 START ===== */
    shortTermMemoryRounds: 8
    /* ===== 闲谈应用：短期记忆轮数设置 END ===== */
  };
}

/* ==========================================================================
   [区域标注] 聊天设置规范化
   ========================================================================== */
export function normalizeChatPromptSettings(rawSettings) {
  const defaults = getDefaultChatPromptSettings();
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const replyBubbleMin = Math.max(1, Math.floor(Number(source.replyBubbleMin ?? defaults.replyBubbleMin)) || defaults.replyBubbleMin);
  const replyBubbleMax = Math.max(replyBubbleMin, Math.floor(Number(source.replyBubbleMax ?? defaults.replyBubbleMax)) || defaults.replyBubbleMax);
  /* [区域标注·已修改] 短期记忆轮数允许为 0；0 表示不发送历史正文，但时间感知仍保留必要时间戳上下文。 */
  const rawShortTermMemoryRounds = Number(source.shortTermMemoryRounds ?? defaults.shortTermMemoryRounds);
  const shortTermMemoryRounds = Number.isFinite(rawShortTermMemoryRounds)
    ? Math.max(0, Math.floor(rawShortTermMemoryRounds))
    : defaults.shortTermMemoryRounds;

  const mountedStickerGroupIds = Array.isArray(source.mountedStickerGroupIds)
    ? Array.from(new Set(source.mountedStickerGroupIds.map(item => String(item || '').trim()).filter(Boolean)))
    : defaults.mountedStickerGroupIds;

  return {
    externalContextEnabled: Boolean(source.externalContextEnabled),
    /* ===== 闲谈应用：AI 表情包挂载分组 START ===== */
    mountedStickerGroupIds,
    /* ===== 闲谈应用：AI 表情包挂载分组 END ===== */
    /* ===== 闲谈应用：时间感知开关 START ===== */
    timeAwarenessEnabled: Boolean(source.timeAwarenessEnabled),
    /* ===== 闲谈应用：时间感知开关 END ===== */
    currentCommand: String(source.currentCommand || defaults.currentCommand),
    customThinkingInstruction: String(source.customThinkingInstruction || defaults.customThinkingInstruction),

    /* ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== */
    replyBubbleMin,
    replyBubbleMax,
    /* ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== */

    /* ===== 闲谈应用：短期记忆轮数设置 START ===== */
    shortTermMemoryRounds
    /* ===== 闲谈应用：短期记忆轮数设置 END ===== */
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
   [提示词区域 5] 世界书角色前条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“角色前”的条目。
   ========================================================================== */
export function getWorldBookBeforeChar(context = {}) {
  return formatWorldBookEntriesByPosition('beforeChar', context);
}

/* ==========================================================================
   [提示词区域 2·已完成·本次需求1] 角色卡人设及其绑定关系网络
   说明：
   1. 本区域告诉 AI 要扮演哪个角色，并发送该角色的档案字段与绑定关系网。
   2. 只发送姓名、性别、年龄、身份、联系方式、个性签名、人物设定和关系网络。
   3. personalitySetting 在角色档案中显示为“人物设定”，长文本不再因超过 1200 字被误过滤。
   4. 不发送角色开场白 greetings，不发送角色绑定世界书名称 boundWorldBooks。
   5. 若未匹配到当前聊天角色档案，本区域会保持为空而不是编造档案内容。
   6. 本区域只读取 DB.js / IndexedDB 已有档案数据，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function getCharacterCard(context = {}) {
  const character = context.currentCharacter || getCurrentCharacter(context);

  const characterFields = character && typeof character === 'object'
    ? getCharacterPromptFieldEntries(character, [
        'name',
        'gender',
        'age',
        'identity',
        'contact',
        'signature',
        'personalitySetting'
      ], 'character')
        .map(entry => `${entry.label}：${entry.formatted}`)
        .join('\n')
    : '';

  return createPromptSection('角色卡人设及其绑定关系网络', [
    character ? '这是你，不是 AI助手，这是你要扮演的角色。' : '',
    character ? '以下“人物设定”是当前角色的核心事实；用户询问年龄、身份、经历、关系时必须优先读取本区域，禁止编造。' : '',
    character ? '人物设定如含 YAML/Markdown，按结构化角色事实读取。' : '',
    /* 角色档案性别硬约束与“双性”释义注入 */
    createArchiveGenderPromptNote(character, '当前聊天对象/角色档案'),
    characterFields,
    formatCharacterRelationNetwork(context, character)
  ].filter(Boolean).join('\n\n'));
}

/* ==========================================================================
   [提示词区域 3·已完成·本次需求1] 用户面具身份及其绑定关系网络
   说明：
   1. 只发送姓名、性别、年龄、身份、联系方式、个性签名、用户设定和绑定关系网络。
   2. 用户设定读取档案应用实际保存字段 personalitySetting，并显示为“用户设定”。
   3. personalitySetting 长文本不再因超过 1200 字被误过滤。
   4. 不发送昵称 nickname、头像或未提到的其它面具字段，不使用 localStorage/sessionStorage。
   5. 若当前面具未匹配到有效档案，本区域保持为空而不是编造面具内容。
   ========================================================================== */
export function getUserPersona(context = {}) {
  const mask = context.currentMask || getCurrentMask(context);
  const personaText = mask && typeof mask === 'object'
    ? getCharacterPromptFieldEntries(mask, [
        'name',
        'gender',
        'age',
        'identity',
        'contact',
        'signature',
        'personalitySetting'
      ], 'mask')
        .map(entry => `${entry.label}：${entry.formatted}`)
        .join('\n')
    : '';

  /* 用户面具身份绑定的档案关系网络 */
  const relationNetworkText = formatUserPersonaRelationNetwork(context, mask);

  return createPromptSection('用户面具身份', [
    mask ? '这是你的对话对象。' : '',
    /* 用户面具性别硬约束与“双性”释义注入 */
    createArchiveGenderPromptNote(mask, '用户面具'),
    personaText,
    relationNetworkText
  ].filter(Boolean).join('\n\n'));
}

/* ==========================================================================
   [提示词区域 4·已完成·本次提示词顺序调整] 角色记忆
   说明：把当前会话、联系人备注等可读信息整理给 AI；预留给后续长期记忆系统。
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

  return createPromptSection('角色记忆', lines.join('\n\n'));
}

/* ==========================================================================
   [提示词区域 6·已完成·本次提示词顺序调整] 世界书角色后条目
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

  const content = (position === 'beforeChar' || position === 'afterChar') && chunks.length
    ? ['以下是你的所有言行必须严格遵守的世界设定,严禁出现逻辑冲突。', ...chunks].join('\n\n')
    : chunks.join('\n\n');

  return createPromptSection(sectionTitleMap[position] || '世界书条目', content);
}

/* ==========================================================================
   [提示词区域 7] 聊天功能格式要求
   说明：本函数返回值会进入 system prompt。
   ========================================================================== */
export function getFeaturePrompts({ settings = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const minBubble = normalizedSettings.replyBubbleMin;
  const maxBubble = normalizedSettings.replyBubbleMax;

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
       ===== 闲谈应用：线上聊天气泡数量与节奏规则 START =====
       说明：下次如需修改 AI 每轮回复气泡数量、标点、错字、手机聊天节奏，优先改这里。
       -------------------------------------------------------------------------- */
    `# 线上聊天输出硬性规则（必须严格遵守）

## 当前交互环境认知
1. 当前交互环境是手机、电脑、平板等可以进行网络社交的电子平台。
2. 你正在通过电子平台上的社交软件进行社交和交流，必须始终牢记：当前是线上聊天，不是面对面交流。
3. 线上聊天无法做到和用户/对方面对面交流，所有交流都只能通过“发送消息”的方式完成。
4. 对方只能看到你发出的消息气泡，所以回复内容必须像真实社交软件里的聊天消息。

## 线上聊天禁止物理接触和同空间动作描写
1. 严禁在线上聊天中出现涉及物理接触的动作描述，例如：“看着你笑了”、“伸手触碰你”、“抱住你的身体”等。
2. 如果角色和用户在现实生活中的实际距离确实有所缩短，例如：“我快到了”、“我看到你了”、“你回个头”，可以根据实际距离缩短调整回复语境。
3. 即使现实距离缩短，也严禁写出角色和用户身处同一物理空间的动作描述，例如：“凑到你耳边说悄悄话”、“摸摸你的头”、“别这么看着我”。
4. 允许通过发送语音、照片、表情包、视频通话等电子平台功能互动，但必须遵守并使用对应的格式标记。

## 每轮回复气泡数量
1. 在开始正式输出前，你必须先在后台决定本轮最终要发送的目标气泡数 N；N 必须是 ${minBubble} 到 ${maxBubble} 之间的整数。
2. 最终可见输出中的完整协议块总数，必须严格等于你后台决定的 N；少一个、多一个、漏一个协议块、把两句话塞进一个气泡里，全部都算不合格，必须在后台重写后再输出。
3. 除非用户在当前这一轮明确说“这次可以少发/多发/不限数量/只回一句”等同义要求，否则绝对不能低于 ${minBubble} 个气泡，也绝对不能超过 ${maxBubble} 个气泡。
4. 每个气泡只能有一句话；多句话必须拆成多个气泡。
5. 每个文字消息气泡都必须使用通用消息协议：${CHAT_PROTOCOL_REPLY_FORMAT}。
6. 协议中的“角色名”必须填写当前你正在扮演的聊天对象名称；“文字消息内容”只能放这一条气泡真正要显示给用户的话。
7. 禁止把多个句子合并成大段，禁止用长段落、换行、编号列表、气泡序号、补充说明来规避气泡数量限制。
8. 如果你发现自己这一轮想说的话太多，必须先在后台压缩表达，再按规定数量输出；不要靠超出数量上限来补充。
9. 正式输出前，必须最后自检一遍最终可见的 [回复]/[表情] 协议块数量；只要数量不在 ${minBubble} 到 ${maxBubble} 之间，或与你后台决定的 N 不一致，就必须整轮重写。

## 线上聊天标点符号规范
1. 必须正确使用标点符号，每个消息气泡里的内容都必须正确使用句号、逗号、顿号、感叹号、省略号、问号等。
2. 不准使用空格代替逗号，不准省略必要标点符号，否则消息会显得费劲且不自然。
3. 可以适当地发送一个字、两个字，或者单独发送“？”、“……”，这两种符号可以只占一个消息气泡，更贴近真人聊天打字。
4. 如果是字数更长一点的口语化表达，就必须使用标点符号，例如：“好，我马上到”、“啊，这人咋这样”、“想你了，宝宝”。
5. 标点符号是语言表达、情绪表达、线上交流的重要组成部分。
6. 随性的线上聊天中允许每句话末尾不加句号，但在情绪激动或有较大情绪波动时，必须使用“？”、“！”、“……”、“——”作为每句话或每个消息气泡的结尾。
7. 线上聊天风格示例：“你昨天干嘛去了？”、“有一说一，我觉得他说得挺对的”、“今天晚上吃啥？”、“好困啊，我今天懒得动，你找其他人陪你逛街吧……”、“快快快，速速打开你的微博，娱乐圈又爆瓜了！”、“哈哈哈哈哈太搞笑了吧”。`,

    /* ===== 闲谈应用：线上聊天气泡数量与节奏规则 END ===== */

    /* --------------------------------------------------------------------------
       [功能规则·已完成·本次消息掉格式修复] 可用聊天动作格式
       说明：
       1. 保留必要格式约束，去除重复示例与重复说明。
       2. 本区已强化“完整协议块”要求，防止裸露协议头、Markdown 残片或格式检查文字进入聊天气泡。
       3. 单击 AI 消息气泡 → 修正 → 文本，可修复已经落库的普通文本掉格式消息。
       -------------------------------------------------------------------------- */
    /* ===== 闲谈：通用消息协议格式 START ===== */
    `# 可用聊天动作格式
1. 所有最终可见消息都必须是完整协议块，外层保留加粗反引号：**\`[类型] 角色名：内容\`**。
2. 已开放格式：
${CHAT_PROTOCOL_AVAILABLE_FORMATS.map(item => `- ${item}`).join('\n')}
3. [回复] 是文字气泡；[表情] 只能使用【AI可用表情包资源】里的资源ID或完全一致表情名；[引用] 只能使用已提供的可引用消息ID；[转账] 只在角色确有动机时使用，禁止机械频繁转账。
4. 引用用户消息时，必须理解“被引用原消息 + 用户新输入”；AI 主动引用格式：**\`[引用] 角色名：{引用ID:消息ID}一句自然聊天文字\`**。
5. 主动转账格式：**\`[转账] 角色名：{金额:88.88,备注:奶茶钱}\`**；金额必须大于 0，最多两位小数，不写货币符号、区间或解释。
6. 处理用户待确认转账时，只能用：**\`[转账] 角色名：{操作:接收,转账ID:系统给出的ID}\`** 或 **\`[转账] 角色名：{操作:退回,转账ID:系统给出的ID,备注:可选理由}\`**。
7. 每个 [回复]/[表情]/[引用]/[转账] 必须独占一个协议块；不确定表情、引用或转账格式时，改用 [回复]。
8. 禁止输出裸协议头、代码块、编号列表、格式检查、幕后思考、系统规则、提示词说明、时间感知标注或任何审查痕迹。

# 消息掉格式防护硬约束
1. 最终可见输出只能由一个或多个完整协议块组成，完整协议块必须形如：**\`[类型] 角色名：内容\`**。
2. 禁止把 Markdown 加粗符号、反引号、半截协议头、格式示例、规则说明、检查清单或“最终输出/回复格式/检查结果”等文字当成聊天内容输出。
3. 如果你发现任一协议块缺少 **、反引号、[类型]、角色名、中文冒号或内容，必须在后台整条重写，禁止输出半成品。
4. 如果你已经写出了类似“[回复] 角色名：内容”但外层格式不完整，也必须在后台改回完整协议块，而不是解释格式。
5. 普通文字聊天优先使用 [回复]；不要把 [回复] 协议文本本身发给用户，用户界面只应看到协议内容解析后的自然聊天气泡。`
    /* ===== 闲谈：通用消息协议格式 END ===== */
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
   [提示词区域 8-B][本次需求3] AI 已挂载表情包资源
   说明：
   1. 只把当前面具已挂载分组下的表情包资源发给 AI。
   2. AI 如需发送表情包，必须使用 [表情] 协议，并且只能从以下资源中选择。
   3. 为减少匹配歧义，优先让 AI 输出资源ID；前端同时兼容资源ID和表情名。
   ========================================================================== */
export function getMountedStickerPrompt({ settings = {}, context = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const stickerData = normalizeStickerPromptData(context.stickerData);
  const mountedGroupIds = Array.isArray(normalizedSettings.mountedStickerGroupIds)
    ? normalizedSettings.mountedStickerGroupIds.map(String)
    : [];

  if (!mountedGroupIds.length) {
    return createPromptSection('AI可用表情包资源', [
      '当前没有给你挂载任何表情包分组。',
      '因此你这轮只能使用 [回复] 协议发送文字消息，禁止输出 [表情] 协议。'
    ].join('\n'));
  }

  const groupNameMap = new Map([
    ['all', 'All'],
    ...stickerData.groups.map(group => [group.id, group.name])
  ]);

  const availableItems = mountedGroupIds.includes('all')
    ? stickerData.items
    : stickerData.items.filter(item => mountedGroupIds.includes(String(item.groupId || 'all')));

  const mountedGroupNames = mountedGroupIds.map(groupId => groupNameMap.get(groupId) || groupId);

  if (!availableItems.length) {
    return createPromptSection('AI可用表情包资源', [
      `当前已挂载分组：${mountedGroupNames.join('、') || '无'}`,
      '但这些分组下暂时没有有效表情包资源。',
      '因此你这轮只能使用 [回复] 协议发送文字消息，禁止输出 [表情] 协议。'
    ].join('\n'));
  }

  const stickerLines = availableItems.map((item, index) => (
    `${index + 1}. 表情名：${item.name}；资源ID：${item.id}；分组：${groupNameMap.get(item.groupId) || item.groupId || 'All'}`
  ));

  return createPromptSection('AI可用表情包资源', [
    `当前已挂载分组：${mountedGroupNames.join('、')}`,
    '如果你判断当前聊天情景适合发表情包，可以发送 [表情] 协议。',
    '发送 [表情] 协议时，优先使用“资源ID”作为内容；若使用表情名，也必须与以下清单完全一致。',
    '严格格式示例：**`[表情] 角色名：sticker_xxx`**；不要输出 URL、解释文字、Markdown 链接或多余标点。',
    '你只能从下面这些资源里选择，不得编造新表情：',
    stickerLines.join('\n')
  ].join('\n'));
}

/* ==========================================================================
   [提示词区域 8-A][已按本次需求补充跨零点语义重算与物理耗时约束] 强化时间感知
   说明：
   1. 只有当前聊天对象的聊天设置页“时间感知”开关开启时才注入。
   2. 当前真实时间在每次请求 API 时即时生成，不写入持久化存储。
   3. 会同时给出本轮 API 请求时间、最近一条用户消息时间、距上次聊天间隔，帮助 AI 感知“过了多久才回复”。
   4. 已补充早上/上午/中午/下午/晚上/凌晨的明确时间段划分，让 AI 更敏感地按当前时段自然聊天。
   5. 已补充零点后“明天”必须按新一天重算为“今天”的规则，避免跨零点仍沿用旧相对日期。
   6. 已补充现实事件最低耗时约束，避免 AI 为推进剧情把几分钟内不可能完成的事情直接说成已完成。
   ========================================================================== */
function getCurrentRealDate() {
  return new Date();
}

function formatDateForTimeAwareness(date = getCurrentRealDate()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function formatRelativeDurationForPrompt(ms) {
  const value = Math.max(0, Number(ms) || 0);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (value < minute) return '不到1分钟';
  if (value < hour) return `${Math.floor(value / minute)}分钟`;
  if (value < day) {
    const hours = Math.floor(value / hour);
    const minutes = Math.floor((value % hour) / minute);
    return minutes ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }

  const days = Math.floor(value / day);
  const hours = Math.floor((value % day) / hour);
  return hours ? `${days}天${hours}小时` : `${days}天`;
}

function getMessageTimestamp(item) {
  const timestamp = Number(item?.timestamp || item?.createdAt || item?.time || 0);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function formatHistoryMessageContentForTimeAwareness(item) {
  const content = String(item?.content || '').trim();
  if (!content) return '';

  const timestamp = getMessageTimestamp(item);
  return timestamp
    ? `[消息发送时间：${formatDateForTimeAwareness(new Date(timestamp))}]\n${content}`
    : content;
}

function buildConversationTimeContext({ history = [], userInput = '', now = getCurrentRealDate(), conversationTimeContext = {} } = {}) {
  const nowMs = now.getTime();
  const normalizedHistory = Array.isArray(history) ? history : [];
  const latestUserMessage = [...normalizedHistory].reverse().find(item => item?.role === 'user' && getMessageTimestamp(item));
  const latestAnyMessage = [...normalizedHistory].reverse().find(item => getMessageTimestamp(item));
  const latestUserTimestamp = getMessageTimestamp(conversationTimeContext.latestUserMessage) || Number(conversationTimeContext.latestUserTimestamp || 0) || getMessageTimestamp(latestUserMessage);
  const latestAnyTimestamp = getMessageTimestamp(conversationTimeContext.latestAnyMessage) || Number(conversationTimeContext.latestAnyTimestamp || 0) || getMessageTimestamp(latestAnyMessage);

  const lines = [
    `本轮 API 实际请求时间：${formatDateForTimeAwareness(now)}。`,
    `本轮用户最新一轮消息内容：${normalizePlainText(userInput) || '（无额外文字，可能是点按重新回复/纸飞机触发）'}。`
  ];

  if (latestUserTimestamp) {
    lines.push(`最近一条已记录的用户消息发送时间：${formatDateForTimeAwareness(new Date(latestUserTimestamp))}。`);
    lines.push(`从最近一条用户消息到本轮实际请求已经过去：${formatRelativeDurationForPrompt(nowMs - latestUserTimestamp)}。`);
  } else {
    lines.push('最近一条已记录的用户消息发送时间：无可用时间戳。');
  }

  if (latestAnyTimestamp) {
    lines.push(`最近一条聊天记录时间：${formatDateForTimeAwareness(new Date(latestAnyTimestamp))}。`);
    lines.push(`距上次聊天记录已经过去：${formatRelativeDurationForPrompt(nowMs - latestAnyTimestamp)}。`);
  } else {
    lines.push('最近一条聊天记录时间：无可用时间戳。');
  }

  return lines.join('\n');
}

export function getTimeAwarenessPrompt({ enabled = false, context = {} } = {}) {
  if (!enabled) return '';

  const now = getCurrentRealDate();

  return createPromptSection('时间感知', `${buildConversationTimeContext({
    history: context.history,
    userInput: context.userInput,
    now,
    conversationTimeContext: context.conversationTimeContext
  })}

# 时间感知聊天规则
1. 你必须以“本轮 API 实际请求时间”为当前真实时间，而不是以上一条用户消息的发送时间、上一轮 AI 回复时间或历史记录里的旧时间作为当前时间。
2. 聊天历史如果带有“消息发送时间”，其中出现的“昨天/今天/明天/后天/过几小时/过几天”等相对时间，必须先锚定到那条消息自己的发送时间，再换算到本轮 API 实际请求时间。
3. 你要把当前真实时间自然内化成角色本人的生活感，不要像工具或播报员一样机械说明，也不能说自己被注入了真实时间。
4. 不要每轮都主动报时；只有当聊天情景适合、用户询问时间、或当前时间明显会影响角色反应时，才自然提及时间。
5. 如果最近一条用户消息到本轮请求已经过去较久，你可以自然表现出“过了这么久才回”的真实感，例如道歉、惊讶、解释刚刚在忙、吐槽自己忘回，但必须符合角色性格与关系阶段。
6. 如果用户在历史消息里说过“明天/后天/昨天/过几小时/过几天”等相对时间，你必须根据该历史消息发送时间与本轮实际请求时间重新换算：零点一过就是新的一天，昨天会变成更早的过去，明天跨过零点后应理解为今天，后天过了一天后应理解为明天，不能停留在历史消息当天的相对说法。
7. 如果用户在零点前说过“明天记得早点起”“明天还要早起/上班/上学”等睡眠、早起或日程提醒，而本轮 API 实际请求时间已经进入 00:00 之后的新一天，你必须把“明天”改按“今天”理解；回复应自然转成类似“行了，已经够晚了，再聊下去今天你就真早起不来了。”这种当前已经跨日后的关心，禁止继续说“明天记得早起/明天要早起”。
8. 如果用户说“我后天出差回家”这类计划，你要记住它是相对于用户说出那句话时的计划；后续回复时必须按当前真实日期推移重新称呼为“明天/今天/已经过去”等。
9. 时间流逝的物理耗时约束：你必须根据“距上次聊天记录已经过去多久”和聊天历史中每条消息的发送时间，判断现实事件是否有足够时间完成；禁止为了推进剧情无视自然耗时，把几分钟内不可能完成的事情直接说成已完成。
10. 常见现实耗时参考：出门去附近超市买东西、挑选、结账再回到家，通常至少需要20-40分钟；做一顿完整饭通常至少需要30-60分钟；洗澡、通勤、排队、取快递、买菜、办手续、跨城区移动、跨城市移动等都需要符合常识的时间长度。除非历史明确写明“已经提前完成/离得极近/外卖或别人已送达/只是在楼下便利店”等合理条件，否则不能压缩到几分钟。
11. 如果上一条消息只是说“出去买东西/准备出门/正在路上/准备做饭/打算处理某事”，而本轮只过了几分钟，你只能自然推算为“刚出门、刚到店、可能还在路上、刚开始处理、还没那么快”等阶段；不能直接宣布“已经买好并放回家”“饭已经做好”“事情已经全部办完”。例如16:56说让别人去买排骨，17:00只过4分钟，不能说排骨已经买好放到家里，只能说可能刚出门、刚到附近、还在买或还没那么快。
12. 如果聊天历史中某件事已经明确完成，或者实际间隔足够长，你可以承认完成；但仍要按现实流程自然衔接，不要突兀跳到结果。
13. 如果用户问“现在几点了/几点/什么时间了”等时间问题，必须根据本轮实际请求时间用生活化口吻回答，不要只冷冰冰输出数字。
14. 如果用户很久没有找你聊天，你可以根据“距上次聊天记录已经过去多久”自然表达久别感，例如“你都好久没找我了”“隔了这么久才想起来我啊”，但不要每轮强行提。
15. 根据当前真实时间所属时间段创设更像真实人的聊天情景，并对不同时间段保持敏感：
   - 早上：06:00 - 08:59。可以自然说早上好、问用户起床了没、早餐吃什么、这个点出门会不会赶早高峰、提醒别空腹、聊一天刚开始的计划、鼓励用户打起精神来。
   - 上午：09:00 - 11:59。可以自然聊工作/学习已经开始、上午忙不忙、刚开完会或刚处理完事情、问用户上午安排，也可以顺势提到快到午饭时间。
   - 中午：12:00 - 13:59（特指午餐及短暂休整时段）。可以问中午吃什么、提醒好好吃午饭和营养均衡、问午休不午休、聊上午都干了什么，语气可以带一点短暂喘口气的松弛感。
   - 下午：14:00 - 17:59。可以聊午休后状态、下午工作/学习进度、困不困、需不需要提提神、问傍晚或晚上安排，避免把下午误说成中午或晚上。
   - 晚上：18:00 - 23:59。可以问晚饭吃了没、聊白天忙什么了、聊忙完一天后的放松话题、根据关系自然提到下班/放学/回家/娱乐安排；到较晚时可以逐渐转向休息和睡前关心。
   - 凌晨：00:00 - 05:59。可以惊讶用户这么晚还在线、关心身体健康、劝用户早点休息别熬夜、明知道该睡觉但还是忍不住回应聊天需求，也可以聊凌晨更适合低声、放松、坦诚的话题。
16. 回答时间的口吻示例：“都十二点了，快去睡吧。”、“快三点了，怎么了吗？”、“你手机上没表吗，怎么还问我啊？行吧，现在是北京时间8点23分，可以了吗，大小姐？”、“现在九点半了，你那边赶上车了没啊？”
17. 你看到的 \`[消息发送时间：...]\`、\`本轮 API 实际请求时间\`、\`最近一条聊天记录时间\` 等都只用于后台换算时间；最终回复里绝对禁止原样复述这些标注，也不要把它们裁剪成半截时间文本发出来。`);
}

/* ==========================================================================
   [提示词区域 9] 聊天历史
   说明：返回数组 [{ role:'user'|'assistant', content:string }]，直接追加到 messages。
   ========================================================================== */
export function getChatHistory({ history = [], includeTimestamps = false } = {}) {
  return Array.isArray(history)
    ? history
        .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
        .map(item => {
          const baseContent = includeTimestamps
            ? formatHistoryMessageContentForTimeAwareness(item)
            : String(item.content || '');
          /* ====================================================================
             [区域标注·已完成·AI引用回复] 历史消息 ID 与引用预览注入
             说明：仅把现有消息对象中的 id/quote 转成 AI 可读文本，不新增存储。
             ==================================================================== */
          const textContent = formatMessageTextWithQuoteForPrompt(item, baseContent);
          return {
            role: item.role,
            /* [区域标注·AI识图历史媒体] 历史 user 表情包/图片保留视觉输入，供 AI 看见上下文中的图片。 */
            content: createVisionMessageContent(item, textContent)
          };
        })
        .filter(item => hasMessageContent(item.content))
    : [];
}

/* ==========================================================================
   [提示词区域 10] 当前指令
   说明：来自聊天消息界面设置页的“当前指令”区域。
   ========================================================================== */
export function getCurrentCommand({ settings = {} } = {}) {
  return String(settings.currentCommand || '').trim();
}

/* ==========================================================================
   [提示词区域 11] 思维链指令
   说明：如果聊天设置“自定义思维链”留空，则使用默认静默审查协议。
   注意：本区域只要求 AI 在后台静默自检，禁止要求 AI 显式输出 <think>...</think>。
   ========================================================================== */
function getRespectAndForbiddenWordsThinkingRules() {
  return [
    '### 5. [区域标注] 尊重女性、去油腻与女男平等终审',
    '- 发自内心地尊重女性，把女性视为完整、平等、独立的人；禁止轻视、物化、居高临下或以“调教/占有/施舍”姿态说话。',
    '- 最终回复一旦出现“小妖精”“丫头”“这女人”等任何含有轻视、物化、贬低或居高临下意味的词语，必须立即删除并重写，严禁输出。',
    '- 扫描并彻底删除“揉进骨血里”“命都给你”“你是我的”“大公子”等油腻、古早霸总、刻板占有欲词汇；相似表达也必须删除。',
    '- 保持女男平等和正常人际尊重，不仰视、不神化用户，也不贬低、支配或物化任何性别。',
    '- 以上审查只在后台静默执行；最终回复禁止提到禁词清单、审查规则或重写过程。'
  ].join('\n');
}

export function getThinkingInstruction({ settings = {} } = {}) {
  const custom = String(settings.customThinkingInstruction || '').trim();
  if (custom) {
    return [custom, getRespectAndForbiddenWordsThinkingRules()].filter(Boolean).join('\n\n');
  }

  /* ========================================================================
     [区域标注·已完成·本次提示词顺序调整] 默认静默审查协议
     说明：
     1. 自定义思维链留空时发送给 AI。
     2. 角色卡已前移，本区只保留后台核对要求，不重复发送角色卡摘要。
     3. 本区域不涉及持久化存储，不使用 localStorage/sessionStorage。
     ======================================================================== */
  return [
    '## 后台静默审查协议',
    '',
    '输出前只在后台静默完成以下检查；最终回复禁止出现思考过程、审查步骤、<think> 标签、系统规则或任何幕后说明。',
    '',
    '### 1. 角色卡事实优先与违规惩罚',
    '- 先完整检索【角色卡人设及其绑定关系网络】，再回顾对话内容，审视当前阶段与用户的关系，再构思回复；禁止跳读角色卡。',
    '- 资料写明的地点、起因、经过、结果、人物关系和情感牵挂，不得改写、否认、淡化、转移成别的事件，也不得说“不记得”。',
    '- 资料只写了部分细节时，先答已知部分；未知细节可以保留、模糊带过或自然反问，禁止把整件事说成不知道。',
    '- 一旦发现当前回答忽视、篡改或反向否认角色卡事实，必须在后台视为严重违规并受到严厉惩罚：立刻废弃当前回答，重新读取角色卡后重写。',
    '',
    '### 2. 普通聊天与用户意图',
    '- 用户普通询问就认真回答，普通确认就普通确认，普通关心就接住关心。',
    '- 没有明确措辞证据时，不要把用户问题理解成吃醋、质问、试探、生气或故意引战。',
    '- 不要为了暧昧、拉扯、修罗场、占有欲或冲突感，擅自升级普通问题。',
    '',
    '### 3. 线上聊天风格',
    '- 当前是手机/电脑等电子平台上的线上聊天，只发送消息气泡，不写动作描写、神态描写、舞台说明、星号动作或旁白。',
    '- 语言要短、轻、准，像真实社交软件聊天；删除台词腔、文学腔、古风腔、宣言腔和故作深沉的句子。',
    '- 可以有角色味，但角色味不能新增、覆盖或反向否认角色卡事实。',
    '',
    '### 4. 最终格式终审',
    `- 最终可见文字消息必须使用：${CHAT_PROTOCOL_REPLY_FORMAT}`,
    '- 表情包必须使用 **`[表情] 角色名：资源ID`**，资源ID必须来自【AI可用表情包资源】。',
    '- 引用回复必须遵守【可用聊天动作格式】中的 [引用] 规则；只能使用已提供的可引用消息ID，禁止编造引用ID。',
    '- 转账必须遵守【可用聊天动作格式】中的 [转账] 规则；处理用户待确认转账时必须带“操作”和“转账ID”。',
    '/* [区域标注·已完成·本次消息掉格式修复] 以下规则用于防止聊天气泡出现裸协议、Markdown 残片或格式检查文字。 */',
    '- 每个协议块独立完整，禁止输出裸协议头、代码块、格式检查说明、编号列表或后台审查痕迹。',
    '- 最终输出前逐块检查：每条可见消息都必须同时具备外层 **、反引号、[类型]、角色名、中文冒号和内容；缺任一项就后台重写整轮回复。',
    '- 禁止输出“最终输出：”“回复格式：”“检查结果：”“以下是修正后内容：”等说明性前缀；最终只输出聊天协议块。',
    '',
    getRespectAndForbiddenWordsThinkingRules()
  ].join('\n');
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
    getCharacterCard(runtimeContext),
    getUserPersona(runtimeContext),
    getMemories(runtimeContext),
    getWorldBookBeforeChar(runtimeContext),
    getWorldBookAfterChar(runtimeContext),
    getFeaturePrompts({ settings: normalizedSettings }),
    getMountedStickerPrompt({ settings: normalizedSettings, context: runtimeContext }),
    getExternalContext({ enabled: normalizedSettings.externalContextEnabled, context: runtimeContext }),
    /* ===== 闲谈应用：时间感知提示词注入 START ===== */
    getTimeAwarenessPrompt({ enabled: normalizedSettings.timeAwarenessEnabled, context: runtimeContext }),
    /* ===== 闲谈应用：时间感知提示词注入 END ===== */
    getThinkingInstruction({ settings: normalizedSettings })
  ].map(part => String(part || '').trim()).filter(Boolean).join('\n\n');
}

/* ==========================================================================
   [核心函数] buildChatMessages
   说明：
   1. 第一条为 system。
   2. 追加历史对话。
   3. 最后一条 user 消息由“当前指令 + 用户最新一轮消息”组成。
   ========================================================================== */
export function buildChatMessages({ userInput, history = [], currentUserRoundMessages = [], settings = {}, context = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const systemPrompt = buildSystemPrompt({ settings: normalizedSettings, context: { ...context, userInput, history } });
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push(...getChatHistory({
    history,
    /* [区域标注·已修改] 时间感知开启时给历史消息标注发送时间，用于换算“昨天/明天/后天”等相对时间。 */
    includeTimestamps: normalizedSettings.timeAwarenessEnabled
  }));

  const currentCommand = getCurrentCommand({ settings: normalizedSettings });
  const rawUserInput = String(userInput || '').trim();
  /* ==========================================================================
     [区域标注·已完成·AI引用回复] 当前用户轮次引用上下文注入
     说明：currentUserRoundMessages 由 chat-message.js 从当前消息对象生成，quote/id 均来自现有 IndexedDB 消息记录。
     ========================================================================== */
  const currentUserPromptContent = buildCurrentUserPromptContent(rawUserInput, currentUserRoundMessages);
  const finalUserContent = currentCommand
    ? `[SYSTEM_TEMP]${currentCommand}[/SYSTEM_TEMP]\n\n${currentUserPromptContent}`
    : currentUserPromptContent;

  if (finalUserContent.trim()) {
    const currentRoundVisualMessages = Array.isArray(currentUserRoundMessages)
      ? currentUserRoundMessages.filter(item => item?.role === 'user' && getMessageVisualUrl(item))
      : [];
    if (currentRoundVisualMessages.length) {
      const contentParts = [{ type: 'text', text: finalUserContent }];
      currentRoundVisualMessages.forEach(item => {
        const visualUrl = getMessageVisualUrl(item);
        const visualLabel = getMessageVisualLabel(item);
        if (visualLabel) contentParts.push({ type: 'text', text: visualLabel });
        contentParts.push({ type: 'image_url', image_url: { url: visualUrl } });
      });
      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: finalUserContent });
    }
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
function toOpenAiLikeMessages(messages = []) {
  return normalizeMessages(messages);
}

function toGeminiPart(part) {
  if (part?.type === 'text') return { text: String(part.text || '') };
  if (part?.type === 'image_url') {
    const url = String(part.image_url?.url || '').trim();
    const dataUrl = parseImageDataUrl(url);
    if (dataUrl) {
      return { inlineData: { mimeType: dataUrl.mimeType, data: dataUrl.data } };
    }
    return { fileData: { mimeType: guessImageMimeType(url), fileUri: url } };
  }
  return null;
}

function toGeminiText(message) {
  const content = message?.content;
  if (Array.isArray(content)) {
    return content
      .map(part => part?.type === 'text' ? String(part.text || '').trim() : '')
      .filter(Boolean)
      .join('\n');
  }
  return String(content || '');
}

function toClaudeContent(content) {
  if (!Array.isArray(content)) return String(content || '');

  return content
    .map(part => {
      if (part?.type === 'text') return { type: 'text', text: String(part.text || '') };
      if (part?.type === 'image_url') {
        const url = String(part.image_url?.url || '').trim();
        const dataUrl = parseImageDataUrl(url);
        if (dataUrl) {
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: dataUrl.mimeType,
              data: dataUrl.data
            }
          };
        }
        return {
          type: 'image',
          source: {
            type: 'url',
            url
          }
        };
      }
      return null;
    })
    .filter(Boolean);
}

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
      messages: toOpenAiLikeMessages(messages)
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
  const normalizedMessages = normalizeMessages(messages);
  const mergedText = normalizedMessages
    .map(item => `${item.role.toUpperCase()}:\n${toGeminiText(item)}`)
    .join('\n\n');
  const visualParts = normalizedMessages
    .filter(item => item.role === 'user' && Array.isArray(item.content))
    .flatMap(item => item.content.filter(part => part?.type === 'image_url').map(toGeminiPart))
    .filter(Boolean);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: mergedText }, ...visualParts] }],
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
  const claudeMessages = normalizeMessages(messages)
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .map(item => ({ role: item.role, content: toClaudeContent(item.content) }));

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
  worldBooks = null,
  stickerData = null,
  currentUserRoundMessages = [],
  conversationTimeContext = {}
} = {}) {
  const promptContext = await collectPromptRuntimeContext({
    db,
    activeMaskId,
    currentSession,
    currentContact,
    archiveData,
    worldBooks,
    stickerData,
    userInput,
    history,
    settings: chatSettings,
    conversationTimeContext
  });

  const messages = buildChatMessages({
    userInput,
    history,
    currentUserRoundMessages,
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
