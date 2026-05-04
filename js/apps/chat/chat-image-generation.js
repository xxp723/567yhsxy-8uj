/**
 * 文件名: js/apps/chat/chat-image-generation.js
 * 用途: 闲谈应用 - AI 生图能力模块
 * 说明:
 * 1. 只读取 SettingsStore -> DB.js / IndexedDB 中的 settings.imageApi。
 * 2. 禁止使用 localStorage/sessionStorage。
 * 3. 不写双份存储兜底逻辑。
 * 4. 本模块只服务闲谈应用聊天消息中的 [图片] 协议。
 */

/* ==========================================================================
   [区域标注·已完成·AI生图] 生图 API 内部接口常量
   说明：与设置应用生图 API 页保持一致；硅基流动地址只在请求内部使用，不额外持久化。
   ========================================================================== */
const SILICONFLOW_IMAGE_BASE_URL = 'https://api.siliconflow.cn/v1';

const IMAGE_API_PROVIDER_META = {
  siliconflow: {
    id: 'siliconflow',
    defaultBaseUrl: ''
  },
  openai: {
    id: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1'
  }
};

/* ==========================================================================
   [区域标注·已完成·AI生图] 通用工具函数
   说明：仅做字符串清理与接口错误提取，不涉及任何持久化存储。
   ========================================================================== */
function trimSlash(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function normalizeProviderId(providerId) {
  return IMAGE_API_PROVIDER_META[providerId] ? providerId : 'siliconflow';
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map(item => String(item).trim()).filter(Boolean))];
}

function extractApiErrorMessage(payload, fallback = '请求失败') {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload?.error?.message || payload?.error?.msg || payload?.message || payload?.detail || fallback;
}

