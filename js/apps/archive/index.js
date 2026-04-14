/**
 * 文件名: js/apps/archive/index.js
 * 用途: 档案（Archive）应用占位模块，采用民国旧报纸风格。
 *       后续可扩展档案列表、标签、检索、预览等能力。
 * 位置: /js/apps/archive/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
export async function mount(container, context) {
  const { appMeta } = context;

  container.innerHTML = `
    <div class="archive-app">
      <header class="archive-header">
        <div class="archive-title">
          <span class="archive-title-glyph">${appMeta?.icon || '档'}</span>
          <div>
            <div class="archive-title-main">${appMeta?.name || '档案'}</div>
            <div class="archive-title-sub">旧事·存卷</div>
          </div>
        </div>
        <div class="archive-stamp">No.001925</div>
      </header>

      <section class="archive-card">
        <p class="ui-muted">这里是档案应用占位页。</p>
        <p class="ui-muted">后续可在此处实现档案的创建、标签、时间线与全文检索。</p>
      </section>
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
