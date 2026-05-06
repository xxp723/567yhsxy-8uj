/**
 * 文件名: js/core/ui/components/ApiErrorModal.js
 * 用途: 全局 API 报错弹窗独立模块
 * 说明:
 * 1. 供闲谈应用及后续其它应用复用，统一展示 429、503 等 API 常见错误。
 * 2. 只创建/更新运行时 DOM，不做任何持久化存储。
 * 3. 禁止使用 localStorage/sessionStorage；禁止使用 alert/confirm/prompt 等原生浏览器弹窗。
 * 4. 弹窗视觉尽量复用项目内 chat-modal 风格，并内置最小样式，方便跨应用直接接入。
 */

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] IconPark 风格图标
   说明：本模块涉及的按钮/提示图标统一使用 IconPark 风格 SVG，不依赖浏览器原生弹窗。
   ========================================================================== */
const API_ERROR_MODAL_ICONS = {
  warning: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6l18 32H6L24 6Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 18v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 48 48" fill="none"><path d="M14 14l20 20M34 14L14 34" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  refresh: `<svg viewBox="0 0 48 48" fill="none"><path d="M42 24a18 18 0 1 1-5.272-12.728" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M42 8v14H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] HTML 转义
   说明：仅用于弹窗渲染用户可见文本，不涉及任何持久化存储。
   ========================================================================== */
function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] 状态码说明与解决建议
   说明：后续如需扩展更多 API 错误码，优先修改本区域。
   ========================================================================== */
function getApiErrorPreset(statusOrCode = '') {
  const code = String(statusOrCode || '').toLowerCase();

  const presets = {
    400: {
      reason: '请求参数不符合 API 要求。',
      solution: '请检查模型名称、上下文长度、图片格式或请求参数设置后重试。'
    },
    401: {
      reason: 'API Key 无效、缺失或已过期。',
      solution: '请到设置应用检查主 API Key，重新保存后再发送。'
    },
    403: {
      reason: '当前 API Key 没有访问该模型或接口的权限。',
      solution: '请确认账号权限、模型权限、余额状态，或切换到有权限的模型。'
    },
    404: {
      reason: 'API 地址、接口路径或模型名称不存在。',
      solution: '请检查 Base URL 和模型名称是否正确，必要时重新拉取模型列表。'
    },
    408: {
      reason: 'API 请求超时。',
      solution: '请稍后重试；如果经常超时，可降低上下文长度、换网络或切换服务商。'
    },
    413: {
      reason: '本轮请求内容过大，超过服务商限制。',
      solution: '请减少短期记忆轮数、图片数量或本轮输入长度后重试。'
    },
    429: {
      reason: '请求过于频繁、额度不足，或触发服务商限流。',
      solution: '请稍等一会儿再试；也可以降低发送频率、检查额度/账单，或切换到其它模型。'
    },
    500: {
      reason: '服务商内部错误。',
      solution: '请稍后重试；如果持续出现，可切换模型或服务商。'
    },
    502: {
      reason: '服务商网关异常，API 临时不可用。',
      solution: '请稍后重试；如果一直失败，可切换服务商或检查 Base URL。'
    },
    503: {
      reason: '服务商当前繁忙、维护中或临时不可用。',
      solution: '请等待片刻再发送；也可以切换模型/服务商，或降低请求频率。'
    },
    504: {
      reason: '服务商响应超时。',
      solution: '请稍后重试；如频繁出现，可减少上下文长度或切换网络/服务商。'
    },
    empty_response: {
      reason: 'API 请求已完成，但本轮 AI 没有返回可展示的聊天内容。',
      solution: '请重试本轮回复；如果反复出现，请切换模型、检查提示词格式要求，或降低本轮上下文复杂度。'
    },
    network_error: {
      reason: '浏览器没有成功连接到 API 服务。',
      solution: '请检查网络、代理、Base URL、跨域设置或服务商状态后重试。'
    },
    config_error: {
      reason: '主 API 配置不完整。',
      solution: '请到设置应用补全主 API Key、Base URL 和模型后再发送。'
    }
  };

  return presets[code] || presets[Number(code)] || {
    reason: 'API 本轮请求没有成功完成。',
    solution: '请稍后重试；如果多次失败，请检查 API 配置、网络、余额和服务商状态。'
  };
}

function pickErrorStatus(errorOrInfo = {}) {
  const source = errorOrInfo && typeof errorOrInfo === 'object' ? errorOrInfo : {};
  return source.status
    ?? source.statusCode
    ?? source.code
    ?? source.apiErrorInfo?.status
    ?? source.apiErrorInfo?.statusCode
    ?? source.apiErrorInfo?.code
    ?? '';
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] API 错误归一化
   说明：
   1. 其它应用只要传 Error 或普通对象，本函数都会转成统一弹窗数据。
   2. 不读取/写入任何本地存储，不做双份兜底。
   ========================================================================== */