function cleanProtocolContent(content) {
  return String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(?:`|\*\*)+/g, '')
    .replace(/(?:`|\*\*)+\s*$/g, '')
    .replace(/^\s*["'“”]+|["'“”]+\s*$/g, '')
    .trim();
}

function createPromptSection(title, content) {
  const text = String(content || '').trim();
  return text ? `【${title}】\n${text}` : '';
}

/* ==========================================================================
   [区域标注·已完成·AI生图] 生图 API 配置读取与规范化
   说明：
   1. 只读取 settingsManager.getAll() 返回的 settings.imageApi。
   2. settingsManager 的底层持久化为 SettingsStore -> DB.js / IndexedDB。
   3. 不使用 localStorage/sessionStorage，不写双份存储兜底。
   ========================================================================== */
export function getDefaultChatImageApiSettings() {
  return {
    version: 2,
    provider: 'siliconflow',
    enabled: false,
    baseUrl: '',
    apiKey: '',
    model: '',
    availableModels: []
  };
}

export function normalizeChatImageApiSettings(input) {
  const defaults = getDefaultChatImageApiSettings();
  const source = input && typeof input === 'object' ? input : {};
  const provider = normalizeProviderId(source.provider || defaults.provider);
  const model = String(source.model || '').trim();

  return {
    version: 2,
    provider,
    enabled: Boolean(source.enabled),
    baseUrl: provider === 'openai'
      ? trimSlash(source.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl)
      : '',
    apiKey: String(source.apiKey || '').trim(),
    model,
    availableModels: uniqueStrings([...(Array.isArray(source.availableModels) ? source.availableModels : []), model])
  };
}

export async function getChatImageApiSettings(settingsManager) {
  const allSettings = settingsManager && typeof settingsManager.getAll === 'function'
    ? await settingsManager.getAll()
    : {};
  return normalizeChatImageApiSettings(allSettings?.imageApi);
}

export function isChatImageApiReady(imageApi) {
  const api = normalizeChatImageApiSettings(imageApi);
  return Boolean(api.enabled && api.apiKey && api.model);
}

export function getEffectiveChatImageBaseUrl(imageApi) {
  const api = normalizeChatImageApiSettings(imageApi);
  if (api.provider === 'openai') return trimSlash(api.baseUrl || IMAGE_API_PROVIDER_META.openai.defaultBaseUrl);
  return SILICONFLOW_IMAGE_BASE_URL;
}

/* ==========================================================================
   闲谈 AI 生图提示词
   说明：
   1. 由 prompt.js 调用并拼进 system prompt。
   2. 只有生图 API 已开启且配置完整时，才允许 AI 输出 [图片] 协议。
   3. [图片] 内容必须是给生图模型的画面描述，不是 URL，也不是解释。
   4. 已补充主动生图生活逻辑：默认生成场景/环境/餐食/物品图，禁止擅自生成真人主体图；远距离分享生活环境时更适合发图，近距离除定位式场景外不机械发图；图片气泡不固定放在末尾，可按真实聊天节奏前后搭配文字。
   ========================================================================== */
export function buildChatImageGenerationPrompt({ imageApi } = {}) {
  const api = normalizeChatImageApiSettings(imageApi);

  if (!isChatImageApiReady(api)) {
    return createPromptSection('AI生图能力', [
      '当前设置应用中的生图 API 未开启或配置不完整。',
      '你本轮禁止输出 [图片] 协议。',
      '如果想表达视觉内容，请改用 [回复] 自然描述，不要假装已经发送图片。'
    ].join('\n'));
  }

  return createPromptSection('AI生图能力', `# AI 主动生图规则
1. 当前设置应用中的生图 API 已开启且配置完整；当聊天情境自然适合时，你可以主动输出 [图片] 协议，让系统调用生图模型并把图片发送到本轮对话中。
2. 你不仅要遵守用户明确的看图/照片/看看你在哪儿等指令，也可以根据角色人设、当前会话内容、时间与地点语境，主动分享符合角色生活感的画面。
3. 主动生图默认只能生成生活场景图、环境图、风景图、房间图、街道图、天气氛围图、餐食饮品图、宠物图或具体物品图；例如“给用户看你现在在哪里、周围有什么、中午吃了什么”时，应生成相应的所在地环境、周围场景或餐食画面。
4. 除非用户明确要求真人照、露脸照、自拍、全身照、身材照、腹肌照、让我看看你的脸等真人主体图片，否则禁止主动生成带真人、真人比例人物、人物肖像或以人物身体为主体的图片；不要把普通“看看你那边/你在哪/吃什么”的请求擅自理解成要看真人。
5. 适合主动生图的情境包括但不限于：
   - 用户明确说“让我看看你现在在哪儿”“拍给我看看”“发张图”。
   - 用户询问“今天晚上吃了什么”“你那边什么样”“你走到哪里了”。
   - 当前聊天讨论到风景、餐食、房间、街道、天气、旅途、宠物、物件或角色正在经历的视觉场景。
   - 角色按人设会自然分享风景、饭菜、随手拍或生活片段，但画面应优先表现环境与物品，而不是人物主体。
6. 物理距离会影响是否主动生图：
   - 当你和用户现实物理距离很近时，除非是“我就在这，你是不是快到了”“我到门口了”“看这个位置你认不认得”这类发图相当于发定位、确认位置或帮助对方找到你的场景，否则没必要主动调用生图 API 发送图片。
   - 当你和用户现实物理距离较远时，为了分享风景、周围环境、正在吃的喝的东西、房间状态、路上见闻等因距离远才想给对方看的生活内容，主动发送场景类图片更符合生活逻辑。
7. [图片] 协议格式必须是完整协议块：**\`[图片] 角色名：生图提示词描述\`**。
8. [图片] 的“内容”要写成给生图模型看的画面提示词，必须结合：
   - 当前角色人设与身份；
   - 当前会话上下文；
   - 用户本轮指令；
   - 角色此刻可能所处环境、时间、氛围；
   - 画面主体、场景、光线、构图、风格。
9. [图片] 内容禁止写 URL、资源ID、Markdown 链接、接口名、模型名、API 调用说明或“我正在生成图片”等幕后说明。
10. 如果输出 [图片]，不要每次都把图片固定放在本轮消息末尾或最后一个气泡；图片可以自然出现在本轮聊天节奏的前面或中间，也可以先发 [图片] 再接一条 [回复]，例如“我今天中午吃这个”。
11. 也可以围绕图片前后各发一条自然 [回复]，例如先说“我到公司了”，再发 [图片]，再问“你也到单位/学校了吗”；具体顺序要像真实聊天随手发图，不要机械套模板。
12. 如果输出 [图片]，最好搭配一条自然 [回复]，像真实聊天中发照片前后随口说一句；但仍必须遵守每轮气泡数量限制。
13. 不要每轮机械发图；只有视觉信息能增强真实感、回应用户需求或符合角色主动分享动机时才发图。`);
}

/* ==========================================================================
   [区域标注·已完成·AI生图] AI 回复中的 [图片] 协议解析
   说明：
   1. 只解析 AI 本轮回复文本，不读写任何存储。
   2. 兼容完整 Markdown 协议块与轻微缺失加粗/反引号的情况。
   3. 解析结果交给生图请求函数调用设置应用中已开启的生图模型。
   ========================================================================== */
export function extractChatImageGenerationRequests(text) {
  const visibleText = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
  if (!visibleText) return [];

  const markerRegex = /(?:\*\*)?\s*`?\s*\[图片\]\s*([^：:\n`*]+?)\s*[：:]\s*/g;
  const matches = [...visibleText.matchAll(markerRegex)];
  if (!matches.length) return [];

  return matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const contentStart = Number(match.index || 0) + String(match[0] || '').length;
      const contentEnd = nextMatch ? Number(nextMatch.index || visibleText.length) : visibleText.length;
      const prompt = cleanProtocolContent(visibleText.slice(contentStart, contentEnd));
      return {
        roleName: String(match[1] || '').trim(),
        prompt,
        rawProtocol: cleanProtocolContent(visibleText.slice(Number(match.index || 0), contentEnd))
      };
    })
    .filter(item => item.prompt);
}

