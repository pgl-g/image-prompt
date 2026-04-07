export type TierLevel = "free" | "basic" | "premium"

export interface ModelConfig {
  visionApi: string
  visionModel: string
  imageGenApi: string
  imageGenModel: string
  apiKey: string
  label: string
  description: string
  dailyLimit: number
  imageSize: string
}

const SILICONFLOW_API_KEY = "sk-gdiamfgbkdmmeazdmqzgbjilaicxynggkjulbstylytjojqz"

export const MODEL_TIERS: Record<TierLevel, ModelConfig> = {
  free: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "Kwai-Kolors/Kolors",
    apiKey: SILICONFLOW_API_KEY,
    label: "免费版",
    description: "Kolors 生图 + Qwen2.5-VL 识图",
    dailyLimit: 10,
    imageSize: "1024x1024"
  },
  basic: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "black-forest-labs/FLUX.1-schnell",
    apiKey: SILICONFLOW_API_KEY,
    label: "基础版",
    description: "FLUX.1-schnell 生图 + Qwen2.5-VL 识图",
    dailyLimit: 50,
    imageSize: "1024x1024"
  },
  premium: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "black-forest-labs/FLUX.1-dev",
    apiKey: SILICONFLOW_API_KEY,
    label: "高级版",
    description: "FLUX.1-dev 生图 + Qwen2.5-VL 识图",
    dailyLimit: -1,
    imageSize: "1024x1024"
  }
}

export const TIER_ORDER: TierLevel[] = ["free", "basic", "premium"]

export const DEFAULT_TIER: TierLevel = "free"

export const getTierConfig = (tier: TierLevel): ModelConfig => {
  return MODEL_TIERS[tier] || MODEL_TIERS[DEFAULT_TIER]
}
