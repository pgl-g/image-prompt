/**
 * Background Service Worker
 *
 * 负责：
 * 1. 注册右键菜单「生成提示词」
 * 2. 右键图片 → 调用视觉模型生成提示词 → 浮层展示
 * 3. 浮层复制后通知打开 popup
 */

import { Storage } from "@plasmohq/storage"
import { getTierConfig, DEFAULT_TIER, type TierLevel } from "~config/models"

const storage = new Storage()
const CONTEXT_MENU_ID = "generate-prompt-and-image"

// ======================== 右键菜单注册 ========================

const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "生成提示词",
      contexts: ["image"]
    })
  })
}

chrome.runtime.onInstalled.addListener(() => ensureContextMenu())
chrome.runtime.onStartup.addListener(() => ensureContextMenu())

// ======================== 消息监听 ========================

/** 接收 content script 的消息，用于复制提示词后自动打开 popup */
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "openPopup") {
    chrome.action.openPopup()
  }
})

// ======================== 右键菜单点击处理 ========================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.srcUrl || !tab?.id) return

  await showFloatingPrompt(tab.id, "正在生成提示词，请稍候...", true)

  try {
    const prompt = await generatePromptByVision(info.srcUrl)
    await storage.set("latestPrompt", prompt)
    await showFloatingPrompt(tab.id, prompt)
  } catch (error) {
    console.error(error)
    const msg = error instanceof Error ? error.message : "未知错误"
    await showFloatingPrompt(tab.id, `生成失败：${msg}`)
  }
})

// ======================== 图片处理工具 ========================

/** 将远程图片 URL 转为 base64 data URL，用于发送给视觉模型 */
const imageUrlToBase64 = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`图片下载失败: ${res.status}`)

  const contentType = res.headers.get("content-type") || "image/jpeg"
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

// ======================== 视觉模型调用 ========================

/** 调用 SiliconFlow 视觉模型（Qwen2.5-VL），将图片转为中文提示词 */
const generatePromptByVision = async (imageUrl: string): Promise<string> => {
  const tier = ((await storage.get<string>("currentTier")) || DEFAULT_TIER) as TierLevel
  const config = getTierConfig(tier)
  const base64 = await imageUrlToBase64(imageUrl)

  const res = await fetch(config.visionApi, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        {
          role: "system",
          content:
            "你是专业提示词工程师。仔细观察图片中的所有视觉细节，然后输出一段准确的中文文生图提示词。只输出提示词本身，不要任何解释或前缀。"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请根据这张图片生成高质量中文提示词，准确描述主体、环境、光线、构图、色彩、风格。"
            },
            {
              type: "image_url",
              image_url: { url: base64 }
            }
          ]
        }
      ],
      temperature: 0.7
    })
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`视觉模型请求失败: ${res.status} ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  const prompt = data?.choices?.[0]?.message?.content?.trim()
  if (!prompt) throw new Error("视觉模型未返回提示词")
  return prompt
}

// ======================== 浮层注入 ========================

/**
 * 在网页上注入毛玻璃悬浮窗，展示生成的提示词。
 * 包含「复制」按钮，复制成功后自动关闭浮层并打开 popup。
 */
const showFloatingPrompt = async (tabId: number, text: string, isLoading = false) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (content: string, loading: boolean) => {
      const old = document.getElementById("__image_prompt_overlay__")
      if (old) old.remove()

      // 全屏透明遮罩，点击空白区域关闭
      const overlay = document.createElement("div")
      overlay.id = "__image_prompt_overlay__"
      overlay.style.position = "fixed"
      overlay.style.inset = "0"
      overlay.style.zIndex = "2147483647"
      overlay.style.display = "flex"
      overlay.style.alignItems = "center"
      overlay.style.justifyContent = "center"
      overlay.style.background = "transparent"
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove()
      }

      // 毛玻璃内容卡片
      const box = document.createElement("div")
      box.style.position = "relative"
      box.style.width = "420px"
      box.style.maxWidth = "90vw"
      box.style.maxHeight = "80vh"
      box.style.overflowY = "auto"
      box.style.background = "rgba(30, 30, 30, 0.85)"
      box.style.backdropFilter = "blur(12px)"
      ;(box.style as any).webkitBackdropFilter = "blur(12px)"
      box.style.color = "#e5e7eb"
      box.style.padding = "20px"
      box.style.borderRadius = "14px"
      box.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"
      box.style.fontSize = "14px"
      box.style.lineHeight = "1.6"

      const body = document.createElement("div")
      body.textContent = content
      body.style.whiteSpace = "pre-wrap"
      box.appendChild(body)

      // 非加载态时显示复制按钮
      if (!loading) {
        const copyBtn = document.createElement("button")
        copyBtn.textContent = "复制"
        copyBtn.style.marginTop = "14px"
        copyBtn.style.display = "block"
        copyBtn.style.marginLeft = "auto"
        copyBtn.style.padding = "6px 16px"
        copyBtn.style.background = "rgba(255, 255, 255, 0.15)"
        copyBtn.style.color = "#fff"
        copyBtn.style.border = "1px solid rgba(255,255,255,0.2)"
        copyBtn.style.borderRadius = "6px"
        copyBtn.style.cursor = "pointer"
        copyBtn.style.fontSize = "13px"
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(content).then(() => {
            copyBtn.textContent = "已复制"
            setTimeout(() => {
              overlay.remove()
              chrome.runtime.sendMessage({ action: "openPopup" })
            }, 500)
          })
        }
        box.appendChild(copyBtn)
      }

      overlay.appendChild(box)
      document.body.appendChild(overlay)
    },
    args: [text, isLoading]
  })
}
