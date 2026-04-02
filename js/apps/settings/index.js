/**
 * 文件名: js/apps/settings/index.js
 * 用途: 设置应用（占位 + 功能入口）。
 *       当前提供：
 *       - 外观设置（壁纸、主题色、图标大小）
 *       - 数据导入 / 导出
 *       - API 设置（生图 / MiniMax TTS）
 *       - 错误日志查看
 *       后续可在此文件内继续细化每个分区的真实业务逻辑。
 * 位置: /js/apps/settings/index.js
 * 架构层: 应用层（由 AppManager 动态加载）
 */
import { Logger } from '../../utils/Logger.js';

function createSection(title, desc, bodyHTML) {
  return `
    <section class="ui-card" style="margin-bottom: 10px;">
      <h3 style="margin: 0 0 6px;">${title}</h3>
      <p class="ui-muted" style="margin: 0 0 8px;">${desc}</p>
      ${bodyHTML}
    </section>
  `;
}

export async function mount(container, context) {
  const { settings, eventBus } = context;
  const current = await settings.getAll();

  container.innerHTML = `
    <div>
      <h2 style="margin-top: 0;">⚙️ 设置</h2>
      ${createSection(
        '外观设置',
        '控制桌面壁纸、主题色、图标大小。',
        `
          <div style="display:grid;gap:8px;">
            <label>主题色: <input id="setting-theme-color" type="color" value="${current.appearance?.themeColor || '#4f46e5'}"></label>
            <label>图标大小: <input id="setting-icon-size" type="number" min="40" max="96" value="${current.appearance?.iconSize || 56}"></label>
            <button class="ui-button" id="save-appearance">保存外观</button>
          </div>
        `
      )}
      ${createSection(
        '数据导入 / 导出',
        '导出或导入小手机本地数据（桌面配置、设置、记忆、应用数据、日志）。',
        `
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="ui-button" id="export-data">导出数据(JSON)</button>
            <label class="ui-button" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
              导入数据(JSON)
              <input id="import-file" type="file" accept=".json,application/json" style="display:none;">
            </label>
          </div>
        `
      )}
      ${createSection(
        'API 设置',
        '管理生图 API 和 MiniMax TTS 的 Base URL / Key。',
        `
          <div style="display:grid;gap:6px;">
            <input id="api-image-url" placeholder="生图 API Base URL" value="${current.api?.textToImage?.baseUrl || ''}">
            <input id="api-image-key" placeholder="生图 API Key" value="${current.api?.textToImage?.apiKey || ''}">
            <input id="api-tts-url" placeholder="MiniMax TTS Base URL" value="${current.api?.minimaxTTS?.baseUrl || ''}">
            <input id="api-tts-key" placeholder="MiniMax TTS API Key" value="${current.api?.minimaxTTS?.apiKey || ''}">
            <button class="ui-button" id="save-api">保存 API 设置</button>
          </div>
        `
      )}
      ${createSection(
        '错误日志',
        '查看 Logger 记录的最近错误日志。',
        `
          <div id="error-log-list" class="ui-muted">暂无错误日志</div>
        `
      )}
    </div>
  `;

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

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const backup = JSON.parse(text);
    await settings.importAllData(backup, { overwrite: true });
    Logger.info('导入成功，请返回桌面查看最新状态');
  };

  const renderLogs = () => {
    const logEl = container.querySelector('#error-log-list');
    if (!logEl) return;
    const logs = Logger.getErrorLogs();
    if (!logs.length) {
      logEl.innerHTML = '暂无错误日志';
      return;
    }
    logEl.innerHTML = logs
      .slice(0, 20)
      .map((item) => `<div style="margin-bottom:6px;">• ${new Date(item.timestamp).toLocaleString()} - ${item.message}</div>`)
      .join('');
  };

  container.querySelector('#save-appearance')?.addEventListener('click', onSaveAppearance);
  container.querySelector('#save-api')?.addEventListener('click', onSaveApi);
  container.querySelector('#export-data')?.addEventListener('click', onExport);
  container.querySelector('#import-file')?.addEventListener('change', onImport);

  renderLogs();

  return {
    destroy() {
      // 当前占位实现无额外资源需要释放
    }
  };
}

export async function unmount(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}
