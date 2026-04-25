/**
 * 文件名: js/core/data/PersistentKV.js
 * 用途: 统一前端持久化键值存储封装。
 *       以 IndexedDB appsData 作为唯一持久化方案。
 * 位置: /js/core/data/PersistentKV.js
 * 架构层: 数据层（Data Layer）
 */

const STORE_NAME = 'appsData';
const APP_ID = 'persistent-kv';

export class PersistentKV {
  /**
   * @param {import('./DB.js').DB} db
   */
  constructor(db) {
    this.db = db;
  }

  buildId(key) {
    return `${APP_ID}::${key}`;
  }

  async get(key, defaultValue = null) {
    if (!this.db) {
      throw new Error(`PersistentKV 未初始化，无法读取: ${key}`);
    }

    const record = await this.db.get(STORE_NAME, this.buildId(key));
    if (!record) return defaultValue;
    return record.value ?? defaultValue;
  }

  async set(key, value) {
    if (!this.db) {
      throw new Error(`PersistentKV 未初始化，无法写入: ${key}`);
    }

    await this.db.put(STORE_NAME, {
      id: this.buildId(key),
      appId: APP_ID,
      key,
      value,
      updatedAt: Date.now()
    });

    return value;
  }

  async remove(key) {
    if (!this.db) {
      throw new Error(`PersistentKV 未初始化，无法删除: ${key}`);
    }

    await this.db.delete(STORE_NAME, this.buildId(key));
    return true;
  }

  async getMany(keys = []) {
    const result = {};
    for (const key of keys) {
      result[key] = await this.get(key, null);
    }
    return result;
  }

  async setMany(entries = {}) {
    const keys = Object.keys(entries);
    for (const key of keys) {
      await this.set(key, entries[key]);
    }
    return true;
  }

  async seedIfMissing(key, value) {
    const existed = await this.get(key, undefined);
    if (existed !== undefined) return existed;
    await this.set(key, value);
    return value;
  }
}
