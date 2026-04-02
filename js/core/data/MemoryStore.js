/**
 * 文件名: js/core/data/MemoryStore.js
 * 用途: 跨应用记忆数据访问层（Data Store）。
 *       管理 memories 对象仓库（key-value），支持增删改查。
 *       供逻辑层 GlobalMemory 统一调用。
 * 位置: /js/core/data/MemoryStore.js
 * 架构层: 数据层（Data Layer）
 */
export class MemoryStore {
  /**
   * @param {import('./DB.js').DB} db
   */
  constructor(db) {
    this.db = db;
    this.storeName = 'memories';
  }

  async setMemory(key, value, sourceApp = 'unknown') {
    return this.db.put(this.storeName, {
      key,
      value,
      sourceApp,
      updatedAt: Date.now()
    });
  }

  async getMemory(key) {
    return this.db.get(this.storeName, key);
  }

  async deleteMemory(key) {
    return this.db.delete(this.storeName, key);
  }

  async getAllMemories() {
    return this.db.getAll(this.storeName);
  }

  async clearAll() {
    return this.db.clear(this.storeName);
  }
}
