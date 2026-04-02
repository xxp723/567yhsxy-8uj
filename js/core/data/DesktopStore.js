/**
 * 文件名: js/core/data/DesktopStore.js
 * 用途: 桌面配置数据访问层（Data Store）。
 *       封装 desktop 对象仓库的读写，提供统一接口给逻辑层 DesktopConfig 使用。
 * 位置: /js/core/data/DesktopStore.js
 * 架构层: 数据层（Data Layer）
 */
export class DesktopStore {
  /**
   * @param {import('./DB.js').DB} db
   */
  constructor(db) {
    this.db = db;
    this.storeName = 'desktop';
    this.recordId = 'desktop-config';
  }

  async getConfig() {
    return this.db.get(this.storeName, this.recordId);
  }

  async saveConfig(config) {
    return this.db.put(this.storeName, {
      id: this.recordId,
      ...config,
      updatedAt: Date.now()
    });
  }

  async resetConfig(defaultConfig) {
    return this.saveConfig(defaultConfig);
  }
}
