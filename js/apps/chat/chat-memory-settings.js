// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-memory-settings.js
 * 用途: 闲谈应用 — 聊天设置页“记忆设置”独立 UI 与长期记忆总结模块
 * 架构层: 应用层（闲谈子模块）
 */

import {
  dbPut,
  escapeHtml,
  getCurrentChatPromptSettingsKey,
  renderModalNotice
} from './chat-utils.js';
import { upsertMemoryItem } from '../memory/memory-db.js';

/* ==========================================================================
   [区域标注·已修改·记忆设置独立模块总说明]
   说明：
   1. 本模块负责聊天设置页“记忆设置”板块：短期记忆 UI、长期记忆 UI、长期记忆总结触发与旧事写入。
   2. “长期记忆”已接入：总结轮数保存、自动总结开关、手动总结一次性触发。
   3. 总结只调用设置应用里的副 API 配置，不回退主 API，不写双份请求兜底。
   4. 总结结果通过旧事应用 memory-db.js 写入 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   5. 不使用 alert/confirm/prompt 或浏览器原生选择器；完成提示统一使用闲谈应用内弹窗样式。
   6. 不做长文本字段过滤，不截断持久化字段。
   ========================================================================== */

const ICONPARK_ARROW_RIGHT = `
  <svg viewBox="0 0 48 48" fill="none">
    <path d="M19 12l12 12-12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

const DEFAULT_LONG_TERM_MEMORY_SETTINGS = Object.freeze({
  longTermMemorySummaryRounds: 8,
  longTermMemoryAutoSummaryEnabled: false,
  longTermMemoryManualSummaryEnabled: false,
  longTermMemoryLastAutoSummaryRoundIndex: 0
});

/* ==========================================================================
   [区域标注·已完成·长期记忆设置规范化与持久化]
   说明：
   1. 只规范化长期记忆相关字段，不改动其它聊天设置字段。
   2. 设置写入当前面具 + 当前聊天对象的 chatPromptSettings，经 DB.js / IndexedDB 持久化。
   3. 手动总结开关作为一次性触发按钮使用：运行期间点亮，完成后自动复位为关闭。
   ========================================================================== */
function normalizeLongTermMemorySettings(source = {}) {
  const settings = source && typeof source === 'object' ? source : {};
  const rawRounds = Number(settings.longTermMemorySummaryRounds ?? DEFAULT_LONG_TERM_MEMORY_SETTINGS.longTermMemorySummaryRounds);
  const rawLastAutoRoundIndex = Number(settings.longTermMemoryLastAutoSummaryRoundIndex || 0);

  return {
    longTermMemorySummaryRounds: Number.isFinite(rawRounds)
      ? Math.max(1, Math.floor(rawRounds))
      : DEFAULT_LONG_TERM_MEMORY_SETTINGS.longTermMemorySummaryRounds,
    longTermMemoryAutoSummaryEnabled: Boolean(settings.longTermMemoryAutoSummaryEnabled),
    longTermMemoryManualSummaryEnabled: Boolean(settings.longTermMemoryManualSummaryEnabled),
    longTermMemoryLastAutoSummaryRoundIndex: Number.isFinite(rawLastAutoRoundIndex)
      ? Math.max(0, Math.floor(rawLastAutoRoundIndex))
      : 0
  };
}

function ensureLongTermMemorySettings(state = {}) {
  if (!state.chatPromptSettings || typeof state.chatPromptSettings !== 'object') {
    state.chatPromptSettings = {};
  }

  const normalized = normalizeLongTermMemorySettings(state.chatPromptSettings);
  Object.assign(state.chatPromptSettings, normalized);
  return normalized;
}

async function persistLongTermMemorySettings(state = {}, db = null) {
  await dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
}

/* ==========================================================================
   [区域标注·已完成·长期记忆副 API 请求工具]
   说明：
   1. 只读取 settings.api.secondary；不回退主 API，不做双份请求兜底。
   2. 支持 openai/deepseek/gemini/claude，与设置应用副 API 结构保持一致。
   3. 请求结果只用于生成旧事记忆条目，不写入聊天记录，不使用 localStorage/sessionStorage。
   ========================================================================== */
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
    temperature: Number.isFinite(Number(apiSettings?.global?.temperature)) ? Number(apiSettings.global.temperature) : 0.7,
    maxTokens: Math.max(256, Math.min(2048, Number(apiSettings?.global?.maxTokens || 1024) || 1024))
  };
}

function extractApiErrorMessage(payload, fallback = 'API 请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload?.error?.message || payload?.error?.msg || payload?.message || payload?.detail || fallback;
}

async function requestLongTermMemoryOpenAiLike(profile, messages) {
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
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

function getSecondaryMessageContentText(content) {
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return String(part.text || '');
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(content || '');
}

async function requestLongTermMemoryGemini(profile, messages) {
  const parts = [];
  messages.forEach(item => {
    const roleLabel = item.role === 'system' ? '系统' : '用户';
    parts.push({ text: `${roleLabel}：${getSecondaryMessageContentText(item.content)}\n\n` });
  });

  const url = `${trimSlash(profile.baseUrl)}/models/${encodeURIComponent(profile.model)}:generateContent?key=${encodeURIComponent(profile.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: profile.temperature,
        maxOutputTokens: profile.maxTokens
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  return String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function requestLongTermMemoryClaude(profile, messages) {
  const system = messages
    .filter(item => item.role === 'system')
    .map(item => getSecondaryMessageContentText(item.content))
    .filter(Boolean)
    .join('\n\n');
  const userText = messages
    .filter(item => item.role !== 'system')
    .map(item => getSecondaryMessageContentText(item.content))
    .filter(Boolean)
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
      messages: [{ role: 'user', content: [{ type: 'text', text: userText || '请按要求返回 JSON。' }] }]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  return String(payload?.content?.find?.(item => item?.type === 'text')?.text || payload?.content?.[0]?.text || '').trim();
}

async function requestLongTermMemoryBySecondaryApi(profile, messages) {
  if (!profile.apiKey) throw new Error('副 API Key 不能为空');
  if (!profile.model) throw new Error('请先在设置应用选择副 API 模型');

  if (profile.provider === 'gemini') return requestLongTermMemoryGemini(profile, messages);
  if (profile.provider === 'claude') return requestLongTermMemoryClaude(profile, messages);
  return requestLongTermMemoryOpenAiLike(profile, messages);
}

function extractJsonObjectFromAiText(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }

  return null;
}

/* ==========================================================================
   [区域标注·已完成·长期记忆消息轮次截取]
   说明：
   1. 一轮 = 连续 user 消息组 + 后续连续 assistant 消息组；系统提示类消息不单独计轮。
   2. 自动总结截取“总结轮数”设定的最新 N 轮；手动总结截取“最新一轮 + 之前 N 轮”。
   3. 这里只读取当前 state.currentMessages 或 IndexedDB 中当前聊天消息，不写聊天记录。
   ========================================================================== */
function getMessageMemoryText(message = {}) {
  const type = String(message?.type || '').trim();
  if (type === 'sticker') return `[表情包] ${String(message?.stickerName || message?.content || '').trim()}`;
  if (type === 'image') return `[图片] ${String(message?.imageName || message?.content || '').trim()}`;
  if (type === 'transfer') return `[转账] ${String(message?.transferDisplayAmount || message?.content || '').trim()}`;
  if (type === 'gift') return `[礼物] ${String(message?.giftTitle || message?.content || '').trim()}`;
  if (type === 'voice') return `[语音] ${String(message?.content || '').trim()}`;
  if (type === 'user_withdraw_system' || type === 'ai_withdraw_system') return `[撤回提示] ${String(message?.content || '').trim()}`;
  return String(message?.content || '').trim();
}

function buildConversationRounds(messages = []) {
  const rounds = [];
  let currentRound = null;
  let phase = '';

  (Array.isArray(messages) ? messages : []).forEach(message => {
    const role = String(message?.role || '').trim();
    if (role !== 'user' && role !== 'assistant') return;

    const text = getMessageMemoryText(message);
    if (!text) return;

    if (role === 'user') {
      if (!currentRound || phase === 'assistant') {
        currentRound = { userMessages: [], assistantMessages: [], startedAt: Number(message?.timestamp || Date.now()) || Date.now() };
        rounds.push(currentRound);
      }
      currentRound.userMessages.push({ ...message, __memoryText: text });
      phase = 'user';
      return;
    }

    if (!currentRound) {
      currentRound = { userMessages: [], assistantMessages: [], startedAt: Number(message?.timestamp || Date.now()) || Date.now() };
      rounds.push(currentRound);
    }
    currentRound.assistantMessages.push({ ...message, __memoryText: text });
    phase = 'assistant';
  });

  return rounds.filter(round => round.userMessages.length || round.assistantMessages.length);
}

function formatRoundsForSummary(rounds = [], session = {}, mask = {}) {
  const roleName = String(session?.remark || session?.name || '角色').trim() || '角色';
  const userName = String(mask?.name || mask?.nickname || '用户').trim() || '用户';

  return (Array.isArray(rounds) ? rounds : [])
    .map((round, index) => {
      const userText = round.userMessages.map(item => `- ${userName}：${item.__memoryText}`).join('\n') || `- ${userName}：（无）`;
      const assistantText = round.assistantMessages.map(item => `- ${roleName}：${item.__memoryText}`).join('\n') || `- ${roleName}：（无）`;
      return `【第 ${index + 1} 轮】\n${userText}\n${assistantText}`;
    })
    .join('\n\n');
}

function getCurrentSessionForMemory(state = {}) {
  const currentChatId = String(state.currentChatId || '').trim();
  return (Array.isArray(state.sessions) ? state.sessions : []).find(session => String(session?.id || '') === currentChatId) || null;
}

function getContactForMemory(state = {}, session = {}) {
  const sessionId = String(session?.id || state.currentChatId || '').trim();
  return (Array.isArray(state.contacts) ? state.contacts : []).find(contact => String(contact?.id || '') === sessionId) || null;
}

function getCharacterForMemory(state = {}, session = {}, contact = {}) {
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

function getMaskForMemory(state = {}) {
  const maskId = String(state.activeMaskId || '').trim();
  return (Array.isArray(state.archiveMasks) ? state.archiveMasks : []).find(mask => String(mask?.id || '') === maskId) || null;
}

function buildLongTermMemoryPrompt({ roundsText = '', session = {}, character = null, mask = null, source = 'auto' } = {}) {
  const roleName = String(character?.name || session?.remark || session?.name || '当前角色').trim() || '当前角色';
  const userName = String(mask?.name || mask?.nickname || '用户').trim() || '用户';

  return [
    {
      role: 'system',
      content: `你是旧事应用的闲谈长期记忆自动解析器。请把给定聊天轮次解析成一条适合保存到“旧事 → 闲谈记忆库”的长期记忆。

硬性规则：
1. 只根据输入聊天内容总结，不要编造不存在的事件。
2. 摘要保留事件经过、关系变化、关键承诺、情绪转折和后续可能影响对话的事实。
3. 不要出现“AI、模型、API、系统、提示词、自动解析”等出戏词。
4. 不要使用 Markdown，不要解释。
5. 只输出一个 JSON 对象，格式严格为：
{"title":"18字以内标题","summary":"100到200字长期记忆摘要","emotionTags":["标签1","标签2"],"type":"longterm","isPermanent":false,"isHighPriority":false}
6. emotionTags 最多 6 个，短词即可。`
    },
    {
      role: 'user',
      content: `【总结触发方式】
${source === 'manual' ? '手动总结' : '自动总结'}

【角色】
${roleName}

【用户面具】
${userName}

【需要解析为旧事长期记忆的聊天轮次】
${roundsText}

请返回旧事记忆 JSON。`
    }
  ];
}

function normalizeMemorySummaryPayload(rawPayload = {}, fallbackText = '') {
  const summary = String(rawPayload?.summary || rawPayload?.content || fallbackText || '').trim();
  if (!summary) return null;

  const title = String(rawPayload?.title || summary.slice(0, 18)).trim();
  const tags = Array.isArray(rawPayload?.emotionTags)
    ? rawPayload.emotionTags
    : (Array.isArray(rawPayload?.tags) ? rawPayload.tags : []);

  return {
    title: title.slice(0, 32),
    summary,
    emotionTags: tags.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6),
    type: 'longterm',
    isPermanent: Boolean(rawPayload?.isPermanent),
    isHighPriority: Boolean(rawPayload?.isHighPriority),
    injectionEnabled: true,
    timelineAt: Date.now()
  };
}

function showLongTermMemoryCompletionModal(container, { source = 'auto', count = 1 } = {}) {
  renderModalNotice(
    container,
    `${source === 'manual' ? '手动总结' : '自动总结'}完成：已保存 ${count} 条长期记忆到旧事应用。`
  );
}

async function summarizeAndSaveLongTermMemory({
  state = {},
  container = null,
  db = null,
  settingsManager = null,
  source = 'auto',
  rounds = []
} = {}) {
  const session = getCurrentSessionForMemory(state);
  if (!session || !rounds.length) return false;

  const contact = getContactForMemory(state, session);
  const character = getCharacterForMemory(state, session, contact);
  const characterId = String(character?.id || contact?.roleId || session?.roleId || session?.id || '').trim();
  if (!characterId) return false;

  const mask = getMaskForMemory(state);
  const allSettings = settingsManager && typeof settingsManager.getAll === 'function'
    ? await settingsManager.getAll()
    : {};
  const profile = normalizeSecondaryApiProfile(allSettings?.api || {});
  if (!profile.apiKey || !profile.model) return false;

  const roundsText = formatRoundsForSummary(rounds, session, mask);
  if (!roundsText.trim()) return false;

  const rawText = await requestLongTermMemoryBySecondaryApi(
    profile,
    buildLongTermMemoryPrompt({ roundsText, session, character, mask, source })
  );
  const parsed = normalizeMemorySummaryPayload(extractJsonObjectFromAiText(rawText), rawText);
  if (!parsed) return false;

  await upsertMemoryItem(db, characterId, {
    ...parsed,
    id: `chat-longterm-${String(state.activeMaskId || 'default')}-${String(session.id || 'chat')}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: parsed.title,
    summary: parsed.summary,
    timelineAt: Number(rounds[rounds.length - 1]?.startedAt || Date.now()) || Date.now()
  });

  showLongTermMemoryCompletionModal(container, { source, count: 1 });
  return true;
}

/* ==========================================================================
   [区域标注·已完成·长期记忆自动总结入口]
   说明：
   1. sendMessage 成功完成一轮 AI 回复后调用本入口；只有开启自动总结且达到轮数要求才会请求副 API。
   2. 用 longTermMemoryLastAutoSummaryRoundIndex 记录上次自动总结轮次，避免同一批聊天重复沉淀。
   3. 成功后写入旧事应用并弹出应用内完成提示；失败只记录 console，不打断聊天页。
   ========================================================================== */
export async function maybeRunAutoLongTermMemorySummary({
  state = {},
  container = null,
  db = null,
  settingsManager = null
} = {}) {
  try {
    const settings = ensureLongTermMemorySettings(state);
    if (!settings.longTermMemoryAutoSummaryEnabled) return false;

    const rounds = buildConversationRounds(state.currentMessages || []);
    const totalRounds = rounds.length;
    const requiredRounds = Math.max(1, Number(settings.longTermMemorySummaryRounds || 1) || 1);
    const lastAutoRoundIndex = Math.max(0, Number(settings.longTermMemoryLastAutoSummaryRoundIndex || 0) || 0);

    if (totalRounds < requiredRounds || totalRounds - lastAutoRoundIndex < requiredRounds) {
      return false;
    }

    const selectedRounds = rounds.slice(-requiredRounds);
    const saved = await summarizeAndSaveLongTermMemory({
      state,
      container,
      db,
      settingsManager,
      source: 'auto',
      rounds: selectedRounds
    });

    if (saved) {
      state.chatPromptSettings.longTermMemoryLastAutoSummaryRoundIndex = totalRounds;
      await persistLongTermMemorySettings(state, db);
    }

    return saved;
  } catch (error) {
    console.warn('[Chat] 长期记忆自动总结失败:', error);
    return false;
  }
}

/* ==========================================================================
   [区域标注·已完成·长期记忆手动总结入口]
   说明：
   1. 用户开启“手动总结”开关后立即后台调用副 API。
   2. 手动范围 = 最新一轮对话 + 之前 N 轮对话；N 来自“总结轮数”输入。
   3. 完成后开关自动复位，并显示应用内完成弹窗；不使用原生浏览器弹窗。
   ========================================================================== */
async function runManualLongTermMemorySummary({
  state = {},
  container = null,
  db = null,
  settingsManager = null
} = {}) {
  const settings = ensureLongTermMemorySettings(state);
  const rounds = buildConversationRounds(state.currentMessages || []);
  const requiredRounds = Math.max(1, Number(settings.longTermMemorySummaryRounds || 1) || 1);
  const selectedRounds = rounds.slice(-(requiredRounds + 1));

  if (!selectedRounds.length) {
    renderModalNotice(container, '当前聊天还没有可总结的对话。');
    return false;
  }

  return summarizeAndSaveLongTermMemory({
    state,
    container,
    db,
    settingsManager,
    source: 'manual',
    rounds: selectedRounds
  });
}

/* ==========================================================================
   [区域标注·已修改·记忆设置板块入口]
   说明：
   1. 样式参考“聊天控制”板块：左上角标题 + 暖色卡片 + 行分割线 + IconPark 风格右箭头抽屉。
   2. 开关统一复用聊天设置页 iPhone 风格 .msg-ios-switch。
   3. 长期记忆设置已接入 DB.js / IndexedDB 保存与副 API 总结，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function renderChatMemorySettingsSection(chatSettings = {}) {
  return `
    <!-- ==================================================================
         [区域标注·已修改·聊天设置页记忆设置板块]
         说明：
         1. 本板块由 chat-memory-settings.js 独立渲染，位于“聊天控制”板块下方。
         2. “短期记忆”继续复用原有保存链路；“长期记忆”已接入自动/手动总结与旧事保存。
         3. 不新增 localStorage/sessionStorage，不新增持久化兜底，不使用原生弹窗或原生选择器。
         ================================================================== -->
    <section class="msg-settings-chat-control-section msg-settings-memory-section">
      <div class="msg-settings-section-title">记忆设置</div>
      <section class="msg-settings-card msg-settings-chat-control-card msg-settings-memory-card">
        ${renderShortTermMemoryItem(chatSettings)}
        <div class="msg-settings-avatar-divider"></div>
        ${renderLongTermMemoryItem(chatSettings)}
      </section>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次迁移：短期记忆小版块]
   说明：
   1. 本小版块已从“聊天控制”迁移到“记忆设置”。
   2. 原 data-role="msg-short-term-memory-rounds" 保持不变，既有保存逻辑继续按原链路写入 DB.js / IndexedDB。
   3. 这里只移动 UI，不修改短期记忆按轮截取、提示词拼装或任何持久化代码。
   ========================================================================== */
function renderShortTermMemoryItem(chatSettings = {}) {
  return `
    <div class="msg-settings-chat-control-item">
      <button
        class="msg-settings-row msg-settings-chat-control-toggle"
        data-action="toggle-settings-sticker-drawer"
        type="button"
        aria-label="展开短期记忆"
        aria-expanded="false">
        <span class="msg-settings-card__title">短期记忆</span>
        <span class="msg-settings-chat-control-arrow" aria-hidden="true">
          ${ICONPARK_ARROW_RIGHT}
        </span>
      </button>
      <div class="msg-settings-chat-control-drawer" data-role="settings-short-term-memory-drawer">
        <div class="msg-settings-chat-control-drawer__inner">
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>发送之前轮数</span>
            <input class="msg-settings-number-input" data-role="msg-short-term-memory-rounds" type="number" min="0" step="1" value="${escapeHtml(chatSettings.shortTermMemoryRounds ?? 8)}">
          </label>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已修改·长期记忆小版块]
   说明：
   1. “总结轮数”已保存到当前聊天对象 chatPromptSettings.longTermMemorySummaryRounds。
   2. “自动总结”开启后，每到达设定轮数，会后台调用设置应用副 API，总结最新 N 轮并保存到旧事。
   3. “手动总结”开启后立即后台调用副 API，总结最新一轮及之前 N 轮，并保存到旧事；完成后开关自动复位。
   4. 完成提示使用应用内弹窗；持久化统一走 DB.js / IndexedDB。
   ========================================================================== */
function renderLongTermMemoryItem(chatSettings = {}) {
  const settings = normalizeLongTermMemorySettings(chatSettings);

  return `
    <div class="msg-settings-chat-control-item" data-role="settings-long-term-memory-item">
      <button
        class="msg-settings-row msg-settings-chat-control-toggle"
        data-action="toggle-settings-sticker-drawer"
        type="button"
        aria-label="展开长期记忆"
        aria-expanded="false">
        <span class="msg-settings-card__title">长期记忆</span>
        <span class="msg-settings-chat-control-arrow" aria-hidden="true">
          ${ICONPARK_ARROW_RIGHT}
        </span>
      </button>
      <div class="msg-settings-chat-control-drawer" data-role="settings-long-term-memory-drawer">
        <div class="msg-settings-chat-control-drawer__inner">
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>总结轮数</span>
            <input class="msg-settings-number-input" data-role="msg-long-term-memory-summary-rounds" type="number" min="1" step="1" value="${escapeHtml(settings.longTermMemorySummaryRounds)}">
          </label>
          <div class="msg-settings-avatar-divider"></div>
          <div class="msg-settings-row msg-settings-chat-control-console-row">
            <div class="msg-settings-card__title">自动总结</div>
            <button
              class="msg-ios-switch ${settings.longTermMemoryAutoSummaryEnabled ? 'is-on' : ''}"
              data-action="toggle-long-term-memory-auto-summary"
              type="button"
              aria-label="自动总结"
              aria-pressed="${settings.longTermMemoryAutoSummaryEnabled ? 'true' : 'false'}"></button>
          </div>
          <div class="msg-settings-avatar-divider"></div>
          <div class="msg-settings-row msg-settings-chat-control-console-row">
            <div class="msg-settings-card__title">手动总结</div>
            <button
              class="msg-ios-switch ${settings.longTermMemoryManualSummaryEnabled ? 'is-on' : ''}"
              data-action="toggle-long-term-memory-manual-summary"
              type="button"
              aria-label="手动总结"
              aria-pressed="${settings.longTermMemoryManualSummaryEnabled ? 'true' : 'false'}"></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·长期记忆设置局部同步]
   说明：
   1. 只同步长期记忆输入框和两个 iPhone 风格开关，不重绘整个聊天设置页，避免闪屏。
   2. 本函数不做持久化；持久化由输入/点击事件函数负责。
   ========================================================================== */
export function syncLongTermMemorySettingsSection(container, state) {
  const item = container?.querySelector?.('[data-role="settings-long-term-memory-item"]');
  if (!item) return;

  const settings = ensureLongTermMemorySettings(state);
  const roundsInput = item.querySelector('[data-role="msg-long-term-memory-summary-rounds"]');
  const autoSwitch = item.querySelector('[data-action="toggle-long-term-memory-auto-summary"]');
  const manualSwitch = item.querySelector('[data-action="toggle-long-term-memory-manual-summary"]');

  if (roundsInput && String(roundsInput.value) !== String(settings.longTermMemorySummaryRounds)) {
    roundsInput.value = String(settings.longTermMemorySummaryRounds);
  }

  if (autoSwitch) {
    autoSwitch.classList.toggle('is-on', settings.longTermMemoryAutoSummaryEnabled);
    autoSwitch.setAttribute('aria-pressed', settings.longTermMemoryAutoSummaryEnabled ? 'true' : 'false');
  }

  if (manualSwitch) {
    manualSwitch.classList.toggle('is-on', settings.longTermMemoryManualSummaryEnabled);
    manualSwitch.setAttribute('aria-pressed', settings.longTermMemoryManualSummaryEnabled ? 'true' : 'false');
  }
}

/* ==========================================================================
   [区域标注·已完成·长期记忆输入事件接线]
   说明：
   1. 处理“长期记忆 → 总结轮数”的输入保存。
   2. 数值最小为 1，保存到当前聊天对象 chatPromptSettings。
   3. 持久化统一走 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   ========================================================================== */
export function handleChatMemorySettingsInput(e, state, container, db) {
  const target = e?.target;
  if (!target?.matches?.('[data-role="msg-long-term-memory-summary-rounds"]')) return false;

  ensureLongTermMemorySettings(state);
  const rawValue = Number(target.value || DEFAULT_LONG_TERM_MEMORY_SETTINGS.longTermMemorySummaryRounds);
  const nextValue = Number.isFinite(rawValue)
    ? Math.max(1, Math.floor(rawValue))
    : DEFAULT_LONG_TERM_MEMORY_SETTINGS.longTermMemorySummaryRounds;

  state.chatPromptSettings.longTermMemorySummaryRounds = nextValue;
  ensureLongTermMemorySettings(state);

  if (String(target.value) !== String(nextValue)) {
    target.value = String(nextValue);
  }

  dbPut(db, getCurrentChatPromptSettingsKey(state), state.chatPromptSettings);
  syncLongTermMemorySettingsSection(container, state);
  return true;
}

/* ==========================================================================
   [区域标注·已完成·长期记忆点击事件接线]
   说明：
   1. 处理“自动总结”滑动开关与“手动总结”一次性触发开关。
   2. 所有设置变更立即保存到 DB.js / IndexedDB。
   3. 手动总结后台执行，完成后应用内弹窗提示并复位开关；不使用原生浏览器弹窗。
   ========================================================================== */
export async function handleChatMemorySettingsClick({
  action = '',
  target = null,
  state = {},
  container = null,
  db = null,
  settingsManager = null
} = {}) {
  if (action === 'toggle-long-term-memory-auto-summary') {
    ensureLongTermMemorySettings(state);
    state.chatPromptSettings.longTermMemoryAutoSummaryEnabled = !state.chatPromptSettings.longTermMemoryAutoSummaryEnabled;
    ensureLongTermMemorySettings(state);
    await persistLongTermMemorySettings(state, db);
    syncLongTermMemorySettingsSection(container, state);
    return true;
  }

  if (action === 'toggle-long-term-memory-manual-summary') {
    ensureLongTermMemorySettings(state);
    if (state.chatPromptSettings.longTermMemoryManualSummaryEnabled) {
      state.chatPromptSettings.longTermMemoryManualSummaryEnabled = false;
      await persistLongTermMemorySettings(state, db);
      syncLongTermMemorySettingsSection(container, state);
      return true;
    }

    state.chatPromptSettings.longTermMemoryManualSummaryEnabled = true;
    await persistLongTermMemorySettings(state, db);
    syncLongTermMemorySettingsSection(container, state);

    target?.setAttribute?.('disabled', 'disabled');
    try {
      await runManualLongTermMemorySummary({ state, container, db, settingsManager });
    } catch (error) {
      console.warn('[Chat] 长期记忆手动总结失败:', error);
      renderModalNotice(container, '手动总结失败，请检查副 API 配置后重试。');
    } finally {
      state.chatPromptSettings.longTermMemoryManualSummaryEnabled = false;
      await persistLongTermMemorySettings(state, db);
      target?.removeAttribute?.('disabled');
      syncLongTermMemorySettingsSection(container, state);
    }

    return true;
  }

  return false;
}
