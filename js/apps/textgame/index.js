/**
 * 文件名: js/apps/textgame/index.js
 * 用途: 梦笺（TextGame）应用占位模块。
 *       后续可在这里实现文字冒险流程、选项分支、状态机和存档系统。
 * 位置: /js/apps/textgame/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>梦笺应用占位页</p>
        <p class="ui-muted">后续将在此处实现文本剧情、分支选择与进度存档。</p>
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
