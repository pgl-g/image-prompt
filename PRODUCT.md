# VisionPrompt 产品文档

> 版本：v1.0 | 更新日期：2026-04-10 | 作者：顾孝标

---

## 一、产品概述

**VisionPrompt** 是一款基于 AI 的 Chrome 浏览器扩展，提供「图片 → 提示词」与「提示词 → 图片」的双向闭环能力。用户可通过右键菜单快速识图生成中文文生图提示词，也可在扩展弹窗中上传图片、编辑提示词并生成新图片。

### 1.1 核心价值

| 场景 | 价值 |
|------|------|
| 设计师 / 插画师 | 快速将参考图转为可复用的文生图提示词，提升创作效率 |
| AI 绘图爱好者 | 一键识图 + 编辑 + 生图的完整工作流，无需切换多个工具 |
| 内容创作者 | 浏览网页时随手右键识图，快速获取画面描述用于二次创作 |

### 1.2 当前技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ popup.tsx    │  │ background.ts│  │ config/       │  │
│  │ (弹窗 UI)    │  │ (右键菜单)    │  │ models.ts     │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│         └────────┬────────┘                              │
│                  │ services/api.ts                       │
└──────────────────┼──────────────────────────────────────┘
                   │ HTTPS
       ┌───────────┴───────────┐
       │   Vercel Serverless   │
       │  ┌──────┐ ┌────────┐  │
       │  │vision│ │image-  │  │
       │  │.ts   │ │gen.ts  │  │
       │  └──┬───┘ └───┬────┘  │
       └─────┼─────────┼──────┘
             │         │
       ┌─────┴─────────┴─────┐
       │   SiliconFlow API    │
       │  Qwen2.5-VL / Qwen  │
       └─────────────────────┘
```

### 1.3 当前功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 右键识图生成提示词 | ✅ 已上线 | 网页图片右键 → 浮层展示 → 一键复制 |
| 弹窗上传识图 | ✅ 已上线 | 本地上传图片 → 视觉模型分析 → 自动填充 |
| 文生图 | ✅ 已上线 | 输入/编辑提示词 → Qwen-Image 生成 |
| 图片下载 | ✅ 已上线 | 生成图片一键下载到本地 |
| 每日使用限制 | ✅ 已上线 | 客户端计数，free 10次/天 |
| API Key 服务端代理 | ✅ 已上线 | Vercel Serverless 转发，密钥不暴露 |
| 套餐分级框架 | ⚠️ 仅框架 | 三级配置已定义，但无鉴权 / 支付 / 切换入口 |

---

## 二、优化方向分析

### 2.1 安全与稳定性（高优先级）

#### 2.1.1 服务端限流

**现状**：每日使用限制仅在客户端（`chrome.storage.local`）执行，用户可通过清除存储或修改代码绕过。

**优化方案**：
- 在 Vercel Serverless 端增加基于 IP / 设备指纹的限流
- 使用 Vercel KV (Redis) 或 Upstash Redis 存储用户使用计数
- 请求体中携带设备标识（如 `chrome.runtime.id` + 随机 UUID），服务端校验

```
请求流程：
Extension → [deviceId + request] → Vercel API → [检查 Redis 计数]
                                                    ├── 未超限 → 转发 SiliconFlow
                                                    └── 已超限 → 返回 429
