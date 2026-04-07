import { useEffect, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"

import "./style.css"

const IMAGE_GEN_API = "https://api.siliconflow.cn/v1/images/generations"
const IMAGE_GEN_MODEL = "black-forest-labs/FLUX.1-schnell"

export default function SidePanel() {
  const [latestPrompt] = useStorage<string>("latestPrompt", "")
  const [prompt, setPrompt] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [apiKey, setApiKey] = useStorage<string>("imageGenApiKey", "")

  useEffect(() => {
    if (latestPrompt) {
      setPrompt(latestPrompt)
    }
  }, [latestPrompt])

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("请输入提示词")
      return
    }
    if (!apiKey) {
      setError("请先填写图片生成 API Key")
      return
    }

    setLoading(true)
    setError("")
    setImageUrl("")

    try {
      const res = await fetch(IMAGE_GEN_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: IMAGE_GEN_MODEL,
          prompt: prompt.trim(),
          image_size: "1024x1024"
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`请求失败: ${res.status} ${text.slice(0, 200)}`)
      }

      const data = await res.json()
      const url = data?.images?.[0]?.url

      if (!url) {
        throw new Error("未返回图片")
      }

      setImageUrl(url)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 font-sans text-gray-800 max-w-[400px]">
      <h3 className="text-lg font-bold mb-4">提示词生图</h3>

      <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">
        SiliconFlow API Key
      </label>
      <input
        type="password"
        placeholder="sk-..."
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
      />

      <label className="block text-xs font-semibold text-gray-600 mt-3 mb-1">
        提示词
      </label>
      <textarea
        rows={5}
        placeholder="输入或从右键生成自动填充..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md outline-none resize-y font-[inherit] focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
      />

      <button
        onClick={generateImage}
        disabled={loading}
        className={`mt-3 w-full py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-all ${
          loading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        }`}>
        {loading ? "生成中..." : "生成图片"}
      </button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {imageUrl && (
        <div className="mt-4 text-center">
          <img
            src={imageUrl}
            alt="Generated"
            className="w-full rounded-lg shadow"
          />
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs text-indigo-500 hover:text-indigo-600">
            在新标签页打开
          </a>
        </div>
      )}
    </div>
  )
}
