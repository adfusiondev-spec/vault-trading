'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Activity, DollarSign, LogOut, ShieldCheck, AlertCircle, Check, X, Bell, Eye, Settings } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import PaymentSettingsPanel from '@/components/sub-admin/PaymentSettingsPanel'
import { usePendingTransactions } from '@/hooks/usePendingTransactions'

// Mock Data
const INITIAL_TRADES: any[] = []
const INITIAL_FINANCIALS: any[] = []
const INITIAL_LEADS: any[] = []

export default function SubAdminDashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'monitor' | 'leads' | 'financial' | 'payment-settings'>('monitor')
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // State
  const [trades, setTrades] = useState(INITIAL_TRADES)
  const { pending, reviewTransaction, getProofUrl } = usePendingTransactions()
  const [traders, setTraders] = useState<any[]>([])
  const [isTraderModalOpen, setIsTraderModalOpen] = useState(false)
  const [creatingTrader, setCreatingTrader] = useState(false)
  const [traderForm, setTraderForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    country: ''
  })
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        // ── Super-Admin impersonation override ──
        // When a super admin clicks "Enter Sub-Admin Dashboard", vault_impersonated_tenant_id
        // is set in localStorage, granting access without requiring a sub_admin Supabase role.
        const impersonatedId = typeof window !== 'undefined' ? localStorage.getItem('vault_impersonated_tenant_id') : null
        const localRole = typeof window !== 'undefined' ? localStorage.getItem('vault_user_role') : null

        if (impersonatedId || localRole === 'sub_admin') {
          setIsAuthorized(true)
          setLoading(false)
          return
        }

        if (!session) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()

        // Accept both 'sub_admin' from DB and any session where localStorage says sub_admin
        if (!profile || (profile.role !== 'sub_admin' && profile.role !== 'super_admin')) {
          if (profile?.role === 'trader' || profile?.role === 'user') router.push('/user')
          else router.push('/login')
          return
        }

        // super_admin can view sub-admin panel directly too
        if (profile.role === 'super_admin') {
          setIsAuthorized(true)
          setLoading(false)
          return
        }

        setIsAuthorized(true)
      } catch (e) {
        console.error('Auth error:', e)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()

    const syncData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) return

        // Effective admin ID (might be impersonated)
        const impersonatedId = localStorage.getItem('vault_impersonated_tenant_id')
        const adminId = impersonatedId || authUser.id

        // ── Step 1: Sync Traders (the source of truth for filtering) ──
        const { data: traderData, error: traderError } = await supabase
          .from('profiles')
          .select('*, wallets(balance, currency)')
          .eq('role', 'trader')
          .eq('assigned_to', adminId)
          .order('created_at', { ascending: false })
        
        if (traderError) console.error('Trader fetch error:', traderError.message)
        
        if (traderData) {
          setTraders(traderData)
          const initialNotes: Record<string, string> = {}
          traderData.forEach(t => { if (t.notes) initialNotes[t.id] = t.notes })
          setNotes(prev => ({ ...initialNotes, ...prev }))
        }

        const traderIds: string[] = (traderData || []).map((t: any) => t.id)

        if (traderIds.length > 0) {
          // ── Step 2 ──
          // (Financial Requests are now handled natively by usePendingTransactions hook)

          // ── Step 3: Sync Live Trades (filter by known trader IDs) ──
          const { data: oData, error: oError } = await supabase
            .from('trades')
            .select('*, profiles:user_id(email)')
            .in('user_id', traderIds)
            .eq('status', 'open')
            .order('created_at', { ascending: false })

          if (oError) console.error('Trades fetch error:', oError.message)

          if (oData) {
            const formattedTrades = oData.map((o: any) => ({
              id: o.id,
              userEmail: o.profiles?.email || o.user_id,
              asset: o.symbol,
              type: o.trade_type === 'buy' ? 'Buy' : 'Sell',
              amount: parseFloat(o.amount || '0'),
              pnl: parseFloat(o.pnl || '0'),
              status: 'Open'
            }))
            setTrades(formattedTrades)
          }
        } else {
          // No traders yet, clear lists
          setTrades([])
        }
      } catch (e) {
        console.error('Sync failed', e)
      }
    }
    
    syncData()
    // Subscribe to all changes
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, syncData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, syncData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, syncData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [router])

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

  // Actions
  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEmergencyClose = (id: string) => {
    if (confirm('Are you sure you want to forcibly close this active trade?')) {
      setTrades(prev => prev.filter(t => t.id !== id))
    }
  }

  const handleFinancialAction = async (id: string, action: 'approve' | 'reject') => {
    const newStatus = action === 'approve' ? 'approved' : 'rejected' // matching database enum
    const result = await reviewTransaction(id, newStatus)
    
    if (!result.success) {
      alert(`Error updating transaction: ${result.error}`)
    }
  }

  const handleNoteChange = (id: string, val: string) => {
    setNotes(prev => ({ ...prev, [id]: val }))
  }

  const handleSaveNote = async (traderId: string) => {
    const noteContent = notes[traderId]
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ notes: noteContent })
      .eq('id', traderId)
      
    if (error) {
      alert('Failed to save note: ' + error.message)
    } else {
      // Show mini-notification or something? Simple alert for now.
      alert('Note saved successfully.')
    }
  }

  const handleCreateTrader = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingTrader(true)
    try {
      // Pass impersonated sub_admin ID so the API assigns the trader correctly
      const impersonatedId = localStorage.getItem('vault_impersonated_tenant_id')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (impersonatedId) headers['x-impersonated-id'] = impersonatedId

      const response = await fetch('/api/create-trader', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: traderForm.email,
          password: traderForm.password,
          full_name: traderForm.fullName,
          phone_number: traderForm.phone,
          country: traderForm.country
        })
      })
      
      const result = await response.json()
      if (response.ok) {
        // Save plain_password to localStorage as a fallback (DB also stores it via API)
        const traderId = result.trader?.id
        if (traderId) {
          try { localStorage.setItem(`vault_pw_${traderId}`, traderForm.password) } catch {}
        }
        setIsTraderModalOpen(false)
        setTraderForm({ fullName: '', email: '', password: '', phone: '', country: '' })
        alert('Trader created successfully!')
      } else {
        alert('Error: ' + result.error)
      }
    } catch (err: any) {
      alert('Failed to connect to server')
    } finally {
      setCreatingTrader(false)
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
      minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      background: '#0b0e11', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', overflow: 'auto'
    }}>
      
      {/* ── Top Navigation Bar ── */}
      <div style={{
        height: 60, flexShrink: 0, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', background: 'rgba(11,14,17,0.95)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#FFD700',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck size={20} strokeWidth={2.5} color="#000" />
          </div>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.1em', margin: 0 }}>THE VAULT</h1>
            <span style={{ color: 'var(--gold, #FFD700)', fontSize: 10, letterSpacing: '0.05em', fontWeight: 600 }}>CRM SYSTEM · SUB-ADMIN</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#26a69a' }} />
            <span style={{ fontSize: 12, letterSpacing: '0.05em' }}>SYSTEM ONLINE</span>
          </div>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)', color: '#c0c3ce', padding: '6px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, transition: 'all 0.2s', ...({ ':hover': { borderColor: '#fff', color: '#fff' } } as any)
          }}>
            <LogOut size={14} /> LOGOUT
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, height: 0, minHeight: 0 }}>
        
        {/* ── Sidebar CRM Navigation ── */}
        <div style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)',
          display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px'
        }}>
          {[
            { id: 'monitor', icon: Activity, label: 'Live Trade Monitor' },
            { id: 'leads', icon: Users, label: 'Sales & Leads Tracker' },
            { id: 'financial', icon: DollarSign, label: 'Financial Desk' },
            { id: 'payment-settings', icon: Settings, label: 'Payment Settings' },
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#06080a', overflowY: 'auto', minHeight: 0 }}>
          
          {/* Top Summary Bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, padding: 24, borderBottom: '1px solid var(--border)'
          }}>
            <SummaryCard title="Total Clients" value={traders.length.toString()} icon={Users} color="#fff" />
            <SummaryCard title="Active Trades" value={trades.length.toString()} icon={Activity} color="#FFD700" />
            <SummaryCard title="Pending Financials" value={pending.length.toString()} icon={DollarSign} color="#26a69a" />
          </div>

          <div style={{ padding: 24, flex: 1 }}>
            
            {/* ── Live Trade Monitor ── */}
            {activeTab === 'monitor' && (
              <div className="crm-section fade-in">
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#FFD700', letterSpacing: '0.05em' }}>LIVE TRADE MONITOR</h2>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>TICKET</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>USER EMAIL</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>ASSET & TYPE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>PROFIT/LOSS</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>RISK CONTROL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No active trades on the network.</td></tr>
                      ) : trades.map((trade) => (
                        <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#8a8e9b' }}>{trade.id}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{trade.userEmail}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 600 }}>{trade.asset}</span>
                            <span style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 4, fontSize: 11, background: trade.type === 'Buy' ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)', color: trade.type === 'Buy' ? '#26a69a' : '#ef5350' }}>{trade.type}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>${trade.amount.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: trade.pnl >= 0 ? '#26a69a' : '#ef5350' }}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button onClick={() => handleEmergencyClose(trade.id)} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ef5350', border: 'none', color: '#fff',
                                padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em'
                              }}>
                                <AlertCircle size={12} strokeWidth={3} /> EMERGENCY CLOSE
                              </button>
                              <button onClick={() => router.push(`/sub-admin/client/${trade.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`)} style={{
                                padding: '5px 10px', background: 'transparent', border: '1px solid #FFD700', borderRadius: 4,
                                color: '#FFD700', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                              }}>
                                DETAILS
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

            {/* ── Sales & Leads Tracker ── */}
            {activeTab === 'leads' && (
              <div className="crm-section fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#FFD700', letterSpacing: '0.05em' }}>CLIENT PORTFOLIO & LEADS</h2>
                    <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>{traders.length} registered client{traders.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button
                    onClick={() => setIsTraderModalOpen(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 6, background: '#FFD700', border: 'none', color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Users size={16} strokeWidth={2.5} /> ADD NEW CLIENT
                  </button>
                </div>

                {/* ── Excel-style spreadsheet table ── */}
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,215,0,0.15)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12, minWidth: 980 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,215,0,0.07)', borderBottom: '2px solid rgba(255,215,0,0.2)' }}>
                        {['#', 'FULL NAME', 'EMAIL', 'PHONE', 'COUNTRY', 'BALANCE (USD)', 'PASSWORD', 'REG DATE', 'STATUS', 'ACTIONS'].map(col => (
                          <th key={col} style={{ padding: '13px 14px', fontWeight: 700, color: '#FFD700', fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap', userSelect: 'none' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {traders.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ padding: 50, textAlign: 'center', color: '#8a8e9b', background: 'rgba(255,255,255,0.01)' }}>
                            No clients registered under your account yet.
                          </td>
                        </tr>
                      ) : traders.map((trader, i) => {
                        const balance = Number((trader.wallets as any)?.[0]?.balance || 0)
                        const isVisible = visiblePasswords.has(trader.id)
                        const regDate = trader.created_at ? new Date(trader.created_at).toLocaleDateString('en-GB') : '—'
                        // Password: prefer DB value, fall back to localStorage
                        const localPw = typeof window !== 'undefined' ? localStorage.getItem(`vault_pw_${trader.id}`) : null
                        const passwordDisplay = trader.plain_password || localPw || '—'
                        return (
                          <tr
                            key={trader.id}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent')}
                          >
                            {/* Row # */}
                            <td style={{ padding: '13px 14px', color: '#555', fontFamily: 'monospace', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.04)' }}>{String(i + 1).padStart(2, '0')}</td>
                            {/* Full Name */}
                            <td style={{ padding: '13px 14px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{trader.full_name || '—'}</td>
                            {/* Email */}
                            <td style={{ padding: '13px 14px', color: '#8a8e9b', fontFamily: 'monospace', fontSize: 11 }}>{trader.email}</td>
                            {/* Phone */}
                            <td style={{ padding: '13px 14px', color: '#8a8e9b', whiteSpace: 'nowrap' }}>{trader.phone_number || '—'}</td>
                            {/* Country */}
                            <td style={{ padding: '13px 14px', color: '#8a8e9b', whiteSpace: 'nowrap' }}>{trader.country || '—'}</td>
                            {/* Balance */}
                            <td style={{ padding: '13px 14px', fontFamily: 'monospace', fontWeight: 700, color: balance > 0 ? '#FFD700' : '#555', whiteSpace: 'nowrap' }}>
                              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Password */}
                            <td style={{ padding: '13px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 13, color: isVisible ? '#26a69a' : '#555', letterSpacing: isVisible ? '0.04em' : '0.15em', minWidth: 80 }}>
                                  {isVisible ? passwordDisplay : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePassword(trader.id)}
                                  style={{
                                    padding: '2px 9px', background: isVisible ? 'rgba(239,83,80,0.12)' : 'rgba(255,255,255,0.06)',
                                    border: `1px solid ${isVisible ? 'rgba(239,83,80,0.3)' : 'rgba(255,255,255,0.12)'}`,
                                    borderRadius: 4, color: isVisible ? '#ef5350' : '#8a8e9b',
                                    fontSize: 9, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.05em', transition: 'all 0.15s'
                                  }}
                                >
                                  {isVisible ? 'HIDE' : 'SHOW'}
                                </button>
                              </div>
                            </td>
                            {/* Reg Date */}
                            <td style={{ padding: '13px 14px', color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}>{regDate}</td>
                            {/* Status */}
                            <td style={{ padding: '13px 14px' }}>
                              <span style={{ display: 'inline-block', padding: '3px 10px', background: 'rgba(38,166,154,0.1)', color: '#26a69a', border: '1px solid rgba(38,166,154,0.25)', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>ACTIVE</span>
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '13px 14px' }}>
                              <button
                                onClick={() => router.push(`/sub-admin/client/${trader.id}`)}
                                style={{ padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,215,0,0.5)', borderRadius: 4, color: '#FFD700', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                              >
                                MANAGE →
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Financial Desk ── */}
            {activeTab === 'financial' && (
              <div className="crm-section fade-in">
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#FFD700', letterSpacing: '0.05em' }}>PENDING FINANCIAL REQUESTS</h2>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>REQ ID</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>USER EMAIL</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>TYPE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>RECEIPT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTION PENDING</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>All financial requests have been processed.</td></tr>
                      ) : pending.map((fin: any) => (
                        <tr key={fin.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#8a8e9b' }}>{fin.id.substring(0,8)}...</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{fin.profiles?.email || 'Unknown'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: fin.type === 'deposit' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: fin.type === 'deposit' ? '#26a69a' : '#ef5350' }}>{fin.type.toUpperCase()}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>${Number(fin.amount).toLocaleString()} <span style={{ color: '#8a8e9b', fontSize: 10 }}>{fin.currency}</span></td>
                          <td style={{ padding: '12px 16px' }}>
                            {fin.proof_of_payment_url ? (
                              <button onClick={async () => {
                                const url = await getProofUrl(fin.proof_of_payment_url)
                                if (url) window.open(url, '_blank')
                              }} style={{ background: 'transparent', border: '1px solid #787b86', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                                <Eye size={12}/> View Image
                              </button>
                            ) : <span style={{ color: '#555', fontSize: 10 }}>No Receipt</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => handleFinancialAction(fin.id, 'reject')} style={{
                                width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.1)',
                                color: '#ef5350', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s'
                              }}>
                                <X size={16} strokeWidth={2.5} />
                              </button>
                              <button onClick={() => handleFinancialAction(fin.id, 'approve')} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 6,
                                border: '1px solid #26a69a', background: 'rgba(38,166,154,0.15)',
                                color: '#26a69a', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                              }}>
                                <Check size={16} strokeWidth={2.5} /> APPROVE
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

            {/* ── Payment Settings ── */}
            {activeTab === 'payment-settings' && (
              <div className="crm-section fade-in" style={{ overflowY: 'auto', height: '100%' }}>
                <PaymentSettingsPanel />
              </div>
            )}
            
          </div>
        </div>
      </div>

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

      {/* ── Add Trader Modal ── */}
      {isTraderModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            width: '100%', maxWidth: 450, background: '#0b0e11', borderRadius: 16, border: '1px solid rgba(255,215,0,0.2)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden'
          }}>
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#FFD700' }}>REGISTER NEW CLIENT</h2>
              <button onClick={() => setIsTraderModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateTrader} style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>FULL NAME</label>
                <input 
                  required
                  value={traderForm.fullName}
                  onChange={e => setTraderForm({...traderForm, fullName: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>EMAIL ADDRESS</label>
                  <input 
                    type="email" required
                    value={traderForm.email}
                    onChange={e => setTraderForm({...traderForm, email: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>PASSWORD</label>
                  <input 
                    type="password" required
                    value={traderForm.password}
                    onChange={e => setTraderForm({...traderForm, password: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>PHONE NUMBER</label>
                  <input 
                    value={traderForm.phone}
                    onChange={e => setTraderForm({...traderForm, phone: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>COUNTRY</label>
                  <input 
                    value={traderForm.country}
                    onChange={e => setTraderForm({...traderForm, country: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={creatingTrader}
                style={{ 
                  width: '100%', padding: 14, marginTop: 10, background: '#FFD700', border: 'none', 
                  borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  opacity: creatingTrader ? 0.6 : 1
                }}
              >
                {creatingTrader ? 'REGISTERING...' : 'CONFIRM REGISTRATION'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
      display: 'flex', alignItems: 'center', gap: 16
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${color}40` }}>
        <Icon size={24} color={color} />
      </div>
      <div>
        <div style={{ color: '#8a8e9b', fontSize: 12, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>{title.toUpperCase()}</div>
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
      </div>
    </div>
  )
}
