/**
 * LLM 结构化输出流式解析器
 *
 * 负责从 LLM 流式输出中实时提取 body 文本片段（用于 SSE chunk 事件），
 * 以及在流结束后解析 titles / tags / hook 结构化字段。
 *
 * LLM 输出格式（由 prompt-assembler.ts 的系统提示规定）：
 *   [CONTENT_TYPE]: {观点分析/体验叙事/教程列表/评测对比/其他}
 *   [BODY]:
 *   {改写正文}
 *   [TITLE_1]: {备选标题1}
 *   [TITLE_2]: {备选标题2}
 *   [TITLE_3]: {备选标题3}
 *   [TAGS]: {标签1}, {标签2}, {标签3}
 *   [HOOK]: {互动引导语}
 *
 * 注意：[CONTENT_TYPE] 解析由 content-type-parser.ts 负责（供 Story 3.4b 落库使用），
 * 本模块只负责 body / titles / tags / hook 的解析。
 */

type ParseState = 'before_body' | 'in_body' | 'after_body'

const BODY_MARKER = '[BODY]:'

const SECTION_MARKERS = [
  '[TITLE_1]:',
  '[TITLE_2]:',
  '[TITLE_3]:',
  '[TAGS]:',
  '[HOOK]:',
  '[UNSUPPORTED_CONTENT]',
]

// 保守 buffer 尾部长度：LOOKAHEAD >= 最长 section marker 长度
// [UNSUPPORTED_CONTENT] = 21 字符，使用 25 以确保安全
const LOOKAHEAD = 25

export interface ParseChunkResult {
  chunks: string[]
  unsupported: boolean
}

export interface FinalizeResult {
  remainingBodyChunks: string[]
  titles: string[]
  tags: string[]
  hook: string
}

export class LLMOutputParser {
  private buffer = ''
  private state: ParseState = 'before_body'
  private lastEmittedPos = 0
  private _unsupported = false

  /**
   * 处理一个新的文本片段。
   * 返回可立即通过 SSE `chunk` 事件发送的 body 文本片段列表，
   * 以及是否检测到 [UNSUPPORTED_CONTENT] 标签。
   */
  processChunk(text: string): ParseChunkResult {
    this.buffer += text
    const result: string[] = []

    // 检测 [UNSUPPORTED_CONTENT]（任意阶段，LLM 可能在 BODY 之前或之后输出）
    if (!this._unsupported && this.buffer.includes('[UNSUPPORTED_CONTENT]')) {
      this._unsupported = true
      return { chunks: [], unsupported: true }
    }

    if (this.state === 'before_body') {
      const bodyIdx = this.buffer.indexOf(BODY_MARKER)
      if (bodyIdx >= 0) {
        // 跳过 [BODY]: 后的换行符
        let startPos = bodyIdx + BODY_MARKER.length
        while (startPos < this.buffer.length && this.buffer[startPos] === '\n') {
          startPos++
        }
        this.lastEmittedPos = startPos
        this.state = 'in_body'
      }
    }

    if (this.state === 'in_body') {
      // 查找最早出现的 section marker（从上次已发送位置开始搜索）
      let markerPos = -1
      for (const marker of SECTION_MARKERS) {
        const idx = this.buffer.indexOf(marker, this.lastEmittedPos)
        if (idx >= 0 && (markerPos === -1 || idx < markerPos)) {
          markerPos = idx
        }
      }

      if (markerPos >= 0) {
        // body 已结束：发送剩余 body 文本，切换状态
        const bodyText = this.buffer.slice(this.lastEmittedPos, markerPos)
        const trimmedBodyText = bodyText.endsWith('\n') ? bodyText.slice(0, -1) : bodyText
        if (trimmedBodyText) result.push(trimmedBodyText)
        this.lastEmittedPos = markerPos
        this.state = 'after_body'

        // 再次检测 [UNSUPPORTED_CONTENT]（作为 section marker 出现在 body 后）
        if (this.buffer.slice(markerPos).startsWith('[UNSUPPORTED_CONTENT]')) {
          this._unsupported = true
          return { chunks: result, unsupported: true }
        }
      } else {
        // 仍在 body 中：发送保守范围内的新文本
        const safeEnd = Math.max(this.lastEmittedPos, this.buffer.length - LOOKAHEAD)
        if (safeEnd > this.lastEmittedPos) {
          const newText = this.buffer.slice(this.lastEmittedPos, safeEnd)
          if (newText) result.push(newText)
          this.lastEmittedPos = safeEnd
        }
      }
    }

    return { chunks: result, unsupported: false }
  }

  /**
   * 流结束时调用。
   * 返回尚未发送的剩余 body 文本片段，以及从完整 buffer 解析的结构化字段。
   */
  finalize(): FinalizeResult {
    const remainingBodyChunks: string[] = []

    if (this.state === 'before_body') {
      // LLM 输出中完全没有 [BODY]: 标记（格式异常），将整个 buffer 内容作为 body 返回
      // 避免内容静默丢失，让用户至少能看到 LLM 的原始输出
      const remaining = this.buffer.trim()
      if (remaining) remainingBodyChunks.push(remaining)
    } else if (this.state === 'in_body') {
      // LLM 输出不完整（未出现 section markers），将剩余内容作为 body 发送
      const remaining = this.buffer.slice(this.lastEmittedPos)
      if (remaining.trim()) remainingBodyChunks.push(remaining)
    } else if (this.state === 'after_body') {
      // 若有剩余 body 文本未发送（LOOKAHEAD 保留的部分已在 processChunk 中处理）
      // lastEmittedPos 指向 section marker 起点，body 已完整发送
    }

    const fullText = this.buffer

    // 提取 [TITLE_1]、[TITLE_2]、[TITLE_3]
    const titles = [
      extractSingleLineTag(fullText, '[TITLE_1]:'),
      extractSingleLineTag(fullText, '[TITLE_2]:'),
      extractSingleLineTag(fullText, '[TITLE_3]:'),
    ].filter((t): t is string => t !== null)

    // 提取 [TAGS]（逗号分隔，trim 空格）
    const tagsRaw = extractSingleLineTag(fullText, '[TAGS]:')
    const tags = tagsRaw
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : []

    // 提取 [HOOK]（单行）
    const hook = extractSingleLineTag(fullText, '[HOOK]:') ?? ''

    return { remainingBodyChunks, titles, tags, hook }
  }
}

function extractSingleLineTag(text: string, tag: string): string | null {
  const idx = text.indexOf(tag)
  if (idx < 0) return null
  const start = idx + tag.length
  const end = text.indexOf('\n', start)
  const raw = end >= 0 ? text.slice(start, end) : text.slice(start)
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}
