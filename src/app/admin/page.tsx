'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Building2, Globe, Database, LogOut, ShieldCheck, ShieldAlert, Check, Plus, DollarSign, AlertTriangle, Key, X, Settings2, Power, Play, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { FinancialDesk } from '@/components/admin/FinancialDesk'

// Extended Tenant Data Structure
export type Tenant = {
  id: string
  company: string
  slug?: string
  adminEmail: string
  adminPassword?: string
  clients: number
  status: 'Active' | 'Suspended'
  isVerified: boolean
  markets: {
    crypto: boolean
    saudi: boolean
    forex: boolean
    energy: boolean
  }
  billingCycle: 'Monthly' | 'Annual'
  subscriptionPackage: string
  expiresAt: string
}

const INITIAL_TENANTS: Tenant[] = [
  { id: 'T-001', company: 'Apex Trading Corp', adminEmail: 'apex_admin@thevault.io', clients: 1248, status: 'Active', isVerified: true, markets: { crypto: true, saudi: true, forex: true, energy: false }, billingCycle: 'Annual', subscriptionPackage: 'annual_vip', expiresAt: new Date(Date.now() + 86400000 * 365).toISOString() },
  { id: 'T-002', company: 'Global Hedge Ltd', adminEmail: 'global_sub@thevault.io', clients: 85, status: 'Active', isVerified: true, markets: { crypto: true, saudi: false, forex: true, energy: true }, billingCycle: 'Monthly', subscriptionPackage: 'monthly_standard', expiresAt: new Date(Date.now() + 86400000 * 30).toISOString() },
  { id: 'T-003', company: 'Desert Alpha', adminEmail: 'desert_alpha@thevault.io', clients: 412, status: 'Suspended', isVerified: false, markets: { crypto: false, saudi: true, forex: false, energy: true }, billingCycle: 'Annual', subscriptionPackage: 'trial', expiresAt: new Date(Date.now() - 86400000).toISOString() }
]

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'tenants' | 'system' | 'audit' | 'financial'>('tenants')
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Tenants & Modal State
  const [tenants, setTenants] = useState<Tenant[]>([])
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
    billingCycle: 'Monthly' as 'Monthly' | 'Annual',
    subscriptionPackage: 'trial',
    expiresAt: ''
  })

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

        // Master Override
        if (session.user.email === 'admin@thevault.io') {
          setIsAuthorized(true)
          setLoading(false)
          return
        }

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
      } catch (e) {
        console.error('Auth check error:', e)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()

    // Load tenants and handle expiration logic
    const stored = localStorage.getItem('vault_tenants')
    let parsed: Tenant[] = INITIAL_TENANTS
    
    if (stored) {
      try { parsed = JSON.parse(stored) } catch (e) { console.error('Failed to parse stored tenants') }
    }
    
    const now = new Date()
    const updated = parsed.map(t => {
      // Ensure each tenant has a unique ID if it was part of a duplicate collision
      if (t.id.startsWith('T-') && parsed.filter(p => p.id === t.id).length > 1) {
        t.id = t.id + '-' + Math.random().toString(36).substring(2, 7)
      }

      if (t.status === 'Active' && new Date(t.expiresAt) < now) {
        return { ...t, status: 'Suspended' as const }
      }
      return t
    })
    setTenants(updated)
  }, [router])

  // Persist whenever tenants state changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('vault_tenants', JSON.stringify(tenants))
    }
  }, [tenants, mounted])

  const handleLogout = () => {
    localStorage.removeItem('vault_user_email')
    localStorage.removeItem('vault_user_role')
    localStorage.removeItem('vault_impersonated_tenant_id')
    localStorage.removeItem('vault_tenant_markets')
    localStorage.removeItem('vault_tenant_verification')
    
    // Fire and forget
    const supabase = createClient()
    supabase.auth.signOut().catch(() => {})
    
    window.location.href = '/login'
  }

  const handleMarketToggle = (tenantId: string, marketKey: keyof Tenant['markets']) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const newMarkets = { ...t.markets, [marketKey]: !t.markets[marketKey] }
        if (tenantId === 'T-001') localStorage.setItem('vault_tenant_markets', JSON.stringify(newMarkets))
        return { ...t, markets: newMarkets }
      }
      return t
    }))
  }

  const handleVerificationToggle = (tenantId: string) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) return { ...t, isVerified: !t.isVerified }
      return t
    }))
  }

  const handleToggleStatus = (tenantId: string) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const newStatus = t.status === 'Active' ? 'Suspended' : 'Active'
        // If reactivating manually, grant +30 days if expired
        let newExpires = t.expiresAt
        if (newStatus === 'Active' && new Date(t.expiresAt) < new Date()) {
          newExpires = new Date(Date.now() + 86400000 * 30).toISOString()
        }
        return { ...t, status: newStatus, expiresAt: newExpires }
      }
      return t
    }))
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
        setTenants(prev => prev.filter(t => t.id !== tenantId))
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

  const handleResetLocalData = () => {
    if (confirm('تنبيه: سيتم مسح جميع البيانات المحلية فقط. هل أنت متأكد؟')) {
      localStorage.removeItem('vault_tenants')
      window.location.reload()
    }
  }

  // Mange Company & Modal Interactions
  const handleOpenAddCompany = () => {
    setEditingTenant(null)
    setFormData({
      id: crypto.randomUUID(), // Guarantee uniqueness
      company: '',
      slug: '',
      adminEmail: '',
      adminPassword: '',
      markets: { crypto: false, saudi: false, forex: false, energy: false },
      billingCycle: 'Monthly',
      subscriptionPackage: 'trial',
      expiresAt: ''
    })
    setIsModalOpen(true)
  }

  const handleManageCompany = (t: Tenant) => {
    setEditingTenant(t.id)
    setFormData({
      id: t.id,
      company: t.company,
      slug: t.slug || '',
      adminEmail: t.adminEmail,
      adminPassword: t.adminPassword || '',
      markets: { ...t.markets },
      billingCycle: t.billingCycle,
      subscriptionPackage: t.subscriptionPackage || 'trial',
      expiresAt: t.expiresAt
    })
    setIsModalOpen(true)
  }

  const handleSaveCompany = async () => {
    if (!formData.company || !formData.adminEmail) return alert('Please fill in required fields.')
    
    // Calculate expiration
    let computeExpires = formData.expiresAt
    if (!editingTenant || (editingTenant && new Date(formData.expiresAt) < new Date())) {
       const days = formData.trialMode ? formData.trialDays : (formData.billingCycle === 'Annual' ? 365 : 30)
       computeExpires = new Date(Date.now() + 86400000 * days).toISOString()
    }

    if (editingTenant) {
      setTenants(prev => prev.map(t => t.id === editingTenant ? {
        ...t,
        company: formData.company,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        markets: formData.markets,
        billingCycle: formData.billingCycle,
        subscriptionPackage: formData.subscriptionPackage,
        expiresAt: computeExpires,
        status: new Date(computeExpires) > new Date() ? 'Active' : 'Suspended'
      } : t))
    } else {
      const response = await fetch('/api/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.adminEmail,
          password: formData.adminPassword || 'vaultdefault123!',
          full_name: 'Admin - ' + formData.company,
          company_name: formData.company,
          slug: formData.slug
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        alert(result.error || 'Failed to create tenant.')
        return
      }

      const newTenant: Tenant = {
        id: result.user_id || formData.id,
        company: formData.company,
        slug: formData.slug,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        clients: 0,
        status: 'Active',
        isVerified: true,
        markets: formData.markets,
        billingCycle: formData.billingCycle,
        subscriptionPackage: formData.subscriptionPackage,
        expiresAt: computeExpires
      }
      setTenants([newTenant, ...tenants])
    }

    const adminClient = createClient()
    await adminClient.from('profiles')
      .update({ subscription_package: formData.subscriptionPackage })
      .eq('id', editingTenant || formData.id)

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
        <p style={{ marginTop: 16, fontSize: 11, letterSpacing: '0.2em', color: '#8a8e9b', fontWeight: 600 }}>AUTHENTICATING...</p>
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
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', color: '#c0c3ce', padding: '6px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, transition: 'all 0.2s', ...({ ':hover': { color: '#fff' } } as any)
          }}>
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ── Sidebar CRM Navigation ── */}
        <div style={{
          width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)',
          display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px'
        }}>
          {[
            { id: 'tenants', icon: Building2, label: 'Leasing Companies' },
            { id: 'system', icon: Database, label: 'Global Architecture' },
            { id: 'financial', icon: DollarSign, label: 'Financial Desk' },
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
        </div>

        {/* ── Main CRM Area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#020304', overflowY: 'auto' }}>
          
          {/* Top Summary Bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, padding: 24, borderBottom: '1px solid var(--border)'
          }}>
            <SummaryCard title="Global System Volume" value="$28.5B" icon={Globe} color="#FFD700" />
            <SummaryCard title="Active Tenants" value={tenants.length.toString()} icon={Building2} color="#fff" />
            <SummaryCard title="Total Connected Clients" value={tenants.reduce((sum, t) => sum + t.clients, 0).toLocaleString()} icon={Globe} color="#c0c3ce" />
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
                      onClick={handleResetLocalData}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8,
                        background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)',
                        color: '#ef5350', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      <Database size={16} /> RESET LOCAL DATA
                    </button>

                    <button 
                      onClick={handleOpenAddCompany}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)', border: 'none',
                        color: '#000', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255,215,0,0.3)', transition: 'transform 0.2s'
                      }}
                    >
                      <Plus size={18} /> ADD NEW COMPANY
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.3)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>COMPANY NAME</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>SUB-ADMIN EMAIL</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>CLIENTS</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>STATUS</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>KYC VERIFICATION</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>ACCESS CONTROL & MARKETS</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600 }}>BILLING CYCLE</th>
                        <th style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map(tenant => (
                        <tr key={tenant.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{tenant.company}</div>
                            <div style={{ color: '#8a8e9b', fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>ID: {tenant.id}</div>
                          </td>
                          <td style={{ padding: '16px 20px', fontWeight: 500, color: '#c0c3ce' }}>{tenant.adminEmail}</td>
                          <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 15 }}>{tenant.clients.toLocaleString()}</td>
                          
                          <td style={{ padding: '16px 20px' }}>
                            <span style={{ 
                              display: 'inline-flex', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: tenant.status === 'Active' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
                              color: tenant.status === 'Active' ? '#26a69a' : '#ef5350', border: `1px solid ${tenant.status === 'Active' ? '#26a69a' : '#ef5350'}`
                            }}>
                              {tenant.status.toUpperCase()}
                            </span>
                          </td>

                          <td style={{ padding: '16px 20px' }}>
                            <button 
                              onClick={() => handleVerificationToggle(tenant.id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6,
                                background: tenant.isVerified ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)',
                                border: `1px solid ${tenant.isVerified ? '#26a69a' : '#ef5350'}`,
                                color: tenant.isVerified ? '#26a69a' : '#ef5350',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              {tenant.isVerified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                              {tenant.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                            </button>
                          </td>
                          
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <MarketToggle label="Crypto" active={tenant.markets.crypto} onToggle={() => handleMarketToggle(tenant.id, 'crypto')} />
                              <MarketToggle label="Saudi Stocks" active={tenant.markets.saudi} onToggle={() => handleMarketToggle(tenant.id, 'saudi')} />
                              <MarketToggle label="Forex" active={tenant.markets.forex} onToggle={() => handleMarketToggle(tenant.id, 'forex')} />
                              <MarketToggle label="Energy" active={tenant.markets.energy} onToggle={() => handleMarketToggle(tenant.id, 'energy')} />
                            </div>
                          </td>
                          <td style={{ 
                            padding: '16px 20px', 
                            fontWeight: 700, 
                            color: tenant.billingCycle === 'Annual' ? '#FFD700' : '#8a8e9b',
                            textShadow: tenant.billingCycle === 'Annual' ? '0 0 8px rgba(255,215,0,0.5)' : 'none'
                          }}>
                            {tenant.billingCycle}
                          </td>

                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => handleToggleStatus(tenant.id)} style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, height: 32,
                                border: `1px solid ${tenant.status === 'Active' ? 'rgba(239,83,80,0.5)' : 'rgba(38,166,154,0.5)'}`, 
                                background: tenant.status === 'Active' ? 'rgba(239,83,80,0.1)' : 'rgba(38,166,154,0.1)',
                                color: tenant.status === 'Active' ? '#ef5350' : '#26a69a',
                                fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}>
                                <Power size={13} /> {tenant.status === 'Active' ? 'SUSPEND' : 'ACTIVATE'}
                              </button>
                              <button onClick={() => handleManageCompany(tenant)} style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, height: 32,
                                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)',
                                color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer'
                              }}>
                                <Settings2 size={13} /> MANAGE
                              </button>
                              <button 
                                disabled={deletingId === tenant.id} 
                                onClick={() => handleDeleteCompany(tenant.id)} 
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, height: 32,
                                  border: `1px solid ${confirmDeleteId === tenant.id ? '#ff9800' : 'rgba(239,83,80,0.2)'}`,
                                  background: confirmDeleteId === tenant.id ? '#ff9800' : 'rgba(239,83,80,0.05)',
                                  color: confirmDeleteId === tenant.id ? '#000' : '#ef5350', 
                                  fontSize: 11, fontWeight: 800, 
                                  cursor: deletingId === tenant.id ? 'not-allowed' : 'pointer', 
                                  transition: 'all 0.2s',
                                  opacity: deletingId === tenant.id ? 0.5 : 1
                                }}
                              >
                                {deletingId === tenant.id ? (
                                  <div style={{width: 14, height: 14, borderRadius: '50%', border: '2px solid #ef5350', borderTopColor: 'transparent', animation: 'spin 1s linear infinite'}} />
                                ) : confirmDeleteId === tenant.id ? (
                                  'SURE?'
                                ) : (
                                  <Trash2 size={13} />
                                )} 
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'financial' && <FinancialDesk />}
            
            {activeTab !== 'tenants' && activeTab !== 'financial' && (
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="fade-in" style={{ background: '#0a0c10', border: '1px solid #FFD700', borderRadius: 12, width: 500, maxWidth: '90%', padding: 24, boxShadow: '0 10px 40px rgba(255,215,0,0.1)' }}>
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
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>PASSWORD (Optional)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input type={showPassword ? "text" : "password"} value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} placeholder="••••••••" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', paddingRight: 60 }} />
                    <div style={{ position: 'absolute', right: 8, display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer', padding: 4 }}>
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(formData.adminPassword || ''); alert('Password copied!') }} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer', padding: 4 }}>
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>MARKET ACCESS</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                  {['crypto', 'saudi', 'forex', 'energy'].map(m => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: formData.markets[m as keyof typeof formData.markets] ? '#FFD700' : '#c0c3ce', cursor: 'pointer', fontWeight: 500 }}>
                      <input type="checkbox" checked={formData.markets[m as keyof typeof formData.markets]} onChange={e => setFormData({...formData, markets: {...formData.markets, [m]: e.target.checked}})} style={{ cursor: 'pointer' }} />
                      <span style={{ textTransform: 'capitalize' }}>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>BILLING CYCLE</label>
                  <select value={formData.billingCycle} onChange={e => setFormData({...formData, billingCycle: e.target.value as any})} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}>
                    <option value="Monthly" style={{ color: '#000' }}>Monthly</option>
                    <option value="Annual" style={{ color: '#000' }}>Annual</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>SUBSCRIPTION PACKAGE</label>
                  <select 
                    value={formData.subscriptionPackage}
                    onChange={(e) => setFormData({...formData, subscriptionPackage: e.target.value})}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="trial" style={{ color: '#000' }}>TRIAL (14 days)</option>
                    <option value="monthly_standard" style={{ color: '#000' }}>Monthly Standard</option>
                    <option value="annual_standard" style={{ color: '#000' }}>Annual Standard</option>
                    <option value="monthly_vip" style={{ color: '#000' }}>Monthly VIP</option>
                    <option value="annual_vip" style={{ color: '#000' }}>Annual VIP</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {editingTenant ? (
                <button onClick={() => handleImpersonate(formData.id, formData.slug)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'rgba(38,166,154,0.1)', border: '1px solid #26a69a', color: '#26a69a', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <Play size={14} /> ENTER SUB-ADMIN DASHBOARD
                </button>
              ) : <div/>}

              <button onClick={handleSaveCompany} style={{ padding: '10px 24px', background: '#FFD700', border: 'none', color: '#000', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                {editingTenant ? 'SAVE CHANGES' : 'CREATE COMPANY'}
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
