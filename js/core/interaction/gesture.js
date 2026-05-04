/**
 * 文件名: js/core/interaction/gesture.js
 * 用途: 小手机网页内全局 iOS 风格左侧边缘侧滑返回手势。
 * 说明:
 * - 在应用屏幕左侧内部安全区域进入候选状态，避免手机系统物理边缘手势抢占。
 * - 向右滑动时以项目内系统风格贴边手势把手为视觉反馈，不改变页面内容样式，无淡入淡出。
 * - 松手时超过屏幕宽度 30% 自动完成返回，否则回弹。
 * - 返回动作优先触发当前应用内真实可见的上一级入口；应用总界面兜底关闭当前应用回到小手机桌面，不调用 history.back()。
 * - 纯 JS 实现，不涉及任何持久化存储，不使用 localStorage/sessionStorage。
 * - 已增加应用内左侧手势热区与横向过度滚动控制，减少系统/浏览器边缘手势抢占。
 * - 已修正为以 #screen-root 应用屏幕左边缘为参照，不再误用浏览器视口最左侧。
 * - 已增加项目内系统风格贴边手势把手，不依赖手机系统原生返回提示。
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
   - INDICATOR_Z_INDEX 控制系统风格贴边手势把手层级。
   - 热区位置基于 #screen-root 的 getBoundingClientRect() 动态计算。
   - 以下配置均为运行时交互参数，不涉及任何持久化存储。
   ========================================================================== */
const EDGE_ACTIVATE_WIDTH = 44;
const EDGE_SAFE_INSET = 10;
const COMPLETE_RATIO = 0.3;
const DIRECTION_LOCK_DISTANCE = 8;
const MOVE_TRANSITION = 'none';
const RELEASE_TRANSITION = 'none';
const COMPLETE_TRANSITION = 'none';
const EDGE_GUARD_Z_INDEX = '2147483646';
const INDICATOR_Z_INDEX = '2147483645';

/**
 * iOS 风格边缘返回手势。
 */
