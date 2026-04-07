import { useEffect, useRef, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { UploadCloud, Sparkles, Download, MonitorPlay, ImageIcon, Loader2, X, ChevronDown, Crown, Zap, Gift } from "lucide-react"
import { getTierConfig, MODEL_TIERS, TIER_ORDER, DEFAULT_TIER, type TierLevel } from "~config/models"

import "./style.css"

const TIER_ICONS: Record<TierLevel, typeof Gift> = {
  free: Gift,
  basic: Zap,
  premium: Crown
}

const TIER_COLORS: Record<TierLevel, string> = {
  free: "text-slate-500",
  basic: "text-blue-500",
  premium: "text-amber-500"
}

export default function Popup() {
  const [latestPrompt] = useStorage<string>("latestPrompt", "")
  const [savedImageUrl, setSavedImageUrl] = useStorage<string>("generatedImageUrl", "")
  const [currentTier, setCurrentTier] = useStorage<TierLevel>("currentTier", DEFAULT_TIER)
  const [prompt, setPrompt] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")
  const [savedPreview, setSavedPreview] = useStorage<string>("uploadPreview", "")
  const [uploadPreview, setUploadPreview] = useState("")
  const [showTierMenu, setShowTierMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const tierMenuRef = useRef<HTMLDivElement>(null)

  const config = getTierConfig(currentTier || DEFAULT_TIER)
  const TierIcon = TIER_ICONS[currentTier || DEFAULT_TIER]

  useEffect(() => {
    if (latestPrompt) setPrompt(latestPrompt)
  }, [latestPrompt])

  useEffect(() => {
    if (savedImageUrl && !imageUrl) setImageUrl(savedImageUrl)
  }, [savedImageUrl])

  useEffect(() => {
    if (savedPreview && !uploadPreview) setUploadPreview(savedPreview)
  }, [savedPreview])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) {
        setShowTierMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const analyzeImage = async (base64Url: string) => {
    setAnalyzing(true)
    setError("")

    try {
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
                "你是专业提示词工程师。请根据图片内容生成一段中文文生图提示词，包含主体、环境、光线、构图、风格。只输出提示词本身，不要解释。"
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: base64Url, detail: "high" }
                },
                {
                  type: "text",
                  text: "请根据这张图片生成高质量中文提示词。"
                }
              ]
            }
          ]
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`视觉分析失败: ${res.status} ${text.slice(0, 200)}`)
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content?.trim()
      if (!content) throw new Error("模型未返回提示词")

      setPrompt(content)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "分析失败")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const base64Url = await fileToBase64(file)
    setUploadPreview(base64Url)
    setSavedPreview(base64Url)
    await analyzeImage(base64Url)

    if (fileRef.current) fileRef.current.value = ""
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("请输入提示词")
      return
    }

    setLoading(true)
    setError("")
    setImageUrl("")

    try {
      const res = await fetch(config.imageGenApi, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.imageGenModel,
          prompt: prompt.trim(),
          image_size: config.imageSize
        })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`请求失败: ${res.status} ${text.slice(0, 200)}`)
      }

      const data = await res.json()
      const url = data?.images?.[0]?.url

      if (!url) throw new Error("未返回图片")

      setImageUrl(url)
      setSavedImageUrl(url)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-[780px] h-[480px] flex flex-col font-sans text-slate-800 bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h1 className="text-sm font-semibold text-slate-800 tracking-wide flex items-center gap-1.5">
          <MonitorPlay size={16} className="text-indigo-500" />
          VisionPrompt <span className="font-normal text-slate-400 text-xs ml-1">· 双向生图引擎</span>
        </h1>
        <div className="relative" ref={tierMenuRef}>
          <button
            onClick={() => setShowTierMenu(!showTierMenu)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer ${TIER_COLORS[currentTier || DEFAULT_TIER]}`}>
            <TierIcon size={12} />
            {config.label}
            <ChevronDown size={10} className={`transition-transform ${showTierMenu ? "rotate-180" : ""}`} />
          </button>
          {showTierMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-xl shadow-black/10 border border-slate-100 overflow-hidden z-50">
              {TIER_ORDER.map((tier) => {
                const tierConfig = MODEL_TIERS[tier]
                const Icon = TIER_ICONS[tier]
                const isActive = tier === (currentTier || DEFAULT_TIER)
                return (
                  <button
                    key={tier}
                    onClick={() => { setCurrentTier(tier); setShowTierMenu(false) }}
                    className={`w-full px-3.5 py-2.5 flex items-start gap-2.5 text-left transition-all border-none cursor-pointer ${
                      isActive ? "bg-indigo-50" : "bg-white hover:bg-slate-50"
                    }`}>
                    <Icon size={14} className={`mt-0.5 shrink-0 ${TIER_COLORS[tier]}`} />
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${isActive ? "text-indigo-600" : "text-slate-700"}`}>
                        {tierConfig.label}
                        {isActive && <span className="ml-1.5 text-[10px] text-indigo-400 font-normal">当前</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{tierConfig.description}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {tierConfig.dailyLimit === -1 ? "不限次数" : `每日 ${tierConfig.dailyLimit} 次`}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 px-5 pb-4 flex gap-5 bg-[#FAFAFA] min-h-0">
        {/* Left Column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 py-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {analyzing ? (
            <div className="w-full h-11 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 flex items-center justify-center gap-1.5 text-indigo-500 shrink-0 shadow-sm">
              <UploadCloud size={15} className="animate-pulse" />
              <span className="text-xs font-medium tracking-wide animate-pulse">正在识别图片...</span>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full h-11 rounded-xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center gap-1.5 text-xs font-medium tracking-wide text-slate-500 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group shrink-0 shadow-sm hover:shadow cursor-pointer">
              <UploadCloud size={15} className="group-hover:-translate-y-0.5 transition-transform" />
              上传图片生成提示词
            </button>
          )}

          {uploadPreview && (
            <div className="w-full h-20 rounded-xl overflow-hidden relative shrink-0 shadow-inner group/preview">
              <img
                src={uploadPreview}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              <button
                onClick={() => { setUploadPreview(""); setSavedPreview("") }}
                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-all cursor-pointer border-none backdrop-blur-sm">
                <X size={12} />
              </button>
            </div>
          )}

          <textarea
            placeholder="描述你想要的画面，或上传/右键图片自动填充..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full flex-1 min-h-[100px] p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 leading-relaxed resize-none outline-none transition-all shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400"
          />

          <button
            onClick={generateImage}
            disabled={loading || analyzing}
            className={`w-full h-12 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-all shrink-0 border-none ${
              loading || analyzing
                ? "bg-indigo-400 text-white/90 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-600 shadow-md shadow-indigo-500/20 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0"
            }`}>
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                生成图片
              </>
            )}
          </button>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Right Column */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 py-4">
          <div className="flex-1 bg-black rounded-xl overflow-hidden relative shadow-inner min-h-0 flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center w-full h-full p-8 relative overflow-hidden">
                <div className="relative flex items-center justify-center w-20 h-20 mb-5">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-indigo-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-2 rounded-full border-4 border-purple-500/30" />
                  <div className="absolute inset-2 rounded-full border-4 border-b-purple-400 border-r-transparent border-t-transparent border-l-transparent animate-spin direction-reverse" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                  <Sparkles className="text-indigo-400 animate-pulse" size={22} />
                </div>
                <h3 className="text-indigo-300 text-sm font-medium tracking-wide animate-pulse">正在生成图像...</h3>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] animate-pulse" />
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Generated"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-slate-500">
                <ImageIcon size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs opacity-50">生成的图片将显示在这里</p>
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              if (!imageUrl) return
              try {
                const res = await fetch(imageUrl)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `generated-${Date.now()}.png`
                a.click()
                URL.revokeObjectURL(url)
              } catch {
                window.open(imageUrl)
              }
            }}
            disabled={!imageUrl || loading || analyzing}
            className={`w-full h-12 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all shrink-0 border-none ${
              imageUrl && !loading && !analyzing
                ? "bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 cursor-pointer hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0"
                : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            }`}>
            <Download size={14} />
            下载图片
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="py-2 bg-white flex justify-center shrink-0">
        <span className="text-[11px] text-slate-400 font-medium tracking-wider">v0.0.1</span>
      </div>
    </div>
  )
}
