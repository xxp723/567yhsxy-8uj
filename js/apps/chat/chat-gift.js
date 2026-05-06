// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-gift.js
 * 用途: 闲谈应用 — 咖啡功能区“礼物”独立模块
 *       负责礼物入口、礼物弹窗、礼物消息卡片渲染、直接购买入列与代付请求卡片消息构建。
 * 存储规则：所有持久化只通过 DB.js / IndexedDB 封装完成，禁止 localStorage/sessionStorage。
 */

import {
  DATA_KEY_SESSIONS,
  DATA_KEY_MESSAGES_PREFIX,
  TAB_ICONS,
  dbPut,
  escapeHtml,
  normalizeWalletData,
  persistWalletData
} from './chat-utils.js';

/* ==========================================================================
   [区域标注·已完成·礼物模块 IconPark 图标]
   说明：本模块新增按键图标统一使用 IconPark 风格 SVG，便于后续单独替换礼物图标。
   ========================================================================== */
export const GIFT_ICONS = {
  gift: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 20h32v22H8V20Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M6 12h36v8H6v-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 12v30" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 12c-2-5-7-8-11-6c-4 2-3 8 2 8h9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M24 12c2-5 7-8 11-6c4 2 3 8-2 8h-9Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  wallet: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 14h36v28H6V14Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 14V8h26v6" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 28h10v8H32a4 4 0 0 1 0-8Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 5l4.5 12.5L41 22l-12.5 4.5L24 39l-4.5-12.5L7 22l12.5-4.5L24 5Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M39 34l1.5 4l4 1.5l-4 1.5l-1.5 4l-1.5-4l-4-1.5l4-1.5l1.5-4Z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>`
};

/* ==========================================================================
   [区域标注·已完成·礼物功能区入口]
   说明：替换原咖啡功能区“动作”占位板块；本 HTML 由 chat-message.js 引用渲染。
   ========================================================================== */
export function renderGiftFeatureButton() {
  return `
    <button class="msg-feature-dock__item msg-feature-dock__item--gift" type="button" data-action="open-msg-gift-modal" data-feature="gift">
      ${GIFT_ICONS.gift}<span>礼物</span>
    </button>
  `;
}

/* ==========================================================================
   [区域标注·已完成·礼物消息识别与摘要]
   说明：
   1. 礼物消息 type=gift，随 currentMessages 写入 DB.js / IndexedDB。
   2. 本区域已支持用户手动送礼与 AI 主动送礼两类消息摘要，后续只改礼物摘要优先定位这里。
   ========================================================================== */
export function isGiftMessage(message = {}) {
  return String(message?.type || '') === 'gift';
}

export function getGiftMessageDisplayText(message = {}) {
  const title = String(message?.giftTitle || message?.content || '礼物').trim();
  const price = String(message?.giftDisplayPrice || '').trim();
  return `[礼物] ${title}${price ? ` · ${price}` : ''}`;
}

/* ==========================================================================
   [区域标注·已完成·AI主动送礼物协议解析]
   说明：
   1. 解析 AI 通用消息协议 **`[礼物] 角色名：{名称:xxx,备注:xxx}`**。
   2. 仅把协议转成当前消息对象；真正持久化仍由 chat-message.js 写入 DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不保留双份存储兜底，不按长文本字段过滤。
   ========================================================================== */
function cleanAiGiftProtocolValue(value = '') {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
}

export function parseAiGiftProtocolPayload(content = {}) {
  const normalized = cleanAiGiftProtocolValue(content);
  if (!normalized) return null;

  const bodyMatch = normalized.match(/\{\s*([\s\S]*?)\s*\}/);
  const body = bodyMatch ? String(bodyMatch[1] || '').trim() : normalized;
  if (!body) return null;

  const titleMatch = body.match(/(?:名称|礼物名|商品名称|标题)\s*[：:]\s*([^,，;；}\n]+)/i);
  const noteMatch = body.match(/备注\s*[：:]\s*([^}]+)/i);
  const fallbackTitle = body
    .replace(/备注\s*[：:]\s*[^,，;；}]*/gi, '')
    .replace(/(?:名称|礼物名|商品名称|标题)\s*[：:]/i, '')
    .split(/[，,；;]/)[0]
    .trim();

  const giftTitle = cleanAiGiftProtocolValue(titleMatch?.[1] || fallbackTitle || '一份小礼物');
  const giftNote = cleanAiGiftProtocolValue(noteMatch?.[1] || '给你的一点小心意');

  if (!giftTitle) return null;

  return {
    giftTitle,
    giftNote: giftNote || '给你的一点小心意'
  };
}

export function createAiGiftMessageFromProtocol(block = {}) {
  const payload = parseAiGiftProtocolPayload(block?.content || '');
  if (!payload) return null;

  const roleName = String(block?.roleName || '').trim() || '对方';
  return {
    role: 'assistant',
    type: 'gift',
    content: `[礼物] ${payload.giftTitle}`,
    giftTitle: payload.giftTitle,
    giftNote: payload.giftNote,
    giftPayer: `${roleName}送给你`,
    giftSource: 'ai_protocol'
  };
}

/* ==========================================================================
   [区域标注·已完成·北欧 ins 风礼物消息卡片]
   说明：只负责礼物气泡内部 HTML，外层左右气泡仍沿用聊天消息页统一结构。
   ========================================================================== */
export function renderGiftBubble(message = {}) {
  const title = String(message?.giftTitle || '礼物').trim();
  const price = String(message?.giftDisplayPrice || '').trim();
  const note = String(message?.giftNote || '').trim() || 'A soft little present for you';
  const payer = String(message?.giftPayer || '').trim();

  return `
    <article class="msg-gift-card" title="${escapeHtml(title)}">
      <div class="msg-gift-card__topline">
        <span class="msg-gift-card__icon">${GIFT_ICONS.gift}</span>
        <span class="msg-gift-card__eyebrow">Nordic Gift</span>
      </div>
      <h3 class="msg-gift-card__title">${escapeHtml(title)}</h3>
      <div class="msg-gift-card__meta">
        <span class="msg-gift-card__price">${escapeHtml(price)}</span>
        ${payer ? `<span class="msg-gift-card__payer">${escapeHtml(payer)}</span>` : ''}
      </div>
      <p class="msg-gift-card__note">${escapeHtml(note)}</p>
    </article>
  `;
}

/* ==========================================================================
   [区域标注·已完成·礼物弹窗渲染]
   说明：
   1. 应用内弹窗，不使用浏览器原生弹窗/选择器。
   2. 展示用户面具身份当前钱包余额、商品名称输入框、价格输入框。
   3. 操作按钮为“请求代付”和“给对方买”。
   ========================================================================== */
export function showMessageGiftModal(container, options = {}) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  if (!mask || !panel) return;

  const balanceLabel = String(options.balanceLabel || '¥0.00').trim();
  const currencyCode = String(options.currencyCode || 'CNY').trim().toUpperCase();
  const maskName = String(options.maskName || '当前面具身份').trim();

  panel.innerHTML = `
    <!-- ======================================================================
         [区域标注·已完成·礼物弹窗]
         说明：北欧 ins 风排版；所有输入均为应用内表单，确认逻辑由 index.js 写入 IndexedDB。
         ====================================================================== -->
    <div class="chat-modal-header msg-gift-modal__header">
      <span>送一份礼物</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body msg-gift-modal">
      <section class="msg-gift-modal__balance-card">
        <span class="msg-gift-modal__balance-icon">${GIFT_ICONS.wallet}</span>
        <div>
          <em>${escapeHtml(maskName)}的钱包余额</em>
          <strong>${escapeHtml(balanceLabel)}</strong>
          <small>${escapeHtml(currencyCode)}</small>
        </div>
      </section>

      <label class="msg-gift-modal__field">
        <span>商品名称</span>
        <input class="chat-modal-search msg-gift-modal__input" data-role="msg-gift-title-input" type="text" placeholder="例如：一束白郁金香">
      </label>

      <label class="msg-gift-modal__field">
        <span>价格</span>
        <input class="chat-modal-search msg-gift-modal__input" data-role="msg-gift-price-input" type="number" min="0.01" step="0.01" placeholder="输入不超过余额的金额">
      </label>

      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer msg-gift-modal__footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="request-msg-gift-pay" type="button">请求代付</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-msg-gift-buy" type="button">给对方买</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="msg-gift-title-input"]')?.focus(), 30);
}

