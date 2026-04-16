/**
 * 文件名: js/core/logic/DesktopConfig.js
 * 用途: 桌面配置管理器。
 *管理桌面布局、图标位置、多屏数据、壁纸和图标尺寸等配置。
 *       配置变更后自动持久化到 DesktopStore，并通过 EventBus 通知 UI 重渲染。
 * 位置: /js/core/logic/DesktopConfig.js
 * 架构层: 逻辑层（Logic Layer）
 */
import { DesktopStore } from '../data/DesktopStore.js';
import { Logger } from '../../utils/Logger.js';

export class DesktopConfig {
  /**
   * @param {import('../data/DB.js').DB} db
   * @param {import('../interaction/EventBus.js').EventBus} eventBus
   * @param {import('./Registry.js').Registry} registry
   */
  constructor(db, eventBus, registry) {
    this.store = new DesktopStore(db);
    this.eventBus = eventBus;
    this.registry = registry;
    this.config = null;

    this.bindEvents();
  }

  bindEvents() {
    this.eventBus.on('desktop:icon-move', async ({ fromAppId, toAppId }) => {
      await this.moveIcon(fromAppId, toAppId);
    });

    // 通用元素拖拽移动
    this.eventBus.on('desktop:element-move', async (data) => {
      await this.handleElementMove(data);
    });
  }

  async handleElementMove({ sourceId, sourceType, targetId, targetType, targetPageIndex, isDock }) {
    // 这里简单实现一个初步的占位，实际可根据 sourceId/targetId 和类型重排 pages 或 widgetLayout
    // 目前为了防白屏，先只重渲染，具体位置调整后续可完善
    const config = await this.getConfig();
    const next = structuredClone(config);

    if (sourceType === 'app') {
      // 找到来源
      let srcPageIdx = -1;
      let srcIdx = -1;
      let inDock = false;

      next.pages.forEach((p, pIdx) => {
        const idx = p.appIds.indexOf(sourceId);
        if (idx !== -1) {
          srcPageIdx = pIdx;
          srcIdx = idx;
        }
      });
      if (srcPageIdx === -1 && next.dockApps) {
        const idx = next.dockApps.indexOf(sourceId);
        if (idx !== -1) {
          inDock = true;
          srcIdx = idx;
        }
      }

      // 如果来源和目标都在同一个区域，进行交换
      if (targetType === 'app' && targetId) {
        let tgtPageIdx = -1;
        let tgtIdx = -1;
        let tgtInDock = false;
        next.pages.forEach((p, pIdx) => {
          const idx = p.appIds.indexOf(targetId);
          if (idx !== -1) {
            tgtPageIdx = pIdx;
            tgtIdx = idx;
          }
        });
        if (tgtPageIdx === -1 && next.dockApps) {
          const idx = next.dockApps.indexOf(targetId);
          if (idx !== -1) {
            tgtInDock = true;
            tgtIdx = idx;
          }
        }

        // 简单交互逻辑：如果都在桌面页面
        if (srcPageIdx !== -1 && tgtPageIdx !== -1) {
          next.pages[srcPageIdx].appIds.splice(srcIdx, 1);
          next.pages[tgtPageIdx].appIds.splice(tgtIdx, 0, sourceId);
        } else if (inDock && tgtInDock) {
          next.dockApps.splice(srcIdx, 1);
          next.dockApps.splice(tgtIdx, 0, sourceId);
        } else if (srcPageIdx !== -1 && tgtInDock) {
           next.pages[srcPageIdx].appIds.splice(srcIdx, 1);
           next.dockApps.splice(tgtIdx, 0, sourceId);
        } else if (inDock && tgtPageIdx !== -1) {
           next.dockApps.splice(srcIdx, 1);
           next.pages[tgtPageIdx].appIds.splice(tgtIdx, 0, sourceId);
        }
      }
    } else if (sourceType === 'widget') {
       // 目前只记录一下组件所在的 page，DOM的实际位置依赖 render 机制
       // 复杂的 DOM 重排需要更精细的数据结构
    }

    await this.setConfig(next);
  }

  getDefaultConfig() {
    return {
      wallpaper: '', /* 空则使用 CSS 默认壁纸 */
      themeColor: '#D2C5B5',
      pages: [
        {
          id: 'page-1',
          appIds: ['chat', 'archive', 'forum', 'reader']
        },
        {
          id: 'page-2',
          appIds: ['doujin', 'textgame', 'game']
        }
      ],
      widgets: [],
      /*桌面组件布局：记录每个组件在哪一页、什么类型 */
      widgetLayout: [
        { id: 'w-clock', type: 'clock', page: 0 },
        { id: 'w-avatar', type: 'avatar', page: 0 },
        { id: 'w-news', type: 'news', page: 0 },
        { id: 'w-ticket', type: 'ticket', page: 0 },
        { id: 'w-theater', type: 'theater', page: 1 }
      ],
      /* Dock 栏应用列表 */
      dockApps: ['settings', 'memory', 'worldbook'],
      /* 自定义组件列表 */
      customWidgets: []
    };
  }

