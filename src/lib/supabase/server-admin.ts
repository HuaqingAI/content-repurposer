import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * 服务端 service_role 客户端，拥有完整数据库权限，绕过 RLS。
 * 只能在服务端 API Routes 中使用，绝不能暴露给客户端。
 * 用于：写入改写记录、创建用户记录、管理后台操作等。
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseServiceRoleKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
