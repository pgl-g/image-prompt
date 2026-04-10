/**
 * 提示词历史记录管理
 *
 * 使用 chrome.storage.local 存储最近 50 条提示词。
 * 支持：添加、删除、清空、去重。
 */

export interface HistoryItem {
  id: string
  prompt: string
  timestamp: number
  source: "vision" | "manual"
}

const STORAGE_KEY = "promptHistory"
const MAX_ITEMS = 50

/** 获取全部历史记录（按时间倒序） */
export async function getHistory(): Promise<HistoryItem[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY)
  return data[STORAGE_KEY] || []
}

/** 添加一条历史记录（自动去重，相同内容的旧记录会被替换） */
export async function addToHistory(
  prompt: string,
  source: "vision" | "manual"
): Promise<void> {
  const trimmed = prompt.trim()
  if (!trimmed) return

  const history = await getHistory()

  const newItem: HistoryItem = {
    id: crypto.randomUUID(),
    prompt: trimmed,
    timestamp: Date.now(),
    source,
  }

  // 去重：移除相同提示词的旧条目
  const filtered = history.filter((h) => h.prompt !== trimmed)
  filtered.unshift(newItem)

  // 超出上限则截断
  if (filtered.length > MAX_ITEMS) filtered.length = MAX_ITEMS

  await chrome.storage.local.set({ [STORAGE_KEY]: filtered })
}

/** 删除指定历史记录 */
export async function removeFromHistory(id: string): Promise<void> {
  const history = await getHistory()
  const filtered = history.filter((h) => h.id !== id)
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered })
}

/** 清空全部历史记录 */
export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}
