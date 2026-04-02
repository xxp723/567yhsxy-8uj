/**
 * 文件名: js/core/data/SettingsStore.js
 * 用途: 全局设置数据访问层（Data Store）。
 *       负责 settings 对象仓库的读写，供逻辑层 Settings 使用。
 *       覆盖范围包括：外观设置、API设置、语音/生图配置等。
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
