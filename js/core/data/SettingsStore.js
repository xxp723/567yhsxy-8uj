/**
 * 文件名: js/core/data/SettingsStore.js
 * 用途: 全局设置数据访问层（Data Store）。
 *       基于项目 DB.js（IndexedDB）负责 settings 对象仓库的读写，供逻辑层 Settings 与设置应用使用。
 *       覆盖范围包括：外观设置、设置应用新版 API 配置、功能开关与设置应用扩展字段。
 * 位置: /js/core/data/SettingsStore.js
 * 架构层: 数据层（Data Layer）
 */
export class SettingsStore {
  /**
   * @param {import('./DB.js').DB} db
   */
  constructor(db) {
    this.db = db;
    this.storeName = 'settings';
    this.recordId = 'global-settings';
  }

  async getSettings() {
    return this.db.get(this.storeName, this.recordId);
  }

  async saveSettings(settings) {
    return this.db.put(this.storeName, {
      id: this.recordId,
      ...settings,
      updatedAt: Date.now()
    });
  }

  async patchSettings(partial) {
    const current = (await this.getSettings()) || { id: this.recordId };
    return this.saveSettings({
      ...current,
      ...partial
    });
  }
}
