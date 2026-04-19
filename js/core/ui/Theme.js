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
   *   desktopWallpaper?: string,
   *   desktopWallpaperCrop?: { x?: number, y?: number, scale?: number },
   *   lockscreenWallpaper?: string,
   *   themeColor?: string,
   *   iconSize?: number,
   *   iconImage?: string,
   *   iconRadius?: number,
   *   iconShadowStyle?: string,
   *   iconShadowSize?: number,
   *   iconBorderWidth?: number,
   *   iconBorderColor?: string
   * }} appearance
   */
  apply(appearance = {}) {
    const {
      wallpaper = '',
      desktopWallpaper = '',
      desktopWallpaperCrop = {},
      lockscreenWallpaper = '',
      themeColor = '#4f46e5',
      iconSize = 56,
      iconImage = '',
      iconRadius = 18,
      iconShadowStyle = 'none',
      iconShadowSize = 18,
      iconBorderWidth = 0,
      iconBorderColor = '#d7c9b8'
    } = appearance;

    const resolvedDesktopWallpaper = desktopWallpaper || wallpaper || '';
    const resolvedLockscreenWallpaper = lockscreenWallpaper || resolvedDesktopWallpaper || '';
    const normalizedWallpaperCrop = {
      x: Number.isFinite(Number(desktopWallpaperCrop?.x)) ? Math.max(0, Math.min(100, Number(desktopWallpaperCrop.x))) : 50,
      y: Number.isFinite(Number(desktopWallpaperCrop?.y)) ? Math.max(0, Math.min(100, Number(desktopWallpaperCrop.y))) : 50,
      scale: Number.isFinite(Number(desktopWallpaperCrop?.scale)) ? Math.max(1, Math.min(2.5, Number(desktopWallpaperCrop.scale))) : 1
    };
    const wallpaperSize = `${Math.max(100, normalizedWallpaperCrop.scale * 100)}% auto`;
    const wallpaperPosition = `${normalizedWallpaperCrop.x}% ${normalizedWallpaperCrop.y}%`;
    const normalizedShadowSize = Math.max(0, Number(iconShadowSize) || 0);
    const normalizedRadius = Math.max(0, Number(iconRadius) || 0);
    const normalizedBorderWidth = Math.max(0, Number(iconBorderWidth) || 0);

    let iconShadow = 'none';
    if (iconShadowStyle === 'inner') {
      iconShadow = `inset 0 0 ${Math.max(6, normalizedShadowSize)}px rgba(74, 52, 42, 0.18)`;
    } else if (iconShadowStyle === 'long') {
      iconShadow = `${Math.max(6, normalizedShadowSize / 2)}px ${Math.max(6, normalizedShadowSize / 2)}px 0 rgba(74, 52, 42, 0.18)`;
    } else if (iconShadowStyle === 'multi') {
      iconShadow = `0 ${Math.max(4, normalizedShadowSize * 0.35)}px ${Math.max(10, normalizedShadowSize)}px rgba(74, 52, 42, 0.18), 0 1px 2px rgba(74, 52, 42, 0.1)`;
    } else if (iconShadowStyle === 'neumorphism') {
      iconShadow = `${Math.max(4, normalizedShadowSize * 0.4)}px ${Math.max(4, normalizedShadowSize * 0.4)}px ${Math.max(10, normalizedShadowSize)}px rgba(181, 156, 132, 0.28), -${Math.max(4, normalizedShadowSize * 0.3)}px -${Math.max(4, normalizedShadowSize * 0.3)}px ${Math.max(8, normalizedShadowSize * 0.75)}px rgba(255, 255, 255, 0.82)`;
    } else if (iconShadowStyle === 'outer') {
      iconShadow = `0 ${Math.max(4, normalizedShadowSize * 0.35)}px ${Math.max(8, normalizedShadowSize)}px rgba(74, 52, 42, 0.18)`;
    }

    this.root.style.setProperty('--theme-color', themeColor);
    this.root.style.setProperty('--icon-size', `${iconSize}px`);
    this.root.style.setProperty('--app-icon-radius', `${normalizedRadius}px`);
    this.root.style.setProperty('--app-icon-shadow', iconShadow);
    this.root.style.setProperty('--app-icon-border-width', `${normalizedBorderWidth}px`);
    this.root.style.setProperty('--app-icon-border-color', iconBorderColor || '#d7c9b8');
    this.root.style.setProperty('--app-icon-custom-image', iconImage ? `url("${iconImage}")` : 'none');

    // [模块标注] 桌面壁纸裁切参数应用模块：统一输出桌面壁纸的 URL、缩放与取景参数，供桌面与全屏顶区共同使用
    if (resolvedDesktopWallpaper) {
      this.root.style.setProperty('--wallpaper', resolvedDesktopWallpaper);
      this.root.style.setProperty('--desktop-wallpaper', `url("${resolvedDesktopWallpaper}")`);
      this.root.style.setProperty('--desktop-wallpaper-size', wallpaperSize);
      this.root.style.setProperty('--desktop-wallpaper-position', wallpaperPosition);
    } else {
      this.root.style.removeProperty('--wallpaper');
      this.root.style.setProperty('--desktop-wallpaper', 'none');
      this.root.style.setProperty('--desktop-wallpaper-size', 'cover');
      this.root.style.setProperty('--desktop-wallpaper-position', 'center');
    }

    if (resolvedLockscreenWallpaper) {
      this.root.style.setProperty('--lockscreen-wallpaper', `url("${resolvedLockscreenWallpaper}")`);
    } else {
      this.root.style.setProperty('--lockscreen-wallpaper', 'none');
    }

    // [模块标注] 桌面壁纸全屏铺满同步模块：确保 screen 层与全屏顶部状态栏区域共享同一套壁纸裁切参数
    const screen = document.querySelector('.screen');
    if (screen) {
      if (resolvedDesktopWallpaper) {
        screen.style.backgroundImage = `url("${resolvedDesktopWallpaper}")`;
        screen.style.backgroundSize = wallpaperSize;
        screen.style.backgroundPosition = wallpaperPosition;
      } else {
        screen.style.backgroundImage = '';
        screen.style.backgroundSize = '';
        screen.style.backgroundPosition = '';
      }
    }

    if (document.body) {
      document.body.dataset.iconShadowStyle = iconShadowStyle || 'none';
      document.body.classList.toggle('has-global-icon-image', !!iconImage);
    }
  }
}
