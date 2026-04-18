/**
 * 文件名: js/core/ui/components/Icon.js
 * 用途: 通用图标组件（桌面图标渲染辅助）。
 *       负责根据 app 元数据创建统一结构的图标 DOM，供 Desktop.js 复用。
 * 位置: /js/core/ui/components/Icon.js
 * 架构层: 外观层（UI Layer / components）
 */
export function createAppIcon(appMeta) {
  const wrapper = document.createElement('div');
  wrapper.className = 'app-icon';
  wrapper.draggable = true;
  wrapper.dataset.appId = appMeta.id;
  wrapper.title = appMeta.name;

  // [模块标注] 应用图标统一渲染结构模块：桌面 / Dock 图标统一输出字形层与自定义图片层，确保自定义图片可完整覆盖图标区域
  const customImg = localStorage.getItem(`miniphone_app_icon_${appMeta.id}`) || '';
  const button = document.createElement('button');
  button.className = customImg ? 'app-icon-btn has-img' : 'app-icon-btn';
  button.type = 'button';
  button.setAttribute('data-open-app', appMeta.id);
  button.setAttribute('aria-label', `打开${appMeta.name}`);
  button.innerHTML = `
    <span class="app-icon-glyph">${appMeta.icon || ''}</span>
    <img class="app-custom-img" src="${customImg}" style="${customImg ? '' : 'display:none;'}" alt="${appMeta.name}" />
  `;

  const label = document.createElement('span');
  label.className = 'app-icon-label';
  label.textContent = appMeta.name;

  wrapper.appendChild(button);
  wrapper.appendChild(label);

  return wrapper;
}
