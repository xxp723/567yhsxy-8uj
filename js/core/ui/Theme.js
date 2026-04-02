/**
 * 文件名: js/core/ui/Theme.js
 * 用途: 主题管理器。
 *       通过设置 CSS 变量控制壁纸、主题色、图标尺寸等外观参数。
 *       仅处理视觉层，不涉及业务逻辑。
 * 位置: /js/core/ui/Theme.js
 * 架构层: 外观层（UI Layer）
 */
export class Theme {
  constructor(root = document.documentElement) {
    this.root = root;
  }

  /**
   * 应用外观设置
   * @param {{
   *   wallpaper?: string,
   *   themeColor?: string,
   *   iconSize?: number
   * }} appearance
   */
  apply(appearance = {}) {
    const {
      wallpaper = '',
      themeColor = '#4f46e5',
      iconSize = 56
    } = appearance;

    this.root.style.setProperty('--theme-color', themeColor);
    this.root.style.setProperty('--icon-size', `${iconSize}px`);

    if (wallpaper) {
      this.root.style.setProperty('--wallpaper', wallpaper);
    }
  }
}
