/**
 * 文件名: js/apps/memory/memory-editor.js
 * 用途: 旧事应用记忆新增、编辑、删除确认弹窗。
 * 说明:
 * 1. 弹窗全部为应用内 DOM，不使用 alert/confirm/prompt。
 * 2. 不使用浏览器原生选择器；类型选择与开关均为自绘按钮。
 */
import {
  MEMORY_ICONS,
  MEMORY_TYPE_META,
  escapeHtml,
  formatDateTime,
  getMemoryTypeMeta,
  normalizeText,
  parseDateText,
  parseTagInput,
  renderDateTimePickerButton,
  renderIconButton
} from './memory-ui.js';

/* ==========================================================================
   [区域标注·已完成·旧事编辑表单数据区]
   说明：
   1. 新增/编辑表单提交后统一从这里解析为记忆条目结构。
   2. 本区已完成“去事件标题 + 单注入开关 + 重点长期固定注入”口径更新。
   3. 用户侧不再暴露“永久记忆/高优先级”开关；重点长期内部仍复用 isPermanent 作为固定注入标记。
   ========================================================================== */
export function parseMemoryForm(form) {
  const data = new FormData(form);
  const type = normalizeText(data.get('type')) || 'longterm';
  const isPermanent = data.get('isPermanent') === 'true';

  return {
    id: normalizeText(data.get('id')),
    type,
    summary: normalizeText(data.get('summary')),
    timelineAt: parseDateText(data.get('timelineAt')) || Date.now(),
    emotionTags: parseTagInput(data.get('emotionTags')),
    injectionEnabled: (type === 'longterm' && isPermanent) || (type !== 'pending' && data.get('injectionEnabled') === 'true'),
    isPermanent,
    isHighPriority: isPermanent
  };
}

const MEMORY_FORM_TYPE_OPTIONS = [
  {
    key: 'longterm',
    type: 'longterm',
    isPermanent: false,
    label: '长期记忆',
    icon: MEMORY_TYPE_META.longterm.icon,
    desc: '普通长期记忆；开启“允许注入”后进入靠后的补充注入池。'
  },
  {
    key: 'longterm-focus',
    type: 'longterm',
    isPermanent: true,
    label: '重点长期',
    icon: MEMORY_ICONS.pin,
    desc: '长期记忆中的重点项；每次固定注入，注入位置最靠前。'
  },
  {
    key: 'pending',
    type: 'pending',
    isPermanent: false,
    label: '待确认',
    icon: MEMORY_TYPE_META.pending.icon,
    desc: '暂不进入自动注入，确认后再转为长期记忆。'
  }
];

function getFormTypeKey(item = {}) {
  if (item.type === 'pending') return 'pending';
  if (item.type === 'longterm' && item.isPermanent) return 'longterm-focus';
  return 'longterm';
}

export function renderTypeOptions(item = {}) {
  const activeKey = getFormTypeKey(item);
  return MEMORY_FORM_TYPE_OPTIONS.map((option) => `
    <button class="memory-type-option ${option.key === activeKey ? 'is-active' : ''}" type="button" data-action="choose-memory-type" data-type="${escapeHtml(option.type)}" data-permanent="${option.isPermanent ? 'true' : 'false'}" data-desc="${escapeHtml(option.desc)}">
      <span>${escapeHtml(option.label)}</span>
    </button>
  `).join('');
}

