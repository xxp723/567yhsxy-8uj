// @ts-nocheck
/**
 * 文件名: js/apps/chat/profile-wallet.js
 * 用途: 闲谈应用 — 用户主页钱包子模块。
 *       负责钱包独立页渲染、金额格式化、充值弹窗、币种切换弹窗。
 * 架构层: 应用层（闲谈子模块）
 */

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·钱包模块]
   说明：
   1. 本文件由 profile.js 拆分而来，profile.js 继续作为对外接线层导出原接口。
   2. 钱包数据仍来自 state.walletData，并由事件处理层通过 DB.js / IndexedDB 持久化。
   3. 本模块不使用浏览器本地同步存储接口，不写双份存储兜底。
   4. 弹窗继续使用闲谈应用内 chat-modal 样式，不使用浏览器原生弹窗。
   ========================================================================== */
import {
  TAB_ICONS,
  escapeHtml
} from './chat-utils.js';
import { PROFILE_ICONS as ICONS } from './profile-icons.js';

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·钱包展示工具]
   说明：
   1. 钱包基础余额统一按人民币 CNY 存储，页面按当前 displayCurrency 实时换算显示。
   2. 这里只负责渲染与格式化，不直接做持久化写入。
   3. 从 profile.js 迁移到本文件，方便后续单独维护钱包功能。
   ========================================================================== */
export function getWalletCurrencyMeta(currencyCode) {
  const code = String(currencyCode || 'CNY').toUpperCase();
  const map = {
    CNY: { code: 'CNY', label: '人民币', symbol: '¥', precision: 2 },
    USD: { code: 'USD', label: '美元', symbol: '$', precision: 2 },
    JPY: { code: 'JPY', label: '日元', symbol: '¥', precision: 0 },
    KRW: { code: 'KRW', label: '韩元', symbol: '₩', precision: 0 },
    EUR: { code: 'EUR', label: '欧元', symbol: '€', precision: 2 }
  };
  return map[code] || map.CNY;
}

export function getWalletDisplayAmount(walletData) {
  const data = walletData && typeof walletData === 'object' ? walletData : {};
  const currency = getWalletCurrencyMeta(data.displayCurrency || 'CNY');
  const rates = data.rates && typeof data.rates === 'object' ? data.rates : {};
  const base = Math.max(0, Number(data.balanceBaseCny || 0) || 0);
  const rate = currency.code === 'CNY' ? 1 : Math.max(0, Number(rates[currency.code] || 0) || 0);
  return {
    currency,
    value: base * rate
  };
}

export function formatWalletMoney(value, currencyCode) {
  const currency = getWalletCurrencyMeta(currencyCode);
  const amount = Math.max(0, Number(value || 0) || 0);
  return `${currency.symbol}${amount.toFixed(currency.precision)}`;
}

