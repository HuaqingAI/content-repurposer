import type { ExtractResult } from './extractor'

const JINA_BASE = 'https://r.jina.ai'
const MIN_LENGTH = 50

export async function extractViaJina(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    const res = await fetch(`${JINA_BASE}/${url}`, {
      signal,
      headers: {
        Accept: 'text/plain',
        'X-Return-Format': 'text',
      },
    })
    if (!res.ok) {
      return { success: false, error: 'Jina 提取失败' }
    }
    const text = (await res.text()).trim()
    if (text.length < MIN_LENGTH) {
      return { success: false, error: '提取内容过短' }
    }
    return { success: true, text }
  } catch {
    return { success: false, error: 'Jina 提取异常' }
  }
}
