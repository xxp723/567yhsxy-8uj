# MiniPhone 图标资源目录说明

本目录用于存放小手机（MiniPhone）所有应用图标与通用图形资源。

## 用途

- 给桌面应用图标提供统一资源路径（如 `assets/icons/settings.svg`）
- 给后续 UI 组件（按钮、提示、状态图标）提供静态图形资源
- 支持 PWA 安装图标的来源管理（可配合 `manifest.json`）

## 推荐命名规范

- 应用图标：`app-<appId>.svg`  
  例如：`app-settings.svg`、`app-chat.svg`
- 通用图标：`ic-<name>.svg`  
  例如：`ic-close.svg`、`ic-back.svg`

## 建议尺寸

- 桌面应用图标：`128x128` 或 `256x256`
- PWA 图标：至少提供 `192x192` 与 `512x512`

## 当前状态

- 当前为框架阶段，先预留目录与说明文件。
- 后续可逐步补充 SVG / PNG 文件并在 `Registry.js` 中绑定具体路径。
