/**
 * 文件名: js/apps/settings/index.js
 * 用途: 设置应用（卡片式分类界面）
 *       - 首页：4个圆角卡片式分类选项
 *       - 详情页：外观设置、API设置、数据设置、日志
 *       - 底部TAB栏：返回桌面功能
 * 位置: /js/apps/settings/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
import { Logger } from '../../utils/Logger.js';

export async function mount(container, context) {
  const { settings, eventBus } = context;
  const current = await settings.getAll();

  // 当前页面状态
  let currentPage = 'home';

  // 创建主容器
  container.innerHTML = `
    <div class="settings-app-container" style="height: 100%; display: flex; flex-direction: column;">
      <!-- 首页 -->
      <div id="settings-home" class="settings-home">
        <h2 class="settings-home__title">设置</h2>
        <div class="settings-cards-grid">
          <div class="settings-card" data-page="appearance">
            <div class="settings-card__icon">🎨</div>
            <h3 class="settings-card__title">外观设置</h3>
            <p class="settings-card__desc">壁纸、主题色、图标大小</p>
          </div>
          <div class="settings-card" data-page="api">
            <div class="settings-card__icon">🔌</div>
            <h3 class="settings-card__title">API设置</h3>
            <p class="settings-card__desc">生图与TTS接口配置</p>
          </div>
          <div class="settings-card" data-page="data">
            <div class="settings-card__icon">💾</div>
            <h3 class="settings-card__title">数据设置</h3>
            <p class="settings-card__desc">导入导出本地数据</p>
          </div>
          <div class="settings-card" data-page="logs">
            <div class="settings-card__icon">📋</div>
            <h3 class="settings-card__title">日志</h3>
            <p class="settings-card__desc">查看系统运行日志</p>
          </div>
        </div>
      </div>

      <!-- 外观设置详情页 -->
      <div id="settings-appearance" class="settings-detail">
        <div class="settings-detail__header">
          <button class="settings-detail__back">←</button>
          <h3 class="settings-detail__title">外观设置</h3>
        </div>
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>主题色</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">控制桌面主题色调</p>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;">
              <span style="min-width:70px;">主题色:</span>
              <input id="setting-theme-color" type="color" value="${current.appearance?.themeColor || '#4f46e5'}">
            </label>
          </section>
          <section class="ui-card">
            <h3>图标大小</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">调整桌面图标尺寸</p>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;">
              <span style="min-width:70px;">图标大小:</span>
              <input id="setting-icon-size" type="number" min="40" max="96" value="${current.appearance?.iconSize || 56}" style="flex:1;">
            </label>
          </section>
          <button class="ui-button primary" id="save-appearance" style="width: 100%; margin-top: 10px;">保存外观设置</button>
        </div>
      </div>

      <!-- API设置详情页 -->
      <div id="settings-api" class="settings-detail">
        <div class="settings-detail__header">
          <button class="settings-detail__back">←</button>
          <h3 class="settings-detail__title">API设置</h3>
        </div>
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>生图 API</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">配置文生图接口</p>
            <div style="display:grid;gap:10px;">
              <input id="api-image-url" type="text" placeholder="生图 API Base URL" value="${current.api?.textToImage?.baseUrl || ''}">
              <input id="api-image-key" type="text" placeholder="生图 API Key" value="${current.api?.textToImage?.apiKey || ''}">
            </div>
          </section>
          <section class="ui-card">
            <h3>MiniMax TTS</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">配置语音合成接口</p>
            <div style="display:grid;gap:10px;">
              <input id="api-tts-url" type="text" placeholder="MiniMax TTS Base URL" value="${current.api?.minimaxTTS?.baseUrl || ''}">
              <input id="api-tts-key" type="text" placeholder="MiniMax TTS API Key" value="${current.api?.minimaxTTS?.apiKey || ''}">
            </div>
          </section>
          <button class="ui-button primary" id="save-api" style="width: 100%; margin-top: 10px;">保存 API 设置</button>
        </div>
      </div>

      <!-- 数据设置详情页 -->
      <div id="settings-data" class="settings-detail">
        <div class="settings-detail__header">
          <button class="settings-detail__back">←</button>
          <h3 class="settings-detail__title">数据设置</h3>
        </div>
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>数据导入 / 导出</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">导出或导入小手机本地数据（桌面配置、设置、记忆、应用数据、日志）</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="ui-button" id="export-data">导出数据(JSON)</button>
              <label class="ui-button" style="cursor:pointer;">
                导入数据(JSON)
                <input id="import-file" type="file" accept=".json,application/json" style="display:none;">
              </label>
            </div>
          </section>
        </div>
      </div>

      <!-- 日志详情页 -->
      <div id="settings-logs" class="settings-detail">
        <div class="settings-detail__header">
          <button class="settings-detail__back">←</button>
          <h3 class="settings-detail__title">日志</h3>
        </div>
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>系统日志</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">查看系统运行时的所有日志内容</p>
            <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
              <button class="ui-button" id="view-all-logs">查看全部日志</button>
              <button class="ui-button" id="view-error-logs">查看错误日志</button>
            </div>
            <div id="log-viewer-area" style="max-height:400px;overflow-y:auto;background:var(--c-white-rice);border:1px solid var(--c-gray-light);border-radius:10px;padding:12px;font-size:12px;display:none;"></div>
          </section>
        </div>
      </div>

      <!-- 底部TAB栏 -->
      <div id="settings-tab-bar" class="settings-tab-bar hidden">
        <button class="settings-tab-bar__btn" id="back-to-desktop">
          <div class="settings-tab-bar__icon">🏠</div>
          <span class="settings-tab-bar__label">返回桌面</span>
        </button>
      </div>
    </div>
  `;

  // 页面导航函数
  const navigateTo = (page) => {
    const pages = ['home', 'appearance', 'api', 'data', 'logs'];
    pages.forEach(p => {
      const el = container.querySelector(`#settings-${p}`);
      if (el) {
        if (p === page) {
          el.classList.add('is-active');
          el.style.display = p === 'home' ? 'block' : 'flex';
        } else {
          el.classList.remove('is-active');
          el.style.display = 'none';
        }
      }
    });

    currentPage = page;

    // 控制TAB栏显示
    const tabBar = container.querySelector('#settings-tab-bar');
    if (page === 'home') {
      tabBar?.classList.add('hidden');
    } else {
      tabBar?.classList.remove('hidden');
    }
  };

  // 卡片点击事件
  container.querySelectorAll('.settings-card').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      navigateTo(page);
    });
  });

  // 返回按钮事件
  container.querySelectorAll('.settings-detail__back').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo('home');
    });
  });

  // 返回桌面按钮
  container.querySelector('#back-to-desktop')?.addEventListener('click', () => {
    // 触发关闭窗口事件
    const closeBtn = container.closest('.app-window')?.querySelector('.app-window__close');
    if (closeBtn) {
      closeBtn.click();
    }
  });

  // 外观设置保存
  const onSaveAppearance = async () => {
    const themeColor = container.querySelector('#setting-theme-color')?.value || '#4f46e5';
    const iconSize = Number(container.querySelector('#setting-icon-size')?.value || 56);

    await settings.update({
      appearance: {
        ...(current.appearance || {}),
        themeColor,
        iconSize
      }
    });

    eventBus?.emit('settings:appearance-changed', { themeColor, iconSize });
    Logger.info('外观设置已保存');
  };

  // API设置保存
  const onSaveApi = async () => {
    const imageUrl = container.querySelector('#api-image-url')?.value || '';
    const imageKey = container.querySelector('#api-image-key')?.value || '';
    const ttsUrl = container.querySelector('#api-tts-url')?.value || '';
    const ttsKey = container.querySelector('#api-tts-key')?.value || '';

    await settings.update({
      api: {
        textToImage: { baseUrl: imageUrl, apiKey: imageKey },
        minimaxTTS: { baseUrl: ttsUrl, apiKey: ttsKey, voiceId: '' }
      }
    });

    Logger.info('API 设置已保存');
  };

  // 数据导出
  const onExport = async () => {
    const backup = await settings.exportAllData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miniphone-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 数据导入
  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const backup = JSON.parse(text);
    await settings.importAllData(backup, { overwrite: true });
    Logger.info('导入成功，请返回桌面查看最新状态');
  };

  // 日志渲染
  const renderLogs = (type) => {
    const logEl = container.querySelector('#log-viewer-area');
    if (!logEl) return;
    
    logEl.style.display = 'block';
    
    const logs = localStorage.getItem('miniphone_sys_logs') || '[]';
    let parsedLogs = [];
    try {
      parsedLogs = JSON.parse(logs);
    } catch(e) {}
    
    let filteredLogs = parsedLogs;
    if (type === 'error') {
      filteredLogs = parsedLogs.filter(l => l.level === 'error');
    }
    
    if (!filteredLogs.length) {
      logEl.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">暂无相关日志</div>';
      return;
    }
    
    logEl.innerHTML = filteredLogs
      .reverse()
      .slice(0, 100)
      .map((item) => {
        const color = item.level === 'error' ? 'red' : (item.level === 'warn' ? 'orange' : 'inherit');
        return `<div style="margin-bottom:6px;color:${color};border-bottom:1px dashed #ccc;padding-bottom:4px;">
          [${item.level.toUpperCase()}] ${new Date(item.timestamp).toLocaleString()} <br>
          ${item.message}
          ${item.details ? `<pre style="margin:2px 0 0;white-space:pre-wrap;font-size:10px;background:#eee;padding:2px;">${JSON.stringify(item.details)}</pre>` : ''}
        </div>`;
      })
      .join('');
  };

  // 绑定事件
  container.querySelector('#save-appearance')?.addEventListener('click', onSaveAppearance);
  container.querySelector('#save-api')?.addEventListener('click', onSaveApi);
  container.querySelector('#export-data')?.addEventListener('click', onExport);
  container.querySelector('#import-file')?.addEventListener('change', onImport);
  container.querySelector('#view-all-logs')?.addEventListener('click', () => renderLogs('all'));
  container.querySelector('#view-error-logs')?.addEventListener('click', () => renderLogs('error'));

  // 初始化显示首页
  navigateTo('home');

  return {
    destroy() {
      // 清理资源
    }
  };
}

export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}
