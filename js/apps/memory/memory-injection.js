/**
 * 文件名: js/apps/memory/memory-injection.js
 * 用途: 旧事应用注入统计、优先级与预览规则。
 * 说明:
 * 1. 本文件只计算，不直接调用 API，不写持久化数据。
 * 2. 永久记忆 = 每次固定注入；允许注入 = 低权重候选资格。
 */

/* ==========================================================================
   [区域标注·已完成·旧事统计口径区]
   说明：UI 统一展示“总记忆数 / 已注入记忆数 / 永久记忆数 / 高优先级记忆数”。
   ========================================================================== */
export function getMemoryStats(items = []) {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.length;
  const injected = safeItems.filter((item) => item.injectionEnabled).length;
  const permanent = safeItems.filter((item) => item.isPermanent).length;
  const highPriority = safeItems.filter((item) => (
    item.isHighPriority ||
    item.isPermanent ||
    item.type === 'redline' ||
    item.type === 'flashbulb'
  )).length;

  return {
    total,
    injected,
    permanent,
    highPriority
  };
}

/* ==========================================================================
   [区域标注·已完成·旧事注入优先级区]
   说明：
   1. 永久记忆：每次固定注入，最高优先级。
   2. 红线铁则：独立高优先级，稳定注入。
   3. 普通允许注入记忆：只进入低权重候选池，不保证每次注入。
   4. 未开启注入 / 待确认：不自动进入注入池。
   ========================================================================== */
export function getInjectionWeight(item) {
  if (!item) return 0;
  if (item.isPermanent) return 1000;
  if (item.type === 'redline') return 900;
  if (item.type === 'pending') return 0;
  if (!item.injectionEnabled) return 0;
  if (item.type === 'flashbulb') return 720;
  if (item.isHighPriority) return 640;
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

export function buildInjectionPreview(items = []) {
  const candidates = getInjectionCandidates(items);
  const permanent = candidates.filter((item) => item.isPermanent);
  const redlines = candidates.filter((item) => !item.isPermanent && item.type === 'redline');
  const supplemental = candidates.filter((item) => (
    !item.isPermanent &&
    item.type !== 'redline' &&
    item.injectionEnabled
  ));

  return {
    permanent,
    redlines,
    supplemental,
    previewItems: [...permanent, ...redlines, ...supplemental].slice(0, 8)
  };
}
