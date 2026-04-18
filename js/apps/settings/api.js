import { Logger } from '../../utils/Logger.js';

/**
 * 文件名: js/apps/settings/api.js
 * 用途: 设置应用 - API 配置页（重构版）
 * 说明:
 * 1) 仅修改本文件，不影响其它设置页/应用页
 * 2) 删除旧占位：生图 API、MiniMax TTS
 * 3) 新增四家官方接口配置 + 主/副 API 板块 + 全局参数 + 测试连接/模型
 * 4) 本地持久化：settings.update + localStorage 双写
 */

const API_LOCAL_STORAGE_KEY = 'miniphone:api-config-v2';

const PROVIDER_META = {
  openai: {
    id: 'openai',
    label: 'OpenAI 官方接口',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini']
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini 官方接口',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro']
  },
  claude: {
    id: 'claude',
    label: 'Claude 官方接口',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-haiku-latest', 'claude-3-7-sonnet-latest', 'claude-sonnet-4-0']
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 官方接口',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner']
  }
};

// IconPark SVG（统一图标风格）
const ICONS = {
  api: `<svg viewBox="0 0 48 48" fill="none" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M40 12L24 4L8 12V36L24 44L40 36V12Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 44V24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M40 12L24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M8 12L24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  main: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M24 14V24L31 29" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  secondary: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M6 24C6 14.0589 14.0589 6 24 6C33.9411 6 42 14.0589 42 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M42 24C42 33.9411 33.9411 42 24 42C14.0589 42 6 33.9411 6 24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="4" fill="currentColor"/></svg>`,
  global: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" stroke-width="3"/><path d="M4 24H44" stroke="currentColor" stroke-width="3"/><path d="M24 4C24 4 32 11 32 24C32 37 24 44 24 44" stroke="currentColor" stroke-width="3"/><path d="M24 4C24 4 16 11 16 24C16 37 24 44 24 44" stroke="currentColor" stroke-width="3"/></svg>`,
  save: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 8H34L40 14V40H10V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 8V18H30V8" stroke="currentColor" stroke-width="3"/><path d="M16 30H32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  test: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M6 24H42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M28 12L42 24L28 36" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ok: `<svg viewBox="0 0 48 48" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M10 25L20 34L38 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg viewBox="0 0 48 48" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M18 18L30 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 18L18 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  chevron: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 18L24 32L38 18" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  openai: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="3"/><path d="M24 12L34 18V30L24 36L14 30V18L24 12Z" stroke="currentColor" stroke-width="3"/></svg>`,
  gemini: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M24 6L28.5 19.5L42 24L28.5 28.5L24 42L19.5 28.5L6 24L19.5 19.5L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  claude: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="32" height="32" rx="10" stroke="currentColor" stroke-width="3"/><path d="M18 24H30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  deepseek: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M8 24C8 15.1634 15.1634 8 24 8C32.8366 8 40 15.1634 40 24C40 32.8366 32.8366 40 24 40" stroke="currentColor" stroke-width="3"/><path d="M24 16V24L30 28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readApiConfigFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(API_LOCAL_STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParseJSON(raw);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function writeApiConfigToLocalStorage(config) {
  try {
    localStorage.setItem(API_LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    Logger.warn(`API 配置写入 localStorage 失败: ${error?.message || '未知错误'}`);
  }
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(value, min, max, fallback) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '\u0026amp;')
    .replaceAll('<', '\u0026lt;')
    .replaceAll('>', '\u0026gt;')
    .replaceAll('"', '\u0026quot;')
    .replaceAll("'", '\u0026#39;');
}

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function getDefaultApiSettings() {
  const providers = {};
  Object.keys(PROVIDER_META).forEach((id) => {
    const meta = PROVIDER_META[id];
    providers[id] = {
      apiKey: '',
      baseUrl: meta.defaultBaseUrl,
      model: meta.models[0],
      temperature: 0.7,
      maxTokens: 2048,
      stream: true
    };
  });

  return {
    version: 2,
    activeProfile: 'primary', // 全局默认响应通道
    primary: { provider: 'openai' },
    secondary: { provider: 'gemini' },
    global: {
      temperature: 0.7,
      maxTokens: 2048,
      useGlobalTemperature: true,
      useGlobalMaxTokens: false
    },
    providers
  };
}

function normalizeProviderId(providerId, fallback = 'openai') {
  return PROVIDER_META[providerId] ? providerId : fallback;
}

function normalizeApiSettings(inputApi) {
  const defaults = getDefaultApiSettings();
  const storageBackup = readApiConfigFromLocalStorage();
  const source =
    inputApi && inputApi.providers
      ? inputApi
      : (storageBackup && storageBackup.providers ? storageBackup : (inputApi || {}));

  const normalized = {
    version: 2,
    activeProfile: source.activeProfile === 'secondary' ? 'secondary' : 'primary',
    primary: {
      provider: normalizeProviderId(source?.primary?.provider, defaults.primary.provider)
    },
    secondary: {
      provider: normalizeProviderId(source?.secondary?.provider, defaults.secondary.provider)
    },
    global: {
      temperature: clampNumber(source?.global?.temperature, 0, 2, defaults.global.temperature),
      maxTokens: clampInt(source?.global?.maxTokens, 1, 32768, defaults.global.maxTokens),
      useGlobalTemperature:
        typeof source?.global?.useGlobalTemperature === 'boolean'
          ? source.global.useGlobalTemperature
          : defaults.global.useGlobalTemperature,
      useGlobalMaxTokens:
        typeof source?.global?.useGlobalMaxTokens === 'boolean'
          ? source.global.useGlobalMaxTokens
          : defaults.global.useGlobalMaxTokens
    },
    providers: {}
  };

  Object.keys(PROVIDER_META).forEach((id) => {
    const meta = PROVIDER_META[id];
    const providerSource = source?.providers?.[id] || {};
    normalized.providers[id] = {
      apiKey: providerSource.apiKey || '',
      baseUrl: providerSource.baseUrl || meta.defaultBaseUrl,
      model: providerSource.model || meta.models[0],
      temperature: clampNumber(providerSource.temperature, 0, 2, 0.7),
      maxTokens: clampInt(providerSource.maxTokens, 1, 32768, 2048),
      stream: typeof providerSource.stream === 'boolean' ? providerSource.stream : true
    };
  });

  return normalized;
}

function renderModelOptions(providerId, selectedModel) {
  const meta = PROVIDER_META[providerId];
  const baseOptions = [...meta.models];
  const selected = selectedModel || baseOptions[0];
  if (!baseOptions.includes(selected)) {
    baseOptions.unshift(selected);
  }

  return baseOptions
    .map((model) => {
      const selectedAttr = model === selected ? 'selected' : '';
      const customSuffix = meta.models.includes(model) ? '' : '（自定义）';
      return `<option value="${escapeHtml(model)}" ${selectedAttr}>${escapeHtml(model)}${customSuffix}</option>`;
    })
    .join('');
}

function renderProviderIcon(providerId) {
  return ICONS[providerId] || ICONS.api;
}

function renderProviderCard(providerId, providerConfig, expanded = false) {
  const meta = PROVIDER_META[providerId];
  const cardCollapsedClass = expanded ? '' : ' is-collapsed';
  const tempValue = Number(providerConfig.temperature || 0.7).toFixed(1);

  return `
    <section class="ui-card api-provider-card${cardCollapsedClass}" data-provider-card="${providerId}">
      <button class="api-provider-card__header" type="button" data-action="toggle-provider" data-provider="${providerId}">
        <span class="api-provider-card__title">
          <span class="api-provider-card__icon">${renderProviderIcon(providerId)}</span>
          <span>${meta.label}</span>
        </span>
        <span class="api-provider-card__chevron">${ICONS.chevron}</span>
      </button>

      <div class="api-provider-card__content">
        <div class="api-field-group">
          <label class="api-label" for="api-${providerId}-key">API Key</label>
          <input
            id="api-${providerId}-key"
            class="api-input"
            type="password"
            placeholder="请输入 ${meta.label} API Key"
            value="${escapeHtml(providerConfig.apiKey || '')}"
            autocomplete="off"
          >
        </div>

        <div class="api-field-group">
          <label class="api-label" for="api-${providerId}-url">接口地址 / Base URL</label>
          <input
            id="api-${providerId}-url"
            class="api-input"
            type="text"
            placeholder="${meta.defaultBaseUrl}"
            value="${escapeHtml(providerConfig.baseUrl || meta.defaultBaseUrl)}"
          >
        </div>

        <div class="api-field-group">
          <label class="api-label" for="api-${providerId}-model">模型选择</label>
          <select id="api-${providerId}-model" class="api-select">
            ${renderModelOptions(providerId, providerConfig.model)}
          </select>
        </div>

        <div class="api-field-group">
          <div class="api-label-row">
            <label class="api-label" for="api-${providerId}-temp">温度（Temperature）</label>
            <span class="api-inline-value" id="api-${providerId}-temp-value">${tempValue}</span>
          </div>
          <input
            id="api-${providerId}-temp"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value="${tempValue}"
            class="api-range"
          >
        </div>

        <div class="api-field-group">
          <label class="api-label" for="api-${providerId}-max-tokens">最大生成长度（maxTokens）</label>
          <input
            id="api-${providerId}-max-tokens"
            class="api-input"
            type="number"
            min="1"
            max="32768"
            step="1"
            value="${providerConfig.maxTokens || 2048}"
          >
        </div>

        <div class="api-row-between">
          <span class="api-label">流式输出（Stream）</span>
          <label class="ios-switch">
            <input id="api-${providerId}-stream" class="ios-switch__input" type="checkbox" ${providerConfig.stream ? 'checked' : ''}>
            <span class="ios-switch__slider"></span>
          </label>
        </div>

        <div class="api-actions">
          <button class="ui-button api-btn" data-action="save-provider" data-provider="${providerId}" type="button">
            <span class="api-btn__icon">${ICONS.save}</span>
            <span>保存当前配置</span>
          </button>
          <button class="ui-button api-btn api-btn--ghost" data-action="test-provider" data-test-type="connection" data-provider="${providerId}" type="button">
            <span class="api-btn__icon">${ICONS.test}</span>
            <span>测试连接</span>
          </button>
          <button class="ui-button api-btn api-btn--ghost" data-action="test-provider" data-test-type="model" data-provider="${providerId}" type="button">
            <span class="api-btn__icon">${ICONS.test}</span>
            <span>测试模型</span>
          </button>
        </div>

        <div class="api-test-result" id="api-${providerId}-test-result">
          <span class="api-test-result__icon">${ICONS.global}</span>
          <span class="api-test-result__text">尚未测试</span>
        </div>
      </div>
    </section>
  `;
}

export function renderApiSection({ current }) {
  const api = normalizeApiSettings(current?.api);

  const providerOptions = Object.keys(PROVIDER_META)
    .map((id) => {
      const selectedPrimary = api.primary.provider === id ? 'selected' : '';
      const selectedSecondary = api.secondary.provider === id ? 'selected' : '';
      return {
        id,
        label: PROVIDER_META[id].label,
        selectedPrimary,
        selectedSecondary
      };
    });

  const expandedProviders = new Set([api.primary.provider, api.secondary.provider]);
  expandedProviders.add('openai');

  return `
      <!-- API设置详情页（重构：主/副API + 四家官方接口 + 全局参数 + 测试功能） -->
      <div id="settings-api" class="settings-detail">
        <div class="settings-detail__body">
          <!-- 模块样式：仅作用于 API 设置页 -->
          <style>
            #settings-api .settings-detail__body { gap: 10px; }
            #settings-api .api-intro {
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }
            #settings-api .api-intro__icon {
              color: var(--c-ink, #2f2f2f);
              flex: 0 0 auto;
              margin-top: 2px;
            }
            #settings-api .api-intro__title {
              margin: 0;
              font-size: 14px;
              font-weight: 700;
              color: var(--c-ink, #2f2f2f);
            }
            #settings-api .api-intro__desc {
              margin: 4px 0 0;
              font-size: 12px;
              line-height: 1.5;
              color: var(--c-muted, #666);
            }

            #settings-api .api-section-title {
              display: flex;
              align-items: center;
              gap: 6px;
              margin: 0 0 10px;
              font-size: 13px;
              font-weight: 700;
              color: var(--c-ink, #2f2f2f);
            }
            #settings-api .api-section-title svg { color: currentColor; }

            #settings-api .api-profile-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 10px;
            }

            #settings-api .api-field-group {
              display: grid;
              gap: 6px;
            }
            #settings-api .api-label {
              font-size: 12px;
              color: var(--c-muted, #666);
            }
            #settings-api .api-label-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
            }
            #settings-api .api-inline-value {
              font-size: 12px;
              font-weight: 600;
              color: var(--c-ink, #222);
            }

            #settings-api .api-input,
            #settings-api .api-select {
              width: 100%;
              min-height: 36px;
              border: 1px solid rgba(0, 0, 0, 0.1);
              border-radius: 12px;
              background: rgba(255, 255, 255, 0.92);
              padding: 8px 10px;
              font-size: 12px;
              color: var(--c-ink, #222);
              outline: none;
              box-sizing: border-box;
            }
            #settings-api .api-input:focus,
            #settings-api .api-select:focus {
              border-color: rgba(59, 130, 246, 0.6);
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
            }

            #settings-api .api-range {
              width: 100%;
              accent-color: #0a84ff;
            }

            #settings-api .api-row-between {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }

            /* iPhone 风格开关 */
            #settings-api .ios-switch {
              position: relative;
              display: inline-block;
              width: 52px;
              height: 30px;
              flex: 0 0 auto;
            }
            #settings-api .ios-switch__input {
              opacity: 0;
              width: 0;
              height: 0;
            }
            #settings-api .ios-switch__slider {
              position: absolute;
              inset: 0;
              background: #d1d1d6;
              border-radius: 999px;
              transition: all 0.2s ease;
              box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
            }
            #settings-api .ios-switch__slider::before {
              content: "";
              position: absolute;
              left: 3px;
              top: 3px;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #fff;
              transition: transform 0.2s ease;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
            }
            #settings-api .ios-switch__input:checked + .ios-switch__slider {
              background: #34c759;
            }
            #settings-api .ios-switch__input:checked + .ios-switch__slider::before {
              transform: translateX(22px);
            }

            #settings-api .api-actions {
              display: grid;
              gap: 8px;
            }
            #settings-api .api-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              min-height: 36px;
              border-radius: 12px;
              border: 0;
              background: #0a84ff;
              color: #fff;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
            }
            #settings-api .api-btn--ghost {
              background: rgba(10, 132, 255, 0.1);
              color: #0a84ff;
            }
            #settings-api .api-btn[disabled] {
              opacity: 0.55;
              cursor: not-allowed;
            }
            #settings-api .api-btn__icon {
              line-height: 0;
              display: inline-flex;
            }

            #settings-api .api-provider-card {
              padding: 0;
              overflow: hidden;
            }
            #settings-api .api-provider-card__header {
              width: 100%;
              border: 0;
              background: transparent;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 8px;
              padding: 12px;
              cursor: pointer;
            }
            #settings-api .api-provider-card__title {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              font-weight: 700;
              color: var(--c-ink, #2f2f2f);
            }
            #settings-api .api-provider-card__icon {
              color: #111;
              line-height: 0;
            }
            #settings-api .api-provider-card__chevron {
              color: rgba(0, 0, 0, 0.45);
              line-height: 0;
              transition: transform 0.2s ease;
            }
            #settings-api .api-provider-card.is-collapsed .api-provider-card__chevron {
              transform: rotate(-90deg);
            }
            #settings-api .api-provider-card__content {
              border-top: 1px solid rgba(0, 0, 0, 0.06);
              padding: 12px;
              display: grid;
              gap: 10px;
            }
            #settings-api .api-provider-card.is-collapsed .api-provider-card__content {
              display: none;
            }

            #settings-api .api-test-result {
              display: flex;
              align-items: flex-start;
              gap: 6px;
              border-radius: 10px;
              font-size: 12px;
              line-height: 1.4;
              padding: 8px 10px;
              background: rgba(0, 0, 0, 0.04);
              color: var(--c-muted, #666);
              min-height: 34px;
            }
            #settings-api .api-test-result__icon {
              line-height: 0;
              margin-top: 1px;
              display: inline-flex;
            }
            #settings-api .api-test-result.is-success {
              background: rgba(52, 199, 89, 0.14);
              color: #1e8f43;
            }
            #settings-api .api-test-result.is-error {
              background: rgba(255, 59, 48, 0.14);
              color: #c4372d;
            }
            #settings-api .api-test-result.is-loading {
              background: rgba(10, 132, 255, 0.12);
              color: #0a84ff;
            }

            #settings-api .api-footer-actions {
              display: grid;
              grid-template-columns: 1fr;
              gap: 8px;
            }

            @media (min-width: 520px) {
              #settings-api .api-profile-grid {
                grid-template-columns: 1fr 1fr;
              }
            }
          </style>

          <!-- 模块A：顶部说明 -->
          <section class="ui-card">
            <div class="api-intro">
              <div class="api-intro__icon">${ICONS.api}</div>
              <div>
                <h3 class="api-intro__title">API 配置模块（主/副 API + 四平台）</h3>
                <p class="api-intro__desc">
                  已移除占位接口（生图 API / MiniMax TTS）。本页支持 OpenAI、Gemini、Claude、DeepSeek 官方接口配置，支持本地保存与实时测试。
                </p>
              </div>
            </div>
          </section>

          <!-- 模块B：主API / 副API 板块 -->
          <section class="ui-card">
            <h3 class="api-section-title">${ICONS.main}<span>主 API 与副 API</span></h3>
            <div class="api-profile-grid">
              <div class="api-field-group">
                <label class="api-label" for="api-primary-provider">主 API 服务商（全局默认首选）</label>
                <select id="api-primary-provider" class="api-select">
                  ${providerOptions.map((item) => `<option value="${item.id}" ${item.selectedPrimary}>${item.label}</option>`).join('')}
                </select>
              </div>
              <div class="api-field-group">
                <label class="api-label" for="api-secondary-provider">副 API 服务商（独立备用）</label>
                <select id="api-secondary-provider" class="api-select">
                  ${providerOptions.map((item) => `<option value="${item.id}" ${item.selectedSecondary}>${item.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="api-row-between" style="margin-top: 10px;">
              <span class="api-label" style="display:inline-flex;align-items:center;gap:6px;">
                ${ICONS.global}
                <span>默认全局响应通道使用主 API</span>
              </span>
              <label class="ios-switch">
                <input id="api-default-primary" class="ios-switch__input" type="checkbox" ${api.activeProfile === 'primary' ? 'checked' : ''}>
                <span class="ios-switch__slider"></span>
              </label>
            </div>
          </section>

          <!-- 模块C：全局模型参数 -->
          <section class="ui-card">
            <h3 class="api-section-title">${ICONS.global}<span>全局模型参数</span></h3>

            <div class="api-field-group">
              <div class="api-label-row">
                <label class="api-label" for="api-global-temperature">统一温度（Temperature）</label>
                <span class="api-inline-value" id="api-global-temperature-value">${Number(api.global.temperature).toFixed(1)}</span>
              </div>
              <input
                id="api-global-temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value="${Number(api.global.temperature).toFixed(1)}"
                class="api-range"
              >
            </div>

            <div class="api-field-group">
              <label class="api-label" for="api-global-max-tokens">统一最大生成长度（maxTokens）</label>
              <input id="api-global-max-tokens" class="api-input" type="number" min="1" max="32768" value="${api.global.maxTokens}">
            </div>

            <div class="api-row-between">
              <span class="api-label">启用统一温度参数</span>
              <label class="ios-switch">
                <input id="api-global-use-temp" class="ios-switch__input" type="checkbox" ${api.global.useGlobalTemperature ? 'checked' : ''}>
                <span class="ios-switch__slider"></span>
              </label>
            </div>

            <div class="api-row-between">
              <span class="api-label">启用统一 maxTokens 参数</span>
              <label class="ios-switch">
                <input id="api-global-use-max-tokens" class="ios-switch__input" type="checkbox" ${api.global.useGlobalMaxTokens ? 'checked' : ''}>
                <span class="ios-switch__slider"></span>
              </label>
            </div>
          </section>

          <!-- 模块D：四个服务商可折叠配置 -->
          ${Object.keys(PROVIDER_META)
            .map((providerId) => {
              const config = api.providers[providerId];
              const expanded = expandedProviders.has(providerId);
              return renderProviderCard(providerId, config, expanded);
            })
            .join('')}

          <!-- 模块E：全局保存操作 -->
          <section class="ui-card">
            <div class="api-footer-actions">
              <button class="ui-button api-btn" id="save-api-all" type="button">
                <span class="api-btn__icon">${ICONS.save}</span>
                <span>保存全部 API 设置</span>
              </button>
              <p class="ui-muted" style="margin:0;font-size:12px;">
                测试请求将从前端直接调用官方 API。若出现 CORS / 鉴权限制，会在测试结果中显示错误详情。
              </p>
            </div>
          </section>
        </div>
      </div>
  `;
}

function getProviderConfigFromForm(container, providerId) {
  const meta = PROVIDER_META[providerId];
  const key = container.querySelector(`#api-${providerId}-key`)?.value?.trim() || '';
  const baseUrlInput = container.querySelector(`#api-${providerId}-url`)?.value?.trim() || '';
  const model = container.querySelector(`#api-${providerId}-model`)?.value?.trim() || meta.models[0];
  const temp = container.querySelector(`#api-${providerId}-temp`)?.value;
  const maxTokens = container.querySelector(`#api-${providerId}-max-tokens`)?.value;
  const stream = !!container.querySelector(`#api-${providerId}-stream`)?.checked;

  return {
    apiKey: key,
    baseUrl: baseUrlInput || meta.defaultBaseUrl,
    model,
    temperature: clampNumber(temp, 0, 2, 0.7),
    maxTokens: clampInt(maxTokens, 1, 32768, 2048),
    stream
  };
}

function collectApiStateFromForm(container, fallbackApi) {
  const normalizedFallback = normalizeApiSettings(fallbackApi);
  const providerIds = Object.keys(PROVIDER_META);

  const providers = {};
  providerIds.forEach((id) => {
    providers[id] = getProviderConfigFromForm(container, id);
  });

  const primaryProvider = normalizeProviderId(
    container.querySelector('#api-primary-provider')?.value,
    normalizedFallback.primary.provider
  );

  const secondaryProvider = normalizeProviderId(
    container.querySelector('#api-secondary-provider')?.value,
    normalizedFallback.secondary.provider
  );

  const globalTemperature = clampNumber(
    container.querySelector('#api-global-temperature')?.value,
    0,
    2,
    normalizedFallback.global.temperature
  );

  const globalMaxTokens = clampInt(
    container.querySelector('#api-global-max-tokens')?.value,
    1,
    32768,
    normalizedFallback.global.maxTokens
  );

  return {
    version: 2,
    activeProfile: container.querySelector('#api-default-primary')?.checked ? 'primary' : 'secondary',
    primary: { provider: primaryProvider },
    secondary: { provider: secondaryProvider },
    global: {
      temperature: globalTemperature,
      maxTokens: globalMaxTokens,
      useGlobalTemperature: !!container.querySelector('#api-global-use-temp')?.checked,
      useGlobalMaxTokens: !!container.querySelector('#api-global-use-max-tokens')?.checked
    },
    providers
  };
}

function setTestResult(container, providerId, status, text) {
  const resultEl = container.querySelector(`#api-${providerId}-test-result`);
  if (!resultEl) return;

  resultEl.classList.remove('is-success', 'is-error', 'is-loading');
  if (status === 'success') resultEl.classList.add('is-success');
  if (status === 'error') resultEl.classList.add('is-error');
  if (status === 'loading') resultEl.classList.add('is-loading');

  const icon = status === 'success' ? ICONS.ok : status === 'error' ? ICONS.error : ICONS.global;
  resultEl.innerHTML = `
    <span class="api-test-result__icon">${icon}</span>
    <span class="api-test-result__text">${escapeHtml(text)}</span>
  `;
}

function extractApiErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return (
    payload?.error?.message ||
    payload?.error?.msg ||
    payload?.message ||
    payload?.detail ||
    fallback
  );
}

