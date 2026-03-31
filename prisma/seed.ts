// prisma/seed.ts
// 平台配置种子数据脚本
// 使用 upsert 保证幂等性（多次执行不产生重复数据）

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// ── 小红书 ─────────────────────────────────────────────────────────────────

const xiaohongshuStyleRules = [
  '结构：结论前置，先说结果/收获，再说过程/细节',
  '句式：短句为主，每段不超过3句，段落间空行分隔',
  'Emoji：适当使用emoji（5-8个），放在段落开头或关键词后',
  '语气：口语化，像闺蜜/朋友聊天，轻松活泼',
  '长度：正文200-500字，不含标题和标签',
  '标题：含数字或感叹词，吸引眼球，25字以内',
  '标签：3-5个标签，用#号，选热门话题词',
  '结尾：互动引导，提问或邀请评论，一句话',
]

const xiaohongshuPromptTemplate = `你是一位专业的小红书内容创作者，擅长将各类内容改写为小红书爆款风格。

## 改写要求

请将以下原文改写为小红书风格的内容：

**风格规范：**
- 结论前置：先说结果/收获，再说过程/细节
- 短句为主，每段不超过3句，段落间空行分隔
- 适当使用emoji（5-8个），放在段落开头或关键词后
- 口语化，像闺蜜/朋友聊天，轻松活泼
- 正文200-500字，不含标题和标签
- 标题含数字或感叹词，吸引眼球，25字以内
- 3-5个标签，用#号，选热门话题词
- 结尾互动引导，提问或邀请评论，一句话

## 原文内容

{ORIGINAL_TEXT}

## 输出要求

请按以下格式严格输出，不要添加任何额外说明：

[CONTENT_TYPE]: {观点分析类|体验叙事类|教程列表类|评测对比类|其他}
[BODY]: {改写正文全文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语，一句话}

若原文为纯代码、纯数据表格或外语内容，输出：

[UNSUPPORTED_CONTENT]: 该内容暂不支持改写`

const xiaohongshuFewShot = [
  {
    original:
      '本文介绍了如何使用 React Hooks 优化组件性能，包括 useMemo、useCallback 和 React.memo 的使用场景。',
    rewritten:
      '[CONTENT_TYPE]: 教程列表类\n[BODY]:\n🔥 用了这3个Hook，React组件快了3倍！\n\n✅ 先说结论：useMemo + useCallback + React.memo 组合拳，能解决90%的性能问题\n\n📌 useMemo 用来缓存计算结果\n每次渲染都重新算？太浪费！用它把结果存起来\n\n📌 useCallback 用来缓存函数\n传给子组件的函数每次都是新的？子组件会一直重渲染\n用它固定住函数引用就好了\n\n📌 React.memo 给组件加"防抖"\nprops没变就不重渲染，配合上面两个用，效果拉满 ✨\n[TITLE_1]: 这3个React Hook用对了，性能直接翻3倍！\n[TITLE_2]: 终于搞懂useMemo和useCallback的区别了\n[TITLE_3]: 前端性能优化必看！React组件提速秘籍\n[TAGS]: #React, #前端开发, #性能优化, #程序员\n[HOOK]: 你们平时用哪个Hook最多？评论区聊聊～',
  },
]

// ── 微信公众号 ─────────────────────────────────────────────────────────────

const wechatStyleRules = [
  '结构：论点递进，先提出核心观点，再分点深度展开，结尾总结升华',
  '句式：长短句结合，段落完整，每段3-5句，适合深度阅读',
  'Emoji：克制使用emoji（0-2个），保持专业感',
  '语气：专业但不失温度，有深度，有观点，像一篇精心写就的文章',
  '长度：正文800-1500字，内容充实饱满',
  '标题：有观点或悬念，引发思考，30字以内',
  '标签：3个关键词标签，行业相关',
  '结尾：引发共鸣或思考，邀请转发或关注，一句话',
]

const wechatPromptTemplate = `你是一位资深的微信公众号内容创作者，擅长将各类内容改写为深度、专业的公众号文章风格。

## 改写要求

请将以下原文改写为微信公众号风格的内容：

**风格规范：**
- 论点递进：先提出核心观点，再分点深度展开，结尾总结升华
- 长短句结合，段落完整，每段3-5句，适合深度阅读
- 克制使用emoji（0-2个），保持专业感
- 专业但不失温度，有深度，有观点，像一篇精心写就的文章
- 正文800-1500字，内容充实饱满
- 标题有观点或悬念，引发思考，30字以内
- 3个关键词标签，行业相关
- 结尾引发共鸣或思考，邀请转发或关注，一句话

## 原文内容

{ORIGINAL_TEXT}

## 输出要求

请按以下格式严格输出，不要添加任何额外说明：

[CONTENT_TYPE]: {观点分析类|体验叙事类|教程列表类|评测对比类|其他}
[BODY]: {改写正文全文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语，一句话}

若原文为纯代码、纯数据表格或外语内容，输出：

[UNSUPPORTED_CONTENT]: 该内容暂不支持改写`

