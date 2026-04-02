/**
 * 文件名: service-worker.js
 * 用途: PWA 服务工作者，实现离线缓存支持（cache-first 策略）。自动缓存静态资源（HTML、CSS、JS、manifest、图标等），确保 MiniPhone 在无网络时仍可启动并使用 IndexedDB 数据。
 *       支持所有四层架构的离线运行：外观层渲染、交互层手势、逻辑层内存管理、数据层持久化。
 *       这是 PWA 核心基础设施文件，方便以后修改缓存策略（如添加 IndexedDB 同步、背景同步等）。
 * 位置: 项目根目录
 * 架构层: PWA 基础设施（支持 Data Layer 离线）
 * 
 * 安装时预缓存核心文件，fetch 时优先使用缓存，activate 时清理旧缓存。
 */
const CACHE_NAME = 'miniphone-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/main.js'
  // 后续动态添加 js/core/* 和 apps/* 文件时，可通过 workbox 或手动扩展此列表
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] 预缓存静态资源');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // cache-first
      }
      return fetch(event.request).then((response) => {
        // 可选：动态缓存新资源（仅限同域）
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 清理旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
