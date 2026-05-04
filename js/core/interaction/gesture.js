/**
 * 文件名: js/core/interaction/gesture.js
 * 用途: iOS 风格左侧边缘侧滑返回手势。
 * 说明:
 * - 在应用屏幕左侧内部安全区域进入候选状态，避免手机系统物理边缘手势抢占。
 * - 向右滑动时以淡入淡出为主要视觉反馈，不再把页面整体直接右移。
 * - 松手时超过屏幕宽度 30% 自动完成返回，否则回弹。
 * - 返回动作优先复用当前页面已有返回按钮，避免无内部历史时退出到手机系统桌面。
 * - 纯 JS 实现，不涉及任何持久化存储，不使用 localStorage/sessionStorage。
 * - 已增加应用内左侧手势热区与横向过度滚动控制，减少系统/浏览器边缘手势抢占。
 * - 已修正为以 #screen-root 应用屏幕左边缘为参照，不再误用浏览器视口最左侧。
 * - 已增加项目内仿系统侧滑提示层，不依赖手机系统原生返回提示。
 * 位置: /js/core/interaction/gesture.js
 * 架构层: 交互层（Interaction Layer）
 */

/* ==========================================================================
   [区域标注·本次需求·iOS侧滑返回手势配置区·已完成]
   说明：
   - EDGE_ACTIVATE_WIDTH 控制应用内安全触发区宽度。
   - EDGE_SAFE_INSET 控制触发区向应用屏幕内部偏移，避免手机物理边缘被系统抢占。
   - COMPLETE_RATIO 控制完成返回阈值：屏幕宽度 30%。
   - EDGE_GUARD_Z_INDEX 控制透明热区层级，确保在应用 UI 内优先接收触摸。
   - INDICATOR_Z_INDEX 控制仿系统侧滑提示层级。
   - 热区位置基于 #screen-root 的 getBoundingClientRect() 动态计算。
   - 以下配置均为运行时交互参数，不涉及任何持久化存储。
   ========================================================================== */
