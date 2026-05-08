/* ==========================================================================
   [区域标注·已完成·语言翻译] 闲谈应用 — 语言翻译模块
   说明：
   1. 本文件为语言翻译功能的独立 JS 模块，负责：
      - 渲染聊天设置页中的「语言翻译」折叠栏 HTML
      - 渲染消息气泡内的翻译区域 HTML
      - 处理语言选择弹窗（自定义弹窗，非原生 select）
      - 管理翻译设置的读取/保存（仅用 IndexedDB / dbPut / dbGet）
   2. 所有持久化严格使用项目 db.js 模块（chat-utils.js 导出的 dbGet / dbPut），
      禁止 localStorage / sessionStorage。
   3. 图标使用 IconPark 字节跳动开源 SVG 图标。
   4. 所有 data-action 属性使用 "trans-" 前缀，与 index.js 事件委托对齐。
   ========================================================================== */

import { dbPut } from './chat-utils.js';

// ===== 语言翻译：支持的语言列表 =====
export const TRANSLATION_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁体中文' },
  { code: 'en',    label: '英语' },
  { code: 'ja',    label: '日语' },
  { code: 'de',    label: '德语' },
  { code: 'es',    label: '西班牙语' },
  { code: 'fr',    label: '法语' },
  { code: 'it',    label: '意大利语' },
  { code: 'hi',    label: '印地语' },
  { code: 'ar',    label: '阿拉伯语' }
];

// ===== 语言翻译：默认设置 =====
export function getDefaultTranslationSettings() {
  return {
    enabled: false,               // 总开关
    displayMode: 'inline',        // 'inline'=直接展开 | 'tap'=双击展开
    character: {
      enabled: true,              // 是否给角色翻译
      sourceLang: 'zh-CN',       // 角色当前使用的语言
      targetLang: 'zh-CN'        // 需要翻译成的语言
    },
    user: {
      enabled: true,              // 是否给用户翻译
      sourceLang: 'zh-CN',       // 用户当前使用的语言
      targetLang: 'zh-CN'        // 需要翻译成的语言
    }
  };
}

// ===== 语言翻译：规范化设置 =====
export function normalizeTranslationSettings(raw) {
  const defaults = getDefaultTranslationSettings();
  if (!raw || typeof raw !== 'object') return { ...defaults };
  const validCodes = TRANSLATION_LANGUAGES.map(l => l.code);
  const validLang = (v) => validCodes.includes(v) ? v : 'zh-CN';
  const charRaw = raw.character && typeof raw.character === 'object' ? raw.character : {};
  const userRaw = raw.user && typeof raw.user === 'object' ? raw.user : {};
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    displayMode: ['inline', 'tap'].includes(raw.displayMode) ? raw.displayMode : defaults.displayMode,
    character: {
      enabled: typeof charRaw.enabled === 'boolean' ? charRaw.enabled : defaults.character.enabled,
      sourceLang: validLang(charRaw.sourceLang),
      targetLang: validLang(charRaw.targetLang)
    },
    user: {
      enabled: typeof userRaw.enabled === 'boolean' ? userRaw.enabled : defaults.user.enabled,
      sourceLang: validLang(userRaw.sourceLang),
      targetLang: validLang(userRaw.targetLang)
    }
  };
}

