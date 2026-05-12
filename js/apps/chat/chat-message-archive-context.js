// @ts-nocheck
/**
 * 文件名: js/apps/chat/chat-message-archive-context.js
 * 用途: 闲谈应用 — 聊天消息页 AI 请求前档案上下文刷新子模块
 *       承载角色卡、用户面具、配角与关系网络的运行时刷新逻辑。
 * 架构层: 应用层（闲谈子模块）
 */

import { ARCHIVE_DB_RECORD_ID, dbGetArchiveData } from './chat-utils.js';
import { appendChatConsoleRuntimeLog } from './chat-message-console.js';

/* ==========================================================================
   [区域标注·已完成·本次 chat-message.js 继续拆分] AI 请求前档案上下文刷新
   说明：
   1. 本模块从 chat-message.js 中拆出，只负责在真正调用 AI 前通过 IndexedDB 读取最新档案数据。
   2. 刷新范围包括：角色卡、用户面具、配角、关系网络。
   3. 失败时仅记录聊天控制台运行时日志并沿用当前内存态，不中断聊天流程。
   4. 严禁使用 localStorage/sessionStorage，不做双份存储兜底。
   ========================================================================== */
export async function refreshArchiveContextForAiRequest(state, db, session = {}) {
  let latestArchive = null;

  try {
    latestArchive = await dbGetArchiveData(db, ARCHIVE_DB_RECORD_ID);
  } catch (error) {
    appendChatConsoleRuntimeLog(state, 'warn', `档案上下文读取失败，沿用当前缓存：${error?.message || '未知错误'}`);
  }

  const archiveData = latestArchive && typeof latestArchive === 'object' ? latestArchive : {};
  const latestMasks = Array.isArray(archiveData.masks) ? archiveData.masks : state.archiveMasks;
  const latestCharacters = Array.isArray(archiveData.characters) ? archiveData.characters : state.archiveCharacters;
  const latestSupportingRoles = Array.isArray(archiveData.supportingRoles) ? archiveData.supportingRoles : state.archiveSupportingRoles;
  const latestRelations = Array.isArray(archiveData.relations) ? archiveData.relations : state.archiveRelations;

  state.archiveMasks = Array.isArray(latestMasks) ? latestMasks : [];
  state.archiveCharacters = Array.isArray(latestCharacters) ? latestCharacters : [];
  state.archiveSupportingRoles = Array.isArray(latestSupportingRoles) ? latestSupportingRoles : [];
  state.archiveRelations = Array.isArray(latestRelations) ? latestRelations : [];

  const activeMaskId = String(state.activeMaskId || archiveData.activeMaskId || '').trim();
  const currentContact = (state.contacts || []).find(contact => String(contact.id) === String(session.id)) || null;
  const roleIdCandidates = [
    currentContact?.roleId,
    session?.roleId,
    currentContact?.id,
    session?.id
  ].map(value => String(value || '').trim()).filter(Boolean);

  const matchedCharacter = state.archiveCharacters.find(character => roleIdCandidates.includes(String(character?.id || '').trim())) || null;
  const matchedMask = state.archiveMasks.find(mask => String(mask?.id || '').trim() === activeMaskId) || null;

  const countDirectRelations = (ownerType, ownerId) => {
    const safeOwnerId = String(ownerId || '').trim();
    if (!safeOwnerId) return 0;
    return state.archiveRelations.filter(relation => (
      (String(relation?.ownerType || '') === ownerType && String(relation?.ownerId || '') === safeOwnerId)
      || (String(relation?.targetType || '') === ownerType && String(relation?.targetId || '') === safeOwnerId)
    )).length;
  };

  const characterSettingLength = String(matchedCharacter?.personalitySetting || '').trim().length;
  const maskSettingLength = String(matchedMask?.personalitySetting || '').trim().length;
  const characterRelationCount = countDirectRelations('character', matchedCharacter?.id);
  const maskRelationCount = countDirectRelations('mask', matchedMask?.id);

  appendChatConsoleRuntimeLog(
    state,
    'info',
    `档案上下文刷新：角色卡=${matchedCharacter ? '已匹配' : '未匹配'}，人物设定长度=${characterSettingLength}，角色关系=${characterRelationCount}；用户面具=${matchedMask ? '已匹配' : '未匹配'}，用户设定长度=${maskSettingLength}，面具关系=${maskRelationCount}`
  );

  return {
    activeMaskId,
    masks: state.archiveMasks,
    characters: state.archiveCharacters,
    supportingRoles: state.archiveSupportingRoles,
    relations: state.archiveRelations
  };
}
