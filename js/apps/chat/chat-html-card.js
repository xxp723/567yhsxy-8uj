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
   3. 已修复 HTML 最后一个标签后残留 `**、**、句号等 Markdown/标点尾巴导致卡片下方多出符号的问题。
   4. 不做 localStorage/sessionStorage 兜底，不做长文本字段过滤。
   ========================================================================== */
const HTML_CARD_CHAT_PROTOCOL_MARKER_REGEX = /\[(回复|表情|转账|引用|撤回|图片|卡片)\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;

function getHtmlCardProtocolBoundaryIndex(text = '', markerIndex = 0) {
  const value = String(text || '');
  let index = Math.max(0, Math.min(Number(markerIndex || 0), value.length));

  while (index > 0 && /[ \t\f\v`*_~]/.test(value.charAt(index - 1))) {
    index -= 1;
  }

  return index;
}

function getHtmlCardChatProtocolMarkers(text = '') {
  const value = String(text || '');
  const markerRegex = new RegExp(HTML_CARD_CHAT_PROTOCOL_MARKER_REGEX.source, 'g');

  return [...value.matchAll(markerRegex)].map(match => ({
    type: String(match[1] || '').trim(),
    roleName: String(match[2] || '').trim(),
    index: Number(match.index || 0),
    boundaryIndex: getHtmlCardProtocolBoundaryIndex(value, Number(match.index || 0)),
    markerText: String(match[0] || '')
  }));
}

function shouldStripHtmlCardTrailingProtocolMarker(text = '', marker = {}) {
  const value = String(text || '');
  const boundaryIndex = Number(marker.boundaryIndex || 0);
  const before = value.slice(0, boundaryIndex);
  const beforeTrimmed = before.trimEnd();

  if (!beforeTrimmed || !/<[a-z][\s\S]*?>/i.test(beforeTrimmed)) return false;
  if (/[\r\n]$/.test(before)) return true;

  return beforeTrimmed.endsWith('>');
}

/* ========================================================================
   [区域标注·已完成·HTML卡片尾部协议清理]
   说明：
   1. 修复 AI 把 [卡片] 后续 [回复]/[表情]/[转账]/[引用]/[撤回]/[图片] 协议继续拼在 HTML 后面，导致 iframe 底部掉格式显示的问题。
   2. 渲染旧消息时也会在显示层截掉尾部聊天协议；不迁移、不回写、不新增任何存储。
   3. 不使用 localStorage/sessionStorage，不做双份兜底，不按长文本字段过滤。
   ======================================================================== */
export function stripHtmlCardTrailingChatProtocols(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  const trailingProtocol = getHtmlCardChatProtocolMarkers(value)
    .find(marker => marker.type !== '卡片' && shouldStripHtmlCardTrailingProtocolMarker(value, marker));

  return trailingProtocol
    ? value.slice(0, trailingProtocol.boundaryIndex).trim()
    : value;
}

/* ========================================================================
   [区域标注·已完成·HTML卡片尾部Markdown标点残留清理]
   说明：
   1. 修复 AI 将 [卡片] HTML 包在 **`...`** 里时，最后一个 HTML 标签后残留 `**、**、句号等符号并显示在卡片下方的问题。
   2. 只在最后一个 HTML 闭合尖括号之后清理“纯 Markdown 包裹符/常见句末标点/空白”的尾巴，不触碰 HTML 标签内部内容。
   3. 本区域只影响 HTML 卡片显示层解析；不读写 localStorage/sessionStorage，不做双份存储兜底，不按长文本字段过滤。
   ======================================================================== */
