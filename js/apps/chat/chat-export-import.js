// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-export-import.js
 * 用途: 闲谈应用 — 当前会话聊天记录导出 / 导入独立模块。
 * 说明：
 * 1. 仅处理当前聊天设置页所在的单个联系人会话，不导出其它联系人。
 * 2. 导入仅接受本模块从聊天设置页导出的 JSON 格式，并替换当前会话消息。
 * 3. 持久化由调用方通过 DB.js / IndexedDB 写入；本模块不使用 localStorage/sessionStorage。
 * 4. 不做双份存储兜底，不按长文本字段过滤消息内容。
 * 5. [已完成·心声导出导入] 每轮消息对象上的 innerVoice 字段会随 JSON 原样导出/导入；
 *    TXT / HTML 导出会在对应轮数消息后显示“心声”板块。
 */

import { TAB_ICONS, escapeHtml } from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·聊天记录导入导出板块] 设置页板块 HTML
   说明：
   1. 渲染位置由 chat-message.js 放在“清空全部聊天记录”上方。
   2. 左右两个按钮同一行；按钮不使用额外图标，避免与现有设置操作风格冲突。
   3. 隐藏文件输入仅用于选择 JSON 文件；导入结果由 index.js 写入 DB.js / IndexedDB。
   ========================================================================== */
