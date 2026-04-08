# VisionPrompt

> 双向生图引擎：网页右键识图生成提示词，弹窗内文生图与上传识图

一款基于 AI 的 Chrome 扩展（Manifest V3），在任意网页上完成**图片 → 提示词**与**提示词 → 图片**的闭环。视觉理解与文生图均通过 [SiliconFlow](https://siliconflow.cn/) 的 OpenAI 兼容接口调用。

## 核心功能

### 图片 → 提示词（右键）

- 在网页上**右键点击图片**，选择「生成提示词」
- 后台拉取图片并调用视觉模型，生成包含主体、环境、光线、构图、风格的中文文生图提示词
- 页面内**居中半透明浮层**展示结果，**复制**后浮层自动关闭，并尝试打开扩展弹窗；最新提示词会写入存储，便于弹窗内继续编辑或生图

### 提示词 → 图片（扩展弹窗）

- 点击工具栏扩展图标打开**双栏弹窗**（左输入 / 右结果）
- 左侧可手动编辑提示词，点击「生成图片」调用文生图接口，右侧展示结果并支持**下载**
- 支持**本地上传图片**：识别过程中禁用生图与下载；上传预览持久化在 `chrome.storage.local`（避免 `sync` 单项体积限制），可点击缩略图全屏预览、删除参考图

### 模型与套餐（可扩展）

- 配置集中在 `src/config/models.ts`：`free` / `basic` / `premium` 三档，当前视觉模型均为 **Qwen/Qwen2.5-VL-72B-Instruct**，文生图均为 **Qwen/Qwen-Image**（SiliconFlow 侧部分历史模型可能下线，以控制台可用模型为准）
- 当前等级由 `@plasmohq/storage` 中的 `currentTier` 决定，默认 `free`；后续可接自有后端或 Web 端完成鉴权与限流

### API 密钥（开发说明）

- 密钥与模型名写在 `src/config/models.ts`。**上架商店前**应改为由服务端代理调用，避免密钥被打包进扩展后被提取盗用。

## 技术栈

| 技术 | 说明 |
|------|------|
| [Plasmo](https://docs.plasmo.com/) | Chrome MV3 扩展框架 |
| React 18 + TypeScript | 弹窗 UI |
| Tailwind CSS | 样式 |
| [Lucide React](https://lucide.dev/) | 图标 |
| [@plasmohq/storage](https://docs.plasmo.com/framework/storage) | 提示词、生成图 URL、`currentTier` 等持久化 |
| SiliconFlow API | 视觉对话（chat/completions）与文生图（images/generations） |

## 项目结构

```
├── assets/                    # 扩展图标（多尺寸）
├── src/
│   ├── background.ts          # 右键菜单、视觉 API、页面内浮层注入、openPopup
│   ├── popup.tsx              # 弹窗：上传识图、文生图、预览与下载
│   ├── config/
│   │   └── models.ts          # 套餐与模型、API 地址与密钥（勿提交真实生产密钥到公开仓库）
│   └── style.css              # Tailwind 入口
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发调试

```bash
pnpm dev
```

在 Chrome 打开 `chrome://extensions`，开启「开发者模式」，**加载已解压的扩展程序**，选择目录：

`build/chrome-mv3-dev`

修改源码后 Plasmo 会重新打包；若弹窗或后台逻辑异常，建议在扩展卡片上点击**重新加载**后再试。

### 生产构建

```bash
pnpm build
```

产物目录：`build/chrome-mv3-prod/`（若你本地曾加载 dev 目录，发布或验收时请改指向 prod，避免混用旧缓存）。

### 打包上架

```bash
pnpm package
```

生成可上传 Chrome Web Store 的 zip。

## 权限说明

| 权限 / 声明 | 用途 |
|-------------|------|
| `contextMenus` | 在图片右键菜单中注册「生成提示词」 |
| `storage` | 读写扩展状态（含 `chrome.storage.local` 存大图预览） |
| `scripting` | 在用户操作的标签页注入脚本，展示浮层、读取图片上下文 |
| `host_permissions: https://*/*` | 抓取用户右键的图片 URL 并请求 SiliconFlow；商店审核时建议在说明中写明「仅在用户主动右键或点击生成时发起网络请求」 |

## 隐私说明

- 仅在用户主动操作（右键图片、打开弹窗上传、点击生成）时发起 AI 相关网络请求
- 不在后台批量爬取网页
- 默认不采集账号类个人信息；敏感配置勿写入公开仓库

## 作者

**顾孝标**

## 许可证

MIT
