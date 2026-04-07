import { Storage } from "@plasmohq/storage"

const storage = new Storage()
const CONTEXT_MENU_ID = "generate-prompt-and-image"
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"
const DEFAULT_MODEL = "deepseek-vl2"
const HARDCODED_DEEPSEEK_API_KEY = "sk-267efd103329466faf2346979031111d"
type ImageContext = {
  title: string
  alt: string
  imageTitle: string
  ariaLabel: string
  nearbyText: string
}


const ensureContextMenu = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "生成提示词",
      contexts: ["image"]
    })
  })
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu()
})

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.srcUrl || !tab?.id) {
    return
  }

  await storage.set("selectedImagePayload", {
    url: info.srcUrl,
    timestamp: Date.now()
  })

  const apiKey = HARDCODED_DEEPSEEK_API_KEY || (await storage.get<string>("deepseekApiKey"))
  const model = (await storage.get<string>("deepseekModel")) || DEFAULT_MODEL

  if (!apiKey) {
    await showFloatingPrompt(tab.id, "未配置 DeepSeek API Key，请在代码中设置。")
    return
  }

  await showFloatingPrompt(tab.id, "正在调用 DeepSeek 生成提示词，请稍候...", true)

  try {
    const prompt = await generatePromptByDeepSeek(info.srcUrl, tab.id, apiKey, model)

    await storage.set("latestPrompt", prompt)
    await showFloatingPrompt(tab.id, prompt)
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : "未知错误"
    await showFloatingPrompt(tab.id, `生成失败：${message}`)
  }
})

const imageUrlToDataUrl = async (imageUrl: string) => {
  const res = await fetch(imageUrl)

  if (!res.ok) {
    throw new Error(`图片下载失败: ${res.status}`)
  }

  const contentType = res.headers.get("content-type") || "image/jpeg"
  const buffer = await res.arrayBuffer()

  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  const base64 = btoa(binary)
  return `data:${contentType};base64,${base64}`
}

const extractImageContext = async (tabId: number, imageUrl: string) => {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: (targetImageUrl: string) => {
      const normalize = (text: string) => text.replace(/\s+/g, " ").trim()
      const safeText = (text?: string | null) => (text ? normalize(text).slice(0, 300) : "")

      const allImages = Array.from(document.querySelectorAll("img"))
      const selected =
        allImages.find((img) => img.currentSrc === targetImageUrl || img.src === targetImageUrl) || null

      const title = safeText(document.title)
      const alt = safeText(selected?.getAttribute("alt"))
      const imageTitle = safeText(selected?.getAttribute("title"))
      const ariaLabel = safeText(selected?.getAttribute("aria-label"))

      let nearbyText = ""
      if (selected) {
        const container =
          selected.closest("figure, article, section, div, li") || selected.parentElement || selected
        nearbyText = safeText(container?.textContent)
      }

      return { title, alt, imageTitle, ariaLabel, nearbyText }
    },
    args: [imageUrl]
  })

  return (
    result?.[0]?.result || {
      title: "",
      alt: "",
      imageTitle: "",
      ariaLabel: "",
      nearbyText: ""
    }
  ) as ImageContext
}

const generatePromptByDeepSeek = async (
  imageUrl: string,
  tabId: number,
  apiKey: string,
  model: string
) => {
  const imageDataUrl = await imageUrlToDataUrl(imageUrl)

  const multimodalBody = {
    model,
    messages: [
      {
        role: "system",
        content:
          "你是专业提示词工程师。你会先准确理解图片内容，再输出一段中文文生图提示词。只输出提示词本身，不要解释。"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请根据这张图片生成高质量中文提示词，包含主体、环境、光线、构图、风格。"
          },
          {
            type: "image_url",
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ],
    temperature: 0.7
  }

  const res = await fetch(DEEPSEEK_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(multimodalBody)
  })

  if (res.ok) {
    const data = await res.json()
    const prompt = data?.choices?.[0]?.message?.content?.trim()
    if (!prompt) throw new Error("DeepSeek 未返回提示词")
    return prompt
  }

  const errorText = await res.text()
  const unsupportedImageInput =
    res.status === 400 &&
    (errorText.includes("unknown variant `image_url`") ||
      errorText.includes("expected `text`"))

  if (!unsupportedImageInput) {
    throw new Error(`DeepSeek 请求失败: ${res.status} ${errorText.slice(0, 300)}`)
  }

  const context = await extractImageContext(tabId, imageUrl)
  const fallbackRes = await fetch(DEEPSEEK_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是专业提示词工程师。当前无法直接读取图片像素，只能根据页面上下文生成提示词。禁止捏造人物、动作、场景；没有明确线索就不要写。只输出提示词本身。"
        },
        {
          role: "user",
          content: `请根据以下上下文生成中文文生图提示词。
图片链接: ${imageUrl}
页面标题: ${context.title || "无"}
图片alt: ${context.alt || "无"}
图片title: ${context.imageTitle || "无"}
图片aria-label: ${context.ariaLabel || "无"}
图片附近文案: ${context.nearbyText || "无"}
要求: 若上下文没有人物线索，明确禁止出现人物描述。`
        }
      ],
      temperature: 0.7
    })
  })

  if (!fallbackRes.ok) {
    const fallbackError = await fallbackRes.text()
    throw new Error(`DeepSeek 降级请求失败: ${fallbackRes.status} ${fallbackError.slice(0, 300)}`)
  }

  const fallbackData = await fallbackRes.json()
  const fallbackPrompt = fallbackData?.choices?.[0]?.message?.content?.trim()
  if (!fallbackPrompt) throw new Error("DeepSeek 降级请求未返回提示词")

  return fallbackPrompt
}

const showFloatingPrompt = async (tabId: number, text: string, isLoading = false) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (content: string, loading: boolean) => {
      const old = document.getElementById("__image_prompt_overlay__")
      if (old) old.remove()

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

      const close = document.createElement("button")
      close.textContent = "\u2715"
      close.style.position = "absolute"
      close.style.top = "10px"
      close.style.right = "12px"
      close.style.background = "transparent"
      close.style.border = "none"
      close.style.color = "#9ca3af"
      close.style.fontSize = "16px"
      close.style.cursor = "pointer"
      close.onclick = () => overlay.remove()

      const body = document.createElement("div")
      body.textContent = content
      body.style.whiteSpace = "pre-wrap"

      box.appendChild(close)
      box.appendChild(body)

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
            setTimeout(() => { copyBtn.textContent = "复制" }, 1500)
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
