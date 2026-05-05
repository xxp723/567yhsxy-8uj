// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-inner-voice.js
 * 用途: 闲谈应用 — "心声"面板独立模块
 *       解析 AI 回复中的心声数据、渲染心声面板、处理头像点击事件。
 * 架构层: 应用层（闲谈子模块）
 *
 * [模块标注·已修改·心声面板JS] 整个文件为心声功能独立模块，方便后续针对性修改。
 */

import { dbGet, dbPut, escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已修改·心声面板] IconPark 图标
   说明：心声面板用到的图标统一使用 IconPark 风格 SVG。
   - heart: 心声标签图标（心形，来自 IconPark "like"）
   - chart: Now 标签图标（图表，来自 IconPark "chart-line"）
   - empty: 空状态图标（对话气泡，来自 IconPark "message"）
   - history: 历史按钮图标（来自 IconPark "history" 风格）
   - multiSelect/check/delete/download: 心声历史多选、全选、删除、下载图标（IconPark 风格）
   ========================================================================== */
const IV_ICONS = {
  heart: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 42S6 30 6 17a9 9 0 0 1 18 0a9 9 0 0 1 18 0c0 13-18 25-18 25Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  chart: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 6v36h36" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 34l8-12 8 6 12-18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  empty: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`,
  history: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 8a16 16 0 1 1-14 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8v10h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 16v10l7 4" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  multiSelect: `<svg viewBox="0 0 48 48" fill="none"><path d="M20 10h20v20H20V10Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M8 18v20h20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 20l4 4l7-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 48 48" fill="none"><path d="M10 25l10 10l18-20" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  delete: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 11h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19 11V7h10v4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 11l2 30h16l2-30" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M21 19v14M27 19v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  download: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6v24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 22l10 10l10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·心声面板] 心声协议标签定义
   说明：
   1. AI 回复中使用 [心声]{json}[/心声] 包裹心声数据。
   2. 该标签在 buildAiReplyMessages 之前被提取并剥离，不显示在聊天气泡中。
   3. 心声数据随消息对象的 innerVoice 字段写入 DB.js / IndexedDB，同时另存为独立心声历史。
   ========================================================================== */
const INNER_VOICE_OPEN_TAG = '[心声]';
const INNER_VOICE_CLOSE_TAG = '[/心声]';

/* ==========================================================================
   [区域标注·已修改·心声历史独立存储] IndexedDB 存储键与标准化
   说明：
   1. 心声历史独立保存在 DB.js / IndexedDB，不依赖 currentMessages。
   2. 删除当前聊天消息/清空当前聊天记录不会删除心声历史。
   3. 不使用 localStorage/sessionStorage，不写双份兜底存储。
   ========================================================================== */
const DATA_KEY_INNER_VOICE_HISTORY = (maskId, chatId) => `chat_inner_voice_history::${maskId || 'default'}::${chatId || 'none'}`;

