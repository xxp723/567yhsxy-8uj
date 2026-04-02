/**
 * 文件名: js/utils/Logger.js
 * 用途: 全局日志工具。
 *       - 提供 info / warn / error 三类日志输出
 *       - 错误日志持久化到 localStorage（后续可切换 IndexedDB）
 *       - 供“设置”应用中的“报错日志查看”功能读取展示
 * 位置: /js/utils/Logger.js
 * 架构层: 公共工具层（被 Logic / Data / UI 复用）
 */
export class Logger {
  static STORAGE_KEY = 'miniphone:error-logs';
  static MAX_LOGS = 200;

  static info(message, payload = null) {
    console.log(`[MiniPhone][INFO] ${message}`, payload ?? '');
  }

  static warn(message, payload = null) {
    console.warn(`[MiniPhone][WARN] ${message}`, payload ?? '');
  }

  static error(message, error = null) {
    console.error(`[MiniPhone][ERROR] ${message}`, error ?? '');
    this.saveErrorLog({
      level: 'error',
      message,
      detail: this.normalizeError(error),
      timestamp: Date.now()
    });
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

  static saveErrorLog(logItem) {
    try {
      const list = this.getErrorLogs();
      list.unshift(logItem);
      const sliced = list.slice(0, this.MAX_LOGS);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sliced));
    } catch (e) {
      console.error('[MiniPhone][Logger] 保存错误日志失败', e);
    }
  }

  static getErrorLogs() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static clearErrorLogs() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
