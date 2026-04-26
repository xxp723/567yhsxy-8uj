/**
 * 文件名: js/core/logic/AppManager.js
 * 用途: 应用生命周期管理器。
 *       职责：
 *       - 从 Registry 查询应用元数据
 *       - 动态 import 应用入口模块
 *       - 调用 mount 挂载到 Window 容器
 *       - 调用 unmount 关闭并销毁实例
 *       - 监听全局 app:open / app:close 事件
 * 位置: /js/core/logic/AppManager.js
 * 架构层: 逻辑层（Logic Layer）
 */
import { Logger } from '../../utils/Logger.js';

export class AppManager {
  /**
   * @param {{
   *  registry: import('./Registry.js').Registry,
   *  windowManager: import('../ui/Window.js').WindowManager,
   *  eventBus: import('../interaction/EventBus.js').EventBus,
   *  globalMemory: import('./GlobalMemory.js').GlobalMemory,
   *  settings: import('./Settings.js').Settings,
   *  db: import('../data/DB.js').DB
   * }} deps
   */
  constructor({ registry, windowManager, eventBus, globalMemory, settings, db }) {
    this.registry = registry;
    this.windowManager = windowManager;
    this.eventBus = eventBus;
    this.globalMemory = globalMemory;
    this.settings = settings;
    this.db = db;

    /** @type {Map<string, any>} */
    this.loadedModules = new Map();
    /** @type {Map<string, any>} */
    this.mountedInstances = new Map();
    /** @type {Map<string, Promise<any>>} */
    this.openingPromises = new Map();

    this.bindEvents();

    /* ==========================================================================
       [区域标注·本次需求4] 应用模块空闲预热
       说明：不改变任何持久化逻辑；仅在浏览器空闲时提前 import 应用入口，
             让除闲谈外的其它应用点击后也能更快响应、减少“点了没反应”的体感。
       ========================================================================== */
    this.scheduleModuleWarmup();
  }

  bindEvents() {
    this.eventBus.on('app:open', async ({ appId }) => {
      if (!appId) return;
      await this.open(appId);
    });

    this.eventBus.on('app:close', async ({ appId }) => {
      if (!appId) return;
      await this.close(appId);
    });
  }

  async open(appId) {
    const appMeta = this.registry.get(appId);
    if (!appMeta) {
      Logger.warn(`应用未注册: ${appId}`);
      return;
    }

    // 已打开则直接聚焦
    if (this.mountedInstances.has(appId)) {
      this.windowManager.focus(appId);
      return;
    }

    // [修改标注·本次需求2] 防止桌面图标连点时重复创建同一应用窗口，避免挂载竞争导致渲染不完整/点不开
    if (this.openingPromises.has(appId)) {
      await this.openingPromises.get(appId);
      this.windowManager.focus(appId);
      return;
    }

    const openingTask = (async () => {
      try {
        /* ==========================================================================
           [区域标注·本次需求4] 先打开窗口再加载模块，提升所有应用的点击响应速度
           说明：旧逻辑会等动态 import 完成后才打开窗口，容易造成“其它应用点不进去”的体感。
                 现在普通应用会立即出现窗口；闲谈应用在打开窗口前先加载专属 CSS，避免闪过全局样式。
           ========================================================================== */
        const modulePromise = this.loadModule(appMeta);

        if (appId === 'chat') {
          /* [区域标注·本次需求1] 闲谈首屏样式预加载：窗口显示前先确保 chat.css 可用 */
          await this.preloadChatCriticalStyles();
        }

        const contentEl = this.windowManager.open(appMeta);

        if (appId === 'chat') {
          /* [区域标注·本次需求1] 清空全局 loading，避免闲谈进入时闪过全局 CSS/加载样式 */
          contentEl.innerHTML = '';
        }

        const moduleRef = await modulePromise;
        if (!moduleRef || typeof moduleRef.mount !== 'function') {
          throw new Error(`应用入口缺少 mount 方法: ${appMeta.entry}`);
        }

        const context = {
          appId,
          appMeta,
          eventBus: this.eventBus,
          globalMemory: this.globalMemory,
          settings: this.settings,
          db: this.db,
          windowManager: this.windowManager
        };

        const instance = await moduleRef.mount(contentEl, context);
        this.mountedInstances.set(appId, instance || {});

        this.eventBus.emit('app:opened', { appId, appMeta });
        Logger.info(`应用已打开: ${appMeta.name}`);
      } catch (error) {
        Logger.error(`打开应用失败: ${appId}`, error);
        this.windowManager.showError(appId, '应用启动失败，请查看日志。');
      } finally {
        this.openingPromises.delete(appId);
      }
    })();

    this.openingPromises.set(appId, openingTask);
    await openingTask;
  }

  /* ==========================================================================
     [区域标注·本次需求1] 闲谈应用关键 CSS 预加载
     说明：只预加载闲谈自己的样式，不写任何持久化数据。
   ========================================================================== */
  async preloadChatCriticalStyles() {
    await this.preloadStylesheet('./js/apps/chat/chat.css', 'chat-app-css');
  }

  /* ==========================================================================
     [区域标注·本次需求1] 通用 CSS 预加载工具
     说明：与闲谈应用内部 loadCSS 使用同一 link id，避免重复插入样式表。
   ========================================================================== */
  preloadStylesheet(href, id) {
    return new Promise((resolve) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === '1' || existing.sheet) {
          resolve();
          return;
        }
        const done = () => {
          existing.dataset.loaded = '1';
          resolve();
        };
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', done, { once: true });
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.id = id;
      const done = () => {
        link.dataset.loaded = '1';
        resolve();
      };
      link.addEventListener('load', done, { once: true });
      link.addEventListener('error', done, { once: true });
      document.head.appendChild(link);
    });
  }

  /* ==========================================================================
     [区域标注·本次需求4] 空闲时预热应用入口模块
     说明：只做动态 import 缓存，不挂载应用、不读写持久化数据。
   ========================================================================== */
  scheduleModuleWarmup() {
    const run = () => {
      void this.warmupRegisteredAppModules();
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }

    setTimeout(run, 600);
  }

  async warmupRegisteredAppModules() {
    try {
      const apps = this.registry.getAll();
      await Promise.allSettled(apps.map((appMeta) => this.loadModule(appMeta)));
    } catch (error) {
      Logger.warn('应用模块预热失败', error);
    }
  }

  async close(appId) {
    try {
      const instance = this.mountedInstances.get(appId);
      const moduleRef = this.loadedModules.get(appId);

      if (moduleRef && typeof moduleRef.unmount === 'function') {
        await moduleRef.unmount(instance);
      }

      this.mountedInstances.delete(appId);
      this.windowManager.close(appId);

      this.eventBus.emit('app:closed', { appId });
      Logger.info(`应用已关闭: ${appId}`);
    } catch (error) {
      Logger.error(`关闭应用失败: ${appId}`, error);
    }
  }

  async loadModule(appMeta) {
    if (this.loadedModules.has(appMeta.id)) {
      return this.loadedModules.get(appMeta.id);
    }

    const moduleRef = await import(appMeta.entry);
    this.loadedModules.set(appMeta.id, moduleRef);
    return moduleRef;
  }
}
