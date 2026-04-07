# VisionPrompt

> 双向生图引擎：右键图片智能生成提示词，提示词一键生成图片

一款基于 AI 的 Chrome 浏览器扩展，实现**图片 → 提示词**和**提示词 → 图片**的双向转换。

## 核心功能

### 图片 → 提示词（右键生成）
- 在任意网页上**右键点击图片**，选择「生成提示词」
- 自动调用 DeepSeek 视觉模型分析图片内容
- 生成包含主体、环境、光线、构图、风格的中文提示词
- 悬浮窗展示结果，一键复制

### 提示词 → 图片（Popup 生成）
- 点击扩展图标打开横向双栏面板
- 左侧输入/编辑提示词，右侧实时展示生成结果
- 支持**上传图片**自动识别并生成提示词
- 生成的图片支持一键下载

## 技术栈

| 技术 | 说明 |
|---|---|
| [Plasmo](https://docs.plasmo.com/) | Chrome 扩展开发框架 |
| React + TypeScript | UI 开发 |
| Tailwind CSS | 样式方案 |
| [Lucide React](https://lucide.dev/) | 图标库 |
| DeepSeek API | 图片理解 & 提示词生成 |
| SiliconFlow API | 图片生成（Kolors 模型）& 视觉理解（Qwen2.5-VL） |

## 项目结构

```
├── assets/                # 扩展图标（多尺寸）
├── src/
│   ├── background.ts      # 右键菜单、DeepSeek API 调用、悬浮窗注入
│   ├── popup.tsx           # 弹窗 UI（提示词生图、图片上传识别）
│   └── style.css           # Tailwind CSS 入口
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

在浏览器中加载 `build/chrome-mv3-dev` 目录即可调试。

### 生产构建

```bash
pnpm build
```

构建产物位于 `build/chrome-mv3-prod/`。

### 打包发布

```bash
pnpm package
```

生成可上传到 Chrome Web Store 的 zip 文件。

## 权限说明

| 权限 | 用途 |
|---|---|
| `contextMenus` | 在图片上显示右键菜单「生成提示词」 |
| `storage` | 本地存储提示词、生成图片、用户偏好 |
| `scripting` | 在网页上注入悬浮窗展示生成结果 |
| `host_permissions` | 支持在任意网页上右键图片生成提示词 |

## 隐私说明

- 仅在用户主动操作（右键图片 / 点击生成）时调用 AI 接口
- 不在后台自动访问任何网页
- 不收集用户个人信息
- 所有数据仅存储在浏览器本地

## 作者

**顾孝标**

## 许可证

MIT
