/**
 * 文件名: js/core/interaction/Gestures.js
 * 用途: 手势识别模块。
 *当前提供基础能力：
 *       - 长按桌面空白区域或图标进入编辑模式
 *       - 桌面左右滑动切屏（利用 scroll-snap，内部仅辅助事件广播）
 *       后续可扩展双击、双指缩放、边缘返回等手势。
 * 位置: /js/core/interaction/Gestures.js
 * 架构层: 交互层（Interaction Layer）
 */
export class Gestures {
  /**
   * @param {HTMLElement} desktopContainer
   * @param {import('./EventBus.js').EventBus} eventBus
   */
  constructor(desktopContainer, eventBus) {
    this.desktopContainer = desktopContainer;
    this.eventBus = eventBus;

    this.longPressTimer = null;
    this.longPressDelay = 500;
    this.startX = 0;
    this.startY = 0;
    this.lastPageIndex = 0;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onScroll = this.onScroll.bind(this);
  }

  bind() {
    if (!this.desktopContainer) return;

    this.desktopContainer.addEventListener('pointerdown', this.onPointerDown);
    this.desktopContainer.addEventListener('pointerup', this.onPointerUp);
    this.desktopContainer.addEventListener('pointercancel', this.onPointerUp);
    this.desktopContainer.addEventListener('pointermove', this.onPointerMove);
    this.desktopContainer.addEventListener('scroll', this.onScroll);

    // 也监听 dock 区域的长按
    const screen = this.desktopContainer.closest('.screen');
    if (screen) {
      const dock = screen.querySelector('.dock-container');
      if (dock) {
        this._dockDown = (e) => this.onPointerDown(e);
        this._dockUp = () => this.onPointerUp();
        this._dockMove = (e) => this.onPointerMove(e);
        dock.addEventListener('pointerdown', this._dockDown);
        dock.addEventListener('pointerup', this._dockUp);
        dock.addEventListener('pointercancel', this._dockUp);
        dock.addEventListener('pointermove', this._dockMove);
      }
    }
  }

  unbind() {
    if (!this.desktopContainer) return;

    this.desktopContainer.removeEventListener('pointerdown', this.onPointerDown);
    this.desktopContainer.removeEventListener('pointerup', this.onPointerUp);
    this.desktopContainer.removeEventListener('pointercancel', this.onPointerUp);
    this.desktopContainer.removeEventListener('pointermove', this.onPointerMove);
    this.desktopContainer.removeEventListener('scroll', this.onScroll);}

  onPointerDown(event) {
    this.startX = event.clientX;
    this.startY = event.clientY;

    //忽略弹窗、窗口等非桌面区域
    if (event.target.closest('.app-window-layer') || event.target.closest('.widget-picker-panel')) return;
    // 忽略编辑模式覆盖栏上的按钮
    if (event.target.closest('.desktop-edit-overlay')) return;

    const iconEl = event.target.closest('.app-icon');
    const widgetEl = event.target.closest('.desktop-widget-item');
    const isDesktopArea = event.target.closest('.desktop-page') || event.target.closest('.dock-container');

    // 只要在桌面区域内（包括空白区域、图标、组件）都可以触发长按
    if (!iconEl && !widgetEl && !isDesktopArea) return;

    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      if (iconEl) {
        const appId = iconEl.dataset.appId;
        this.eventBus.emit('desktop:edit-mode', { appId, trigger: 'long-press' });
      } else {
        // 长按空白区域也进入编辑模式
        this.eventBus.emit('desktop:edit-mode', { appId: null, trigger: 'long-press-blank' });
      }
    }, this.longPressDelay);
  }

  onPointerMove(event) {
    const moveX = Math.abs(event.clientX - this.startX);
    const moveY = Math.abs(event.clientY - this.startY);
    if (moveX > 8 || moveY > 8) {
      this.clearLongPressTimer();
    }
  }

  onPointerUp() {
    this.clearLongPressTimer();
  }

  onScroll() {
    const width = this.desktopContainer.clientWidth || 1;
    const scrollLeft = this.desktopContainer.scrollLeft;
    const pageIndex = Math.round(scrollLeft / width);

    // Apply snap directly to prevent scrolling past limits
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
    
    this.scrollTimeout = setTimeout(() => {
      const targetScrollLeft = pageIndex * width;
      if (Math.abs(scrollLeft - targetScrollLeft) > 1) {
        this.desktopContainer.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        });
      }
    }, 150);

    if (pageIndex !== this.lastPageIndex) {
      this.lastPageIndex = pageIndex;
      this.eventBus.emit('desktop:page-changed', { pageIndex });
    }
  }

  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
