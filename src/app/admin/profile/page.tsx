'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AdminProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({ full_name: '', phone_number: '', country: '' })
  const [passwordData, setPasswordData] = useState({ new_password: '', confirm_password: '' })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      ;(supabase as any).from('profiles').select('*').eq('id', user.id).single().then(({ data }: any) => {
        if (data) {
          setProfile(data)
          setFormData({ full_name: data.full_name || '', phone_number: data.phone_number || '', country: data.country || '' })
        }
        setLoading(false)
      })
    })
  }, [router])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error: err } = await (supabase as any).from('profiles').update(formData).eq('id', user.id)
    if (err) setError(err.message)
    else { setSuccess('Profile updated successfully!'); setTimeout(() => setSuccess(''), 3000) }
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.new_password !== passwordData.confirm_password) { setError('Passwords do not match'); return }
    if (passwordData.new_password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true); setError(''); setSuccess('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password: passwordData.new_password })
    if (err) setError(err.message)
    else { setSuccess('Password changed successfully!'); setPasswordData({ new_password: '', confirm_password: '' }); setTimeout(() => setSuccess(''), 3000) }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none',
  }
  const disabledStyle: React.CSSProperties = { ...inputStyle, background: 'rgba(255,255,255,0.02)', color: '#555', cursor: 'not-allowed' }
  const labelStyle: React.CSSProperties = { display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.15)',
    borderRadius: 12, padding: 24, marginBottom: 20,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0b0e11', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', height: '100vh', background: '#0b0e11', color: '#fff', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 32 }}>
        <button onClick={() => router.push('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0 }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} color="#000" />
          </div>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 20, letterSpacing: '0.1em', margin: 0 }}>MASTER ADMIN PROFILE</h1>
            <p style={{ color: '#8a8e9b', fontSize: 12, margin: 0 }}>{profile?.email}</p>
          </div>
        </div>

        {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{success}</div>}
        {error && <div style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', color: '#EF5350', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>}

        {/* Profile Info */}
        <div style={cardStyle}>
          <h2 style={{ color: '#FFD700', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>PROFILE INFORMATION</h2>
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>FULL NAME</label>
              <input style={inputStyle} value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
            </div>
            <div>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <input style={disabledStyle} value={profile?.email || ''} disabled />
              <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Email cannot be changed for security reasons</div>
            </div>
            <div>
              <label style={labelStyle}>PHONE NUMBER</label>
              <input style={inputStyle} type="tel" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>COUNTRY</label>
              <input style={inputStyle} value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>MEMBER SINCE</label>
              <input style={disabledStyle} value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'} disabled />
            </div>
            <button type="submit" disabled={saving} style={{ background: saving ? '#555' : '#FFD700', color: '#000', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
              {saving ? 'SAVING…' : 'SAVE CHANGES'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div style={cardStyle}>
          <h2 style={{ color: '#FFD700', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>CHANGE PASSWORD</h2>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>NEW PASSWORD</label>
              <input style={inputStyle} type="password" required value={passwordData.new_password} onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>CONFIRM NEW PASSWORD</label>
              <input style={inputStyle} type="password" required value={passwordData.confirm_password} onChange={e => setPasswordData({ ...passwordData, confirm_password: e.target.value })} />
            </div>
            <button type="submit" disabled={saving} style={{ background: saving ? '#555' : '#FFD700', color: '#000', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
              {saving ? 'UPDATING…' : 'UPDATE PASSWORD'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
