/**
 * 文件名: js/core/ui/components/Button.js
 * 用途: 通用按钮组件工厂。
 *       用于在各应用中快速创建统一风格按钮，避免重复拼接 HTML。
 * 位置: /js/core/ui/components/Button.js
 * 架构层: 外观层（UI Layer / components）
 */
export function createButton({
  text = '按钮',
  type = 'button',
  className = 'ui-button',
  onClick = null
} = {}) {
  const btn = document.createElement('button');
  btn.type = type;
  btn.className = className;
  btn.textContent = text;

  if (typeof onClick === 'function') {
    btn.addEventListener('click', onClick);
  }

  return btn;
}
