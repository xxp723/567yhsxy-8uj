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
   3. AI 只会收到精简文本：用户发送了一张文字图图片，图片内容：……
   4. 持久化由调用方写入 DB.js / IndexedDB；本模块不使用浏览器同步键值存储。
   ========================================================================== */

const TEXT_IMAGE_ICON = `<svg viewBox="0 0 48 48" fill="none"><path d="M8 8h32v32H8V8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 17h18M15 24h18M15 31h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M36 34l4 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;

function normalizeTextImageText(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function isTextImageMessage(message = {}) {
  return String(message?.type || '') === 'image'
    && String(message?.imageSource || '') === 'text-image'
    && String(message?.textImageText || '').trim();
}

export function buildTextImageAiContent(text = '') {
  const safeText = normalizeTextImageText(text);
  return safeText ? `用户发送了一张文字图图片，图片内容：${safeText}` : '';
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
  const title = text ? `文字图：${text}` : '文字图';

  return `
    <!-- ======================================================================
         [区域标注·已完成·文字图消息渲染]
         说明：未点开时只显示宝丽来边框与纯色画面；文字只在点击后的悬浮图中展示。
         ====================================================================== -->
    <button class="msg-text-image-bubble"
            data-action="open-msg-text-image-preview"
            data-message-id="${escapeHtml(messageId)}"
            type="button"
            title="${escapeHtml(title)}">
      <span class="msg-text-image-bubble__photo" aria-hidden="true"></span>
      <span class="msg-text-image-bubble__caption">文字图</span>
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
         [区域标注·已完成·文字图悬浮预览]
         说明：无关闭按钮；点击悬浮图外侧遮罩关闭，风格参考心声面板的暖色悬浮卡片。
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
