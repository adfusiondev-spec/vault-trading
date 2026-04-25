'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Users, Target, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salesUser, setSalesUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'monitor' | 'clients' | 'leads'>('monitor')

  const [trades, setTrades] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  // Convert lead to trader
  const [convertLead, setConvertLead] = useState<any>(null)
  const [convertPassword, setConvertPassword] = useState('')
  const [converting, setConverting] = useState(false)

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
      setLoading(false)
    }
    check()
  }, [router])

  const loadTab = useCallback(async (tab: typeof activeTab) => {
    if (!salesUser) return
    const supabase = createClient()
    setTabLoading(true)

    try {
      if (tab === 'monitor') {
        // Get all trader IDs assigned to this sales rep
        const { data: assignedTraders } = await supabase
          .from('profiles')
          .select('id')
          .eq('assigned_sales_id', salesUser.id)
          .eq('role', 'trader')

        const traderIds = (assignedTraders || []).map((t: any) => t.id)
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
        // fetch is_active for converted leads
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
    { id: 'monitor' as const, label: 'Trade Monitor',   icon: Activity },
    { id: 'clients' as const, label: 'Clients & Leads', icon: Users    },
    { id: 'leads' as const,   label: 'Leads',           icon: Target   },
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
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.08em' }}>The Vault</div>
            <div style={{ color: '#FFD700', fontSize: 10, letterSpacing: '0.1em', fontWeight: 600 }}>SALES DASHBOARD</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{salesUser?.email}</span>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            <LogOut size={14} /> Logout
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
              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>TRADE MONITOR</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      {['DATE', 'TRADER', 'SYMBOL', 'TYPE', 'AMOUNT', 'P&L', 'STATUS'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>No trades from assigned clients yet.</td></tr>
                    ) : trades.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #111' }}>
                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, color: '#fff' }}>{t.profiles?.full_name || t.profiles?.email || '—'}</td>
                        <td style={{ ...tdStyle, color: '#FFD700', fontWeight: 600 }}>{t.symbol}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ color: t.type === 'buy' ? '#22c55e' : '#ef4444', fontWeight: 600, textTransform: 'uppercase' }}>{t.type}</span>
                        </td>
                        <td style={{ ...tdStyle, color: '#fff' }}>${Number(t.amount || 0).toFixed(2)}</td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ color: Number(t.profit_loss) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                            {Number(t.profit_loss) >= 0 ? '+' : ''}{Number(t.profit_loss || 0).toFixed(2)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: t.status === 'open' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: t.status === 'open' ? '#22c55e' : '#6b7280' }}>{t.status}</span>
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
              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>CLIENTS & LEADS</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>
                      {['NAME', 'EMAIL', 'BALANCE', 'COUNTRY', 'STATUS', 'JOINED', 'ACTIONS'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>No assigned clients yet.</td></tr>
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
                            <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>ACTIVE</span>
                          ) : (
                            <span style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>INACTIVE</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle }}>
                          <button
                            onClick={() => router.push(`/sub-admin/${slug}/client/${c.id}`)}
                            style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,215,0,0.5)', borderRadius: 4, color: '#FFD700', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}
                          >
                            MANAGE →
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
                    <h3 style={{ color: '#22c55e', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>CONVERT TO TRADER</h3>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>
                      Converting <strong style={{ color: '#fff' }}>{convertLead.full_name}</strong> ({convertLead.email}) to a funded trader account.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ color: '#8a8e9b', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 8 }}>SET PASSWORD FOR TRADER ACCOUNT</label>
                      <input type="password" value={convertPassword} onChange={e => setConvertPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 14px', borderRadius: 6, outline: 'none', fontSize: 14 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setConvertLead(null); setConvertPassword('') }} style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid #333', color: '#9ca3af', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                      <button onClick={handleConvert} disabled={converting || convertPassword.length < 8}
                        style={{ flex: 1, padding: '11px', background: converting || convertPassword.length < 8 ? 'rgba(34,197,94,0.3)' : '#22c55e', border: 'none', color: '#000', borderRadius: 8, cursor: converting || convertPassword.length < 8 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>
                        {converting ? 'Converting...' : '✓ Convert'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <h2 style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 20 }}>MY LEADS</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      {['NAME', 'EMAIL', 'PHONE', 'COUNTRY', 'STATUS', 'NOTES', 'UPDATED', 'ACTIONS'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#4b5563' }}>No leads assigned to you yet.</td></tr>
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
                                <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>ACTIVE</span>
                              ) : (
                                <span style={{ padding: '3px 10px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>PENDING ACTIVATION</span>
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
                              <span style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ CONVERTED</span>
                            ) : lead.email ? (
                              <button
                                onClick={() => { setConvertLead(lead); setConvertPassword('') }}
                                style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #22c55e', color: '#22c55e', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Convert →
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

        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </div>
  )
}
