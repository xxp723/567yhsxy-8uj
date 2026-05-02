import { Logger } from '../../utils/Logger.js';

/**
 * 文件名: js/apps/settings/image-api.js
 * 用途: 设置应用 - 生图 API 配置页
 * 说明:
 * 1) 本页只处理 settings.imageApi 配置，持久化通过 SettingsStore -> DB.js / IndexedDB。
 * 2) 禁止浏览器本地键值存储，不做双份存储兜底。
 * 3) 硅基流动兼容接口地址仅作为内部常量使用，不在 UI 中暴露。
 * 4) 服务商/模型选择使用应用内弹窗，不使用浏览器原生选择器。
 */

/* ===== 设置：生图 API 内部接口常量 START =====
   说明：硅基流动兼容接口地址只在请求函数内部使用；不要渲染到页面。 */
const SILICONFLOW_IMAGE_BASE_URL = 'https://api.siliconflow.cn/v1';
/* ===== 设置：生图 API 内部接口常量 END ===== */

const IMAGE_API_PROVIDER_META = {
  siliconflow: {
    id: 'siliconflow',
    shortLabel: '硅基流动',
    label: '硅基流动兼容接口',
    defaultBaseUrl: ''
  },
  openai: {
    id: 'openai',
    shortLabel: 'OpenAI',
    label: 'OpenAI 兼容接口',
    defaultBaseUrl: 'https://api.openai.com/v1'
  }
};

const IMAGE_MODEL_KEYWORDS = [
  'image',
  'img',
  'wan',
  'flux',
  'stable',
  'sd',
  'kolors',
  'kandinsky',
  'dall',
  'midjourney',
  'gpt-image'
];

