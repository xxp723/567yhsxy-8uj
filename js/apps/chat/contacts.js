/**
 * js/apps/chat/contacts.js
 * 通讯录板块逻辑
 */

import { esc, saveChatData } from './index.js';

export async function renderContacts(ctx) {
  const { container, state, ICONS, closeApp, openModal, showToast, db, appId } = ctx;

  if (!state.activeMaskId) {
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #999;">
        <h2>未开启用户面具</h2>
        <p>请先在“档案应用”中激活一个用户面具身份，以便管理通讯录。</p>
      </div>
    `;
    return;
  }

  const maskId = state.activeMaskId;
  const renderHTML = () => {
    const contacts = state.chatData.value.contactsByMask[maskId] || [];

    const listHtml = contacts.length 
      ? contacts.map(c => `
          <div class="chat-contact-item">
            <img class="chat-contact-avatar" src="${esc(c.avatar || 'assets/icons/icon-192.png')}">
            <div class="chat-contact-name">${esc(c.name)}</div>
          </div>
        `).join('')
      : '<div style="color:#999;text-align:center;padding:20px;">暂无联系人，请点击右上角添加。</div>';

    container.innerHTML = `
      <div class="chat-contacts-header">
        <div class="chat-contacts-topbar">
          <button class="chat-btn-back" id="btn-back-desktop" style="transform: rotate(180deg)">${ICONS.chevronRight}</button>
          <div class="chat-title">Contacts</div>
          <button class="chat-btn-add" id="btn-add-contact">${ICONS.add}</button>
        </div>
      </div>
      <div class="chat-contacts-body">
        ${listHtml}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelector('#btn-back-desktop').addEventListener('click', closeApp);

    container.querySelector('#btn-add-contact').addEventListener('click', () => {
      const allCharacters = state.archiveData?.characters || [];
      const currentContacts = state.chatData.value.contactsByMask[maskId] || [];
      
      openModal({
        title: '添加联系人',
        body: `
          <input type="text" class="chat-search-input" id="search-char-input" placeholder="搜索档案中的角色...">
          <div id="search-char-result" style="max-height:300px;overflow-y:auto;">
            <!-- 搜索结果列表 -->
          </div>
        `,
        hideFooter: true
      });

      const modalPanel = document.querySelector('.chat-modal__panel');
      const input = modalPanel.querySelector('#search-char-input');
      const resultArea = modalPanel.querySelector('#search-char-result');

      const renderSearch = (keyword = '') => {
        const keywordLower = keyword.toLowerCase();
        const available = allCharacters.filter(c => {
          if (currentContacts.some(cc => cc.id === c.id)) return false; // 已添加的不显示
          if (!keywordLower) return true;
          return c.name.toLowerCase().includes(keywordLower);
        });

        if (available.length === 0) {
          resultArea.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">没有找到可添加的角色</div>';
          return;
        }

        resultArea.innerHTML = available.map(c => `
          <div class="chat-search-item">
            <img src="${esc(c.avatar || 'assets/icons/icon-192.png')}">
            <span>${esc(c.name)}</span>
            <button class="chat-btn-add-contact" data-id="${c.id}">添加</button>
          </div>
        `).join('');
      };

      input.addEventListener('input', (e) => renderSearch(e.target.value));
      
      resultArea.addEventListener('click', async (e) => {
        if (e.target.classList.contains('chat-btn-add-contact')) {
          const charId = e.target.dataset.id;
          const char = allCharacters.find(c => c.id === charId);
          if (char) {
            if (!state.chatData.value.contactsByMask[maskId]) {
              state.chatData.value.contactsByMask[maskId] = [];
            }
            state.chatData.value.contactsByMask[maskId].push({
              id: char.id,
              name: char.name,
              avatar: char.avatar
            });
            await saveChatData(db, appId, state.chatData.value);
            showToast(`已添加 ${char.name}`);
            renderSearch(input.value); // 刷新结果
            renderHTML(); // 刷新底层列表
          }
        }
      });

      // 初始渲染
      renderSearch();
    });
  };

  renderHTML();
}
