/**
 * 文件名: js/core/interaction/DragDrop.js
 * 用途: 桌面图标拖拽排序交互模块。
 *       当前实现为“事件桥接骨架”：
 *       - 监听图标拖拽开始/结束
 *       - 计算拖拽来源与目标索引
 *       - 通过 EventBus 发布 desktop:icon-move 事件
 *       具体数据变更由逻辑层 DesktopConfig 处理，UI 层再重渲染。
 * 位置: /js/core/interaction/DragDrop.js
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
    this.draggingAppId = null;

    this.onDragStart = this.onDragStart.bind(this);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDrop = this.onDrop.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
  }

  bind() {
    if (!this.desktopContainer) return;

    this.desktopContainer.addEventListener('dragstart', this.onDragStart);
    this.desktopContainer.addEventListener('dragover', this.onDragOver);
    this.desktopContainer.addEventListener('drop', this.onDrop);
    this.desktopContainer.addEventListener('dragend', this.onDragEnd);
  }

  unbind() {
    if (!this.desktopContainer) return;

    this.desktopContainer.removeEventListener('dragstart', this.onDragStart);
    this.desktopContainer.removeEventListener('dragover', this.onDragOver);
    this.desktopContainer.removeEventListener('drop', this.onDrop);
    this.desktopContainer.removeEventListener('dragend', this.onDragEnd);
  }

  onDragStart(event) {
    const iconEl = event.target.closest('.app-icon');
    if (!iconEl) return;

    this.draggingAppId = iconEl.dataset.appId || null;
    iconEl.classList.add('is-dragging');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', this.draggingAppId || '');
    }
  }

  onDragOver(event) {
    const iconEl = event.target.closest('.app-icon');
    if (!iconEl) return;
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event) {
    const targetIcon = event.target.closest('.app-icon');
    if (!targetIcon || !this.draggingAppId) return;
    event.preventDefault();

    const targetAppId = targetIcon.dataset.appId;
    if (!targetAppId || targetAppId === this.draggingAppId) return;

    this.eventBus.emit('desktop:icon-move', {
      fromAppId: this.draggingAppId,
      toAppId: targetAppId
    });
  }

  onDragEnd() {
    const draggingEl = this.desktopContainer.querySelector('.app-icon.is-dragging');
    if (draggingEl) draggingEl.classList.remove('is-dragging');
    this.draggingAppId = null;
  }
}
