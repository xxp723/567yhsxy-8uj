/**
 * 文件名: js/apps/settings/index.js
 * 用途: 设置应用（卡片式分类界面）
 *- 首页：4个圆角卡片式分类选项（仿iPhone扁平化）
 *       - 详情页：外观设置、API设置、数据设置、日志
 * 位置: /js/apps/settings/index.js
 * 架构层: 应用层（由AppManager 动态加载）
 */
import { Logger } from '../../utils/Logger.js';

// IconPark SVG 图标定义
const ICONS = {
  appearance: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M24 4V24L39.5 37" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 4C24 4 36.2 8.4 39.5 37" fill="none" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="14" r="3" fill="#F97066"/><circle cx="10" cy="26" r="3" fill="#47B881"/><circle cx="16" cy="36" r="3" fill="#6C6EC7"/><circle cx="30" cy="16" r="3" fill="#FFCB47"/></svg>`,
  api: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M40 12L24 4L8 12V36L24 44L40 36V12Z" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M24 44V24" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 12L24 24" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12L24 24" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 4V14" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  data: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><path d="M42 6H6V20H42V6Z" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M42 28H6V42H42V28Z" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><circle cx="13" cy="13" r="2" fill="#333"/><circle cx="13" cy="35" r="2" fill="#333"/><path d="M21 13H35" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M21 35H35" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M24 20V28" stroke="#333" stroke-width="3" stroke-linecap="round"/></svg>`,
  logs: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="8" y="4" width="32" height="40" rx="2" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M16 16H32" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M16 24H32" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M16 32H24" stroke="#333" stroke-width="3" stroke-linecap="round"/></svg>`,
  ui: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="6" y="6" width="36" height="36" rx="3" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M6 18H42" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M18 18V42" stroke="#333" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="#F97066"/><circle cx="19" cy="12" r="2" fill="#FFCB47"/><circle cx="26" cy="12" r="2" fill="#47B881"/></svg>`,
  wallpaper: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="6" y="6" width="36" height="36" rx="3" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><path d="M6 34L16 24L24 32L32 22L42 34" stroke="#333" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="4" fill="none" stroke="#333" stroke-width="3"/></svg>`,
  icon: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="22" height="22"><rect x="6" y="6" width="14" height="14" rx="4" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="6" width="14" height="14" rx="4" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><rect x="6" y="28" width="14" height="14" rx="4" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/><rect x="28" y="28" width="14" height="14" rx="4" fill="none" stroke="#333" stroke-width="3" stroke-linejoin="round"/></svg>`
};

export async function mount(container, context) {
  const { settings, eventBus, windowManager, appId } = context;
  const current = await settings.getAll();

  // 当前页面状态
  let currentPage = 'home';

  // 创建主容器
  container.innerHTML = `
    <div class="settings-app-container" style="height: 100%; display: flex; flex-direction: column;">
      <!-- 首页 -->
      <div id="settings-home" class="settings-home">
        <div class="settings-cards-grid">
          <div class="settings-card" data-page="appearance">
            <div class="settings-card__icon">${ICONS.appearance}</div>
            <h3 class="settings-card__title">外观设置</h3>
          </div>
          <div class="settings-card" data-page="api">
            <div class="settings-card__icon">${ICONS.api}</div>
            <h3 class="settings-card__title">API设置</h3>
          </div>
          <div class="settings-card" data-page="data">
            <div class="settings-card__icon">${ICONS.data}</div>
            <h3 class="settings-card__title">数据设置</h3>
          </div>
          <div class="settings-card" data-page="logs">
            <div class="settings-card__icon">${ICONS.logs}</div>
            <h3 class="settings-card__title">日志</h3>
          </div>
        </div>
      </div>

      <!-- 外观设置详情页（改为卡片式分类） -->
      <div id="settings-appearance" class="settings-detail">
        <div class="settings-detail__body">
          <div class="settings-cards-grid">
            <div class="settings-card" data-page="appearance-ui">
              <div class="settings-card__icon">${ICONS.ui}</div>
              <h3 class="settings-card__title">界面设置</h3>
            </div>
            <div class="settings-card" data-page="appearance-wallpaper">
              <div class="settings-card__icon">${ICONS.wallpaper}</div>
              <h3 class="settings-card__title">壁纸设置</h3>
            </div>
            <div class="settings-card" data-page="appearance-icon">
              <div class="settings-card__icon">${ICONS.icon}</div>
              <h3 class="settings-card__title">图标设置</h3>
            </div>
            <div class="settings-card" data-page="appearance-widget">
              <div class="settings-card__icon">${ICONS.ui}</div>
              <h3 class="settings-card__title">组件设置</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- 组件设置子页面 -->
      <div id="settings-appearance-widget" class="settings-detail">
        <div class="settings-detail__body">
          <div class="settings-cards-grid">
            <div class="settings-card" data-page="widget-library">
              <div class="settings-card__icon">${ICONS.ui}</div>
              <h3 class="settings-card__title">组件库</h3>
            </div>
            <div class="settings-card" data-page="widget-custom">
              <div class="settings-card__icon">${ICONS.logs}</div>
              <h3 class="settings-card__title">自定义组件</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- 组件库详情页 -->
      <div id="settings-widget-library" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>组件库</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">从开源社区添加匹配手机UI风格的组件</p>
            <div id="library-items-container" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
               <!-- 组件列表将由 JS 动态渲染 -->
            </div>
          </section>
        </div>
      </div>

      <!-- 自定义组件详情页 -->
      <div id="settings-widget-custom" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <h3>自定义区域</h3>
              <div style="display:flex;gap:8px;">
                <button class="icon-btn-modern" id="import-widget-code" title="导入组件代码">↓</button>
                <button class="icon-btn-modern" id="export-widget-code" title="导出组件代码">↑</button>
              </div>
            </div>
            <p class="ui-muted" style="margin-bottom: 10px;">上传 CSS 代码实现自定义新式组件</p>
            <textarea id="custom-widget-css" style="width:100%;height:150px;font-family:monospace;font-size:12px;padding:8px;border-radius:8px;border:1px solid #ddd;resize:none;" placeholder="/* 在此输入 CSS 代码 */"></textarea>
            
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px;">
              <span style="font-size: 13px;">预览新增自定义组件代码</span>
              <label class="toggle-switch">
                <input id="setting-widget-preview-toggle" type="checkbox">
                <span class="toggle-slider"></span>
              </label>
            </div>
            
            <div id="widget-preview-area" style="display:none;margin-top:15px;padding:10px;background:#fff;border-radius:12px;min-height:80px;border:1px dashed #ccc;overflow:hidden;">
               <div id="custom-preview-content">预览内容</div>
            </div>

            <button class="ui-button primary" id="add-custom-widget-btn" style="width: 100%; margin-top: 15px;">添加到组件库</button>
          </section>
        </div>
      </div>

      <!-- 界面设置子页面 -->
      <div id="settings-appearance-ui" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>顶部状态栏显示</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">控制顶部状态栏是否显示</p>
            <label style="display:flex;align-items:center;justify-content:space-between;font-size:13px;">
              <span>显示顶部状态栏</span>
              <label class="toggle-switch">
                <input id="setting-status-bar" type="checkbox" ${localStorage.getItem('miniphone_status_bar_hidden') === '1' ? '' : 'checked'}>
                <span class="toggle-slider"></span>
              </label>
            </label>
          </section><section class="ui-card">
            <h3>全屏显示</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">去除小手机外框限制，以全屏模式显示</p>
            <label style="display:flex;align-items:center;justify-content:space-between;font-size:13px;">
              <span>启用全屏显示模式</span>
              <label class="toggle-switch">
                <input id="setting-fullscreen" type="checkbox" ${localStorage.getItem('miniphone_fullscreen') === '1' ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </label>
          </section>
          <button class="ui-button primary" id="save-ui-settings" style="width: 100%; margin-top: 10px;">保存界面设置</button>
        </div>
      </div>

      <!-- 壁纸设置子页面 -->
      <div id="settings-appearance-wallpaper" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>壁纸设置</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">自定义桌面壁纸（功能开发中）</p>
            <div style="text-align:center;color:#B2967D;padding:30px 0;font-size:13px;">暂未开放，敬请期待</div>
          </section>
        </div>
      </div>

      <!-- 图标设置子页面 -->
      <div id="settings-appearance-icon" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>图标大小</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">调整桌面图标尺寸</p>
            <label style="display:flex;align-items:center;gap:10px;font-size:13px;">
              <span style="min-width:70px;">图标大小:</span>
              <input id="setting-icon-size" type="number" min="40" max="96" value="${current.appearance?.iconSize || 56}" style="flex:1;">
            </label></section>
          <button class="ui-button primary" id="save-icon-settings" style="width: 100%; margin-top: 10px;">保存图标设置</button>
        </div>
      </div>

      <!-- API设置详情页 -->
      <div id="settings-api" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>生图API</h3>
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
        <div class="settings-detail__body">
          <section class="ui-card">
            <h3>数据导入/ 导出</h3>
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
    </div>
  `;

  // 页面导航函数
  const navigateTo = (page) => {
    const pages = {
      'home': '设置',
      'appearance': '外观设置',
      'appearance-ui': '界面设置',
      'appearance-wallpaper': '壁纸设置',
      'appearance-icon': '图标设置',
      'appearance-widget': '组件设置',
      'widget-library': '组件库',
      'widget-custom': '自定义组件',
      'api': 'API设置',
      'data': '数据设置',
      'logs': '日志'
    };

    // 确定返回目标
    const backTargets = {
      'appearance': 'home',
      'appearance-ui': 'appearance',
      'appearance-wallpaper': 'appearance',
      'appearance-icon': 'appearance',
      'appearance-widget': 'appearance',
      'widget-library': 'appearance-widget',
      'widget-custom': 'appearance-widget',
      'api': 'home',
      'data': 'home',
      'logs': 'home'
    };

    Object.keys(pages).forEach(p => {
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

    if (windowManager) {
      windowManager.setTitle(appId, pages[page]);
      windowManager.setBackAction(appId, page === 'home' ? null : () => navigateTo(backTargets[page]));
    }

    currentPage = page;
  };

  // 卡片点击事件（首页 + 外观设置子页面）
  container.querySelectorAll('.settings-card').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      navigateTo(page);
    });
  });

  // ========== 组件设置相关逻辑 ==========
  
  // 渲染组件库列表
  const renderWidgetLibrary = () => {
    const listEl = container.querySelector('#library-items-container');
    if (!listEl) return;
    
    // 5个现有组件 + 6个新组件（音乐等，仿手机风格）
    const widgets = [
      { id: 'clock', name: '时钟', desc: '显示当前时间' },
      { id: 'avatar', name: '头像', desc: '显示个人头像' },
      { id: 'news', name: '报纸', desc: '民国日报组件' },
      { id: 'ticket1', name: '船票', desc: '长江航运船票' },
      { id: 'ticket2', name: '戏票', desc: '浮生剧院戏票' },
      { id: 'music', name: '音乐', desc: '复古唱片机风格' },
      { id: 'weather', name: '天气', desc: '水墨风天气预报' },
      { id: 'calendar', name: '日历', desc: '老黄历样式' },
      { id: 'notes', name: '便签', desc: '信纸样式的便签' },
      { id: 'photos', name: '相册', desc: '复古相框展示' },
      { id: 'radio', name: '收音机', desc: '老式收音机电台' }
    ];

    listEl.innerHTML = widgets.map(w => `
      <div class="widget-library-item" style="border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;background:#fff;">
        <div style="font-weight:bold;margin-bottom:5px;">${w.name}</div>
        <div style="font-size:10px;color:#666;margin-bottom:10px;">${w.desc}</div>
        <button class="ui-button" style="padding:4px 8px;font-size:12px;" data-add-widget="${w.id}">添加</button>
      </div>
    `).join('');

    // 绑定添加事件
    listEl.querySelectorAll('[data-add-widget]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-add-widget');
        // 调用 eventBus 通知桌面添加组件
        eventBus?.emit('desktop:add-widget', { type });
        Logger.info(`已添加组件: ${type}`);
      });
    });
  };

  // 自定义组件预览切换
  const previewToggle = container.querySelector('#setting-widget-preview-toggle');
  const previewArea = container.querySelector('#widget-preview-area');
  const cssTextarea = container.querySelector('#custom-widget-css');
  const previewContent = container.querySelector('#custom-preview-content');

  if (previewToggle) {
    previewToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        previewArea.style.display = 'block';
        // 简单将 CSS 注入到一个 style 标签中并展示预览
        let styleEl = document.getElementById('custom-widget-preview-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-widget-preview-style';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = cssTextarea.value;
        
        // 渲染一个测试用的 div
        previewContent.innerHTML = `<div class="custom-widget">自定义组件预览</div>`;
      } else {
        previewArea.style.display = 'none';
      }
    });
  }

  // 监听 CSS 改变时如果正在预览则实时更新
  if (cssTextarea) {
    cssTextarea.addEventListener('input', () => {
      if (previewToggle && previewToggle.checked) {
        const styleEl = document.getElementById('custom-widget-preview-style');
        if (styleEl) styleEl.textContent = cssTextarea.value;
      }
    });
  }

  // 导入本地 CSS
  const importCodeBtn = container.querySelector('#import-widget-code');
  
  // 处理导入逻辑
  const handleImportCode = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.css,.txt';
    input.onchange = e => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          if (cssTextarea) cssTextarea.value = ev.target.result;
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (importCodeBtn) {
    importCodeBtn.addEventListener('click', handleImportCode);
  }

  // 导出 CSS 到本地
  const exportCodeBtn = container.querySelector('#export-widget-code');

  // 处理导出逻辑
  const handleExportCode = () => {
    const cssContent = cssTextarea ? cssTextarea.value : '';
    if (!cssContent) {
      alert('没有代码可导出');
      return;
    }
    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom-widget-${Date.now()}.css`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (exportCodeBtn) {
    exportCodeBtn.addEventListener('click', handleExportCode);
  }

  // 监听来自 window 层的全局自定义动作按钮事件
  // (Window.js 中增加的按钮暂不支持直接绑定事件，可通过给 document 绑定委托来处理)
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.app-window__custom-actions .import-btn');
    if (target && currentPage === 'widget-custom') {
      handleImportCode();
    }
    const targetExp = e.target.closest('.app-window__custom-actions .export-btn');
    if (targetExp && currentPage === 'widget-custom') {
      handleExportCode();
    }
  });

  // 添加自定义组件到库/桌面
  const addCustomWidgetBtn = container.querySelector('#add-custom-widget-btn');
  if (addCustomWidgetBtn) {
    addCustomWidgetBtn.addEventListener('click', () => {
      const cssContent = cssTextarea ? cssTextarea.value : '';
      if (!cssContent.trim()) {
        alert('代码不能为空');
        return;
      }
      // 此处将自定义 CSS 存储到 config，并通知添加
      eventBus?.emit('desktop:add-custom-widget', { css: cssContent });
      Logger.info('自定义组件添加成功');
      alert('自定义组件已添加到桌面/配置中');
    });
  }

  // 初始化组件库
  renderWidgetLibrary();


  // 界面设置保存（状态栏 + 全屏）
  const onSaveUiSettings = async () => {
    const statusBarChecked = container.querySelector('#setting-status-bar')?.checked;
    const fullscreenChecked = container.querySelector('#setting-fullscreen')?.checked;

    // 状态栏显示控制
    if (statusBarChecked) {
      localStorage.removeItem('miniphone_status_bar_hidden');
      document.body.classList.remove('hide-status-bar');
    } else {
      localStorage.setItem('miniphone_status_bar_hidden', '1');
      document.body.classList.add('hide-status-bar');
    }

    // 全屏显示控制
    if (fullscreenChecked) {
      localStorage.setItem('miniphone_fullscreen', '1');
      document.body.classList.add('fullscreen-mode');
    } else {
      localStorage.removeItem('miniphone_fullscreen');
      document.body.classList.remove('fullscreen-mode');
    }

    Logger.info('界面设置已保存');
  };

  // 图标设置保存
  const onSaveIconSettings = async () => {
    const iconSize = Number(container.querySelector('#setting-icon-size')?.value || 56);

    await settings.update({
      appearance: {
        ...(current.appearance || {}),
        iconSize
      }
    });

    eventBus?.emit('settings:appearance-changed', { iconSize });
    Logger.info('图标设置已保存');
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
    URL.revokeObjectURL(url);};

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
      logEl.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">\u6682\u65E0\u76F8\u5173\u65E5\u5FD7</div>';
      return;
    }
    
    logEl.innerHTML = filteredLogs
      .reverse()
      .slice(0, 100)
      .map((item) => {
        const color = item.level === 'error' ? 'red' : (item.level === 'warn' ? 'orange' : 'inherit');
        return `<div style="margin-bottom:6px;color:${color};border-bottom:1px dashed #ccc;padding-bottom:4px;">
          [${item.level.toUpperCase()}] ${new Date(item.timestamp).toLocaleString()} <br>
          ${item.message}${item.details ? `<pre style="margin:2px 0 0;white-space:pre-wrap;font-size:10px;background:#eee;padding:2px;">${JSON.stringify(item.details)}</pre>` : ''}
        </div>`;
      })
      .join('');
  };

  // 绑定事件
  container.querySelector('#save-ui-settings')?.addEventListener('click', onSaveUiSettings);
  container.querySelector('#save-icon-settings')?.addEventListener('click', onSaveIconSettings);
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
