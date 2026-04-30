'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Users, Target, LogOut, ShieldCheck, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

const LEAD_STATUSES = [
  'New Prospect', 'Active', 'Hot Lead', 'Cold',
  'Prospect', 'Inactive', 'Contacted',
  'In Negotiation', 'Active / Funded',
]

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'New Prospect':    { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'Hot Lead':        { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  'Active':          { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  'Cold':            { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
  'Prospect':        { bg: 'rgba(168,85,247,0.15)',  color: '#a855f7' },
  'Inactive':        { bg: 'rgba(75,85,99,0.15)',    color: '#4b5563' },
  'Contacted':       { bg: 'rgba(234,179,8,0.15)',   color: '#eab308' },
  'In Negotiation':  { bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
  'Active / Funded': { bg: 'rgba(255,215,0,0.15)',   color: '#FFD700' },
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', color: '#6b7280',
  fontWeight: 600, fontSize: 11, letterSpacing: '0.5px', whiteSpace: 'nowrap',
  borderBottom: '1px solid #1a1a1a',
}
const tdStyle: React.CSSProperties = {
  padding: '12px 14px', fontSize: 13, borderBottom: '1px solid #111',
}

export default function SalesDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { slug } = React.use(params)
  const { t } = useTranslation()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salesUser, setSalesUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'monitor' | 'clients' | 'leads' | 'profile'>('monitor')

  const [trades, setTrades] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  // Convert lead to trader
  const [convertLead, setConvertLead] = useState<any>(null)
  const [convertPassword, setConvertPassword] = useState('')
  const [converting, setConverting] = useState(false)

  // Profile tab state
  const [profileForm, setProfileForm] = useState({ full_name: '', phone_number: '', country: '' })
  const [passwordForm, setPasswordForm] = useState({ new_password: '', confirm_password: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // Auth check
  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, assigned_to')
        .eq('id', session.user.id)
        .single()

      if ((profile as any)?.role !== 'sales') {
        router.push('/login')
        return
      }

      setSalesUser({ ...(profile as any), email: session.user.email })
      setProfileForm({
        full_name: (profile as any).full_name || '',
        phone_number: (profile as any).phone_number || '',
        country: (profile as any).country || '',
      })
      setLoading(false)
    }
    check()
  }, [router])

  const loadTab = useCallback(async (tab: typeof activeTab) => {
    if (!salesUser) return
    if (tab === 'profile') return
    const supabase = createClient()
    setTabLoading(true)

    try {
      if (tab === 'monitor') {
        const { data: assignedTraders } = await supabase
          .from('profiles')
          .select('id')
          .eq('assigned_sales_id', salesUser.id)
          .eq('role', 'trader')

        const traderIds = (assignedTraders || []).map((tr: any) => tr.id)
        if (traderIds.length === 0) { setTrades([]); return }

        const { data: tradeData } = await supabase
          .from('trades')
          .select('*, profiles:user_id(full_name, email)')
          .in('user_id', traderIds)
          .order('created_at', { ascending: false })
          .limit(100)
        setTrades(tradeData || [])

      } else if (tab === 'clients') {
        const { data: clientData } = await supabase
          .from('profiles')
          .select('*, wallets(balance, currency), is_active, lead_status')
          .eq('assigned_sales_id', salesUser.id)
          .eq('role', 'trader')
          .order('created_at', { ascending: false })
        setClients(clientData || [])

      } else if (tab === 'leads') {
        const res = await fetch('/api/leads')
        const json = await res.json()
        const rawLeads = json.leads || []
        const convertedIds = rawLeads
          .filter((l: any) => l.converted_to_trader_id)
          .map((l: any) => l.converted_to_trader_id)
        let traderActiveMap: Record<string, boolean> = {}
        if (convertedIds.length > 0) {
          const { data: traderProfiles } = await supabase
            .from('profiles')
            .select('id, is_active')
            .in('id', convertedIds)
          ;(traderProfiles || []).forEach((p: any) => { traderActiveMap[p.id] = p.is_active })
        }
        setLeads(rawLeads.map((l: any) => ({
          ...l,
          trader_active: l.converted_to_trader_id ? (traderActiveMap[l.converted_to_trader_id] ?? false) : null,
        })))
      }
    } finally {
      setTabLoading(false)
    }
  }, [salesUser])

  useEffect(() => {
    if (salesUser) loadTab(activeTab)
  }, [salesUser, activeTab, loadTab])

  // Realtime subscription — keep Trade Monitor live
  useEffect(() => {
    if (!salesUser) return
    const supabase = createClient()

    let channel: ReturnType<typeof supabase.channel> | null = null

    const subscribe = async () => {
      const { data: assignedTraders } = await supabase
        .from('profiles')
        .select('id')
        .eq('assigned_sales_id', salesUser.id)
        .eq('role', 'trader')

      const traderIds = (assignedTraders || []).map((tr: any) => tr.id)
      if (traderIds.length === 0) return

      channel = supabase
        .channel('sales-trades-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trades' },
          () => { loadTab('monitor') }
        )
        .subscribe()
    }

    subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [salesUser, loadTab])

  const handleStatusChange = async (leadId: string, newStatus: string, selectEl: HTMLSelectElement) => {
    if (newStatus === 'Active / Funded') {
      if (!confirm('Mark this lead as Active / Funded?')) return
    }
    selectEl.blur()
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, status: newStatus }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLeads((prev: any[]) => prev.map((l: any) =>
          l.id === leadId
            ? { ...l, status: newStatus, updated_at: data.lead?.updated_at || l.updated_at }
            : l
        ))
      } else {
        alert(`Failed to save: ${data.error || 'Unknown error'}`)
      }
    } catch (err: any) {
      alert('Network error. Please try again.')
    }
  }

  const handleConvert = async () => {
    if (!convertLead || !convertPassword) return
    setConverting(true)
    try {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: convertLead.id, password: convertPassword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Conversion failed')
      setLeads(prev => prev.map(l => l.id === convertLead.id ? { ...l, status: 'Active / Funded', converted_to_trader_id: json.trader_id } : l))
      setConvertLead(null)
      setConvertPassword('')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setConverting(false)
    }
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true); setProfileError(''); setProfileSuccess('')
    const supabase = createClient()
    const { error } = await (supabase as any).from('profiles').update(profileForm).eq('id', salesUser.id)
    if (error) setProfileError(error.message)
    else { setProfileSuccess(t.profile_updated); setTimeout(() => setProfileSuccess(''), 3000) }
    setProfileSaving(false)
  }

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setProfileError(t.passwords_dont_match); return
    }
    if (passwordForm.new_password.length < 6) {
      setProfileError(t.password_too_short); return
    }
    setProfileSaving(true); setProfileError(''); setProfileSuccess('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password })
    if (error) setProfileError(error.message)
    else {
      setProfileSuccess(t.password_changed)
      setPasswordForm({ new_password: '', confirm_password: '' })
      setTimeout(() => setProfileSuccess(''), 3000)
    }
    setProfileSaving(false)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (!mounted || loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
      </div>
    )
  }

  const tabs = [
    { id: 'monitor' as const, label: t.trade_monitor,  icon: Activity },
    { id: 'clients' as const, label: t.clients,         icon: Users    },
    { id: 'leads'   as const, label: t.leads_tab,       icon: Target   },
    { id: 'profile' as const, label: t.profile_tab,     icon: User     },
  ]

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#050505', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>

      {/* Header */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFD700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} strokeWidth={2.5} color="#000" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.08em' }}>NOKHBA</div>
            <div style={{ color: '#FFD700', fontSize: 10, letterSpacing: '0.1em', fontWeight: 600 }}>{t.sales_dashboard}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{salesUser?.email}</span>
          <LanguageToggle />
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            <LogOut size={14} /> {t.logout}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 220, flexShrink: 0, background: '#0a0a0a', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px' }}>
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: isActive ? '#FFD700' : 'transparent',
                  color: isActive ? '#000' : '#9ca3af',
                  fontSize: 13, fontWeight: isActive ? 700 : 500, transition: 'all 0.15s',
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 1.5} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {tabLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {!tabLoading && activeTab === 'monitor' && (
            <div>
              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.trade_monitor.toUpperCase()}</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      {[t.date, t.trader_col, t.symbol, t.type, t.amount, t.profit_loss, t.status].map((h, i) => (
                        <th key={i} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>{t.no_trades_assigned}</td></tr>
                    ) : trades.map((tr: any) => (
                      <tr key={tr.id} style={{ borderBottom: '1px solid #111' }}>
                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(tr.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, color: '#fff' }}>{tr.profiles?.full_name || tr.profiles?.email || '—'}</td>
                        <td style={{ ...tdStyle, color: '#FFD700', fontWeight: 600 }}>{tr.symbol}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ color: tr.type === 'buy' ? '#22c55e' : '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>{tr.type}</span>
                        </td>
                        <td style={{ ...tdStyle, color: '#fff' }}>${Number(tr.amount || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ color: Number(tr.profit_loss) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                            {Number(tr.profit_loss) >= 0 ? '+' : ''}{Number(tr.profit_loss || 0).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: tr.status === 'open' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: tr.status === 'open' ? '#22c55e' : '#6b7280' }}>{tr.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!tabLoading && activeTab === 'clients' && (
            <div>
              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.clients.toUpperCase()}</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      {[t.name, t.email, t.balance, t.country, t.status, t.joined, t.actions].map((h, i) => (
                        <th key={i} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>{t.no_clients_assigned}</td></tr>
                    ) : clients.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #111' }}>
                        <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>{c.full_name || '—'}</td>
                        <td style={{ ...tdStyle, color: '#9ca3af' }}>{c.email || '—'}</td>
                        <td style={{ ...tdStyle, color: '#FFD700', fontWeight: 600 }}>
                          ${Number(c.wallets?.[0]?.balance || 0).toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, color: '#9ca3af' }}>{c.country || '—'}</td>
                        <td style={{ ...tdStyle }}>
                          {c.is_active ? (
                            <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{t.active_status}</span>
                          ) : (
                            <span style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{t.inactive_status}</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle }}>
                          <button
                            onClick={() => router.push(`/sub-admin/${slug}/client/${c.id}`)}
                            style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,215,0,0.5)', borderRadius: 4, color: '#FFD700', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                          >
                            {t.manage_action}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!tabLoading && activeTab === 'leads' && (
            <div>
              {/* Convert to Trader Modal */}
              {convertLead && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setConvertLead(null); setConvertPassword('') }}>
                  <div style={{ background: '#0f0f0f', border: '1px solid #22c55e', borderRadius: 14, padding: 32, width: 420, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
                    <h3 style={{ color: '#22c55e', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{t.convert_to_trader}</h3>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>
                      Converting <strong style={{ color: '#fff' }}>{convertLead.full_name}</strong> ({convertLead.email}) to a funded trader account.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: '#8a8e9b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 8 }}>{t.set_trader_password}</label>
                      <input type="password" value={convertPassword} onChange={e => setConvertPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', fontSize: 14 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setConvertLead(null); setConvertPassword('') }} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid #333', color: '#9ca3af', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{t.cancel}</button>
                      <button onClick={handleConvert} disabled={converting || convertPassword.length < 8}
                        style={{ flex: 1, padding: '11px', background: converting || convertPassword.length < 8 ? 'rgba(34,197,94,0.3)' : '#22c55e', border: 'none', color: '#000', borderRadius: 8, cursor: converting || convertPassword.length < 8 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                        {converting ? t.converting : t.convert_confirm}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.my_leads}</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      {[t.name, t.email, t.phone, t.country, t.status, t.notes, t.updated, t.actions].map((h, i) => (
                        <th key={i} style={thStyle}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>{t.no_leads_assigned}</td></tr>
                    ) : leads.map((lead: any) => {
                      const s = STATUS_STYLE[lead.status] || STATUS_STYLE['Cold']
                      return (
                        <tr key={lead.id} style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ ...tdStyle, color: '#fff', fontWeight: 600 }}>{lead.full_name}</td>
                          <td style={{ ...tdStyle, color: '#9ca3af' }}>{lead.email || '—'}</td>
                          <td style={{ ...tdStyle, color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 12 }}>{lead.phone_number || '—'}</td>
                          <td style={{ ...tdStyle, color: '#9ca3af' }}>{lead.country || '—'}</td>
                          <td style={{ ...tdStyle }}>
                            {lead.converted_to_trader_id ? (
                              lead.trader_active ? (
                                <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.active_status}</span>
                              ) : (
                                <span style={{ padding: '3px 10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.pending_activation}</span>
                              )
                            ) : (
                              <select
                                value={lead.status}
                                onChange={e => handleStatusChange(lead.id, e.target.value, e.currentTarget)}
                                style={{ background: s.bg, border: `1px solid ${s.color}`, color: s.color, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                              >
                                {LEAD_STATUSES.map(st => (
                                  <option key={st} value={st} style={{ background: '#111', color: '#fff' }}>{st}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td style={{ ...tdStyle, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.notes || '—'}</td>
                          <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '—'}</td>
                          <td style={{ ...tdStyle }}>
                            {lead.converted_to_trader_id ? (
                              <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.converted_status}</span>
                            ) : lead.email ? (
                              <button
                                onClick={() => { setConvertLead(lead); setConvertPassword('') }}
                                style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #22c55e', color: '#22c55e', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {t.convert_action}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!tabLoading && activeTab === 'profile' && (
            <div style={{ maxWidth: 560 }}>
              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.my_profile}</h2>

              {profileSuccess && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', color: '#EF5350', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                  {profileError}
                </div>
              )}

              {/* Profile Information */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
                <h3 style={{ color: '#FFD700', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.profile_information}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.full_name.toUpperCase()}</label>
                    <input
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none' }}
                      value={profileForm.full_name}
                      onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.email_address}</label>
                    <input
                      style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', color: '#555', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none', cursor: 'not-allowed' }}
                      value={salesUser?.email || ''}
                      disabled
                    />
                    <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{t.email_cannot_change}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.phone_number.toUpperCase()}</label>
                    <input
                      type="tel"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none' }}
                      value={profileForm.phone_number}
                      onChange={e => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.country.toUpperCase()}</label>
                    <input
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none' }}
                      value={profileForm.country}
                      onChange={e => setProfileForm({ ...profileForm, country: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    style={{ background: profileSaving ? '#555' : '#FFD700', color: '#000', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 700, cursor: profileSaving ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}
                  >
                    {profileSaving ? t.saving : t.save_changes}
                  </button>
                </div>
              </div>

              {/* Change Password */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
                <h3 style={{ color: '#FFD700', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>{t.change_password}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.new_password.toUpperCase()}</label>
                    <input
                      type="password"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none' }}
                      value={passwordForm.new_password}
                      onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>{t.confirm_new_password}</label>
                    <input
                      type="password"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, fontSize: 14, outline: 'none' }}
                      value={passwordForm.confirm_password}
                      onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={profileSaving}
                    style={{ background: profileSaving ? '#555' : '#FFD700', color: '#000', border: 'none', borderRadius: 6, padding: '12px', fontSize: 13, fontWeight: 700, cursor: profileSaving ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}
                  >
                    {profileSaving ? t.updating : t.update_password}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </div>
  )
}