export class EdgeBackGesture {
  /**
   * @param {HTMLElement} surfaceEl 需要提供手势反馈的小手机屏幕根元素
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
     [区域标注·二次反馈修复·紧凑半圆形手势把手·已完成]
     说明：
     - 按用户截图要求，将指示器改为紧凑的深色 D 形半圆（约 32×44px），贴在屏幕左边缘。
     - 内含白色 < 箭头，箭头约 18px。
     - borderRadius 改为 0 50% 50% 0，形成右侧圆弧、左侧平直的 D 字形。
     - 手势过程中根据滑动进度淡入/轻微位移，完成或回弹时淡出。
     - 图标为内联 SVG，按 IconPark 风格线性箭头绘制，不使用浏览器原生图标/弹窗/选择器。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  installEdgeGestureIndicator() {
    if (this.edgeIndicatorEl) return;

    const indicator = document.createElement('div');
    indicator.className = 'miniphone-edge-back-gesture-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.style.position = 'fixed';
    indicator.style.left = '0';
    indicator.style.top = '0';
    indicator.style.width = '32px';
    indicator.style.height = '44px';
    indicator.style.borderRadius = '0 50% 50% 0';
    indicator.style.background = 'rgba(18, 18, 22, 0.72)';
    indicator.style.backdropFilter = 'blur(10px) saturate(1.1)';
    indicator.style.webkitBackdropFilter = 'blur(10px) saturate(1.1)';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.justifyContent = 'center';
    indicator.style.paddingLeft = '2px';
    indicator.style.color = '#fff';
    indicator.style.opacity = '0';
    indicator.style.transform = 'translate3d(-14px, -50%, 0)';
    indicator.style.transition = 'opacity 160ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)';
    indicator.style.pointerEvents = 'none';
    indicator.style.zIndex = INDICATOR_Z_INDEX;
    indicator.style.boxShadow = '4px 0 12px rgba(0, 0, 0, 0.18)';
    indicator.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M30 12L18 24L30 36" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
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
    const opacity = Math.min(1, clampedProgress * 1.5);
    const translateX = -14 + clampedProgress * 14;

    this.edgeIndicatorEl.style.transition = MOVE_TRANSITION;
    this.edgeIndicatorEl.style.opacity = String(opacity);
    this.edgeIndicatorEl.style.transform = `translate3d(${translateX}px, -50%, 0)`;
  }

  hideEdgeGestureIndicator() {
    if (!this.edgeIndicatorEl) return;

    this.edgeIndicatorEl.style.transition = 'opacity 160ms ease, transform 160ms cubic-bezier(0.22, 1, 0.36, 1)';
    this.edgeIndicatorEl.style.opacity = '0';
    this.edgeIndicatorEl.style.transform = 'translate3d(-14px, -50%, 0)';
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
      touchAction: this.surfaceEl.style.touchAction
    };

    this.surfaceEl.style.touchAction = 'pan-y';
  }

  /* ==========================================================================
     [区域标注·二次反馈修复·取消页面淡入淡出效果·已完成]
     说明：
     - 按用户反馈，滑动过程中完全不改变 surfaceEl 的 opacity / filter / boxShadow。
     - 页面内容始终保持原样，仅更新边缘指示器（D形半圆把手）的显示进度。
     - 避免任何淡入淡出、变暗、闪屏现象。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  applyDragVisual(deltaX) {
    const width = this.getSurfaceWidth();
    const progress = Math.min(1, deltaX / (width * COMPLETE_RATIO));

    this.updateEdgeGestureIndicator(progress);
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·全局应用返回桌面·已完成]
     说明：
     - 超过屏幕宽度 30% 后立即触发返回，不播放任何页面淡出/变暗动画，减少闪屏。
     - 返回解析作用于整个小手机网页内的当前活动应用，不只适配聊天界面。
     - 优先触发页面内真实可见的上一级按钮。
     - 若当前处于应用总界面、没有页面级返回入口，则点击窗口级 .app-window__close，
       复用项目已有 app:close 生命周期关闭当前应用并回到小手机桌面。
     - 不调用 history.back()，避免 PWA/手机浏览器在无内部历史时返回手机系统桌面。
     - 如果连窗口级关闭入口都没有，才回弹，不退出应用。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  completeBackGesture() {
    const returnControl = this.getActiveBackButton();

    if (!returnControl) {
      this.reboundGesture();
      return;
    }

    this.isAnimating = true;
    this.isTracking = false;

    this.hideEdgeGestureIndicator();
    returnControl.click();

    window.setTimeout(() => {
      this.resetVisualState();
      this.resetTouchState();
      this.isAnimating = false;
    }, 60);
  }

  /* ==========================================================================
     [区域标注·二次反馈修复·未达阈值回弹区·已完成]
     说明：
     - 未超过 30% 阈值时直接隐藏指示器并恢复触摸状态，不做页面动画。
     ========================================================================== */
  getSurfaceWidth() {
    const rect = this.surfaceEl.getBoundingClientRect();
    return Math.max(1, rect.width || window.innerWidth);
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·当前活动窗口识别·已完成]
     说明：
     - 优先使用 .app-window.is-active 作为当前应用窗口。
     - 如果状态类没有及时同步，则从所有真实可见的 .app-window 中取最后一个，
       适配窗口层后追加者位于更上层的结构。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  getActiveWindow() {
    const activeWindow = this.surfaceEl.querySelector('.app-window.is-active');
    if (this.isVisibleElement(activeWindow)) return activeWindow;

    const visibleWindows = Array.from(this.surfaceEl.querySelectorAll('.app-window')).filter((win) =>
      this.isVisibleElement(win)
    );

    return visibleWindows.at(-1) || null;
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·全局应用返回桌面·已完成]
     说明：
     - 函数名保留 getActiveBackButton，实际返回“当前侧滑应触发的返回/关闭控件”。
     - 优先找应用内部的页面级返回按钮（如"返回"、data-action="back/go-profile/goback"等）。
     - 若没有找到内部返回按钮，说明大概率处于应用总界面：
       先触发应用自己显式提供的回桌面控件（闲谈 data-action="go-home"、世情 data-a="gohome"），
       再回退到窗口级 .app-window__close，复用项目已有 app:close 流程回到小手机桌面。
     - 已修复闲谈/世情主界面无法侧滑回桌面：主界面不再因为隐藏/改造窗口关闭按钮而回弹。
     - 不再依赖默认隐藏且 pointer-events:none 的 .app-window__back。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  getActiveBackButton() {
    const activeWindow = this.getActiveWindow();
    if (!activeWindow) return null;

    const pageButton = this.findInternalBackControl(activeWindow);
    if (pageButton) return pageButton;

    const desktopReturnControl = this.findAppDesktopReturnControl(activeWindow);
    if (desktopReturnControl) return desktopReturnControl;

    const windowCloseButton = activeWindow.querySelector('.app-window__close');
    return this.isUsableWindowCloseControl(windowCloseButton) ? windowCloseButton : null;
  }

