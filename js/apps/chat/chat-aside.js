// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-aside.js
 * 用途: 闲谈应用 — 旁白模式独立模块
 * 说明:
 * 1. 旁白模式弹窗、状态管理、提示词构建、气泡渲染、历史摘要。
 * 2. 持久化只通过 DB.js / IndexedDB，禁止 localStorage/sessionStorage。
 * 3. 独立文件，方便后续针对性修改旁白逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

import { dbGet, dbPut, escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·旁白模式] IconPark 图标 SVG
   说明：旁白模式专用图标，统一使用 IconPark 风格。
   ========================================================================== */
const ASIDE_ICONS = {
  /* IconPark — 爱心（退出旁白模式按钮） */
  heart: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 42S6 30 6 17a9 9 0 0 1 18 0a9 9 0 0 1 18 0c0 13-18 25-18 25Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·旁白模式] 默认旁白设置
   说明：首次打开旁白弹窗时的默认值。
   ========================================================================== */
export function getDefaultAsideSettings() {
  return {
    /* 角色人称：'first' = 第一人称（我），'third' = 第三人称（角色名） */
    rolePerson: 'first',
    /* 用户人称：'second' = 第二人称（你），'third' = 第三人称（用户名） */
    userPerson: 'second',
    /* 描述风格：默认白描；用户可自定义 */
    style: '',
    /* 每轮旁白字数范围 */
    minWords: 30,
    maxWords: 100,
    /* 显示模式：'top' = 固定在第一条AI消息上方，'interleave' = 穿插在AI消息中 */
    displayMode: 'top'
  };
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 规范化旁白设置
   ========================================================================== */
export function normalizeAsideSettings(raw) {
  const defaults = getDefaultAsideSettings();
  const source = raw && typeof raw === 'object' ? raw : {};
  const rolePerson = ['first', 'third'].includes(source.rolePerson) ? source.rolePerson : defaults.rolePerson;
  const userPerson = ['second', 'third'].includes(source.userPerson) ? source.userPerson : defaults.userPerson;
  const style = String(source.style || defaults.style).trim();
  const minWords = Math.max(10, Math.floor(Number(source.minWords)) || defaults.minWords);
  const maxWords = Math.max(minWords, Math.floor(Number(source.maxWords)) || defaults.maxWords);
  const displayMode = ['top', 'interleave'].includes(source.displayMode) ? source.displayMode : defaults.displayMode;
  return { rolePerson, userPerson, style, minWords, maxWords, displayMode };
}

/* ==========================================================================
   [区域标注·已完成·闲谈打不开修复] 旁白模式运行时状态检测导出
   说明：
   1. chat-message.js 与 index.js 会静态导入 isAsideModeActive；缺少该导出会导致闲谈入口模块加载失败。
   2. 本函数只读取传入 state/options 的 asideModeActive 运行时布尔值，不读写任何持久化存储。
   3. 持久化仍严格只通过 DB.js / IndexedDB；不使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
export function isAsideModeActive(stateOrOptions = {}) {
  return Boolean(stateOrOptions?.asideModeActive);
}

/* ==========================================================================
   [区域标注·已完成·旁白模式防自动退出修复] 旁白模式会话状态 IndexedDB 存取
   说明：
   1. 旁白模式是否开启、旁白设置、旁白历史按“当前面具 + 当前会话”保存。
   2. 只有点击顶栏爱心并确认退出时，才会把 active 写为 false。
   3. 重新进入会话或闲谈应用重新挂载时从 DB.js / IndexedDB 恢复，避免未点爱心却自动退出。
   4. 禁止 localStorage/sessionStorage，不写双份兜底，不使用长文本字段过滤。
   ========================================================================== */
export const DATA_KEY_CHAT_ASIDE_MODE_STATE = (maskId, chatId) => `chat_aside_state::${maskId || 'default'}::${chatId || 'none'}`;

export function normalizeAsideModeState(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    active: Boolean(source.active),
    settings: normalizeAsideSettings(source.settings || source.asideSettings || null),
    history: Array.isArray(source.history || source.asideHistory) ? (source.history || source.asideHistory) : [],
    updatedAt: Number(source.updatedAt || 0) || 0
  };
}