```

#### 2.1.2 请求签名防滥用

**现状**：Vercel API 端点完全公开，任何人知道 URL 即可直接调用，绕过扩展使用。

**优化方案**：
- 请求头中携带 HMAC 签名（基于时间戳 + 请求体 + 共享密钥）
- 服务端验证签名有效性和时间窗口（±5分钟）
- 添加 Referer / Origin 白名单检查

#### 2.1.3 错误监控

**优化方案**：
- 接入 Sentry 或 Vercel Analytics 监控 API 错误率
- 关键操作添加结构化日志（Vercel Logs）
- 客户端错误上报到服务端

---

### 2.2 用户体验（中优先级）

#### 2.2.1 提示词历史记录

**现状**：仅保留最新一条提示词，历史记录丢失。

**优化方案**：
- 使用 `chrome.storage.local` 存储最近 50 条提示词历史
- 弹窗左栏增加「历史记录」折叠面板
- 支持搜索、收藏、删除、一键复用

#### 2.2.2 多尺寸 / 多比例支持

**现状**：固定 1024x1024 正方形输出。

**优化方案**：
- 增加比例选择器：1:1 / 16:9 / 9:16 / 4:3 / 3:4
- 对应分辨率映射：1024×1024 / 1024×576 / 576×1024 等
- 根据用途场景推荐比例（社交封面、手机壁纸、海报等）

#### 2.2.3 提示词模板

**优化方案**：
- 内置常用风格模板（写实摄影、二次元、水彩、油画、赛博朋克等）
- 用户选择模板后自动附加风格后缀
- 支持自定义模板并保存

#### 2.2.4 批量生成与变体

**优化方案**：
- 同一提示词一次生成 2~4 张变体图片
- 支持对生成结果微调（「再试一次」按钮）
- 高级版支持 batch_size 参数

#### 2.2.5 图片编辑增强

**优化方案**：
- 图片放大（超分辨率）
- 局部重绘（inpainting）
- 图片扩展（outpainting）
- 风格迁移（参考图 + 提示词混合生成）

#### 2.2.6 多语言支持

**现状**：仅中文界面和提示词。

**优化方案**：
- 支持中英文切换（`chrome.i18n` 或 i18next）
- 提示词支持中英文双语生成
- 英文提示词对部分模型效果更好

---

### 2.3 功能扩展（低优先级）

#### 2.3.1 图生图（Image-to-Image）

- 上传参考图 + 提示词 → 融合生成新图
- 支持 ControlNet / IP-Adapter 风格控制
- 适用场景：保持构图 / 人物不变，仅修改风格

#### 2.3.2 提示词优化器

- 用户输入简短描述 → AI 扩写为专业提示词
- 支持 negative prompt（反向提示词）
- 提示词质量评分

#### 2.3.3 收藏与画廊

- 生成的图片自动保存到本地画廊
- 支持按日期、风格、提示词分类浏览
- 支持导出为 ZIP 打包下载

#### 2.3.4 社区分享

- 用户可将作品 + 提示词分享到社区
- 浏览他人作品并一键复用提示词
- 需要独立的 Web 端（Next.js）支撑

---

## 三、收费模型设计

### 3.1 定价策略

采用 **Freemium + 订阅制** 模式，兼顾用户增长和商业化：

| 维度 | 免费版 (Free) | 基础版 (Basic) | 专业版 (Pro) | 旗舰版 (Ultimate) |
|------|:---:|:---:|:---:|:---:|
| **月价** | ¥0 | ¥19.9/月 | ¥49.9/月 | ¥99.9/月 |
| **年价** | ¥0 | ¥199/年 (省 40) | ¥499/年 (省 100) | ¥999/年 (省 200) |
| **每日次数** | 10 次 | 50 次 | 200 次 | 不限 |
| **视觉模型** | Qwen2.5-VL-7B | Qwen2.5-VL-72B | GPT-4o / Claude | GPT-4o / Claude |
| **生图模型** | Qwen-Image | FLUX.1-schnell | FLUX.1-dev | FLUX.1-pro + DALL-E 3 |
| **图片分辨率** | 512×512 | 1024×1024 | 1024×1024 | 最高 2048×2048 |
| **批量生成** | ✗ | 2 张/次 | 4 张/次 | 4 张/次 |
| **提示词历史** | 最近 10 条 | 最近 50 条 | 不限 | 不限 |
| **图生图** | ✗ | ✗ | ✓ | ✓ |
| **超分辨率** | ✗ | ✗ | ✓ | ✓ |
| **API 调用** | ✗ | ✗ | ✗ | ✓ (开放 API) |

### 3.2 成本估算

基于 SiliconFlow 当前定价（2026 年参考）：

| 模型 | 单次成本（约） | 说明 |
|------|:---:|------|
| Qwen2.5-VL-7B | ¥0.005 | 轻量视觉模型，速度快 |
| Qwen2.5-VL-72B | ¥0.03 | 大参数视觉模型，效果好 |
| Qwen-Image | ¥0.04 | 基础文生图 |
| FLUX.1-schnell | ¥0.06 | 快速生图，质量中等 |
| FLUX.1-dev | ¥0.10 | 高质量生图 |
| FLUX.1-pro | ¥0.30 | 最高质量 |
| GPT-4o (vision) | ¥0.05 | OpenAI 视觉模型 |

**单用户月成本估算**：

| 套餐 | 日均使用 | 月使用量 | 视觉成本 | 生图成本 | 月成本 | 月收入 | 毛利率 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Free | 5 次 | 150 | ¥0.75 | ¥6.0 | **¥6.75** | ¥0 | -100% |
| Basic | 20 次 | 600 | ¥18.0 | ¥36.0 | **¥54.0** | ¥19.9 | -171% |
| Pro | 50 次 | 1500 | ¥75.0 | ¥150.0 | **¥225.0** | ¥49.9 | -351% |
| Ultimate | 100 次 | 3000 | ¥150.0 | ¥900.0 | **¥1050** | ¥99.9 | -951% |

> **重要**：以上为满额使用的极端情况。实际上大多数用户不会每天用满配额。根据行业经验，付费用户平均使用量约为配额的 30%~40%，实际毛利率会显著高于上表。

**优化成本的策略**：
1. **缓存机制**：相同/相似图片的识图结果缓存，减少重复调用
2. **模型降级**：免费版使用轻量模型（7B），大幅降低成本
3. **异步队列**：高峰期排队处理，平滑 API 调用量
4. **自建推理**：用户量增长后可自建推理服务（如 vLLM），成本降低 5-10 倍

### 3.3 收费系统技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌───────────┐                                               │
│  │ popup.tsx  │ ← 显示当前套餐、升级入口、剩余次数           │
│  └─────┬─────┘                                               │
└────────┼────────────────────────────────────────────────────┘
         │
    ┌────┴──────────────────────────────────────────┐
    │           Next.js Web 端 (用户中心)             │
    │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
    │  │ 登录注册  │  │ 套餐管理  │  │ 使用统计     │  │
    │  │ (邮箱/    │  │ (选择/    │  │ (图表/       │  │
    │  │  微信/    │  │  续费/    │  │  历史)       │  │
    │  │  GitHub)  │  │  取消)    │  │              │  │
    │  └────┬─────┘  └────┬─────┘  └──────────────┘  │
    └───────┼─────────────┼──────────────────────────┘
            │             │
    ┌───────┴─────────────┴──────────────────────────┐
    │              后端 API (Vercel / NestJS)          │
    │  ┌──────────┐  ┌────────┐  ┌───────────────┐   │
    │  │ 用户鉴权  │  │ 订阅   │  │ 使用量计数    │   │
    │  │ (JWT)    │  │ 管理   │  │ (Redis)       │   │
    │  └──────────┘  └───┬────┘  └───────────────┘   │
    └────────────────────┼───────────────────────────┘
                         │
    ┌────────────────────┴───────────────────────────┐
    │              支付系统                            │
    │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
    │  │ 微信支付  │  │ 支付宝   │  │ Stripe      │  │
    │  │          │  │          │  │ (海外)       │  │
    │  └──────────┘  └──────────┘  └─────────────┘  │
    └───────────────────────────────────────────────┘
```