export function normalizeApiError(errorOrInfo = {}) {
  const source = errorOrInfo && typeof errorOrInfo === 'object' ? errorOrInfo : {};
  const nested = source.apiErrorInfo && typeof source.apiErrorInfo === 'object' ? source.apiErrorInfo : {};
  const rawStatus = pickErrorStatus(source) || pickErrorStatus(nested);
  const status = String(rawStatus || nested.type || source.type || '').trim();
  const preset = getApiErrorPreset(status || (source.name === 'TypeError' ? 'network_error' : ''));

  const provider = String(nested.provider || source.provider || '').trim();
  const model = String(nested.model || source.model || '').trim();
  const endpoint = String(nested.endpoint || source.endpoint || '').trim();
  const message = String(
    nested.message
    || source.message
    || source.reason
    || preset.reason
    || 'API 请求失败'
  ).trim();

  const reason = String(nested.reason || source.reason || preset.reason).trim();
  const solution = String(nested.solution || source.solution || preset.solution).trim();

  return {
    title: String(nested.title || source.title || 'AI 本轮没有成功回复').trim(),
    status: status || (source.name === 'TypeError' ? 'network_error' : ''),
    provider,
    model,
    endpoint,
    message,
    reason,
    solution,
    raw: source
  };
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] DOM 挂载点
   说明：
   1. 优先复用应用内已有 data-role="modal-mask"/"modal-panel"。
   2. 若某应用尚未提供弹窗容器，则创建模块自己的运行时容器；不使用原生浏览器弹窗。
   ========================================================================== */
function resolveModalHost(containerOrDocument = document) {
  const root = containerOrDocument?.querySelector ? containerOrDocument : document;
  let mask = root.querySelector('[data-role="modal-mask"]');
  let panel = root.querySelector('[data-role="modal-panel"]');

  if (mask && panel) {
    return { mask, panel, owned: false };
  }

  const ownerDocument = root.ownerDocument || document;
  mask = ownerDocument.querySelector('[data-role="api-error-modal-mask"]');
  panel = ownerDocument.querySelector('[data-role="api-error-modal-panel"]');

  if (!mask || !panel) {
    mask = ownerDocument.createElement('div');
    mask.className = 'api-error-modal-mask is-hidden';
    mask.dataset.role = 'api-error-modal-mask';
    mask.innerHTML = `<div class="api-error-modal-panel" data-role="api-error-modal-panel"></div>`;
    ownerDocument.body.appendChild(mask);
    panel = mask.querySelector('[data-role="api-error-modal-panel"]');
  }

  return { mask, panel, owned: true };
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] 内置最小样式
   说明：保证独立模块在其它应用中也能保持暖色主题与 iPhone 式层级；已有 chat-modal 样式会自动复用。
   ========================================================================== */
function ensureApiErrorModalStyle() {
  if (document.getElementById('api-error-modal-style')) return;

  const style = document.createElement('style');
  style.id = 'api-error-modal-style';
  style.textContent = `
    .api-error-modal-mask {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 22px;
      background: rgba(40, 30, 24, 0.36);
      backdrop-filter: blur(10px);
    }
    .api-error-modal-mask.is-hidden {
      display: none;
    }
    .api-error-modal-panel {
      width: min(420px, 92vw);
      max-height: min(78vh, 620px);
      overflow: hidden;
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255, 252, 247, 0.98), rgba(247, 238, 226, 0.98));
      box-shadow: 0 24px 70px rgba(68, 48, 34, 0.24);
      border: 1px solid rgba(164, 128, 92, 0.22);
      color: #4b3829;
    }
    .api-error-modal-card {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .api-error-modal-hero {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 12px;
      align-items: center;
      padding: 18px 18px 12px;
    }
    .api-error-modal-hero__icon {
      width: 44px;
      height: 44px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      color: #b15f34;
      background: rgba(255, 225, 200, 0.78);
      box-shadow: inset 0 0 0 1px rgba(177, 95, 52, 0.12);
    }
    .api-error-modal-hero__icon svg {
      width: 25px;
      height: 25px;
    }
    .api-error-modal-hero__text strong {
      display: block;
      font-size: 17px;
      line-height: 1.25;
      color: #3f2d21;
    }
    .api-error-modal-hero__text span {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.45;
      color: rgba(75, 56, 41, 0.68);
    }
    .api-error-modal-section {
      margin: 0 18px 12px;
      padding: 12px 14px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.56);
      border: 1px solid rgba(170, 132, 96, 0.16);
    }
    .api-error-modal-section__label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 700;
      color: rgba(92, 66, 45, 0.72);
    }
    .api-error-modal-section__text {
      margin: 0;
      font-size: 13px;
      line-height: 1.62;
      color: #4d3928;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .api-error-modal-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin: 0 18px 12px;
    }
    .api-error-modal-chip {
      padding: 5px 9px;
      border-radius: 999px;
      background: rgba(177, 95, 52, 0.1);
      color: #8a4e2d;
      font-size: 11px;
      font-weight: 700;
    }
    .api-error-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 18px 18px;
    }
    .api-error-modal-btn {
      appearance: none;
      border: 0;
      min-height: 38px;
      padding: 0 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      cursor: pointer;
      color: #fff;
      background: linear-gradient(135deg, #c98252, #9f6240);
      box-shadow: 0 10px 24px rgba(159, 98, 64, 0.22);
    }
    .api-error-modal-btn svg {
      width: 16px;
      height: 16px;
    }
  `;
  document.head.appendChild(style);
}