async function requestOpenAiLike(baseUrl, apiKey, model, temperature, maxTokens) {
  const url = `${trimSlash(baseUrl)}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      stream: false,
      messages: [{ role: 'user', content: '你好' }]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  const text = payload?.choices?.[0]?.message?.content || '';
  return text || '请求成功（无文本内容）';
}

async function requestGemini(baseUrl, apiKey, model, temperature, maxTokens) {
  const url = `${trimSlash(baseUrl)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: '你好' }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text || '请求成功（无文本内容）';
}

async function requestClaude(baseUrl, apiKey, model, temperature, maxTokens) {
  const url = `${trimSlash(baseUrl)}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: '你好' }]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));
  }

  const text =
    payload?.content?.find?.((item) => item?.type === 'text')?.text ||
    payload?.content?.[0]?.text ||
    '';
  return text || '请求成功（无文本内容）';
}

async function testProviderRequest(providerId, config, globalConfig, testType) {
  const effectiveTemperature = globalConfig.useGlobalTemperature
    ? globalConfig.temperature
    : config.temperature;

  const effectiveMaxTokens =
    testType === 'connection'
      ? 16
      : (globalConfig.useGlobalMaxTokens ? globalConfig.maxTokens : config.maxTokens);

  if (!config.apiKey) {
    throw new Error('API Key 不能为空');
  }

  switch (providerId) {
    case 'openai':
      return requestOpenAiLike(
        config.baseUrl || PROVIDER_META.openai.defaultBaseUrl,
        config.apiKey,
        config.model,
        effectiveTemperature,
        effectiveMaxTokens
      );
    case 'deepseek':
      return requestOpenAiLike(
        config.baseUrl || PROVIDER_META.deepseek.defaultBaseUrl,
        config.apiKey,
        config.model,
        effectiveTemperature,
        effectiveMaxTokens
      );
    case 'gemini':
      return requestGemini(
        config.baseUrl || PROVIDER_META.gemini.defaultBaseUrl,
        config.apiKey,
        config.model,
        effectiveTemperature,
        effectiveMaxTokens
      );
    case 'claude':
      return requestClaude(
        config.baseUrl || PROVIDER_META.claude.defaultBaseUrl,
        config.apiKey,
        config.model,
        effectiveTemperature,
        effectiveMaxTokens
      );
    default:
      throw new Error(`不支持的服务商: ${providerId}`);
  }
}

export function bindApiEvents(container, { settings }) {
  // 读当前 settings，优先使用 settings 里的配置；若缺失则回退 localStorage
  let currentApiCache = null;
  settings
    .getAll()
    .then((all) => {
      currentApiCache = normalizeApiSettings(all?.api);
    })
    .catch(() => {
      currentApiCache = normalizeApiSettings({});
    });

  const providerIds = Object.keys(PROVIDER_META);

  // 温度滑块显示值同步
  const updateRangeValue = (inputSelector, outputSelector) => {
    const input = container.querySelector(inputSelector);
    const output = container.querySelector(outputSelector);
    if (!input || !output) return;
    const sync = () => {
      output.textContent = Number(input.value || 0).toFixed(1);
    };
    input.addEventListener('input', sync);
    sync();
  };

  updateRangeValue('#api-global-temperature', '#api-global-temperature-value');
  providerIds.forEach((id) => {
    updateRangeValue(`#api-${id}-temp`, `#api-${id}-temp-value`);
  });

  // 服务商折叠展开
  container.querySelectorAll('[data-action="toggle-provider"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const providerId = btn.getAttribute('data-provider');
      const card = container.querySelector(`[data-provider-card="${providerId}"]`);
      if (!card) return;
      card.classList.toggle('is-collapsed');
    });
  });

  // 保存（全量）
  const saveAllApiSettings = async (saveNote = 'API 设置已保存') => {
    const fallback = currentApiCache || normalizeApiSettings({});
    const nextApi = collectApiStateFromForm(container, fallback);

    await settings.update({ api: nextApi });
    writeApiConfigToLocalStorage(nextApi);
    currentApiCache = nextApi;

    Logger.info(saveNote);
    return nextApi;
  };

  // 保存全部按钮
  container.querySelector('#save-api-all')?.addEventListener('click', async () => {
    try {
      await saveAllApiSettings('API 全量设置已保存');
      providerIds.forEach((id) => {
        setTestResult(container, id, 'success', '配置已保存');
      });
    } catch (error) {
      Logger.error(`保存 API 设置失败: ${error?.message || '未知错误'}`);
      providerIds.forEach((id) => {
        setTestResult(container, id, 'error', `保存失败：${error?.message || '未知错误'}`);
      });
    }
  });

  // 每个服务商保存按钮
  container.querySelectorAll('[data-action="save-provider"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const providerId = btn.getAttribute('data-provider');
      if (!providerId) return;
      try {
        await saveAllApiSettings(`${PROVIDER_META[providerId].label} 配置已保存`);
        setTestResult(container, providerId, 'success', '当前服务商配置已保存');
      } catch (error) {
        setTestResult(container, providerId, 'error', `保存失败：${error?.message || '未知错误'}`);
      }
    });
  });

  // 测试按钮（连接 / 模型）
  container.querySelectorAll('[data-action="test-provider"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const providerId = btn.getAttribute('data-provider');
      const testType = btn.getAttribute('data-test-type') || 'connection';
      if (!providerId) return;

      const fallback = currentApiCache || normalizeApiSettings({});
      const snapshot = collectApiStateFromForm(container, fallback);
      const providerConfig = snapshot.providers[providerId];
      const startAt = performance.now();

      const buttonGroup = container.querySelectorAll(
        `[data-action="test-provider"][data-provider="${providerId}"]`
      );
      buttonGroup.forEach((b) => b.setAttribute('disabled', 'disabled'));

      setTestResult(
        container,
        providerId,
        'loading',
        testType === 'connection' ? '正在测试连接...' : '正在测试模型...'
      );

      try {
        const text = await testProviderRequest(
          providerId,
          providerConfig,
          snapshot.global,
          testType
        );
        const cost = Math.max(1, Math.round(performance.now() - startAt));
        const preview = String(text || '').slice(0, 120);
        setTestResult(container, providerId, 'success', `成功（${cost}ms）：${preview}`);
      } catch (error) {
        const cost = Math.max(1, Math.round(performance.now() - startAt));
        setTestResult(
          container,
          providerId,
          'error',
          `失败（${cost}ms）：${error?.message || '未知错误'}`
        );
      } finally {
        buttonGroup.forEach((b) => b.removeAttribute('disabled'));
      }
    });
  });
}
