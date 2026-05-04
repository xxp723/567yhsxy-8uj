// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-html-card.js
 * 用途: 闲谈应用 — AI HTML 卡片协议解析与渲染工具（独立模块）
 * 说明：
 * 1. 本模块只负责“HTML卡片”相关逻辑，便于后续单独维护。
 * 2. 不涉及任何持久化存储读写；持久化统一由 chat-message.js / index.js 走 DB.js（IndexedDB）。
 * 3. 卡片渲染使用 sandbox iframe，保证可交互点击且不污染外层页面样式。
 */

/* ==========================================================================
   [区域标注·已完成·HTML卡片] 协议正文提取与基础清理
   说明：
   1. 支持 AI 在 [卡片] 协议中直接给出 HTML 片段。
   2. 若包裹在 ```html ... ``` 代码块中会自动剥离围栏。
   3. 不做 localStorage/sessionStorage 兜底，不做长文本字段过滤。
   ========================================================================== */
export function normalizeHtmlCardProtocolContent(raw = '') {
  let value = String(raw || '').trim();
  if (!value) return '';

  value = value
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return value;
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片] HTML 卡片系统提示词
   说明：
   1. 只有聊天设置页开启 HTML 卡片开关后，prompt.js 才会注入本提示词。
   2. 明确要求 AI 仅在“最新一轮回复确有必要”时输出 [卡片] 协议，避免滥发。
   3. 卡片风格固定为北欧风，并要求与小手机主题暖色 UI 保持一致。
   ========================================================================== */
export function getHtmlCardFeaturePrompt() {
  return [
    '【HTML卡片能力】',
    '当且仅当你判断“最新一轮回复”适合通过可交互 HTML 卡片增强表达时，你可以在本轮回复中自主附加一条 [卡片] 协议。',
    '卡片必须与当前对话强相关，可用于账单、小票、电影票、承诺书、便签、邀请函、预约单、清单、提醒卡、配送单、行程卡、礼物卡、证明单等，但不限于这些例子。',
    '如果当前情景只是普通闲聊、不需要视觉承载、或会干扰聊天节奏，就不要输出 [卡片] 协议。',
    '你输出卡片时必须严格使用完整协议块：**`[卡片] 角色名：HTML内容`**。',
    'HTML 内容必须是可直接渲染的卡片正文；可以包含内联 style、按钮、标签、进度、票券布局、便签布局、状态切换等轻互动元素。',
    '卡片必须遵守以下硬性要求：',
    '1. 整体风格必须是北欧风，视觉上简洁、克制、留白充足、轻纸感、轻拟物、暖中性色调。',
    '2. 配色必须与当前小手机网页主题 UI 接近：暖白、米杏、浅棕、柔和金棕、低饱和灰褐，不要霓虹色、赛博色、纯黑高压风。',
    '3. 卡片必须适配手机窄屏，禁止超宽布局；优先单列布局，圆角柔和，阴影轻，不要大面积刺眼纯色。',
    '4. 可以有 button、details、summary、checkbox、radio、progress、meter、a 等原生 HTML 可交互元素，但禁止依赖外部 CDN、外链脚本、远程字体、远程图片或网络请求。',
    '5. 禁止输出 <script>、禁止跳转顶层窗口、禁止访问父页面、禁止使用浏览器原生弹窗 API（alert/confirm/prompt）。',
    '6. 若需要图形元素，优先用纯 HTML/CSS 绘制，不要引用外部图片资源。',
    '7. 卡片正文必须和角色人设、会话对象、世界书、聊天历史、当前用户消息保持一致，不能脱离剧情凭空生成。',
    '8. 一轮回复中 [卡片] 协议通常最多一条；除非用户明确要求多个，否则不要一次生成多张卡片。',
    '9. [卡片] 协议是附加消息类型，不替代必要的 [回复] 文字气泡；如需说话，仍要正常输出 [回复]。'
  ].join('\n');
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片掉格式修复] 协议块提取
   说明：
   1. 从 AI 原始文本中提取 [卡片] 角色名：HTML正文。
   2. 本区域已修复“卡片后续 [回复]/[表情]/[转账]/[引用]/[撤回]/[图片] 协议被塞进 iframe”的掉格式问题。
   3. 卡片正文只截取到下一条任意聊天协议开始处，确保聊天界面只显示一张干净的 HTML 卡片。
   4. 不涉及任何持久化存储；不使用 localStorage/sessionStorage，不做双份兜底。
   ========================================================================== */
