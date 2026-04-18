import { Logger } from '../../utils/Logger.js';

const STORAGE_KEY = 'miniphone:global-api-config';

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI 官方接口' },
  { value: 'gemini', label: 'Gemini 官方接口' },
  { value: 'claude', label: 'Claude 官方接口' },
  { value: 'deepseek', label: 'DeepSeek 官方接口' }
];

const PROVIDER_META = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4o'],
    supportsStream: true
  },
  gemini: {
    name: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    supportsStream: true
  },
  claude: {
    name: 'Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
    supportsStream: true
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    supportsStream: true
  }
};

const ICONS = {
  main: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M24 4L29.8779 16.1221L42 22L29.8779 27.8779L24 40L18.1221 27.8779L6 22L18.1221 16.1221L24 4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M36 8L38 12L42 14L38 16L36 20L34 16L30 14L34 12L36 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  secondary: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M10 24C10 16.268 16.268 10 24 10C31.732 10 38 16.268 38 24C38 31.732 31.732 38 24 38C16.268 38 10 31.732 10 24Z" stroke="currentColor" stroke-width="3"/><path d="M24 6V14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 34V42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M42 24H34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 24H6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  chevron: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M14 20L24 30L34 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  save: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M10 8H34L40 14V40H10V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 8V18H30V8" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 30H32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 24H24" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  test: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" stroke-width="3"/><path d="M18 24L22 28L31 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  result: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M8 10C8 8.89543 8.89543 8 10 8H38C39.1046 8 40 8.89543 40 10V38C40 39.1046 39.1046 40 38 40H10C8.89543 40 8 39.1046 8 38V10Z" stroke="currentColor" stroke-width="3"/><path d="M16 18H32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 24H32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 30H26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M14 14L34 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

function createDefaultRoleConfig(role = 'main', overrides = {}) {
  const defaultProvider = role === 'main' ? 'openai' : 'gemini';
  const meta = PROVIDER_META[defaultProvider];
  return {
    role,
    provider: defaultProvider,
    apiKey: '',
    baseUrl: meta.defaultBaseUrl,
    model: meta.models[0],
    temperature: 0.7,
    maxTokens: role === 'main' ? 2048 : 512,
    stream: role === 'secondary',
    enabled: true,
    lastTest: null,
    ...overrides
  };
}

function createDefaultGlobalApiConfig() {
  return {
    version: 1,
    mainApi: createDefaultRoleConfig('main'),
    secondaryApi: createDefaultRoleConfig('secondary'),
    legacy: {
      textToImage: { baseUrl: '', apiKey: '' },
      minimaxTTS: { baseUrl: '', apiKey: '', voiceId: '' }
    }
  };
}

function clampTemperature(value) {
  const next = Number(value);
  if (Number.isNaN(next)) return 0.7;
  return Math.max(0, Math.min(2, Number(next.toFixed(1))));
}

function clampMaxTokens(value, fallback = 1024) {
  const next = Number.parseInt(value, 10);
  if (Number.isNaN(next) || next <= 0) return fallback;
  return Math.min(next, 32768);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#39;');
}

function getMeta(provider) {
  return PROVIDER_META[provider] || PROVIDER_META.openai;
}

function mergeRoleConfig(role, source = {}) {
  const fallback = createDefaultRoleConfig(role);
  const provider = source.provider && PROVIDER_META[source.provider] ? source.provider : fallback.provider;
  const meta = getMeta(provider);
  const model = typeof source.model === 'string' && source.model.trim()
    ? source.model.trim()
    : meta.models[0];

  return {
    ...fallback,
    ...source,
    provider,
    apiKey: typeof source.apiKey === 'string' ? source.apiKey : fallback.apiKey,
    baseUrl: typeof source.baseUrl === 'string' && source.baseUrl.trim()
      ? source.baseUrl.trim()
      : meta.defaultBaseUrl,
    model,
    temperature: clampTemperature(source.temperature ?? fallback.temperature),
    maxTokens: clampMaxTokens(source.maxTokens ?? fallback.maxTokens, fallback.maxTokens),
    stream: typeof source.stream === 'boolean' ? source.stream : fallback.stream,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled
  };
}

function normalizeApiConfig(current = {}) {
  let localConfig = null;

  try {
    localConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    localConfig = null;
  }

  const settingsApi = current.api || {};
  const base = createDefaultGlobalApiConfig();

  const mainSource = localConfig?.mainApi || settingsApi.mainApi || settingsApi.primaryApi || null;
  const secondarySource = localConfig?.secondaryApi || settingsApi.secondaryApi || settingsApi.secondary || null;

  return {
    ...base,
    ...localConfig,
    mainApi: mergeRoleConfig('main', mainSource),
    secondaryApi: mergeRoleConfig('secondary', secondarySource),
    legacy: {
      textToImage: settingsApi.textToImage || base.legacy.textToImage,
      minimaxTTS: settingsApi.minimaxTTS || base.legacy.minimaxTTS
    }
  };
}

function renderProviderOptions(selectedProvider) {
  return DEFAULT_PROVIDER_OPTIONS
    .map((item) => `<option value="${item.value}" ${item.value === selectedProvider ? 'selected' : ''}>${item.label}</option>`)
    .join('');
}

function renderModelOptions(provider, selectedModel) {
  const meta = getMeta(provider);
  const models = [...meta.models];

  if (selectedModel && !models.includes(selectedModel)) {
    models.unshift(selectedModel);
  }

  return models
    .map((model) => `<option value="${escapeHtml(model)}" ${model === selectedModel ? 'selected' : ''}>${escapeHtml(model)}</option>`)
    .join('');
}

function renderSwitch({ id, checked, label, description }) {
  return `
    <label class="api-switch-row" for="${id}">
      <div class="api-switch-row__content">
        <span class="api-switch-row__label">${escapeHtml(label)}</span>
        ${description ? `<span class="api-switch-row__desc">${escapeHtml(description)}</span>` : ''}
      </div>
      <span class="ios-switch">
        <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
        <span class="ios-switch__slider" aria-hidden="true"></span>
      </span>
    </label>
  `;
}

function renderApiBlock({ roleKey, title, description, icon, config }) {
  const isMain = roleKey === 'mainApi';
  const temperatureValue = clampTemperature(config.temperature).toFixed(1);
  const sectionId = `api-role-${roleKey}`;

  return `
    <section class="ui-card api-role-card" data-role="${roleKey}">
      <button class="api-role-card__header" type="button" data-action="toggle-role" data-target="${sectionId}" aria-expanded="true">
        <div class="api-role-card__title-wrap">
          <span class="api-role-card__badge ${isMain ? 'is-main' : 'is-secondary'}">${icon}${escapeHtml(title)}</span>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="ui-muted api-role-card__desc">${escapeHtml(description)}</p>
          </div>
        </div>
        <span class="api-role-card__chevron">${ICONS.chevron}</span>
      </button>

      <div id="${sectionId}" class="api-role-card__body is-open">
        <div class="api-grid">
          <div class="api-field">
            <label for="${roleKey}-provider">服务商</label>
            <select id="${roleKey}-provider" data-field="provider" data-role="${roleKey}">
              ${renderProviderOptions(config.provider)}
            </select>
          </div>

          <div class="api-field">
            <label for="${roleKey}-model">模型</label>
            <select id="${roleKey}-model" data-field="model" data-role="${roleKey}">
              ${renderModelOptions(config.provider, config.model)}
            </select>
          </div>

          <div class="api-field api-field--full">
            <label for="${roleKey}-baseUrl">Base URL / 接口地址</label>
            <input
              id="${roleKey}-baseUrl"
              data-field="baseUrl"
              data-role="${roleKey}"
              type="url"
              placeholder="请输入接口地址"
              value="${escapeHtml(config.baseUrl)}"
            >
          </div>

          <div class="api-field api-field--full">
            <label for="${roleKey}-apiKey">API Key</label>
            <input
              id="${roleKey}-apiKey"
              data-field="apiKey"
              data-role="${roleKey}"
              type="password"
              placeholder="请输入 API Key"
              value="${escapeHtml(config.apiKey)}"
              autocomplete="off"
            >
          </div>

          <div class="api-field api-field--full">
            <div class="api-range-row">
              <label for="${roleKey}-temperature">温度（temperature）</label>
              <span id="${roleKey}-temperature-value" class="api-range-row__value">${temperatureValue}</span>
            </div>
            <input
              id="${roleKey}-temperature"
              data-field="temperature"
              data-role="${roleKey}"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value="${temperatureValue}"
            >
          </div>

          <div class="api-field">
            <label for="${roleKey}-maxTokens">最大生成长度</label>
            <input
              id="${roleKey}-maxTokens"
              data-field="maxTokens"
              data-role="${roleKey}"
              type="number"
              min="1"
              max="32768"
              step="1"
              value="${escapeHtml(String(config.maxTokens))}"
            >
          </div>

          <div class="api-field api-field--switches">
            ${renderSwitch({
              id: `${roleKey}-stream`,
              checked: !!config.stream,
              label: '流式输出',
              description: '优先返回首段内容，适合快速反馈'
            })}
            ${renderSwitch({
              id: `${roleKey}-enabled`,
              checked: !!config.enabled,
              label: '启用此 API',
              description: '关闭后保留配置但不建议业务调用'
            })}
          </div>
        </div>

        <div class="api-actions">
          <button class="ui-button primary api-action-button" type="button" data-action="save-role" data-role="${roleKey}">
            ${ICONS.save}
            <span>保存当前配置</span>
          </button>
          <button class="ui-button api-action-button" type="button" data-action="test-role" data-role="${roleKey}">
            ${ICONS.test}
            <span>测试连接 / 测试模型</span>
          </button>
          <button class="ui-button api-action-button" type="button" data-action="open-result" data-role="${roleKey}">
            ${ICONS.result}
            <span>查看测试详情</span>
          </button>
        </div>

        <div class="api-result-panel" id="${roleKey}-status" data-role-status="${roleKey}">
          <div class="api-result-panel__meta">
            <span class="api-result-panel__label">当前状态</span>
            <span class="api-status-chip is-idle">未测试</span>
          </div>
          <div class="api-result-panel__body">保存后可点击“测试连接 / 测试模型”，将以“你好”为测试内容直接请求官方接口。</div>
        </div>
      </div>
    </section>
  `;
}

function getScopedStyles() {
  return `
    <style>
      #settings-api .settings-detail__body {
        padding: 14px;
        display: grid;
        gap: 12px;
      }

      #settings-api .api-intro-card {
        padding-bottom: 14px;
      }

      #settings-api .api-intro-card h3 {
        margin-bottom: 6px;
      }

      #settings-api .api-summary-badges {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 10px;
      }

      #settings-api .api-summary-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        border-radius: 999px;
        background: rgba(74, 52, 42, 0.08);
        color: #4a342a;
        font-size: 12px;
        line-height: 1;
      }

      #settings-api .api-summary-badge svg {
        width: 14px;
        height: 14px;
      }

      #settings-api .api-role-card {
        padding: 0;
        overflow: hidden;
      }

      #settings-api .api-role-card__header {
        width: 100%;
        border: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 16px;
        text-align: left;
      }

      #settings-api .api-role-card__title-wrap {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
      }

      #settings-api .api-role-card__badge {
        min-width: 34px;
        height: 34px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        flex-shrink: 0;
        font-size: 0;
      }

      #settings-api .api-role-card__badge svg {
        width: 18px;
        height: 18px;
      }

      #settings-api .api-role-card__badge.is-main {
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
      }

      #settings-api .api-role-card__badge.is-secondary {
        background: linear-gradient(135deg, #0ea5e9, #14b8a6);
      }

      #settings-api .api-role-card__header h3 {
        margin: 0 0 4px;
        font-size: 15px;
      }

      #settings-api .api-role-card__desc {
        margin: 0;
        font-size: 12px;
        line-height: 1.45;
      }

      #settings-api .api-role-card__chevron {
        color: rgba(74, 52, 42, 0.7);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        flex-shrink: 0;
      }

      #settings-api .api-role-card__header[aria-expanded="true"] .api-role-card__chevron {
        transform: rotate(180deg);
      }

      #settings-api .api-role-card__body {
        display: none;
        padding: 0 16px 16px;
        border-top: 1px solid rgba(74, 52, 42, 0.08);
      }

      #settings-api .api-role-card__body.is-open {
        display: block;
      }

      #settings-api .api-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }

      #settings-api .api-field {
        display: grid;
        gap: 6px;
      }

      #settings-api .api-field label {
        font-size: 12px;
        color: #6f5846;
      }

      #settings-api .api-field--full,
      #settings-api .api-field--switches {
        grid-column: 1 / -1;
      }

      #settings-api .api-field--switches {
        gap: 8px;
      }

      #settings-api .api-range-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      #settings-api .api-range-row__value {
        font-size: 12px;
        color: #4a342a;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(74, 52, 42, 0.08);
      }

      #settings-api input[type="range"] {
        width: 100%;
        accent-color: #4f46e5;
      }

      #settings-api .api-switch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(74, 52, 42, 0.08);
      }

      #settings-api .api-switch-row__content {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      #settings-api .api-switch-row__label {
        font-size: 13px;
        color: #4a342a;
        font-weight: 600;
      }

      #settings-api .api-switch-row__desc {
        font-size: 11px;
        color: #8d7664;
        line-height: 1.4;
      }

      #settings-api .ios-switch {
        position: relative;
        width: 52px;
        height: 32px;
        display: inline-flex;
        flex-shrink: 0;
      }

      #settings-api .ios-switch input {
        position: absolute;
        inset: 0;
        opacity: 0;
        margin: 0;
        cursor: pointer;
      }

      #settings-api .ios-switch__slider {
        width: 100%;
        height: 100%;
        border-radius: 999px;
        background: #d1d5db;
        transition: background 0.2s ease;
        position: relative;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
      }

      #settings-api .ios-switch__slider::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
        transition: transform 0.2s ease;
      }

      #settings-api .ios-switch input:checked + .ios-switch__slider {
        background: #34c759;
      }

      #settings-api .ios-switch input:checked + .ios-switch__slider::after {
        transform: translateX(20px);
      }

      #settings-api .api-actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-top: 14px;
      }

      #settings-api .api-action-button {
        justify-content: center;
        width: 100%;
        min-height: 42px;
        gap: 6px;
        padding-inline: 10px;
        font-size: 12px;
      }

      #settings-api .api-action-button svg {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      #settings-api .api-result-panel {
        margin-top: 12px;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid rgba(74, 52, 42, 0.08);
        display: grid;
        gap: 8px;
      }

      #settings-api .api-result-panel__meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      #settings-api .api-result-panel__label {
        font-size: 12px;
        color: #8d7664;
      }

      #settings-api .api-result-panel__body {
        font-size: 12px;
        line-height: 1.6;
        color: #4a342a;
        white-space: pre-wrap;
        word-break: break-word;
      }

      #settings-api .api-status-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 24px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
      }

      #settings-api .api-status-chip.is-idle {
        background: rgba(148, 163, 184, 0.15);
        color: #64748b;
      }

      #settings-api .api-status-chip.is-loading {
        background: rgba(59, 130, 246, 0.12);
        color: #2563eb;
      }

      #settings-api .api-status-chip.is-success {
        background: rgba(34, 197, 94, 0.12);
        color: #15803d;
      }

      #settings-api .api-status-chip.is-error {
        background: rgba(239, 68, 68, 0.12);
        color: #b91c1c;
      }

      #settings-api .api-page-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      #settings-api .api-modal.hidden {
        display: none;
      }

      #settings-api .api-modal {
        position: fixed;
        inset: 0;
        z-index: 1200;
      }

      #settings-api .api-modal__mask {
        position: absolute;
        inset: 0;
        background: rgba(21, 18, 16, 0.42);
        backdrop-filter: blur(6px);
      }

      #settings-api .api-modal__dialog {
        position: absolute;
        left: 50%;
        top: 50%;
        width: min(86vw, 360px);
        transform: translate(-50%, -50%);
        border-radius: 24px;
        background: #fffdf9;
        box-shadow: 0 20px 60px rgba(52, 35, 25, 0.22);
        overflow: hidden;
      }

      #settings-api .api-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 16px 16px 12px;
        border-bottom: 1px solid rgba(74, 52, 42, 0.08);
      }

      #settings-api .api-modal__title {
        font-size: 15px;
        font-weight: 700;
        color: #4a342a;
      }

      #settings-api .api-modal__close {
        border: 0;
        background: rgba(74, 52, 42, 0.08);
        color: #4a342a;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      #settings-api .api-modal__body {
        padding: 16px;
        font-size: 13px;
        color: #4a342a;
        line-height: 1.7;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: min(50vh, 320px);
        overflow: auto;
      }

      #settings-api .api-modal__footer {
        padding: 0 16px 16px;
      }

      #settings-api .api-modal__footer .ui-button {
        width: 100%;
        justify-content: center;
      }

      @media (max-width: 480px) {
        #settings-api .api-grid,
        #settings-api .api-actions,
        #settings-api .api-page-actions {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `;
}

export function renderApiSection({ current }) {
  const config = normalizeApiConfig(current);

  return `
    <div id="settings-api" class="settings-detail">
      ${getScopedStyles()}
      <div class="settings-detail__body">
        <section class="ui-card api-intro-card">
          <h3>全局 API 设置</h3>
          <p class="ui-muted">
            这里的配置将作为小手机网页的全局 API 配置源。页面分为主 API 与副 API：
            主 API 适合聊天等高用量场景，副 API 适合更快生成或辅助调用场景。
          </p>
          <div class="api-summary-badges">
            <span class="api-summary-badge">${ICONS.main}<span>主 API：稳定主业务</span></span>
            <span class="api-summary-badge">${ICONS.secondary}<span>副 API：快速生成 / 备用</span></span>
          </div>
        </section>

        ${renderApiBlock({
          roleKey: 'mainApi',
          title: '主 API',
          description: '聊天、长文本、高用量主业务优先读取这一组配置。',
          icon: ICONS.main,
          config: config.mainApi
        })}

        ${renderApiBlock({
          roleKey: 'secondaryApi',
          title: '副 API',
          description: '需要更快反馈的场景可读取这一组配置，也可作为备用接口。',
          icon: ICONS.secondary,
          config: config.secondaryApi
        })}

        <div class="api-page-actions">
          <button class="ui-button primary" type="button" id="save-all-api">保存全部 API 配置</button>
          <button class="ui-button" type="button" id="test-all-api">依次测试主 / 副 API</button>
        </div>
      </div>

      <div class="api-modal hidden" id="api-result-modal" aria-hidden="true">
        <div class="api-modal__mask" data-action="close-result-modal"></div>
        <div class="api-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="api-result-modal-title">
          <div class="api-modal__header">
            <div class="api-modal__title" id="api-result-modal-title">测试结果详情</div>
            <button class="api-modal__close" type="button" data-action="close-result-modal" aria-label="关闭">
              ${ICONS.close}
            </button>
          </div>
          <div class="api-modal__body" id="api-result-modal-body">暂无测试结果</div>
          <div class="api-modal__footer">
            <button class="ui-button primary" type="button" data-action="close-result-modal">我知道了</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateModelOptions(container, roleKey, provider, selectedModel = '') {
  const modelSelect = container.querySelector(`#${roleKey}-model`);
  if (!modelSelect) return;

  const meta = getMeta(provider);
  const currentValue = selectedModel || modelSelect.value || meta.models[0];
  modelSelect.innerHTML = renderModelOptions(provider, currentValue);

  if (!modelSelect.value) {
    modelSelect.value = meta.models[0];
  }
}

function collectRoleConfig(container, roleKey) {
  const provider = container.querySelector(`#${roleKey}-provider`)?.value || createDefaultRoleConfig(roleKey === 'mainApi' ? 'main' : 'secondary').provider;
  const meta = getMeta(provider);

  const config = {
    role: roleKey === 'mainApi' ? 'main' : 'secondary',
    provider,
    apiKey: container.querySelector(`#${roleKey}-apiKey`)?.value?.trim() || '',
    baseUrl: container.querySelector(`#${roleKey}-baseUrl`)?.value?.trim() || meta.defaultBaseUrl,
    model: container.querySelector(`#${roleKey}-model`)?.value?.trim() || meta.models[0],
    temperature: clampTemperature(container.querySelector(`#${roleKey}-temperature`)?.value),
    maxTokens: clampMaxTokens(container.querySelector(`#${roleKey}-maxTokens`)?.value, roleKey === 'mainApi' ? 2048 : 512),
    stream: !!container.querySelector(`#${roleKey}-stream`)?.checked,
    enabled: !!container.querySelector(`#${roleKey}-enabled`)?.checked
  };

  return mergeRoleConfig(config.role, config);
}

function setRoleStatus(container, roleKey, tone = 'idle', text = '未测试') {
  const panel = container.querySelector(`[data-role-status="${roleKey}"]`);
  if (!panel) return;

  const chip = panel.querySelector('.api-status-chip');
  const body = panel.querySelector('.api-result-panel__body');

  if (chip) {
    chip.className = `api-status-chip is-${tone}`;
    chip.textContent = tone === 'loading'
      ? '测试中'
      : tone === 'success'
        ? '测试成功'
        : tone === 'error'
          ? '测试失败'
          : '未测试';
  }

  if (body) {
    body.textContent = text;
  }
}

function syncRangeValue(container, roleKey) {
  const range = container.querySelector(`#${roleKey}-temperature`);
  const valueEl = container.querySelector(`#${roleKey}-temperature-value`);
  if (!range || !valueEl) return;
  valueEl.textContent = clampTemperature(range.value).toFixed(1);
}

function openResultModal(container, title, content) {
  const modal = container.querySelector('#api-result-modal');
  const titleEl = container.querySelector('#api-result-modal-title');
  const bodyEl = container.querySelector('#api-result-modal-body');
  if (!modal || !titleEl || !bodyEl) return;

  titleEl.textContent = title;
  bodyEl.textContent = content;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeResultModal(container) {
  const modal = container.querySelector('#api-result-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

async function persistApiConfig(settings, nextConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));

  await settings.update({
    api: {
      ...(nextConfig.legacy || {}),
      mainApi: nextConfig.mainApi,
      secondaryApi: nextConfig.secondaryApi,
      globalApiConfig: nextConfig
    }
  });

  Logger.info('全局 API 配置已保存');
}

function withTimeout(signal, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('请求超时')), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(signal.reason);
      }, { once: true });
    }
  }

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