const EDGE_ACTIVATE_WIDTH = 44;
const EDGE_SAFE_INSET = 10;
const COMPLETE_RATIO = 0.3;
const DIRECTION_LOCK_DISTANCE = 8;
const MAX_VISUAL_TRANSLATE_RATIO = 0.96;
const RUBBER_BAND_POWER = 0.82;
const MOVE_TRANSITION = 'none';
const RELEASE_TRANSITION = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease, filter 220ms ease';
const COMPLETE_TRANSITION = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease, filter 240ms ease';
const EDGE_GUARD_Z_INDEX = '2147483646';
const INDICATOR_Z_INDEX = '2147483645';

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
    this.edgeGuardEl = null;
    this.edgeIndicatorEl = null;
    this.previousRootOverscrollStyle = null;

    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchCancel = this.onTouchCancel.bind(this);
    this.updateEdgeGuardPosition = this.updateEdgeGuardPosition.bind(this);
  }

  bind() {
    if (!this.surfaceEl) return;

    this.installEdgeGestureGuards();
    this.installEdgeGestureIndicator();

    document.addEventListener('touchstart', this.onTouchStart, { passive: false, capture: true });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onTouchEnd, { passive: true, capture: true });
    document.addEventListener('touchcancel', this.onTouchCancel, { passive: true, capture: true });
    window.addEventListener('resize', this.updateEdgeGuardPosition, { passive: true });
    window.addEventListener('scroll', this.updateEdgeGuardPosition, { passive: true });
    window.addEventListener('orientationchange', this.updateEdgeGuardPosition, { passive: true });
  }

  unbind() {
    document.removeEventListener('touchstart', this.onTouchStart, { capture: true });
    document.removeEventListener('touchmove', this.onTouchMove, { capture: true });
    document.removeEventListener('touchend', this.onTouchEnd, { capture: true });
    document.removeEventListener('touchcancel', this.onTouchCancel, { capture: true });
    window.removeEventListener('resize', this.updateEdgeGuardPosition);
    window.removeEventListener('scroll', this.updateEdgeGuardPosition);
    window.removeEventListener('orientationchange', this.updateEdgeGuardPosition);
    this.removeEdgeGestureIndicator();
    this.removeEdgeGestureGuards();
    this.resetVisualState();
    this.resetTouchState();
  }

  onTouchStart(event) {
    if (this.isAnimating || event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!touch || !this.isWithinSurfaceSafeGestureArea(touch)) return;
    if (this.isFromEdgeGuard(event.target)) {
      event.preventDefault();
    }

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

  /* ==========================================================================
     [区域标注·本次反馈修复·应用内安全触发区·已完成]
     说明：
     - MiniPhone 手机外壳可能居中显示，#screen-root 左边缘不等于浏览器视口 left: 0。
     - 手机物理最左边缘容易被系统原生返回手势抢占，网页 JS 无法稳定接管。
     - 这里改为 #screen-root 内部靠左安全区域：从左侧向内偏移 EDGE_SAFE_INSET 后开始捕获。
     - 解决“项目手势很难触发、触发的是手机系统原生桌面返回”的问题。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  isWithinSurfaceSafeGestureArea(touch) {
    const rect = this.surfaceEl.getBoundingClientRect();
    const edgeLeft = rect.left + EDGE_SAFE_INSET;
    const edgeRight = edgeLeft + EDGE_ACTIVATE_WIDTH;
    const edgeTop = rect.top;
    const edgeBottom = rect.bottom;

    return (
      touch.clientX >= edgeLeft &&
      touch.clientX <= edgeRight &&
      touch.clientY >= edgeTop &&
      touch.clientY <= edgeBottom
    );
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·应用内左侧手势热区·已完成]
     说明：
     - 手机物理最边缘可能被系统手势抢占，网页无法 100% 禁止。
     - 这里在 #screen-root 应用画面内部靠左安全区域创建透明热区，并设置 touch-action: none，
       让从应用内部左侧开始的滑动尽量先被网页接收，避开手机物理边缘系统手势。
     - 热区跟随 #screen-root 的实际位置和尺寸，不再固定在浏览器视口 left: 0。
     - 同时设置 overscroll-behavior-x: none，减少浏览器横向导航/回弹干扰。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  installEdgeGestureGuards() {
    if (this.edgeGuardEl) return;

    this.previousRootOverscrollStyle = {
      html: document.documentElement.style.overscrollBehaviorX,
      body: document.body.style.overscrollBehaviorX,
      surface: this.surfaceEl.style.overscrollBehaviorX
    };

    document.documentElement.style.overscrollBehaviorX = 'none';
    document.body.style.overscrollBehaviorX = 'none';
    this.surfaceEl.style.overscrollBehaviorX = 'none';

    const guard = document.createElement('div');
    guard.className = 'miniphone-edge-back-gesture-guard';
    guard.setAttribute('aria-hidden', 'true');
    guard.setAttribute('data-edge-back-gesture-guard', 'true');
    guard.style.position = 'fixed';
    guard.style.left = '0';
    guard.style.top = '0';
    guard.style.width = `${EDGE_ACTIVATE_WIDTH}px`;
    guard.style.height = '0';
    guard.style.zIndex = EDGE_GUARD_Z_INDEX;
    guard.style.pointerEvents = 'auto';
    guard.style.touchAction = 'none';
    guard.style.background = 'transparent';
    guard.style.webkitTapHighlightColor = 'transparent';

    document.body.appendChild(guard);
    this.edgeGuardEl = guard;
    this.updateEdgeGuardPosition();
  }

  updateEdgeGuardPosition() {
    if (!this.edgeGuardEl || !this.surfaceEl) return;

    const rect = this.surfaceEl.getBoundingClientRect();
    this.edgeGuardEl.style.left = `${rect.left + EDGE_SAFE_INSET}px`;
    this.edgeGuardEl.style.top = `${rect.top}px`;
    this.edgeGuardEl.style.height = `${rect.height}px`;
    this.edgeGuardEl.style.width = `${EDGE_ACTIVATE_WIDTH}px`;
    this.updateEdgeGestureIndicatorPosition(rect);
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·自定义仿系统侧滑提示·已完成]
     说明：
     - 用户截图里的深色弧形箭头属于手机系统/浏览器原生手势提示，网页无法直接控制。
     - 这里创建项目内自定义提示层：深色半胶囊背景 + 白色返回箭头。
     - 手势过程中根据滑动进度淡入/轻微位移，完成或回弹时淡出。
     - 图标为内联 SVG，按 IconPark 风格线性箭头绘制，不使用浏览器原生图标/弹窗/选择器。
     ========================================================================== */
  installEdgeGestureIndicator() {
    if (this.edgeIndicatorEl) return;

    const indicator = document.createElement('div');
    indicator.className = 'miniphone-edge-back-gesture-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.style.position = 'fixed';
    indicator.style.left = '0';
    indicator.style.top = '0';
    indicator.style.width = '38px';
    indicator.style.height = '72px';
    indicator.style.borderRadius = '0 38px 38px 0';
    indicator.style.background = 'rgba(18, 18, 22, 0.72)';
    indicator.style.backdropFilter = 'blur(10px)';
    indicator.style.webkitBackdropFilter = 'blur(10px)';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.style.color = '#fff';
    indicator.style.opacity = '0';
    indicator.style.transform = 'translate3d(-18px, -50%, 0) scale(0.94)';
    indicator.style.transition = 'opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = INDICATOR_Z_INDEX;
    indicator.style.boxShadow = '8px 0 24px rgba(0, 0, 0, 0.18)';
    indicator.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M30 12L18 24L30 36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    document.body.appendChild(indicator);
    this.edgeIndicatorEl = indicator;
    this.updateEdgeGestureIndicatorPosition();
  }

  updateEdgeGestureIndicatorPosition(surfaceRect = this.surfaceEl.getBoundingClientRect()) {
    if (!this.edgeIndicatorEl || !surfaceRect) return;

    this.edgeIndicatorEl.style.left = `${surfaceRect.left}px`;
    this.edgeIndicatorEl.style.top = `${surfaceRect.top + surfaceRect.height / 2}px`;
  }

  updateEdgeGestureIndicator(progress) {
    if (!this.edgeIndicatorEl) return;

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const opacity = Math.min(1, clampedProgress * 1.35);
    const translateX = -18 + clampedProgress * 18;
    const scale = 0.94 + clampedProgress * 0.06;

    this.edgeIndicatorEl.style.transition = MOVE_TRANSITION;
    this.edgeIndicatorEl.style.opacity = String(opacity);
    this.edgeIndicatorEl.style.transform = `translate3d(${translateX}px, -50%, 0) scale(${scale})`;
  }

  hideEdgeGestureIndicator() {
    if (!this.edgeIndicatorEl) return;

    this.edgeIndicatorEl.style.transition = 'opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
    this.edgeIndicatorEl.style.opacity = '0';
    this.edgeIndicatorEl.style.transform = 'translate3d(-18px, -50%, 0) scale(0.94)';
  }

  removeEdgeGestureIndicator() {
    if (this.edgeIndicatorEl) {
      this.edgeIndicatorEl.remove();
      this.edgeIndicatorEl = null;
    }
  }

  removeEdgeGestureGuards() {
    if (this.edgeGuardEl) {
      this.edgeGuardEl.remove();
      this.edgeGuardEl = null;
    }

    if (this.previousRootOverscrollStyle) {
      document.documentElement.style.overscrollBehaviorX = this.previousRootOverscrollStyle.html;
      document.body.style.overscrollBehaviorX = this.previousRootOverscrollStyle.body;
      this.surfaceEl.style.overscrollBehaviorX = this.previousRootOverscrollStyle.surface;
      this.previousRootOverscrollStyle = null;
    }
  }

  isFromEdgeGuard(target) {
    return target instanceof Element && Boolean(target.closest('[data-edge-back-gesture-guard="true"]'));
  }

  cancelTracking() {
    this.isCancelled = true;
    this.resetTouchState();
  }

  shouldIgnoreForHorizontalScroller(target) {
    if (this.isFromEdgeGuard(target)) return false;

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
      filter: this.surfaceEl.style.filter,
      willChange: this.surfaceEl.style.willChange,
      touchAction: this.surfaceEl.style.touchAction
    };

    this.surfaceEl.style.willChange = 'transform, opacity, filter';
    this.surfaceEl.style.touchAction = 'pan-y';
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·淡入淡出侧滑反馈·已完成]
     说明：
     - 手势确认后才应用视觉反馈，避免普通触摸造成页面闪屏。
     - 按用户反馈，本区域不再把页面整体向右推开，避免露出黑底。
     - 右滑过程改为当前界面轻微淡出、轻微缩放与亮度变化，形成淡入淡出式返回反馈。
     ========================================================================== */
  applyDragVisual(deltaX) {
    const width = this.getSurfaceWidth();
    const progress = Math.min(1, deltaX / (width * COMPLETE_RATIO));
    const scale = 1 - progress * 0.018;
    const opacity = 1 - progress * 0.22;
    const brightness = 1 - progress * 0.04;

    this.updateEdgeGestureIndicator(progress);
    this.surfaceEl.style.transition = MOVE_TRANSITION;
    this.surfaceEl.style.transform = `scale(${scale})`;
    this.surfaceEl.style.opacity = String(opacity);
    this.surfaceEl.style.boxShadow = 'none';
    this.surfaceEl.style.filter = `brightness(${brightness})`;
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·复用页面返回按钮·已完成]
     说明：
     - 超过屏幕宽度 30% 后播放淡出完成动画，再触发当前活动窗口已有返回按钮。
     - 页面上的返回按钮仍可正常点击；侧滑只是复用同一个按钮逻辑作为并存触发入口。
     - 不再无条件调用 history.back()，避免 PWA/手机浏览器在无内部历史时返回手机系统桌面。
     - 如果当前页面没有可用返回按钮，则回弹，不退出应用。
     ========================================================================== */
  completeBackGesture() {
    const backButton = this.getActiveBackButton();

    if (!backButton) {
      this.reboundGesture();
      return;
    }

    this.isAnimating = true;
    this.isTracking = false;

    this.surfaceEl.style.transition = COMPLETE_TRANSITION;
    this.surfaceEl.style.transform = 'scale(0.982)';
    this.surfaceEl.style.opacity = '0.72';
    this.surfaceEl.style.boxShadow = 'none';
    this.surfaceEl.style.filter = 'brightness(0.96)';
    this.updateEdgeGestureIndicator(1);

    window.setTimeout(() => {
      backButton.click();
      window.setTimeout(() => {
        this.hideEdgeGestureIndicator();
        this.resetVisualState();
        this.resetTouchState();
        this.isAnimating = false;
      }, 120);
    }, 150);
  }

  /* ==========================================================================
     [区域标注·本次需求·未达阈值回弹区·已完成]
     说明：
     - 未超过 30% 阈值时执行回弹动画并恢复原有内联样式。
     - 清理过程集中处理，防止残留 transform/transition 造成下一帧闪烁。
     ========================================================================== */
  getSurfaceWidth() {
    const rect = this.surfaceEl.getBoundingClientRect();
    return Math.max(1, rect.width || window.innerWidth);
  }

  getActiveBackButton() {
    const activeWindow = this.surfaceEl.querySelector('.app-window.is-active');
    const backButton = activeWindow?.querySelector('.app-window__back');

    if (!(backButton instanceof HTMLButtonElement)) return null;
    if (backButton.disabled) return null;

    const style = window.getComputedStyle(backButton);
    const opacity = Number.parseFloat(style.opacity || '0');

    if (style.display === 'none') return null;
    if (style.visibility === 'hidden') return null;
    if (style.pointerEvents === 'none') return null;
    if (!Number.isFinite(opacity) || opacity <= 0.05) return null;

    return backButton;
  }

  reboundGesture() {
    if (!this.isActive) {
      this.resetTouchState();
      return;
    }

    this.isAnimating = true;
    this.isTracking = false;

    this.surfaceEl.style.transition = RELEASE_TRANSITION;
    this.surfaceEl.style.transform = 'scale(1)';
    this.surfaceEl.style.opacity = '1';
    this.surfaceEl.style.boxShadow = 'none';
    this.surfaceEl.style.filter = 'brightness(1)';
    this.hideEdgeGestureIndicator();

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
    this.surfaceEl.style.filter = this.previousInlineStyle.filter;
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
