'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Building2, Globe, Database, LogOut, ShieldCheck, ShieldAlert, Check, Plus, DollarSign, AlertTriangle, Key, X, Settings2, Settings, Power, Play, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
import { PasswordField } from '@/components/PasswordField'
import { createClient } from '@/lib/supabase/client'
import { FinancialDesk } from '@/components/admin/FinancialDesk'
import { useNotifications } from '@/hooks/useNotifications'
import { Bell } from 'lucide-react'
import PaymentSettingsPanel from '@/components/admin/PaymentSettingsPanel'
import { PackageSettings } from '@/components/admin/PackageSettings'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { calculateMonthlyPrice } from '@/lib/pricing'



function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      const el = document.createElement('textarea')
      el.value = address
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', width: '100%', justifyContent: 'center', background: copied ? 'rgba(34,197,94,0.15)' : 'transparent', border: `1px solid ${copied ? '#22c55e' : '#374151'}`, color: copied ? '#22c55e' : '#9ca3af', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
      {copied ? '✓ Copied!' : '⎘ Copy Address'}
    </button>
  )
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'tenants' | 'system' | 'audit' | 'financial' | 'packages' | 'payment-settings'>('tenants')
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [adminId, setAdminId] = useState<string | null>(null)

  const supabase = createClient()

  // Tenants & Modal State
  const [companies, setCompanies] = useState<any[]>([])
  const [clientCounts, setClientCounts] = useState<Record<string, number>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    id: '',
    company: '',
    slug: '',
    adminEmail: '',
    adminPassword: '',
    markets: { crypto: false, saudi: false, forex: false, energy: false },
    market_access: [] as string[],
    billingCycle: 'Monthly' as 'Monthly' | 'Annual',
    subscriptionPackage: 'trial',
    expiresAt: '',
    sales_limit: 0
  })

  const ASSET_CLASSES = ['Crypto', 'Forex', 'Commodities', 'Global Indices', 'Saudi Indices'] as const

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase.from('profiles').select('role, company_slug').eq('id', session.user.id).single()

        if (!profile || profile.role !== 'super_admin') {
          if (profile?.role === 'trader' || profile?.role === 'user') router.push('/user')
          else if (profile?.role === 'sub_admin') {
            const slug = (profile as any).company_slug || 'platform'
            router.push(`/sub-admin/${slug}`)
          }
          else router.push('/login')
          return
        }
        setIsAuthorized(true)
        setAdminId(session.user.id)
      } catch (e) {
        console.error('Auth check error:', e)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const supabase = createClient()

    const fetchTenants = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'sub_admin')
        .order('created_at', { ascending: false })
      
      if (data && !error) {
        setCompanies(data)
        const counts: Record<string, number> = {}
        await Promise.all(data.map(async (c: any) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_to', c.id)
            .eq('role', 'trader')
          counts[c.id] = count || 0
        }))
        setClientCounts(counts)
      }
    }

    fetchTenants()

    const channel = supabase.channel('realtime-tenants-sync')
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'profiles',
        filter: "role=eq.sub_admin"
      }, () => {
        fetchTenants()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = async () => {
    localStorage.removeItem('vault_user_email')
    localStorage.removeItem('vault_user_role')
    localStorage.removeItem('vault_impersonated_tenant_id')
    localStorage.removeItem('vault_tenant_markets')
    localStorage.removeItem('vault_tenant_verification')
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    window.location.href = '/login'
  }

  const handleMarketToggle = (tenantId: string, marketKey: string) => {}
  const handleVerificationToggle = (tenantId: string) => {}
  const handleToggleStatus = async (tenantId: string) => {
    const tenant = companies.find((c: any) => c.id === tenantId)
    if (!tenant) return
    const newBanned = !tenant.is_banned
    if (!confirm(`${newBanned ? 'Deactivate' : 'Activate'} this tenant? ${newBanned ? 'They will be unable to log in.' : 'They will regain access.'}`)) return
    const supabase = createClient()
    const { error } = await (supabase.from('profiles') as any).update({ is_banned: newBanned }).eq('id', tenantId)
    if (error) { alert('Failed: ' + error.message); return }
    setCompanies(prev => prev.map((c: any) => c.id === tenantId ? { ...c, is_banned: newBanned } : c))
  }

  const handleDeleteCompany = async (tenantId: string) => {
    // If not in confirmation state, switch to it
    if (confirmDeleteId !== tenantId) {
      setConfirmDeleteId(tenantId)
      // Auto-cancel after 3 seconds if not clicked again
      setTimeout(() => setConfirmDeleteId(prev => prev === tenantId ? null : prev), 3000)
      return
    }

    console.log('Attempting to delete tenant:', tenantId)
    setDeletingId(tenantId)
    setConfirmDeleteId(null)
    try {
      const response = await fetch('/api/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
      })
      
      console.log('Delete response status:', response.status)
      
      let result: any = {}
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        result = await response.json()
      } else {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        result = { error: 'Server returned non-JSON response' }
      }
      
      if (response.ok) {
        setCompanies(prev => prev.filter((t: any) => t.id !== tenantId))
      } else {
        const errorMsg = result.error || 'خطأ غير معروف'
        const details = result.details ? `\n\n(${result.details})` : ''
        alert('تعذر الحذف: ' + errorMsg + details)
      }
    } catch (err: any) {
      console.error('Delete error:', err)
      alert(err.message || 'حدث مشكلة في الاتصال بالخادم أثناء الحذف.')
    } finally {
      setDeletingId(null)
    }
  }



  const handleDeleteTenant = handleDeleteCompany

  const { notifications, unreadCount, markAsRead } = useNotifications(adminId || '', 'super_admin')
  const [showNotifications, setShowNotifications] = useState(false)

  // Mange Company & Modal Interactions
  const handleOpenAddCompany = () => {
    setEditingTenant(null)
    setFormData({
      id: crypto.randomUUID(),
      company: '',
      slug: '',
      adminEmail: '',
      adminPassword: '',
      markets: { crypto: false, saudi: false, forex: false, energy: false },
      market_access: [],
      billingCycle: 'Monthly',
      subscriptionPackage: 'trial',
      expiresAt: '',
      sales_limit: 0
    })
    setIsModalOpen(true)
  }



  const handleSaveCompany = async () => {
    if (!formData.company || !formData.adminEmail) return alert('Please fill in required fields.')
    const supabase = createClient()

    // Validate sales_limit cannot be decreased when editing
    if (editingTenant) {
      const existing = companies.find((c: any) => c.id === editingTenant)
      if (existing && formData.sales_limit < (existing.sales_limit || 0)) {
        alert('Sales limit cannot be decreased. Current limit: ' + (existing.sales_limit || 0))
        return
      }
    }

    if (editingTenant) {
      // ── UPDATE EXISTING TENANT ──
      const isTrial = formData.subscriptionPackage.toLowerCase().includes('trial')
      const isVip = formData.subscriptionPackage.toLowerCase().includes('vip')
      const pkgType = isTrial ? 'Trial' : isVip ? 'VIP' : 'Standard'
      const billingKey = formData.billingCycle === 'Annual' ? 'annual' : 'monthly'
      const mktKeys = (formData.market_access || []).map((m: string) => {
        if (m === 'Global Indices') return 'global_indices'
        if (m === 'Saudi Indices') return 'saudi_indices'
        return m.toLowerCase()
      })
      const { monthly: subPrice } = calculateMonthlyPrice(mktKeys, billingKey, pkgType as any)
      const editUpdate: any = {
        full_name: formData.company,
        company_slug: formData.slug,
        subscription_package: formData.subscriptionPackage,
        market_access: formData.market_access,
        allowed_markets: mktKeys,
        subscription_price: subPrice,
        sales_limit: formData.sales_limit,
      }
      if (formData.subscriptionPackage === 'Trial_1day') {
        const now = new Date().toISOString()
        editUpdate.trial_started_at = now
        editUpdate.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      } else {
        editUpdate.trial_started_at = null
        editUpdate.expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
      const { error } = await (supabase.from('profiles') as any).update(editUpdate).eq('id', editingTenant)

      if (error) { alert('Update failed: ' + error.message); return }

      setCompanies(prev => prev.map((c: any) =>
        c.id === editingTenant
          ? { ...c, full_name: formData.company, company_slug: formData.slug, subscription_package: formData.subscriptionPackage, market_access: formData.market_access }
          : c
      ))
      alert('Tenant updated successfully.')
    } else {
      // ── CREATE NEW TENANT ──
      const response = await fetch('/api/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.adminEmail,
          password: formData.adminPassword || 'vaultdefault123!',
          full_name: formData.company,
          company_name: formData.company,
          slug: formData.slug,
          subscriptionPackage: formData.subscriptionPackage
        })
      })
      const result = await response.json()
      if (!response.ok) { alert(result.error || 'Failed to create tenant.'); return }

      // Patch with package + markets using the real user_id from API
      if (result.user_id) {
        const isTrial2 = formData.subscriptionPackage.toLowerCase().includes('trial')
        const isVip2 = formData.subscriptionPackage.toLowerCase().includes('vip')
        const pkgType2 = isTrial2 ? 'Trial' : isVip2 ? 'VIP' : 'Standard'
        const billingKey2 = formData.billingCycle === 'Annual' ? 'annual' : 'monthly'
        const mktKeys2 = (formData.market_access || []).map((m: string) => {
          if (m === 'Global Indices') return 'global_indices'
          if (m === 'Saudi Indices') return 'saudi_indices'
          return m.toLowerCase()
        })
        const { monthly: subPrice2 } = calculateMonthlyPrice(mktKeys2, billingKey2, pkgType2 as any)
        await (supabase.from('profiles') as any).update({
          subscription_package: formData.subscriptionPackage,
          market_access: formData.market_access,
          allowed_markets: mktKeys2,
          subscription_price: subPrice2,
        }).eq('id', result.user_id)
      }

      alert('Tenant created successfully.')
    }

    setIsModalOpen(false)
  }

  const handleImpersonate = (tenantId: string, slug: string) => {
    if (confirm(`Do you want to securely enter the Sub-Admin Dashboard for this tenant?`)) {
      localStorage.setItem('vault_user_role', 'sub_admin')
      localStorage.setItem('vault_impersonated_tenant_id', tenantId)
      router.push(`/sub-admin/${slug}`)
    }
  }

  if (!mounted || loading) {
    return (
      <div style={{
        height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', background: '#0b0e11', color: '#fff'
      }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, fontSize: 11, letterSpacing: '0.2em', color: '#8a8e9b', fontWeight: 600 }}>{t.authenticating}</p>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />
      </div>
    )
  }

  if (!isAuthorized) return null

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      background: '#040608', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', overflow: 'hidden'
    }}>
      {/* ── Top Navigation Bar ── */}
      <div style={{
        height: 60, flexShrink: 0, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', background: 'rgba(4,6,8,0.95)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#FFD700',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Crown size={20} strokeWidth={2.5} color="#000" />
          </div>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.1em', margin: 0 }}>PLATFORM CRM SYSTEM</h1>
            <span style={{ color: 'var(--gold, #FFD700)', fontSize: 10, letterSpacing: '0.05em', fontWeight: 600 }}>MASTER CONTROL · SAAS ADMIN</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)', padding: '6px 12px', borderRadius: 4 }}>
            <Globe size={14} color="#FFD700" />
            <span style={{ fontSize: 12, letterSpacing: '0.05em', color: '#FFD700', fontWeight: 600 }}>HQ OVERSIGHT ACTIVATED</span>
          </div>

          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={16} color="#787b86" />
              {unreadCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef5350', color: '#fff', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>}
            </div>
            {showNotifications && (
              <div style={{ position: 'absolute', top: 30, right: -120, width: 300, background: 'rgba(4,6,8,0.95)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: '#fff' }}>System Notifications</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#8a8e9b', fontSize: 12 }}>No notifications yet.</div>
                  ) : notifications.map((n:any) => (
                    <div key={n.id} onClick={() => !n.read && markAsRead(n.id)} style={{ padding: 12, borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(255,215,0,0.05)' }}>
                      <div style={{ fontSize: 12, color: n.read ? '#c0c3ce' : '#fff', fontWeight: n.read ? 400 : 600 }}>{n.title || 'Notification'}</div>
                      <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: '#8a8e9b', marginTop: 6 }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', color: '#c0c3ce', padding: '6px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, transition: 'all 0.2s', ...({ ':hover': { color: '#fff' } } as any)
          }}>
            <LogOut size={14} /> {t.logout}
          </button>
          <LanguageToggle />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ── Sidebar CRM Navigation ── */}
        <div style={{
          width: 200, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)',
          display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px'
        }}>
          {[
            { id: 'tenants', icon: Building2, label: t.leasing_companies },
            { id: 'system', icon: Database, label: 'Global Architecture' },
            { id: 'financial', icon: DollarSign, label: 'Subscription Payments' },
            { id: 'packages', icon: Settings2, label: 'Package Settings' },
            { id: 'payment-settings', icon: Settings, label: t.payment_settings },
            { id: 'audit', icon: ShieldCheck, label: 'Security & Audit Logs' },
          ].map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: isActive ? 'rgba(255,215,0,0.1)' : 'transparent',
                  color: isActive ? '#FFD700' : '#8a8e9b',
                  fontSize: 13, fontWeight: isActive ? 600 : 500, transition: 'all 0.15s'
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                {item.label}
              </button>
            )
          })}
          <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => router.push('/admin/profile')}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 8, border: '1px solid rgba(255,215,0,0.2)', cursor: 'pointer', textAlign: 'left', width: '100%',
                background: 'transparent', color: '#FFD700',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s'
              }}
            >
              <Key size={18} strokeWidth={1.5} />
              My Profile
            </button>
          </div>
        </div>

        {/* ── Main CRM Area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#020304', overflowY: 'auto' }}>
          
          {/* Top Summary Bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, padding: 24, borderBottom: '1px solid var(--border)'
          }}>
            <SummaryCard title="Global System Volume" value="$28.5B" icon={Globe} color="#FFD700" />
            <SummaryCard title="Active Tenants" value={companies.length.toString()} icon={Building2} color="#fff" />
            <SummaryCard title="Total Connected Clients" value="-" icon={Globe} color="#c0c3ce" />
            <SummaryCard title="System Integrity" value="100%" icon={ShieldCheck} color="#26a69a" />
          </div>

          <div style={{ padding: '30px 24px', flex: 1 }}>
            
            {/* ── Tenant Management Board ── */}
            {activeTab === 'tenants' && (
              <div className="crm-section fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: 0 }}>TENANT MANAGEMENT BOARD</h2>
                  <div style={{ display: 'flex', gap: 12 }}>


                    <button 
                      onClick={handleOpenAddCompany}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none',
                        color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255,215,0,0.3)', transition: 'transform 0.2s'
                      }}
                    >
                      <Plus size={18} /> {t.add_new_tenant}
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.3)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>COMPANY NAME</th>
                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>{t.email_address}</th>
                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>{t.total_clients}</th>
                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>MARKETS</th>
                        <th style={{ padding: '14px 20px', fontWeight: 600 }}>{t.package}</th>
                        <th style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right' }}>{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map(company => {
                        return (
                        <tr key={company.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{company.full_name}</div>
                            <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>/{company.company_slug || company.id?.slice(0,8)}</div>
                          </td>
                          <td style={{ padding: '14px 20px', fontWeight: 500, color: '#c0c3ce', fontSize: 12 }}>{company.email}</td>
                          <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: 14 }}>
                            {clientCounts[company.id] ?? '—'}
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            {(company.market_access || []).length > 0 ? (
                              <span
                                title={(company.market_access || []).join(', ')}
                                style={{ color: '#FFD700', fontSize: 12, fontWeight: 600, cursor: 'help' }}
                              >
                                {(company.market_access || []).length} markets
                              </span>
                            ) : (
                              <span style={{ color: '#555', fontSize: 11 }}>None</span>
                            )}
                          </td>

                          <td style={{ padding: '14px 20px' }}>
                            {(() => {
                              const raw = (company.subscription_package || 'standard').toLowerCase()
                              const isVip = raw.includes('vip')
                              const isTrial = raw.includes('trial')
                              const label = isVip ? 'VIP' : isTrial ? 'Trial' : 'Standard'
                              return (
                                <span style={{
                                  display: 'inline-block',
                                  background: isVip ? '#22c55e' : isTrial ? '#6b7280' : '#FFD700',
                                  color: isVip || isTrial ? '#fff' : '#000',
                                  borderRadius: 4, padding: '3px 10px',
                                  fontSize: 11, fontWeight: 700, letterSpacing: '0.3px'
                                }}>
                                  {label}
                                </span>
                              )
                            })()}
                          </td>

                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => {
                                setEditingTenant(company.id)
                                setFormData({
                                  id: company.id,
                                  company: company.full_name || '',
                                  slug: company.company_slug || '',
                                  adminEmail: company.email || '',
                                  adminPassword: '',
                                  markets: { crypto: false, saudi: false, forex: false, energy: false },
                                  market_access: company.market_access || [],
                                  billingCycle: 'Monthly',
                                  subscriptionPackage: company.subscription_package || 'trial',
                                  expiresAt: '',
                                  sales_limit: company.sales_limit || 0
                                })
                                setIsModalOpen(true)
                              }} style={{ 
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, height: 32,
                                background: 'transparent',
                                border: '1px solid rgba(255,215,0,0.5)',
                                color: '#FFD700', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                              }}>
                                <Settings2 size={13} /> MANAGE
                              </button>
                              <button onClick={() => handleToggleStatus(company.id)} title={company.is_banned ? 'Activate Tenant' : 'Deactivate Tenant'} style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, height: 32,
                                background: company.is_banned ? 'rgba(38,166,154,0.1)' : 'transparent',
                                border: `1px solid ${company.is_banned ? '#26a69a' : 'rgba(239,83,80,0.3)'}`,
                                color: company.is_banned ? '#26a69a' : '#ef5350', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                              }}>
                                <Power size={13} />
                              </button>
                              <button 
                                onClick={() => {
                                  if (deletingId === company.id) return
                                  if (confirmDeleteId === company.id) {
                                    handleDeleteTenant(company.id)
                                  } else {
                                    setConfirmDeleteId(company.id)
                                    setTimeout(() => setConfirmDeleteId(null), 3000)
                                  }
                                }}
                                disabled={deletingId === company.id}
                                style={{ 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 32, height: 32, borderRadius: 6,
                                  background: confirmDeleteId === company.id ? '#ef5350' : 'rgba(239,83,80,0.1)',
                                  border: confirmDeleteId === company.id ? 'none' : '1px solid rgba(239,83,80,0.3)',
                                  color: confirmDeleteId === company.id ? '#000' : '#ef5350', 
                                  fontSize: 11, fontWeight: 800, 
                                  cursor: deletingId === company.id ? 'not-allowed' : 'pointer', 
                                  transition: 'all 0.2s',
                                  opacity: deletingId === company.id ? 0.5 : 1
                                }}
                              >
                                {deletingId === company.id ? (
                                  <div style={{width: 14, height: 14, borderRadius: '50%', border: '2px solid #ef5350', borderTopColor: 'transparent', animation: 'spin 1s linear infinite'}} />
                                ) : confirmDeleteId === company.id ? (
                                  'SURE?'
                                ) : (
                                  <Trash2 size={13} />
                                )} 
                              </button>
                            </div>
                          </td>

                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'financial' && (
              <div style={{ overflowY: 'auto', height: '100%', padding: '24px' }}>
                <FinancialDesk />
              </div>
            )}

            {activeTab === 'packages' && <PackageSettings />}

            {activeTab === 'payment-settings' && (
              <div className="crm-section fade-in" style={{ overflowY: 'auto', height: '100%' }}>
                <PaymentSettingsPanel />
              </div>
            )}
            
            {activeTab !== 'tenants' && activeTab !== 'financial' && activeTab !== 'packages' && activeTab !== 'payment-settings' && (
              <div className="crm-section fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                <Key size={48} color="#FFD700" style={{ marginBottom: 20 }} />
                <h3 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>Authorized Personnel Only</h3>
                <p style={{ color: '#8a8e9b' }}>This module restricts internal SAAS core properties.</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal for Manage / Add Company ── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '20px' }}>
          <div className="fade-in" style={{ background: '#0a0c10', border: '1px solid #FFD700', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 10px 40px rgba(255,215,0,0.1)', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, color: '#FFD700', fontWeight: 700, margin: 0 }}>{editingTenant ? 'MANAGE TENANT' : 'ADD NEW COMPANY'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#c0c3ce', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>COMPANY NAME</label>
                  <input value={formData.company} onChange={e => {
                    const name = e.target.value
                    const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
                    setFormData({...formData, company: name, slug})
                  }} placeholder="e.g. Nexus Corp" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>COMPANY SLUG (URL)</label>
                  <input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} placeholder="e.g. nexus-corp" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFD700', padding: '10px 14px', borderRadius: 6, outline: 'none' }} />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>ADMIN EMAIL</label>
                  <input type="email" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} placeholder="admin@domain.com" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none' }} />
                </div>
                <div>
                  {editingTenant && (
                    <PasswordField userId={editingTenant} label="Current Password" containerStyle={{ marginBottom: 12 }} />
                  )}
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                    {editingTenant ? 'NEW PASSWORD (leave blank to keep current)' : 'PASSWORD'}
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input type={showPassword ? "text" : "password"} value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} placeholder={editingTenant ? 'Enter new password to change…' : '••••••••'} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', paddingRight: 60 }} />
                    <div style={{ position: 'absolute', right: 8, display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer', padding: 4 }}>
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(formData.adminPassword || ''); alert('Password copied!') }} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer', padding: 4 }}>
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                  {editingTenant && (
                    <div style={{ color: '#555', fontSize: 10, marginTop: 5 }}>
                      Leave blank to keep the existing password unchanged.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#FFD700', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>MARKET ACCESS CONTROL</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '12px 14px', borderRadius: 6, border: '1px solid rgba(255,215,0,0.15)' }}>
                  {ASSET_CLASSES.map(asset => {
                    const isChecked = (formData.market_access || []).includes(asset)
                    return (
                      <label key={asset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: isChecked ? '#FFD700' : '#c0c3ce', cursor: 'pointer', fontWeight: isChecked ? 600 : 400 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const current = formData.market_access || []
                            setFormData({
                              ...formData,
                              market_access: e.target.checked
                                ? [...current, asset]
                                : current.filter((a: string) => a !== asset)
                            })
                          }}
                          style={{ accentColor: '#FFD700', width: 15, height: 15, cursor: 'pointer' }}
                        />
                        {asset}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>BILLING CYCLE</label>
                  <select value={formData.billingCycle} onChange={e => setFormData({...formData, billingCycle: e.target.value as any})} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}>
                    <option value="Monthly" style={{ color: '#000' }}>Monthly</option>
                    <option value="Annual" style={{ color: '#000' }}>Annual (−20%)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>SUBSCRIPTION PACKAGE</label>
                  <select
                    value={formData.subscriptionPackage}
                    onChange={(e) => setFormData({...formData, subscriptionPackage: e.target.value})}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Trial_1day" style={{ color: '#000' }}>Trial — 1 Day</option>
                    <option value="Standard" style={{ color: '#000' }}>Standard — Monthly</option>
                    <option value="VIP" style={{ color: '#000' }}>VIP — Monthly</option>
                    <option value="annual_standard" style={{ color: '#000' }}>Standard — Annual</option>
                    <option value="annual_vip" style={{ color: '#000' }}>VIP — Annual</option>
                  </select>
                </div>
              </div>

              {/* ── Live Pricing Display ── */}
              {(() => {
                const isTrial = formData.subscriptionPackage.toLowerCase().includes('trial')
                const isVip = formData.subscriptionPackage.toLowerCase().includes('vip')
                const pkgType = isTrial ? 'Trial' : isVip ? 'VIP' : 'Standard'
                const billingKey = formData.billingCycle === 'Annual' ? 'annual' : 'monthly'
                const mktKeys = (formData.market_access || []).map((m: string) => {
                  if (m === 'Global Indices') return 'global_indices'
                  if (m === 'Saudi Indices') return 'saudi_indices'
                  return m.toLowerCase()
                })
                const pricing = calculateMonthlyPrice(mktKeys, billingKey, pkgType as any)
                return (
                  <div style={{
                    padding: '14px 18px', background: 'rgba(255,215,0,0.04)',
                    borderRadius: 8, border: '1px solid rgba(255,215,0,0.3)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ color: '#8a8e9b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>ESTIMATED COST</span>
                    <span style={{ color: '#FFD700', fontSize: 20, fontWeight: 800 }}>
                      {pricing.monthly === 0 ? 'FREE TRIAL' : pricing.label}
                    </span>
                  </div>
                )
              })()}

              <div style={{ marginTop: 12 }}>
                <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 6 }}>
                  SALES USERS LIMIT
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={formData.sales_limit}
                  onChange={e => setFormData({ ...formData, sales_limit: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 6, padding: '10px 14px', fontSize: 14, outline: 'none' }}
                  placeholder="0 = no sales users allowed"
                />
                <p style={{ color: '#4b5563', fontSize: 11, margin: '4px 0 0' }}>
                  Number of Sales accounts this tenant can create. Cannot be decreased once set.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {editingTenant ? (
                <button onClick={() => handleImpersonate(formData.id, formData.slug)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'rgba(38,166,154,0.1)', border: '1px solid #26a69a', color: '#26a69a', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <Play size={14} /> ENTER SUB-ADMIN DASHBOARD
                </button>
              ) : <div/>}

              <button onClick={handleSaveCompany} style={{ padding: '10px 24px', background: '#FFD700', border: 'none', color: '#000', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                {editingTenant ? t.save_changes : t.add_new_tenant}
              </button>
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --border: rgba(255, 255, 255, 0.08);
        }
        .fade-in {
          animation: fadein 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
      `}} />
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.1)', borderRadius: 12, padding: 24,
      display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}40` }}>
        <Icon size={26} color={color} />
      </div>
      <div>
        <div style={{ color: '#8a8e9b', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{title.toUpperCase()}</div>
        <div style={{ color: color === '#FFD700' ? '#FFD700' : '#fff', fontSize: 28, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '-0.5px' }}>{value}</div>
      </div>
    </div>
  )
}

function MarketToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100,
      border: `1px solid ${active ? '#FFD700' : 'rgba(255,255,255,0.1)'}`,
      background: active ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
      color: active ? '#FFD700' : '#8a8e9b', fontSize: 11, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.2s'
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#FFD700' : 'rgba(255,255,255,0.2)' }} />
      {label}
    </button>
  )
}
