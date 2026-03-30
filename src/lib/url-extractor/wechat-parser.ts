import type { ExtractResult } from './extractor'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

function extractJsContent(html: string): string | null {
  // 匹配 id="js_content" 的 div 块，允许属性顺序不同
  const match = html.match(/id=["']js_content["'][^>]*>([\s\S]*?)<\/div>/)
  if (!match) return null
  const raw = match[1]
  // 去除 HTML 标签，规范化空白
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function extractWechat(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    const res = await fetch(url, { signal, headers: BROWSER_HEADERS })
    if (!res.ok) {
      return { success: false, error: '无法访问该微信文章，请手动粘贴内容' }
    }
    const html = await res.text()
    const text = extractJsContent(html)
    if (!text || text.length < 10) {
      return { success: false, error: '无法提取微信文章内容，请手动粘贴内容' }
    }
    return { success: true, text }
  } catch {
    return { success: false, error: '提取微信文章失败，请手动粘贴内容' }
  }
}
