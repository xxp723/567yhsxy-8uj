// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-inner-voice.js
 * 用途: 闲谈应用 — "心声"面板独立模块
 *       解析 AI 回复中的心声数据、渲染心声面板、处理头像点击事件。
 * 架构层: 应用层（闲谈子模块）
 *
 * [模块标注·心声面板JS] 整个文件为心声功能独立模块，方便后续针对性修改。
 */

import { escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已修改·心声面板] IconPark 图标
   说明：心声面板用到的图标统一使用 IconPark 风格 SVG。
   - heart: 心声标签图标（心形，来自 IconPark "like"）
   - chart: 数据标签图标（图表，来自 IconPark "chart-line"）
   - empty: 空状态图标（对话气泡，来自 IconPark "message"）
   ========================================================================== */
const IV_ICONS = {
  heart: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 42S6 30 6 17a9 9 0 0 1 18 0a9 9 0 0 1 18 0c0 13-18 25-18 25Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  chart: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 6v36h36" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 34l8-12 8 6 12-18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  empty: `<svg viewBox="0 0 48 48" fill="none"><path d="M44 6H4v30h14l6 6l6-6h14V6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="21" r="2" fill="currentColor"/><circle cx="24" cy="21" r="2" fill="currentColor"/><circle cx="32" cy="21" r="2" fill="currentColor"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·心声面板] 心声协议标签定义
   说明：
   1. AI 回复中使用 [心声]{json}[/心声] 包裹心声数据。
   2. 该标签在 buildAiReplyMessages 之前被提取并剥离，不显示在聊天气泡中。
   3. 心声数据随消息对象的 innerVoice 字段写入 DB.js / IndexedDB。
   ========================================================================== */
const INNER_VOICE_OPEN_TAG = '[心声]';
const INNER_VOICE_CLOSE_TAG = '[/心声]';

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
    heartbeat: extractNum('心调频率') || extractNum('heartbeat') || extractNum('心跳'),
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
    heartbeat: clampNum(raw.heartbeat || raw.心调频率 || raw.心跳, 60, 180),
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

  // 向前找到这一轮 AI 回复的开始位置
  let roundStart = targetIndex;
  while (roundStart > 0 && messages[roundStart - 1]?.role === 'assistant') {
    roundStart--;
  }
  // 向后找到这一轮 AI 回复的结束位置
  let roundEnd = targetIndex;
  while (roundEnd < messages.length - 1 && messages[roundEnd + 1]?.role === 'assistant') {
    roundEnd++;
  }

  // 在这一轮中查找携带 innerVoice 的消息
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

/* ==========================================================================
   [区域标注·已修改·心声面板] 渲染心声面板 HTML
   说明：
   1. 两个标签页："心声"（心声独占大板块）和"数据"（状态、动作、心情、进度条）。
   2. ins 风格胶囊分段控件标签栏，每个标签带 IconPark 图标。
   3. 不设关闭按钮，点击面板外遮罩区域自动关闭。
   ========================================================================== */
export function renderInnerVoicePanel(innerVoice, activeTab = 'voice') {
  if (!innerVoice) {
    return renderEmptyInnerVoicePanel();
  }

  const data = normalizeInnerVoiceData(innerVoice);
  if (!data) return renderEmptyInnerVoicePanel();

  const isVoiceTab = activeTab === 'voice';
  const isDataTab = activeTab === 'data';

  // 心调频率进度条：60-180 bpm 映射到 0-100%
  const heartbeatPercent = Math.round(((data.heartbeat - 60) / 120) * 100);
  const heartbeatWidth = Math.max(2, Math.min(100, heartbeatPercent));

  return `
    <div class="iv-panel is-open" data-role="iv-panel">
      <div class="iv-tabs">
        <div class="iv-tabs__track">
          <button class="iv-tab ${isVoiceTab ? 'is-active' : ''}" data-action="iv-switch-tab" data-iv-tab="voice" type="button">${IV_ICONS.heart}心声</button>
          <button class="iv-tab ${isDataTab ? 'is-active' : ''}" data-action="iv-switch-tab" data-iv-tab="data" type="button">${IV_ICONS.chart}数据</button>
        </div>
      </div>
      <div class="iv-tab-body">
        <!-- ===== 心声标签页 ===== -->
        <div class="iv-tab-page ${isVoiceTab ? 'is-active' : ''}" data-iv-page="voice">
          <div class="iv-cell iv-voice-cell">
            <span class="iv-cell__label">INNER VOICE</span>
            <div class="iv-cell__text">${escapeHtml(data.voice || '……')}</div>
          </div>
        </div>
        <!-- ===== 数据标签页 ===== -->
        <div class="iv-tab-page ${isDataTab ? 'is-active' : ''}" data-iv-page="data">
          <!-- 状态 + 心情：两列分镜 -->
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
          <!-- 动作：宽格子 -->
          <div class="iv-cell iv-action-cell">
            <span class="iv-cell__label">ACTION</span>
            <div class="iv-cell__text">${escapeHtml(data.action || '……')}</div>
          </div>
          <!-- 三个进度条 -->
          <div class="iv-meters">
            <span class="iv-cell__label">METERS</span>
            <div class="iv-meter iv-meter--heartbeat">
              <div class="iv-meter__header">
                <span class="iv-meter__name">心调频率</span>
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
   [区域标注·已修改·心声面板] 空状态面板
   说明：与主面板保持一致的 ins 风格胶囊分段控件标签。
   ========================================================================== */
function renderEmptyInnerVoicePanel() {
  return `
    <div class="iv-panel is-open" data-role="iv-panel">
      <div class="iv-tabs">
        <div class="iv-tabs__track">
          <button class="iv-tab is-active" data-action="iv-switch-tab" data-iv-tab="voice" type="button">${IV_ICONS.heart}心声</button>
          <button class="iv-tab" data-action="iv-switch-tab" data-iv-tab="data" type="button">${IV_ICONS.chart}数据</button>
        </div>
      </div>
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
   [区域标注·已完成·心声面板] 打开心声面板
   说明：
   1. 在聊天消息页容器中插入遮罩层 + 面板 DOM。
   2. 点击遮罩层自动关闭面板（不设关闭按钮）。
   3. 标签页切换由 handleInnerVoicePanelClick 处理。
   ========================================================================== */
export function openInnerVoicePanel(container, innerVoice) {
  // 先关闭已有面板
  closeInnerVoicePanel(container);

  const overlay = document.createElement('div');
  overlay.className = 'iv-overlay is-open';
  overlay.dataset.role = 'iv-overlay';

  overlay.innerHTML = renderInnerVoicePanel(innerVoice, 'voice');

  // 点击遮罩层（非面板区域）关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeInnerVoicePanel(container);
    }
  });

  // 标签页切换
  overlay.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-action="iv-switch-tab"]');
    if (!tabBtn) return;
    e.stopPropagation();
    const tabId = String(tabBtn.dataset.ivTab || 'voice');
    switchInnerVoiceTab(overlay, tabId);
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
  // 动画结束后移除 DOM
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
  // 用户头像带有 --user 修饰符
  if (avatar.classList.contains('msg-bubble__avatar--user')) return false;
  // 确认所在行是左侧（非用户）
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