export function renderWalletSubPage(state) {
  const walletData = state.walletData || {};
  const { currency, value } = getWalletDisplayAmount(walletData);

  /* ==========================================================================
     [区域标注·已完成·本次钱包流水需求] 钱包实时流水展示数据
     说明：
     1. 钱包流水来自 walletData.ledger（已由 chat-utils.js 规范化）。
     2. 以当前显示币种实时换算显示金额，支出为负，收入为正。
     3. 仅展示最近 30 条，避免页面过长。
     ========================================================================== */
  const rates = walletData.rates && typeof walletData.rates === 'object' ? walletData.rates : {};
  const displayRate = currency.code === 'CNY' ? 1 : Math.max(0, Number(rates[currency.code] || 0) || 0);
  const safeDisplayRate = displayRate > 0 ? displayRate : 1;
  const ledgerItems = (Array.isArray(walletData.ledger) ? walletData.ledger : [])
    .slice(0, 30)
    .map(item => {
      const direction = String(item?.direction || '').trim() === 'out' ? 'out' : 'in';
      const baseAmount = Math.max(0, Number(item?.amountBaseCny || 0) || 0);
      const displayAmount = baseAmount * safeDisplayRate;
      const sign = direction === 'out' ? '-' : '+';
      return {
        id: String(item?.id || ''),
        title: String(item?.title || (direction === 'out' ? '支出' : '收入')),
        direction,
        amountText: `${sign}${formatWalletMoney(displayAmount, currency.code)}`,
        timeText: new Date(Number(item?.timestamp || Date.now())).toLocaleString()
      };
    });

  return `
    <div class="chat-sub-page wallet-sub-page">
      <div class="chat-sub-page__header chat-sub-page__header--center">
        <button class="chat-sub-page__title chat-sub-page__title--button chat-sub-page__title--center" data-action="go-profile" type="button">钱包</button>
      </div>
      <div class="chat-sub-page__body wallet-sub-page__body">
        <section class="wallet-balance-card">
          <div class="wallet-balance-card__icon">${ICONS.walletCard}</div>
          <div class="wallet-balance-card__content">
            <span class="wallet-balance-card__label">钱包余额</span>
            <strong class="wallet-balance-card__amount">${escapeHtml(formatWalletMoney(value, currency.code))}</strong>
            <span class="wallet-balance-card__currency">${escapeHtml(currency.label)} · ${escapeHtml(currency.code)}</span>
          </div>
        </section>

        <button class="wallet-primary-btn" data-action="open-wallet-recharge-modal" type="button">
          <span class="wallet-primary-btn__icon">${ICONS.recharge}</span>
          <span>充值</span>
        </button>

        <section class="wallet-rate-card">
          <div class="wallet-rate-card__head">
            <div class="wallet-rate-card__title-wrap">
              <span class="wallet-rate-card__icon">${ICONS.exchange}</span>
              <div>
                <strong class="wallet-rate-card__title">实时汇率</strong>
                <p class="wallet-rate-card__desc">当前钱包金额以 ${escapeHtml(currency.label)} 显示，可切换美元 / 日元 / 韩元 / 欧元。</p>
              </div>
            </div>
            <button class="wallet-rate-card__action" data-action="open-wallet-currency-modal" type="button">切换并保存</button>
          </div>
        </section>

        <!-- ==========================================================================
             [区域标注·已完成·本次钱包流水需求] 钱包实时流水板块（位于实时汇率下方）
             说明：
             1. 实时展示钱包发出与收到的资金流水。
             2. 已移除实时汇率卡片中重复的五行换算陈列。
             ========================================================================== -->
        <section class="wallet-ledger-card">
          <div class="wallet-ledger-card__head">
            <div class="wallet-rate-card__title-wrap">
              <span class="wallet-rate-card__icon">${ICONS.ledger}</span>
              <div>
                <strong class="wallet-rate-card__title">钱包实时流水</strong>
                <p class="wallet-rate-card__desc">按当前显示币种 ${escapeHtml(currency.code)} 实时换算展示最近收支记录。</p>
              </div>
            </div>
          </div>
          <div class="wallet-ledger-card__list">
            ${ledgerItems.length ? ledgerItems.map(item => `
              <div class="wallet-ledger-item">
                <div class="wallet-ledger-item__main">
                  <span class="wallet-ledger-item__title">${escapeHtml(item.title)}</span>
                  <strong class="wallet-ledger-item__amount ${item.direction === 'out' ? 'is-out' : 'is-in'}">${escapeHtml(item.amountText)}</strong>
                </div>
                <span class="wallet-ledger-item__time">${escapeHtml(item.timeText)}</span>
              </div>
            `).join('') : `
              <div class="wallet-ledger-empty">暂无流水记录</div>
            `}
          </div>
        </section>
      </div>
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·钱包充值弹窗]
   说明：
   1. 不使用原生浏览器弹窗。
   2. 与闲谈应用现有 chat-modal 视觉风格保持统一。
   3. 只负责展示和输入收集，确认后的持久化仍由事件处理层接入 DB.js / IndexedDB。
   ========================================================================== */
export function showWalletRechargeModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const { currency } = getWalletDisplayAmount(state.walletData || {});
  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·闲谈大文件拆分·钱包充值弹窗] -->
    <div class="chat-modal-header">
      <span>钱包充值</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">请输入要充值的人民币金额。充值后会自动按当前显示币种 ${escapeHtml(currency.code)} 实时换算展示。</div>
      <input class="chat-modal-search" data-role="wallet-recharge-input" type="number" min="0.01" step="0.01" placeholder="输入充值金额（RMB）">
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-wallet-recharge" type="button">确认充值</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
  setTimeout(() => panel.querySelector('[data-role="wallet-recharge-input"]')?.focus(), 30);
}

/* ==========================================================================
   [区域标注·已完成·闲谈大文件拆分·钱包汇率切换弹窗]
   说明：
   1. 用户可选择钱包显示币种。
   2. 弹窗内实时展示当前钱包余额换算预览，保存后更新钱包货币单位标识。
   3. 弹窗只负责 UI 展示，保存与持久化仍由原事件处理流程完成。
   ========================================================================== */
export function showWalletCurrencyModal(container, state) {
  const mask = container.querySelector('[data-role="modal-mask"]');
  const panel = container.querySelector('[data-role="modal-panel"]');
  const walletData = state.walletData || {};
  const currentCode = String(state.walletDraftCurrency || walletData.displayCurrency || 'CNY').toUpperCase();
  const options = ['CNY', 'USD', 'JPY', 'KRW', 'EUR'];
  const baseAmount = Math.max(0, Number(walletData.balanceBaseCny || 0) || 0);
  const previewMeta = getWalletCurrencyMeta(currentCode);
  const previewRate = currentCode === 'CNY' ? 1 : Math.max(0, Number(walletData?.rates?.[currentCode] || 0) || 0);
  const previewAmount = baseAmount * previewRate;

  if (!mask || !panel) return;

  panel.innerHTML = `
    <!-- [区域标注·已完成·闲谈大文件拆分·钱包汇率切换弹窗] -->
    <div class="chat-modal-header">
      <span>切换显示币种</span>
      <button class="chat-modal-close" data-action="close-modal" type="button">${TAB_ICONS.close}</button>
    </div>
    <div class="chat-modal-body">
      <div class="chat-modal-hint">选择钱包余额的显示币种，保存后钱包页面的金额单位会立即更新。</div>
      <div class="wallet-currency-option-list">
        ${options.map(code => {
          const meta = getWalletCurrencyMeta(code);
          const rate = code === 'CNY' ? 1 : Math.max(0, Number(walletData?.rates?.[code] || 0) || 0);
          return `
            <button class="wallet-currency-option ${currentCode === code ? 'is-active' : ''}"
                    data-action="select-wallet-currency"
                    data-wallet-currency="${escapeHtml(code)}"
                    type="button">
              <span class="wallet-currency-option__name">${escapeHtml(meta.label)} · ${escapeHtml(code)}</span>
              <strong class="wallet-currency-option__rate">1 CNY ≈ ${escapeHtml(String(rate))} ${escapeHtml(code)}</strong>
            </button>
          `;
        }).join('')}
      </div>
      <div class="wallet-currency-preview">
        <span class="wallet-currency-preview__label">换算预览</span>
        <strong class="wallet-currency-preview__amount">${escapeHtml(formatWalletMoney(previewAmount, previewMeta.code))}</strong>
      </div>
      <div class="chat-modal-notice" data-role="modal-notice"></div>
    </div>
    <div class="chat-modal-footer">
      <button class="chat-modal-btn chat-modal-btn--secondary" data-action="close-modal" type="button">取消</button>
      <button class="chat-modal-btn chat-modal-btn--primary" data-action="confirm-wallet-currency" type="button">保存</button>
    </div>
  `;

  mask.classList.remove('is-hidden');
}