function stripHtmlCardTrailingMarkdownPunctuation(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  const lastTagEndIndex = value.lastIndexOf('>');
  if (lastTagEndIndex < 0 || lastTagEndIndex >= value.length - 1) return value;

  const body = value.slice(0, lastTagEndIndex + 1).trimEnd();
  const tail = value.slice(lastTagEndIndex + 1).trim();

  return tail && /^[`*_~"'“”‘’。，、；;：:,.!！?？…·\-\s]+$/.test(tail)
    ? body.trim()
    : value;
}

export function normalizeHtmlCardProtocolContent(raw = '') {
  let value = String(raw || '').trim();
  if (!value) return '';

  value = value
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return stripHtmlCardTrailingMarkdownPunctuation(stripHtmlCardTrailingChatProtocols(value));
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片格式约束加强] HTML 卡片系统提示词
   说明：
   1. 只有聊天设置页开启 HTML 卡片开关后，prompt.js 才会注入本提示词。
   2. 已加强 AI 输出格式约束：卡片正文只能是 HTML，不允许混入 Markdown 围栏、解释文字或后续聊天协议。
   3. 已要求使用单一根容器、手机窄屏布局、内联样式作用域，降低卡片在聊天界面掉格式的概率。
   4. 卡片风格固定为北欧风，并要求与小手机主题暖色 UI 保持一致。
   ========================================================================== */
export function getHtmlCardFeaturePrompt() {
  return [
    '【HTML卡片能力】',
    '当且仅当你判断“最新一轮回复”适合通过可交互 HTML 卡片增强表达时，你可以在本轮回复中自主附加一条 [卡片] 协议。',
    '卡片必须与当前对话强相关，可用于账单、小票、电影票、承诺书、便签、邀请函、预约单、清单、提醒卡、配送单、行程卡、礼物卡、证明单等，但不限于这些例子。',
    '如果当前情景只是普通闲聊、不需要视觉承载、或会干扰聊天节奏，就不要输出 [卡片] 协议。',
    '你输出卡片时必须严格使用完整协议块：**`[卡片] 角色名：HTML内容`**。',
    'HTML 内容必须是可直接渲染的卡片正文；可以包含内联 style、按钮、标签、进度、票券布局、便签布局、状态切换等轻互动元素。',
    '格式硬性要求：HTML内容必须直接从第一个 HTML 标签开始，到最后一个 HTML 标签结束；禁止包裹 ```html 代码围栏；禁止在 HTML 前后添加解释文字、Markdown 列表、引号、星号强调或其它聊天协议文本。',
    '结构硬性要求：卡片正文必须使用一个单一根容器承载全部内容，推荐 `<article class="nordic-card">...</article>`；所有布局和样式都应限制在该根容器内，避免外层聊天界面掉格式。',
    '尺寸硬性要求：根容器宽度必须为 100%，最大宽度不得超过手机聊天气泡宽度；所有图片、表格、长文本、按钮组都必须可换行且不得横向溢出。',
    '卡片必须遵守以下硬性要求：',
    '1. 整体风格必须是北欧风，视觉上简洁、克制、留白充足、轻纸感、轻拟物、暖中性色调。',
    '2. 配色必须与当前小手机网页主题 UI 接近：暖白、米杏、浅棕、柔和金棕、低饱和灰褐，不要霓虹色、赛博色、纯黑高压风。',
    '3. 卡片必须适配手机窄屏，禁止超宽布局；优先单列布局，圆角柔和，阴影轻，不要大面积刺眼纯色；长标题、长数字、长地址、长备注必须允许自动换行。',
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
   3. 卡片正文只截取到下一条任意聊天协议开始处；兼容协议头前面带 **、反引号、空格等 Markdown 残片的情况。
   4. 不涉及任何持久化存储；不使用 localStorage/sessionStorage，不做双份兜底。
   ========================================================================== */
export function extractHtmlCardProtocolBlocks(rawText = '') {
  const visibleText = String(rawText || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  const protocolMarkers = getHtmlCardChatProtocolMarkers(visibleText);
  const cardMarkers = protocolMarkers.filter(marker => marker.type === '卡片');
  if (!cardMarkers.length) return [];

  return cardMarkers
    .map((marker) => {
      const contentStart = marker.index + marker.markerText.length;
      const nextProtocolMarker = protocolMarkers.find(item => item.index > marker.index);
      const contentEnd = nextProtocolMarker ? nextProtocolMarker.boundaryIndex : visibleText.length;
      const html = normalizeHtmlCardProtocolContent(visibleText.slice(contentStart, contentEnd));
      return {
        type: 'card',
        roleName: marker.roleName,
        html
      };
    })
    .filter(item => item.html);
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片主题色对齐全局Root] iframe 内部格式保护样式
   说明：
   1. 已为 HTML 卡片统一注入最小格式保护层，防止长文本、表格、图片、代码块横向撑破聊天卡片。
   2. 已对齐 css/styles.css 的 :root 主题色：Linen #F5F1EA、Khaki #D7C9B8、Espresso #4A342A、Cocoa #7D5A44。
   3. 已补充不突兀的莫兰迪暖色扩展变量，便于下次直接调整 HTML 卡片色系。
   4. 卡片默认纸面改为纯色，卡片阴影按需求保留；不修改持久化，不使用 localStorage/sessionStorage。
   ========================================================================== */
const HTML_CARD_FORMAT_ENFORCER_STYLE = `<style data-miniphone-card-format-enforcer="true">
  :root{
    color-scheme:light;
    --card-bg:#F5F1EA;
    --card-surface:#fffdf8;
    --card-surface-2:#D7C9B8;
    --card-border:rgba(125,90,68,.18);
    --card-text:#4A342A;
    --card-sub:#7D5A44;
    --card-accent:#B2967D;
    --card-accent-soft:rgba(178,150,125,.16);
    --card-morandi-sage:#A8A08D;
    --card-morandi-clay:#B2967D;
    --card-morandi-rose:#C8A99A;
    --card-shadow:0 10px 28px rgba(74,52,42,.10);
    --card-radius:20px;
  }
  *,*::before,*::after{
    box-sizing:border-box;
    max-width:100%;
  }
  html,body{
    width:100%;
    max-width:100%;
    margin:0;
    padding:0;
    overflow-x:hidden;
    background:transparent;
    font-family:"PingFang SC","Microsoft YaHei",sans-serif;
    color:var(--card-text);
  }
  body{
    min-height:0;
  }
  .miniphone-html-card-root{
    width:100%;
    max-width:100%;
    overflow:hidden;
  }
  .miniphone-html-card-root,
  .miniphone-html-card-root *{
    overflow-wrap:anywhere;
    word-break:break-word;
  }
  .miniphone-html-card-root > :where(article,section,main,div):first-child:last-child:not(.nordic-card){
    width:100%;
    border-radius:var(--card-radius);
    border:1px solid var(--card-border);
    background:var(--card-surface);
    box-shadow:var(--card-shadow);
    padding:14px;
    overflow:hidden;
  }
  img,svg,video,canvas{
    max-width:100%;
    height:auto;
  }
  table{
    width:100%;
    max-width:100%;
    table-layout:fixed;
    border-collapse:collapse;
  }
  th,td{
    overflow-wrap:anywhere;
    word-break:break-word;
  }
  pre,code{
    white-space:pre-wrap;
    overflow-wrap:anywhere;
    word-break:break-word;
  }
  button,input,textarea,select{
    max-width:100%;
    font:inherit;
  }
</style>`;

function injectHtmlCardFormatEnforcerStyle(documentHtml = '') {
  const value = String(documentHtml || '');
  if (!value || /data-miniphone-card-format-enforcer/i.test(value)) return value;

  if (/<\/head>/i.test(value)) {
    return value.replace(/<\/head>/i, `${HTML_CARD_FORMAT_ENFORCER_STYLE}\n</head>`);
  }

  return `${HTML_CARD_FORMAT_ENFORCER_STYLE}\n${value}`;
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片主题色对齐全局Root] HTML 骨架补全
   说明：
   1. 允许 AI 只输出局部 HTML；这里自动补齐最小可渲染文档结构。
   2. 已统一包裹 .miniphone-html-card-root 并注入格式保护样式，防止聊天界面 HTML 卡片掉格式。
   3. 默认 HTML 卡片主题色已对齐 css/styles.css 的 :root 色板，并提供莫兰迪暖色扩展变量。
   ========================================================================== */
export function buildHtmlCardDocument(html = '') {
  const body = normalizeHtmlCardProtocolContent(html);
  if (!body) return '';

  const hasHtmlTag = /<html[\s>]/i.test(body);
  if (hasHtmlTag) return injectHtmlCardFormatEnforcerStyle(body);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root{
      color-scheme: light;
      --card-bg:#F5F1EA;
      --card-surface:#fffdf8;
      --card-surface-2:#D7C9B8;
      --card-border:rgba(125,90,68,.18);
      --card-text:#4A342A;
      --card-sub:#7D5A44;
      --card-accent:#B2967D;
      --card-accent-soft:rgba(178,150,125,.16);
      --card-morandi-sage:#A8A08D;
      --card-morandi-clay:#B2967D;
      --card-morandi-rose:#C8A99A;
      --card-shadow:0 10px 28px rgba(74,52,42,.10);
      --card-radius:20px;
    }
    *,*::before,*::after{
      box-sizing:border-box;
      max-width:100%;
    }
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
      overflow-x:hidden;
    }
    .miniphone-html-card-root{
      width:100%;
      max-width:100%;
      overflow:hidden;
    }
    .miniphone-html-card-root,
    .miniphone-html-card-root *{
      overflow-wrap:anywhere;
      word-break:break-word;
    }
    .miniphone-html-card-root > :where(article,section,main,div):first-child:last-child:not(.nordic-card){
      width:100%;
      border-radius:var(--card-radius);
      border:1px solid var(--card-border);
      background:var(--card-surface);
      box-shadow:var(--card-shadow);
      padding:14px;
      overflow:hidden;
    }
    .nordic-card{
      width:100%;
      border-radius:var(--card-radius);
      border:1px solid var(--card-border);
      background:var(--card-surface);
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
    img,svg,video,canvas{
      max-width:100%;
      height:auto;
    }
    table{
      width:100%;
      max-width:100%;
      table-layout:fixed;
      border-collapse:collapse;
    }
    th,td{
      overflow-wrap:anywhere;
      word-break:break-word;
    }
    pre,code{
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      word-break:break-word;
    }
  </style>
</head>
<body>
  <main class="miniphone-html-card-root">
    ${body}
  </main>
</body>
</html>`;
}

/* ==========================================================================
   [区域标注·已完成·HTML卡片交互桥接] iframe 内部点击/选择交互 postMessage 脚本片段
   说明：
   1. 此脚本在 sanitize 之后追加到 </body> 前，确保不被清理掉。
   2. iframe 内部监听 button / a / summary / 表单控件等轻互动元素，点击后给元素添加可见反馈。
   3. 交互结果通过 postMessage 发给父页面，由 chat-message.js / index.js 转成聊天系统提示并写入 DB.js / IndexedDB。
   4. 本区域不使用 localStorage/sessionStorage，不使用原生浏览器弹窗，不做双份存储兜底。
   ========================================================================== */
const HTML_CARD_INTERACTION_BRIDGE_SCRIPT = `
<script data-card-interaction-bridge="true">
(function(){
  var lastInteractionAt = 0;

  function getText(el){
    if(!el) return '';
    var text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').replace(/\\s+/g, ' ').trim();
    return text.length > 80 ? text.slice(0, 80) + '…' : text;
  }

  function getInteractiveTarget(start){
    if(!start || !start.closest) return null;
    return start.closest('button,a,summary,label,input,textarea,select,[role="button"],[role="switch"],[role="checkbox"],[role="radio"],[tabindex],.btn,.button,[data-action]');
  }

  function markInteracted(el){
    if(!el || !el.classList) return;
    el.classList.add('miniphone-card-interacted');
    if(el.matches && el.matches('button,[role="button"],[role="switch"],.btn,.button')){
      var pressed = el.getAttribute('aria-pressed') === 'true';
      el.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    }
    window.setTimeout(function(){ el.classList.remove('miniphone-card-interacted'); }, 1200);
  }

  function describeInteraction(el, eventType){
    var tag = String(el && el.tagName || '').toLowerCase();
    var role = String(el && el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    var text = getText(el);
    var value = '';
    var checked = false;

    if(el && /^(input|textarea|select)$/.test(tag)){
      value = String(el.value || '').trim();
      checked = Boolean(el.checked);
      if(!text){
        var label = el.id ? document.querySelector('label[for="' + String(el.id).replace(/"/g, '\\\\"') + '"]') : null;
        text = getText(label) || el.getAttribute('placeholder') || el.getAttribute('name') || tag;
      }
    }

    return {
      type: '__miniphone_card_interaction__',
      eventType: eventType,
      tagName: tag,
      role: role,
      text: text || value || tag || 'HTML卡片元素',
      value: value.length > 80 ? value.slice(0, 80) + '…' : value,
      checked: checked,
      timestamp: Date.now()
    };
  }

  function postInteraction(el, eventType){
    if(!el) return;
    parent.postMessage(describeInteraction(el, eventType), '*');
  }

  var style = document.createElement('style');
  style.setAttribute('data-miniphone-card-interaction-feedback', 'true');
  style.textContent = '.miniphone-card-interacted{filter:brightness(.96);box-shadow:0 0 0 3px rgba(199,154,102,.20),0 8px 18px rgba(61,52,45,.10)!important;transform:translateY(1px) scale(.99);transition:transform .16s ease,box-shadow .16s ease,filter .16s ease;}';
  document.head.appendChild(style);

  document.addEventListener('click', function(event){
    var target = getInteractiveTarget(event.target);
    if(!target) return;
    if(target.matches && target.matches('a')){
      event.preventDefault();
    }
    markInteracted(target);
    postInteraction(target, 'click');
  }, true);

  /* ========================================================================
     [区域标注·已完成·HTML卡片iframe双击收藏桥接]
     说明：iframe 内部双击不会冒泡到父页面，因此通过 postMessage 通知父页面触发收藏逻辑。
     ======================================================================== */
  document.addEventListener('dblclick', function(event){
    parent.postMessage({
      type: '__miniphone_card_dblclick__',
      timestamp: Date.now()
    }, '*');
  }, true);

  document.addEventListener('change', function(event){
    var target = getInteractiveTarget(event.target);
    if(!target) return;
    markInteracted(target);
    postInteraction(target, 'change');
  }, true);
})();
</script>`;

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
   [区域标注·已完成·HTML卡片格式约束加强与交互桥接] iframe srcdoc 安全净化
   说明：
   1. 先移除所有外部/用户 script、事件属性、iframe嵌套、弹窗 API、顶层跳转。
   2. 已在净化后再次确保格式保护样式存在，兼容 AI 输出完整 HTML 文档的情况。
   3. 然后追加受信任的交互桥接脚本与高度上报脚本，确保卡片可点击、可反馈、可自适应高度。
   4. 不做双份存储，不引入原生浏览器弹窗。
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

  sanitized = injectHtmlCardFormatEnforcerStyle(sanitized);

  /* 在 </body> 前注入交互桥接与高度上报脚本；若无 </body> 则追加到末尾 */
  const trustedRuntimeScripts = HTML_CARD_INTERACTION_BRIDGE_SCRIPT + HTML_CARD_HEIGHT_REPORTER_SCRIPT;
  if (/<\/body>/i.test(sanitized)) {
    sanitized = sanitized.replace(/<\/body>/i, trustedRuntimeScripts + '\n</body>');
  } else {
    sanitized += trustedRuntimeScripts;
  }

  return sanitized;
}
