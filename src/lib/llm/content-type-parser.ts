import type { ContentType } from '@/generated/prisma/client'

const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  观点分析: 'opinion',
  体验叙事: 'narrative',
  教程列表: 'tutorial',
  评测对比: 'review',
  其他: 'other',
}

export function parseContentType(llmOutput: string): ContentType {
  const match = llmOutput.match(/^\[CONTENT_TYPE\]:\s*(.+)/m)
  if (!match) {
    return 'other'
  }

  const label = match[1].trim()
  return CONTENT_TYPE_MAP[label] ?? 'other'
}