async function readStreamText(response) {
  if (!response.body || !response.body.getReader) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let output = '';
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;

    if (result.value) {
      output += decoder.decode(result.value, { stream: !done });
      if (output.length > 6000) {
        output += '\n...[stream truncated]';
        break;
      }
    }
  }

  return output;
}

function getErrorText(payload) {
  if (!payload) return '未知错误';
  if (typeof payload === 'string') return payload;
  if (payload.error?.message) return payload.error.message;
  if (payload.message) return payload.message;
  return JSON.stringify(payload, null, 2);
}

function extractOpenAIText(payload) {
  return payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || '';
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('').trim();
}

function extractClaudeText(payload) {
  const content = payload?.content || [];
  return content
    .map((item) => item?.text || '')
    .join('')
    .trim();
}

async function testOpenAI(config, signal) {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const requestBody = {
    model: config.model,
    messages: [{ role: 'user', content: '你好' }],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: !!config.stream
  };

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (config.stream) {
    const raw = await readStreamText(response);
    if (!response.ok) {
      throw new Error(raw || `请求失败（${response.status}）`);
    }

    return {
      preview: raw.slice(0, 1200),
      raw
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorText(payload) || `请求失败（${response.status}）`);
  }

  return {
    preview: extractOpenAIText(payload) || '接口返回成功，但没有解析到文本内容。',
    raw: JSON.stringify(payload, null, 2)
  };
}

