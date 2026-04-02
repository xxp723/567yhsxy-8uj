/**
 * 文件名: js/core/logic/GlobalMemory.js
 * 用途: 跨应用记忆管理器。
 *       提供 set/get/delete/list 接口给各应用共享“长期记忆”。
 *       数据持久化到 MemoryStore（IndexedDB），并通过 EventBus 广播变更事件。
 * 位置: /js/core/logic/GlobalMemory.js
 * 架构层: 逻辑层（Logic Layer）
 */
import { MemoryStore } from '../data/MemoryStore.js';
import { Logger } from '../../utils/Logger.js';

export class GlobalMemory {
  /**
   * @param {import('../data/DB.js').DB} db
   * @param {import('../interaction/EventBus.js').EventBus} eventBus
   */
  constructor(db, eventBus) {
    this.store = new MemoryStore(db);
    this.eventBus = eventBus;
  }

  async init() {
    // 预留初始化逻辑，目前无额外动作
    return true;
  }

  async set(key, value, sourceApp = 'unknown') {
    try {
      const record = await this.store.setMemory(key, value, sourceApp);
      this.eventBus.emit('memory:updated', { key, value, sourceApp, record });
      return record;
    } catch (error) {
      Logger.error('GlobalMemory set 失败', error);
      throw error;
    }
  }

  async get(key) {
    const record = await this.store.getMemory(key);
    return record ? record.value : null;
  }

  async getRecord(key) {
    return this.store.getMemory(key);
  }

  async delete(key) {
    await this.store.deleteMemory(key);
    this.eventBus.emit('memory:deleted', { key });
    return true;
  }

  async list() {
    return this.store.getAllMemories();
  }

  async clear() {
    await this.store.clearAll();
    this.eventBus.emit('memory:cleared', {});
    return true;
  }
}