/* ==========================================================================
   [区域标注·已完成·礼物金额解析]
   说明：按当前钱包显示币种解释输入价格，再换算为基础人民币余额扣减。
   ========================================================================== */
export function parseGiftDraftFromModal(container, walletDisplay = {}, walletData = {}) {
  const titleInput = container.querySelector('[data-role="msg-gift-title-input"]');
  const priceInput = container.querySelector('[data-role="msg-gift-price-input"]');
  const giftTitle = String(titleInput?.value || '').trim();
  const giftPrice = Number(String(priceInput?.value || '').trim());

  const currency = walletDisplay.currency || { code: 'CNY', precision: 2 };
  const currencyCode = String(currency.code || 'CNY').toUpperCase();
  const precision = Math.max(0, Number(currency.precision ?? 2) || 0);
  const rates = walletData?.rates && typeof walletData.rates === 'object' ? walletData.rates : {};
  const displayRate = currencyCode === 'CNY' ? 1 : Math.max(0, Number(rates[currencyCode] || 0) || 0);
  const giftBaseCny = currencyCode === 'CNY' ? giftPrice : (giftPrice / displayRate);

  return {
    giftTitle,
    giftPrice,
    giftBaseCny,
    currencyCode,
    precision,
    displayRate
  };
}

/* ==========================================================================
   [区域标注·已完成·直接购买礼物消息入列]
   说明：
   1. “给对方买”会扣减当前面具钱包余额并生成 type=gift 用户消息。
   2. 钱包、当前聊天消息、会话摘要统一写入 DB.js / IndexedDB。
   ========================================================================== */
