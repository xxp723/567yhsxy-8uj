/**
 * 文件名: js/core/data/AppDataStore.js
 * 用途: 应用私有数据访问层（Data Store）。
 *       管理 appsData 对象仓库，按 appId 隔离不同应用的数据。
 *       供各应用模块（Chat / Forum / Reader 等）存取自己的本地数据。
 * 位置: /js/core/data/AppDataStore.js
 * 架构层: 数据层（Data Layer）
 */
export class AppDataStore {
  /**
   * @param {import('./DB.js').DB} db
   */
  constructor(db) {
    this.db = db;
    this.storeName = 'appsData';
  }

  buildId(appId, key) {
    return `${appId}::${key}`;
  }

  async set(appId, key, value) {
    return this.db.put(this.storeName, {
      id: this.buildId(appId, key),
      appId,
      key,
      value,
      updatedAt: Date.now()
    });
  }

  async get(appId, key) {
    return this.db.get(this.storeName, this.buildId(appId, key));
  }

  async remove(appId, key) {
    return this.db.delete(this.storeName, this.buildId(appId, key));
  }

  async getAll() {
    return this.db.getAll(this.storeName);
  }

  async getByAppId(appId) {
    const all = await this.getAll();
    return all.filter((item) => item.appId === appId);
  }

  async clearByAppId(appId) {
    const list = await this.getByAppId(appId);
    await Promise.all(list.map((item) => this.db.delete(this.storeName, item.id)));
    return true;
  }
}
