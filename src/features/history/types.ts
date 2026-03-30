export const PAGE_SIZE = 20

export interface HistoryRecordSummary {
  id: string
  originalText: string // 前 100 字预览
  contentType: string
  createdAt: string // ISO 字符串
  results: Array<{ id: string; platform: string }>
}

export interface HistoryResult {
  id: string
  recordId: string
  platform: string
  tone: string
  body: string
  titles: string[]
  tags: string[]
  hook: string
  createdAt: string
  feedback: string | null
  // apiModel / apiTokensUsed / apiCostCents / apiDurationMs 为内部字段，API 不返回
}

export interface HistoryRecordDetail {
  id: string
  originalText: string
  originalUrl: string | null
  contentType: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

export const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

export const TONE_LABELS: Record<string, string> = {
  casual: '口语化',
  standard: '标准',
  formal: '正式',
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  opinion: '观点分析',
  narrative: '体验叙事',
  tutorial: '教程列表',
  review: '评测对比',
  other: '其他',
}