export async function sendGiftMessage(container, state, db, draft = {}, helpers = {}) {
  if (!state.currentChatId) return false;
  const session = state.sessions.find(item => String(item.id) === String(state.currentChatId));
  if (!session) return false;

  const now = Date.now();
  const giftTitle = String(draft.giftTitle || '').trim();
  const giftPrice = Number(draft.giftPrice || 0);
  const giftBaseCny = Number(draft.giftBaseCny || 0);
  const currencyCode = String(draft.currencyCode || 'CNY').toUpperCase();
  const precision = Math.max(0, Number(draft.precision ?? 2) || 0);
  const formatWalletMoney = typeof helpers.formatWalletMoney === 'function'
    ? helpers.formatWalletMoney
    : ((value, code) => `${code} ${Number(value || 0).toFixed(precision)}`);

  const giftDisplayPrice = formatWalletMoney(giftPrice, currencyCode);
  const nextBalanceBaseCny = Math.max(0, Number(state.walletData?.balanceBaseCny || 0) - giftBaseCny);

  state.walletData = normalizeWalletData({
    ...state.walletData,
    balanceBaseCny: nextBalanceBaseCny,
    ledger: [
      {
        id: `wallet_ledger_${now}_${Math.random().toString(16).slice(2)}`,
        kind: 'gift',
        direction: 'out',
        title: `给 ${String(session.name || '对方').trim() || '对方'} 买礼物：${giftTitle}`,
        amountBaseCny: Number(giftBaseCny.toFixed(2)),
        timestamp: now
      },
      ...(Array.isArray(state.walletData?.ledger) ? state.walletData.ledger : [])
    ],
    updatedAt: now
  });

  const giftMessage = {
    id: `user_gift_${now}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'gift',
    content: `[礼物] ${giftTitle}`,
    giftTitle,
    giftDisplayPrice,
    giftCurrency: currencyCode,
    giftPrice: Number(giftPrice.toFixed(precision)),
    giftBaseCny: Number(giftBaseCny.toFixed(2)),
    giftNote: 'for you, with a little everyday tenderness',
    giftPayer: '我已购买',
    timestamp: now
  };

  state.currentMessages.push(giftMessage);
  state.coffeeDockOpen = false;
  state.stickerPanelOpen = false;
  session.lastMessage = getGiftMessageDisplayText(giftMessage);
  session.lastTime = now;

  await Promise.all([
    persistWalletData(state, db),
    dbPut(db, DATA_KEY_MESSAGES_PREFIX(state.activeMaskId) + state.currentChatId, state.currentMessages),
    dbPut(db, DATA_KEY_SESSIONS(state.activeMaskId), state.sessions)
  ]);

  return true;
}

/* ==========================================================================
   [区域标注·已完成·礼物代付请求卡片化]
   说明：
   1. “请求代付”不再以普通裸文本用户消息入列，而是生成 type=gift 的礼物卡片消息。
   2. 卡片消息仍保留完整 AI 可见请求文案，供“用户最新一轮消息”发送给 AI。
   3. 历史上下文摘要化由 chat-message.js 统一处理；本区域只负责礼物代付请求消息对象构造。
   ========================================================================== */
export function buildGiftPayRequestText(draft = {}) {
  const title = String(draft.giftTitle || '').trim();
  const priceLabel = String(draft.giftDisplayPrice || '').trim();
  return `【礼物代付请求】我想买「${title}」，价格是 ${priceLabel}。请你根据你的人设、我们之前的对话历史和当前关系，自行决定是否愿意帮我代付；你可以答应，也可以自然地拒绝。`;
}

export function createGiftPayRequestMessage(draft = {}) {
  const now = Date.now();
  const giftTitle = String(draft.giftTitle || '').trim() || '礼物';
  const giftDisplayPrice = String(draft.giftDisplayPrice || '').trim();
  const aiPromptText = buildGiftPayRequestText({
    ...draft,
    giftTitle,
    giftDisplayPrice
  });

  return {
    id: `user_gift_pay_${now}_${Math.random().toString(16).slice(2)}`,
    role: 'user',
    type: 'gift',
    content: aiPromptText,
    giftTitle,
    giftDisplayPrice,
    giftCurrency: String(draft.currencyCode || 'CNY').toUpperCase(),
    giftPrice: Number(draft.giftPrice || 0),
    giftBaseCny: Number(draft.giftBaseCny || 0),
    giftNote: '请根据我们的关系决定是否愿意帮我代付',
    giftPayer: '请求你代付',
    giftRequestType: 'pay_request',
    giftAiPromptText: aiPromptText,
    timestamp: now
  };
}