// ===== 语言翻译：IconPark 图标 =====
const TRANSLATION_ICONS = {
  // IconPark - Translate (翻译图标)
  translate: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M4 9h18M13 4v5M7 9c1 7.333 5 14.333 12 21M17 9c-1.333 5.333-4.333 10.667-9 16" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 44l7-16 7 16M27 40h10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark - Down (下箭头)
  arrowDown: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M36 18L24 30 12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark - Down (小箭头)
  smallArrow: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M36 18L24 30 12 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

function getLangLabel(code) {
  const lang = TRANSLATION_LANGUAGES.find(l => l.code === code);
  return lang ? lang.label : '简体中文';
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

/* ==========================================================================
   [区域标注·已完成·本次语言翻译设置去图标] 渲染设置页折叠栏 HTML
   说明：
   1. 本区域负责聊天设置页「语言翻译」折叠栏 HTML。
   2. 本次已移除标题左侧翻译图标，仅保留标题文字、展开箭头与 iPhone 风格开关。
   3. 所有 data-action 继续使用 "trans-" 前缀，与 index.js 事件委托 action.startsWith('trans-') 对齐。
   ========================================================================== */
export function renderTranslationSettingsHtml(translationSettings, session, userAvatar, userName) {
  const ts = normalizeTranslationSettings(translationSettings);
  const isOpen = false; // 折叠栏默认折叠
  const charAvatar = session?.avatar
    ? `<img src="${escapeHtml(session.avatar)}" alt="">`
    : escapeHtml((session?.name || '?').charAt(0).toUpperCase());
  const userAvatarHtml = userAvatar
    ? `<img src="${escapeHtml(userAvatar)}" alt="${escapeHtml(userName)}">`
    : `<span>${escapeHtml((userName || '我').charAt(0))}</span>`;

  return `
    <!-- ===== 闲谈应用：语言翻译设置 START ===== -->
    <div class="msg-translation-section ${isOpen ? 'is-open' : ''}" data-role="trans-section">
      <div class="msg-translation-header" data-action="trans-toggle-section">
        <div class="msg-translation-header__left">
          <span class="msg-translation-header__title">语言翻译</span>
          <span class="msg-translation-header__arrow">${TRANSLATION_ICONS.arrowDown}</span>
        </div>
        <div class="msg-translation-header__switch" data-action="trans-toggle-enabled">
          <div class="msg-ios-switch ${ts.enabled ? 'is-on' : ''}" data-role="trans-enabled-switch"></div>
        </div>
      </div>
      <div class="msg-translation-body">
        <div class="msg-translation-body__inner">

          <!-- 角色翻译配置 -->
          <div class="msg-translation-target" data-translation-target="character">
            <div class="msg-translation-target__avatar">${charAvatar}</div>
            <div class="msg-translation-target__config">
              <div class="msg-translation-target__label">角色语言翻译</div>
              <div class="msg-translation-target__row">
                <span class="msg-translation-target__row-label">当前语言</span>
                <button class="msg-translation-lang-btn" data-action="trans-pick-lang" data-target="character" data-field="sourceLang" type="button">
                  ${getLangLabel(ts.character.sourceLang)}${TRANSLATION_ICONS.smallArrow}
                </button>
              </div>
              <div class="msg-translation-target__row">
                <span class="msg-translation-target__row-label">翻译为</span>
                <button class="msg-translation-lang-btn" data-action="trans-pick-lang" data-target="character" data-field="targetLang" type="button">
                  ${getLangLabel(ts.character.targetLang)}${TRANSLATION_ICONS.smallArrow}
                </button>
              </div>
            </div>
          </div>

          <!-- 用户翻译配置 -->
          <div class="msg-translation-target" data-translation-target="user">
            <div class="msg-translation-target__avatar msg-translation-target__avatar--user">${userAvatarHtml}</div>
            <div class="msg-translation-target__config">
              <div class="msg-translation-target__label">用户语言翻译</div>
              <div class="msg-translation-target__row">
                <span class="msg-translation-target__row-label">当前语言</span>
                <button class="msg-translation-lang-btn" data-action="trans-pick-lang" data-target="user" data-field="sourceLang" type="button">
                  ${getLangLabel(ts.user.sourceLang)}${TRANSLATION_ICONS.smallArrow}
                </button>
              </div>
              <div class="msg-translation-target__row">
                <span class="msg-translation-target__row-label">翻译为</span>
                <button class="msg-translation-lang-btn" data-action="trans-pick-lang" data-target="user" data-field="targetLang" type="button">
                  ${getLangLabel(ts.user.targetLang)}${TRANSLATION_ICONS.smallArrow}
                </button>
              </div>
            </div>
          </div>

          <!-- 显示模式选择 -->
          <div class="msg-translation-display-mode">
            <div class="msg-translation-display-mode__title">翻译显示方式</div>
            <div class="msg-translation-display-mode__options">
              <div class="msg-translation-display-mode__option ${ts.displayMode === 'inline' ? 'is-active' : ''}" data-action="trans-set-display" data-mode="inline">
                直接展开
              </div>
              <div class="msg-translation-display-mode__option ${ts.displayMode === 'tap' ? 'is-active' : ''}" data-action="trans-set-display" data-mode="tap">
                双击展开
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    <!-- ===== 闲谈应用：语言翻译设置 END ===== -->
  `;
}

// ===== 语言翻译：渲染消息气泡内翻译区域 HTML =====
export function renderTranslationBubbleHtml(message, translationSettings, isUser) {
  const ts = normalizeTranslationSettings(translationSettings);
  if (!ts.enabled) return '';

  const targetConfig = isUser ? ts.user : ts.character;
  if (!targetConfig.enabled) return '';
  if (targetConfig.sourceLang === targetConfig.targetLang) return '';

  // 获取已缓存的翻译文本（存储在 message 对象上）
  const translatedText = message?._translatedText || '';
  const isLoading = message?._translationLoading === true;
  const displayClass = ts.displayMode === 'inline'
    ? 'msg-translation-bubble--inline'
    : 'msg-translation-bubble--tap-expand';

  const contentHtml = isLoading
    ? `<div class="msg-translation-bubble__loading">翻译中...</div>`
    : translatedText
      ? `<div class="msg-translation-bubble__text">${escapeHtml(translatedText)}</div>`
      : `<div class="msg-translation-bubble__loading">等待翻译...</div>`;

  return `
    <div class="msg-translation-bubble ${displayClass}" data-role="trans-bubble" data-message-id="${escapeHtml(message?.id || '')}">
      <hr class="msg-translation-bubble__divider">
      ${contentHtml}
    </div>
  `;
}

// ===== 语言翻译：打开语言选择弹窗（自定义弹窗，非原生 select） =====
export function openLanguagePickerModal(currentLangCode, onSelect) {
  // 移除可能存在的旧弹窗
  const existing = document.querySelector('.msg-translation-lang-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'msg-translation-lang-modal-overlay';
  overlay.innerHTML = `
    <div class="msg-translation-lang-modal">
      <div class="msg-translation-lang-modal__header">选择语言</div>
      <div class="msg-translation-lang-modal__list">
        ${TRANSLATION_LANGUAGES.map(lang => `
          <div class="msg-translation-lang-modal__item ${lang.code === currentLangCode ? 'is-selected' : ''}"
               data-lang-code="${lang.code}">
            ${lang.label}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      return;
    }
    const item = e.target.closest('.msg-translation-lang-modal__item');
    if (item) {
      const code = item.dataset.langCode;
      overlay.remove();
      if (code && typeof onSelect === 'function') onSelect(code);
    }
  });

  document.body.appendChild(overlay);
}

