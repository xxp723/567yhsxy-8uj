/**
 * 文件名: js/core/interaction/gesture.js
 * 用途: iOS 风格左侧边缘侧滑返回手势。
 * 说明:
 * - 仅在触摸起点距离屏幕左边缘 20px 以内时进入候选状态。
 * - 向右滑动时页面内容跟随手指平移，并通过阴影/透明度提供视觉反馈。
 * - 松手时超过屏幕宽度 30% 自动完成返回，否则回弹。
 * - 返回动作调用 history.back()。
 * - 纯 JS 实现，不涉及任何持久化存储，不使用 localStorage/sessionStorage。
 * 位置: /js/core/interaction/gesture.js
 * 架构层: 交互层（Interaction Layer）
 */

/* ==========================================================================
   [区域标注·本次需求·iOS侧滑返回手势配置区·已完成]
   说明：
   - EDGE_ACTIVATE_WIDTH 控制左边缘触发范围：20px。
   - COMPLETE_RATIO 控制完成返回阈值：屏幕宽度 30%。
   - 以下配置均为运行时交互参数，不涉及任何持久化存储。
   ========================================================================== */
const EDGE_ACTIVATE_WIDTH = 20;
const COMPLETE_RATIO = 0.3;
const DIRECTION_LOCK_DISTANCE = 8;
const MAX_VISUAL_TRANSLATE_RATIO = 0.96;
const RUBBER_BAND_POWER = 0.82;
const MOVE_TRANSITION = 'none';
const RELEASE_TRANSITION = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease, box-shadow 220ms ease';
const COMPLETE_TRANSITION = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease, box-shadow 260ms ease';

/**
 * iOS 风格边缘返回手势。
 */
