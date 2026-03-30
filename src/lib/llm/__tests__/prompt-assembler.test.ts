/**
 * @jest-environment node
 */
import { assemblePrompt } from '@/lib/llm/prompt-assembler'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformConfig: {
      findFirst: jest.fn(),
    },
  },
}))

const mockFindFirst = prisma.platformConfig.findFirst as jest.MockedFunction<
  typeof prisma.platformConfig.findFirst
>

const baseConfig = {
  id: 'config-1',
  platform: 'xiaohongshu' as const,
  isActive: true,
  styleRules: ['结论前置，先说结果再说过程', '使用短句，每段不超过3句', '适当使用emoji（不超过5个）'],
  fewShotExamples: [
    { original: '原文摘要示例', rewritten: '改写后版本示例' },
  ],
  promptTemplate: '',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('assemblePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('激活配置存在 → 返回两条消息（system + user），系统消息包含 [CONTENT_TYPE] 指令，用户消息为原文', async () => {
    mockFindFirst.mockResolvedValueOnce(baseConfig as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'standard',
      originalText: '这是一段原始文章内容。',
    })

    expect(result).toHaveLength(2)
    expect(result[0].role).toBe('system')
    expect(result[1].role).toBe('user')
    expect(result[0].content).toContain('[CONTENT_TYPE]')
    expect(result[1].content).toBe('这是一段原始文章内容。')
  })

  it('激活配置存在 → 系统消息包含 style_rules 规则文本和 few-shot 示例文本', async () => {
    mockFindFirst.mockResolvedValueOnce(baseConfig as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'standard',
      originalText: '原文',
    })

    const systemContent = result[0].content
    expect(systemContent).toContain('- 结论前置，先说结果再说过程')
    expect(systemContent).toContain('- 使用短句，每段不超过3句')
    expect(systemContent).toContain('参考优秀案例')
    expect(systemContent).toContain('原文摘要示例')
    expect(systemContent).toContain('改写后版本示例')
  })

  it('语气 casual → 系统消息包含对应语气文本', async () => {
    mockFindFirst.mockResolvedValueOnce(baseConfig as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'casual',
      originalText: '原文',
    })

    expect(result[0].content).toContain('口语化')
  })

  it('语气 standard → 系统消息包含对应语气文本', async () => {
    mockFindFirst.mockResolvedValueOnce(baseConfig as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'standard',
      originalText: '原文',
    })

    expect(result[0].content).toContain('标准')
  })

  it('语气 formal → 系统消息包含对应语气文本', async () => {
    mockFindFirst.mockResolvedValueOnce(baseConfig as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'formal',
      originalText: '原文',
    })

    expect(result[0].content).toContain('正式')
  })

  it('无激活配置（findFirst 返回 null）→ 抛出含平台名的错误消息', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    await expect(
      assemblePrompt({
        platform: 'wechat',
        tone: 'standard',
        originalText: '原文',
      }),
    ).rejects.toThrow('平台 wechat 无激活配置，请先在管理后台配置并激活该平台规则')
  })

  it('originalText 为空字符串时 → 抛出错误', async () => {
    await expect(
      assemblePrompt({
        platform: 'xiaohongshu',
        tone: 'standard',
        originalText: '   ',
      }),
    ).rejects.toThrow('originalText 不能为空')
  })

  it('styleRules 为非数组时 → 抛出格式错误', async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...baseConfig,
      styleRules: { rules: ['规则1'] },
    } as any)

    await expect(
      assemblePrompt({
        platform: 'xiaohongshu',
        tone: 'standard',
        originalText: '原文',
      }),
    ).rejects.toThrow('styleRules 配置格式错误')
  })

  it('fewShotExamples 为非数组时 → 抛出格式错误', async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...baseConfig,
      fewShotExamples: null,
    } as any)

    await expect(
      assemblePrompt({
        platform: 'xiaohongshu',
        tone: 'standard',
        originalText: '原文',
      }),
    ).rejects.toThrow('fewShotExamples 配置格式错误')
  })

  it('fewShotExamples 为空数组时，系统消息不包含"参考优秀案例"', async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...baseConfig,
      fewShotExamples: [],
    } as any)

    const result = await assemblePrompt({
      platform: 'xiaohongshu',
      tone: 'standard',
      originalText: '原文',
    })

    expect(result[0].content).not.toContain('参考优秀案例')
  })
})
