/**
 * 文件名: js/apps/memory/index.js
 * 用途: 旧事（Memory）应用占位模块。
 *       后续可在这里实现记忆条目管理、检索、编辑、来源追踪等功能。
 * 位置: /js/apps/memory/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>旧事应用占位页</p>
        <p class="ui-muted">后续将在此处实现跨应用旧事记忆浏览、检索与管理。</p>
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
