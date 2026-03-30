/**
 * @jest-environment node
 */

import { LLMOutputParser } from '../output-parser'

const FULL_LLM_OUTPUT = `[CONTENT_TYPE]: 观点分析
[BODY]:
这是改写后的正文内容。
包含多行文本。
[TITLE_1]: 第一个备选标题
[TITLE_2]: 第二个备选标题
[TITLE_3]: 第三个备选标题
[TAGS]: 标签A, 标签B, 标签C
[HOOK]: 这是互动引导语`

describe('LLMOutputParser', () => {
  describe('processChunk - 正常完整输出', () => {
    it('一次性传入完整输出时，正确提取 body 片段', () => {
      const parser = new LLMOutputParser()
      const result = parser.processChunk(FULL_LLM_OUTPUT)
      expect(result.unsupported).toBe(false)
      // body 内容应被提取
      const allChunks = result.chunks.join('')
      expect(allChunks).toContain('这是改写后的正文内容')
      expect(allChunks).toContain('包含多行文本')
      // 不应包含 section markers
      expect(allChunks).not.toContain('[TITLE_1]')
      expect(allChunks).not.toContain('[TAGS]')
    })

    it('一次性传入时 finalize 返回正确的 titles/tags/hook', () => {
      const parser = new LLMOutputParser()
      parser.processChunk(FULL_LLM_OUTPUT)
      const { titles, tags, hook, remainingBodyChunks } = parser.finalize()

      expect(titles).toEqual(['第一个备选标题', '第二个备选标题', '第三个备选标题'])
      expect(tags).toEqual(['标签A', '标签B', '标签C'])
      expect(hook).toBe('这是互动引导语')
      expect(remainingBodyChunks).toEqual([])
    })
  })

  describe('processChunk - 分段传入（模拟真实流式场景）', () => {
    it('chunks 跨越 [BODY]: 边界时，body 从正确位置开始', () => {
      const parser = new LLMOutputParser()

      // 第一段：包含 CONTENT_TYPE 和部分 BODY
      const part1 = '[CONTENT_TYPE]: 观点分析\n[BODY]:\n这是'
      // 第二段：body 剩余内容和后续 markers
      const part2 = '正文内容\n[TITLE_1]: 标题1\n[TITLE_2]: 标题2\n[TITLE_3]: 标题3\n[TAGS]: 标签1\n[HOOK]: 引导'

      const r1 = parser.processChunk(part1)
      const r2 = parser.processChunk(part2)

      expect(r1.unsupported).toBe(false)
      expect(r2.unsupported).toBe(false)

      const allChunks = [...r1.chunks, ...r2.chunks].join('')
      expect(allChunks).toContain('这是')
      expect(allChunks).toContain('正文内容')
      expect(allChunks).not.toContain('[TITLE_1]')
    })

    it('chunks 跨越 [TITLE_1]: 边界时，body 在正确位置结束', () => {
      const parser = new LLMOutputParser()

      // 第一段：body 正文，末尾刚好切断
      const part1 = '[CONTENT_TYPE]: 观点分析\n[BODY]:\n正文内容在这里\n[TITLE'
      // 第二段：TITLE marker 剩余部分
      const part2 = '_1]: 标题一\n[TITLE_2]: 标题二\n[TITLE_3]: 标题三\n[TAGS]: 标签\n[HOOK]: 引导'

      const r1 = parser.processChunk(part1)
      const r2 = parser.processChunk(part2)

      const allChunks = [...r1.chunks, ...r2.chunks].join('')
      // body 内容应被正确提取
      expect(allChunks).toContain('正文内容在这里')
      // TITLE marker 不应出现在 chunks 中
      expect(allChunks).not.toContain('[TITLE_1]')
      expect(allChunks).not.toContain('[TITLE')
    })

    it('LOOKAHEAD 机制：短 chunk 时先不发送，后续 chunk 才释放', () => {
      const parser = new LLMOutputParser()

      // 进入 body 状态
      parser.processChunk('[CONTENT_TYPE]: 观点分析\n[BODY]:\n')

      // 发送短 chunk（1 字符，远小于 LOOKAHEAD=25），应被保守缓冲
      const r1 = parser.processChunk('短')
      expect(r1.unsupported).toBe(false)
      // buffer 中只有 1 字符，不足 LOOKAHEAD=25，安全窗口为 0，不应立即发送
      expect(r1.chunks).toEqual([])

      // 发送 26 个 ASCII 字符（超过 LOOKAHEAD=25 的增量），触发 '短' 的释放
      const r2 = parser.processChunk('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
      expect(r2.unsupported).toBe(false)

      // processChunk 已将 '短' 和部分 ASCII 内容释放出来
      const streamedChunks = [...r1.chunks, ...r2.chunks].join('')
      expect(streamedChunks).toContain('短')

      // finalize 回收 LOOKAHEAD 保留的尾部内容，总体不丢失
      const { remainingBodyChunks } = parser.finalize()
      const totalBody = streamedChunks + remainingBodyChunks.join('')
      expect(totalBody).toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    })
  })

  describe('processChunk - [UNSUPPORTED_CONTENT] 检测', () => {
    it('before_body 阶段出现 [UNSUPPORTED_CONTENT] 时返回 unsupported: true', () => {
      const parser = new LLMOutputParser()
      const result = parser.processChunk(
        '[CONTENT_TYPE]: 其他\n[UNSUPPORTED_CONTENT]\n此内容无法改写'
      )
      expect(result.unsupported).toBe(true)
    })

    it('[UNSUPPORTED_CONTENT] 作为 section marker 出现在 body 后时返回 unsupported: true', () => {
      const parser = new LLMOutputParser()
      const result = parser.processChunk(
        '[CONTENT_TYPE]: 其他\n[BODY]:\n部分内容\n[UNSUPPORTED_CONTENT]'
      )
      expect(result.unsupported).toBe(true)
    })

    it('连续调用 processChunk 时，第二次检测到 [UNSUPPORTED_CONTENT] 也能正确返回', () => {
      const parser = new LLMOutputParser()
      parser.processChunk('[CONTENT_TYPE]: 观点分析\n[BODY]:\n正文')
      const result = parser.processChunk('[UNSUPPORTED_CONTENT]')
      expect(result.unsupported).toBe(true)
    })
  })

  describe('finalize - 结构化字段解析', () => {
    it('正确解析 3 个 titles', () => {
      const parser = new LLMOutputParser()
      parser.processChunk(FULL_LLM_OUTPUT)
      const { titles } = parser.finalize()
      expect(titles).toHaveLength(3)
      expect(titles[0]).toBe('第一个备选标题')
      expect(titles[1]).toBe('第二个备选标题')
      expect(titles[2]).toBe('第三个备选标题')
    })

    it('tags 按逗号分隔并 trim 空格', () => {
      const parser = new LLMOutputParser()
      const output = '[CONTENT_TYPE]: 教程列表\n[BODY]:\n内容\n[TITLE_1]: t1\n[TITLE_2]: t2\n[TITLE_3]: t3\n[TAGS]:  标签1 ,  标签2  ,  标签3 \n[HOOK]: 引导'
      parser.processChunk(output)
      const { tags } = parser.finalize()
      expect(tags).toEqual(['标签1', '标签2', '标签3'])
    })

    it('hook 正确提取', () => {
      const parser = new LLMOutputParser()
      parser.processChunk(FULL_LLM_OUTPUT)
      const { hook } = parser.finalize()
      expect(hook).toBe('这是互动引导语')
    })

    it('LLM 输出格式不完整（无 section markers）时，finalize 返回剩余内容为 remainingBodyChunks', () => {
      const parser = new LLMOutputParser()
      // 只有 BODY 开始，没有后续 markers（LLM 输出被截断）
      const truncatedOutput = '[CONTENT_TYPE]: 观点分析\n[BODY]:\n正文内容被截断了'
      parser.processChunk(truncatedOutput)
      const { remainingBodyChunks, titles, tags, hook } = parser.finalize()

      // 剩余 body 内容应被返回
      const bodyText = remainingBodyChunks.join('')
      expect(bodyText.trim()).toContain('正文内容被截断了')

      // 无 markers → 空数组/空字符串
      expect(titles).toEqual([])
      expect(tags).toEqual([])
      expect(hook).toBe('')
    })

    it('LLM 输出完全没有 [BODY]: 标记时，finalize 返回整个 buffer 作为 remainingBodyChunks', () => {
      const parser = new LLMOutputParser()
      // LLM 输出格式完全异常，没有任何 [BODY]: 标记
      parser.processChunk('这是没有格式标记的原始输出内容')
      const { remainingBodyChunks, titles, tags, hook } = parser.finalize()

      // 应将整个 buffer 作为 body 返回，避免静默丢失
      expect(remainingBodyChunks.join('')).toContain('这是没有格式标记的原始输出内容')
      // 无 markers → 空数组/空字符串
      expect(titles).toEqual([])
      expect(tags).toEqual([])
      expect(hook).toBe('')
    })

    it('缺少 TITLE_2 时 titles 数组仍只包含找到的标题', () => {
      const parser = new LLMOutputParser()
      const partial = '[CONTENT_TYPE]: 观点分析\n[BODY]:\n内容\n[TITLE_1]: 仅有一个标题\n[TAGS]: 标签\n[HOOK]: 引导'
      parser.processChunk(partial)
      const { titles } = parser.finalize()
      // TITLE_2、TITLE_3 不存在，应被过滤
      expect(titles).toEqual(['仅有一个标题'])
    })
  })

  describe('多次实例化独立性', () => {
    it('不同 parser 实例之间状态完全独立', () => {
      const parser1 = new LLMOutputParser()
      const parser2 = new LLMOutputParser()

      parser1.processChunk('[CONTENT_TYPE]: 观点分析\n[BODY]:\n内容1\n[TITLE_1]: t1\n[TITLE_2]: t2\n[TITLE_3]: t3\n[TAGS]: s\n[HOOK]: h')
      parser2.processChunk('[CONTENT_TYPE]: 教程列表\n[BODY]:\n内容2\n[TITLE_1]: tt1\n[TITLE_2]: tt2\n[TITLE_3]: tt3\n[TAGS]: ss\n[HOOK]: hh')

      const r1 = parser1.finalize()
      const r2 = parser2.finalize()

      expect(r1.titles[0]).toBe('t1')
      expect(r2.titles[0]).toBe('tt1')
    })
  })
})