async function testGemini(config, signal) {
  const base = config.baseUrl.replace(/\/+$/, '');
  const action = config.stream ? 'streamGenerateContent' : 'generateContent';
  const url = `${base}/models/${encodeURIComponent(config.model)}:${action}?alt=sse&key=${encodeURIComponent(config.apiKey)}`;

  const streamBody = {
    contents: [{ role: 'user', parts: [{ text: '你好' }] }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens
    }
  };

  const nonStreamUrl = `${base}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(config.stream ? url : nonStreamUrl, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(streamBody)
  });

  if (config.stream) {
    const raw = await readStreamText(response);
    if (!response.ok) {
      throw new Error(raw || `请求失败（${response.status}）`);
    }

    return {
      preview: raw.slice(0, 1200),
      raw
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorText(payload) || `请求失败（${response.status}）`);
  }

  return {
    preview: extractGeminiText(payload) || '接口返回成功，但没有解析到文本内容。',
    raw: JSON.stringify(payload, null, 2)
  };
}

async function testClaude(config, signal) {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/messages`;
  const requestBody = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: !!config.stream,
    messages: [{ role: 'user', content: '你好' }]
  };

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(requestBody)
  });

  if (config.stream) {
    const raw = await readStreamText(response);
    if (!response.ok) {
      throw new Error(raw || `请求失败（${response.status}）`);
    }

    return {
      preview: raw.slice(0, 1200),
      raw
    };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorText(payload) || `请求失败（${response.status}）`);
  }

  return {
    preview: extractClaudeText(payload) || '接口返回成功，但没有解析到文本内容。',
    raw: JSON.stringify(payload, null, 2)
  };
}