function normalizeInnerVoiceHistory(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map(item => {
      const data = normalizeInnerVoiceData(item?.innerVoice || item);
      if (!data) return null;
      return {
        id: String(item?.id || `iv_${Number(item?.createdAt || Date.now())}_${Math.random().toString(16).slice(2)}`),
        maskId: String(item?.maskId || ''),
        chatId: String(item?.chatId || ''),
        chatName: String(item?.chatName || ''),
        messageId: String(item?.messageId || ''),
        roundIndex: Math.max(1, Math.floor(Number(item?.roundIndex || 1)) || 1),
        createdAt: Number(item?.createdAt || Date.now()) || Date.now(),
        innerVoice: data
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export async function loadInnerVoiceHistory(db, maskId, chatId) {
  if (!db || !chatId) return [];
  return normalizeInnerVoiceHistory(await dbGet(db, DATA_KEY_INNER_VOICE_HISTORY(maskId, chatId)));
}

async function persistInnerVoiceHistoryList(db, maskId, chatId, list) {
  if (!db || !chatId) return;
  await dbPut(db, DATA_KEY_INNER_VOICE_HISTORY(maskId, chatId), normalizeInnerVoiceHistory(list));
}

/* ==========================================================================
   [区域标注·已修改·心声历史独立存储] 保存每轮生成的心声
   说明：
   1. 每次 AI 回复提取到心声后都追加到独立历史记录。
   2. 该历史与聊天消息分离，删除聊天消息不会同步删除这里的数据。
   3. 持久化只通过 DB.js / IndexedDB；不使用 localStorage/sessionStorage。
   ========================================================================== */
export async function persistInnerVoiceHistoryEntry(db, state, innerVoice, messageId = '') {
  const data = normalizeInnerVoiceData(innerVoice);
  if (!db || !state?.currentChatId || !data) return null;

  const maskId = String(state.activeMaskId || '');
  const chatId = String(state.currentChatId || '');
  const session = (state.sessions || []).find(item => String(item.id) === chatId) || {};
  const history = await loadInnerVoiceHistory(db, maskId, chatId);
  const now = Date.now();
  const entry = {
    id: `iv_${now}_${Math.random().toString(16).slice(2)}`,
    maskId,
    chatId,
    chatName: String(session.remark || session.name || ''),
    messageId: String(messageId || ''),
    roundIndex: history.length + 1,
    createdAt: now,
    innerVoice: data
  };
  await persistInnerVoiceHistoryList(db, maskId, chatId, [entry, ...history]);
  return entry;
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 解析 AI 原始回复中的心声 JSON
   说明：
   1. 从 rawText 中提取 [心声]{...}[/心声] 之间的 JSON 字符串。
   2. 返回 { innerVoice: {...}, cleanedText: '去掉心声标签后的文本' }。
   3. 如果没有找到心声标签或 JSON 解析失败，innerVoice 为 null。
   4. 不使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
export function extractInnerVoiceFromRawText(rawText) {
  const text = String(rawText || '');
  const openIndex = text.indexOf(INNER_VOICE_OPEN_TAG);
  const closeIndex = text.indexOf(INNER_VOICE_CLOSE_TAG);

  if (openIndex < 0 || closeIndex < 0 || closeIndex <= openIndex) {
    return { innerVoice: null, cleanedText: text };
  }

  const jsonStr = text.slice(openIndex + INNER_VOICE_OPEN_TAG.length, closeIndex).trim();
  const cleanedText = (text.slice(0, openIndex) + text.slice(closeIndex + INNER_VOICE_CLOSE_TAG.length)).trim();

  let innerVoice = null;
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      innerVoice = normalizeInnerVoiceData(parsed);
    }
  } catch (_e) {
    // JSON 解析失败，尝试宽松匹配
    innerVoice = parseInnerVoiceLoose(jsonStr);
  }

  return { innerVoice, cleanedText };
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 宽松解析心声数据
   说明：当 AI 输出的 JSON 不够严格时（如缺引号），尝试正则提取各字段。
   ========================================================================== */
function parseInnerVoiceLoose(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  const extract = (key) => {
    const re = new RegExp(`["']?${key}["']?\\s*[：:]\\s*["']?([^"'，,}]+)`, 'i');
    const m = s.match(re);
    return m ? String(m[1] || '').trim() : '';
  };
  const extractNum = (key, fallback = 0) => {
    const v = extract(key);
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const data = {
    status: extract('状态') || extract('status'),
    action: extract('动作') || extract('action'),
    mood: extract('心情') || extract('mood'),
    heartbeat: extractNum('心跳频率') || extractNum('心调频率') || extractNum('heartbeat') || extractNum('心跳'),
    jealousy: extractNum('醋意指数') || extractNum('jealousy') || extractNum('醋意'),
    affection: extractNum('好感度') || extractNum('affection') || extractNum('好感'),
    voice: extract('心声') || extract('voice') || extract('真实想法')
  };

  if (!data.voice && !data.status && !data.mood) return null;
  return normalizeInnerVoiceData(data);
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 标准化心声数据对象
   说明：确保所有字段存在且类型正确，限定字数范围。
   ========================================================================== */
export function normalizeInnerVoiceData(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const clampStr = (v, max) => String(v || '').trim().slice(0, max);
  const clampNum = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : min;
  };

  return {
    status: clampStr(raw.status || raw.状态, 20),
    action: clampStr(raw.action || raw.动作, 50),
    mood: clampStr(raw.mood || raw.心情, 20),
    heartbeat: clampNum(raw.heartbeat || raw.心跳频率 || raw.心调频率 || raw.心跳, 60, 180),
    jealousy: clampNum(raw.jealousy || raw.醋意指数 || raw.醋意, 0, 100),
    affection: clampNum(raw.affection || raw.好感度 || raw.好感, 0, 100),
    voice: clampStr(raw.voice || raw.心声 || raw.真实想法, 100)
  };
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 查找指定 AI 消息关联的心声数据
   说明：
   1. 心声数据存储在同一轮 AI 回复中最后一条 assistant 消息的 innerVoice 字段。
   2. 点击头像时，查找该消息所在轮次中携带 innerVoice 的消息。
   3. 仅读取运行时 state.currentMessages，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function findInnerVoiceForMessage(messages, messageId) {
  if (!Array.isArray(messages) || !messageId) return null;

  const targetId = String(messageId);
  const targetIndex = messages.findIndex(m => String(m?.id || '') === targetId);
  if (targetIndex < 0) return null;

  let roundStart = targetIndex;
  while (roundStart > 0 && messages[roundStart - 1]?.role === 'assistant') {
    roundStart--;
  }

  let roundEnd = targetIndex;
  while (roundEnd < messages.length - 1 && messages[roundEnd + 1]?.role === 'assistant') {
    roundEnd++;
  }

  for (let i = roundEnd; i >= roundStart; i--) {
    const msg = messages[i];
    if (msg?.innerVoice && typeof msg.innerVoice === 'object') {
      return msg.innerVoice;
    }
  }
  return null;
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 查找最新一条 AI 消息的心声数据
   说明：从消息列表尾部向前找第一个含 innerVoice 的 assistant 消息。
   ========================================================================== */
export function findLatestInnerVoice(messages) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'assistant' && msg?.innerVoice && typeof msg.innerVoice === 'object') {
      return msg.innerVoice;
    }
  }
  return null;
}

function formatHistoryTime(ts) {
  const d = new Date(Number(ts || Date.now()));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ==========================================================================
   [区域标注·已完成·心声面板日期时间与下载] 日期格式与 TXT 下载
   说明：
   1. 当前心声面板显示完整日期时间，历史列表仍保留紧凑时间。
   2. 下载按钮只读取 DB.js / IndexedDB 中的心声历史，不新增任何持久化存储。
   3. TXT 内容按日期从早到晚排列；不使用 localStorage/sessionStorage。
   ========================================================================== */
function formatPanelDateTime(ts) {
  const d = new Date(Number(ts || Date.now()));
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildInnerVoiceDownloadText(items = []) {
  const sorted = normalizeInnerVoiceHistory(items).slice().sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  return sorted.map(item => {
    const data = normalizeInnerVoiceData(item.innerVoice) || {};
    return [
      `日期时间：${formatPanelDateTime(item.createdAt)}`,
      `轮次：#${Number(item.roundIndex || 1)}`,
      `状态：${data.status || '……'}`,
      `动作：${data.action || '……'}`,
      `心情：${data.mood || '……'}`,
      `心跳频率：${Number(data.heartbeat || 0)} bpm`,
      `醋意指数：${Number(data.jealousy || 0)}%`,
      `好感度：${Number(data.affection || 0)}%`,
      `心声：${data.voice || '……'}`
    ].join('\n');
  }).join('\n\n------------------------------\n\n');
}

function downloadInnerVoiceHistoryTxt(items = [], chatName = '') {
  const text = buildInnerVoiceDownloadText(items);
  if (!text.trim()) return;
  const safeName = String(chatName || '心声历史').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 32) || '心声历史';
  const fileName = `${safeName}_${formatPanelDateTime(Date.now()).replace(/[/: ]/g, '-')}.txt`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

/* ==========================================================================
   [区域标注·已修改·心声面板] 渲染心声面板 HTML
   说明：
   1. 两个标签页显示为加粗英文花体字："Voice" 和 "Now"（"数据"仅改面板显示为"Now"）。
   2. 标签栏为游戏机风格分段控件，每个标签带 IconPark 图标。
   3. "历史/多选/下载"图标按钮统一放在标签下方同一行，仅显示图标。
   4. 当前心声面板显示日期和时间；点击面板外遮罩区域自动关闭。
   ========================================================================== */
export function renderInnerVoicePanel(innerVoice, activeTab = 'voice', options = {}) {
  if (!innerVoice) {
    return renderEmptyInnerVoicePanel();
  }

  const data = normalizeInnerVoiceData(innerVoice);
  if (!data) return renderEmptyInnerVoicePanel();

  const isVoiceTab = activeTab === 'voice';
  const isDataTab = activeTab === 'data';
  const displayTime = formatPanelDateTime(options.createdAt || Date.now());

  // 心跳频率进度条：60-180 bpm 映射到 0-100%
  const heartbeatPercent = Math.round(((data.heartbeat - 60) / 120) * 100);
  const heartbeatWidth = Math.max(2, Math.min(100, heartbeatPercent));

  return `
    <div class="iv-panel is-open" data-role="iv-panel" data-iv-view="current">
      <div class="iv-panel-header">
        <div class="iv-tabs">
          <div class="iv-tabs__track">
            <button class="iv-tab ${isVoiceTab ? 'is-active' : ''}" data-action="iv-switch-tab" data-iv-tab="voice" type="button">${IV_ICONS.heart}Voice</button>
            <button class="iv-tab ${isDataTab ? 'is-active' : ''}" data-action="iv-switch-tab" data-iv-tab="data" type="button">${IV_ICONS.chart}Now</button>
          </div>
        </div>
      </div>
      <div class="iv-toolbar" data-role="iv-toolbar">
        <button class="iv-toolbar-btn" data-action="iv-show-history" type="button" aria-label="心声历史" title="心声历史">${IV_ICONS.history}</button>
        <button class="iv-toolbar-btn" data-action="iv-toggle-multi" type="button" aria-label="多选" title="多选">${IV_ICONS.multiSelect}</button>
        <button class="iv-toolbar-btn" data-action="iv-download-history" type="button" aria-label="下载心声历史" title="下载心声历史">${IV_ICONS.download}</button>
        <span class="iv-toolbar-spacer"></span>
      </div>
      <div class="iv-panel-time" data-role="iv-panel-time">${escapeHtml(displayTime)}</div>
      <div class="iv-tab-body">
        <div class="iv-tab-page ${isVoiceTab ? 'is-active' : ''}" data-iv-page="voice">
          <div class="iv-cell iv-voice-cell">
            <span class="iv-cell__label">INNER VOICE</span>
            <div class="iv-cell__text">${escapeHtml(data.voice || '……')}</div>
          </div>
        </div>
        <div class="iv-tab-page ${isDataTab ? 'is-active' : ''}" data-iv-page="data">
          <div class="iv-grid-row">
            <div class="iv-cell">
              <span class="iv-cell__label">STATUS</span>
              <div class="iv-cell__text">${escapeHtml(data.status || '……')}</div>
            </div>
            <div class="iv-cell">
              <span class="iv-cell__label">MOOD</span>
              <div class="iv-cell__text">${escapeHtml(data.mood || '……')}</div>
            </div>
          </div>
          <div class="iv-cell iv-action-cell">
            <span class="iv-cell__label">ACTION</span>
            <div class="iv-cell__text">${escapeHtml(data.action || '……')}</div>
          </div>
          <div class="iv-meters">
            <span class="iv-cell__label">METERS</span>
            <div class="iv-meter iv-meter--heartbeat">
              <div class="iv-meter__header">
                <span class="iv-meter__name">心跳频率</span>
                <span class="iv-meter__value">${data.heartbeat} bpm</span>
              </div>
              <div class="iv-meter__bar">
                <div class="iv-meter__fill" style="width:${heartbeatWidth}%"></div>
              </div>
            </div>
            <div class="iv-meter iv-meter--jealousy">
              <div class="iv-meter__header">
                <span class="iv-meter__name">醋意指数</span>
                <span class="iv-meter__value">${data.jealousy}%</span>
              </div>
              <div class="iv-meter__bar">
                <div class="iv-meter__fill" style="width:${Math.max(2, data.jealousy)}%"></div>
              </div>
            </div>
            <div class="iv-meter iv-meter--affection">
              <div class="iv-meter__header">
                <span class="iv-meter__name">好感度</span>
                <span class="iv-meter__value">${data.affection}%</span>
              </div>
              <div class="iv-meter__bar">
                <div class="iv-meter__fill" style="width:${Math.max(2, data.affection)}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 空状态面板
   说明：与主面板保持一致的游戏机风格加粗英文花体标签，按钮为同一行纯图标。
   ========================================================================== */
function renderEmptyInnerVoicePanel() {
  return `
    <div class="iv-panel is-open" data-role="iv-panel" data-iv-view="current">
      <div class="iv-panel-header">
        <div class="iv-tabs">
          <div class="iv-tabs__track">
            <button class="iv-tab is-active" data-action="iv-switch-tab" data-iv-tab="voice" type="button">${IV_ICONS.heart}Voice</button>
            <button class="iv-tab" data-action="iv-switch-tab" data-iv-tab="data" type="button">${IV_ICONS.chart}Now</button>
          </div>
        </div>
      </div>
      <div class="iv-toolbar" data-role="iv-toolbar">
        <button class="iv-toolbar-btn" data-action="iv-show-history" type="button" aria-label="心声历史" title="心声历史">${IV_ICONS.history}</button>
        <button class="iv-toolbar-btn" data-action="iv-toggle-multi" type="button" aria-label="多选" title="多选">${IV_ICONS.multiSelect}</button>
        <button class="iv-toolbar-btn" data-action="iv-download-history" type="button" aria-label="下载心声历史" title="下载心声历史">${IV_ICONS.download}</button>
        <span class="iv-toolbar-spacer"></span>
      </div>
      <div class="iv-panel-time" data-role="iv-panel-time">${escapeHtml(formatPanelDateTime(Date.now()))}</div>
      <div class="iv-tab-body">
        <div class="iv-tab-page is-active" data-iv-page="voice">
          <div class="iv-empty">
            <span class="iv-empty__icon">${IV_ICONS.empty}</span>
            暂无心声数据<br>等待角色的下一次回复
          </div>
        </div>
        <div class="iv-tab-page" data-iv-page="data">
          <div class="iv-empty">
            <span class="iv-empty__icon">${IV_ICONS.empty}</span>
            暂无数据
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·心声历史视图] 渲染历史列表
   说明：历史视图用于观看过往心声，并支持同一行图标按钮完成多选/全选/删除/下载。
   ========================================================================== */
function renderInnerVoiceHistoryPanel(history = [], options = {}) {
  const multiMode = Boolean(options.multiMode);
  const selectedIds = new Set(Array.isArray(options.selectedIds) ? options.selectedIds.map(String) : []);
  const items = normalizeInnerVoiceHistory(history);
  const allSelected = items.length > 0 && items.every(item => selectedIds.has(String(item.id)));

  return `
    <div class="iv-panel is-open" data-role="iv-panel" data-iv-view="history" data-iv-multi="${multiMode ? '1' : '0'}">
      <div class="iv-panel-header">
        <div class="iv-tabs">
          <div class="iv-tabs__track">
            <button class="iv-tab is-active" data-action="iv-show-current" type="button">${IV_ICONS.heart}Voice</button>
            <button class="iv-tab" data-action="iv-show-current" type="button">${IV_ICONS.chart}Now</button>
          </div>
        </div>
      </div>
      <div class="iv-toolbar" data-role="iv-toolbar">
        <button class="iv-toolbar-btn is-active" data-action="iv-show-current" type="button" aria-label="返回当前心声" title="返回当前心声">${IV_ICONS.history}</button>
        <button class="iv-toolbar-btn ${multiMode ? 'is-active' : ''}" data-action="iv-toggle-multi" type="button" aria-label="${multiMode ? '取消多选' : '多选'}" title="${multiMode ? '取消多选' : '多选'}">${IV_ICONS.multiSelect}</button>
        ${multiMode ? `
          <button class="iv-toolbar-btn" data-action="iv-select-all" type="button" aria-label="${allSelected ? '取消全选' : '全选'}" title="${allSelected ? '取消全选' : '全选'}">${IV_ICONS.check}</button>
          <button class="iv-toolbar-btn iv-toolbar-btn--danger" data-action="iv-open-delete-confirm" type="button" aria-label="删除选中心声" title="删除选中心声" ${selectedIds.size ? '' : 'disabled'}>${IV_ICONS.delete}</button>
        ` : ''}
        <button class="iv-toolbar-btn" data-action="iv-download-history" type="button" aria-label="下载心声历史" title="下载心声历史">${IV_ICONS.download}</button>
        <span class="iv-toolbar-spacer"></span>
      </div>
      <div class="iv-tab-body">
        <div class="iv-tab-page is-active">
          ${items.length ? `
            <div class="iv-history-list" data-role="iv-history-list">
              ${items.map(item => {
                const data = normalizeInnerVoiceData(item.innerVoice);
                const selected = selectedIds.has(String(item.id));
                return `
                  <button class="iv-history-item ${selected ? 'is-selected' : ''}"
                          data-action="${multiMode ? 'iv-toggle-history-item' : 'iv-view-history-item'}"
                          data-iv-history-id="${escapeHtml(item.id)}"
                          type="button">
                    ${multiMode ? `
                      <span class="iv-history-checkbox ${selected ? 'is-checked' : ''}">
                        ${IV_ICONS.check}
                      </span>
                    ` : ''}
                    <span class="iv-history-content">
                      <span class="iv-history-voice">${escapeHtml(data?.voice || '……')}</span>
                      <span class="iv-history-meta">
                        <span>#${Number(item.roundIndex || 1)}</span>
                        <span>${escapeHtml(formatHistoryTime(item.createdAt))}</span>
                        <span>心跳 ${Number(data?.heartbeat || 0)} bpm</span>
                      </span>
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="iv-empty">
              <span class="iv-empty__icon">${IV_ICONS.empty}</span>
              暂无心声历史<br>每轮 AI 回复生成后会自动保存在这里
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderInnerVoiceDeleteConfirm(count = 0) {
  return `
    <div class="iv-confirm-overlay is-open" data-role="iv-confirm-overlay">
      <div class="iv-confirm-dialog">
        <div class="iv-confirm-title">确认删除心声历史</div>
        <div class="iv-confirm-msg">将删除已选中的 ${Number(count || 0)} 条心声历史。删除后不可恢复。</div>
        <div class="iv-confirm-actions">
          <button class="iv-confirm-btn" data-action="iv-close-delete-confirm" type="button">取消</button>
          <button class="iv-confirm-btn iv-confirm-btn--danger" data-action="iv-confirm-delete-history" type="button">确认删除</button>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已修改·心声面板] 打开心声面板
   说明：
   1. 在聊天消息页容器中插入遮罩层 + 面板 DOM。
   2. 点击遮罩层自动关闭面板（不设关闭按钮）。
   3. 标签切换、历史、多选、全选、删除确认均在本模块内部处理。
   4. 心声历史只读写 DB.js / IndexedDB，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function openInnerVoicePanel(container, innerVoice, options = {}) {
  closeInnerVoicePanel(container);

  const overlay = document.createElement('div');
  overlay.className = 'iv-overlay is-open';
  overlay.dataset.role = 'iv-overlay';
  overlay.__ivState = {
    innerVoice: normalizeInnerVoiceData(innerVoice),
    db: options.db || null,
    maskId: String(options.maskId || ''),
    chatId: String(options.chatId || ''),
    history: [],
    multiMode: false,
    selectedIds: [],
    currentTimestamp: Number(options.createdAt || Date.now()) || Date.now(),
    chatName: String(options.chatName || '')
  };

  overlay.innerHTML = renderInnerVoicePanel(innerVoice, 'voice', { createdAt: overlay.__ivState.currentTimestamp });

  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay) {
      closeInnerVoicePanel(container);
      return;
    }

    const target = e.target.closest('[data-action]');
    if (!target || !overlay.contains(target)) return;

    const action = String(target.dataset.action || '');
    if (!action.startsWith('iv-')) return;

    e.preventDefault();
    e.stopPropagation();

    const ivState = overlay.__ivState || {};
    if (action === 'iv-switch-tab') {
      switchInnerVoiceTab(overlay, String(target.dataset.ivTab || 'voice'));
      return;
    }

    if (action === 'iv-show-history') {
      ivState.history = await loadInnerVoiceHistory(ivState.db, ivState.maskId, ivState.chatId);
      ivState.multiMode = false;
      ivState.selectedIds = [];
      overlay.innerHTML = renderInnerVoiceHistoryPanel(ivState.history, ivState);
      return;
    }

    if (action === 'iv-show-current') {
      ivState.multiMode = false;
      ivState.selectedIds = [];
      overlay.innerHTML = renderInnerVoicePanel(ivState.innerVoice, 'voice', { createdAt: ivState.currentTimestamp });
      return;
    }

    if (action === 'iv-toggle-multi') {
      ivState.history = await loadInnerVoiceHistory(ivState.db, ivState.maskId, ivState.chatId);
      ivState.multiMode = !ivState.multiMode;
      ivState.selectedIds = [];
      overlay.innerHTML = renderInnerVoiceHistoryPanel(ivState.history, ivState);
      return;
    }

    if (action === 'iv-select-all') {
      const ids = normalizeInnerVoiceHistory(ivState.history).map(item => String(item.id));
      const selected = new Set((ivState.selectedIds || []).map(String));
      const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
      ivState.selectedIds = allSelected ? [] : ids;
      overlay.innerHTML = renderInnerVoiceHistoryPanel(ivState.history, ivState);
      return;
    }

    if (action === 'iv-toggle-history-item') {
      const id = String(target.dataset.ivHistoryId || '');
      const selected = new Set((ivState.selectedIds || []).map(String));
      selected.has(id) ? selected.delete(id) : selected.add(id);
      ivState.selectedIds = Array.from(selected);
      overlay.innerHTML = renderInnerVoiceHistoryPanel(ivState.history, ivState);
      return;
    }

    if (action === 'iv-view-history-item') {
      const id = String(target.dataset.ivHistoryId || '');
      const entry = normalizeInnerVoiceHistory(ivState.history).find(item => String(item.id) === id);
      if (entry?.innerVoice) {
        ivState.innerVoice = normalizeInnerVoiceData(entry.innerVoice);
        ivState.currentTimestamp = Number(entry.createdAt || Date.now()) || Date.now();
        ivState.multiMode = false;
        ivState.selectedIds = [];
        overlay.innerHTML = renderInnerVoicePanel(ivState.innerVoice, 'voice', { createdAt: ivState.currentTimestamp });
      }
      return;
    }

    if (action === 'iv-download-history') {
      ivState.history = await loadInnerVoiceHistory(ivState.db, ivState.maskId, ivState.chatId);
      const selected = new Set((ivState.selectedIds || []).map(String));
      const sourceItems = normalizeInnerVoiceHistory(ivState.history);
      const downloadItems = selected.size
        ? sourceItems.filter(item => selected.has(String(item.id)))
        : sourceItems;
      downloadInnerVoiceHistoryTxt(downloadItems, ivState.chatName || '心声历史');
      return;
    }

    if (action === 'iv-open-delete-confirm') {
      const count = (ivState.selectedIds || []).length;
      if (!count) return;
      overlay.insertAdjacentHTML('beforeend', renderInnerVoiceDeleteConfirm(count));
      return;
    }

    if (action === 'iv-close-delete-confirm') {
      overlay.querySelector('[data-role="iv-confirm-overlay"]')?.remove();
      return;
    }

    if (action === 'iv-confirm-delete-history') {
      const selected = new Set((ivState.selectedIds || []).map(String));
      const nextHistory = normalizeInnerVoiceHistory(ivState.history).filter(item => !selected.has(String(item.id)));
      await persistInnerVoiceHistoryList(ivState.db, ivState.maskId, ivState.chatId, nextHistory);
      ivState.history = nextHistory;
      ivState.selectedIds = [];
      ivState.multiMode = false;
      overlay.innerHTML = renderInnerVoiceHistoryPanel(ivState.history, ivState);
    }
  });

  container.appendChild(overlay);
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 关闭心声面板
   ========================================================================== */
export function closeInnerVoicePanel(container) {
  const overlay = container.querySelector('[data-role="iv-overlay"]');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  const panel = overlay.querySelector('[data-role="iv-panel"]');
  if (panel) panel.classList.remove('is-open');
  setTimeout(() => overlay.remove(), 250);
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 标签页切换
   ========================================================================== */
function switchInnerVoiceTab(overlayOrPanel, tabId) {
  const root = overlayOrPanel.querySelector?.('[data-role="iv-panel"]') || overlayOrPanel;

  root.querySelectorAll('.iv-tab').forEach(tab => {
    tab.classList.toggle('is-active', String(tab.dataset.ivTab || '') === tabId);
  });
  root.querySelectorAll('.iv-tab-page').forEach(page => {
    page.classList.toggle('is-active', String(page.dataset.ivPage || '') === tabId);
  });
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 构建心声系统提示词
   说明：
   1. 本函数返回追加到 AI 系统提示词中的心声格式要求。
   2. 告诉 AI 每轮必须在回复末尾输出 [心声]{json}[/心声]。
   3. 提示词精简清晰，让 AI 一眼看懂输出格式。
   4. 强调不生成将受到惩罚。
   ========================================================================== */
export function buildInnerVoiceSystemPrompt() {
  return `
【心声协议·强制】
你每一轮回复都**必须**在所有可见消息协议之后、末尾追加一段心声数据块。格式如下：

[心声]{"状态":"角色当前状态（≤20字）","动作":"角色正在做的动作（≤50字）","心情":"没说出口的真实心情（≤20字）","心跳":数值,"醋意":数值,"好感":数值,"心声":"角色真实想法（≤100字，要体现与表面消息的反差）"}[/心声]

字段规则：
- 状态：当前对话时角色的状态，第一人称，≤20字。如"想知道又不好意思问""傲娇地等待回复ing"
- 动作：当前对话时角色的动作描写，第一人称，≤50字。如"看到这句话立刻坐直了身体，拿起镜子左看右看"
- 心情：当前没说出口的真实心情，第一人称，一句话≤20字。如"想把你抱在怀里""终于等到你"
- 心跳：整数，单位bpm，范围60-180，紧张/心动时偏高
- 醋意：整数，0-100，吃醋时偏高
- 好感：整数，0-100，对会话对象的真实好感度
- 心声：角色的真实内心想法，≤100字。**必须体现与聊天消息中表面回复的反差**。例如表面说"没事，我不在意"，心声写"其实我还是挺在意的，如果你一直陪着我就好了"

⚠️ 心声数据块在每一轮回复中都是**强制必须生成**的，不可省略、不可偷懒跳过。如果缺少心声数据块，将被视为严重格式错误并受到惩罚。
⚠️ [心声]...[/心声] 放在本轮所有 [回复]/[表情]/[转账]/[卡片] 等协议的最后面。
⚠️ 心声数据块内容是纯JSON，不要包含markdown、代码块或多余符号。
`.trim();
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 判断消息气泡行中的头像是否为 AI 角色头像
   说明：只有左侧（非用户方）头像才触发心声面板。
   ========================================================================== */
export function isAssistantAvatarClick(target) {
  if (!target) return false;
  const avatar = target.closest('.msg-bubble__avatar');
  if (!avatar) return false;
  if (avatar.classList.contains('msg-bubble__avatar--user')) return false;
  const row = avatar.closest('.msg-bubble-row');
  if (!row) return false;
  return row.classList.contains('msg-bubble-row--left');
}

/* ==========================================================================
   [区域标注·已完成·心声面板] 从头像点击事件获取关联消息 ID
   ========================================================================== */
export function getMessageIdFromAvatarClick(target) {
  const row = target.closest('.msg-bubble-row[data-message-id]');
  return row ? String(row.dataset.messageId || '') : '';
}
