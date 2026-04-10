/**
 * 公共 API 服务
 *
 * 统一视觉模型调用逻辑，供 popup.tsx 和 background.ts 共用。
 * 包含每日使用限制检查。
 */

import type { ModelConfig } from "~config/models"

// ======================== 视觉模型调用 ========================

/** 调用视觉模型，将图片 base64 转为中文提示词（通过后端代理） */
export async function callVisionModel(
  base64Url: string,
  config: ModelConfig
): Promise<string> {
  const res = await fetch(config.visionApi, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64Url,
      model: config.visionModel
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`视觉分析失败: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("模型未返回提示词")
  return content
}

// ======================== 每日使用限制 ========================

/**
 * 检查是否超出每日使用限制，未超出则自动递增计数。
 * @returns true = 可以使用，false = 已达上限
 */
export async function checkUsageLimit(dailyLimit: number): Promise<boolean> {
  if (dailyLimit === -1) return true

  const today = new Date().toISOString().slice(0, 10)
  const data = await chrome.storage.local.get(["usageCount", "usageDate"])

  let count: number = data.usageCount || 0
  if (data.usageDate !== today) {
    count = 0
  }

  if (count >= dailyLimit) return false

  await chrome.storage.local.set({ usageCount: count + 1, usageDate: today })
  return true
}