async function testDeepSeek(config, signal) {
  return testOpenAI(config, signal);
}

async function runProviderTest(config, timeoutMs = 20000) {
  if (!config.enabled) {
    throw new Error('该 API 已关闭，请先开启后再测试。');
  }

  if (!config.apiKey) {
    throw new Error('请先填写 API Key。');
  }

  if (!config.baseUrl) {
    throw new Error('请先填写 Base URL。');
  }

  if (!config.model) {
    throw new Error('请先选择模型。');
  }

  const timed = withTimeout(null, timeoutMs);
  const start = performance.now();

  try {
    let data = null;

    if (config.provider === 'openai') {
      data = await testOpenAI(config, timed.signal);
    } else if (config.provider === 'gemini') {
      data = await testGemini(config, timed.signal);
    } else if (config.provider === 'claude') {
      data = await testClaude(config, timed.signal);
    } else if (config.provider === 'deepseek') {
      data = await testDeepSeek(config, timed.signal);
    } else {
      throw new Error('不支持的服务商');
    }

    const elapsed = Math.round(performance.now() - start);

    return {
      ok: true,
      elapsed,
      provider: config.provider,
      model: config.model,
      stream: !!config.stream,
      preview: data.preview,
      raw: data.raw
    };
  } catch (error) {
    const elapsed = Math.round(performance.now() - start);
    return {
      ok: false,
      elapsed,
      provider: config.provider,
      model: config.model,
      stream: !!config.stream,
      error: error?.message || String(error)
    };
  } finally {
    timed.clear();
  }
}

