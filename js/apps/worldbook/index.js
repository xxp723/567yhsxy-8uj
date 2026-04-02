/**
 * 文件名: js/apps/worldbook/index.js
 * 用途: 世情（WorldBook）应用占位模块。
 *       后续可在这里实现世界观设定、词条管理、关系图谱与引用联动等功能。
 * 位置: /js/apps/worldbook/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>世情应用占位页</p>
        <p class="ui-muted">后续将在此处实现设定词条、关系网络与内容引用。</p>
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
