/**
 * 文件名: js/core/ui/Window.js
 * 用途: 应用窗口管理器（全屏覆盖桌面）。
 *       提供 open/close/focus/showError 等方法，供 AppManager 控制应用窗口生命周期。
 * 位置: /js/core/ui/Window.js
 * 架构层: 外观层（UI Layer）
 */
export class WindowManager {
  /**
   * @param {HTMLElement} rootEl - 手机屏幕根容器（通常是 #phone-screen）
   * @param {import('../interaction/EventBus.js').EventBus} eventBus
   */
  constructor(rootEl, eventBus) {
    this.rootEl = rootEl;
    this.eventBus = eventBus;
    /** @type {Map<string, HTMLElement>} */
    this.windows = new Map();
    this.container = this.ensureContainer();
  }

  ensureContainer() {
    let el = this.rootEl.querySelector('#app-window-layer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-window-layer';
      el.className = 'app-window-layer';
      this.rootEl.appendChild(el);
    }
    return el;
  }

  open(appMeta) {
    const existed = this.windows.get(appMeta.id);
    if (existed) {
      this.focus(appMeta.id);
      return existed.querySelector('.app-window__content');
    }

    const win = document.createElement('section');
    win.className = 'app-window';
    win.dataset.appId = appMeta.id;

    const header = document.createElement('header');
    header.className = 'app-window__header';
    header.innerHTML = `
      <div class="app-window__title">${appMeta.name}</div>
      <button class="app-window__close" type="button" aria-label="关闭应用"><svg width="18" height="18" viewBox="0 0 48 48" fill="none"><path d="M24 44c11.046 0 20-8.954 20-20S35.046 4 24 4 4 12.954 4 24s8.954 20 20 20Z" stroke="currentColor" stroke-width="3"/><path d="M29.657 18.343 18.343 29.657M18.343 18.343l11.314 11.314" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    `;

    const content = document.createElement('div');
    content.className = 'app-window__content';
    content.innerHTML = '<div class="loading">应用加载中...</div>';

    header.querySelector('.app-window__close')?.addEventListener('click', () => {
      this.eventBus.emit('app:close', { appId: appMeta.id });
    });

    win.appendChild(header);
    win.appendChild(content);
    this.container.appendChild(win);

    this.windows.set(appMeta.id, win);
    this.focus(appMeta.id);

    return content;
  }

  close(appId) {
    const win = this.windows.get(appId);
    if (!win) return;
    win.remove();
    this.windows.delete(appId);
  }

  focus(appId) {
    this.windows.forEach((win, id) => {
      win.classList.toggle('is-active', id === appId);
    });
  }

  showError(appId, message) {
    const win = this.windows.get(appId);
    if (!win) return;
    const content = win.querySelector('.app-window__content');
    if (content) {
      content.innerHTML = `<div class="app-error">${message}</div>`;
    }
  }
}