### 3.4 收费系统实施步骤

#### Phase 1：用户体系（2 周）
1. 搭建 Next.js Web 端（登录 / 注册 / 个人中心）
2. 数据库：Supabase (PostgreSQL) 或 PlanetScale (MySQL)
3. 用户表设计：`id, email, tier, tier_expires_at, daily_usage, created_at`
4. JWT 鉴权：扩展通过 `chrome.storage` 存储 token
5. 扩展弹窗增加「登录 / 升级」入口

#### Phase 2：订阅支付（2 周）
1. 接入支付渠道（国内：微信/支付宝；海外：Stripe）
2. Web 端套餐选择页 + 支付流程
3. 支付回调 → 更新用户套餐等级
4. 订阅到期自动降级逻辑

#### Phase 3：服务端限流（1 周）
1. Vercel API 增加 JWT 验证中间件
2. Redis 存储每用户每日使用量
3. 根据 `tier` 动态限流
4. 返回剩余次数到客户端展示

#### Phase 4：多模型接入（1 周）
1. 根据 `tier` 路由到不同模型
2. 接入 FLUX.1、GPT-4o 等高级模型
3. 模型选择器 UI（高级版可手动切换）

---

## 四、模型推荐与对比

### 4.1 视觉理解模型

| 模型 | 提供商 | 图片理解能力 | 中文能力 | 速度 | 成本 | 推荐等级 |
|------|--------|:---:|:---:|:---:|:---:|:---:|
| **Qwen2.5-VL-7B** | SiliconFlow | ★★★ | ★★★★★ | ★★★★★ | ★★★★★ | Free |
| **Qwen2.5-VL-72B** | SiliconFlow | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | Basic |
| **GPT-4o** | OpenAI | ★★★★★ | ★★★★ | ★★★★ | ★★★ | Pro |
| **Claude 3.5 Sonnet** | Anthropic | ★★★★★ | ★★★★ | ★★★★ | ★★★ | Pro |
| **Gemini 2.0 Flash** | Google | ★★★★ | ★★★ | ★★★★★ | ★★★★ | Basic 备选 |
| **InternVL2.5** | 书生 | ★★★★ | ★★★★★ | ★★★★ | ★★★★ | Basic 备选 |