export function extractHtmlCardProtocolBlocks(rawText = '') {
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  const markerRegex = /(?:\*\*)?\s*`?\s*\[卡片\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
  const allProtocolMarkerRegex = /(?:\*\*)?\s*`?\s*\[(回复|表情|转账|引用|撤回|图片|卡片)\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
  const cardMatches = [...visibleText.matchAll(markerRegex)];
  const protocolMatches = [...visibleText.matchAll(allProtocolMarkerRegex)];
  if (!cardMatches.length) return [];

  return cardMatches
    .map((match) => {
      const contentStart = Number(match.index || 0) + String(match[0] || '').length;
      const nextProtocolMatch = protocolMatches.find(item => Number(item.index || 0) > Number(match.index || 0));
      const contentEnd = nextProtocolMatch ? Number(nextProtocolMatch.index || visibleText.length) : visibleText.length;
      const html = normalizeHtmlCardProtocolContent(visibleText.slice(contentStart, contentEnd));
      return {
        type: 'card',
        roleName: String(match[1] || '').trim(),
        html
      };
    })
    .filter(item => item.html);
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片] HTML 骨架补全
   说明：允许 AI 只输出局部 HTML；这里自动补齐最小可渲染文档结构。
   ========================================================================== */
export function buildHtmlCardDocument(html = '') {
  const body = normalizeHtmlCardProtocolContent(html);
  if (!body) return '';

  const hasHtmlTag = /<html[\s>]/i.test(body);
  if (hasHtmlTag) return body;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root{
      color-scheme: light;
      --card-bg:#f8f4ef;
      --card-surface:#fffdf9;
      --card-surface-2:#f3ece3;
      --card-border:rgba(109,95,82,.18);
      --card-text:#3d342d;
      --card-sub:#7a6a5d;
      --card-accent:#c79a66;
      --card-accent-soft:rgba(199,154,102,.16);
      --card-shadow:0 10px 28px rgba(61,52,45,.10);
      --card-radius:20px;
    }
    *{box-sizing:border-box}
    html,body{
      margin:0;
      padding:0;
      background:transparent;
      font-family:"PingFang SC","Microsoft YaHei",sans-serif;
      color:var(--card-text);
    }
    body{
      min-height:0;
      padding:0;
    }
    .nordic-card{
      width:100%;
      border-radius:var(--card-radius);
      border:1px solid var(--card-border);
      background:linear-gradient(160deg,var(--card-surface),var(--card-bg));
      box-shadow:var(--card-shadow);
      padding:14px;
      overflow:hidden;
    }
    .nordic-card h1,.nordic-card h2,.nordic-card h3{
      margin:0 0 8px;
      font-weight:700;
      letter-spacing:.02em;
    }
    .nordic-card p{
      margin:0 0 8px;
      line-height:1.6;
      color:var(--card-sub);
    }
    .nordic-card small,.nordic-card .muted{
      color:var(--card-sub);
    }
    .nordic-card .row{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:10px;
      padding:8px 0;
      border-bottom:1px dashed rgba(109,95,82,.18);
    }
    .nordic-card .row:last-child{border-bottom:none}
    .nordic-card .pill,
    .nordic-card .tag{
      display:inline-flex;
      align-items:center;
      gap:6px;
      min-height:28px;
      padding:6px 10px;
      border-radius:999px;
      background:var(--card-accent-soft);
      color:var(--card-text);
      font-size:12px;
    }
    .nordic-card button,
    .nordic-card .btn{
      appearance:none;
      border:none;
      border-radius:999px;
      padding:8px 12px;
      background:var(--card-accent);
      color:#fff;
      cursor:pointer;
      font:inherit;
      transition:transform .16s ease,opacity .16s ease,filter .16s ease;
    }
    .nordic-card button:active,
    .nordic-card .btn:active{
      transform:scale(.98);
      filter:brightness(.98);
    }
    .nordic-card input,
    .nordic-card textarea,
    .nordic-card select{
      width:100%;
      border:1px solid var(--card-border);
      border-radius:14px;
      background:rgba(255,255,255,.72);
      padding:10px 12px;
      color:var(--card-text);
      font:inherit;
      outline:none;
    }
    .nordic-card a{
      color:var(--card-text);
    }
    .nordic-card details{
      border:1px solid var(--card-border);
      border-radius:14px;
      padding:10px 12px;
      background:rgba(255,255,255,.55);
    }
    .nordic-card summary{
      cursor:pointer;
      user-select:none;
      font-weight:600;
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片] iframe 自适应高度 postMessage 脚本片段
   说明：
   1. 此脚本在 sanitize 之后追加到 </body> 前，确保不被清理掉。
   2. iframe 内部通过 postMessage 向父页面报告 body 实际高度。
   3. 父页面（chat-message.js）中的 message 监听器据此动态设置 iframe 高度。
   4. 使用 ResizeObserver + 初始延迟双重机制，兼容动态内容和首次渲染。
   ========================================================================== */
const HTML_CARD_HEIGHT_REPORTER_SCRIPT = `
<script data-card-height-reporter="true">
(function(){
  function reportHeight(){
    var h = Math.max(
      document.body.scrollHeight || 0,
      document.body.offsetHeight || 0,
      document.documentElement.scrollHeight || 0
    );
    if(h > 0) parent.postMessage({type:'__miniphone_card_height__', height: h}, '*');
  }
  if(typeof ResizeObserver !== 'undefined'){
    new ResizeObserver(function(){ reportHeight(); }).observe(document.body);
  }
  window.addEventListener('load', function(){ setTimeout(reportHeight, 60); });
  setTimeout(reportHeight, 120);
  setTimeout(reportHeight, 500);
})();
</script>`;

/* ==========================================================================
   [区域标注·已完成·HTML卡片] iframe srcdoc 安全净化
   说明：
   1. 先移除所有外部/用户 script、事件属性、iframe嵌套、弹窗 API、顶层跳转。
   2. 然后追加受信任的高度上报脚本（data-card-height-reporter），确保自适应高度正常工作。
   3. 不做双份存储，不引入原生浏览器弹窗。
   ========================================================================== */
export function sanitizeHtmlCardDocumentForSrcdoc(html = '') {
  const documentHtml = buildHtmlCardDocument(html);
  if (!documentHtml) return '';

  let sanitized = documentHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\balert\s*\(/gi, 'void(')
    .replace(/\bconfirm\s*\(/gi, 'void(')
    .replace(/\bprompt\s*\(/gi, 'void(')
    .replace(/\btop\s*\./gi, 'window.')
    .replace(/\bparent\s*\./gi, 'window.')
    .replace(/<a([^>]*?)target\s*=\s*["']?_top["']?([^>]*)>/gi, '<a$1$2>')
    .replace(/<a([^>]*?)target\s*=\s*["']?_parent["']?([^>]*)>/gi, '<a$1$2>');

  /* 在 </body> 前注入高度上报脚本；若无 </body> 则追加到末尾 */
  if (/<\/body>/i.test(sanitized)) {
    sanitized = sanitized.replace(/<\/body>/i, HTML_CARD_HEIGHT_REPORTER_SCRIPT + '\n</body>');
  } else {
    sanitized += HTML_CARD_HEIGHT_REPORTER_SCRIPT;
  }

  return sanitized;
}