function renderFormToggle({ field, active, label, hint }) {
  return `
    <div class="memory-form-toggle-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(hint)}</span>
      </div>
      <button class="memory-form-toggle memory-ios-switch ${active ? 'is-on' : ''}" type="button" data-action="form-toggle" data-field="${escapeHtml(field)}" aria-pressed="${active ? 'true' : 'false'}">
        <span class="memory-ios-switch__track"><span class="memory-ios-switch__thumb"></span></span>
      </button>
      <input type="hidden" name="${escapeHtml(field)}" value="${active ? 'true' : 'false'}">
    </div>
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事应用内编辑弹窗区]
   说明：
   1. 新增/编辑闲谈记忆的弹窗已完成模块化，后续改表单只改本区。
   2. “发生时间”已改为应用内时间选择器，不允许手动输入，不使用浏览器原生选择器。
   3. 新增/编辑弹窗底部“取消”按钮已移除，关闭请使用右上角 IconPark 关闭按钮。
   4. 本区已去除事件标题输入；“记忆类型 + 开关”已精简为类型文字按钮 + 单个“允许注入”开关，类型按钮不再展示图标。
   ========================================================================== */
export function renderMemoryFormModal(state) {
  if (!state.modal || state.modal.kind !== 'form') return '';

  const item = state.modal.item || {};
  const isEdit = Boolean(item.id);
  const type = item.type || 'longterm';
  const timelineValue = normalizeText(state.modal.draftTimelineAt) || (item.timelineAt ? formatDateTime(item.timelineAt) : formatDateTime(Date.now()));

  return `
    <section class="memory-form-modal" role="dialog" aria-modal="true" aria-label="${isEdit ? '编辑记忆' : '新增记忆'}">
      <div class="memory-form-modal__panel">
        <div class="memory-form-modal__head">
          <h3>${escapeHtml(isEdit ? '编辑闲谈记忆' : '新增闲谈记忆')}</h3>
          ${renderIconButton({ action: 'close-modal', icon: MEMORY_ICONS.close, label: '关闭弹窗' })}
        </div>
        <form class="memory-form" data-memory-form="1">
          <input type="hidden" name="id" value="${escapeHtml(item.id || '')}">
          <input type="hidden" name="type" value="${escapeHtml(type)}">
          <input type="hidden" name="isPermanent" value="${item.isPermanent ? 'true' : 'false'}">
          <label class="memory-form-field">
            记忆摘要
            <textarea name="summary" placeholder="建议写成 100~200 字精炼摘要，保留事件经过、关系变化和关键情绪。">${escapeHtml(item.summary || '')}</textarea>
            <span class="memory-form-help">长期记忆建议 100~200 字；红线铁则可更短但要明确。</span>
          </label>
          <div class="memory-form-field">
            发生时间
            ${renderDateTimePickerButton({
              field: 'timelineAt',
              value: timelineValue,
              label: '时间选择器',
              includeTime: true
            })}
          </div>
          <label class="memory-form-field">
            情绪/关键词标签
            <input name="emotionTags" type="text" value="${escapeHtml((item.emotionTags || []).join('，'))}" placeholder="例如：焦虑，信任，承诺">
          </label>
          <div class="memory-form-field">
            记忆类型
            <div class="memory-type-options">
              ${renderTypeOptions(item)}
            </div>
            <span class="memory-form-help" data-type-desc>${escapeHtml(MEMORY_FORM_TYPE_OPTIONS.find((option) => option.key === getFormTypeKey(item))?.desc || getMemoryTypeMeta(type).desc)}</span>
          </div>
          <div class="memory-form-checks">
            ${renderFormToggle({
              field: 'injectionEnabled',
              active: (type === 'longterm' && item.isPermanent) || (item.injectionEnabled !== false && type !== 'pending'),
              label: '允许注入',
              hint: '普通长期记忆开启后进入靠后候选池；重点长期会固定靠前注入。'
            })}
          </div>
          <div class="memory-form-modal__foot">
            <button class="memory-primary-btn" type="submit">${MEMORY_ICONS.save}<span>保存</span></button>
          </div>
        </form>
      </div>
    </section>
  `;
}

/* ==========================================================================
   [区域标注·已完成·旧事应用内删除确认区]
   说明：删除确认已替换为主题内弹窗，不使用浏览器原生 confirm。
   ========================================================================== */
export function renderDeleteModal(state) {
  if (!state.modal || state.modal.kind !== 'delete') return '';

  return `
    <section class="memory-form-modal" role="dialog" aria-modal="true" aria-label="删除记忆确认">
      <div class="memory-form-modal__panel memory-form-modal__panel--compact">
        <div class="memory-form-modal__head">
          <h3>删除这条记忆？</h3>
          ${renderIconButton({ action: 'close-modal', icon: MEMORY_ICONS.close, label: '关闭弹窗' })}
        </div>
        <div class="memory-empty memory-delete-preview">
          <div class="memory-empty__icon">${MEMORY_ICONS.warning}</div>
          <h3>${escapeHtml(state.modal.item?.summary || '这条记忆')}</h3>
          <p>删除后会从该角色的闲谈记忆库中移除。本操作不会改动档案应用，也不会写入其它存储。</p>
        </div>
        <div class="memory-form-modal__foot">
          <button class="memory-secondary-btn" type="button" data-action="close-modal">取消</button>
          <button class="memory-primary-btn is-danger" type="button" data-action="confirm-delete" data-id="${escapeHtml(state.modal.item?.id || '')}">${MEMORY_ICONS.remove}<span>删除</span></button>
        </div>
      </div>
    </section>
  `;
}

export function applyTypeChoice(button) {
  const form = button.closest('form');
  if (!form) return;
  const typeInput = form.querySelector('input[name="type"]');
  const permanentInput = form.querySelector('input[name="isPermanent"]');
  const injectionInput = form.querySelector('input[name="injectionEnabled"]');
  const injectionButton = form.querySelector('[data-action="form-toggle"][data-field="injectionEnabled"]');
  const nextType = button.dataset.type || 'longterm';

  if (typeInput) typeInput.value = nextType;
  if (permanentInput) permanentInput.value = button.dataset.permanent === 'true' ? 'true' : 'false';
  if (nextType === 'longterm' && button.dataset.permanent === 'true' && injectionInput && injectionButton) {
    injectionInput.value = 'true';
    injectionButton.classList.add('is-on');
    injectionButton.setAttribute('aria-pressed', 'true');
  }
  if (nextType === 'pending' && injectionInput && injectionButton) {
    injectionInput.value = 'false';
    injectionButton.classList.remove('is-on');
    injectionButton.setAttribute('aria-pressed', 'false');
  }

  form.querySelectorAll('[data-action="choose-memory-type"]').forEach((item) => {
    item.classList.toggle('is-active', item === button);
  });
  const desc = form.querySelector('[data-type-desc]');
  if (desc) desc.textContent = button.dataset.desc || getMemoryTypeMeta(typeInput?.value).desc;
}

export function applyFormToggle(button) {
  const form = button.closest('form');
  const field = button.dataset.field;
  const input = form?.querySelector(`input[name="${field}"]`);
  if (!input) return;
  const permanentInput = form?.querySelector('input[name="isPermanent"]');
  const typeInput = form?.querySelector('input[name="type"]');
  if (field === 'injectionEnabled' && typeInput?.value === 'longterm' && permanentInput?.value === 'true') {
    input.value = 'true';
    button.classList.add('is-on');
    button.setAttribute('aria-pressed', 'true');
    return;
  }
  const active = input.value !== 'true';
  input.value = active ? 'true' : 'false';
  button.classList.toggle('is-on', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
}
