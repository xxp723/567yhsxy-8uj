/**
 * js/apps/chat/moments.js
 * 朋友圈板块逻辑
 */

import { esc } from './index.js';

export async function renderMoments(ctx) {
  const { container, state, ICONS, closeApp } = ctx;

  if (!state.activeMaskId) {
    container.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: #999;">
        <h2>未开启用户面具</h2>
        <p>请先在“档案应用”中激活一个用户面具身份，以便查看朋友圈。</p>
      </div>
    `;
    return;
  }

  const maskId = state.activeMaskId;
  const archiveData = state.archiveData || { masks: [] };
  const currentMask = archiveData.masks.find(m => m.id === maskId);
  const contacts = state.chatData.value.contactsByMask[maskId] || [];

  // 生成一些占位的朋友圈动态
  const fakeMoments = [
    {
      id: 'm1',
      author: currentMask?.name || '我',
      avatar: currentMask?.avatar || 'assets/icons/icon-192.png',
      text: '今天天气真好，出去散散步~',
      image: null,
      time: '1小时前'
    }
  ];

  if (contacts.length > 0) {
    const c1 = contacts[0];
    fakeMoments.push({
      id: 'm2',
      author: c1.name,
      avatar: c1.avatar,
      text: '刚看完一本好书，推荐给大家！',
      image: 'assets/icons/icon-512.png',
      time: '3小时前'
    });
  }

  if (contacts.length > 1) {
    const c2 = contacts[1];
    fakeMoments.push({
      id: 'm3',
      author: c2.name,
      avatar: c2.avatar,
      text: '工作中，又是充实的一天...',
      image: null,
      time: '昨天'
    });
  }

  const renderHTML = () => {
    container.innerHTML = `
      <div class="chat-moments-header">
        <button class="chat-btn-back-moments" id="btn-back-desktop" style="transform: rotate(180deg)">${ICONS.chevronRight}</button>
        <div class="chat-moments-user-info">
          <div class="chat-moments-user-name">${esc(currentMask?.name || '未知身份')}</div>
          <img class="chat-moments-user-avatar" src="${esc(currentMask?.avatar || 'assets/icons/icon-192.png')}">
        </div>
      </div>
      <div class="chat-moments-body">
        ${fakeMoments.map(m => `
          <div class="chat-moment-item">
            <img class="chat-moment-avatar" src="${esc(m.avatar)}">
            <div class="chat-moment-content">
              <div class="chat-moment-name">${esc(m.author)}</div>
              <div class="chat-moment-text">${esc(m.text)}</div>
              ${m.image ? `<img class="chat-moment-image" src="${esc(m.image)}">` : ''}
              <div class="chat-moment-time">${esc(m.time)}</div>
            </div>
          </div>
        `).join('')}
        <div style="text-align:center;color:#ccc;padding:20px;font-size:12px;">- 到底了 -</div>
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    container.querySelector('#btn-back-desktop').addEventListener('click', closeApp);
  };

  renderHTML();
}
