/**
 * js/apps/chat/profile.js
 * 用户主页板块逻辑
 */

import { esc, saveChatData } from './index.js';

export async function renderProfile(ctx) {
  const { container, state, ICONS, closeApp, openModal, showToast, db } = ctx;

  const archiveData = state.archiveData || { masks: [] };
  const allMasks = archiveData.masks || [];
  
  if (!state.activeMaskId || allMasks.length === 0) {
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #999;">
        <h2>未开启用户面具</h2>
        <p>请先在“档案应用”中激活一个用户面具身份，以便查看主页。</p>
        <button class="chat-btn chat-btn--primary" id="btn-back-desktop" style="margin-top:20px;">返回桌面</button>
      </div>
    `;
    container.querySelector('#btn-back-desktop')?.addEventListener('click', closeApp);
    return;
  }

  const maskId = state.activeMaskId;
  const currentMask = allMasks.find(m => m.id === maskId);
  const maskCount = allMasks.length;

  const contacts = state.chatData.value.contactsByMask[maskId] || [];
  const contactCount = contacts.length;

  // 聊天总天数统计(简化版：找该面具下所有对话的消息日期去重)
  const conversations = state.chatData.value.conversationsByMask[maskId] || [];
  const daysSet = new Set();
  conversations.forEach(conv => {
    const msgs = state.chatData.value.messagesByConversation[conv.id] || [];
    msgs.forEach(m => {
      const d = new Date(m.createdAt);
      daysSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
  });
  const chatDaysCount = daysSet.size;

  const renderHTML = () => {
    container.innerHTML = `
      <div class="chat-profile-scroll">
        <div class="chat-profile-header">
          <button class="chat-btn-back-profile" id="btn-back-desktop" style="transform: rotate(180deg)">${ICONS.chevronRight}</button>
          <div class="chat-profile-avatar-wrapper">
            <img class="chat-profile-avatar" src="${esc(currentMask?.avatar || 'assets/icons/icon-192.png')}">
          </div>
        </div>

        <div class="chat-profile-info">
          <div class="chat-profile-name">${esc(currentMask?.name || '未知身份')}</div>
          <div class="chat-profile-tags">
            <span class="chat-profile-tag">${esc(currentMask?.title || '用户')}</span>
            <span class="chat-profile-tag chat-profile-tag--outline">ID: ${esc(currentMask?.id?.slice(0,6) || '')}</span>
          </div>
          <div style="color:#999;font-size:12px;margin-bottom:20px;font-style:italic;">
            ${esc(currentMask?.description || '点击输入个性签名...')}
          </div>
        </div>

        <div class="chat-profile-cards">
          <div class="chat-profile-card" id="card-contacts">
            <div class="chat-profile-card-num">${contactCount}</div>
            <div class="chat-profile-card-label">好友数量</div>
          </div>
          <div class="chat-profile-card" id="card-masks">
            <div class="chat-profile-card-num">${maskCount}</div>
            <div class="chat-profile-card-label">身份数量</div>
          </div>
          <div class="chat-profile-card" id="card-days">
            <div class="chat-profile-card-num">${chatDaysCount}</div>
            <div class="chat-profile-card-label">聊天天数</div>
          </div>
        </div>

        <div class="chat-profile-menu">
          <div class="chat-profile-menu-item" id="menu-wallet">
            <div class="chat-profile-menu-icon">${ICONS.wallet}</div>
            <div class="chat-profile-menu-text">钱包</div>
            <div class="chat-profile-menu-arrow">${ICONS.chevronRight}</div>
          </div>
          <div class="chat-profile-menu-item" id="menu-emoji">
            <div class="chat-profile-menu-icon">${ICONS.emoji}</div>
            <div class="chat-profile-menu-text">表情包</div>
            <div class="chat-profile-menu-arrow">${ICONS.chevronRight}</div>
          </div>
        </div>
      </div>

      <!-- 子页面容器 (占位) -->
      <div id="chat-subpage-container" class="chat-subpage hidden">
        <div class="chat-subpage-header">
          <button class="chat-subpage-back" id="subpage-back">${ICONS.chevronRight}</button>
          <span id="subpage-title">详情</span>
        </div>
        <div class="chat-subpage-content" id="subpage-content"></div>
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelector('#btn-back-desktop').addEventListener('click', closeApp);

    // 快捷切换面具身份
    container.querySelector('#card-masks').addEventListener('click', () => {
      openModal({
        title: '切换身份',
        body: `
          <div style="max-height:300px;overflow-y:auto;">
            ${allMasks.map(m => `
              <div class="chat-modal-list-item switch-mask-item" data-id="${m.id}">
                <img src="${esc(m.avatar || 'assets/icons/icon-192.png')}">
                <span>${esc(m.name)}</span>
                ${m.id === state.activeMaskId ? '<span style="color:#d1df8a;font-size:12px;margin-left:10px;">当前</span>' : ''}
              </div>
            `).join('')}
          </div>
        `,
        hideFooter: true
      });

      const modalPanel = document.querySelector('.chat-modal__panel');
      modalPanel.addEventListener('click', async (e) => {
        const item = e.target.closest('.switch-mask-item');
        if (item) {
          const newId = item.dataset.id;
          if (newId === state.activeMaskId) return;

          // 更新全局状态和档案 DB
          state.activeMaskId = newId;
          archiveData.activeMaskId = newId;
          await db.put('app_archive', archiveData);
          showToast('切换身份成功');
          
          document.querySelector('#chat-modal').classList.add('hidden');
          renderProfile(ctx); // 刷新当前界面
        }
      });
    });

    // 其它卡片与折叠栏的二级页面
    const subpage = container.querySelector('#chat-subpage-container');
    const subTitle = container.querySelector('#subpage-title');
    const subContent = container.querySelector('#subpage-content');
    
    container.querySelector('#subpage-back').addEventListener('click', () => {
      subpage.classList.add('hidden');
    });

    const openSub = (title, contentHTML) => {
      subTitle.textContent = title;
      subContent.innerHTML = contentHTML;
      // 由于二级页面的后退按钮用了chevronRight，默认是指向右侧，我们需要把它转过来
      container.querySelector('#subpage-back').style.transform = 'rotate(180deg)';
      subpage.classList.remove('hidden');
    };

    container.querySelector('#card-contacts').addEventListener('click', () => {
      // 实际上可以跳转到通讯录tab，这里为了演示二级页面，显示个占位
      openSub('好友数量', '<div style="color:#999;text-align:center;padding:50px;">这里显示各好友的统计信息占位</div>');
    });
    container.querySelector('#card-days').addEventListener('click', () => {
      openSub('聊天天数', '<div style="color:#999;text-align:center;padding:50px;">这里显示和每个好友的聊天天数详情</div>');
    });
    container.querySelector('#menu-wallet').addEventListener('click', () => {
      openSub('钱包', '<div style="color:#999;text-align:center;padding:50px;">钱包详情占位</div>');
    });
    container.querySelector('#menu-emoji').addEventListener('click', () => {
      openSub('表情包', '<div style="color:#999;text-align:center;padding:50px;">表情包详情占位</div>');
    });
  };

  renderHTML();
}
