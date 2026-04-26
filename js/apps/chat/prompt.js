/**
 * 文件名: js/apps/chat/prompt.js
 * 用途: 闲谈应用 — 提示词组装与聊天 API 调用模块
 * 说明:
 * 1. 本模块只读取项目 Settings/DB.js（IndexedDB）中的设置与聊天上下文。
 * 2. 禁止使用浏览器同步键值存储，也不写双份存储兜底逻辑。
 * 3. 所有提示词区域均用明显注释分隔，便于后续针对性修改。
 * 4. 当前阶段大部分上下文函数按需求返回空字符串，并保留 TODO。
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
   TODO：后续从世界书应用 IndexedDB 数据中读取并按激活规则筛选。
   ========================================================================== */
export function getWorldBookTop() {
  return '';
}

/* ==========================================================================
   [提示词区域 2] 世界书角色前条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“角色前”的条目。
   TODO：后续从世界书应用 IndexedDB 数据中读取并按激活规则筛选。
   ========================================================================== */
export function getWorldBookBeforeChar() {
  return '';
}

/* ==========================================================================
   [提示词区域 3] 角色卡人设
   说明：角色卡具体人设以及所绑定的关系网络信息。
   TODO：后续从档案应用角色数据中读取当前聊天对象绑定的角色卡与关系网络。
   ========================================================================== */
export function getCharacterCard() {
  return '';
}

/* ==========================================================================
   [提示词区域 4] 用户面具身份
   说明：角色卡所绑定的用户面具身份。
   TODO：后续从档案应用当前激活用户面具与角色绑定关系中读取。
   ========================================================================== */
export function getUserPersona() {
  return '';
}

/* ==========================================================================
   [提示词区域 5] 角色记忆
   说明：预留给之后“旧事”应用注入角色记忆。
   TODO：后续从旧事/记忆相关 IndexedDB 数据中读取当前角色记忆。
   ========================================================================== */
export function getMemories() {
  return '';
}

/* ==========================================================================
   [提示词区域 6] 世界书角色后条目
   说明：包括全局世界书和角色绑定世界书中已开启/激活且位置为“角色后”的条目。
   TODO：后续从世界书应用 IndexedDB 数据中读取并按激活规则筛选。
   ========================================================================== */
export function getWorldBookAfterChar() {
  return '';
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
       [功能规则·TODO] 可用聊天动作格式
       TODO：以后在这里追加表情包、转账、动作等聊天功能格式要求。
       -------------------------------------------------------------------------- */
    ''
  ].filter(Boolean).join('\n\n');
}

/* ==========================================================================
   [提示词区域 8] 外部应用上下文
   说明：只在聊天设置中开启“外部应用消息注入”时注入。
   TODO：后续从其它应用的 IndexedDB 数据或全局上下文中读取。
   ========================================================================== */
export function getExternalContext({ enabled = false } = {}) {
  if (!enabled) return '';
  return '';
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
export function buildSystemPrompt({ settings = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);

  return [
    getWorldBookTop(),
    getWorldBookBeforeChar(),
    getCharacterCard(),
    getUserPersona(),
    getMemories(),
    getWorldBookAfterChar(),
    getFeaturePrompts(),
    getExternalContext({ enabled: normalizedSettings.externalContextEnabled }),
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
export function buildChatMessages({ userInput, history = [], settings = {} } = {}) {
  const normalizedSettings = normalizeChatPromptSettings(settings);
  const systemPrompt = buildSystemPrompt({ settings: normalizedSettings });
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
   说明：构建 messages 后调用设置应用“主 API”，并返回 AI 最终回复文本。
   ========================================================================== */
export async function chat({
  userInput,
  history = [],
  chatSettings = {},
  settingsManager
} = {}) {
  const messages = buildChatMessages({
    userInput,
    history,
    settings: chatSettings
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
