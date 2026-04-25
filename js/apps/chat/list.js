/**
 * js/apps/chat/list.js
 * 聊天列表板块
 */

import { esc, uid, saveChatData } from './index.js';

export async function renderList(ctx) {
  const { container, state, ICONS, openConversation, closeApp, openModal, showToast, db, appId } = ctx;

  // 如果没有面具身份，提示去档案设置
  if (!state.activeMaskId) {
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #999;">
        <h2>未开启用户面具</h2>
        <p>请先在“档案应用”中激活一个用户面具身份，以便开启闲谈。</p>
      </div>
    `;
    return;
  }

  const maskId = state.activeMaskId;
  const conversations = state.chatData.value.conversationsByMask[maskId] || [];
  const contacts = state.chatData.value.contactsByMask[maskId] || [];

  // 内部状态
  let currentTab = 'all'; // all, private, group
  let isPrivateCollapsed = false;
  let isGroupCollapsed = false;

  const renderHTML = () => {
    // 筛选对话
    const privateConvs = conversations.filter(c => c.type === 'private');
    const groupConvs = conversations.filter(c => c.type === 'group');

    let listHtml = '';
    
    const buildItem = (conv) => {
      const msgs = state.chatData.value.messagesByConversation[conv.id] || [];
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      let displayMsg = lastMsg ? lastMsg.displayContent : '暂无消息...';
      let displayTime = lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
      let unread = conv.unreadCount || 0;
      let badgeHtml = unread > 0 ? `<div class="chat-item-badge">${unread}</div>` : '';

      return `
        <div class="chat-item" data-id="${conv.id}">
          <img class="chat-item-avatar" src="${esc(conv.avatar || 'assets/icons/icon-192.png')}" alt="">
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-item-name">${esc(conv.name)}</span>
              <span class="chat-item-time">${displayTime}</span>
            </div>
            <div class="chat-item-bottom">
              <span class="chat-item-msg">${esc(displayMsg)}</span>
              ${badgeHtml}
            </div>
          </div>
        </div>
      `;
    };

    if (currentTab === 'all') {
      listHtml = `
        <div class="chat-list-group">
          <div class="chat-list-group-title" data-group="private">
            ${ICONS.chevronDown} Private Chats (${privateConvs.length})
          </div>
          <div class="chat-list-group-content ${isPrivateCollapsed ? 'is-collapsed' : ''}">
            ${privateConvs.length ? privateConvs.map(buildItem).join('') : '<div style="color:#aaa;padding:10px;">暂无单聊</div>'}
          </div>
        </div>
        <div class="chat-list-group">
          <div class="chat-list-group-title" data-group="group">
            ${ICONS.chevronDown} Group Chats (${groupConvs.length})
          </div>
          <div class="chat-list-group-content ${isGroupCollapsed ? 'is-collapsed' : ''}">
            ${groupConvs.length ? groupConvs.map(buildItem).join('') : '<div style="color:#aaa;padding:10px;">暂无群聊</div>'}
          </div>
        </div>
      `;
    } else if (currentTab === 'private') {
      listHtml = privateConvs.length ? privateConvs.map(buildItem).join('') : '<div style="color:#aaa;padding:10px;text-align:center;">暂无单聊</div>';
    } else if (currentTab === 'group') {
      listHtml = groupConvs.length ? groupConvs.map(buildItem).join('') : '<div style="color:#aaa;padding:10px;text-align:center;">暂无群聊</div>';
    }

    container.innerHTML = `
      <div class="chat-list-header">
        <div class="chat-list-topbar">
          <button class="chat-btn-back" id="btn-back-desktop" style="transform: rotate(180deg)">${ICONS.chevronRight}</button>
          <div class="chat-title">Chattie</div>
          <button class="chat-btn-add" id="btn-add-chat">${ICONS.add}</button>
        </div>
        <div class="chat-list-tabs">
          <div class="chat-list-tab ${currentTab === 'all' ? 'is-active' : ''}" data-tab="all">All</div>
          <div class="chat-list-tab ${currentTab === 'private' ? 'is-active' : ''}" data-tab="private">Private</div>
          <div class="chat-list-tab ${currentTab === 'group' ? 'is-active' : ''}" data-tab="group">Group</div>
        </div>
      </div>
      <div class="chat-list-body">
        ${listHtml}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // 退出
    container.querySelector('#btn-back-desktop').addEventListener('click', closeApp);

    // Tab 切换
    container.querySelectorAll('.chat-list-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        currentTab = e.currentTarget.dataset.tab;
        renderHTML();
      });
    });

    // 折叠展开
    container.querySelectorAll('.chat-list-group-title').forEach(el => {
      el.addEventListener('click', (e) => {
        const group = e.currentTarget.dataset.group;
        if (group === 'private') {
          isPrivateCollapsed = !isPrivateCollapsed;
        } else {
          isGroupCollapsed = !isGroupCollapsed;
        }
        renderHTML();
      });
    });

    // 进入对话
    container.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const convId = e.currentTarget.dataset.id;
        openConversation(convId);
      });
    });

    // 添加聊天
    container.querySelector('#btn-add-chat').addEventListener('click', () => {
      if (contacts.length === 0) {
        showToast('通讯录中还没有好友，请先去通讯录添加。');
        return;
      }
      
      openModal({
        title: '发起聊天',
        body: `
          <div style="margin-bottom:15px;">
            <button class="chat-btn chat-btn--default" id="tab-new-private" style="background:#6a6385;color:#fff;">单聊</button>
            <button class="chat-btn chat-btn--default" id="tab-new-group">群聊</button>
          </div>
          <div id="new-chat-content">
            <!-- 列表 -->
            ${contacts.map(c => `
              <div class="chat-modal-list-item" data-id="${c.id}" data-type="private-sel">
                <img src="${esc(c.avatar || 'assets/icons/icon-192.png')}">
                <span>${esc(c.name)}</span>
              </div>
            `).join('')}
          </div>
        `,
        hideFooter: true
      });

      // 绑定弹窗内事件
      const modalPanel = document.querySelector('.chat-modal__panel');
      const btnPrivate = modalPanel.querySelector('#tab-new-private');
      const btnGroup = modalPanel.querySelector('#tab-new-group');
      const contentArea = modalPanel.querySelector('#new-chat-content');

      let mode = 'private'; // private / group

      btnPrivate.onclick = () => {
        mode = 'private';
        btnPrivate.style.background = '#6a6385'; btnPrivate.style.color = '#fff';
        btnGroup.style.background = '#f0f0f0'; btnGroup.style.color = '#333';
        contentArea.innerHTML = contacts.map(c => `
          <div class="chat-modal-list-item" data-id="${c.id}" data-type="private-sel">
            <img src="${esc(c.avatar || 'assets/icons/icon-192.png')}">
            <span>${esc(c.name)}</span>
          </div>
        `).join('');
      };

      btnGroup.onclick = () => {
        mode = 'group';
        btnGroup.style.background = '#6a6385'; btnGroup.style.color = '#fff';
        btnPrivate.style.background = '#f0f0f0'; btnPrivate.style.color = '#333';
        contentArea.innerHTML = `
          <div class="chat-input-row">
            <label>群聊名称</label>
            <input type="text" id="new-group-name" placeholder="请输入群聊名称...">
          </div>
          <div style="margin-bottom:10px;font-weight:bold;">选择群成员:</div>
          <div style="max-height:200px;overflow-y:auto;">
            ${contacts.map(c => `
              <label class="chat-modal-list-item">
                <input type="checkbox" value="${c.id}" class="group-member-chk">
                <img src="${esc(c.avatar || 'assets/icons/icon-192.png')}" style="margin-left:10px">
                <span>${esc(c.name)}</span>
              </label>
            `).join('')}
          </div>
          <div style="margin-top:15px;text-align:right;">
            <button class="chat-btn chat-btn--primary" id="btn-create-group">创建群聊</button>
          </div>
        `;
      };

      // 委托点击
      contentArea.addEventListener('click', async (e) => {
        if (mode === 'private') {
          const item = e.target.closest('[data-type="private-sel"]');
          if (item) {
            const cId = item.dataset.id;
            const contact = contacts.find(c => c.id === cId);
            // 找有没有已经存在的单聊
            let conv = conversations.find(cv => cv.type === 'private' && cv.characterIds.includes(cId));
            if (!conv) {
              conv = {
                id: 'conv-' + uid(),
                type: 'private',
                name: contact.name,
                avatar: contact.avatar,
                characterIds: [cId],
                unreadCount: 0,
                updatedAt: Date.now()
              };
              conversations.unshift(conv);
              state.chatData.value.conversationsByMask[maskId] = conversations;
              await saveChatData(db, appId, state.chatData.value);
            }
            // 关闭弹窗
            document.querySelector('#chat-modal').classList.add('hidden');
            openConversation(conv.id);
          }
        } else {
          if (e.target.id === 'btn-create-group') {
            const nameInput = contentArea.querySelector('#new-group-name').value.trim();
            if (!nameInput) {
              showToast('请输入群聊名称');
              return;
            }
            const checked = Array.from(contentArea.querySelectorAll('.group-member-chk:checked')).map(n => n.value);
            if (checked.length === 0) {
              showToast('请至少选择一个群成员');
              return;
            }
            const conv = {
              id: 'conv-' + uid(),
              type: 'group',
              name: nameInput,
              avatar: 'assets/icons/icon-192.png', // 默认群头像
              characterIds: checked,
              unreadCount: 0,
              updatedAt: Date.now()
            };
            conversations.unshift(conv);
            state.chatData.value.conversationsByMask[maskId] = conversations;
            await saveChatData(db, appId, state.chatData.value);
            document.querySelector('#chat-modal').classList.add('hidden');
            openConversation(conv.id);
          }
        }
      });
    });
  };

  renderHTML();
}
