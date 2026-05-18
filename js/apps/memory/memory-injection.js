/**
 * 文件名: js/apps/memory/memory-injection.js
 * 用途: 旧事应用注入统计、优先级与预览规则。
 * 说明:
 * 1. 本文件只计算，不直接调用 API，不写持久化数据。
 * 2. 重点长期记忆 = 每次固定靠前注入；允许注入 = 靠后补充候选资格。
 */

/* ==========================================================================
   [区域标注·已完成·旧事统计口径区]
   说明：
   1. UI 统计已同步为“总记忆数 / 允许注入 / 重点长期 / 补充候选”。
   2. “重点长期”内部复用 isPermanent 字段，仅作为固定靠前注入标记，不再展示为用户侧独立开关。
   ========================================================================== */
export function getMemoryStats(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.length;
  const injected = safeItems.filter((item) => item.injectionEnabled).length;
  const focusLongterm = safeItems.filter((item) => item.type === 'longterm' && item.isPermanent).length;
  const supplemental = safeItems.filter((item) => (
    item.type !== 'pending' &&
    item.injectionEnabled &&
    !(item.type === 'longterm' && item.isPermanent)
  )).length;

  return {
    total,
    injected,
    focusLongterm,
    supplemental
  };
}

/* ==========================================================================
   [区域标注·已完成·旧事注入优先级区]
   说明：
   1. 重点长期记忆：每次固定注入，权重最高，注入位置最靠前。
   2. 普通允许注入记忆：进入靠后的补充候选池，不保证每次注入。
   3. 待确认 / 未开启注入：不自动进入注入池。
   4. 本区只更新排序与候选规则，不新增任何 localStorage/sessionStorage 兜底。
   ========================================================================== */
export function getInjectionWeight(item) {
  if (!item) return 0;
  if (item.type === 'longterm' && item.isPermanent) return 1000;
  if (item.type === 'pending') return 0;
  if (!item.injectionEnabled) return 0;
  return 300;
}

export function getInjectionCandidates(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => getInjectionWeight(item) > 0)
    .map((item) => ({
      ...item,
      injectionWeight: getInjectionWeight(item)
    }))
    .sort((a, b) => {
      if (b.injectionWeight !== a.injectionWeight) return b.injectionWeight - a.injectionWeight;
      return Number(b.timelineAt || 0) - Number(a.timelineAt || 0);
    });
}

/* ========================================================================== 
   [区域标注·已完成·本次旧事注入预览精简结构区]
   说明：预览结构只保留“重点长期 / 补充候选 / 最终预览列表”三项有效口径；
   已删除历史废弃类型的空数组占位，避免后续误以为仍存在额外记忆类型。
   ========================================================================== */
export function buildInjectionPreview(items = []) {
  const candidates = getInjectionCandidates(items);
  const focusLongterm = candidates.filter((item) => item.type === 'longterm' && item.isPermanent);
  const supplemental = candidates.filter((item) => (
    !(item.type === 'longterm' && item.isPermanent) &&
    item.injectionEnabled
  ));

  return {
    permanent: focusLongterm,
    focusLongterm,
    supplemental,
    previewItems: [...focusLongterm, ...supplemental].slice(0, 8)
  };
}
