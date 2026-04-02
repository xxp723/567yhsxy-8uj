/**
 * 文件名: js/apps/doujin/index.js
 * 用途: 戏笔（Doujin）应用占位模块。
 *       后续可在这里实现作品管理、画廊浏览、标签筛选和创作记录等功能。
 * 位置: /js/apps/doujin/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>戏笔应用占位页</p>
        <p class="ui-muted">后续将在此处实现戏笔作品管理、分类与展示。</p>
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
