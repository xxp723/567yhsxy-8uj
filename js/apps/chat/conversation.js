/**
 * js/apps/chat/conversation.js
 * 聊天消息界面与API逻辑
 */

import { esc, saveChatData } from './index.js';
import { buildSystemPrompt } from './prompt.js';

export async function openConversation(ctx, conversation) {
  const { container, state, ICONS, showToast, db, appId, getAppContainer } = ctx;
  const maskId = state.activeMaskId;

  // 找到对应的 mask 和 target
  const archiveData = state.archiveData || { masks: [], characters: [] };
  const currentMask = archiveData.masks.find(m => m.id === maskId);
  const isGroup = conversation.type === 'group';
  
  let targetName = 'Unknown';
  let targetAvatar = 'assets/icons/icon-192.png';
  let targetDesc = '';

  if (isGroup) {
    targetName = conversation.name;
    targetAvatar = conversation.avatar || 'assets/icons/icon-192.png';
    targetDesc = `${conversation.members?.length || 0} members`;
  } else {
    const targetId = conversation.members.find(id => id !== maskId);
    const targetChar = archiveData.characters.find(c => c.id === targetId);
    if (targetChar) {
      targetName = targetChar.name;
      targetAvatar = targetChar.avatar || 'assets/icons/icon-192.png';
      targetDesc = targetChar.description || 'Offline';
    }
  }

  // 确保对话设置存在
  if (!conversation.settings) {
    conversation.settings = {
      customCss: '',
      customThoughtChain: '',
      enableExternalContext: false,
      currentCommand: ''
    };
  }

  // 确保消息列表存在
  if (!state.chatData.value.messagesByConversation[conversation.id]) {
    state.chatData.value.messagesByConversation[conversation.id] = [];
  }

  // 创建覆盖层
  const appContainer = getAppContainer();
  const convView = document.createElement('div');
  convView.className = 'chat-conversation-view';
  
  // 自定义 CSS 注入点
  const customStyleNode = document.createElement('style');
  convView.appendChild(customStyleNode);

  const updateCustomCss = () => {
    customStyleNode.innerHTML = conversation.settings.customCss || '';
  };
  updateCustomCss();

  convView.innerHTML += `
    <div class="chat-conv-header">
      <button class="chat-conv-back" id="btn-back-list" style="transform: rotate(180deg)">${ICONS.chevronRight}</button>
      <div class="chat-conv-title-info">
        <img class="chat-conv-avatar" src="${esc(targetAvatar)}">
        <div class="chat-conv-name-wrapper">
          <div class="chat-conv-name">${esc(targetName)}</div>
          <div class="chat-conv-status">${esc(targetDesc)}</div>
        </div>
      </div>
      <button class="chat-conv-settings-btn" id="btn-conv-settings">${ICONS.settings}</button>
    </div>
    
    <div class="chat-conv-body" id="chat-msg-list"></div>
    
    <div class="chat-conv-footer-wrapper">
      <div class="chat-conv-footer">
        <button class="chat-conv-btn-func" id="btn-func-toggle">☕</button>
        <input type="text" class="chat-conv-input" id="chat-input" placeholder="Type a message...">
        <button class="chat-conv-btn-inject" id="btn-inject" title="API 响应">✨</button>
        <button class="chat-conv-btn-send" id="btn-send" title="发送">${ICONS.send}</button>
      </div>
    </div>

    <div class="chat-conv-func-panel" id="func-panel">
      <div class="chat-conv-func-item" id="func-emoji">
        <div class="chat-conv-func-icon">${ICONS.emoji}</div>
        <span>表情</span>
      </div>
      <div class="chat-conv-func-item" id="func-transfer">
        <div class="chat-conv-func-icon">${ICONS.wallet}</div>
        <span>转账</span>
      </div>
    </div>

    <!-- 设置面板 -->
    <div class="chat-conv-settings hidden" id="conv-settings-panel">
      <div class="chat-conv-settings-header">
        <button class="chat-conv-back" id="btn-close-settings">${ICONS.chevronRight}</button>
        <span style="flex:1;">聊天设置</span>
      </div>
      <div class="chat-conv-settings-body">
        <div class="chat-conv-settings-item">
          <label>当前指令 (临时)</label>
          <textarea id="set-command" rows="3" placeholder="将被 [SYSTEM_TEMP] 包裹">${esc(conversation.settings.currentCommand || '')}</textarea>
        </div>
        <div class="chat-conv-settings-item">
          <label>自定义思维链</label>
          <textarea id="set-thought" rows="3" placeholder="默认思维链提示词">${esc(conversation.settings.customThoughtChain || '')}</textarea>
        </div>
        <div class="chat-conv-settings-item">
          <label>自定义 CSS</label>
          <textarea id="set-css" rows="5" placeholder="可覆盖消息界面样式">${esc(conversation.settings.customCss || '')}</textarea>
        </div>
        <div class="chat-conv-settings-item" style="display:flex; align-items:center;">
          <label style="margin:0; flex:1;">注入外部应用上下文</label>
          <input type="checkbox" id="set-ext-ctx" ${conversation.settings.enableExternalContext ? 'checked' : ''} style="width:auto; transform:scale(1.5);">
        </div>
        <button class="chat-btn chat-btn--primary" id="btn-save-settings" style="width:100%; margin-top:20px;">保存设置</button>
      </div>
    </div>
  `;

  appContainer.appendChild(convView);

  const msgList = convView.querySelector('#chat-msg-list');
  const input = convView.querySelector('#chat-input');
  const funcPanel = convView.querySelector('#func-panel');
  const settingsPanel = convView.querySelector('#conv-settings-panel');

  const scrollToBottom = () => {
    setTimeout(() => {
      msgList.scrollTop = msgList.scrollHeight;
    }, 50);
  };

  const renderMessages = () => {
    const msgs = state.chatData.value.messagesByConversation[conversation.id];
    msgList.innerHTML = msgs.map(m => {
      const isMe = m.senderId === maskId;
      const avatar = isMe ? currentMask.avatar : targetAvatar;
      
      // 去除内容中的 <think>...</think> 部分
      let displayContent = m.content || '';
      displayContent = displayContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

      if (!displayContent && m.content.includes('<think>')) {
        displayContent = '<em style="color:#999;">(正在思考)</em>';
      }

      return `
        <div class="chat-msg-row ${isMe ? 'chat-msg-row--right' : 'chat-msg-row--left'}">
          <img class="chat-msg-avatar" src="${esc(avatar || 'assets/icons/icon-192.png')}">
          <div class="chat-msg-bubble-wrap">
            <div class="chat-msg-bubble">${esc(displayContent).replace(/\n/g, '<br>')}</div>
            <div class="chat-msg-time">${new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
      `;
    }).join('');
    scrollToBottom();
  };

  // 添加新消息到本地 state
  const appendMessage = async (senderId, role, content) => {
    const msg = {
      id: 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5),
      senderId,
      role,
      content,
      createdAt: new Date().toISOString()
    };
    state.chatData.value.messagesByConversation[conversation.id].push(msg);
    // 更新会话最后活跃时间
    conversation.updatedAt = msg.createdAt;
    await saveChatData(db, appId, state.chatData.value);
    renderMessages();
  };

  // 绑定事件
  convView.querySelector('#btn-back-list').addEventListener('click', () => {
    convView.remove();
  });

  // 功能面板切换
  let isFuncOpen = false;
  convView.querySelector('#btn-func-toggle').addEventListener('click', () => {
    isFuncOpen = !isFuncOpen;
    funcPanel.classList.toggle('show', isFuncOpen);
  });

  // 设置面板
  convView.querySelector('#btn-conv-settings').addEventListener('click', () => {
    settingsPanel.classList.remove('hidden');
  });
  convView.querySelector('#btn-close-settings').addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
  });
  convView.querySelector('#btn-save-settings').addEventListener('click', async () => {
    conversation.settings.currentCommand = convView.querySelector('#set-command').value;
    conversation.settings.customThoughtChain = convView.querySelector('#set-thought').value;
    conversation.settings.customCss = convView.querySelector('#set-css').value;
    conversation.settings.enableExternalContext = convView.querySelector('#set-ext-ctx').checked;
    
    await saveChatData(db, appId, state.chatData.value);
    updateCustomCss();
    settingsPanel.classList.add('hidden');
    showToast('设置已保存');
  });

  // 仅发送消息 (不触发API)
  const doSend = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    isFuncOpen = false;
    funcPanel.classList.remove('show');
    await appendMessage(maskId, 'user', text);
  };
  convView.querySelector('#btn-send').addEventListener('click', doSend);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSend();
  });

  // 注入 API 获取回复
  const doInject = async () => {
    const text = input.value.trim();
    input.value = '';
    isFuncOpen = false;
    funcPanel.classList.remove('show');

    // 1. 如果有输入内容，先作为用户的消息发出去
    if (text) {
      await appendMessage(maskId, 'user', text);
    }

    // 2. 读取系统 API 设置
    const settingsData = await db.get('app_settings');
    if (!settingsData?.api?.enabled) {
      showToast('API 未开启，请在设置中开启');
      return;
    }
    const endpointId = settingsData.api.selectedEndpoint;
    const endpoint = settingsData.api.endpoints.find(e => e.id === endpointId);
    if (!endpoint) {
      showToast('未找到配置的 API Endpoint');
      return;
    }

    // 3. 构建 Prompt
    const currentMsgs = state.chatData.value.messagesByConversation[conversation.id];
    
    // 我们需要在获取 Prompt 时提供构建上下文所需的参数
    const promptCtx = {
      archiveData,
      currentMask,
      targetChar: archiveData.characters.find(c => !isGroup && c.id === conversation.members.find(id => id !== maskId)),
      conversation,
      messages: currentMsgs,
      // lastUserMessage: text || (currentMsgs.length > 0 ? currentMsgs[currentMsgs.length-1].content : '')
    };

    const messagesToApi = buildSystemPrompt(promptCtx);

    // 4. 添加 Loading 状态
    const loadingId = 'loading_' + Date.now();
    msgList.innerHTML += `
      <div class="chat-msg-row chat-msg-row--left" id="${loadingId}">
        <img class="chat-msg-avatar" src="${esc(targetAvatar)}">
        <div class="chat-msg-bubble-wrap">
          <div class="chat-msg-bubble" style="min-width: 50px;">
            <div class="chat-typing-indicator"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
    `;
    scrollToBottom();

    // 5. 发起请求
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${endpoint.apiKey || ''}`
        },
        body: JSON.stringify({
          model: endpoint.model,
          messages: messagesToApi,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const replyContent = data.choices?.[0]?.message?.content || '';

      // 移除 loading
      const loadingEl = msgList.querySelector(`#${loadingId}`);
      if (loadingEl) loadingEl.remove();

      // 保存回复
      await appendMessage(isGroup ? 'system' : conversation.members.find(id => id !== maskId), 'assistant', replyContent);

    } catch (error) {
      console.error(error);
      const loadingEl = msgList.querySelector(`#${loadingId}`);
      if (loadingEl) loadingEl.remove();
      showToast('API 请求失败: ' + error.message);
    }
  };

  convView.querySelector('#btn-inject').addEventListener('click', doInject);

  // 占位功能点击
  convView.querySelector('#func-emoji').addEventListener('click', () => { showToast('功能占位：发送表情'); });
  convView.querySelector('#func-transfer').addEventListener('click', () => { showToast('功能占位：转账'); });

  renderMessages();
}
