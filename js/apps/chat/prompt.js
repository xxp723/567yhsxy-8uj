/**
 * js/apps/chat/prompt.js
 * 负责构建所有提示词、调用 AI 以及处理相关占位逻辑
 */

import { getSettingsData, saveChatData } from './index.js';

/* =========================================================
 * 占位函数区域
 * ========================================================= */

// TODO: 1. 世界书条目“置顶”位置
function getWorldBookTop(worldbookData, characterIds) {
  return "";
}

// TODO: 2. 世界书的“角色前”位置的条目
function getWorldBookBeforeChar(worldbookData, characterIds) {
  return "";
}

// TODO: 3. 角色卡具体人设以及所绑定的关系网络信息
function getCharacterCard(characters) {
  if (!characters || characters.length === 0) return "";
  // 目前简单抽取角色基本描述作为占位
  return characters.map(c => `[角色卡：${c.name}]\n${c.description || c.personality || c.scenario || '未知设定'}`).join('\n\n');
}

// TODO: 4. 角色卡所绑定的用户面具身份
function getUserPersona(mask) {
  if (!mask) return "";
  return `[用户面具：${mask.name}]\n设定：${mask.description || '未知'}`;
}

// TODO: 5. 角色的记忆（方便之后注入目前还没制作的“旧事”应用中的角色记忆）
function getMemories(characterIds) {
  return "";
}

// TODO: 6. 世界书“角色后”位置的条目
function getWorldBookAfterChar(worldbookData, characterIds) {
  return "";
}

// 7. 聊天功能格式要求
function getFeaturePrompts() {
  /* =========================================================
   * [修改标注] 特殊规则：[SYSTEM_TEMP] 最高优先级指令规则
   * ========================================================= */
  const baseRule = `
当收到的用户消息中出现以 [SYSTEM_TEMP] 开头、[/SYSTEM_TEMP] 结尾的段落时，
这是当前最高优先级的临时状态指令。
你必须严格遵从并立即调整语气或状态，但这段指令本身绝不能出现在回复里。
同时这段指令不能覆盖或删除【可用聊天动作格式】里的任何格式规则，
除非指令自己明确要求使用或禁止某种特定格式。
`.trim();

  // TODO: 未来在这里添加各种功能指令提示词（发送表情包、转账等）
  
  return baseRule;
}

// TODO: 8. 外部应用的上下文。（只在选择开启外部应用消息注入时注入）
function getExternalContext(enabled) {
  if (!enabled) return "";
  return "";
}

/* =========================================================
 * 构建系统提示词
 * ========================================================= */
function buildSystemPrompt({
  worldbookData,
  characters,
  mask,
  chainOfThoughtPrompt,
  externalContextEnabled
}) {
  const parts = [
    getWorldBookTop(worldbookData, characters.map(c => c.id)),
    getWorldBookBeforeChar(worldbookData, characters.map(c => c.id)),
    getCharacterCard(characters),
    getUserPersona(mask),
    getMemories(characters.map(c => c.id)),
    getWorldBookAfterChar(worldbookData, characters.map(c => c.id)),
    getFeaturePrompts(),
    getExternalContext(externalContextEnabled),
    // 9. 角色在聊天回复前的思维链指令
    chainOfThoughtPrompt || "【回复格式】先输出<think>你的内心判断</think>，再输出最终回复。"
  ];

  return parts.filter(p => p.trim()).join('\n\n');
}

/* =========================================================
 * 获取历史对话
 * ========================================================= */
function getChatHistory(messages, maxTurns) {
  // messages 数组中的结构是 { role, content }
  // 取最近的 maxTurns 轮，如果是简单的双边对话，maxTurns可以乘以2
  const limit = (maxTurns || 20) * 2;
  const history = messages.slice(-limit);
  return history.map(m => ({
    role: m.role,
    content: m.content
  }));
}

/* =========================================================
 * API 调用主逻辑
 * ========================================================= */