/* ==========================================================================
   [区域标注·已完成·AI生图] 生图 API 请求
   说明：
   1. 调用设置应用已配置并启用的生图 API。
   2. 不保存预览图，不写额外缓存；返回的 imageUrl 由聊天消息对象随当前会话写入 IndexedDB。
   3. 兼容 URL 与 b64_json 返回格式。
   ========================================================================== */
export async function requestChatImageGeneration(imageApi, prompt) {
  const api = normalizeChatImageApiSettings(imageApi);
  const safePrompt = String(prompt || '').trim();

  if (!api.enabled) throw new Error('生图 API 未启用');
  if (!api.apiKey) throw new Error('生图 API Key 不能为空');
  if (!api.model) throw new Error('请先在设置应用中选择生图模型');
  if (!safePrompt) throw new Error('生图提示词不能为空');

  const response = await fetch(`${getEffectiveChatImageBaseUrl(api)}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${api.apiKey}`
    },
    body: JSON.stringify({
      model: api.model,
      prompt: safePrompt,
      n: 1,
      size: '1024x1024'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(extractApiErrorMessage(payload, `HTTP ${response.status}`));

  const imageUrl =
    payload?.data?.[0]?.url ||
    (payload?.data?.[0]?.b64_json ? `data:image/png;base64,${payload.data[0].b64_json}` : '') ||
    payload?.images?.[0]?.url ||
    (payload?.images?.[0]?.b64_json ? `data:image/png;base64,${payload.images[0].b64_json}` : '');

  if (!imageUrl) throw new Error('生图接口未返回可用图片');
  return imageUrl;
}

/* ==========================================================================
   [区域标注·已完成·AI生图] 从 AI 回复生成图片结果
   说明：
   1. prompt.js 在主聊天 API 返回后调用本函数。
   2. 若生图 API 未启用或配置不完整，则不会调用接口。
   3. 返回 generatedImages 给聊天消息页转成 type:image 消息并写入当前聊天记录。
   ========================================================================== */
export async function generateImagesFromChatReply({ text = '', imageApi } = {}) {
  const api = normalizeChatImageApiSettings(imageApi);
  const requests = extractChatImageGenerationRequests(text);

  if (!requests.length || !isChatImageApiReady(api)) return [];

  const generatedImages = [];
  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const imageUrl = await requestChatImageGeneration(api, request.prompt);
    generatedImages.push({
      id: `ai_generated_image_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`,
      roleName: request.roleName,
      prompt: request.prompt,
      imageUrl,
      imageName: request.prompt.slice(0, 42) || 'AI 生图',
      rawProtocol: request.rawProtocol
    });
  }

  return generatedImages;
}