const wechatFewShot = [
  {
    original:
      '本文介绍了如何使用 React Hooks 优化组件性能，包括 useMemo、useCallback 和 React.memo 的使用场景。',
    rewritten:
      '[CONTENT_TYPE]: 教程列表类\n[BODY]:\n在前端开发的日常工作中，React 组件的性能优化是一个绕不开的话题。随着应用规模的扩大，不必要的重渲染会显著拖慢用户体验，而 React 提供的三个工具——useMemo、useCallback 和 React.memo——正是解决这一问题的核心武器。\n\n**useMemo：缓存计算结果，避免重复运算**\n\nuseMemo 的核心价值在于记忆化计算结果。当某个值的计算开销较大，且依赖的数据没有发生变化时，useMemo 会直接返回上次的计算结果，而不是重新执行计算逻辑。这在处理大型列表过滤、复杂数据转换等场景中尤为有效。\n\n**useCallback：稳定函数引用，防止子组件无谓渲染**\n\n在 React 中，每次父组件重新渲染，其内部定义的函数都会生成新的引用。当这些函数作为 props 传递给子组件时，子组件会误以为 props 发生了变化，从而触发不必要的重渲染。useCallback 通过缓存函数引用，从根本上解决了这一问题。\n\n**React.memo：组件级别的渲染优化**\n\nReact.memo 是一个高阶组件，它通过浅比较 props 来决定是否重新渲染组件。与 useMemo 和 useCallback 配合使用时，可以构建出一套完整的性能优化体系——父组件的状态变化不再会无差别地传导到所有子组件，而是只影响真正需要更新的部分。\n\n这三个工具并非银弹，过度使用反而会增加内存消耗和代码复杂度。真正的性能优化，始终应以 Profiler 数据为依据，有的放矢地进行优化，而不是在所有地方一刀切地套用。\n[TITLE_1]: 为什么你的React应用越来越慢？三个Hook告诉你答案\n[TITLE_2]: 深度解析useMemo、useCallback与React.memo的正确用法\n[TITLE_3]: 前端性能优化的边界：什么时候不该用这三个Hook\n[TAGS]: React, 前端性能, 工程化\n[HOOK]: 如果这篇文章让你对性能优化有了新的认识，欢迎转发给同样在踩坑的前端朋友。',
  },
]

// ── 知乎 ───────────────────────────────────────────────────────────────────

const zhihuStyleRules = [
  '结构：先亮明结论（TL;DR），再拆解问题，数据/案例支撑，最后回答"为什么"',
  '句式：逻辑严密，数据支撑，举例具体，像专业人士的深度解答',
  'Emoji：不使用emoji，保持严肃专业',
  '语气：理性、有据、有深度，展现专业认知，但不卖弄术语',
  '长度：正文500-1200字，重质量不重数量',
  '标题：可以是疑问句或陈述核心结论，40字以内',
  '标签：3-5个精准话题标签',
  '结尾：邀请讨论不同观点，一句话',
]

const zhihuPromptTemplate = `你是一位在知乎深耕多年的技术专家，擅长将各类内容改写为逻辑严密、有据可查的知乎回答风格。

## 改写要求

请将以下原文改写为知乎风格的内容：

**风格规范：**
- 先亮明结论（TL;DR），再拆解问题，数据/案例支撑，最后回答"为什么"
- 逻辑严密，数据支撑，举例具体，像专业人士的深度解答
- 不使用emoji，保持严肃专业
- 理性、有据、有深度，展现专业认知，但不卖弄术语
- 正文500-1200字，重质量不重数量
- 标题可以是疑问句或陈述核心结论，40字以内
- 3-5个精准话题标签
- 结尾可邀请讨论不同观点，一句话

## 原文内容

{ORIGINAL_TEXT}

## 输出要求

请按以下格式严格输出，不要添加任何额外说明：

[CONTENT_TYPE]: {观点分析类|体验叙事类|教程列表类|评测对比类|其他}
[BODY]: {改写正文全文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语，一句话}

若原文为纯代码、纯数据表格或外语内容，输出：

[UNSUPPORTED_CONTENT]: 该内容暂不支持改写`

