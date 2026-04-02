/**
 * 文件名: js/core/interaction/EventBus.js
 * 用途: 全局事件总线（发布/订阅模式）。
 *       负责模块间通信，避免模块直接耦合：
 *       - Desktop 点击图标后发布 app:open
 *       - AppManager 监听 app:open 并打开应用
 *       - GlobalMemory 更新后发布 memory:updated
 *       - 设置变更发布 settings:changed 等
 * 位置: /js/core/interaction/EventBus.js
 * 架构层: 交互层（Interaction Layer）
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * 订阅事件
   * @param {string} eventName
   * @param {(payload:any)=>void} handler
   * @returns {() => void} 取消订阅函数
   */
  on(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);

    return () => {
      this.off(eventName, handler);
    };
  }

  /**
   * 取消订阅
   * @param {string} eventName
   * @param {(payload:any)=>void} handler
   */
  off(eventName, handler) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  /**
   * 发布事件
   * @param {string} eventName
   * @param {any} payload
   */
  emit(eventName, payload = undefined) {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        // 避免单个监听函数异常导致总线中断
        console.error(`[EventBus] 事件处理失败: ${eventName}`, error);
      }
    });
  }

  /**
   * 仅监听一次
   * @param {string} eventName
   * @param {(payload:any)=>void} handler
   */
  once(eventName, handler) {
    const off = this.on(eventName, (payload) => {
      off();
      handler(payload);
    });
  }

  /**
   * 清空所有事件监听
   */
  clear() {
    this.listeners.clear();
  }
}
