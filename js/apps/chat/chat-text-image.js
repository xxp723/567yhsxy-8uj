// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-text-image.js
 * 用途: 闲谈应用 — 咖啡功能区“文字图”独立模块。
 *       负责文字图入口、应用内弹窗、消息数据构造、拍立得气泡与无关闭按钮悬浮预览。
 * 架构层: 应用层（闲谈子模块）
 */

import { TAB_ICONS, escapeHtml, renderModalNotice } from './chat-utils.js';

/* ==========================================================================
   [模块标注·已完成·文字图]
   说明：
   1. 本模块只服务聊天消息界面咖啡功能区“文字图”。
   2. 文字图不会生成真实图片、不会写 imageUrl、不会触发视觉识别 token。
   3. AI 只会收到精简文本：用户发来一张可见的文字图样式图片，图中文字：……
   4. 持久化由调用方写入 DB.js / IndexedDB；本模块不使用浏览器同步键值存储。
   ========================================================================== */

const TEXT_IMAGE_ICON = `<svg viewBox="0 0 48 48" fill="none"><path d="M8 8h32v32H8V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 17h18M15 24h18M15 31h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M36 34l4 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

/* ==========================================================================
   [区域标注·已完成·本次文字图掉格式解析增强]
   说明：
   1. 前端增强 AI / 用户文字图内容清洗，兼容轻微掉格式：`[文字图]`、`【文字图】`、Markdown 包裹、说明头、角色名前缀等。
   2. 只清理文字图协议残片与包装噪音，尽量保留正文内部换行排版，不改持久化结构。
   3. 不使用 localStorage/sessionStorage，不做双份兜底；消息落库仍由调用方统一走 DB.js / IndexedDB。
   ========================================================================== */
function normalizeTextImageText(value = '') {
  let text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();

  text = text
    .replace(/^```(?:text|txt|md|markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  text = text
    .replace(/^\s*(?:\*\*)?\s*`?\s*(?:\[\s*文字图\s*\]|【\s*文字图\s*】)\s*`?(?:\*\*)?\s*/i, '')
    .replace(/^\s*(?:以下是|这是|生成的|输出的)?\s*(?:文字图|图片内容|正文内容|内容正文)\s*[：:]\s*/i, '')
    .replace(/^\s*[^：:\n`*]{1,40}\s*[：:]\s*(?=\S)/, '')
    .replace(/^\s*(?:内容|正文|文本|图中文字)\s*[：:]\s*/i, '')
    .trim();

  text = text
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

export function isTextImageMessage(message = {}) {
  return String(message?.type || '') === 'image'
    && String(message?.imageSource || '') === 'text-image'
    && String(message?.textImageText || '').trim();
}

export function buildTextImageAiContent(text = '') {
  const safeText = normalizeTextImageText(text);
  return safeText ? `用户发来一张可见的文字图样式图片，图中文字：${safeText}` : '';
}

export function createTextImageMessage(text = '', options = {}) {
  const safeText = normalizeTextImageText(text);
  if (!safeText) return null;

  const now = Number(options.timestamp || Date.now()) || Date.now();
  return {
    id: `user_text_image_${now}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'image',
    imageSource: 'text-image',
    imageName: '文字图',
    textImageText: safeText,
    content: buildTextImageAiContent(safeText),
    timestamp: now
  };
}

/* ==========================================================================
   [区域标注·已完成·AI文字图协议接入]
   说明：
   1. AI 在生图 API 未开启时可用 [文字图] 协议发送“文字图图片”气泡。
   2. 该消息复用现有文字图渲染结构，不写 imageUrl，不触发视觉识别 token。
   3. 持久化仍由调用方把消息对象写入 DB.js / IndexedDB；本模块不使用 localStorage/sessionStorage。
   ========================================================================== */
export function createAiTextImageMessageFromProtocol(text = '', options = {}) {
  const safeText = normalizeTextImageText(text);
  if (!safeText) return null;

  const now = Number(options.timestamp || Date.now()) || Date.now();
  return {
    id: `ai_text_image_${now}_${Math.random().toString(16).slice(2)}`,
    role: 'assistant',
    type: 'image',
    imageSource: 'text-image',
    imageName: '文字图',
    textImageText: safeText,
    content: `[文字图] ${safeText}`,
    timestamp: now
  };
}

export function renderTextImageFeatureButton() {
  return `
    <!-- ======================================================================
         [区域标注·已完成·文字图板块入口接入]
         说明：咖啡功能区新增“文字图”入口；图标为 IconPark 风格 SVG，功能实现见 chat-text-image.js。
         ====================================================================== -->
    <button class="msg-feature-dock__item msg-feature-dock__item--text-image" type="button" data-action="open-msg-text-image-modal" data-feature="text-image">
      ${TEXT_IMAGE_ICON}<span>文字图</span>
    </button>
  `;
}

export function renderTextImageBubble(message = {}) {
  const text = normalizeTextImageText(message?.textImageText || '');
  const messageId = String(message?.id || '').trim();
  const title = text ? `Picture: ${text}` : 'Picture';

  return `
    <!-- ======================================================================
         [区域标注·已修改·文字图消息渲染]
         说明：发送到聊天消息界面后，文字图下方标题已改为英文“Picture”；未点开时只显示拍立得图片本体。
         ====================================================================== -->
    <button class="msg-text-image-bubble"
            data-action="open-msg-text-image-preview"
            data-message-id="${escapeHtml(messageId)}"
            type="button"
            title="${escapeHtml(title)}">
      <span class="msg-text-image-bubble__photo" aria-hidden="true"></span>
      <span class="msg-text-image-bubble__caption">Picture</span>
    </button>
  `;
}

export function showTextImageModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- ======================================================================
         [区域标注·已完成·文字图输入弹窗]
         说明：使用闲谈应用内弹窗输入文字图描述，不使用浏览器原生弹窗或原生选择器。
         ====================================================================== -->
    <div class="chat-modal-header">
      <span>文字图</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-text-image-modal-body">
      <div class="chat-modal-hint">输入要放进文字图里的内容。保存后会以“图片消息”的样式发送，但不会生成真实图片或消耗视觉识别 token。</div>
      <textarea class="chat-modal-search msg-text-image-modal__input"
                data-role="msg-text-image-input"
                rows="5"
                placeholder="输入文字图内容"></textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-msg-text-image" type="button">保存发送</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  window.setTimeout(() => panel.querySelector('[data-role="msg-text-image-input"]')?.focus(), 30);
}

