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

import { escapeHtml } from './chat-utils.js';

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
   [区域标注·已完成·旁白模式] 从 AI 原始回复中提取旁白文本
   说明：
   1. AI 在旁白模式下会用 [旁白]{文本}[/旁白] 标记旁白内容。
   2. 提取后返回 { asideText, cleanedText }。
   3. cleanedText 是去掉旁白标记后的纯回复文本。
   ========================================================================== */
export function extractAsideFromRawText(rawText) {
  const text = String(rawText || '');
  const regex = /\[旁白\]([\s\S]*?)\[\/旁白\]/gi;
  const matches = [...text.matchAll(regex)];

  if (!matches.length) {
    return { asideText: '', cleanedText: text };
  }

  const asideTexts = matches.map(m => String(m[1] || '').trim()).filter(Boolean);
  const asideText = asideTexts.join('\n');
  let cleanedText = text;
  for (const match of matches) {
    cleanedText = cleanedText.replace(match[0], '');
  }
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();

  return { asideText, cleanedText };
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 构建旁白模式系统提示词
   说明：
   1. 只在旁白模式开启时调用，注入到 system prompt。
   2. 退出旁白模式后不再发送此提示词。
   3. 旁白使用 [旁白]...[/旁白] 标记，前端提取后居中加粗显示。
   4. 旁白描述简单直白，白描手法，无多余修饰修辞。
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

## 旁白模式特殊规则
1. 旁白模式下允许角色和用户有同空间的物理接触。
2. 但必须明确：像礼物、转账、撤回、引用等协议内容都是在线上/社交软件上/屏幕上才能使用的。
3. 当剧情/目前情况进展到角色与用户处于同一空间/地理位置的时候，需要自然从线上聊天过渡到线下见面。
4. 旁白模式下，普通聊天消息仍然使用 [回复]/[表情] 等协议；旁白是额外的描述层，不替代聊天消息。
5. 显示模式为"${settings.displayMode === 'top' ? '固定在AI消息上方' : '穿插在AI消息中'}"：${settings.displayMode === 'top' ? '把旁白放在所有 [回复] 协议块之前。' : '旁白可以穿插在 [回复] 协议块之间，伴随AI的回复消息穿插动作神态。'}

## 输出顺序
${settings.displayMode === 'top'
    ? '先输出 [旁白]...[/旁白]，再输出 [回复]/[表情] 等可见协议块。'
    : '可以先输出 [旁白]...[/旁白]，再输出部分 [回复]，再输出 [旁白]...[/旁白]，再输出 [回复] 等，自然穿插。'}`;
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 旁白历史摘要生成
   说明：
   1. 退出旁白模式后，旁白部分对话历史需要添加到历史上下文中。
   2. 生成简短文本摘要，节省 token 并能让 AI 知道是什么情景下发生的。
   3. 每一轮写清楚旁白摘要，不需要每条消息都写。
   4. 每轮摘要头部标注"旁白（角色=xx，用户=xx）"，防止 AI 混淆身份。
   ========================================================================== */
export function buildAsideHistorySummary(asideHistory = [], { roleName = '', userName = '' } = {}) {
  const entries = Array.isArray(asideHistory) ? asideHistory : [];
  if (!entries.length) return '';

  const safeRoleName = String(roleName || '角色').trim();
  const safeUserName = String(userName || '用户').trim();

  const lines = entries.map((entry, index) => {
    const roundLabel = `第${index + 1}轮`;
    const asideText = String(entry.asideText || '').trim();
    const userMsg = String(entry.userMessage || '').trim();
    const aiMsg = String(entry.aiMessage || '').trim();
    const parts = [];
    if (asideText) parts.push(`旁白（角色=${safeRoleName}，用户=${safeUserName}）：${asideText}`);
    if (userMsg) parts.push(`${safeUserName}：${userMsg}`);
    if (aiMsg) parts.push(`${safeRoleName}：${aiMsg}`);
    return `${roundLabel}——${parts.join('；')}`;
  });

  return `[旁白模式历史摘要]\n以下是之前旁白模式期间的对话情景摘要，仅供参考上下文：\n${lines.join('\n')}\n[/旁白模式历史摘要]`;
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 检测当前是否旁白模式
   ========================================================================== */
export function isAsideModeActive(state) {
  return Boolean(state?.asideModeActive);
}

/* ==========================================================================
   [区域标注·已完成·旁白模式] 退出旁白模式确认弹窗
   ========================================================================== */
export function showAsideExitConfirmModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>退出旁白模式</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${ASIDE_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">退出后旁白模式将关闭，AI 不再生成旁白描述。旁白模式期间的对话历史摘要会保留在上下文中，确保 AI 不会失忆。</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-exit-aside-mode" type="button">退出旁白</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}