export class EdgeBackGesture {
  /**
   * @param {HTMLElement} surfaceEl 需要跟随手指移动的页面根元素
   */
  constructor(surfaceEl = document.getElementById('screen-root')) {
    this.surfaceEl = surfaceEl || document.body;

    /* ==========================================================================
       [区域标注·本次需求·iOS侧滑返回手势状态区·已完成]
       说明：
       - 仅保存当前触摸过程中的临时状态。
       - 不读写 db.js、localStorage、sessionStorage 或任何其它持久化介质。
       ========================================================================== */
    this.touchId = null;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isTracking = false;
    this.isActive = false;
    this.isCancelled = false;
    this.isAnimating = false;
    this.previousInlineStyle = null;

    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);
  }

  bind() {
    if (!this.surfaceEl) return;

    document.addEventListener('touchstart', this.onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true, capture: true });
  }

  unbind() {
    document.removeEventListener('touchstart', this.onTouchStart, { capture: true });
    document.removeEventListener('touchmove', this.onTouchMove, { capture: true });
    document.removeEventListener('touchend', this.onTouchEnd, { capture: true });
    document.removeEventListener('touchcancel', this.onTouchCancel, { capture: true });
    this.resetVisualState();
    this.resetTouchState();
  }

  onTouchStart(event) {
    if (this.isAnimating || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!touch || touch.clientX > EDGE_ACTIVATE_WIDTH) return;

    /* ==========================================================================
       [区域标注·本次需求·内部横向滚动冲突判断区·已完成]
       说明：
       - 如果触摸目标处于可横向滚动容器内部，直接放弃边缘返回。
       - 避免与聊天列表、图片区域、桌面分页等内部横向滑动内容冲突。
       ========================================================================== */
    if (this.shouldIgnoreForHorizontalScroller(event.target)) return;

    this.touchId = touch.identifier;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;
    this.isTracking = true;
    this.isActive = false;
    this.isCancelled = false;
  }

  onTouchMove(event) {
    if (!this.isTracking || this.isCancelled) return;

    const touch = this.getTrackedTouch(event.changedTouches);
    if (!touch) return;

    this.currentX = touch.clientX;
    this.currentY = touch.clientY;

    const deltaX = Math.max(0, this.currentX - this.startX);
    const deltaY = this.currentY - this.startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!this.isActive) {
      if (absDeltaX < DIRECTION_LOCK_DISTANCE && absDeltaY < DIRECTION_LOCK_DISTANCE) return;

      if (absDeltaY > absDeltaX || deltaX <= 0) {
        this.cancelTracking();
        return;
      }

      this.isActive = true;
      this.captureInlineStyle();
    }

    event.preventDefault();
    this.applyDragVisual(deltaX);
  }

  onTouchEnd(event) {
    if (!this.isTracking) return;

    const touch = this.getTrackedTouch(event.changedTouches);
    if (!touch && event.touches.length > 0) return;

    const deltaX = Math.max(0, this.currentX - this.startX);
    const completeDistance = window.innerWidth * COMPLETE_RATIO;

    if (this.isActive && deltaX >= completeDistance) {
      this.completeBackGesture();
      return;
    }

    this.reboundGesture();
  }

  onTouchCancel() {
    if (!this.isTracking) return;
    this.reboundGesture();
  }

  getTrackedTouch(touchList) {
    return Array.from(touchList || []).find((touch) => touch.identifier === this.touchId) || null;
  }

  cancelTracking() {
    this.isCancelled = true;
    this.resetTouchState();
  }

  shouldIgnoreForHorizontalScroller(target) {
    let el = target instanceof Element ? target : null;

    while (el && el !== document.body && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && el.scrollWidth > el.clientWidth + 1;

      if (canScrollX) return true;

      el = el.parentElement;
    }

    return false;
  }

  captureInlineStyle() {
    if (this.previousInlineStyle) return;

    this.previousInlineStyle = {
      transition: this.surfaceEl.style.transition,
      transform: this.surfaceEl.style.transform,
      opacity: this.surfaceEl.style.opacity,
      boxShadow: this.surfaceEl.style.boxShadow,
      willChange: this.surfaceEl.style.willChange,
      touchAction: this.surfaceEl.style.touchAction
    };

    this.surfaceEl.style.willChange = 'transform, opacity, box-shadow';
    this.surfaceEl.style.touchAction = 'pan-y';
  }

  /* ==========================================================================
     [区域标注·本次需求·页面跟手视觉反馈区·已完成]
     说明：
     - 手势确认后才应用 transform，避免普通触摸造成页面闪屏。
     - 平移距离带轻微阻尼，阴影随进度增强，透明度轻微下降。
     ========================================================================== */
  applyDragVisual(deltaX) {
    const width = Math.max(1, window.innerWidth);
    const maxTranslate = width * MAX_VISUAL_TRANSLATE_RATIO;
    const translateX = Math.min(maxTranslate, Math.pow(deltaX, RUBBER_BAND_POWER) * Math.pow(width, 1 - RUBBER_BAND_POWER));
    const progress = Math.min(1, translateX / (width * COMPLETE_RATIO));

    this.surfaceEl.style.transition = MOVE_TRANSITION;
    this.surfaceEl.style.transform = `translate3d(${translateX}px, 0, 0)`;
    this.surfaceEl.style.opacity = String(1 - progress * 0.08);
    this.surfaceEl.style.boxShadow = `-18px 0 34px rgba(0, 0, 0, ${0.08 + progress * 0.22})`;
  }

  /* ==========================================================================
     [区域标注·本次需求·完成返回动画区·已完成]
     说明：
     - 超过屏幕宽度 30% 后播放完成动画，再调用 history.back()。
     - 如果当前没有可返回历史，仍按浏览器 history.back() 语义执行，不自行改写导航逻辑。
     ========================================================================== */
  completeBackGesture() {
    this.isAnimating = true;
    this.isTracking = false;

    this.surfaceEl.style.transition = COMPLETE_TRANSITION;
    this.surfaceEl.style.transform = `translate3d(${window.innerWidth}px, 0, 0)`;
    this.surfaceEl.style.opacity = '0.88';
    this.surfaceEl.style.boxShadow = '-28px 0 42px rgba(0, 0, 0, 0.28)';

    window.setTimeout(() => {
      history.back();
      window.setTimeout(() => {
        this.resetVisualState();
        this.resetTouchState();
        this.isAnimating = false;
      }, 80);
    }, 180);
  }

  /* ==========================================================================
     [区域标注·本次需求·未达阈值回弹区·已完成]
     说明：
     - 未超过 30% 阈值时执行回弹动画并恢复原有内联样式。
     - 清理过程集中处理，防止残留 transform/transition 造成下一帧闪烁。
     ========================================================================== */
  reboundGesture() {
    if (!this.isActive) {
      this.resetTouchState();
      return;
    }

    this.isAnimating = true;
    this.isTracking = false;

    this.surfaceEl.style.transition = RELEASE_TRANSITION;
    this.surfaceEl.style.transform = 'translate3d(0, 0, 0)';
    this.surfaceEl.style.opacity = '1';
    this.surfaceEl.style.boxShadow = 'none';

    window.setTimeout(() => {
      this.resetVisualState();
      this.resetTouchState();
      this.isAnimating = false;
    }, 230);
  }

  resetVisualState() {
    if (!this.previousInlineStyle || !this.surfaceEl) return;

    this.surfaceEl.style.transition = this.previousInlineStyle.transition;
    this.surfaceEl.style.transform = this.previousInlineStyle.transform;
    this.surfaceEl.style.opacity = this.previousInlineStyle.opacity;
    this.surfaceEl.style.boxShadow = this.previousInlineStyle.boxShadow;
    this.surfaceEl.style.willChange = this.previousInlineStyle.willChange;
    this.surfaceEl.style.touchAction = this.previousInlineStyle.touchAction;
    this.previousInlineStyle = null;
  }

  resetTouchState() {
    this.touchId = null;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isTracking = false;
    this.isActive = false;
    this.isCancelled = false;
  }
}