export async function loadAsideModeState(db, maskId, chatId) {
  const stored = await dbGet(db, DATA_KEY_CHAT_ASIDE_MODE_STATE(maskId, chatId));
  return stored ? normalizeAsideModeState(stored) : null;
}

export async function persistAsideModeState(db, maskId, chatId, stateOrPatch = {}) {
  if (!chatId) return;
  const normalized = normalizeAsideModeState({
    active: stateOrPatch.active ?? stateOrPatch.asideModeActive,
    settings: stateOrPatch.settings || stateOrPatch.asideSettings,
    history: stateOrPatch.history || stateOrPatch.asideHistory,
    updatedAt: Date.now()
  });
  await dbPut(db, DATA_KEY_CHAT_ASIDE_MODE_STATE(maskId, chatId), normalized);
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 旁白模式确认弹窗渲染
   说明：
   1. 点击咖啡功能区"旁白"按钮后打开此弹窗。
   2. 弹窗使用应用内 chat-modal 风格，不使用原生浏览器弹窗。
   3. 弹窗内可设置角色/用户人称、描述风格、字数范围、显示模式。
   ========================================================================== */
export function showAsideEnterModal(container, currentSettings = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const settings = normalizeAsideSettings(currentSettings);

  panel.innerHTML = `
    <!-- ======================================================================
         [区域标注·已完成·旁白模式弹窗] 进入旁白模式确认与设置
         ====================================================================== -->
    <div class="chat-modal-header">
      <span>旁白模式</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${ASIDE_ICONS.close}</button>
    </div>
    <div class="chat-modal-body aside-modal-body">
      <div class="chat-modal-hint">
        开启旁白模式后，AI 回复时会附带旁白描述角色的状态、动作与神态。旁白居中加粗显示，区别于消息气泡。旁白模式下允许角色和用户同空间物理接触，当剧情进展到同一地点时会自然从线上过渡到线下。
      </div>

      <!-- 角色人称 -->
      <div class="aside-modal-section">
        <span class="aside-modal-section__label">称呼角色</span>
        <div class="aside-option-group" data-role="aside-role-person-group">
          <button class="aside-option-btn ${settings.rolePerson === 'first' ? 'is-active' : ''}"
                  data-action="set-aside-role-person" data-value="first" type="button">第一人称（我）</button>
          <button class="aside-option-btn ${settings.rolePerson === 'third' ? 'is-active' : ''}"
                  data-action="set-aside-role-person" data-value="third" type="button">第三人称（角色名）</button>
        </div>
      </div>

      <!-- 用户人称 -->
      <div class="aside-modal-section">
        <span class="aside-modal-section__label">称呼用户</span>
        <div class="aside-option-group" data-role="aside-user-person-group">
          <button class="aside-option-btn ${settings.userPerson === 'second' ? 'is-active' : ''}"
                  data-action="set-aside-user-person" data-value="second" type="button">第二人称（你）</button>
          <button class="aside-option-btn ${settings.userPerson === 'third' ? 'is-active' : ''}"
                  data-action="set-aside-user-person" data-value="third" type="button">第三人称（用户名）</button>
        </div>
      </div>

      <!-- 描述风格 -->
      <div class="aside-modal-section">
        <span class="aside-modal-section__label">描述风格</span>
        <p class="aside-modal-section__desc">留空使用默认白描风格：简单直白，不加修饰修辞。</p>
        <input class="aside-style-input" data-role="aside-style-input" type="text"
               placeholder="默认白描" value="${escapeHtml(settings.style)}">
      </div>

      <!-- 字数范围 -->
      <div class="aside-modal-section">
        <span class="aside-modal-section__label">每轮旁白字数</span>
        <div class="aside-range-row">
          <input class="aside-range-input" data-role="aside-min-words" type="number"
                 min="10" max="500" step="10" value="${settings.minWords}">
          <span class="aside-range-sep">~</span>
          <input class="aside-range-input" data-role="aside-max-words" type="number"
                 min="10" max="500" step="10" value="${settings.maxWords}">
          <span class="aside-range-sep">字</span>
        </div>
      </div>

      <!-- 显示模式 -->
      <div class="aside-modal-section">
        <span class="aside-modal-section__label">旁白显示方式</span>
        <div class="aside-option-group" data-role="aside-display-mode-group">
          <button class="aside-option-btn ${settings.displayMode === 'top' ? 'is-active' : ''}"
                  data-action="set-aside-display-mode" data-value="top" type="button">固定在AI消息上方</button>
          <button class="aside-option-btn ${settings.displayMode === 'interleave' ? 'is-active' : ''}"
                  data-action="set-aside-display-mode" data-value="interleave" type="button">穿插在AI消息中</button>
        </div>
      </div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-enter-aside-mode" type="button">进入旁白模式</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 从弹窗 DOM 读取用户选择的旁白设置
   ========================================================================== */
export function readAsideSettingsFromModal(container) {
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!panel) return getDefaultAsideSettings();

  const activeRoleBtn = panel.querySelector('[data-action="set-aside-role-person"].is-active');
  const activeUserBtn = panel.querySelector('[data-action="set-aside-user-person"].is-active');
  const activeDisplayBtn = panel.querySelector('[data-action="set-aside-display-mode"].is-active');
  const styleInput = panel.querySelector('[data-role="aside-style-input"]');
  const minInput = panel.querySelector('[data-role="aside-min-words"]');
  const maxInput = panel.querySelector('[data-role="aside-max-words"]');

  return normalizeAsideSettings({
    rolePerson: activeRoleBtn?.dataset?.value || 'first',
    userPerson: activeUserBtn?.dataset?.value || 'second',
    style: styleInput?.value || '',
    minWords: Number(minInput?.value) || 30,
    maxWords: Number(maxInput?.value) || 100,
    displayMode: activeDisplayBtn?.dataset?.value || 'top'
  });
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 顶栏退出旁白爱心按钮 HTML
   说明：旁白模式开启后，聊天顶栏上出现此爱心按钮。
   ========================================================================== */
export function renderAsideExitButtonHtml() {
  return `
    <button class="msg-top-bar__aside-exit" data-action="exit-aside-mode" type="button"
            title="退出旁白模式" aria-label="退出旁白模式">
      ${ASIDE_ICONS.heart}
    </button>
  `;
}

/* ==========================================================================
   [区域标注·已完成·闲谈打不开修复] 退出旁白模式确认弹窗导出
   说明：
   1. index.js 会静态导入 showAsideExitConfirmModal；缺少该导出会导致闲谈入口模块加载失败。
   2. 使用闲谈应用内 chat-modal 样式，不使用浏览器原生 alert/confirm/prompt。
   3. 本弹窗只负责运行时确认交互，不读写任何持久化存储；确认后的状态变更仍由 index.js 处理。
   ========================================================================== */
export function showAsideExitConfirmModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>退出旁白模式</span>
      <button class="chat-modal-close" data-action="close-modal" type="button" aria-label="关闭">${ASIDE_ICONS.close}</button>
    </div>
    <div class="chat-modal-body aside-modal-body">
      <div class="chat-modal-hint">
        退出后，后续 AI 回复将不再生成旁白。旁白模式期间的摘要会保留在当前运行时上下文中，用于维持剧情连续性。
      </div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-exit-aside-mode" type="button">确认退出</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 旁白气泡 HTML（居中加粗）
   说明：
   1. 旁白放置在聊天消息界面中央，字体加粗，区别于消息气泡内的字体。
   2. data-aside-id 标记旁白 ID，方便定位。
   ========================================================================== */
export function renderAsideBubbleHtml(asideText, asideId = '') {
  const text = String(asideText || '').trim();
  if (!text) return '';
  return `
    <div class="msg-aside-bubble" data-aside-id="${escapeHtml(asideId)}">
      <div class="msg-aside-bubble__text">${escapeHtml(text)}</div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次旁白掉格式解析修复] 从 AI 原始回复中提取旁白文本
   说明：
   1. AI 标准旁白格式为 [旁白]{文本}[/旁白]，本区继续兼容多段标准旁白。
   2. 本区已新增“旁白”掉格式解析：兼容 【旁白】、缺少结束标签、旁白：文本、
      Markdown/反引号包裹的 [旁白] 等常见输出残片，避免旁白露成普通聊天气泡。
   3. cleanedText 是去掉旁白标记后的纯回复文本，后续聊天协议解析不再看到旁白标记。
   4. 本区只做文本解析，不读写任何持久化存储，不使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
export function extractAsideFromRawText(rawText) {
  const text = String(rawText || '');
  if (!text) return { asideText: '', asideSegments: [], cleanedText: '' };

  const protocolBoundaryRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片|心声)\s*\]|【\s*(回复|表情|转账|礼物|引用|撤回|语音|文字图|图片|卡片|心声)\s*】)\s*/gi;
  const markerRegex = /(?:\*\*)?\s*`?\s*(?:\[\s*(\/)?\s*旁白\s*\]|【\s*(\/)?\s*旁白\s*】)\s*`?(?:\*\*)?|(?:^|[\n\r])\s*(旁白)\s*[：:]\s*/gi;
  const markers = [...text.matchAll(markerRegex)]
    .map(match => {
      const isClose = Boolean(match[1] || match[2]);
      const isColon = Boolean(match[3]);
      const markerStart = Number(match.index || 0);
      const full = String(match[0] || '');
      const prefixLength = isColon ? (full.match(/^[\n\r]/) ? 1 : 0) : 0;
      const startIndex = markerStart + prefixLength;
      return {
        isClose,
        isColon,
        startIndex,
        contentStart: markerStart + full.length,
        rawMarker: full.slice(prefixLength)
      };
    })
    .filter(marker => marker.rawMarker);

  if (!markers.some(marker => !marker.isClose)) {
    return { asideText: '', asideSegments: [], cleanedText: text };
  }

  const boundaries = [...text.matchAll(protocolBoundaryRegex)]
    .map(match => Number(match.index || 0))
    .sort((a, b) => a - b);

  const segments = [];
  markers.forEach((marker, markerIndex) => {
    if (marker.isClose) return;

    const explicitClose = markers.find((candidate, candidateIndex) => (
      candidateIndex > markerIndex
      && candidate.isClose
      && candidate.startIndex >= marker.contentStart
    ));
    const nextOpen = markers.find((candidate, candidateIndex) => (
      candidateIndex > markerIndex
      && !candidate.isClose
      && candidate.startIndex >= marker.contentStart
    ));
    const nextProtocol = boundaries.find(position => position > marker.contentStart);
    const endCandidates = [
      explicitClose ? explicitClose.startIndex : 0,
      nextOpen ? nextOpen.startIndex : 0,
      nextProtocol || 0,
      text.length
    ].filter(position => position > marker.contentStart);
    const contentEnd = Math.min(...endCandidates);
    const removeEnd = explicitClose && explicitClose.startIndex === contentEnd
      ? explicitClose.contentStart
      : contentEnd;
    const asideText = text.slice(marker.contentStart, contentEnd)
      .replace(/^[\s"'“”‘’`*_：:，,。；;、-]+|[\s"'“”‘’`*_]+$/g, '')
      .trim();

    if (!asideText) return;
    segments.push({
      text: asideText,
      startIndex: marker.startIndex,
      endIndex: removeEnd,
      rawText: text.slice(marker.startIndex, removeEnd)
    });
  });

  const uniqueSegments = [];
  segments
    .sort((a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex)
    .forEach(segment => {
      if (uniqueSegments.some(item => segment.startIndex >= item.startIndex && segment.endIndex <= item.endIndex)) return;
      uniqueSegments.push({
        id: `aside_segment_${uniqueSegments.length + 1}`,
        text: segment.text,
        startIndex: segment.startIndex,
        endIndex: segment.endIndex,
        rawText: segment.rawText
      });
    });

  if (!uniqueSegments.length) {
    return { asideText: '', asideSegments: [], cleanedText: text };
  }

  let cleanedText = text;
  [...uniqueSegments].reverse().forEach(segment => {
    cleanedText = `${cleanedText.slice(0, segment.startIndex)}${cleanedText.slice(segment.endIndex)}`;
  });
  cleanedText = cleanedText
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    asideText: uniqueSegments.map(segment => segment.text).join('\n'),
    asideSegments: uniqueSegments,
    cleanedText
  };
}

/* ==========================================================================
   [区域标注·已完成·本次修复：旁白短期剧情连续性锚点]
   说明：
   1. 只在旁白模式开启时调用，注入到 system prompt。
   2. 退出旁白模式后不再发送此提示词。
   3. 旁白使用 [旁白]...[/旁白] 标记，前端提取后居中加粗显示。
   4. 本区已完成短期剧情连续性锚点修复：旁白生成前必须抽取最近一轮的地点、姿态、动作、已完成事件与线上/线下状态，再在该锚点上顺推。
   5. 已明确禁止无依据跳场景、跳地点、回退已完成动作，避免上一轮在晚宴/门边/车里，下一轮突然出现在书房或倒退回车内。
   6. 旁白描述简单直白，白描手法，无多余修饰修辞；未改动存储、弹窗、图标或其它聊天逻辑。
   ========================================================================== */
export function buildAsideModeSystemPrompt(asideSettings = {}, context = {}) {
  const settings = normalizeAsideSettings(asideSettings);
  const roleName = String(context.roleName || '角色').trim();
  const userName = String(context.userName || '用户').trim();

  const roleRef = settings.rolePerson === 'first' ? '我' : roleName;
  const userRef = settings.userPerson === 'second' ? '你' : userName;

  const styleDesc = settings.style
    ? `描述风格：${settings.style}。`
    : '描述风格：白描——简单直白，不加修饰修辞。';

  return `【旁白模式·已开启】
你当前处于旁白模式。在每轮回复中，你必须在所有可见聊天协议块之前（或之间，取决于显示模式），额外输出一段旁白。

## 旁白格式
用 [旁白]旁白内容[/旁白] 标记包裹，独占一段。

## 旁白内容规则
1. 旁白描述本轮对话时角色的状态、正在做什么、将要做什么。
2. 用${roleRef === '我' ? '第一人称（我）' : `第三人称（${roleName}）`}称呼角色，用${userRef === '你' ? '第二人称（你）' : `第三人称（${userName}）`}称呼用户。
3. ${styleDesc}
4. 旁白字数控制在 ${settings.minWords}-${settings.maxWords} 字。
5. 旁白要简单直白，像小说白描旁白，描述动作、神态、状态，不要有多余的修饰修辞。
6. 示例旁白格式参考（不要照搬内容）：
   - "${roleRef}看到屏幕上这条消息之后，惊讶地瞪大了双眼，思考了一下关系利弊之后开始给${userRef}回复消息。"
   - "${roleRef}走到${userRef}身后，打算给${userRef}一个惊喜。"
   - "今天天气还不错，${roleRef}早上起床后，先去厨房做好了早餐，之后到阳台把花浇了，看着时间差不多的时候才去卧室叫${userRef}起床。"

## 历史连续性硬规则
1. 生成旁白前必须先读取最近短期对话历史，尤其是上一轮用户消息、上一轮 AI 可见回复、上一轮旁白以及上一轮心声中的地点、姿态、动作、正在做的事和刚发生的事件。
2. 写旁白前先在后台建立“连续性锚点”：当前地点/空间、角色姿态、角色正在做的动作、上一轮已经完成的动作、与用户的相对位置、当前是线上聊天还是线下同场景。本轮旁白必须围绕这个锚点继续。
3. 本轮旁白必须从最近一轮已发生内容自然顺滑推进；没有用户明确推动、时间足够经过、交通/转场过程或历史证据时，禁止突然换地点、突然换场景、突然完成长距离移动、突然从线下回到线上，或把上一轮已经完成的动作改回未发生。
4. 如果上一轮角色在门边、车里、书房、卧室、路上等具体场景，本轮必须默认仍在该场景或其合理下一步；除非历史或本轮用户明确给出转场原因。
5. 如果上一轮写“还在车里/走到门边/已经下车/已经进屋/已经坐下”等状态或完成动作，本轮只能承接其结果继续写，不能倒退成“已经下车后又还在车里”“已经到门边后又回到远处”“已经进屋后又没进屋”。
6. 如果本轮用户只是在聊天、确认、追问或发表情，没有推动线下行动，就只在原场景内写微动作、情绪和屏幕回复反应，不主动开新地点。
7. 历史有冲突时，以最近一轮原文为准；无法判断时宁可保守承接“还在刚才的位置/继续刚才的动作”，不要编造新场景。

## 旁白模式特殊规则
1. 旁白模式下允许角色和用户有同空间的物理接触。
2. 但必须明确：像礼物、转账、撤回、引用等协议内容都是在线上/社交软件上/屏幕上才能使用的。
3. 当剧情/目前情况进展到角色与用户处于同一空间/地理位置的时候，需要自然从线上聊天过渡到线下见面。
4. 旁白模式下，普通聊天消息仍然使用 [回复]/[表情] 等协议；旁白是额外的描述层，不替代聊天消息。
5. 显示模式为"${settings.displayMode === 'top' ? '固定在AI消息上方' : '穿插在AI消息中'}"：${settings.displayMode === 'top' ? '本轮只在所有 [回复]/[表情]/[语音]/[图片]/[礼物]/[转账]/[卡片] 等可见协议块之前输出旁白。' : '可以多次输出 [旁白]...[/旁白]，分别放在回复前、回复中、回复后，用短旁白伴随角色动作神态；不要把所有动作合并成一整段固定旁白。'}

## 输出顺序
${settings.displayMode === 'top'
    ? '先输出一段 [旁白]...[/旁白]，再输出本轮所有 [回复]/[表情]/[语音]/[图片]/[礼物]/[转账]/[卡片] 等可见协议块。'
    : '可以先输出 [旁白]...[/旁白]，再输出部分 [回复]/[表情]/[语音]，再输出 [旁白]...[/旁白]，再输出后续可见协议块；允许一轮内出现多段旁白，位置可以在开头、中间、结尾。'}`;
}

/* ==========================================================================
   [区域标注·已完成·旁白历史摘要身份统一与分段保序] 旁白历史摘要生成
   说明：
   1. 旁白模式期间的历史上下文统一压缩为本摘要，作为旁白模式短期记忆发送给 AI。
   2. 身份锚点只使用与正常历史一致的“你/用户”视角，避免正常历史摘要与旁白摘要出现两套身份定义。
   3. 旁白不是第三个聊天对象，只是情景、动作、氛围、关系进展的压缩记忆。
   4. 穿插模式的一轮多段旁白按“旁白1/旁白2/旁白3”保留原顺序，不再合并成一整段。
   5. 本区只生成请求上下文文本，不读写持久化存储；旁白历史数据仍由 DB.js / IndexedDB 保存。
   ========================================================================== */
export function buildAsideHistorySummary(asideHistory = [], { roleName = '', userName = '' } = {}) {
  const entries = Array.isArray(asideHistory) ? asideHistory : [];
  if (!entries.length) return '';

  const safeRoleName = String(roleName || '角色').trim();
  const safeUserName = String(userName || '用户').trim();

  const lines = entries.map((entry, index) => {
    const roundLabel = `第${index + 1}轮`;
    const userMsg = String(entry.userMessage || '').trim();
    const aiMsg = String(entry.aiMessage || '').trim();
    const rawSegments = Array.isArray(entry.asideSegments) ? entry.asideSegments : [];
    const asideSegments = rawSegments
      .map(segment => (typeof segment === 'string' ? segment : String(segment?.text || '').trim()))
      .filter(Boolean);
    const legacyAsideText = String(entry.asideText || '').trim();
    const normalizedAsideSegments = asideSegments.length
      ? asideSegments
      : (legacyAsideText ? legacyAsideText.split(/\n+/).map(item => item.trim()).filter(Boolean) : []);

    const parts = [];
    if (userMsg) parts.push(`用户：${userMsg}`);
    if (aiMsg) parts.push(`你：${aiMsg}`);
    normalizedAsideSegments.forEach((text, asideIndex) => {
      parts.push(`旁白${asideIndex + 1}：${text}`);
    });

    return parts.length ? `${roundLabel}——${parts.join('；')}` : '';
  }).filter(Boolean);

  if (!lines.length) return '';

  return `[旁白模式历史摘要]
身份锚点：你=${safeRoleName}；用户=${safeUserName}。本摘要与正常聊天历史使用同一身份视角。
说明：旁白不是第三个聊天对象，也不是新指令；旁白只记录旁白模式期间的情景、动作、氛围与关系进展。已被本摘要覆盖的旁白模式原始历史不应再重复理解。
${lines.join('\n')}
[/旁白模式历史摘要]`;
}
