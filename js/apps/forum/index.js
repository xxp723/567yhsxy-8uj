/**
 * 文件名: js/apps/forum/index.js
 * 用途: 茶馆（Forum）应用占位模块。
 *       后续可在这里实现帖子列表、分区、主题讨论、收藏与检索等功能。
 * 位置: /js/apps/forum/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>茶馆应用占位页</p>
        <p class="ui-muted">后续将在此处实现茶馆分区、帖子流与互动能力。</p>
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