export function parseTextImageDraftFromModal(container) {
  const input = container.querySelector('[data-role="msg-text-image-input"]');
  return normalizeTextImageText(input?.value || '');
}

export function validateTextImageDraft(container, text = '') {
  const safeText = normalizeTextImageText(text);
  if (!safeText) {
    renderModalNotice(container, '请输入文字图内容');
    return false;
  }
  return true;
}

export function openTextImagePreview(container, message = {}) {
  const root = container.querySelector('[data-role="chat-app-root"]') || container;
  const text = normalizeTextImageText(message?.textImageText || '');
  if (!root || !text) return;

  root.querySelector('[data-role="msg-text-image-preview"]')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'msg-text-image-preview is-open';
  overlay.dataset.role = 'msg-text-image-preview';
  overlay.innerHTML = `
    <!-- ======================================================================
         [区域标注·已修改·文字图悬浮预览]
         说明：无关闭按钮；点击悬浮图外侧遮罩关闭。预览中部画面已改为纯色，不再使用渐变纹理或白色光晕。
         ====================================================================== -->
    <div class="msg-text-image-preview__panel" role="dialog" aria-label="文字图预览">
      <div class="msg-text-image-preview__paper">
        <div class="msg-text-image-preview__content">${escapeHtml(text)}</div>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });

  root.appendChild(overlay);
}