function hideApiErrorModal(mask, panel, owned = false) {
  if (!mask || !panel) return;
  if (owned) {
    mask.classList.add('is-hidden');
    panel.innerHTML = '';
    return;
  }
  mask.classList.add('is-hidden');
  panel.innerHTML = '';
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] 弹窗展示入口
   说明：
   1. showApiErrorModal(container, error) 是外部应用复用的主入口。
   2. 本区域只操作运行时 DOM，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function showApiErrorModal(containerOrDocument = document, errorOrInfo = {}) {
  if (typeof document === 'undefined') return null;

  ensureApiErrorModalStyle();

  const info = normalizeApiError(errorOrInfo);
  const { mask, panel, owned } = resolveModalHost(containerOrDocument);
  if (!mask || !panel) return null;

  const metaItems = [
    info.status ? `状态：${info.status}` : '',
    info.provider ? `服务商：${info.provider}` : '',
    info.model ? `模型：${info.model}` : '',
    info.endpoint ? `接口：${info.endpoint}` : ''
  ].filter(Boolean);

  panel.innerHTML = `
    <!-- ======================================================================
         [区域标注·已完成·全局API报错弹窗独立模块] API 报错应用内弹窗
         说明：本弹窗不写入聊天记录，不使用原生浏览器弹窗，不涉及持久化存储。
         ====================================================================== -->
    <div class="api-error-modal-card">
      <div class="api-error-modal-hero">
        <span class="api-error-modal-hero__icon">${API_ERROR_MODAL_ICONS.warning}</span>
        <span class="api-error-modal-hero__text">
          <strong>${escapeHtml(info.title)}</strong>
          <span>本轮 AI 没有成功生成可显示回复，下面是具体原因和处理建议。</span>
        </span>
      </div>
      ${metaItems.length ? `
        <div class="api-error-modal-meta">
          ${metaItems.map(item => `<span class="api-error-modal-chip">${escapeHtml(item)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="api-error-modal-section">
        <span class="api-error-modal-section__label">本轮为什么没有成功回复</span>
        <p class="api-error-modal-section__text">${escapeHtml(info.reason || info.message)}</p>
      </div>
      <div class="api-error-modal-section">
        <span class="api-error-modal-section__label">API 返回的信息</span>
        <p class="api-error-modal-section__text">${escapeHtml(info.message || '没有更多错误信息。')}</p>
      </div>
      <div class="api-error-modal-section">
        <span class="api-error-modal-section__label">你可以怎么解决</span>
        <p class="api-error-modal-section__text">${escapeHtml(info.solution)}</p>
      </div>
      <div class="api-error-modal-actions">
        <button class="api-error-modal-btn" data-action="api-error-modal-close" type="button">
          ${API_ERROR_MODAL_ICONS.refresh}<span>知道了</span>
        </button>
      </div>
    </div>
  `;

  mask.classList.remove('is-hidden');

  const close = () => hideApiErrorModal(mask, panel, owned);
  panel.querySelector('[data-action="api-error-modal-close"]')?.addEventListener('click', close, { once: true });

  return { close, info };
}

/* ==========================================================================
   [区域标注·已完成·全局API报错弹窗独立模块] 结构化错误创建工具
   说明：prompt.js 等 API 调用模块可用本函数抛出带 apiErrorInfo 的 Error。
   ========================================================================== */
export function createApiError(message = 'API 请求失败', details = {}) {
  const error = new Error(String(message || 'API 请求失败'));
  error.name = 'ApiRequestError';
  error.apiErrorInfo = normalizeApiError({
    ...details,
    message: String(message || details.message || 'API 请求失败')
  });
  return error;
}
