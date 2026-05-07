// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-voice.js
 * 用途: 闲谈应用 — 独立语音消息板块。
 *       负责咖啡功能区“语音”入口、应用内文字转模拟语音弹窗、语音气泡渲染与 AI 上下文文本。
 * 架构层: 应用层（闲谈子模块）
 */

import { TAB_ICONS, escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·语音板块 IconPark 图标]
   说明：
   1. 本文件内语音入口与语音气泡图案统一使用 IconPark 风格 SVG。
   2. 后续如需替换图标，只修改本区域即可。
   3. 本区域不涉及持久化存储，不使用 localStorage/sessionStorage。
   ========================================================================== */
const VOICE_ICONS = {
  voice: `<svg viewBox="0 0 48 48" fill="none"><rect x="17" y="5" width="14" height="24" rx="7" stroke="currentColor" stroke-width="3"/><path d="M10 22c0 8 6 14 14 14s14-6 14-14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 36v7M17 43h14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  wave: `<svg viewBox="0 0 48 48" fill="none"><path d="M18 16c3 3 4.5 5.7 4.5 8S21 29 18 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M25 10c5.5 5 8 9.5 8 14s-2.5 9-8 14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M32 5c8 7 12 13.5 12 19S40 36 32 43" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·AI语音消息通用协议与数据工具]
   说明：
   1. type=voice_message 同时支持用户模拟语音与 AI 主动发送语音消息。
   2. 用户语音由弹窗创建；AI 语音来自通用协议 `[语音] 角色名：{时长:xx}语音转写文本`。
   3. voiceText/voiceDuration 随当前聊天消息统一写入 DB.js / IndexedDB；本区域不读取或写入 localStorage/sessionStorage，不做双份存储兜底，不按长文本字段过滤。
   ========================================================================== */
export function isVoiceMessage(message = {}) {
  return String(message?.type || '') === 'voice_message';
}

export function normalizeVoiceText(value = '') {
  return String(value || '').trim();
}

/* ==========================================================================
   [区域标注·已完成·本次语音转文字清洗]
   说明：
   1. 仅服务语音消息的转文字内容展示与协议入库前整理。
   2. 已清除 `{4}` / `{时长:4}` 这类时长残留，避免展开后出现在正文最前面。
   3. 已移除中英文括号及括号内动作描写，例如 `（叹气）` / `(sigh)`。
   4. 本区域只处理字符串，不涉及持久化存储，不使用 localStorage/sessionStorage。
   ========================================================================== */