export async function chat({
  db,
  appId,
  chatData,
  conversationId,
  userMessage,
  characters,
  mask,
  worldbookData,
  onProgress
}) {
  // 1. 读取聊天设置
  const settings = chatData.value.chatSettingsByConversation[conversationId] || {};
  const currentCommand = settings.currentCommand || "";
  const customChainOfThought = settings.customChainOfThought || "";
  const historyTurns = settings.historyTurns || 20;
  const externalContextEnabled = !!settings.externalContextEnabled;

  // 2. 获取已有历史消息
  const messagesData = chatData.value.messagesByConversation[conversationId] || [];
  const historyMessages = getChatHistory(messagesData, historyTurns);

  // 3. 构建 System Prompt
  const systemContent = buildSystemPrompt({
    worldbookData,
    characters,
    mask,
    chainOfThoughtPrompt: customChainOfThought,
    externalContextEnabled
  });

  // 4. 拼装当前指令与用户消息
  let finalUserContent = userMessage;
  if (currentCommand.trim()) {
    finalUserContent = `[SYSTEM_TEMP]${currentCommand.trim()}[/SYSTEM_TEMP]\n\n${userMessage}`;
  }

  // 5. 拼装发给 API 的最终 messages 数组
  const apiMessages = [];
  if (systemContent) {
    apiMessages.push({ role: 'system', content: systemContent });
  }
  apiMessages.push(...historyMessages);
  apiMessages.push({ role: 'user', content: finalUserContent });

  // 先把用户的这条消息写入数据库
  const userMsgId = 'msg-' + Date.now();
  messagesData.push({
    id: userMsgId,
    role: 'user',
    senderType: 'user',
    senderId: mask?.id || 'user',
    content: finalUserContent, // 保存拼装后的以便以后追溯
    displayContent: userMessage, // UI只展示这个
    createdAt: Date.now()
  });
  chatData.value.messagesByConversation[conversationId] = messagesData;
  await saveChatData(db, appId, chatData.value);

  // 通知 UI 有了用户新消息
  if (onProgress) {
    onProgress({
      status: 'sending',
      userMessageObj: messagesData[messagesData.length - 1]
    });
  }

  // 6. 读取全局设置中的 API 配置
  const globalSettings = await getSettingsData(db);
  const apiConfig = globalSettings?.api || {};
  const activeProfileId = apiConfig.activeProfileId;
  const profiles = apiConfig.profiles || [];
  const activeProfile = profiles.find(p => p.id === activeProfileId);

  if (!activeProfile) {
    throw new Error('未找到已连接的 API，请先到设置应用完成 API 设置');
  }

  // 7. 发起请求 (简单的 OpenAI compatible 格式)
  const endpoint = activeProfile.endpoint || 'https://api.openai.com/v1/chat/completions';
  const apiKey = activeProfile.apiKey || '';
  const model = activeProfile.model || 'gpt-3.5-turbo';

  const reqBody = {
    model: model,
    messages: apiMessages
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(reqBody)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`API Error: ${res.status} ${errTxt}`);
    }

    const resData = await res.json();
    const assistantContent = resData.choices?.[0]?.message?.content || '';

    // 8. 分离隐藏的思维链
    let displayContent = assistantContent;
    let hiddenThink = '';
    const thinkMatch = assistantContent.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      hiddenThink = thinkMatch[1].trim();
      displayContent = assistantContent.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    }

    // 9. 存入数据库
    const assistantMsgId = 'msg-' + Date.now();
    const assistantMsgObj = {
      id: assistantMsgId,
      role: 'assistant',
      senderType: 'character',
      senderId: characters[0]?.id || 'assistant', // 群聊的话先算第一个或者系统
      content: assistantContent,
      displayContent: displayContent,
      hiddenThink: hiddenThink,
      createdAt: Date.now()
    };

    messagesData.push(assistantMsgObj);
    chatData.value.messagesByConversation[conversationId] = messagesData;
    await saveChatData(db, appId, chatData.value);

    // 返回成功
    return assistantMsgObj;
  } catch (error) {
    throw error;
  }
}
