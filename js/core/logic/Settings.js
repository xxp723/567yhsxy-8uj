/**
 * 文件名: js/core/logic/Settings.js
 * 用途: 全局设置管理器。
 *       管理外观设置、设置应用新版 API 配置与功能开关，并提供导入/导出能力。
 *       与 SettingsStore 交互持久化，同时通过 EventBus 广播设置变更。
 * 位置: /js/core/logic/Settings.js
 * 架构层: 逻辑层（Logic Layer）
 */
import { SettingsStore } from '../data/SettingsStore.js';
import { DesktopStore } from '../data/DesktopStore.js';
import { MemoryStore } from '../data/MemoryStore.js';
import { AppDataStore } from '../data/AppDataStore.js';
import { Logger } from '../../utils/Logger.js';

export class Settings {
  /**
   * @param {import('../data/DB.js').DB} db
   * @param {import('../interaction/EventBus.js').EventBus} [eventBus]
   */
  constructor(db, eventBus = null) {
    this.store = new SettingsStore(db);
    this.desktopStore = new DesktopStore(db);
    this.memoryStore = new MemoryStore(db);
    this.appDataStore = new AppDataStore(db);
    this.eventBus = eventBus;
  }

  getDefaultSettings() {
    return {
      appearance: {
        wallpaper: '',
        desktopWallpaper: '',
        desktopWallpaperCrop: { x: 50, y: 50, scale: 1 },
        lockscreenWallpaper: '',
        themeColor: '#4f46e5',
        fullscreen: false,
        statusBarHidden: false,
        dockOpacity: 88,
        dockColor: '#f5f1ea',
        iconSize: 56,
        iconImage: '',
        iconImages: {},
        iconRadius: 18,
        iconLabelSize: 13,
        iconShadowStyle: 'none',
        iconShadowSize: 18,
        iconBorderWidth: 0,
        iconBorderColor: '#d7c9b8'
      },
      // [设置应用同步标记] API 默认配置区域：与 js/apps/settings/api.js 的 version 3 主/副 API 设置结构保持一致
      api: {
        version: 3,
        activeProfile: 'primary',
        primary: {
          provider: 'openai',
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          model: '',
          availableModels: [],
          stream: true
        },
        secondary: {
          provider: 'gemini',
          apiKey: '',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          model: '',
          availableModels: [],
          stream: true
        },
        global: {
          temperature: 0.7,
          maxTokens: 2048,
          useGlobalTemperature: true,
          useGlobalMaxTokens: true
        },
        savedPrimaryConfigs: []
      },
      features: {
        offlineMode: true
      }
    };
  }

  async initDefaults() {
    const existing = await this.store.getSettings();
    if (existing) return existing;

    const defaults = this.getDefaultSettings();
    return this.store.saveSettings(defaults);
  }

  async getAll() {
    return (await this.store.getSettings()) || this.getDefaultSettings();
  }

  async update(partialSettings) {
    const next = await this.store.patchSettings(partialSettings);
    if (this.eventBus) {
      this.eventBus.emit('settings:changed', { settings: next });
    }
    return next;
  }

  /* ========================================================================
     [修改标注·已完成·本次数据设置全量导入导出与清空]
     说明：
     1. “设置 > 数据设置”的导出/导入/清空以 DB.js 当前 IndexedDB 对象仓库为唯一数据源。
     2. 仓库列表动态读取当前数据库 objectStoreNames；以后新应用只要写入 DB.js 管理的 IndexedDB，
        其新增对象仓库或 appsData 记录都会自动进入全量导出、导入和清空流程。
     3. 导入 appsData 时原样 put 记录，不再通过 AppDataStore.set 重建，避免丢失记录上的其它字段。
     4. 不使用 localStorage/sessionStorage，不写双份存储兜底，也不做长文本或大媒体字段过滤。
     ======================================================================== */
  async getFullBackupStoreNames() {
    const indexedDb = await this.store.db.init();
    return Array.from(indexedDb.objectStoreNames);
  }

  /**
   * 导出小手机网页全部 IndexedDB 数据（包含当前 DB.js 已注册的全部对象仓库）
   */
  async exportAllData() {
    const stores = {};
    const storeNames = await this.getFullBackupStoreNames();

    for (const storeName of storeNames) {
      stores[storeName] = await this.store.db.getAll(storeName);
    }

    return {
      meta: {
        app: 'MiniPhone',
        version: 3,
        type: 'indexeddb-full-backup',
        stores: storeNames,
        exportedAt: Date.now()
      },
      stores,
      data: {
        settings: stores.settings?.find((item) => item?.id === this.store.recordId) || null,
        desktop: stores.desktop?.find((item) => item?.id === this.desktopStore.recordId) || null,
        memories: stores.memories || [],
        appsData: stores.appsData || []
      }
    };
  }

  normalizeLegacyBackupToStores(backup) {
    if (backup?.stores && typeof backup.stores === 'object') {
      return backup.stores;
    }

    if (!backup?.data || typeof backup.data !== 'object') {
      throw new Error('导入数据格式错误');
    }

    const { settings, desktop, memories, appsData } = backup.data;
    return {
      desktop: desktop ? [{ id: this.desktopStore.recordId, ...desktop }] : [],
      settings: settings ? [{ id: this.store.recordId, ...settings }] : [],
      memories: Array.isArray(memories) ? memories : [],
      appsData: Array.isArray(appsData) ? appsData : []
    };
  }

  /**
   * 导入小手机网页全部 IndexedDB 数据（可按需覆盖）
   * @param {any} backup
   * @param {{overwrite?: boolean}} options
   */
  async importAllData(backup, options = {}) {
    const { overwrite = true } = options;
    const storeNames = await this.getFullBackupStoreNames();
    const importableStoreNames = new Set(storeNames);
    const stores = this.normalizeLegacyBackupToStores(backup);

    if (overwrite) {
      for (const storeName of storeNames) {
        await this.store.db.clear(storeName);
      }
    }

    for (const [storeName, records] of Object.entries(stores)) {
      if (!importableStoreNames.has(storeName) || !Array.isArray(records)) continue;

      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        await this.store.db.put(storeName, record);
      }
    }

    Logger.info('全量数据导入完成');
    if (this.eventBus) {
      this.eventBus.emit('settings:imported', {});
      this.eventBus.emit('desktop:changed', {});
      this.eventBus.emit('memory:updated', { sourceApp: 'import' });
    }

    return true;
  }

  /**
   * 清空小手机网页全部 IndexedDB 数据，刷新后由现有初始化流程回到默认初始状态。
   */
  async clearAllData() {
    const storeNames = await this.getFullBackupStoreNames();

    for (const storeName of storeNames) {
      await this.store.db.clear(storeName);
    }

    if (this.eventBus) {
      this.eventBus.emit('settings:cleared', {});
      this.eventBus.emit('desktop:changed', {});
      this.eventBus.emit('memory:updated', { sourceApp: 'clear-all' });
    }

    return true;
  }
}