  async initDefaults() {
    const existing = await this.store.getConfig();
    
    // 检查旧配置的结构，如果存在但不是分多页的结构，则强制重置以防页面渲染白屏
    if (existing && existing.pages && existing.pages.length === 2&& existing.pages[0].appIds.includes('archive')) {
      // 确保新字段存在
      if (!existing.widgetLayout) {
        existing.widgetLayout = this.getDefaultConfig().widgetLayout;
      }
      if (!existing.dockApps) {
        existing.dockApps = this.getDefaultConfig().dockApps;
      }
      if (!existing.customWidgets) {
        existing.customWidgets = [];
      }
      this.config = existing;
      return existing;
    }

    const defaults = this.getDefaultConfig();
    await this.store.saveConfig(defaults);
    this.config = { id: 'desktop-config', ...defaults };
    return this.config;
  }

  async getConfig() {
    if (this.config) return this.config;
    this.config = await this.store.getConfig();
    return this.config;
  }

  async setConfig(nextConfig) {
    this.config = await this.store.saveConfig(nextConfig);
    this.eventBus.emit('desktop:changed', { config: this.config });
    return this.config;
  }

  async addAppToDesktop(appId, pageIndex = 0) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.pages[pageIndex]) {
      next.pages[pageIndex] = { id: `page-${pageIndex + 1}`, appIds: [] };
    }

    const exists = next.pages.some((page) => page.appIds.includes(appId));
    if (!exists) {
      next.pages[pageIndex].appIds.push(appId);
      return this.setConfig(next);
    }
    return config;
  }

  async removeAppFromDesktop(appId) {
    const config = await this.getConfig();
    const next = structuredClone(config);

    next.pages.forEach((page) => {
      page.appIds = page.appIds.filter((id) => id !== appId);
    });

    // 也从 dock 中移除
    if (next.dockApps) {
      next.dockApps = next.dockApps.filter((id) => id !== appId);
    }

    return this.setConfig(next);
  }

  async moveIcon(fromAppId, toAppId) {
    try {
      const config = await this.getConfig();
      const next = structuredClone(config);

      for (const page of next.pages) {
        const fromIndex = page.appIds.indexOf(fromAppId);
        const toIndex = page.appIds.indexOf(toAppId);
        if (fromIndex >= 0 && toIndex >= 0) {
          page.appIds.splice(fromIndex, 1);
          page.appIds.splice(toIndex, 0, fromAppId);
          await this.setConfig(next);
          return next;
        }
      }

      return config;
    } catch (error) {
      Logger.error('移动桌面图标失败', error);
      return this.config;
    }
  }

  /*========== 组件布局管理 ========== */

  async addWidget(widgetType, pageIndex = 0) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.widgetLayout) next.widgetLayout = [];
    const id = 'w-' + widgetType + '-' + Date.now();
    next.widgetLayout.push({ id, type: widgetType, page: pageIndex });
    return this.setConfig(next);
  }

  async removeWidget(widgetId) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.widgetLayout) return config;
    next.widgetLayout = next.widgetLayout.filter(w => w.id !== widgetId);
    return this.setConfig(next);
  }

  /* ========== Dock 管理 ========== */

  async addAppToDock(appId) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.dockApps) next.dockApps = [];
    if (!next.dockApps.includes(appId)) {
      next.dockApps.push(appId);
      return this.setConfig(next);
    }
    return config;
  }

  async removeAppFromDock(appId) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.dockApps) return config;
    next.dockApps = next.dockApps.filter(id => id !== appId);
    return this.setConfig(next);
  }

  /* ========== 自定义组件管理 ========== */

  async addCustomWidget(widget) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.customWidgets) next.customWidgets = [];
    next.customWidgets.push(widget);
    return this.setConfig(next);
  }

  async removeCustomWidget(widgetId) {
    const config = await this.getConfig();
    const next = structuredClone(config);
    if (!next.customWidgets) return config;
    next.customWidgets = next.customWidgets.filter(w => w.id !== widgetId);
    // 也从布局中移除
    if (next.widgetLayout) {
      next.widgetLayout = next.widgetLayout.filter(w => w.id !== widgetId);
    }
    return this.setConfig(next);
  }

  async getCustomWidgets() {
    const config = await this.getConfig();
    return config.customWidgets || [];
  }
}