**推荐策略**：
- **免费版**：Qwen2.5-VL-7B — 成本极低，中文能力强，满足基础需求
- **基础版**：Qwen2.5-VL-72B — 当前方案，性价比最优
- **专业版**：GPT-4o — 图片理解能力最强，细节描述更精准

### 4.2 图片生成模型

| 模型 | 提供商 | 生图质量 | 中文理解 | 速度 | 成本 | 推荐等级 |
|------|--------|:---:|:---:|:---:|:---:|:---:|
| **Qwen-Image** | SiliconFlow | ★★★ | ★★★★ | ★★★★ | ★★★★★ | Free |
| **FLUX.1-schnell** | Black Forest Labs | ★★★★ | ★★★ | ★★★★★ | ★★★★ | Basic |
| **FLUX.1-dev** | Black Forest Labs | ★★★★★ | ★★★ | ★★★ | ★★★ | Pro |
| **FLUX.1-pro** | Black Forest Labs | ★★★★★ | ★★★ | ★★★ | ★★ | Ultimate |
| **Stable Diffusion 3** | Stability AI | ★★★★ | ★★ | ★★★★ | ★★★ | Pro 备选 |
| **DALL-E 3** | OpenAI | ★★★★★ | ★★★★★ | ★★★ | ★★ | Ultimate |
| **Midjourney v6** | Midjourney | ★★★★★ | ★★★ | ★★★ | ★★ | 暂不接入 |

**推荐策略**：
- **免费版**：Qwen-Image — 成本低，中文提示词友好
- **基础版**：FLUX.1-schnell — 质量显著提升，生成速度快
- **专业版**：FLUX.1-dev — 目前开源模型中质量最高
- **旗舰版**：FLUX.1-pro + DALL-E 3 可选 — 最高质量，支持自选模型

### 4.3 最佳推荐组合

> **综合推荐**：视觉理解用 **Qwen2.5-VL-72B**，生图用 **FLUX.1-schnell** 或 **FLUX.1-dev**。

理由：
1. **Qwen2.5-VL-72B** 中文能力在同级别模型中最强，生成的中文提示词质量高
2. **FLUX.1 系列** 是 2024-2025 年最受关注的开源生图模型，质量接近 Midjourney
3. 两者均可通过 SiliconFlow 统一调用，无需对接多个 API 提供商
4. 如果预算充足且面向高端用户，可将 **GPT-4o + DALL-E 3** 作为旗舰选项

---

## 五、升级后的配置设计

### 5.1 模型配置重构

