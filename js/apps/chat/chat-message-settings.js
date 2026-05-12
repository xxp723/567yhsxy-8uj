// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-settings.js
 * 用途: 闲谈应用 — 聊天消息页的独立聊天设置页面渲染模块
 * 架构层: 应用层（闲谈子模块）
 */

import { escapeHtml } from './chat-utils.js';
import { MSG_ICONS } from './chat-message-icons.js';
import { renderTranslationSettingsHtml } from './chat-translation.js';
import { renderChatExportImportSettingsSection } from './chat-export-import.js';
import { renderChatCleanupSettingsSection } from './chat-cleanup-settings.js';

/* ==========================================================================
   [区域标注·已完成·本次拆分] 独立聊天设置页面
   说明：
   1. 本模块只负责渲染聊天消息页 settings 页面 HTML，三点按钮进入与返回事件仍由原事件代理处理。
   2. 所有 data-role / data-action / class 保持原样，确保 chat-message.js 与 index.js 的既有接线不变。
   3. 设置保存逻辑仍由 index.js 写入 DB.js / IndexedDB；本模块不读写 localStorage/sessionStorage。
   ========================================================================== */
export function renderChatMessageSettingsPage({
  session = {},
  name = '聊天',
  chatSettings = {},
  options = {},
  stickerGroups = [],
  mountedStickerGroupIds = [],
  chatConsoleEnabled = false
} = {}) {
  return `
    <div class="msg-settings-page" data-role="msg-settings-page" style="display:none;">
      <div class="msg-settings-header">
        <button class="msg-settings-header__back" data-action="msg-settings-back" type="button">${MSG_ICONS.back}</button>
        <div class="msg-settings-header__title">聊天设置</div>
      </div>
      <div class="msg-settings-body">
        <!-- ==================================================================
             [区域标注·已完成·头像与备注：双头像/展示开关/当前会话备注]
             说明：
             1. 本区域只修改当前聊天会话的 session.avatar / session.userAvatar / session.remark，与聊天设置 showUserAvatarToRole。
             2. 不写入 contacts、contact.avatar、state.profile.avatar；持久化统一走 DB.js / IndexedDB。
             3. 不使用 localStorage/sessionStorage；头像点击后仅打开应用内来源选择弹窗。
             ================================================================== -->
        <section class="msg-settings-avatar-section">
          <div class="msg-settings-section-title">头像与备注</div>
          <section class="msg-settings-card msg-settings-avatar-card">
            <input data-role="msg-avatar-file-input" type="file" accept="image/*" hidden>
            <div class="msg-settings-avatar-block">
              <div class="msg-settings-avatar-grid">
                <div class="msg-settings-avatar-item">
                  <div class="msg-settings-avatar-label">角色头像</div>
                  <button
                    class="msg-settings-avatar-preview msg-settings-avatar-preview-btn"
                    data-action="open-chat-avatar-source-modal"
                    data-avatar-target="character"
                    data-role="msg-settings-avatar-preview-character"
                    type="button"
                    aria-label="更换角色头像">
                    ${session.avatar ? `<img src="${escapeHtml(session.avatar)}" alt="${escapeHtml(name)}">` : `<span>${escapeHtml((name || '?').charAt(0).toUpperCase())}</span>`}
                  </button>
                </div>
                <div class="msg-settings-avatar-item">
                  <div class="msg-settings-avatar-label">用户头像</div>
                  <button
                    class="msg-settings-avatar-preview msg-settings-avatar-preview-btn"
                    data-action="open-chat-avatar-source-modal"
                    data-avatar-target="user"
                    data-role="msg-settings-avatar-preview-user"
                    type="button"
                    aria-label="更换用户头像">
                    ${(session.userAvatar || options.userProfile?.avatar) ? `<img src="${escapeHtml(session.userAvatar || options.userProfile?.avatar || '')}" alt="${escapeHtml(options.userProfile?.nickname || '我')}">` : `<span>${escapeHtml(((options.userProfile?.nickname || '我') || '我').charAt(0).toUpperCase())}</span>`}
                  </button>
                </div>
              </div>
            </div>
            <div class="msg-settings-avatar-divider"></div>
            <div class="msg-settings-row msg-settings-avatar-switch-row">
              <div class="msg-settings-card__title">向角色展示头像</div>
              <button class="msg-ios-switch ${chatSettings.showUserAvatarToRole ? 'is-on' : ''}" data-action="toggle-show-user-avatar-to-role" type="button" aria-label="向角色展示头像"></button>
            </div>
            <div class="msg-settings-avatar-divider"></div>
            <div class="msg-settings-remark-row">
              <div class="msg-settings-card__title">备注</div>
              <input
                class="msg-settings-input msg-settings-input--inline"
                data-role="msg-session-remark"
                type="text"
                placeholder="输入当前会话备注（仅本地显示）"
                value="${escapeHtml(session.remark || '')}">
            </div>
          </section>
        </section>

        <section class="msg-settings-card">
          <div class="msg-settings-card__title">当前指令</div>
          <textarea class="msg-settings-textarea" data-role="msg-current-command" placeholder="输入仅对下一次/当前状态生效的临时指令">${escapeHtml(chatSettings.currentCommand || '')}</textarea>
        </section>
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">外部应用消息注入</div>
              <div class="msg-settings-card__desc">开启后会在提示词中注入外部应用上下文。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.externalContextEnabled ? 'is-on' : ''}" data-action="toggle-external-context" type="button" aria-label="外部应用消息注入"></button>
          </div>
        </section>

        <!-- ===== 闲谈应用：时间感知设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">时间感知</div>
              <div class="msg-settings-card__desc">开启后角色会感知到真实时间。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.timeAwarenessEnabled ? 'is-on' : ''}" data-action="toggle-time-awareness" type="button" aria-label="时间感知"></button>
          </div>
        </section>

        <!-- ==================================================================
             [区域标注·已完成·HTML卡片设置开关] 聊天设置页 HTML 卡片注入开关
             说明：
             1. 仅当此开关开启时，prompt.js 才会给 AI 注入 HTML 卡片系统提示词。
             2. 开关样式沿用现有 iPhone 风格滑动开关；持久化由 index.js 写入 DB.js / IndexedDB。
             3. 本区域只新增 html 卡片功能相关设置，不修改其它聊天设置行为。
             ================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">HTML卡片</div>
              <div class="msg-settings-card__desc">开启后，角色会在对话中发送趣味性HTML卡片。</div>
            </div>
            <button class="msg-ios-switch ${chatSettings.htmlCardEnabled ? 'is-on' : ''}" data-action="toggle-html-card" type="button" aria-label="HTML卡片"></button>
          </div>
        </section>

        <!-- ==========================================================================
             [区域标注·已完成·本次语言翻译设置位置调整] 语言翻译折叠栏板块
             说明：
             1. 本板块已按本次要求下移到「HTML卡片」板块下方、「查看控制台日志」板块上方。
             2. HTML 仍由 chat-translation.js 的 renderTranslationSettingsHtml() 生成；板块标题图标已在该模块中移除。
             3. 翻译设置仍独立存储于 IndexedDB，键名 chat_translation_settings::*；本次只调整显示位置，不新增 localStorage/sessionStorage 逻辑。
             ========================================================================== -->
        ${renderTranslationSettingsHtml(options.translationSettings, session, options.userProfile?.avatar, options.userProfile?.nickname)}

        <!-- ==================================================================
             [区域标注·已完成·本次控制台日志开关] 聊天设置页新增开关
             说明：开启后在聊天页底栏上方显示日志入口，实时查看发送/API/警告/错误日志。
             ================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-row">
            <div>
              <div class="msg-settings-card__title">查看控制台日志</div>
              <div class="msg-settings-card__desc">实时显示当前聊天页消息发送情况、API 错误、警告和其它错误。</div>
            </div>
            <button class="msg-ios-switch ${chatConsoleEnabled ? 'is-on' : ''}" data-action="toggle-chat-console" type="button" aria-label="查看控制台日志"></button>
          </div>
        </section>
        <!-- ===== 闲谈应用：时间感知设置 END ===== -->
        <!-- ==================================================================
             [区域标注·已同步静默审查] 自定义思维链设置
             说明：
             1. 本区域已同步 prompt.js 的默认静默审查方案。
             2. 自定义内容应要求 AI 后台自检，禁止显式输出 <think>...</think>。
             3. 这里只修改设置提示文案，不改 IndexedDB 持久化逻辑。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">自定义思维链</div>
          <div class="msg-settings-card__desc">留空时使用默认静默审查协议；自定义内容也应要求 AI 后台自检，最终回复禁止输出 think 标签、审查过程或幕后说明。</div>
          <textarea class="msg-settings-textarea" data-role="msg-custom-thinking" placeholder="【静默审查】输出前先在后台核对角色卡事实、已知细节、情感事实和消息格式；最终只输出符合通用消息协议的可见回复，禁止输出 <think>、审查步骤或幕后说明。">${escapeHtml(chatSettings.customThinkingInstruction || '')}</textarea>
        </section>

        <!-- ==================================================================
             [区域标注·本次需求3] AI 表情包挂载设置
             说明：只显示分组名称；支持多选；不同用户面具只决定 AI 挂载哪些分组。
             ========================================================================== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">表情包挂载</div>
          <div class="msg-settings-card__desc">选择要挂载给 AI 使用的表情包分组。AI 只能从已挂载分组里选择符合当前聊天情景的表情包发送。</div>
          <div class="msg-settings-sticker-groups">
            ${stickerGroups.length
              ? stickerGroups.map(group => `
                  <button class="msg-settings-sticker-group-btn ${mountedStickerGroupIds.includes(group.id) ? 'is-active' : ''}"
                          data-action="toggle-mounted-sticker-group"
                          data-sticker-group-id="${escapeHtml(group.id)}"
                          type="button">
                    ${escapeHtml(group.name)}
                  </button>
                `).join('')
              : `<div class="msg-settings-sticker-empty">暂无可挂载的表情包分组</div>`}
          </div>
        </section>

        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">每轮回复气泡数量</div>
          <div class="msg-settings-card__desc">控制 AI 每一轮回复必须拆成多少个消息气泡；除非用户当轮明确允许突破，否则 AI 必须严格遵守。</div>
          <div class="msg-settings-number-grid">
            <label class="msg-settings-number-field">
              <span>最低</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-min" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMin || 1)}">
            </label>
            <label class="msg-settings-number-field">
              <span>最高</span>
              <input class="msg-settings-number-input" data-role="msg-reply-bubble-max" type="number" min="1" step="1" value="${escapeHtml(chatSettings.replyBubbleMax || 3)}">
            </label>
          </div>
        </section>
        <!-- ===== 闲谈应用：AI每轮回复气泡数量设置 END ===== -->

        <!-- ===== 闲谈应用：短期记忆设置 START ===== -->
        <section class="msg-settings-card">
          <div class="msg-settings-card__title">短期记忆</div>
          <div class="msg-settings-card__desc">控制下次请求 AI 时携带之前多少轮对话上文；0 表示不携带历史上文。</div>
          <label class="msg-settings-number-field msg-settings-number-field--full">
            <span>发送之前轮数</span>
            <input class="msg-settings-number-input" data-role="msg-short-term-memory-rounds" type="number" min="0" step="1" value="${escapeHtml(chatSettings.shortTermMemoryRounds ?? 8)}">
          </label>
        </section>
        <!-- ===== 闲谈应用：短期记忆设置 END ===== -->

        ${renderChatExportImportSettingsSection()}

        ${renderChatCleanupSettingsSection({ broomIcon: MSG_ICONS.broom })}
      </div>
    </div>
  `;
}
