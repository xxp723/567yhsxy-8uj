/**
 * 文件名: js/core/logic/Registry.js
 * 用途: 应用注册表。
 *       维护所有可用应用的元数据（id, name, icon, entry）。
 *       AppManager 通过 Registry 查询应用入口路径并动态加载。
 * 位置: /js/core/logic/Registry.js
 * 架构层: 逻辑层（Logic Layer）
 */
export class Registry {
  constructor() {
    /** @type {Map<string, {id:string,name:string,icon:string,entry:string}>} */
    this.apps = new Map();
  }

  async initDefaults() {
    const defaultApps = [
      { id: 'settings', name: '设置', icon: '设', entry: '/js/apps/settings/index.js' },
      { id: 'chat', name: '闲谈', icon: '闲', entry: '/js/apps/chat/index.js' },
      { id: 'archive', name: '档案', icon: '档', entry: '/js/apps/archive/index.js' },
      { id: 'memory', name: '旧事', icon: '旧', entry: '/js/apps/memory/index.js' },
      { id: 'forum', name: '茶馆', icon: '茶', entry: '/js/apps/forum/index.js' },
      { id: 'worldbook', name: '世情', icon: '世', entry: '/js/apps/worldbook/index.js' },
      { id: 'reader', name: '观书', icon: '书', entry: '/js/apps/reader/index.js' },
      { id: 'doujin', name: '戏笔', icon: '戏', entry: '/js/apps/doujin/index.js' },
      { id: 'textgame', name: '梦笺', icon: '梦', entry: '/js/apps/textgame/index.js' },
      { id: 'game', name: '游戏', icon: '游', entry: '/js/apps/game/index.js' }
    ];

    defaultApps.forEach((app) => this.register(app));
  }

  register(appMeta) {
    this.apps.set(appMeta.id, appMeta);
    return appMeta;
  }

  unregister(appId) {
    this.apps.delete(appId);
  }

  get(appId) {
    return this.apps.get(appId) || null;
  }

  getAll() {
    return Array.from(this.apps.values());
  }

  has(appId) {
    return this.apps.has(appId);
  }
}