const zhihuFewShot = [
  {
    original:
      '本文介绍了如何使用 React Hooks 优化组件性能，包括 useMemo、useCallback 和 React.memo 的使用场景。',
    rewritten:
      '[CONTENT_TYPE]: 教程列表类\n[BODY]:\nTL;DR：useMemo 缓存计算值，useCallback 缓存函数引用，React.memo 做组件级浅比较，三者组合可系统性消除 React 应用中的无效重渲染。但请注意，过度使用会适得其反。\n\n---\n\n**问题的根源**\n\nReact 的默认行为是：父组件重渲染时，所有子组件无条件重渲染。在小型应用中，这不是问题。但当组件树深度超过 3-4 层，或某个节点的渲染开销超过 16ms（60fps 的帧预算），用户就会感知到卡顿。\n\n**三个工具的边界**\n\nuseMemo 解决的问题：纯计算开销。典型场景是对 10000 条数据做过滤排序，如果每次渲染都重算，即使结果相同也是浪费。useMemo 的代价是额外的内存占用和依赖数组比较。\n\nuseCallback 解决的问题：函数引用稳定性。JavaScript 中每次执行函数体都会创建新的闭包，导致引用不等。当函数作为 props 向下传递时，不稳定的引用会让 React.memo 的浅比较失效。\n\nReact.memo 解决的问题：组件层级的渲染隔离。它对 props 做浅比较，props 未变则跳过渲染。这是上述两个 Hook 的"消费方"——没有稳定的 props，React.memo 没有意义。\n\n**什么时候不该用**\n\n如果组件本身渲染开销极低（如纯文本展示），memoization 的比较开销可能反而大于重渲染开销。React 官方的建议是：先用 Profiler 测量，再决定是否优化。\n[TITLE_1]: useMemo、useCallback 和 React.memo 分别解决什么问题？\n[TITLE_2]: React 性能优化三件套的正确使用姿势和边界条件\n[TITLE_3]: 为什么说盲目使用 useMemo 反而会降低 React 应用性能？\n[TAGS]: React, 前端性能优化, JavaScript\n[HOOK]: 如果你有不同的优化策略或实测数据，欢迎在评论区讨论。',
  },
]

// ── 主函数 ─────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 环境变量未配置，请在 .env.local 中设置 Supabase 连接字符串')
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  console.log('开始写入平台配置种子数据...')

  try {
    await prisma.$transaction(async (tx) => {
  // 小红书
  await tx.platformConfig.upsert({
    where: {
      uq_platform_configs_platform_version: {
        platform: 'xiaohongshu',
        configVersion: 1,
      },
    },
    update: {
      styleRules: xiaohongshuStyleRules,
      promptTemplate: xiaohongshuPromptTemplate,
      fewShotExamples: xiaohongshuFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
    create: {
      platform: 'xiaohongshu',
      configVersion: 1,
      styleRules: xiaohongshuStyleRules,
      promptTemplate: xiaohongshuPromptTemplate,
      fewShotExamples: xiaohongshuFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
  })
  console.log('✓ 小红书配置写入完成')

  // 微信公众号
  await tx.platformConfig.upsert({
    where: {
      uq_platform_configs_platform_version: {
        platform: 'wechat',
        configVersion: 1,
      },
    },
    update: {
      styleRules: wechatStyleRules,
      promptTemplate: wechatPromptTemplate,
      fewShotExamples: wechatFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
    create: {
      platform: 'wechat',
      configVersion: 1,
      styleRules: wechatStyleRules,
      promptTemplate: wechatPromptTemplate,
      fewShotExamples: wechatFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
  })
  console.log('✓ 微信公众号配置写入完成')

  // 知乎
  await tx.platformConfig.upsert({
    where: {
      uq_platform_configs_platform_version: {
        platform: 'zhihu',
        configVersion: 1,
      },
    },
    update: {
      styleRules: zhihuStyleRules,
      promptTemplate: zhihuPromptTemplate,
      fewShotExamples: zhihuFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
    create: {
      platform: 'zhihu',
      configVersion: 1,
      styleRules: zhihuStyleRules,
      promptTemplate: zhihuPromptTemplate,
      fewShotExamples: zhihuFewShot,
      isActive: true,
      updatedBy: 'seed',
    },
  })
  console.log('✓ 知乎配置写入完成')

    }) // end $transaction

    console.log('种子数据写入完成！共 3 条平台配置记录。')
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed 脚本执行失败：', e)
    process.exit(1)
  })