export function sanitizeVoiceTranscriptText(value = '') {
  return normalizeVoiceText(value)
    .replace(/^(?:\[语音\]\s*)+/g, '')
    .replace(/^(?:\{\s*(?:(?:时长|duration)\s*[：:]\s*)?\d{1,2}\s*(?:秒|s)?\s*\}\s*)+/gi, '')
    .replace(/（[^（）]*）|\([^()]*\)/g, '')
    .replace(/\s+([，。！？；：、])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getVoiceMessageDisplayText(message = {}) {
  const text = sanitizeVoiceTranscriptText(message?.voiceText || message?.content || '');
  return `[语音] ${text || '语音消息'}`;
}

export function buildVoiceAiContent(text = '') {
  const safeText = sanitizeVoiceTranscriptText(text);
  return `用户发送了一条语音消息，语音转文字内容：${safeText}`;
}

export function createVoiceMessage(text = '', options = {}) {
  const voiceText = sanitizeVoiceTranscriptText(text);
  if (!voiceText) return null;

  const duration = Math.max(1, Math.min(60, Math.ceil(voiceText.length / 3)));
  return {
    id: `user_voice_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'voice_message',
    content: buildVoiceAiContent(voiceText),
    voiceText,
    voiceDuration: Number(options.voiceDuration || duration) || duration,
    voiceExpanded: false,
    timestamp: Date.now()
  };
}

/* ==========================================================================
   [区域标注·已完成·本次语音协议解析修正]
   说明：
   1. 已支持 AI 输出的 `[语音] 角色名：{时长:xx}语音转写文本` 与 `{4}语音转写文本` 两种时长格式。
   2. `{4}` 会被解析为 voiceDuration=4，不再掉进 voiceText 导致展开时显示在正文前。
   3. voiceText/content 均写入清洗后的转文字文本；持久化仍由聊天消息页写入 DB.js / IndexedDB。
   ========================================================================== */
export function parseAiVoiceProtocolPayload(content = '') {
  const normalized = normalizeVoiceText(content)
    .replace(/^(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+$/g, '')
    .trim();
  if (!normalized) return null;

  const durationMatch = normalized.match(/^\{\s*(?:(?:时长|duration)\s*[：:]\s*)?(\d{1,2})\s*(?:秒|s)?\s*\}\s*([\s\S]*)$/i);
  const voiceText = sanitizeVoiceTranscriptText(durationMatch ? durationMatch[2] : normalized);
  if (!voiceText) return null;

  const durationFromProtocol = durationMatch ? Number(durationMatch[1]) : 0;
  const duration = Math.max(1, Math.min(60, Math.floor(durationFromProtocol || Math.ceil(voiceText.length / 3) || 1)));

  return {
    voiceText,
    voiceDuration: duration,
    content: `[语音] ${voiceText}`
  };
}

export function createAiVoiceMessageFromProtocol(block = {}) {
  const payload = parseAiVoiceProtocolPayload(block?.content || '');
  if (!payload) return null;

  return {
    role: 'assistant',
    type: 'voice_message',
    voiceRoleName: String(block?.roleName || '').trim(),
    voiceExpanded: false,
    ...payload
  };
}

/* ==========================================================================
   [区域标注·已完成·咖啡功能区语音入口]
   说明：
   1. 本按钮插入聊天消息页底栏“咖啡”功能区。
   2. 点击后由 index.js 打开 showVoiceMessageModal 应用内弹窗。
   3. 仅新增语音板块入口，不修改其它咖啡功能区板块行为。
   ========================================================================== */
export function renderVoiceFeatureButton() {
  return `
    <button class="msg-feature-dock__item" type="button" data-action="open-msg-voice-modal" data-feature="voice">
      ${VOICE_ICONS.voice}<span>语音</span>
    </button>
  `;
}

/* ==========================================================================
   [区域标注·已完成·本次语音气泡渲染修正]
   说明：
   1. 用户模拟语音与 AI 主动语音共用本气泡：语音波纹 + 秒数，默认不直接露出文字。
   2. 双击展开时显示已清洗的“语音转文字”，不显示 `{4}` 或括号动作描写。
   3. 渲染只读取消息对象字段；持久化由 index.js 调用 DB.js / IndexedDB 完成。
   ========================================================================== */
export function renderVoiceBubble(message = {}) {
  const text = sanitizeVoiceTranscriptText(message?.voiceText || message?.content || '');
  const duration = Math.max(1, Math.min(60, Number(message?.voiceDuration || Math.ceil(text.length / 3) || 1)));
  const expanded = Boolean(message?.voiceExpanded);

  return `
    <div class="msg-voice-bubble ${expanded ? 'is-expanded' : ''}"
         data-action="toggle-msg-voice-transcript"
         data-message-id="${escapeHtml(message?.id || '')}"
         title="双击展开/收起语音转文字">
      <div class="msg-voice-bubble__main">
        <span class="msg-voice-bubble__wave">${VOICE_ICONS.wave}</span>
        <span class="msg-voice-bubble__duration">${escapeHtml(String(duration))}秒</span>
      </div>
      ${expanded ? `
        <div class="msg-voice-bubble__divider"></div>
        <div class="msg-voice-bubble__transcript">
          <span class="msg-voice-bubble__label">语音转文字</span>
          <span class="msg-voice-bubble__text">${escapeHtml(text)}</span>
        </div>
      ` : ''}
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·语音输入应用内弹窗]
   说明：
   1. 弹窗沿用闲谈应用 chat-modal 样式，不使用浏览器原生 alert/confirm/prompt。
   2. 用户输入文字后保存为模拟语音消息，并发送到当前聊天界面。
   3. 弹窗本身不做持久化；保存流程由 index.js 创建消息并写入 DB.js / IndexedDB。
   ========================================================================== */
export function showVoiceMessageModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·语音板块弹窗] 输入文字并保存为模拟语音消息 -->
    <div class="chat-modal-header">
      <span>语音</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-voice-modal-body">
      <div class="chat-modal-hint">输入要模拟成语音消息的文字。保存后会发送到当前聊天界面；对方会收到“这是用户的语音消息”的上下文。</div>
      <textarea class="chat-modal-search msg-voice-modal-input"
                data-role="msg-voice-text-input"
                placeholder="输入语音转文字内容"></textarea>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-msg-voice" type="button">${VOICE_ICONS.voice}<span>保存</span></button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-voice-text-input"]')?.focus(), 30);
}

export function parseVoiceDraftFromModal(container) {
  return normalizeVoiceText(container.querySelector('[data-role="msg-voice-text-input"]')?.value || '');
}
