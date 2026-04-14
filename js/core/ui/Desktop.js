/**
 * 文件名: js/core/ui/Desktop.js
 * 用途: 桌面渲染器。
 *       根据 DesktopConfig 的 pages 数据渲染多屏桌面和应用图标。
 *       监听 desktop:changed 事件自动重渲染；点击图标通过 EventBus 打开应用。
 * 位置: /js/core/ui/Desktop.js
 * 架构层: 外观层（UI Layer）
 */
export class Desktop {
  /**
   * @param {HTMLElement} container
   * @param {import('../interaction/EventBus.js').EventBus} eventBus
   * @param {import('../logic/AppManager.js').AppManager} appManager
   */
  constructor(container, eventBus, appManager) {
    this.container = container;
    this.eventBus = eventBus;
    this.appManager = appManager;

    this.bindEvents();
  }

  bindEvents() {
    this.eventBus.on('desktop:changed', ({ config }) => {
      this.render(config);
    });
  }

  render(config) {
    if (!this.container || !config) return;

    // 如果已有静态布局（data-static-layout="true"），不重建 DOM，只做增强：绑定事件、恢复图标
    const isStaticLayout = this.container.dataset.staticLayout === 'true';

    if (!isStaticLayout) {
      // 原有动态渲染路径（保留兼容性）
      const apps = this.appManager.registry.getAll();
      const appMap = new Map(apps.map((app) => [app.id, app]));
      const pages = Array.isArray(config.pages) ? config.pages : [];
      const renderIcons = (appIds, rowClass) => {
        const iconsHtml = (appIds || [])
          .map((appId) => {
            const app = appMap.get(appId);
            if (!app) return '';
            const customImg = localStorage.getItem(`miniphone_app_icon_${app.id}`);
            const imgStyle = customImg ? '' : 'display:none;';
            return `
              <div class="app-icon" draggable="true" data-app-id="${app.id}" title="${app.name}">
                <button class="app-icon-btn" type="button" data-open-app="${app.id}" aria-label="打开${app.name}">
                  <span class="app-icon-glyph">${app.icon || ''}</span>
                  <img class="app-custom-img" src="${customImg || ''}" style="${imgStyle}" alt="${app.name}" />
                </button>
                <span class="app-icon-label">${app.name}</span>
              </div>
            `;
          })
          .join('');
        return `<div class="${rowClass}">${iconsHtml}</div>`;
      };

      const html = pages
        .map((page, index) => {
          if (index === 0) {
            return `
              <section class="desktop-page" data-page-id="${page.id}">
                <div class="p1-clock-widget">
                  <div class="p1-time" id="widget-time">00:00</div>
                  <div class="p1-date" id="widget-date">1925年1月1日 星期一</div>
                </div>
                <div class="p1-widgets-row">
                  <div class="p1-news-widget">
                    <div class="p1-news-title" contenteditable="true" id="cfg-news-title" spellcheck="false">民国日報</div>
                    <div class="p1-news-content" contenteditable="true" id="cfg-news-content" spellcheck="false">才子佳人，乱世情缘。<br>寻人启事：炮火纷飞，国破家亡，生离死别，苦不堪言。寻影展示，护你一世周全。阴阳两隔，任性蹉跎。这就是真正的民国。</div>
                  </div>
                  <div class="p1-avatar-widget" id="avatar-trigger">
                    <div class="p1-avatar-inner">
                      <img class="p1-avatar-img" id="widget-avatar" style="display:none;" />
                      <div class="p1-avatar-hint" id="widget-avatar-hint">點擊上傳</div>
                    </div>
                    <div class="p1-avatar-desc">號加外急<br>0123456789</div>
                  </div>
                </div>
                ${renderIcons(page.appIds, 'p1-apps-row')}
              </section>
            `;
          } else if (index === 1) {
            return `
              <section class="desktop-page" data-page-id="${page.id}">
                <div class="p2-ticket-widget">
                  <div class="p2-ticket-inner">
                    <div class="p2-ticket-brand" contenteditable="true" id="cfg-ticket-brand" spellcheck="false">浮生劇院</div>
                    <div class="p2-ticket-img-box" id="ticket-img-trigger">
                      <img class="p2-ticket-img" id="widget-ticket-img" style="display:none;" />
                    </div>
                    <div class="p2-ticket-text-zone">
                      <div class="p2-ticket-title" contenteditable="true" id="cfg-ticket-title" spellcheck="false">霸王別姬</div>
                      <div class="p2-ticket-desc" contenteditable="true" id="cfg-ticket-desc" spellcheck="false">
                        <span>辛已年五月廿十</span>
                        <span>渝州縣橫河街</span>
                        <span>經典劇目 悲慘世界</span>
                      </div>
                    </div>
                  </div>
                  <div class="p2-ticket-stamp" contenteditable="true" id="cfg-ticket-stamp" spellcheck="false">No.001925 憑券入場</div>
                </div>
                ${renderIcons(page.appIds, 'p2-apps-row')}
              </section>
            `;
          } else {
            return `<section class="desktop-page" data-page-id="${page.id}">${renderIcons(page.appIds, 'p1-apps-row')}</section>`;
          }
        })
        .join('');

      this.container.innerHTML = html;
    } else {
      // 静态布局：仅恢复图标图片、绑定事件
      const apps = this.appManager.registry.getAll();
      const appMap = new Map(apps.map((app) => [app.id, app]));

      // 恢复自定义图标
      this.container.querySelectorAll('[data-app-id]').forEach((el) => {
        const appId = el.getAttribute('data-app-id');
        const app = appMap.get(appId);
        if (!app) return;
        const btn = el.querySelector('.app-icon-btn');
        const img = el.querySelector('.app-custom-img');
        const glyph = el.querySelector('.app-icon-glyph');
        if (glyph && !glyph.textContent.trim()) glyph.textContent = app.icon || '';
        const customImg = localStorage.getItem(`miniphone_app_icon_${appId}`);
        if (img && customImg) {
          img.src = customImg;
          img.style.display = 'block';
          btn?.classList.add('has-img');
        }
      });

      // Dock 图标自定义
      document.querySelectorAll('#dock-container [data-app-id]').forEach((el) => {
        const appId = el.getAttribute('data-app-id');
        const img = el.querySelector('.app-custom-img');
        const btn = el.querySelector('.app-icon-btn');
        const glyph = el.querySelector('.app-icon-glyph');
        const app = appMap.get(appId);
        if (glyph && app && !glyph.textContent.trim()) glyph.textContent = app.icon || '';
        const customImg = localStorage.getItem(`miniphone_app_icon_${appId}`);
        if (img && customImg) {
          img.src = customImg;
          img.style.display = 'block';
          btn?.classList.add('has-img');
        }
      });
    }

    this.bindIconEvents();
    this.initWidgets();
  }