const ICONS = {
  // IconPark: picture / 生图 API 卡片与标题
  image: `<svg viewBox="0 0 48 48" fill="none" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M6 34L16 24L24 31L31 22L42 34" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="18" r="4" stroke="currentColor" stroke-width="3"/></svg>`,
  // IconPark: key / API Key
  key: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="24" r="8" stroke="currentColor" stroke-width="3"/><path d="M24 24H44" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M34 24V31" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M40 24V29" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  // IconPark: download / 拉取模型
  fetch: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M24 6V30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 20L24 30L34 20" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 38H40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  // IconPark: magic / 测试生图
  test: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M18 30L34 14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 10L38 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 8L14 14L20 16L14 18L12 24L10 18L4 16L10 14L12 8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M34 28L36 34L42 36L36 38L34 44L32 38L26 36L32 34L34 28Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  // IconPark: save / 保存
  save: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M10 8H34L40 14V40H10V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 8V18H30V8" stroke="currentColor" stroke-width="3"/><path d="M16 30H32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  // IconPark: storage / 预设配置
  storage: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><ellipse cx="24" cy="12" rx="14" ry="6" stroke="currentColor" stroke-width="3"/><path d="M10 12V24C10 27.3137 16.268 30 24 30C31.732 30 38 27.3137 38 24V12" stroke="currentColor" stroke-width="3"/><path d="M10 24V36C10 39.3137 16.268 42 24 42C31.732 42 38 39.3137 38 36V24" stroke="currentColor" stroke-width="3"/></svg>`,
  // IconPark: arrow-right / 应用预设
  apply: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M8 24H40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M26 12L40 24L26 36" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark: down / 下拉指示
  chevronDown: `<svg viewBox="0 0 48 48" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M36 18L24 30L12 18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark: close / 关闭
  close: `<svg viewBox="0 0 48 48" fill="none" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><path d="M14 14L34 34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M34 14L14 34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`,
  // IconPark: check-one / 已选
  selected: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M17 24L22 29L32 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark: round / 未选
  unselected: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/></svg>`,
  // IconPark: check / 成功
  ok: `<svg viewBox="0 0 48 48" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><path d="M10 25L20 34L38 14" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // IconPark: delete / 删除
  delete: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M9 10H39" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 20V33" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M28 20V33" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M14 10L16 39H32L34 10" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 10V6H29V10" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  // IconPark: close-one / 错误
  error: `<svg viewBox="0 0 48 48" fill="none" width="14" height="14" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="3"/><path d="M18 18L30 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M30 18L18 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  // IconPark: openai-provider / OpenAI 兼容接口
  openai: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="3"/><path d="M24 12L34 18V30L24 36L14 30V18L24 12Z" stroke="currentColor" stroke-width="3"/></svg>`,
  // IconPark: connection / 硅基流动接口
  siliconflow: `<svg viewBox="0 0 48 48" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M16 18C16 12.4772 20.4772 8 26 8H30C35.5228 8 40 12.4772 40 18C40 23.5228 35.5228 28 30 28H28" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 20H18C12.4772 20 8 24.4772 8 30C8 35.5228 12.4772 40 18 40H22C27.5228 40 32 35.5228 32 30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function normalizeProviderId(providerId) {
  return IMAGE_API_PROVIDER_META[providerId] ? providerId : 'siliconflow';
}

function getProviderMeta(providerId) {
  return IMAGE_API_PROVIDER_META[normalizeProviderId(providerId)];
}

function getEffectiveImageBaseUrl(api) {
  const provider = normalizeProviderId(api?.provider);
  if (provider === 'openai') return trimSlash(api?.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl);
  return SILICONFLOW_IMAGE_BASE_URL;
}

function getDefaultImageApiSettings() {
  return {
    version: 2,
    provider: 'siliconflow',
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: '',
    availableModels: [],
    testPrompt: '一只可爱的橘猫坐在复古手机旁，柔和光线，精致插画风格',
    previewImage: '',
    savedConfigs: []
  };
}

function normalizeSavedImageApiConfigs(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((item, index) => {
      const provider = normalizeProviderId(item?.provider);
      const meta = getProviderMeta(provider);
      const model = String(item?.model || '').trim();
      return {
        id: item?.id || `image-api-saved-${Date.now()}-${index}`,
        name: item?.name || `${meta.shortLabel} · ${model || '未设置模型'} · ${index + 1}`,
        provider,
        baseUrl: provider === 'openai' ? trimSlash(item?.baseUrl || meta.defaultBaseUrl) : '',
        apiKey: String(item?.apiKey || '').trim(),
        model,
        availableModels: uniqueStrings([...(Array.isArray(item?.availableModels) ? item.availableModels : []), model])
      };
    })
    .slice(0, 20);
}

function normalizeImageApiSettings(input) {
  const defaults = getDefaultImageApiSettings();
  const source = input && typeof input === 'object' ? input : {};
  const provider = normalizeProviderId(source.provider || defaults.provider);
  const model = String(source.model || '').trim();

  return {
    version: 2,
    provider,
    enabled: Boolean(source.enabled),
    baseUrl: provider === 'openai' ? trimSlash(source.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl) : '',
    apiKey: String(source.apiKey || '').trim(),
    model,
    availableModels: uniqueStrings([...(Array.isArray(source.availableModels) ? source.availableModels : []), model]),
    testPrompt: String(source.testPrompt || defaults.testPrompt),
    previewImage: String(source.previewImage || ''),
    savedConfigs: normalizeSavedImageApiConfigs(source.savedConfigs)
  };
}

/* ===== 设置：生图模型过滤模块 START =====
   说明：只根据模型 ID/能力字段识别生图模型；不进行长文本存储过滤。 */
function isImageGenerationModel(item) {
  const id = String(item?.id || item?.name || '').toLowerCase();
  const typeText = [
    item?.type,
    item?.task,
    item?.pipeline_tag,
    item?.capability,
    item?.description,
    item?.owned_by
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return IMAGE_MODEL_KEYWORDS.some((keyword) => id.includes(keyword) || typeText.includes(keyword));
}
/* ===== 设置：生图模型过滤模块 END ===== */

function renderProviderIcon(providerId) {
  return ICONS[normalizeProviderId(providerId)] || ICONS.image;
}

function renderProviderTrigger(api) {
  const meta = getProviderMeta(api.provider);
  return `
    <button class="image-api-provider-trigger" type="button" data-action="open-image-api-provider-modal" data-provider="${escapeHtml(api.provider)}" aria-haspopup="dialog">
      <span class="image-api-provider-trigger__main">
        <span class="image-api-icon-inline">${renderProviderIcon(api.provider)}</span>
        <span class="image-api-provider-trigger__text">${escapeHtml(meta.shortLabel)}</span>
      </span>
      <span class="image-api-provider-trigger__meta">${escapeHtml(meta.label)}</span>
    </button>
  `;
}

function renderProviderModalOptions(selectedProvider) {
  return Object.keys(IMAGE_API_PROVIDER_META)
    .map((id) => {
      const meta = IMAGE_API_PROVIDER_META[id];
      const selected = selectedProvider === id;
      return `
        <button class="image-api-provider-option ${selected ? 'is-selected' : ''}" type="button" data-action="choose-image-api-provider" data-provider="${escapeHtml(id)}">
          <span class="image-api-provider-option__main">
            <span class="image-api-icon-inline">${renderProviderIcon(id)}</span>
            <span>${escapeHtml(meta.shortLabel)}</span>
          </span>
          <span class="image-api-provider-option__desc">${escapeHtml(meta.label)}</span>
          <span class="image-api-provider-option__check">${selected ? ICONS.selected : ICONS.unselected}</span>
        </button>
      `;
    })
    .join('');
}

function renderModelTrigger(api) {
  const hasModels = api.availableModels.length > 0;
  return `
    <button class="image-api-model-trigger ${hasModels ? '' : 'is-empty'}" type="button" data-action="open-image-api-model-modal">
      <span class="image-api-model-trigger__text" title="${escapeHtml(api.model || '请先拉取生图模型')}">${escapeHtml(api.model || '请先拉取生图模型')}</span>
      <span class="image-api-model-trigger__side">
        <span>${hasModels ? `共 ${api.availableModels.length} 个` : '暂无模型'}</span>
        <span class="image-api-icon-inline">${ICONS.chevronDown}</span>
      </span>
    </button>
  `;
}

function renderModelModalOptions(api) {
  if (!api.availableModels.length) {
    return `
      <div class="image-api-empty">
        <span class="image-api-icon-inline">${ICONS.image}</span>
        <span>当前没有可选生图模型，请先点击“拉取模型”。</span>
      </div>
    `;
  }

  return api.availableModels.map((model) => {
    const selected = model === api.model;
    return `
      <button class="image-api-model-option ${selected ? 'is-selected' : ''}" type="button" data-action="choose-image-api-model" data-model="${escapeHtml(model)}">
        <span class="image-api-model-option__label">${escapeHtml(model)}</span>
        <span class="image-api-icon-inline">${selected ? ICONS.selected : ICONS.unselected}</span>
      </button>
    `;
  }).join('');
}

function renderSavedImageApiConfigs(savedConfigs) {
  if (!savedConfigs.length) {
    return `
      <div class="image-api-empty">
        <span class="image-api-icon-inline">${ICONS.storage}</span>
        <span>当前还没有已保存的生图 API 配置</span>
      </div>
    `;
  }

  return `
    <div class="image-api-saved-list">
      ${savedConfigs.map((item) => {
        const meta = getProviderMeta(item.provider);
        const urlText = item.provider === 'openai' ? item.baseUrl : '内置兼容地址';
        return `
          <div class="image-api-saved-item" data-image-api-saved-id="${escapeHtml(item.id)}">
            <div class="image-api-saved-item__main">
              <div class="image-api-saved-item__title">
                <span class="image-api-icon-inline">${renderProviderIcon(item.provider)}</span>
                <span>${escapeHtml(item.name)}</span>
              </div>
              <div class="image-api-saved-item__meta">
                <span>${escapeHtml(meta.shortLabel)}</span>
                <span>${escapeHtml(item.model || '未设置模型')}</span>
                <span>${escapeHtml(urlText)}</span>
              </div>
            </div>
            <div class="image-api-saved-item__actions">
              <button class="ui-button image-api-btn image-api-btn--ghost image-api-btn--small" type="button" data-action="apply-image-api-saved" data-saved-id="${escapeHtml(item.id)}">
                <span class="image-api-icon-inline">${ICONS.apply}</span>
                <span>应用</span>
              </button>
              <button class="ui-button image-api-btn image-api-btn--danger image-api-btn--small" type="button" data-action="delete-image-api-saved" data-saved-id="${escapeHtml(item.id)}">
                <span class="image-api-icon-inline">${ICONS.delete}</span>
                <span>删除</span>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderImageProviderModal(api) {
  return `
    <div id="image-api-provider-modal" class="image-api-modal hidden" aria-hidden="true">
      <div class="image-api-modal__mask" data-action="close-image-api-provider-modal"></div>
      <div class="image-api-modal__panel" role="dialog" aria-modal="true" aria-labelledby="image-api-provider-modal-title">
        <div class="image-api-modal__header">
          <span id="image-api-provider-modal-title">选择生图 API 服务商接口</span>
          <button type="button" class="image-api-modal__close" data-action="close-image-api-provider-modal" aria-label="关闭服务商选择弹窗">
            <span class="image-api-icon-inline">${ICONS.close}</span>
          </button>
        </div>
        <div id="image-api-provider-modal-options" class="image-api-modal__body">
          ${renderProviderModalOptions(api.provider)}
        </div>
      </div>
    </div>
  `;
}

function renderImageModelModal(api) {
  return `
    <div id="image-api-model-modal" class="image-api-modal hidden" aria-hidden="true">
      <div class="image-api-modal__mask" data-action="close-image-api-model-modal"></div>
      <div class="image-api-modal__panel" role="dialog" aria-modal="true" aria-labelledby="image-api-model-modal-title">
        <div class="image-api-modal__header">
          <span id="image-api-model-modal-title">选择生图模型</span>
          <button type="button" class="image-api-modal__close" data-action="close-image-api-model-modal" aria-label="关闭模型选择弹窗">
            <span class="image-api-icon-inline">${ICONS.close}</span>
          </button>
        </div>
        <div id="image-api-model-modal-options" class="image-api-modal__body">
          ${renderModelModalOptions(api)}
        </div>
      </div>
    </div>
  `;
}

function renderResult(status = 'idle', text = '尚未操作') {
  const icon = status === 'success' ? ICONS.ok : status === 'error' ? ICONS.error : ICONS.image;
  return `
    <div class="image-api-result ${status === 'success' ? 'is-success' : ''} ${status === 'error' ? 'is-error' : ''} ${status === 'loading' ? 'is-loading' : ''}" id="image-api-result">
      <span class="image-api-icon-inline">${icon}</span>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

export function renderImageApiSection({ current }) {
  const api = normalizeImageApiSettings(current?.imageApi);
  const providerMeta = getProviderMeta(api.provider);
  const showOpenAiBaseUrl = api.provider === 'openai';

  return `
    <div id="settings-image-api" class="settings-detail">
      <div class="settings-detail__body">
        <style>
          #settings-image-api .settings-detail__body { gap: 10px; }
          #settings-image-api .image-api-card { margin-bottom: 12px; }
          #settings-image-api .image-api-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 12px;
          }
          #settings-image-api .image-api-title {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 0;
            color: var(--c-text-main, #4A342A);
            font-size: 14px;
            font-weight: 700;
          }
          #settings-image-api .image-api-head--preview { align-items: center; }
          #settings-image-api .image-api-icon-inline {
            display: inline-flex;
            line-height: 0;
          }
          #settings-image-api .image-api-delete-preview {
            width: 34px;
            height: 34px;
            border: 1px solid rgba(125, 90, 68, 0.14);
            border-radius: 999px;
            background: rgba(215, 201, 184, 0.22);
            color: var(--c-text-main, #4A342A);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          #settings-image-api .image-api-enable-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            padding: 12px;
            margin-bottom: 12px;
            border-radius: 18px;
            background: rgba(215, 201, 184, 0.18);
            border: 1px solid rgba(125, 90, 68, 0.12);
          }
          #settings-image-api .image-api-enable-row__text {
            display: grid;
            gap: 4px;
            min-width: 0;
          }
          #settings-image-api .image-api-enable-row__title {
            color: var(--c-text-main, #4A342A);
            font-size: 13px;
            font-weight: 700;
          }
          #settings-image-api .image-api-enable-row__desc {
            color: rgba(74, 52, 42, 0.62);
            font-size: 11px;
            line-height: 1.5;
          }
          #settings-image-api .image-api-switch {
            width: 52px;
            height: 30px;
            border: 0;
            border-radius: 999px;
            background: rgba(125, 90, 68, 0.22);
            padding: 3px;
            flex: 0 0 auto;
            cursor: pointer;
            transition: background 0.18s ease;
          }
          #settings-image-api .image-api-switch__knob {
            display: block;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #fffdf8;
            box-shadow: 0 2px 8px rgba(84, 58, 44, 0.22);
            transform: translateX(0);
            transition: transform 0.18s ease;
          }
          #settings-image-api .image-api-switch.is-on { background: var(--c-text-main, #4A342A); }
          #settings-image-api .image-api-switch.is-on .image-api-switch__knob { transform: translateX(22px); }
          #settings-image-api .image-api-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(215, 201, 184, 0.22);
            border: 1px solid rgba(125, 90, 68, 0.14);
            color: var(--c-text-main, #4A342A);
            font-size: 11px;
            white-space: nowrap;
          }
          #settings-image-api .image-api-field {
            display: grid;
            gap: 6px;
            margin-bottom: 10px;
          }
          #settings-image-api .image-api-field--openai-url.hidden { display: none; }
          #settings-image-api .image-api-label {
            font-size: 12px;
            color: rgba(74, 52, 42, 0.76);
          }
          #settings-image-api .image-api-hint {
            color: rgba(74, 52, 42, 0.58);
            font-size: 11px;
            line-height: 1.5;
          }
          #settings-image-api .image-api-input,
          #settings-image-api .image-api-textarea,
          #settings-image-api .image-api-model-trigger,
          #settings-image-api .image-api-provider-trigger {
            width: 100%;
            border: 1px solid rgba(125, 90, 68, 0.2);
            border-radius: 12px;
            background: var(--c-bg-wallpaper, #F5F1EA);
            color: var(--c-text-main, #4A342A);
            font-family: var(--font-retro);
            font-size: 12px;
            outline: none;
            box-sizing: border-box;
          }
          #settings-image-api .image-api-input {
            min-height: 38px;
            padding: 8px 10px;
          }
          #settings-image-api .image-api-textarea {
            min-height: 72px;
            resize: vertical;
            padding: 10px;
            line-height: 1.6;
          }
          #settings-image-api .image-api-input:focus,
          #settings-image-api .image-api-textarea:focus,
          #settings-image-api .image-api-model-trigger:focus,
          #settings-image-api .image-api-provider-trigger:focus {
            border-color: var(--c-border, #7D5A44);
            box-shadow: 0 0 0 3px rgba(125, 90, 68, 0.12);
          }
          #settings-image-api .image-api-inline {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
          }
          #settings-image-api .image-api-provider-trigger,
          #settings-image-api .image-api-model-trigger {
            min-height: 38px;
            padding: 8px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            text-align: left;
            cursor: pointer;
          }
          #settings-image-api .image-api-provider-trigger__main {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }
          #settings-image-api .image-api-provider-trigger__text,
          #settings-image-api .image-api-model-trigger__text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 700;
          }
          #settings-image-api .image-api-provider-trigger__meta,
          #settings-image-api .image-api-model-trigger__side {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
            color: rgba(74, 52, 42, 0.62);
            font-size: 11px;
            white-space: nowrap;
          }
          #settings-image-api .image-api-model-trigger.is-empty .image-api-model-trigger__text,
          #settings-image-api .image-api-model-trigger.is-empty .image-api-model-trigger__side {
            color: rgba(74, 52, 42, 0.56);
          }
          #settings-image-api .image-api-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          #settings-image-api .image-api-actions__full { grid-column: 1 / -1; }
          #settings-image-api .image-api-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            min-height: 38px;
            padding: 0 12px;
            border-radius: 12px;
            border: 1px solid transparent;
            background: var(--c-text-main, #4A342A);
            color: var(--c-white-rice, #F5F1EA);
            font-family: var(--font-retro);
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }
          #settings-image-api .image-api-btn--ghost {
            background: rgba(215, 201, 184, 0.32);
            color: var(--c-text-main, #4A342A);
            border-color: rgba(125, 90, 68, 0.12);
          }
          #settings-image-api .image-api-btn--danger {
            background: rgba(192, 57, 43, 0.12);
            color: #9f2c21;
            border-color: rgba(192, 57, 43, 0.12);
          }
          #settings-image-api .image-api-btn--small {
            min-height: 34px;
            padding: 0 12px;
          }
          #settings-image-api .image-api-btn[disabled] {
            opacity: 0.55;
            cursor: not-allowed;
          }
          #settings-image-api .image-api-result {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            min-height: 38px;
            margin-top: 10px;
            padding: 9px 10px;
            border-radius: 12px;
            background: rgba(215, 201, 184, 0.18);
            color: rgba(74, 52, 42, 0.84);
            font-size: 12px;
            line-height: 1.5;
          }
          #settings-image-api .image-api-result.is-success {
            background: rgba(74, 52, 42, 0.1);
            color: var(--c-text-main, #4A342A);
          }
          #settings-image-api .image-api-result.is-error {
            background: rgba(192, 57, 43, 0.1);
            color: #9f2c21;
          }
          #settings-image-api .image-api-result.is-loading {
            background: rgba(125, 90, 68, 0.12);
            color: var(--c-text-main, #4A342A);
          }
          #settings-image-api .image-api-preview {
            min-height: 160px;
            border-radius: 18px;
            border: 1px dashed rgba(125, 90, 68, 0.22);
            background: rgba(245, 241, 234, 0.72);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            color: rgba(74, 52, 42, 0.62);
            font-size: 12px;
            text-align: center;
            padding: 12px;
          }
          #settings-image-api .image-api-preview img {
            display: block;
            width: 100%;
            height: auto;
            max-height: 360px;
            object-fit: contain;
            border-radius: 14px;
          }
          #settings-image-api .image-api-saved-list {
            display: grid;
            gap: 10px;
          }
          #settings-image-api .image-api-saved-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px;
            border-radius: 14px;
            background: rgba(215, 201, 184, 0.14);
            border: 1px solid rgba(125, 90, 68, 0.12);
          }
          #settings-image-api .image-api-saved-item__main {
            min-width: 0;
            display: grid;
            gap: 6px;
          }
          #settings-image-api .image-api-saved-item__title {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: var(--c-text-main, #4A342A);
            font-size: 13px;
            font-weight: 700;
          }
          #settings-image-api .image-api-saved-item__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            color: rgba(74, 52, 42, 0.72);
            font-size: 11px;
          }
          #settings-image-api .image-api-saved-item__meta span {
            display: inline-flex;
            align-items: center;
            min-height: 22px;
            max-width: 180px;
            padding: 0 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.46);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          #settings-image-api .image-api-saved-item__actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            justify-content: flex-end;
          }
          #settings-image-api .image-api-modal {
            position: fixed;
            inset: 0;
            z-index: 1200;
          }
          #settings-image-api .image-api-modal.hidden { display: none; }
          #settings-image-api .image-api-modal__mask {
            position: absolute;
            inset: 0;
            background: rgba(34, 24, 18, 0.22);
            backdrop-filter: blur(4px);
          }
          #settings-image-api .image-api-modal__panel {
            position: relative;
            width: min(420px, calc(100vw - 32px));
            max-height: min(620px, calc(100vh - 96px));
            margin: 72px auto 0;
            background: #fffdf8;
            border: 1px solid rgba(125, 90, 68, 0.16);
            border-radius: 24px;
            box-shadow: 0 18px 40px rgba(84, 58, 44, 0.18);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          #settings-image-api .image-api-modal__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 18px 18px 12px;
            border-bottom: 1px solid rgba(125, 90, 68, 0.08);
            color: var(--c-text-main, #4A342A);
            font-size: 16px;
            font-weight: 700;
          }
          #settings-image-api .image-api-modal__close {
            border: 0;
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: rgba(215, 201, 184, 0.28);
            color: var(--c-text-main, #4A342A);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          #settings-image-api .image-api-modal__body {
            display: grid;
            gap: 10px;
            padding: 16px 18px 18px;
            overflow-y: auto;
          }
          #settings-image-api .image-api-model-option,
          #settings-image-api .image-api-provider-option {
            width: 100%;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px 12px;
            align-items: center;
            padding: 15px 14px;
            border-radius: 18px;
            border: 1px solid rgba(125, 90, 68, 0.14);
            background: rgba(245, 241, 234, 0.86);
            color: var(--c-text-main, #4A342A);
            text-align: left;
            cursor: pointer;
            font-family: var(--font-retro);
          }
          #settings-image-api .image-api-model-option.is-selected,
          #settings-image-api .image-api-provider-option.is-selected {
            border-color: rgba(74, 52, 42, 0.26);
            background: rgba(215, 201, 184, 0.34);
          }
          #settings-image-api .image-api-provider-option__main {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            font-size: 13px;
            font-weight: 700;
          }
          #settings-image-api .image-api-provider-option__desc {
            grid-column: 1 / 2;
            font-size: 11px;
            color: rgba(74, 52, 42, 0.68);
          }
          #settings-image-api .image-api-provider-option__check {
            grid-column: 2 / 3;
            grid-row: 1 / span 2;
            justify-self: end;
            align-self: center;
          }
          #settings-image-api .image-api-model-option__label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 700;
          }
          #settings-image-api .image-api-empty {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 42px;
            padding: 12px 14px;
            border-radius: 18px;
            border: 1px solid rgba(125, 90, 68, 0.14);
            background: rgba(245, 241, 234, 0.86);
            color: rgba(74, 52, 42, 0.72);
            font-size: 12px;
            line-height: 1.6;
          }
          @media (max-width: 420px) {
            #settings-image-api .image-api-inline,
            #settings-image-api .image-api-actions {
              grid-template-columns: 1fr;
            }
            #settings-image-api .image-api-actions__full {
              grid-column: auto;
            }
            #settings-image-api .image-api-provider-trigger,
            #settings-image-api .image-api-model-trigger {
              align-items: flex-start;
              flex-direction: column;
            }
            #settings-image-api .image-api-provider-trigger__meta,
            #settings-image-api .image-api-model-trigger__side {
              width: 100%;
              justify-content: space-between;
            }
            #settings-image-api .image-api-saved-item {
              flex-direction: column;
              align-items: stretch;
            }
            #settings-image-api .image-api-saved-item__actions {
              justify-content: stretch;
            }
            #settings-image-api .image-api-saved-item__actions .image-api-btn {
              width: 100%;
            }
            #settings-image-api .image-api-modal__panel {
              width: calc(100vw - 24px);
              margin-top: 48px;
            }
          }
        </style>

        <!-- ===== 设置：生图 API 配置界面 START =====
             说明：本区域用于配置生图接口；硅基流动 URL 不展示，OpenAI 兼容接口由用户自行填写。 -->
        <section class="ui-card image-api-card">
          <div class="image-api-head">
            <h3 class="image-api-title">
              <span class="image-api-icon-inline">${ICONS.image}</span>
              <span>生图API</span>
            </h3>
            <span class="image-api-badge">
              <span class="image-api-icon-inline">${renderProviderIcon(api.provider)}</span>
              <span>${escapeHtml(providerMeta.shortLabel)}</span>
            </span>
          </div>

          <!-- ===== 设置：生图 API 启用开关 START =====
               说明：点击滑动开关后立即写入 SettingsStore -> DB.js / IndexedDB；不依赖“保存设置”。 -->
          <div class="image-api-enable-row">
            <div class="image-api-enable-row__text">
              <span class="image-api-enable-row__title">启用生图API</span>
              <span class="image-api-enable-row__desc">开启后才会真正启用配置的生图 API。</span>
            </div>
            <button class="image-api-switch ${api.enabled ? 'is-on' : ''}" type="button" role="switch" aria-checked="${api.enabled ? 'true' : 'false'}" data-action="toggle-image-api-enabled">
              <span class="image-api-switch__knob"></span>
            </button>
          </div>
          <!-- ===== 设置：生图 API 启用开关 END ===== -->

          <!-- ===== 设置：生图 API 服务商切换 START =====
               说明：使用应用内弹窗切换硅基流动 / OpenAI 兼容接口；切换后即时更新表单但不自动保存 API Key。 -->
          <div class="image-api-field">
            <label class="image-api-label">API 服务商接口</label>
            <div id="image-api-provider-trigger-host">${renderProviderTrigger(api)}</div>
          </div>
          <!-- ===== 设置：生图 API 服务商切换 END ===== -->

          <div class="image-api-field image-api-field--openai-url ${showOpenAiBaseUrl ? '' : 'hidden'}" data-role="image-api-openai-url-field">
            <label class="image-api-label" for="image-api-base-url">API 地址</label>
            <input id="image-api-base-url" class="image-api-input" type="text" value="${escapeHtml(api.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl)}" placeholder="例如：https://api.openai.com/v1 或其它兼容接口地址" autocomplete="off">
            <span class="image-api-hint">如果服务商要求地址以 /v1 结尾，请直接填到这里；后台会清理末尾多余斜杠后再拼接 /models 与 /images/generations。</span>
          </div>

          <div class="image-api-field">
            <label class="image-api-label" for="image-api-key">API Key</label>
            <input id="image-api-key" class="image-api-input" type="password" value="${escapeHtml(api.apiKey)}" placeholder="请输入 ${escapeHtml(providerMeta.shortLabel)} API Key" autocomplete="off">
          </div>

          <div class="image-api-field">
            <label class="image-api-label">生图模型</label>
            <div class="image-api-inline">
              <div id="image-api-model-trigger-host">${renderModelTrigger(api)}<span data-role="image-api-selected-model" data-model="${escapeHtml(api.model)}"></span></div>
              <button class="ui-button image-api-btn image-api-btn--ghost" type="button" data-action="fetch-image-api-models">
                <span class="image-api-icon-inline">${ICONS.fetch}</span>
                <span>拉取模型</span>
              </button>
            </div>
          </div>

          <div class="image-api-field">
            <label class="image-api-label" for="image-api-test-prompt">测试提示词</label>
            <textarea id="image-api-test-prompt" class="image-api-textarea" placeholder="请输入测试生图提示词">${escapeHtml(api.testPrompt)}</textarea>
          </div>

          <div class="image-api-actions">
            <button class="ui-button image-api-btn" type="button" data-action="save-image-api-settings">
              <span class="image-api-icon-inline">${ICONS.save}</span>
              <span>保存设置</span>
            </button>
            <button class="ui-button image-api-btn image-api-btn--ghost" type="button" data-action="test-image-api-generate">
              <span class="image-api-icon-inline">${ICONS.test}</span>
              <span>测试生图</span>
            </button>
            <button class="ui-button image-api-btn image-api-btn--ghost image-api-actions__full" type="button" data-action="save-image-api-preset">
              <span class="image-api-icon-inline">${ICONS.storage}</span>
              <span>保存到已保存配置</span>
            </button>
          </div>

          ${renderResult('idle', '尚未操作')}
        </section>

        <section class="ui-card image-api-card">
          <div class="image-api-head image-api-head--preview">
            <h3 class="image-api-title">
              <span class="image-api-icon-inline">${ICONS.image}</span>
              <span>生图预览</span>
            </h3>
            <!-- ===== 设置：生图预览删除按钮 START =====
                 说明：点击后立即清空 previewImage 并写入 IndexedDB，减少不必要的数据存储。 -->
            <button class="image-api-delete-preview" type="button" data-action="delete-image-api-preview" aria-label="删除预览生图">
              <span class="image-api-icon-inline">${ICONS.delete}</span>
            </button>
            <!-- ===== 设置：生图预览删除按钮 END ===== -->
          </div>
          <div id="image-api-preview" class="image-api-preview">
            ${api.previewImage ? `<img src="${escapeHtml(api.previewImage)}" alt="生图预览">` : '<span>测试生图后会在这里显示预览</span>'}
          </div>
        </section>

        <!-- ===== 设置：生图 API 预设保存与快速切换 START =====
             说明：预设只保存到 settings.imageApi.savedConfigs，通过 SettingsStore -> DB.js / IndexedDB 持久化。 -->
        <section class="ui-card image-api-card">
          <div class="image-api-head">
            <h3 class="image-api-title">
              <span class="image-api-icon-inline">${ICONS.storage}</span>
              <span>已保存的生图API配置</span>
            </h3>
          </div>
          <div id="image-api-saved-configs">
            ${renderSavedImageApiConfigs(api.savedConfigs)}
          </div>
        </section>
        <!-- ===== 设置：生图 API 预设保存与快速切换 END ===== -->

        <!-- ===== 设置：生图 API 配置界面 END ===== -->

        ${renderImageProviderModal(api)}
        ${renderImageModelModal(api)}
      </div>
    </div>
  `;
}

function collectImageApiFromForm(container, fallback) {
  const normalizedFallback = normalizeImageApiSettings(fallback);
  const provider = normalizeProviderId(
    container.querySelector('.image-api-provider-trigger')?.dataset?.provider ||
    normalizedFallback.provider
  );
  const baseUrl = provider === 'openai'
    ? trimSlash(container.querySelector('#image-api-base-url')?.value || normalizedFallback.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl)
    : '';

  return normalizeImageApiSettings({
    ...normalizedFallback,
    provider,
    baseUrl,
    enabled: normalizedFallback.enabled,
    apiKey: container.querySelector('#image-api-key')?.value || '',
    model: container.querySelector('[data-role="image-api-selected-model"]')?.dataset?.model || normalizedFallback.model,
    availableModels: normalizedFallback.availableModels,
    testPrompt: container.querySelector('#image-api-test-prompt')?.value || normalizedFallback.testPrompt,
    previewImage: container.querySelector('#image-api-preview img')?.getAttribute('src') || normalizedFallback.previewImage,
    savedConfigs: normalizedFallback.savedConfigs
  });
}

function setResult(container, status, text) {
  const result = container.querySelector('#image-api-result');
  if (!result) return;
  const icon = status === 'success' ? ICONS.ok : status === 'error' ? ICONS.error : ICONS.image;
  result.className = `image-api-result ${status === 'success' ? 'is-success' : ''} ${status === 'error' ? 'is-error' : ''} ${status === 'loading' ? 'is-loading' : ''}`;
  result.innerHTML = `
    <span class="image-api-icon-inline">${icon}</span>
    <span>${escapeHtml(text)}</span>
  `;
}

function updateProviderTrigger(container, api) {
  const host = container.querySelector('#image-api-provider-trigger-host');
  const badge = container.querySelector('.image-api-badge');
  const urlField = container.querySelector('[data-role="image-api-openai-url-field"]');
  const keyInput = container.querySelector('#image-api-key');
  const baseUrlInput = container.querySelector('#image-api-base-url');
  const normalized = normalizeImageApiSettings(api);
  const meta = getProviderMeta(normalized.provider);

  if (host) host.innerHTML = renderProviderTrigger(normalized);
  if (badge) {
    badge.innerHTML = `
      <span class="image-api-icon-inline">${renderProviderIcon(normalized.provider)}</span>
      <span>${escapeHtml(meta.shortLabel)}</span>
    `;
  }
  if (urlField) urlField.classList.toggle('hidden', normalized.provider !== 'openai');
  if (keyInput) keyInput.placeholder = `请输入 ${meta.shortLabel} API Key`;
  if (baseUrlInput && normalized.provider === 'openai') baseUrlInput.value = normalized.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl;
}

function updateModelTrigger(container, api) {
  const host = container.querySelector('#image-api-model-trigger-host');
  if (!host) return;
  host.innerHTML = `${renderModelTrigger(api)}<span data-role="image-api-selected-model" data-model="${escapeHtml(api.model)}"></span>`;
}

function renderSavedConfigsInto(container, api) {
  const host = container.querySelector('#image-api-saved-configs');
  if (!host) return;
  host.innerHTML = renderSavedImageApiConfigs(api.savedConfigs || []);
}

function openProviderModal(container, api) {
  const modal = container.querySelector('#image-api-provider-modal');
  const host = container.querySelector('#image-api-provider-modal-options');
  if (!modal || !host) return;
  host.innerHTML = renderProviderModalOptions(normalizeProviderId(api.provider));
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeProviderModal(container) {
  const modal = container.querySelector('#image-api-provider-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function openModelModal(container, api) {
  const modal = container.querySelector('#image-api-model-modal');
  const host = container.querySelector('#image-api-model-modal-options');
  if (!modal || !host) return;
  host.innerHTML = renderModelModalOptions(api);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModelModal(container) {
  const modal = container.querySelector('#image-api-model-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function extractApiErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload?.error?.message || payload?.error?.msg || payload?.message || payload?.detail || fallback;
}

async function fetchImageApiModels(api) {
  const normalized = normalizeImageApiSettings(api);
  if (!normalized.apiKey) throw new Error('API Key 不能为空');

  const response = await fetch(`${getEffectiveImageBaseUrl(normalized)}/models`, {
    headers: { Authorization: `Bearer ${normalized.apiKey}` }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));

  return uniqueStrings(
    (payload?.data || payload?.models || [])
      .filter(isImageGenerationModel)
      .map((item) => item?.id || item?.name)
  ).sort();
}

async function requestImageGeneration(api) {
  const normalized = normalizeImageApiSettings(api);
  if (!normalized.apiKey) throw new Error('API Key 不能为空');
  if (!normalized.model) throw new Error('请先拉取并选择生图模型');
  if (!String(normalized.testPrompt || '').trim()) throw new Error('请输入测试提示词');

  const response = await fetch(`${getEffectiveImageBaseUrl(normalized)}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalized.apiKey}`
    },
    body: JSON.stringify({
      model: normalized.model,
      prompt: normalized.testPrompt,
      n: 1,
      size: '1024x1024'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));

  const imageUrl =
    payload?.data?.[0]?.url ||
    payload?.data?.[0]?.b64_json && `data:image/png;base64,${payload.data[0].b64_json}` ||
    payload?.images?.[0]?.url ||
    payload?.images?.[0]?.b64_json && `data:image/png;base64,${payload.images[0].b64_json}`;

  if (!imageUrl) throw new Error('接口未返回可预览图片');
  return imageUrl;
}

function buildSavedImageApiPreset(api, existingCount) {
  const normalized = normalizeImageApiSettings(api);
  const meta = getProviderMeta(normalized.provider);
  return {
    id: `image-api-saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${meta.shortLabel} · ${normalized.model || '未设置模型'} · ${existingCount + 1}`,
    provider: normalized.provider,
    baseUrl: normalized.provider === 'openai' ? normalized.baseUrl : '',
    apiKey: normalized.apiKey,
    model: normalized.model,
    availableModels: normalized.availableModels
  };
}

function applySavedImageApiConfig(container, savedItem) {
  const normalized = normalizeSavedImageApiConfigs([savedItem])[0] || normalizeSavedImageApiConfigs([])[0];
  if (!normalized) return null;

  const keyInput = container.querySelector('#image-api-key');
  const baseUrlInput = container.querySelector('#image-api-base-url');

  if (keyInput) keyInput.value = normalized.apiKey;
  if (baseUrlInput) baseUrlInput.value = normalized.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl;

  const next = normalizeImageApiSettings({
    provider: normalized.provider,
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    model: normalized.model,
    availableModels: normalized.availableModels
  });

  updateProviderTrigger(container, next);
  updateModelTrigger(container, next);
  return next;
}

export function bindImageApiEvents(container, { settings }) {
  let currentImageApiCache = normalizeImageApiSettings({});

  settings.getAll()
    .then((all) => {
      currentImageApiCache = normalizeImageApiSettings(all?.imageApi);
      updateProviderTrigger(container, currentImageApiCache);
      updateModelTrigger(container, currentImageApiCache);
      renderSavedConfigsInto(container, currentImageApiCache);
    })
    .catch(() => {
      currentImageApiCache = normalizeImageApiSettings({});
      updateProviderTrigger(container, currentImageApiCache);
      updateModelTrigger(container, currentImageApiCache);
      renderSavedConfigsInto(container, currentImageApiCache);
    });

  const saveImageApiSettings = async (note = '生图 API 设置已保存') => {
    const next = collectImageApiFromForm(container, currentImageApiCache);
    await settings.update({ imageApi: next });
    currentImageApiCache = next;
    Logger.info(note);
    return next;
  };

  container.addEventListener('click', async (event) => {
    const target = event.target.closest([
      '[data-action="open-image-api-provider-modal"]',
      '[data-action="close-image-api-provider-modal"]',
      '[data-action="choose-image-api-provider"]',
      '[data-action="open-image-api-model-modal"]',
      '[data-action="close-image-api-model-modal"]',
      '[data-action="choose-image-api-model"]',
      '[data-action="fetch-image-api-models"]',
      '[data-action="save-image-api-settings"]',
      '[data-action="test-image-api-generate"]',
      '[data-action="toggle-image-api-enabled"]',
      '[data-action="delete-image-api-preview"]',
      '[data-action="save-image-api-preset"]',
      '[data-action="apply-image-api-saved"]',
      '[data-action="delete-image-api-saved"]'
    ].join(', '));
    if (!target) return;

    const action = target.getAttribute('data-action');

    if (action === 'toggle-image-api-enabled') {
      const enabled = !target.classList.contains('is-on');
      const snapshot = collectImageApiFromForm(container, currentImageApiCache);
      currentImageApiCache = normalizeImageApiSettings({ ...snapshot, enabled });
      await settings.update({ imageApi: currentImageApiCache });
      target.classList.toggle('is-on', enabled);
      target.setAttribute('aria-checked', enabled ? 'true' : 'false');
      setResult(container, 'success', enabled ? '生图 API 已启用' : '生图 API 已关闭');
      Logger.info(enabled ? '生图 API 已启用' : '生图 API 已关闭');
      return;
    }

    if (action === 'open-image-api-provider-modal') {
      openProviderModal(container, currentImageApiCache);
      return;
    }

    if (action === 'close-image-api-provider-modal') {
      closeProviderModal(container);
      return;
    }

    if (action === 'choose-image-api-provider') {
      const provider = normalizeProviderId(target.getAttribute('data-provider'));
      currentImageApiCache = normalizeImageApiSettings({
        ...currentImageApiCache,
        provider,
        baseUrl: provider === 'openai' ? IMAGE_API_PROVIDER_META.openai.defaultBaseUrl : '',
        apiKey: '',
        model: '',
        availableModels: []
      });
      const keyInput = container.querySelector('#image-api-key');
      if (keyInput) keyInput.value = '';
      updateProviderTrigger(container, currentImageApiCache);
      updateModelTrigger(container, currentImageApiCache);
      closeProviderModal(container);
      setResult(container, 'success', `已切换到 ${getProviderMeta(provider).shortLabel}，密钥与模型已清空`);
      return;
    }

    if (action === 'delete-image-api-preview') {
      const snapshot = collectImageApiFromForm(container, currentImageApiCache);
      currentImageApiCache = normalizeImageApiSettings({ ...snapshot, previewImage: '' });
      await settings.update({ imageApi: currentImageApiCache });
      const preview = container.querySelector('#image-api-preview');
      if (preview) preview.innerHTML = '<span>测试生图后会在这里显示预览</span>';
      setResult(container, 'success', '已删除预览生图并清理存储');
      Logger.info('生图 API 预览图已删除');
      return;
    }

    if (action === 'open-image-api-model-modal') {
      openModelModal(container, currentImageApiCache);
      return;
    }

    if (action === 'close-image-api-model-modal') {
      closeModelModal(container);
      return;
    }

    if (action === 'choose-image-api-model') {
      const model = String(target.getAttribute('data-model') || '').trim();
      if (!model) return;
      currentImageApiCache = normalizeImageApiSettings({
        ...currentImageApiCache,
        model,
        availableModels: currentImageApiCache.availableModels
      });
      updateModelTrigger(container, currentImageApiCache);
      setResult(container, 'success', `已选择模型：${model}`);
      closeModelModal(container);
      return;
    }

    if (action === 'fetch-image-api-models') {
      const snapshot = collectImageApiFromForm(container, currentImageApiCache);
      target.setAttribute('disabled', 'disabled');
      setResult(container, 'loading', '正在拉取生图模型...');
      try {
        const models = await fetchImageApiModels(snapshot);
        if (!models.length) throw new Error('未获取到生图专用模型');
        currentImageApiCache = normalizeImageApiSettings({
          ...snapshot,
          availableModels: models,
          model: models.includes(snapshot.model) ? snapshot.model : models[0]
        });
        updateModelTrigger(container, currentImageApiCache);
        setResult(container, 'success', `模型拉取成功，共 ${models.length} 个`);
      } catch (error) {
        setResult(container, 'error', `拉取失败：${error?.message || '未知错误'}`);
      } finally {
        target.removeAttribute('disabled');
      }
      return;
    }

    if (action === 'save-image-api-settings') {
      try {
        await saveImageApiSettings();
        setResult(container, 'success', '生图 API 设置已保存');
      } catch (error) {
        setResult(container, 'error', `保存失败：${error?.message || '未知错误'}`);
      }
      return;
    }

    if (action === 'save-image-api-preset') {
      try {
        const snapshot = collectImageApiFromForm(container, currentImageApiCache);
        const duplicateIndex = snapshot.savedConfigs.findIndex(
          (item) =>
            item.provider === snapshot.provider &&
            item.baseUrl === snapshot.baseUrl &&
            item.model === snapshot.model &&
            item.apiKey === snapshot.apiKey
        );

        if (duplicateIndex >= 0) {
          setResult(container, 'success', '当前生图 API 配置已存在于已保存列表');
          return;
        }

        currentImageApiCache = normalizeImageApiSettings({
          ...snapshot,
          savedConfigs: [
            buildSavedImageApiPreset(snapshot, snapshot.savedConfigs.length),
            ...snapshot.savedConfigs
          ].slice(0, 20)
        });
        await settings.update({ imageApi: currentImageApiCache });
        renderSavedConfigsInto(container, currentImageApiCache);
        setResult(container, 'success', '已保存到“已保存的生图API配置”板块');
      } catch (error) {
        setResult(container, 'error', `保存预设失败：${error?.message || '未知错误'}`);
      }
      return;
    }

    if (action === 'apply-image-api-saved') {
      const savedId = target.getAttribute('data-saved-id');
      const snapshot = normalizeImageApiSettings(currentImageApiCache);
      const savedItem = snapshot.savedConfigs.find((item) => item.id === savedId);
      if (!savedItem) {
        setResult(container, 'error', '未找到目标已保存配置');
        return;
      }

      const applied = applySavedImageApiConfig(container, savedItem);
      if (!applied) return;
      currentImageApiCache = normalizeImageApiSettings({
        ...currentImageApiCache,
        ...applied,
        enabled: snapshot.enabled,
        testPrompt: snapshot.testPrompt,
        previewImage: snapshot.previewImage,
        savedConfigs: snapshot.savedConfigs
      });
      setResult(container, 'success', `已应用：${savedItem.name}`);
      return;
    }

    if (action === 'delete-image-api-saved') {
      try {
        const savedId = target.getAttribute('data-saved-id');
        const snapshot = normalizeImageApiSettings(currentImageApiCache);
        const savedItem = snapshot.savedConfigs.find((item) => item.id === savedId);
        if (!savedItem) {
          setResult(container, 'error', '未找到目标已保存配置');
          return;
        }

        currentImageApiCache = normalizeImageApiSettings({
          ...snapshot,
          savedConfigs: snapshot.savedConfigs.filter((item) => item.id !== savedId)
        });
        await settings.update({ imageApi: currentImageApiCache });
        renderSavedConfigsInto(container, currentImageApiCache);
        setResult(container, 'success', `已删除：${savedItem.name}`);
      } catch (error) {
        setResult(container, 'error', `删除失败：${error?.message || '未知错误'}`);
      }
      return;
    }

    if (action === 'test-image-api-generate') {
      const snapshot = collectImageApiFromForm(container, currentImageApiCache);
      target.setAttribute('disabled', 'disabled');
      setResult(container, 'loading', '正在测试生图...');
      try {
        const imageUrl = await requestImageGeneration(snapshot);
        const preview = container.querySelector('#image-api-preview');
        if (preview) {
          preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="生图预览">`;
        }
        currentImageApiCache = normalizeImageApiSettings({ ...snapshot, previewImage: imageUrl });
        await settings.update({ imageApi: currentImageApiCache });
        setResult(container, 'success', '测试生图成功，预览已更新并保存');
      } catch (error) {
        setResult(container, 'error', `测试失败：${error?.message || '未知错误'}`);
      } finally {
        target.removeAttribute('disabled');
      }
    }
  });
}
