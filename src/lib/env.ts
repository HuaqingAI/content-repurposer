import 'server-only'
import { z } from 'zod'

const envSchema = z.object({
  // Supabase（公开）
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Supabase（服务端）
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // 数据库（服务端）
  DATABASE_URL: z.string().url(),
  // LLM API Keys（服务端）
  DEEPSEEK_API_KEY: z.string().min(1),
  QWEN_API_KEY: z.string().min(1),
  // 微信 OAuth（服务端）
  WECHAT_APP_ID: z.string().min(1),
  WECHAT_APP_SECRET: z.string().min(1),
  // 应用配置（公开）
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ 环境变量校验失败:', parsed.error.flatten().fieldErrors)
  throw new Error('环境变量缺失或格式错误，请检查 .env.local 文件')
}

export const env = parsed.data