```typescript
// src/config/models.ts — 升级后的配置

export type TierLevel = "free" | "basic" | "pro" | "ultimate"

export interface ModelConfig {
  /** 视觉理解 API */
  visionApi: string
  /** 视觉理解模型列表（第一个为默认） */
  visionModels: string[]
  /** 图片生成 API */
  imageGenApi: string
  /** 图片生成模型列表（第一个为默认） */
  imageGenModels: string[]
  /** 支持的图片尺寸 */
  imageSizes: string[]
  /** 单次最大生成数 */
  batchSize: number
  /** 每日使用次数限制 */
  dailyLimit: number
  /** 套餐信息 */
  label: string
  description: string
  price: number // 月价，0 表示免费
}

export const MODEL_TIERS: Record<TierLevel, ModelConfig> = {
  free: {
    visionApi: "/api/vision",
    visionModels: ["Qwen/Qwen2.5-VL-7B-Instruct"],
    imageGenApi: "/api/image-gen",
    imageGenModels: ["Qwen/Qwen-Image"],
    imageSizes: ["512x512"],
    batchSize: 1,
    dailyLimit: 10,
    label: "免费版",
    description: "基础识图 + 生图体验",
    price: 0
  },
  basic: {
    visionApi: "/api/vision",
    visionModels: ["Qwen/Qwen2.5-VL-72B-Instruct"],
    imageGenApi: "/api/image-gen",
    imageGenModels: ["FLUX.1-schnell"],
    imageSizes: ["512x512", "1024x1024", "1024x576", "576x1024"],
    batchSize: 2,
    dailyLimit: 50,
    label: "基础版",
    description: "高质量识图 + FLUX 生图",
    price: 19.9
  },
  pro: {
    visionApi: "/api/vision",
    visionModels: ["gpt-4o", "Qwen/Qwen2.5-VL-72B-Instruct"],
    imageGenApi: "/api/image-gen",
    imageGenModels: ["FLUX.1-dev", "FLUX.1-schnell"],
    imageSizes: ["512x512", "1024x1024", "1024x576", "576x1024"],
    batchSize: 4,
    dailyLimit: 200,
    label: "专业版",
    description: "GPT-4o 识图 + FLUX.1 高质量生图",
    price: 49.9
  },
  ultimate: {
    visionApi: "/api/vision",
    visionModels: ["gpt-4o", "claude-3.5-sonnet", "Qwen/Qwen2.5-VL-72B-Instruct"],
    imageGenApi: "/api/image-gen",
    imageGenModels: ["FLUX.1-pro", "FLUX.1-dev", "dall-e-3"],
    imageSizes: ["512x512", "1024x1024", "1024x576", "576x1024", "2048x2048"],
    batchSize: 4,
    dailyLimit: -1,
    label: "旗舰版",
    description: "全部模型 + 无限使用",
    price: 99.9
  }
}
```

### 5.2 数据库表设计

