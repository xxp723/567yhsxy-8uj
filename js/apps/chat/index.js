/**
 * 文件名: js/apps/chat/index.js
 * 用途: 闲谈（Chat）应用占位模块。
 *       后续可在这里实现会话列表、消息流、角色卡、上下文拼接等聊天功能。
 * 位置: /js/apps/chat/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div>
      <h2 style="margin-top:0;">${appMeta.icon} ${appMeta.name}</h2>
      <div class="ui-card">
        <p>闲谈应用占位页</p>
        <p class="ui-muted">后续将在此处实现聊天会话、输入框、消息渲染和记忆联动。</p>
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
