import { Logger } from '../../utils/Logger.js';

export function renderDataSection() {
  return `
      <!-- 数据设置详情页 -->
      <div id="settings-data" class="settings-detail">
        <div class="settings-detail__body">
          <section class="ui-card">
            <!-- =====================================================================
                 [修改标注·已完成·本次数据设置全量导入导出与清空界面]
                 说明：这里是“设置 > 数据设置”的全量备份与清空入口，只使用 DB.js / IndexedDB。
                 不使用 localStorage/sessionStorage，不使用原生浏览器弹窗，导入或清空成功后会刷新页面。
                 ===================================================================== -->
            <h3>数据导入/导出</h3>
            <p class="ui-muted" style="margin-bottom: 10px;">全量导出或导入小手机网页内的 IndexedDB 数据（桌面布置、设置、记忆、闲谈联系人、聊天列表、聊天记录、档案、世界书与全部应用数据）。以后新应用只要写入 DB.js 管理的 IndexedDB，也会自动进入全量备份。</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:18px 0 12px;">
              <button class="ui-button" id="export-data" type="button">导出全量数据(JSON)</button>
              <label class="ui-button" style="cursor:pointer;">
                导入全量数据(JSON)
                <input id="import-file" type="file" accept=".json,application/json" style="display:none;">
              </label>
            </div>
            <div id="data-transfer-status" class="ui-muted" style="display:none;margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(79,70,229,.08);border:1px solid rgba(79,70,229,.16);"></div>

            <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(120,105,85,.18);text-align:center;">
              <p class="ui-muted" style="margin:0 0 10px;">危险操作：清空后会删除小手机网页内所有本地数据，并刷新回初始默认状态。</p>
              <button class="ui-button" id="clear-all-data" type="button" style="background:#b42318;color:#fff;border-color:rgba(180,35,24,.35);">一键清空所有数据</button>
            </div>

            <div id="clear-data-modal" style="display:none;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;padding:22px;background:rgba(29,24,20,.38);backdrop-filter:blur(8px);">
              <div role="dialog" aria-modal="true" aria-labelledby="clear-data-title" style="width:min(360px,100%);border-radius:24px;background:rgba(255,252,247,.96);box-shadow:0 22px 60px rgba(37,28,20,.28);border:1px solid rgba(120,105,85,.2);padding:20px;">
                <h3 id="clear-data-title" style="margin:0 0 8px;">确认清空所有数据？</h3>
                <p class="ui-muted" style="margin:0 0 16px;line-height:1.6;">这会删除桌面布置、设置、记忆、闲谈联系人、聊天列表、聊天记录、档案、世界书和所有应用数据。删除后页面会刷新回初始默认状态。</p>
                <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
                  <button class="ui-button" id="cancel-clear-data" type="button">取消</button>
                  <button class="ui-button" id="confirm-clear-data" type="button" style="background:#b42318;color:#fff;border-color:rgba(180,35,24,.35);">确认清空</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
  `;
}

export function bindDataEvents(container, { settings }) {
  /* ========================================================================
     [修改标注·已完成·本次数据设置全量导入导出与清空交互]
     说明：
     1. 只调用 Settings.exportAllData/importAllData/clearAllData，底层唯一持久化来源是 DB.js / IndexedDB。
     2. 不读取或写入 localStorage/sessionStorage，不写双份存储兜底，不过滤长文本/大媒体字段。
     3. 导入和清空结果使用设置页内联提示；清空确认使用应用内弹窗，不使用 alert/confirm/prompt。
     ======================================================================== */
  const statusEl = container.querySelector('#data-transfer-status');
  const importInput = container.querySelector('#import-file');
  const clearButton = container.querySelector('#clear-all-data');
  const clearModal = container.querySelector('#clear-data-modal');
  const cancelClearButton = container.querySelector('#cancel-clear-data');
  const confirmClearButton = container.querySelector('#confirm-clear-data');

  const showStatus = (message, type = 'info') => {
    if (!statusEl) return;
    const isError = type === 'error';
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    statusEl.style.color = isError ? '#b42318' : '';
    statusEl.style.background = isError ? 'rgba(180,35,24,.08)' : 'rgba(79,70,229,.08)';
    statusEl.style.borderColor = isError ? 'rgba(180,35,24,.18)' : 'rgba(79,70,229,.16)';
  };

  const onExport = async () => {
    try {
      showStatus('正在整理小手机全量数据，请稍候……');
      const backup = await settings.exportAllData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miniphone-full-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('全量数据已导出。');
      Logger.info('全量数据导出完成');
    } catch (error) {
      Logger.error('全量数据导出失败', error);
      showStatus(`导出失败：${error?.message || '未知错误'}`, 'error');
    }
  };

  const onImport = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    try {
      showStatus('正在导入全量数据，请不要关闭页面……');
      const text = await file.text();
      const backup = JSON.parse(text);
      await settings.importAllData(backup, { overwrite: true });
      Logger.info('全量数据导入成功，准备刷新页面');
      showStatus('全量数据导入成功，页面即将刷新并重新载入导入后的数据。');
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      Logger.error('全量数据导入失败', error);
      showStatus(`导入失败：${error?.message || '文件内容无法解析'}`, 'error');
    } finally {
      if (importInput) {
        importInput.value = '';
      }
    }
  };

  const openClearModal = () => {
    if (clearModal) {
      clearModal.style.display = 'flex';
    }
  };

  const closeClearModal = () => {
    if (clearModal) {
      clearModal.style.display = 'none';
    }
  };

  const onClearAllData = async () => {
    try {
      if (confirmClearButton) {
        confirmClearButton.disabled = true;
        confirmClearButton.textContent = '正在清空……';
      }
      showStatus('正在清空所有数据，请不要关闭页面……');
      await settings.clearAllData();
      Logger.info('全量数据已清空，准备刷新页面');
      showStatus('所有数据已清空，页面即将刷新回初始默认状态。');
      closeClearModal();
      window.setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      Logger.error('全量数据清空失败', error);
      showStatus(`清空失败：${error?.message || '未知错误'}`, 'error');
      if (confirmClearButton) {
        confirmClearButton.disabled = false;
        confirmClearButton.textContent = '确认清空';
      }
    }
  };

  container.querySelector('#export-data')?.addEventListener('click', onExport);
  importInput?.addEventListener('change', onImport);
  clearButton?.addEventListener('click', openClearModal);
  cancelClearButton?.addEventListener('click', closeClearModal);
  clearModal?.addEventListener('click', (ev) => {
    if (ev.target === clearModal) {
      closeClearModal();
    }
  });
  confirmClearButton?.addEventListener('click', onClearAllData);
}