```sql
-- 用户表
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255),          -- 第三方登录时可为空
  nickname    VARCHAR(100),
  avatar_url  TEXT,
  provider    VARCHAR(20) DEFAULT 'email',  -- email / wechat / github
  provider_id VARCHAR(255),
  tier        VARCHAR(20) DEFAULT 'free',
  tier_expires_at TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- 使用记录表（计费 & 统计）
CREATE TABLE usage_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(20) NOT NULL,   -- 'vision' | 'image_gen'
  model       VARCHAR(100) NOT NULL,
  cost        DECIMAL(10,6),          -- 单次成本（元）
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 每日使用量聚合（Redis 缓存 + 持久化）
CREATE TABLE daily_usage (
  user_id     UUID REFERENCES users(id),
  date        DATE NOT NULL,
  vision_count    INT DEFAULT 0,
  image_gen_count INT DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- 订单表
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  tier        VARCHAR(20) NOT NULL,
  period      VARCHAR(10) NOT NULL,  -- 'monthly' | 'yearly'
  amount      DECIMAL(10,2) NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending',  -- pending / paid / refunded
  payment_channel VARCHAR(20),       -- wechat / alipay / stripe
  payment_id  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT NOW(),
  paid_at     TIMESTAMP
);

-- 提示词收藏表
CREATE TABLE saved_prompts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  prompt      TEXT NOT NULL,
  source      VARCHAR(20),           -- 'vision' | 'manual'
  image_url   TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 六、产品路线图

### Phase 1：基础优化（v1.1）— 2 周

- [ ] 服务端限流（Vercel KV / Upstash Redis）
- [ ] 请求签名防滥用
- [ ] 提示词历史记录（本地存储）
- [ ] 多图片比例选择
- [ ] 版本号与 package.json 联动
- [ ] 错误信息优化与用户提示

### Phase 2：用户体系（v1.5）— 4 周

- [ ] Next.js 用户中心（登录 / 注册 / 个人中心）
- [ ] 数据库搭建（Supabase / PlanetScale）
- [ ] JWT 鉴权 → 扩展对接
- [ ] 套餐展示与选择页面
- [ ] 扩展内登录状态同步
- [ ] 服务端基于用户 ID 的限流

### Phase 3：商业化（v2.0）— 4 周

- [ ] 支付系统对接（微信支付 / 支付宝）
- [ ] 订阅管理（续费 / 取消 / 到期降级）
- [ ] 多模型接入与路由（FLUX.1、GPT-4o）
- [ ] 模型选择器 UI
- [ ] 使用量统计仪表盘
- [ ] 邀请码 / 推广返利系统

### Phase 4：功能增强（v2.5）— 持续

- [ ] 批量生成与变体
- [ ] 提示词模板库
- [ ] 图生图 / 风格迁移
- [ ] 超分辨率放大
- [ ] 中英文双语切换
- [ ] 社区分享与画廊

### Phase 5：生态扩展（v3.0）— 远期

- [ ] 开放 API（旗舰版用户）
- [ ] VS Code / Figma 插件
- [ ] 移动端 PWA
- [ ] 团队版 / 企业版
- [ ] 自建推理服务降成本

---

## 七、竞品分析

| 产品 | 定位 | 优势 | 劣势 | 定价 |
|------|------|------|------|------|
| **Midjourney** | 专业 AI 绘图 | 生图质量最高 | 无浏览器集成，需 Discord | $10-60/月 |
| **DALL-E (ChatGPT)** | 通用 AI 绘图 | GPT 集成，理解力强 | 无右键识图，需打开网页 | $20/月 (Plus) |
| **Eagle** | 素材管理 | 本地管理强 | 无 AI 生图 | ¥199 买断 |
| **Pixso AI** | 设计工具 AI | 设计流程集成 | 重，非浏览器扩展 | ¥99-299/月 |
| **VisionPrompt** | 浏览器 AI 生图 | 右键即用，轻量，闭环 | 模型能力受限于 API | ¥0-99.9/月 |

**差异化竞争力**：
1. **浏览器原生集成** — 右键即用，零切换成本
2. **双向闭环** — 识图 + 生图一体化，竞品多为单向
3. **轻量无侵入** — 无需额外软件，Chrome 安装即用
4. **中文优先** — 提示词生成针对中文优化，国内用户友好

---

## 八、关键指标（KPI）

### 8.1 增长指标

| 指标 | 目标（3 个月） | 目标（6 个月） | 目标（12 个月） |
|------|:---:|:---:|:---:|
| Chrome Web Store 安装量 | 1,000 | 5,000 | 20,000 |
| 日活用户 (DAU) | 100 | 500 | 2,000 |
| 付费用户数 | - | 50 | 500 |
| 付费转化率 | - | 1% | 2.5% |
| 月收入 (MRR) | ¥0 | ¥1,500 | ¥15,000 |

### 8.2 产品指标

| 指标 | 目标 |
|------|------|
| 单次识图延迟 (P95) | < 5 秒 |
| 单次生图延迟 (P95) | < 15 秒 |
| API 成功率 | > 99% |
| 用户 7 日留存率 | > 30% |
| 商店评分 | > 4.5 星 |

---

## 九、风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|----------|
| SiliconFlow 服务不稳定 | 核心功能不可用 | 接入备用 API（Replicate / Together AI） |
| API 成本超预期 | 亏损 | 动态限流 + 缓存 + 自建推理 |
| 模型下线或涨价 | 功能降级 | 抽象模型层，快速切换替代模型 |
| Chrome Web Store 审核被拒 | 上架延迟 | 严格遵守政策，提前准备合规材料 |
| 免费用户 API 滥用 | 成本失控 | 服务端限流 + 设备指纹 + 验证码 |
| 竞品推出类似功能 | 用户流失 | 深耕浏览器集成体验，建立社区壁垒 |

---

*本文档将随产品迭代持续更新。*
