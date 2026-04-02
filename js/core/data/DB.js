/**
 * 文件名: js/core/data/DB.js
 * 用途: IndexedDB 初始化与连接管理。
 *       负责创建并维护以下对象仓库（Object Store）：
 *       - desktop: 桌面配置（单条记录）
 *       - settings: 全局设置（单条记录）
 *       - memories: 跨应用记忆（key-value）
 *       - appsData: 应用私有数据（按 appId 隔离）
 * 位置: /js/core/data/DB.js
 * 架构层: 数据层（Data Layer）
 */
import { Logger } from '../../utils/Logger.js';

export class DB {
  constructor() {
    this.dbName = 'MiniPhoneDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('desktop')) {
          db.createObjectStore('desktop', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('memories')) {
          db.createObjectStore('memories', { keyPath: 'key' });
          db.transaction.objectStore('memories').createIndex('sourceApp', 'sourceApp', {
            unique: false
          });
        }

        if (!db.objectStoreNames.contains('appsData')) {
          db.createObjectStore('appsData', { keyPath: 'id' });
          db.transaction.objectStore('appsData').createIndex('appId', 'appId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    this.db.onversionchange = () => {
      Logger.warn('IndexedDB 版本发生变化，当前连接已关闭');
      this.db.close();
      this.db = null;
    };

    return this.db;
  }

  async get(storeName, key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}
