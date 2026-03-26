import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server-admin'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED' } },
      { status: 401 }
    )
  }

  const adminClient = createServiceRoleClient()
  const { error: upsertError } = await adminClient.from('users').upsert(
    {
      id: user.id,
      phone: user.phone ?? null,
      display_name: user.phone ? `用户${user.phone.slice(-4)}` : '新用户',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (upsertError) {
    return Response.json(
      { data: null, error: { code: 'UPSERT_FAILED' } },
      { status: 500 }
    )
  }

  return Response.json({ data: { userId: user.id }, error: null })
}