export function renderChatExportImportSettingsSection() {
  return `
    <!-- ======================================================================
         [区域标注·已完成·聊天记录导入导出板块]
         说明：
         1. 仅导出/导入当前聊天设置页对应联系人的聊天记录。
         2. 导出支持 HTML / TXT / JSON；导入仅支持从本板块导出的 JSON。
         3. 导入后会替换当前会话消息并通过 DB.js / IndexedDB 保存，不使用 localStorage/sessionStorage。
         ====================================================================== -->
    <section class="msg-settings-card msg-settings-export-import-card">
      <div class="msg-settings-card__title">聊天记录导入导出</div>
      <div class="msg-settings-card__desc">仅作用于当前窗口联系人；导入 JSON 后会直接替换当前聊天消息记录。</div>
      <div class="msg-export-import-actions">
        <button class="msg-export-import-action" data-action="open-chat-export-modal" type="button">导出聊天记录</button>
        <button class="msg-export-import-action" data-action="open-chat-import-json-picker" type="button">导入聊天记录</button>
      </div>
      <input data-role="chat-import-json-file-input" type="file" accept="application/json,.json" hidden>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·聊天记录导出格式弹窗]
   说明：使用闲谈应用内 chat-modal 样式，不使用 alert/confirm/prompt 或浏览器原生选择器。
   ========================================================================== */
export function showChatExportFormatModal(container) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>导出聊天记录</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">请选择当前联系人聊天记录的导出格式。</div>
      <div class="msg-export-format-list">
        <button class="msg-export-format-option" data-action="confirm-chat-export" data-export-format="html" type="button">
          <strong>HTML 完整导出</strong>
          <em>保留聊天气泡样式、图片、HTML卡片、礼物、转账等，可直接用浏览器打开。</em>
        </button>
        <button class="msg-export-format-option" data-action="confirm-chat-export" data-export-format="txt" type="button">
          <strong>TXT 纯文字导出</strong>
          <em>TXT文本格式，图片、卡片、礼物、转账等会显示为文字描述。</em>
        </button>
        <button class="msg-export-format-option" data-action="confirm-chat-export" data-export-format="json" type="button">
          <strong>JSON 数据导出</strong>
          <em>用于后续从聊天设置页导入并恢复当前联系人聊天记录。</em>
        </button>
      </div>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·聊天记录导入导出提示弹窗]
   说明：错误/结果提示均使用应用内弹窗，不使用浏览器原生弹窗。
   ========================================================================== */
export function showChatExportImportNoticeModal(container, { title = '提示', message = '' } = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;
  panel.innerHTML = `
    <div class="chat-modal-header">
      <span>${escapeHtml(title)}</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">${escapeHtml(message || '操作已完成。')}</div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="close-modal" type="button">知道了</button>
    </div>
  `;
  mask.classList.remove('is-hidden');
}

/* ==========================================================================
   [区域标注·已完成·聊天记录导入 JSON 文件选择入口]
   说明：只触发当前设置页隐藏 input；读取、校验和落库由 index.js 处理。
   ========================================================================== */
export function openChatImportJsonFilePicker(container) {
  const input = container.querySelector('[data-role="chat-import-json-file-input"]');
  if (!input) return false;
  input.value = '';
  input.click();
  return true;
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function formatExportDateForFileName(timestamp = Date.now()) {
  const date = new Date(Number(timestamp || Date.now()) || Date.now());
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function getCurrentChatExportSession(state) {
  return (state?.sessions || []).find(item => String(item.id) === String(state?.currentChatId)) || null;
}

export function getCurrentChatExportRoleId(state) {
  const session = getCurrentChatExportSession(state);
  const contact = (state?.contacts || []).find(item => String(item.id) === String(state?.currentChatId)) || null;
  return String(session?.roleId || contact?.roleId || session?.id || state?.currentChatId || '').trim();
}

function getCurrentChatExportDisplayName(state) {
  const session = getCurrentChatExportSession(state);
  return String(session?.remark || session?.name || '聊天记录').trim() || '聊天记录';
}

/* ==========================================================================
   [区域标注·已完成·聊天记录 JSON 导出数据结构]
   说明：
   1. roleId 用于导入时校验“是否同一个联系人/角色”。
   2. messages 原样完整保存，不做长文本过滤，不删除图片 / HTML 卡片 / 礼物 / 转账字段。
   3. [已完成·心声导出导入] 每轮消息对象上的 innerVoice 字段保留在 messages 内；
      导入 JSON 后会跟随对应消息恢复，不另写双份心声存储。
   ========================================================================== */
export function buildCurrentChatExportPayload(state) {
  const session = getCurrentChatExportSession(state);
  if (!session || !state?.currentChatId) throw new Error('当前没有打开聊天联系人，无法导出。');
  const exportedAt = Date.now();
  const roleId = getCurrentChatExportRoleId(state);
  const messages = cloneJsonSafe(Array.isArray(state.currentMessages) ? state.currentMessages : []);
  return {
    app: 'miniphone-chat',
    kind: 'single-contact-chat-messages',
    version: 2,
    exportedAt,
    maskId: String(state.activeMaskId || ''),
    chatId: String(state.currentChatId || ''),
    roleId,
    chatName: getCurrentChatExportDisplayName(state),
    session: {
      id: String(session.id || ''),
      roleId,
      name: String(session.name || ''),
      remark: String(session.remark || ''),
      type: String(session.type || 'private'),
      avatar: String(session.avatar || '')
    },
    innerVoiceExport: {
      mode: 'message-innerVoice-field',
      field: 'innerVoice',
      count: countMessagesWithInnerVoice(messages)
    },
    messages
  };
}

function getMessageReadableText(message = {}) {
  const type = String(message?.type || '');
  if (type === 'sticker') return `[表情包] ${String(message.stickerName || message.content || '表情包').trim()}`;
  if (type === 'image') return `[图片] ${String(message.imageName || message.content || '图片').trim()}`;
  if (type === 'card') return `[HTML卡片] ${String(message.cardTitle || '互动卡片').trim()}`;
  if (type === 'transfer') return `[转账] ${String(message.transferDisplayAmount || message.content || '¥0.00').trim()}${String(message.transferNote || '').trim() ? `（备注：${String(message.transferNote).trim()}）` : ''}`;
  if (type === 'gift') return `[礼物] ${String(message.giftTitle || message.content || '礼物').trim()}${String(message.giftDisplayPrice || '').trim() ? ` · ${String(message.giftDisplayPrice).trim()}` : ''}`;
  if (type === 'voice_message') return `[语音] ${String(message.voiceText || message.content || '语音消息').trim()}`;
  return String(message.content || '').trim();
}

/* ==========================================================================
   [区域标注·已完成·心声导出导入] 对应轮数心声读取与格式化
   说明：
   1. 只读取当前消息对象上的 innerVoice 字段；该字段已随 currentMessages 写入 DB.js / IndexedDB。
   2. JSON 导出/导入会原样保留 innerVoice，TXT / HTML 导出会把它显示在对应消息后方。
   3. 不读取独立心声历史，不写 localStorage/sessionStorage，不做双份存储兜底，不按长文本过滤。
   ========================================================================== */
function pickInnerVoiceValue(raw = {}, keys = []) {
  for (const key of keys) {
    const value = raw?.[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function getMessageInnerVoiceExportData(message = {}) {
  const raw = message?.innerVoice;
  if (!raw || typeof raw !== 'object') return null;

  const data = {
    status: pickInnerVoiceValue(raw, ['status', '状态']),
    action: pickInnerVoiceValue(raw, ['action', '动作']),
    mood: pickInnerVoiceValue(raw, ['mood', '心情']),
    heartbeat: pickInnerVoiceValue(raw, ['heartbeat', '心跳']),
    jealousy: pickInnerVoiceValue(raw, ['jealousy', '醋意']),
    affection: pickInnerVoiceValue(raw, ['affection', '好感', '好感度']),
    desire: pickInnerVoiceValue(raw, ['desire', '性欲', '性欲值']),
    voice: pickInnerVoiceValue(raw, ['voice', '心声', '真实心声', '真实想法']),
    fantasy: pickInnerVoiceValue(raw, ['fantasy', '性幻想'])
  };

  return Object.values(data).some(value => String(value || '').trim()) ? data : null;
}

function countMessagesWithInnerVoice(messages = []) {
  return (Array.isArray(messages) ? messages : []).filter(message => getMessageInnerVoiceExportData(message)).length;
}

function buildInnerVoiceTxtLines(message = {}) {
  const data = getMessageInnerVoiceExportData(message);
  if (!data) return [];

  const lines = ['    【心声】'];
  if (data.status) lines.push(`    状态：${data.status}`);
  if (data.action) lines.push(`    动作：${data.action}`);
  if (data.mood) lines.push(`    心情：${data.mood}`);
  if (data.heartbeat) lines.push(`    心跳：${data.heartbeat}`);
  if (data.jealousy) lines.push(`    醋意：${data.jealousy}`);
  if (data.affection) lines.push(`    好感：${data.affection}`);
  if (data.desire) lines.push(`    性欲：${data.desire}`);
  if (data.voice) lines.push(`    真实心声：${data.voice}`);
  if (data.fantasy) lines.push(`    性幻想：${data.fantasy}`);
  return lines;
}

function renderInnerVoiceExportHtml(message = {}) {
  const data = getMessageInnerVoiceExportData(message);
  if (!data) return '';

  const items = [
    ['状态', data.status],
    ['动作', data.action],
    ['心情', data.mood],
    ['心跳', data.heartbeat],
    ['醋意', data.jealousy],
    ['好感', data.affection],
    ['性欲', data.desire],
    ['真实心声', data.voice],
    ['性幻想', data.fantasy]
  ].filter(([, value]) => String(value || '').trim());

  if (!items.length) return '';

  return `
      <div class="chat-export-inner-voice">
        <div class="chat-export-inner-voice__title">心声</div>
        ${items.map(([label, value]) => `
          <div class="chat-export-inner-voice__item">
            <span>${escapeHtml(label)}</span>
            <p>${escapeHtml(value)}</p>
          </div>
        `).join('')}
      </div>
  `;
}

function formatMessageTime(timestamp = 0) {
  const value = Number(timestamp || 0) || 0;
  if (!value) return '';
  const date = new Date(value);
  const pad = item => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getSenderName(message = {}, payload = {}) {
  if (message.role === 'user') return '我';
  if (message.role === 'assistant' || message.role === 'other') return payload.chatName || '对方';
  return '系统';
}

function buildCurrentChatTxtExport(payload = {}) {
  const lines = [
    `聊天记录：${payload.chatName || '聊天记录'}`,
    `导出时间：${formatMessageTime(payload.exportedAt)}`,
    `联系人ID：${payload.roleId || payload.chatId || ''}`,
    ''
  ];
  (Array.isArray(payload.messages) ? payload.messages : []).forEach((message, index) => {
    const text = getMessageReadableText(message);
    const innerVoiceLines = buildInnerVoiceTxtLines(message);
    if (!text && !innerVoiceLines.length) return;
    if (text) {
      lines.push(`[${index + 1}] ${formatMessageTime(message.timestamp)} ${getSenderName(message, payload)}：${text}`);
    } else {
      lines.push(`[${index + 1}] ${formatMessageTime(message.timestamp)} ${getSenderName(message, payload)}：`);
    }
    if (message.quote?.text) lines.push(`    引用：${message.quote.senderName || ''} ${message.quote.text}`);
    lines.push(...innerVoiceLines);
  });
  return `${lines.join('\n')}\n`;
}

function renderStandaloneMessageHtml(message = {}, payload = {}) {
  const isUser = message.role === 'user';
  const type = String(message.type || '');
  const systemTypes = ['transfer_system', 'ai_withdraw_system', 'user_withdraw_system', 'html_card_interaction_system'];
  const readableText = getMessageReadableText(message);
  if (systemTypes.includes(type)) return `<div class="chat-export-system">${escapeHtml(readableText)}</div>`;

  let bodyHtml = '';
  if (type === 'sticker' && message.stickerUrl) {
    bodyHtml = `<img class="chat-export-sticker" src="${escapeHtml(message.stickerUrl)}" alt="${escapeHtml(message.stickerName || '表情包')}"><span>${escapeHtml(message.stickerName || '')}</span>`;
  } else if (type === 'image' && message.imageUrl) {
    bodyHtml = `<img class="chat-export-image" src="${escapeHtml(message.imageUrl)}" alt="${escapeHtml(message.imageName || '图片')}"><span>${escapeHtml(message.imageName || '')}</span>`;
  } else if (type === 'card' && (message.cardHtml || message.content)) {
    bodyHtml = `<div class="chat-export-card-title">${escapeHtml(message.cardTitle || 'HTML卡片')}</div><iframe class="chat-export-card-frame" sandbox="allow-forms allow-popups-to-escape-sandbox" srcdoc="${escapeHtml(String(message.cardHtml || message.content || ''))}"></iframe>`;
  } else if (type === 'transfer') {
    bodyHtml = `<div class="chat-export-transfer"><strong>转账 ${escapeHtml(message.transferDisplayAmount || message.content || '')}</strong>${message.transferNote ? `<span>备注：${escapeHtml(message.transferNote)}</span>` : ''}</div>`;
  } else if (type === 'gift') {
    bodyHtml = `<div class="chat-export-gift"><strong>${escapeHtml(message.giftTitle || '礼物')}</strong>${message.giftDisplayPrice ? `<span>${escapeHtml(message.giftDisplayPrice)}</span>` : ''}${message.giftNote ? `<em>${escapeHtml(message.giftNote)}</em>` : ''}</div>`;
  } else if (type === 'voice_message') {
    bodyHtml = `<div class="chat-export-voice">语音消息：${escapeHtml(message.voiceText || message.content || '')}</div>`;
  } else {
    bodyHtml = escapeHtml(readableText);
  }

  const quoteHtml = message.quote?.text
    ? `<div class="chat-export-quote">${escapeHtml(message.quote.senderName || '')}：${escapeHtml(message.quote.text || '')}</div>`
    : '';
  const innerVoiceHtml = renderInnerVoiceExportHtml(message);

  return `
    <div class="chat-export-row ${isUser ? 'is-user' : 'is-other'}">
      <div class="chat-export-meta">${escapeHtml(getSenderName(message, payload))} · ${escapeHtml(formatMessageTime(message.timestamp))}</div>
      <div class="chat-export-bubble">${quoteHtml}${bodyHtml}</div>
      ${innerVoiceHtml}
    </div>
  `;
}

function buildCurrentChatHtmlExport(payload = {}) {
  const title = `${payload.chatName || '聊天记录'} - 聊天记录导出`;
  const messagesHtml = (Array.isArray(payload.messages) ? payload.messages : []).map(message => renderStandaloneMessageHtml(message, payload)).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;background:#f6eee5;color:#3f2d25;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}.chat-export-page{max-width:760px;margin:0 auto;min-height:100vh;padding:22px 14px 36px;box-sizing:border-box;background:linear-gradient(180deg,#fff8f1,#f2e3d5)}.chat-export-header{position:sticky;top:0;z-index:2;margin:-22px -14px 18px;padding:18px;background:rgba(255,248,241,.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(103,72,55,.12)}.chat-export-header h1{margin:0 0 6px;font-size:22px}.chat-export-header p{margin:0;color:#8b6b5a;font-size:13px}.chat-export-row{display:flex;flex-direction:column;align-items:flex-start;margin:12px 0}.chat-export-row.is-user{align-items:flex-end}.chat-export-meta{font-size:11px;color:#9a7b68;margin:0 8px 4px}.chat-export-bubble{max-width:78%;padding:10px 12px;border-radius:18px;background:#fff;border:1px solid rgba(103,72,55,.12);box-shadow:0 6px 18px rgba(74,52,42,.08);white-space:pre-wrap;word-break:break-word}.chat-export-row.is-user .chat-export-bubble{background:#d9f0c7}.chat-export-system{text-align:center;color:#a08372;font-size:12px;margin:12px auto}.chat-export-quote{border-left:3px solid rgba(103,72,55,.22);padding-left:8px;margin-bottom:7px;color:#7f6658;font-size:12px}.chat-export-image{display:block;max-width:260px;max-height:360px;border-radius:14px;margin-bottom:6px}.chat-export-sticker{display:block;max-width:128px;max-height:128px;object-fit:contain}.chat-export-card-frame{width:320px;max-width:100%;height:420px;border:0;border-radius:14px;background:#fff}.chat-export-card-title,.chat-export-transfer strong,.chat-export-gift strong{display:block;margin-bottom:6px}.chat-export-transfer span,.chat-export-gift span,.chat-export-gift em{display:block;color:#7f6658;font-style:normal;font-size:13px}.chat-export-inner-voice{max-width:78%;margin:7px 4px 0;padding:10px 12px;border-radius:16px;background:rgba(255,248,241,.9);border:1px solid rgba(184,129,94,.28);box-shadow:0 6px 16px rgba(122,83,58,.08);box-sizing:border-box}.chat-export-row.is-user .chat-export-inner-voice{background:rgba(247,255,239,.9)}.chat-export-inner-voice__title{font-size:13px;font-weight:800;color:#7b4d36;margin-bottom:7px;letter-spacing:.08em}.chat-export-inner-voice__item{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin:4px 0;font-size:12px;line-height:1.55}.chat-export-inner-voice__item span{color:#9a6d54;font-weight:700}.chat-export-inner-voice__item p{margin:0;color:#4d3428;white-space:pre-wrap;word-break:break-word}
</style>
</head>
<body>
  <main class="chat-export-page">
    <header class="chat-export-header">
      <h1>${escapeHtml(payload.chatName || '聊天记录')}</h1>
      <p>导出时间：${escapeHtml(formatMessageTime(payload.exportedAt))} · 联系人ID：${escapeHtml(payload.roleId || payload.chatId || '')}</p>
    </header>
    ${messagesHtml || '<div class="chat-export-system">暂无聊天记录</div>'}
  </main>
</body>
</html>`;
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

/* ==========================================================================
   [区域标注·已完成·聊天记录导出执行]
   说明：
   1. 导出只读取当前运行时 state.currentMessages，不写任何持久化存储。
   2. [已完成·心声导出导入] TXT / HTML 会展示每条消息携带的 innerVoice；
      JSON 会原样保留 innerVoice，供导入后恢复对应轮数心声。
   ========================================================================== */
export function exportCurrentChatMessages(state, format) {
  const payload = buildCurrentChatExportPayload(state);
  const safeName = String(payload.chatName || '聊天记录').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '聊天记录';
  const stamp = formatExportDateForFileName(payload.exportedAt);

  if (format === 'html') {
    downloadTextFile(`${safeName}-${stamp}.html`, buildCurrentChatHtmlExport(payload), 'text/html;charset=utf-8');
    return payload.messages.length;
  }

  if (format === 'txt') {
    downloadTextFile(`${safeName}-${stamp}.txt`, buildCurrentChatTxtExport(payload), 'text/plain;charset=utf-8');
    return payload.messages.length;
  }

  if (format === 'json') {
    downloadTextFile(`${safeName}-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    return payload.messages.length;
  }

  throw new Error('不支持的导出格式。');
}

/* ==========================================================================
   [区域标注·已完成·聊天记录 JSON 导入解析与校验]
   说明：
   1. 只接受本模块导出的 single-contact-chat-messages JSON。
   2. 必须匹配当前联系人/角色 ID，防止导入到其它联系人窗口。
   3. 返回完整 messages 数组，不做长文本字段过滤。
   4. [已完成·心声导出导入] messages 内每条消息的 innerVoice 字段会原样返回，
      由 index.js 写回当前会话消息后恢复对应轮数心声。
   ========================================================================== */
export async function readAndValidateChatImportJsonFile(file, state) {
  if (!file) throw new Error('请选择 JSON 文件。');
  const fileName = String(file.name || '').toLowerCase();
  if (!fileName.endsWith('.json') && !/application\/json/i.test(String(file.type || ''))) {
    throw new Error('导入聊天记录仅支持 JSON 文件。');
  }

  let payload = null;
  try {
    payload = JSON.parse(await file.text());
  } catch (_) {
    throw new Error('JSON 文件解析失败，请选择从聊天设置页导出的 JSON 聊天记录。');
  }

  if (!payload || payload.app !== 'miniphone-chat' || payload.kind !== 'single-contact-chat-messages' || !Array.isArray(payload.messages)) {
    throw new Error('文件格式不正确，请选择从聊天设置页导出的 JSON 聊天记录。');
  }

  const currentRoleId = getCurrentChatExportRoleId(state);
  const importRoleId = String(payload.roleId || payload.session?.roleId || payload.chatId || '').trim();
  if (currentRoleId && importRoleId && currentRoleId !== importRoleId) {
    throw new Error('该 JSON 不属于当前聊天联系人，已取消导入。');
  }

  return cloneJsonSafe(payload.messages);
}
