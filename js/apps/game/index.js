/**
 * 文件名: js/apps/game/index.js
 * 用途: 游戏（Game）应用占位模块。
 *       后续可在这里实现小游戏入口、资源管理、分数系统和本地存档等功能。
 * 位置: /js/apps/game/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>游戏应用占位页</p>
        <p class="ui-muted">后续将在此处实现小游戏集合与数据存档。</p>
      </div>
    </div>
  `;

  return {
    destroy() {}
  };
}

export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}
