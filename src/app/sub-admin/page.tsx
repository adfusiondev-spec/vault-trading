'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck } from 'lucide-react'

export default function SubAdminRootRedirect() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, company_slug')
        .eq('id', session.user.id)
        .single()

      if (profile?.role === 'sub_admin') {
        const slug = profile.company_slug || 'platform'
        router.replace(`/sub-admin/${slug}`)
      } else if (profile?.role === 'super_admin') {
        router.replace('/admin')
      } else {
        router.replace('/user')
      }
    }

    init()
  }, [router])

  if (!mounted) return null

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', background: '#0b0e11', color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10, background: 'var(--gold, #FFD700)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        boxShadow: '0 4px 15px rgba(255,215,0,0.2)'
      }}>
        <ShieldCheck size={26} strokeWidth={2.5} color="#000" />
      </div>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: 11, letterSpacing: '0.2em', color: '#8a8e9b', fontWeight: 600 }}>ROUTING TO YOUR SECURE INSTANCE...</p>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
    </div>
  )
}