  bindIconEvents() {
    // 桌面内应用图标绑定
    const buttons = this.container.querySelectorAll('[data-open-app]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-open-app');
        if (!appId) return;
        this.eventBus.emit('app:open', { appId });
      });
    });

    // Dock 栏图标事件绑定 (因为 Dock 是脱离 desktop-container 的，所以在外层绑定一次)
    const dockButtons = document.querySelectorAll('#dock-container [data-open-app]');
    dockButtons.forEach((btn) => {
      // 避免重复绑定
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-open-app');
        if (!appId) return;
        this.eventBus.emit('app:open', { appId });
      });
    });
  }

  initWidgets() {
    // 处理文件上传 (头像框和戏票图片)
    const avatarTrigger = this.container.querySelector('#avatar-trigger');
    const ticketTrigger = this.container.querySelector('#ticket-img-trigger');
    const fileInput = document.getElementById('sys-file-upload');
    let currentUploadTarget = null;

    const handleUploadClick = (target) => {
      const option = confirm("点击确定使用本地上传，点击取消使用网络URL");
      if (option) {
        currentUploadTarget = target;
        fileInput.click();
      } else {
        const url = prompt("请输入网络图片URL:");
        if (url && url.trim() !== "") {
          this.applyImageToTarget(target, url.trim());
        }
      }
    };

    if (avatarTrigger) avatarTrigger.addEventListener('click', () => handleUploadClick('avatar'));
    if (ticketTrigger) ticketTrigger.addEventListener('click', () => handleUploadClick('ticket'));

    // 防止多次绑定全局事件
    if (!fileInput.dataset.bound) {
      fileInput.dataset.bound = "true";
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && currentUploadTarget) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.applyImageToTarget(currentUploadTarget, evt.target.result);
            fileInput.value = ''; // 清空方便下次选择
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 从 localStorage 恢复自定义文本和图片
    this.restoreWidgetData();
  }

  applyImageToTarget(targetStr, src) {
    if (targetStr === 'avatar') {
      const img = this.container.querySelector('#widget-avatar');
      const hint = this.container.querySelector('#widget-avatar-hint');
      if (img) { img.src = src; img.style.display = 'block'; }
      if (hint) hint.style.display = 'none';
      localStorage.setItem('miniphone_widget_avatar', src);
    } else if (targetStr === 'ticket') {
      const img = this.container.querySelector('#widget-ticket-img');
      if (img) { img.src = src; img.style.display = 'block'; }
      localStorage.setItem('miniphone_widget_ticket', src);
    }
  }

  restoreWidgetData() {
    // 恢复图片
    const savedAvatar = localStorage.getItem('miniphone_widget_avatar');
    if (savedAvatar) this.applyImageToTarget('avatar', savedAvatar);
    
    const savedTicket = localStorage.getItem('miniphone_widget_ticket');
    if (savedTicket) this.applyImageToTarget('ticket', savedTicket);

    // 恢复和监听文本编辑
    // 添加应用图标的图片上传交互
    const appBtns = this.container.querySelectorAll('.app-icon-btn');
    appBtns.forEach(btn => {
      // 通过在应用图标上长按或特殊的绑定，这里为了简便：双击可以换图标，单击是打开应用。
      // 因为这是桌面端/移动端模拟，其实更好的做法是在设置里改。
      // 目前不需要在这里写双击事件，因为用户说了：“之后还需要在设置应用里做”。
      // 所以我们这里只负责读取和渲染 customImg 即可。
    });

    const textFields = ['cfg-news-title', 'cfg-news-content', 'cfg-ticket-brand', 'cfg-ticket-title', 'cfg-ticket-desc', 'cfg-ticket-stamp'];
    textFields.forEach(id => {
      const el = this.container.querySelector('#' + id);
      if (el) {
        const saved = localStorage.getItem('miniphone_widget_' + id);
        if (saved) el.innerHTML = saved;
        
        el.addEventListener('blur', () => {
          localStorage.setItem('miniphone_widget_' + id, el.innerHTML);
        });
        
        // 防止拖拽和编辑冲突
        el.addEventListener('mousedown', (e) => e.stopPropagation());
      }
    });
  }
}
