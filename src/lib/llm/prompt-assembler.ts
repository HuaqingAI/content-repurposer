import type { Platform, Tone } from '@/generated/prisma/client'
import type { ChatMessage } from '@/lib/llm/types'
import { prisma } from '@/lib/prisma'

export interface AssemblePromptParams {
  platform: Platform
  tone: Tone
  originalText: string
}

type FewShotExample = { original: string; rewritten: string }

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

const TONE_LABELS: Record<Tone, string> = {
  casual: '口语化（像和朋友聊天，轻松活泼）',
  standard: '标准（清晰易读，平衡专业与亲和力）',
  formal: '正式（严谨专业，适合知识类内容）',
}

export async function assemblePrompt(params: AssemblePromptParams): Promise<ChatMessage[]> {
  if (!params.originalText.trim()) {
    throw new Error('originalText 不能为空')
  }

  const config = await prisma.platformConfig.findFirst({
    where: {
      platform: params.platform,
      isActive: true,
    },
    orderBy: { configVersion: 'desc' },
  })

  if (config === null) {
    throw new Error(`平台 ${params.platform} 无激活配置，请先在管理后台配置并激活该平台规则`)
  }

  if (!Array.isArray(config.styleRules)) {
    throw new Error(`平台 ${params.platform} 的 styleRules 配置格式错误，期望数组`)
  }
  if (!Array.isArray(config.fewShotExamples)) {
    throw new Error(`平台 ${params.platform} 的 fewShotExamples 配置格式错误，期望数组`)
  }

  const rules = config.styleRules as string[]
  const rulesText = rules.map((r) => `- ${r}`).join('\n')

  const examples = config.fewShotExamples as FewShotExample[]
  const examplesText = examples
    .map((e, i) => `案例${i + 1}:\n原文: ${e.original}\n改写: ${e.rewritten}`)
    .join('\n---\n')

  const platformLabel = PLATFORM_LABELS[params.platform]
  const toneLabel = TONE_LABELS[params.tone]

  let systemPrompt = `你是一个专业的内容改写助手。你的任务是将用户提供的文章改写为适合${platformLabel}平台的内容。

规则：
${rulesText}`

  if (examples.length > 0) {
    systemPrompt += `\n\n参考优秀案例：\n${examplesText}`
  }

  systemPrompt += `\n\n语气风格：${toneLabel}

请严格按以下格式输出，不要增减任何标签：
[CONTENT_TYPE]: {观点分析/体验叙事/教程列表/评测对比/其他}
[BODY]:
{改写正文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语}`

  return [
    { role: 'system', content: systemPrompt },
    // originalText 直接作为 user message。system/user 消息分离已提供基本隔离；
    // LLM 不应原样回显 user 内容到结构化输出标签中。如需更强防御，在调用层净化输入。
    { role: 'user', content: params.originalText },
  ]
}