/* ==========================================================================
   [区域标注·已完成·语言翻译] 设置页事件委托处理器
   说明：
   1. 函数签名与 index.js 的调用方式对齐：
      handleTranslationSettingsClick(e, target, action, state, container, db)
   2. action 参数为 "trans-*" 前缀的字符串，由 index.js 预先提取。
   3. 翻译设置存储在 state.translationSettings，持久化到 IndexedDB。
   4. 存储键名格式：chat_translation_settings::${chatId}
   ========================================================================== */
export async function handleTranslationSettingsClick(e, target, action, state, container, db) {
  if (!action || !action.startsWith('trans-')) return false;

  // --- 辅助：持久化翻译设置到 IndexedDB ---
  const persistTranslation = async () => {
    if (!state.currentChatId || !db) return;
    const key = `chat_translation_settings::${state.activeMaskId || 'default'}::${state.currentChatId || 'none'}`;
    try {
      await dbPut(db, key, state.translationSettings);
    } catch (err) {
      console.warn('[chat-translation] 持久化翻译设置失败:', err);
    }
  };

  // --- 确保 state.translationSettings 已初始化 ---
  if (!state.translationSettings) {
    state.translationSettings = normalizeTranslationSettings(null);
  }

  switch (action) {
    // ===== 折叠栏展开/折叠 =====
    case 'trans-toggle-section': {
      // 若点击的是开关区域则忽略，由 trans-toggle-enabled 处理
      if (e.target.closest('[data-action="trans-toggle-enabled"]')) return false;
      const section = container.querySelector('[data-role="trans-section"]');
      if (section) section.classList.toggle('is-open');
      return true;
    }

    // ===== 总开关 =====
    case 'trans-toggle-enabled': {
      e.stopPropagation(); // 阻止冒泡到折叠栏
      state.translationSettings.enabled = !state.translationSettings.enabled;
      const sw = container.querySelector('[data-role="trans-enabled-switch"]');
      if (sw) sw.classList.toggle('is-on', state.translationSettings.enabled);
      await persistTranslation();
      return true;
    }

    // ===== 选择语言 =====
    case 'trans-pick-lang': {
      const tgt = target.dataset.target;   // 'character' | 'user'
      const field = target.dataset.field;   // 'sourceLang' | 'targetLang'
      if (!tgt || !field) return false;
      const currentCode = state.translationSettings[tgt]?.[field] || 'zh-CN';
      openLanguagePickerModal(currentCode, async (code) => {
        if (!state.translationSettings[tgt]) {
          state.translationSettings[tgt] = { enabled: true, sourceLang: 'zh-CN', targetLang: 'zh-CN' };
        }
        state.translationSettings[tgt][field] = code;
        target.innerHTML = getLangLabel(code) + TRANSLATION_ICONS.smallArrow;
        await persistTranslation();
      });
      return true;
    }

    // ===== 显示模式 =====
    case 'trans-set-display': {
      const mode = target.dataset.mode;
      if (!mode || !['inline', 'tap'].includes(mode)) return false;
      state.translationSettings.displayMode = mode;
      const options = container.querySelectorAll('.msg-translation-display-mode__option');
      options.forEach(opt => opt.classList.toggle('is-active', opt.dataset.mode === mode));
      await persistTranslation();
      return true;
    }

    default:
      return false;
  }
}

// ===== 语言翻译：双击气泡展开翻译 =====
export function handleTranslationBubbleDblClick(e, container, translationSettings) {
  const ts = normalizeTranslationSettings(translationSettings);
  if (!ts.enabled || ts.displayMode !== 'tap') return;

  const bubble = e.target.closest('.msg-bubble');
  if (!bubble) return;
  const translationBubble = bubble.querySelector('.msg-translation-bubble--tap-expand');
  if (translationBubble) {
    translationBubble.classList.toggle('is-expanded');
  }
}