  findInternalBackControl(activeWindow) {
    const selectors = [
      '[data-action*="settings-back" i]',
      '[data-action*="msg-back" i]',
      '[data-action*="back" i]',
      '[data-action*="return" i]',
      '[data-action="go-profile" i]',
      '[data-action*="go-profile" i]',
      '[data-a="goback" i]',
      '[data-a*="back" i]',
      '[aria-label*="返回"]',
      '[title*="返回"]',
      'button[class*="back" i]',
      '[role="button"][class*="back" i]',
      'button[data-action*="close-mask-detail" i]',
      'button[data-action*="close-character-detail" i]',
      'button[data-action*="close-supporting-detail" i]',
      'button[data-action*="close-" i][aria-label*="返回"]',
      '[data-action*="close-" i][title*="返回"]',
      '[data-action*="close-" i][aria-label*="返回"]'
    ];

    const candidates = selectors.flatMap((selector) => {
      try {
        return Array.from(activeWindow.querySelectorAll(selector));
      } catch (_) {
        return [];
      }
    });

    const uniqueCandidates = Array.from(new Set(candidates));
    return uniqueCandidates.find((candidate) => this.isUsableBackControl(candidate, { allowWindowBack: false })) || null;
  }

  isUsableBackControl(control, { allowWindowBack = false } = {}) {
    if (!(control instanceof HTMLElement)) return false;
    if (!allowWindowBack && control.classList.contains('app-window__back')) return false;
    if (control.closest('[data-edge-back-gesture-guard="true"]')) return false;
    if (control.matches('.app-window__close, [data-action="close-window"], [data-action="go-home"], [data-a="gohome"]')) return false;
    if (control.matches('[data-action*="modal" i], [data-action*="picker" i], [aria-modal="true"] *')) return false;

    return this.isVisibleUsableControl(control);
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·闲谈世情主界面回桌面兜底·已完成]
     说明：
     - 闲谈主界面使用 data-action="go-home" 触发 app:close。
     - 世情会隐藏原窗口关闭按钮，并把标题改成 data-a="gohome"；该按钮会先 flushSave 再 app:close。
     - 这些控件不作为“页面级返回”参与优先匹配，只在没有二级页面返回入口时作为回桌面兜底。
     - 解决闲谈应用、世情应用在主界面侧滑只能回弹、无法回到小手机桌面的问题。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  findAppDesktopReturnControl(activeWindow) {
    const selectors = [
      '[data-action="go-home"]',
      '[data-a="gohome"]'
    ];

    const candidates = selectors.flatMap((selector) => {
      try {
        return Array.from(activeWindow.querySelectorAll(selector));
      } catch (_) {
        return [];
      }
    });

    const uniqueCandidates = Array.from(new Set(candidates));
    return uniqueCandidates.find((candidate) => this.isUsableDesktopReturnControl(candidate)) || null;
  }

  isUsableDesktopReturnControl(control) {
    if (!(control instanceof HTMLElement)) return false;
    if (control.closest('[data-edge-back-gesture-guard="true"]')) return false;
    if (control.matches('[data-action*="modal" i], [data-action*="picker" i], [aria-modal="true"] *')) return false;

    return this.isVisibleUsableControl(control);
  }

  /* ==========================================================================
     [区域标注·本次反馈修复·应用总界面关闭兜底·已完成]
     说明：
     - 仅当没有页面级返回入口时，才允许使用 .app-window__close 作为回桌面兜底。
     - 该按钮由 Window.js 原有逻辑触发 app:close，避免手势模块直接删除窗口 DOM。
     - 仍检查按钮是否真实可见、可点击、未禁用，避免误触不可用控件。
     - 不涉及任何持久化存储，不使用 localStorage/sessionStorage。
     ========================================================================== */
  isUsableWindowCloseControl(control) {
    if (!(control instanceof HTMLElement)) return false;
    if (!control.classList.contains('app-window__close')) return false;
    if (control.closest('[data-edge-back-gesture-guard="true"]')) return false;

    return this.isVisibleUsableControl(control);
  }

  isVisibleUsableControl(control) {
    if (!(control instanceof HTMLElement)) return false;
    if ('disabled' in control && control.disabled) return false;
    if (control.getAttribute('aria-disabled') === 'true') return false;

    return this.isVisibleElement(control, { requirePointerEvents: true });
  }

  isVisibleElement(element, { requirePointerEvents = false } = {}) {
    if (!(element instanceof HTMLElement)) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const style = window.getComputedStyle(element);
    const opacity = Number.parseFloat(style.opacity || '0');

    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (requirePointerEvents && style.pointerEvents === 'none') return false;
    if (!Number.isFinite(opacity) || opacity <= 0.05) return false;

    return true;
  }

  reboundGesture() {
    if (!this.isActive) {
      this.resetTouchState();
      return;
    }

    this.isTracking = false;
    this.hideEdgeGestureIndicator();
    this.resetVisualState();
    this.resetTouchState();
  }

  resetVisualState() {
    if (!this.previousInlineStyle || !this.surfaceEl) return;

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
