/**
 * 文件名: js/utils/Logger.js
 * 用途: 全局日志工具。
 *       - 提供 info / warn / error 三类日志输出
 *       - 错误日志持久化到 IndexedDB（persistentKV 仓库）
 *       - 供"设置"应用中的"报错日志查看"功能读取展示
 * 位置: /js/utils/Logger.js
 * 架构层: 公共工具层（被 Logic / Data / UI 复用）
 */
export class Logger {
  static ALL_LOG_KEY = 'logger::all-logs';
  static ERROR_LOG_KEY = 'logger::error-logs';
  static MAX_LOGS = 200;

  /** @type {import('../core/data/DB.js').DB|null} */
  static _db = null;
  static _writeQueue = [];
  static _flushing = false;

  /**
   * 初始化 Logger，注入 DB 实例
   * @param {import('../core/data/DB.js').DB} db
   */
  static init(db) {
    this._db = db;
  }

  static info(message, payload = null) {
    console.log(`[MiniPhone][INFO] ${message}`, payload ?? '');
    this._enqueue({
      level: 'info',
      message,
      detail: payload == null ? null : this.normalizeError(payload),
      timestamp: Date.now()
    });
  }

  static warn(message, payload = null) {
    console.warn(`[MiniPhone][WARN] ${message}`, payload ?? '');
    this._enqueue({
      level: 'warn',
      message,
      detail: payload == null ? null : this.normalizeError(payload),
      timestamp: Date.now()
    });
  }

  static error(message, error = null) {
    console.error(`[MiniPhone][ERROR] ${message}`, error ?? '');
    const item = {
      level: 'error',
      message,
      detail: this.normalizeError(error),
      timestamp: Date.now()
    };
    this._enqueue(item, true);
  }

  static normalizeError(error) {
    if (!error) return null;
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      };
    }
    if (typeof error === 'object') {
      try {
        return JSON.parse(JSON.stringify(error));
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  /**
   * 将日志项加入写入队列，异步刷盘到 IndexedDB
   */
  static _enqueue(logItem, isError = false) {
    this._writeQueue.push({ logItem, isError });
    this._flush();
  }

  static async _flush() {
    if (this._flushing || !this._db) return;
    this._flushing = true;
    try {
      while (this._writeQueue.length > 0) {
        const batch = this._writeQueue.splice(0, this._writeQueue.length);
        const allItems = batch.map(b => b.logItem);
        const errorItems = batch.filter(b => b.isError).map(b => b.logItem);

        if (allItems.length > 0) {
          await this._appendLogs(this.ALL_LOG_KEY, allItems);
        }
        if (errorItems.length > 0) {
          await this._appendLogs(this.ERROR_LOG_KEY, errorItems);
        }
      }
    } catch (e) {
      console.error('[MiniPhone][Logger] 写入 IndexedDB 失败', e);
    } finally {
      this._flushing = false;
      if (this._writeQueue.length > 0) {
        this._flush();
      }
    }
  }

  static async _appendLogs(key, newItems) {
    if (!this._db) return;
    const storeName = 'persistentKV';
    let existing = [];
    try {
      const record = await this._db.get(storeName, key);
      if (record?.value && Array.isArray(record.value)) {
        existing = record.value;
      }
    } catch { /* ignore */ }

    const merged = [...newItems, ...existing].slice(0, this.MAX_LOGS);
    await this._db.put(storeName, {
      id: key,
      key,
      value: merged,
      updatedAt: Date.now()
    });
  }

  /**
   * 获取全部日志（异步）
   * @returns {Promise<Array>}
   */
  static async getAllLogs() {
    if (!this._db) return [];
    try {
      const record = await this._db.get('persistentKV', this.ALL_LOG_KEY);
      if (record?.value && Array.isArray(record.value)) {
        return record.value;
      }
    } catch { /* ignore */ }
    return [];
  }

  /**
   * 获取错误日志（异步）
   * @returns {Promise<Array>}
   */
  static async getErrorLogs() {
    if (!this._db) return [];
    try {
      const record = await this._db.get('persistentKV', this.ERROR_LOG_KEY);
      if (record?.value && Array.isArray(record.value)) {
        return record.value;
      }
    } catch { /* ignore */ }
    return [];
  }

  static async clearLogs() {
    if (!this._db) return;
    try {
      await this._db.delete('persistentKV', this.ALL_LOG_KEY);
    } catch (e) {
      console.error('[MiniPhone][Logger] 清除全部日志失败', e);
    }
  }

  static async clearErrorLogs() {
    if (!this._db) return;
    try {
      await this._db.delete('persistentKV', this.ERROR_LOG_KEY);
    } catch (e) {
      console.error('[MiniPhone][Logger] 清除错误日志失败', e);
    }
  }
}
