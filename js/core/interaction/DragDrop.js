/**
 * 文件名: js/core/interaction/DragDrop.js
 * 用途: 桌面图标拖拽排序交互模块。
 *位置: /js/core/interaction/DragDrop.js
 * 架构层: 交互层（Interaction Layer）
 */
export class DragDrop {
  /**
   * @param {HTMLElement} desktopContainer
   * @param {import('./EventBus.js').EventBus} eventBus
   */
  constructor(desktopContainer, eventBus) {
    this.desktopContainer = desktopContainer;
    this.eventBus = eventBus;
    this.draggingId = null;
    this.draggingType = null; // 'app' or 'widget'

    this.onDragStart = this.onDragStart.bind(this);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
  }

  bind() {
    if (!this.desktopContainer) return;

    // 绑定到整个屏幕，以便支持 dock 和 desktop 之间的拖拽
    const screen = this.desktopContainer.closest('.screen');
    if (screen) {
      screen.addEventListener('dragstart', this.onDragStart);
      screen.addEventListener('dragover', this.onDragOver);
      screen.addEventListener('drop', this.onDrop);
      screen.addEventListener('dragend', this.onDragEnd);
    }
  }

  unbind() {
    if (!this.desktopContainer) return;

    const screen = this.desktopContainer.closest('.screen');
    if (screen) {
      screen.removeEventListener('dragstart', this.onDragStart);
      screen.removeEventListener('dragover', this.onDragOver);
      screen.removeEventListener('drop', this.onDrop);
      screen.removeEventListener('dragend', this.onDragEnd);
    }
  }

  onDragStart(event) {
    // 只有在编辑模式下才允许拖拽
    if (!document.body.classList.contains('desktop-edit-mode')) {
      event.preventDefault();
      return;
    }

    const iconEl = event.target.closest('.app-icon');
    const widgetEl = event.target.closest('.desktop-widget-item');
    
    const dragEl = iconEl || widgetEl;
    if (!dragEl) {
      event.preventDefault();
      return;
    }

    if (iconEl) {
      this.draggingId = iconEl.dataset.appId;
      this.draggingType = 'app';
    } else {
      this.draggingId = widgetEl.dataset.widgetId;
      this.draggingType = 'widget';
    }

    dragEl.classList.add('is-dragging');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ id: this.draggingId, type: this.draggingType }));
    }
  }

  onDragOver(event) {
    if (!document.body.classList.contains('desktop-edit-mode')) return;
    
    // 允许在桌面区域和 dock 区域放置
    const isDesktopArea = event.target.closest('.desktop-page') || event.target.closest('.dock-container');
    if (!isDesktopArea) return;
    
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event) {
    if (!document.body.classList.contains('desktop-edit-mode')) return;
    if (!this.draggingId) return;
    
    event.preventDefault();

    let targetId = null;
    let targetType = null;
    let isDock = false;

    const targetIcon = event.target.closest('.app-icon');
    const targetWidget = event.target.closest('.desktop-widget-item');
    const targetDock = event.target.closest('.dock-container');
    const targetPage = event.target.closest('.desktop-page');

    if (targetIcon) {
      targetId = targetIcon.dataset.appId;
      targetType = 'app';
    } else if (targetWidget) {
      targetId = targetWidget.dataset.widgetId;
      targetType = 'widget';
    }
    
    if (targetDock) isDock = true;
    
    let targetPageIndex = 0;
    if (targetPage) {
      const allPages = Array.from(this.desktopContainer.querySelectorAll('.desktop-page'));
      targetPageIndex = allPages.indexOf(targetPage);
    }

    // 发送通用移动事件，由 Desktop.js 统一处理重新布局
    this.eventBus.emit('desktop:element-move', {
      sourceId: this.draggingId,
      sourceType: this.draggingType,
      targetId: targetId,
      targetType: targetType,
      targetPageIndex: targetPageIndex,
      isDock: isDock
    });
  }

  onDragEnd() {
    const screen = this.desktopContainer.closest('.screen');
    if (screen) {
      const draggingEls = screen.querySelectorAll('.is-dragging');
      draggingEls.forEach(el => el.classList.remove('is-dragging'));
    }
    this.draggingId = null;
    this.draggingType = null;
  }
}