function formatTestResult(result, roleLabel) {
  if (!result) {
    return `${roleLabel} 暂无测试结果。`;
  }

  if (result.ok) {
    return [
      `${roleLabel} 测试成功`,
      `服务商：${result.provider}`,
      `模型：${result.model}`,
      `流式输出：${result.stream ? '开启' : '关闭'}`,
      `耗时：${result.elapsed} ms`,
      '',
      '返回内容预览：',
      result.preview || '（空返回）',
      '',
      '原始响应：',
      result.raw || '（无原始内容）'
    ].join('\n');
  }

  return [
    `${roleLabel} 测试失败`,
    `服务商：${result.provider}`,
    `模型：${result.model}`,
    `流式输出：${result.stream ? '开启' : '关闭'}`,
    `耗时：${result.elapsed} ms`,
    '',
    '错误信息：',
    result.error || '未知错误'
  ].join('\n');
}

export function bindApiEvents(container, { settings }) {
  const currentConfig = normalizeApiConfig({ api: null });

  const state = {
    config: currentConfig,
    tests: {
      mainApi: currentConfig.mainApi.lastTest || null,
      secondaryApi: currentConfig.secondaryApi.lastTest || null
    }
  };

  const roleLabelMap = {
    mainApi: '主 API',
    secondaryApi: '副 API'
  };

  const roleKeys = ['mainApi', 'secondaryApi'];

  const hydrateFromDom = () => {
    state.config = {
      ...state.config,
      mainApi: collectRoleConfig(container, 'mainApi'),
      secondaryApi: collectRoleConfig(container, 'secondaryApi')
    };
    return state.config;
  };

  const syncProviderUI = (roleKey, provider) => {
    const meta = getMeta(provider);
    const baseUrlInput = container.querySelector(`#${roleKey}-baseUrl`);
    const modelSelect = container.querySelector(`#${roleKey}-model`);
    const currentBase = baseUrlInput?.value?.trim() || '';
    const currentModel = modelSelect?.value?.trim() || '';

    if (baseUrlInput && (!currentBase || currentBase === getMeta(state.config[roleKey]?.provider).defaultBaseUrl)) {
      baseUrlInput.value = meta.defaultBaseUrl;
    }

    updateModelOptions(container, roleKey, provider, currentModel && getMeta(provider).models.includes(currentModel) ? currentModel : meta.models[0]);
    hydrateFromDom();
  };

  const updateResultPanel = (roleKey, result = null) => {
    state.tests[roleKey] = result;
    if (!result) {
      setRoleStatus(container, roleKey, 'idle', '保存后可点击“测试连接 / 测试模型”，将以“你好”为测试内容直接请求官方接口。');
      return;
    }

    if (result.ok) {
      setRoleStatus(
        container,
        roleKey,
        'success',
        [
          `${roleLabelMap[roleKey]}测试成功，耗时 ${result.elapsed} ms`,
          `服务商：${getMeta(result.provider).name}`,
          `模型：${result.model}`,
          `返回预览：${result.preview || '（空返回）'}`
        ].join('\n')
      );
      return;
    }

    setRoleStatus(
      container,
      roleKey,
      'error',
      [
        `${roleLabelMap[roleKey]}测试失败，耗时 ${result.elapsed} ms`,
        `服务商：${getMeta(result.provider).name}`,
        `模型：${result.model}`,
        `错误：${result.error || '未知错误'}`
      ].join('\n')
    );
  };

  const saveRoles = async (roleKeysToSave = roleKeys) => {
    hydrateFromDom();

    const nextConfig = {
      ...state.config,
      mainApi: mergeRoleConfig('main', {
        ...state.config.mainApi,
        lastTest: state.tests.mainApi
      }),
      secondaryApi: mergeRoleConfig('secondary', {
        ...state.config.secondaryApi,
        lastTest: state.tests.secondaryApi
      })
    };

    state.config = nextConfig;

    await persistApiConfig(settings, nextConfig);

    roleKeysToSave.forEach((roleKey) => {
      setRoleStatus(
        container,
        roleKey,
        state.tests[roleKey]?.ok ? 'success' : 'idle',
        state.tests[roleKey]
          ? formatTestResult(state.tests[roleKey], roleLabelMap[roleKey]).split('\n').slice(0, 4).join('\n')
          : `${roleLabelMap[roleKey]} 配置已保存，等待测试。`
      );
    });
  };

  const testRole = async (roleKey) => {
    hydrateFromDom();
    const config = state.config[roleKey];

    setRoleStatus(container, roleKey, 'loading', `${roleLabelMap[roleKey]} 正在发送测试请求，请稍候…`);

    const result = await runProviderTest(config);
    updateResultPanel(roleKey, result);

    state.config[roleKey] = {
      ...state.config[roleKey],
      lastTest: result
    };

    return result;
  };

  roleKeys.forEach((roleKey) => {
    syncRangeValue(container, roleKey);
    updateResultPanel(roleKey, state.tests[roleKey]);
  });

  container.querySelectorAll('[data-action="toggle-role"]').forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-target');
      const target = targetId ? container.querySelector(`#${targetId}`) : null;
      if (!target) return;

      const isOpen = target.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(isOpen));
    });
  });

  roleKeys.forEach((roleKey) => {
    container.querySelector(`#${roleKey}-provider`)?.addEventListener('change', (event) => {
      syncProviderUI(roleKey, event.target.value);
    });

    container.querySelector(`#${roleKey}-temperature`)?.addEventListener('input', () => {
      syncRangeValue(container, roleKey);
      hydrateFromDom();
    });

    ['apiKey', 'baseUrl', 'model', 'maxTokens', 'stream', 'enabled'].forEach((field) => {
      container.querySelector(`#${roleKey}-${field}`)?.addEventListener('change', () => {
        hydrateFromDom();
      });
    });

    container.querySelector(`[data-action="save-role"][data-role="${roleKey}"]`)?.addEventListener('click', async () => {
      await saveRoles([roleKey]);
    });

    container.querySelector(`[data-action="test-role"][data-role="${roleKey}"]`)?.addEventListener('click', async () => {
      const result = await testRole(roleKey);
      openResultModal(container, `${roleLabelMap[roleKey]} 测试详情`, formatTestResult(result, roleLabelMap[roleKey]));
    });

    container.querySelector(`[data-action="open-result"][data-role="${roleKey}"]`)?.addEventListener('click', () => {
      openResultModal(
        container,
        `${roleLabelMap[roleKey]} 测试详情`,
        formatTestResult(state.tests[roleKey], roleLabelMap[roleKey])
      );
    });
  });

  container.querySelectorAll('[data-action="close-result-modal"]').forEach((button) => {
    button.addEventListener('click', () => closeResultModal(container));
  });

  container.querySelector('#save-all-api')?.addEventListener('click', async () => {
    await saveRoles(roleKeys);
  });

  container.querySelector('#test-all-api')?.addEventListener('click', async () => {
    const mainResult = await testRole('mainApi');
    const secondaryResult = await testRole('secondaryApi');

    openResultModal(
      container,
      '主 / 副 API 测试详情',
      [
        formatTestResult(mainResult, roleLabelMap.mainApi),
        '',
        '------------------------------',
        '',
        formatTestResult(secondaryResult, roleLabelMap.secondaryApi)
      ].join('\n')
    );
  });
}
