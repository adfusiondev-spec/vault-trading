'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Activity, DollarSign, LogOut, ShieldCheck, AlertCircle, Check, X, Bell, Eye, Settings, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePendingTransactions } from '@/hooks/usePendingTransactions'
import { useMarketData } from '@/hooks/useMarketData'

import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

// Mock Data
const INITIAL_TRADES: any[] = []
const INITIAL_FINANCIALS: any[] = []
const INITIAL_LEADS: any[] = []

type DbPackage = { id: string; key: string; label: string; monthly_price: number; yearly_price: number }

const TRIAL_OPTIONS = [
  { value: 'none',       label: 'None',         days: 0 },
  { value: 'trial_1day', label: 'Trial 1 day',  days: 1 },
  { value: 'trial_3days',label: 'Trial 3 days', days: 3 },
  { value: 'trial_7days',label: 'Trial 7 days', days: 7 },
] as const

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
] as const

type BillingCycle = 'monthly' | 'yearly'

export default function SubAdminDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { slug } = React.use(params)
  const { prices } = useMarketData()

  const calculatePnL = (trade: any, currentPrice: number) => {
    if (!currentPrice || !trade.entryPrice) return 0
    const pnl = trade.type === 'Buy'
      ? (currentPrice - trade.entryPrice) * (trade.amount / trade.entryPrice)
      : (trade.entryPrice - currentPrice) * (trade.amount / trade.entryPrice)
    return pnl
  }

  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'monitor' | 'leads' | 'financial' | 'subscription' | 'payment-settings'>('monitor')
  const [subscriptionPayments, setSubscriptionPayments] = useState<any[]>([])
  const [dbPackages, setDbPackages] = useState<DbPackage[]>([])
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [companyProfile, setCompanyProfile] = useState<{ id: string, full_name: string } | null>(null)

  // State
  const [trades, setTrades] = useState(INITIAL_TRADES)
  const { pending, allTransactions, reviewTransaction, getProofUrl } = usePendingTransactions()
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
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({})
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  // Notifications
  const [showNotifications, setShowNotifications] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const filteredClients = useMemo(
    () =>
      traders.filter((client: any) => {
        const query = searchQuery.toLowerCase()
        return (
          client.full_name?.toLowerCase().includes(query) ||
          client.email?.toLowerCase().includes(query) ||
          client.phone_number?.toLowerCase().includes(query)
        )
      }),
    [traders, searchQuery]
  )

  // Subscription Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [selectedPackage, setSelectedPackage] = useState<string>('pro')
  const [trialOption, setTrialOption] = useState('none')

  const activePkg = dbPackages.find(p => p.key === selectedPackage)

  useEffect(() => {
    if (trialOption !== 'none') { setPaymentAmount('0.00'); return }
    const price = billingCycle === 'monthly' ? (activePkg?.monthly_price ?? 0) : (activePkg?.yearly_price ?? 0)
    setPaymentAmount(price.toFixed(2))
  }, [billingCycle, selectedPackage, trialOption, activePkg])

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // Load packages from DB
    ;(supabase as any)
      .from('subscription_packages')
      .select('id, key, label, monthly_price, yearly_price')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }: { data: DbPackage[] | null }) => {
        if (data && data.length > 0) {
          setDbPackages(data)
          setSelectedPackage(data[0].key)
        }
      })

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        // ── Super-Admin impersonation override ──
        // When a super admin clicks "Enter Sub-Admin Dashboard", vault_impersonated_tenant_id
        // is set in localStorage, granting access without requiring a sub_admin Supabase role.
        const impersonatedId = typeof window !== 'undefined' ? localStorage.getItem('vault_impersonated_tenant_id') : null
        const localRole = typeof window !== 'undefined' ? localStorage.getItem('vault_user_role') : null

        if (impersonatedId || localRole === 'sub_admin') {
          const { data: company } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_slug', slug)
            .eq('role', 'sub_admin')
            .single()
            
          if (!company) {
            router.push('/login')
            return
          }
          setCompanyProfile(company)
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
          const { data: company } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_slug', slug)
            .eq('role', 'sub_admin')
            .single()
            
          if (!company) {
            router.push('/login')
            return
          }
          setCompanyProfile(company)
          setIsAuthorized(true)
          setLoading(false)
          return
        }

        const { data: company } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_slug', slug)
          .eq('role', 'sub_admin')
          .single()
          
        if (!company) {
          router.push('/login')
          return
        }
        setCompanyProfile(company)
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
          const initialStatuses: Record<string, string> = {}
          traderData.forEach((t: any) => {
            if (t.notes) initialNotes[t.id] = t.notes
            initialStatuses[t.id] = t.lead_status || 'Active'
          })
          setNotes(prev => ({ ...initialNotes, ...prev }))
          setLeadStatuses(prev => ({ ...initialStatuses, ...prev }))
        }

        const traderIds: string[] = (traderData || []).map((t: any) => t.id)

        if (traderIds.length > 0) {
          // ── Step 2 ──
          // (Financial Requests are now handled natively by usePendingTransactions hook)

          // ── Step 3: Sync Live Trades (filter by known trader IDs) ──
          const { data: oData, error: oError } = await supabase
            .from('trades')
            .select('*, profiles:user_id(email, full_name)')
            .in('user_id', traderIds)
            .eq('status', 'open')
            .order('created_at', { ascending: false })

          if (oError) console.error('Trades fetch error:', oError.message)

          if (oData) {
            const formattedTrades = oData.map((o: any) => ({
              id: o.id,
              userId: o.user_id,
              userEmail: o.profiles?.email || o.user_id,
              userName: o.profiles?.full_name || o.profiles?.email || 'Unknown',
              asset: o.symbol,
              type: o.type === 'buy' ? 'Buy' : 'Sell',
              amount: parseFloat(o.amount || '0'),
              entryPrice: parseFloat(o.entry_price || '0'),
              status: 'Open'
            }))
            setTrades(formattedTrades)
          }
        } else {
          // No traders yet, clear lists
          setTrades([])
        }

        // ── Step 4: Fetch Subscription Payments for this sub-admin ──
        const { data: subPayments } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('sub_admin_id', adminId)
          .order('created_at', { ascending: false })
        if (subPayments) setSubscriptionPayments(subPayments)

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
  }, [router, slug])

  const { notifications, unreadCount, markAsRead } = useNotifications(companyProfile?.id || '', 'sub_admin')

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

  const handleSubscriptionPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const isTrial = trialOption !== 'none'
    if (!isTrial && !paymentMethod) return alert('Please select a payment method')
    if (!companyProfile?.id) return alert('Error identifying company profile')

    setPaymentLoading(true)
    try {
      const payableAmount = trialOption !== 'none' ? 0 : parseFloat(paymentAmount)
      const fullPrice = billingCycle === 'monthly'
        ? (activePkg?.monthly_price ?? 0)
        : (activePkg?.yearly_price ?? 0)
      const trialDays = TRIAL_OPTIONS.find(t => t.value === trialOption)?.days ?? 0

      const fd = new FormData()
      fd.append('sub_admin_id', companyProfile.id)
      fd.append('amount', String(payableAmount))
      fd.append('method', paymentMethod)
      fd.append('reference', `SUB-${Date.now()}`)
      fd.append('package', selectedPackage)
      fd.append('billing_cycle', billingCycle)
      fd.append('trial_option', trialOption)
      fd.append('trial_days', String(trialDays))
      fd.append('full_amount', String(fullPrice))
      if (paymentProofFile) fd.append('proof', paymentProofFile)

      const res = await fetch('/api/subscription-payment', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      const msg = trialOption !== 'none'
        ? `Trial period (${TRIAL_OPTIONS.find(t => t.value === trialOption)?.label}) request submitted!`
        : 'Subscription payment submitted successfully!'
      alert(msg)
      setIsPaymentModalOpen(false)
      setPaymentAmount('')
      setPaymentMethod('')
      setPaymentProofFile(null)
      setBillingCycle('monthly')
      setSelectedPackage('pro')
      setTrialOption('none')
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setPaymentLoading(false)
    }
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

  const handleLeadStatusChange = async (traderId: string, newStatus: string) => {
    setLeadStatuses(prev => ({ ...prev, [traderId]: newStatus }))
    const supabase = createClient()
    await (supabase.from('profiles') as any).update({ lead_status: newStatus }).eq('id', traderId)
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
        const traderId = result.trader?.id
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
        <p style={{ marginTop: 16, fontSize: 11, letterSpacing: '0.2em', color: '#8a8e9b', fontWeight: 600 }}>{t.authenticating}</p>
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
            <h1 style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.1em', margin: 0 }}>{companyProfile?.full_name || 'THE VAULT'}</h1>
            <span style={{ color: 'var(--gold, #FFD700)', fontSize: 10, letterSpacing: '0.05em', fontWeight: 600 }}>CRM SYSTEM · SUB-ADMIN</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#26a69a' }} />
            <span style={{ fontSize: 12, letterSpacing: '0.05em' }}>SYSTEM ONLINE</span>
          </div>

          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={16} color="#787b86" />
              {unreadCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef5350', color: '#fff', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>}
            </div>
            {showNotifications && (
              <div style={{ position: 'absolute', top: 30, right: -120, width: 300, background: '#1a1e2e', border: '1px solid #2a2e3b', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2e3b', fontSize: 13, fontWeight: 700, color: '#fff' }}>Notifications</div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#787b86', fontSize: 12 }}>No notifications yet.</div>
                  ) : notifications.map((n:any) => (
                    <div key={n.id} onClick={() => !n.read && markAsRead(n.id)} style={{ padding: 12, borderBottom: '1px solid #2a2e3b', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(38,166,154,0.05)' }}>
                      <div style={{ fontSize: 12, color: n.read ? '#d1d4dc' : '#fff', fontWeight: n.read ? 400 : 600 }}>{n.title || 'Notification'}</div>
                      <div style={{ fontSize: 11, color: '#787b86', marginTop: 4 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: '#787b86', marginTop: 6 }}>{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setIsPaymentModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#FFD700',
            border: 'none', color: '#000', padding: '6px 16px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.2s'
          }}>
            <DollarSign size={14} /> {t.subscription}
          </button>

          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)', color: '#c0c3ce', padding: '6px 12px',
            borderRadius: 6, cursor: 'pointer', fontSize: 12, transition: 'all 0.2s', ...({ ':hover': { borderColor: '#fff', color: '#fff' } } as any)
          }}>
            <LogOut size={14} /> {t.logout}
          </button>
          <LanguageToggle />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, height: 0, minHeight: 0 }}>
        
        {/* ── Sidebar CRM Navigation ── */}
        <div style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)',
          display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px'
        }}>
          {[
            { id: 'monitor', icon: Activity, label: t.trade_monitor },
            { id: 'leads', icon: Users, label: t.clients },
            { id: 'financial', icon: DollarSign, label: t.financial_desk },
            { id: 'subscription', icon: CreditCard, label: 'Subscription' },
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
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.name}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.email}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.asset} & {t.type}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.amount}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>{t.profit_loss}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>RISK CONTROL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No active trades on the network.</td></tr>
                      ) : trades.map((trade) => {
                        const price = prices[trade.asset]?.price || prices[trade.asset + 'T']?.price || 0
                        const pnl = calculatePnL(trade, price)
                        return (
                        <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#8a8e9b' }} title={trade.id}>{trade.userName.slice(0, 20)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500 }}>{trade.userEmail}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 600 }}>{trade.asset}</span>
                            <span style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 4, fontSize: 11, background: trade.type === 'Buy' ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)', color: trade.type === 'Buy' ? '#26a69a' : '#ef5350' }}>{trade.type}</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>${trade.amount.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: pnl >= 0 ? '#26a69a' : '#ef5350' }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} USD</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                              <button onClick={() => handleEmergencyClose(trade.id)} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ef5350', border: 'none', color: '#fff',
                                padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em'
                              }}>
                                <AlertCircle size={12} strokeWidth={3} /> EMERGENCY CLOSE
                              </button>
                              <button onClick={() => router.push(`/sub-admin/${slug}/client/${trade.userId}`)} style={{
                                padding: '5px 10px', background: 'transparent', border: '1px solid #FFD700', borderRadius: 4,
                                color: '#FFD700', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                              }}>
                                DETAILS
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
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
                    <Users size={16} strokeWidth={2.5} /> {t.add_client}
                  </button>
                </div>

                {/* ── Search Filter ── */}
                <div style={{ marginBottom: 16 }}>
                  <input
                    type="text"
                    placeholder={t.search + ' by name, email, or phone...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: '#0a0a0a', border: '1px solid #FFD700', color: '#fff',
                      borderRadius: 6, padding: '10px 16px', width: 320, outline: 'none', fontSize: 14,
                    }}
                  />
                </div>

                {/* ── Excel-style spreadsheet table ── */}
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,215,0,0.15)', boxShadow: '0 4px 30px rgba(0,0,0,0.4)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12, minWidth: 980 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,215,0,0.07)', borderBottom: '2px solid rgba(255,215,0,0.2)' }}>
                        {['#', t.full_name, t.email, t.phone_number, t.country, `${t.balance} (USD)`, 'REG DATE', t.status, t.actions].map(col => (
                          <th key={col} style={{ padding: '13px 14px', fontWeight: 700, color: '#FFD700', fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap', userSelect: 'none' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ padding: 50, textAlign: 'center', color: '#8a8e9b', background: 'rgba(255,255,255,0.01)' }}>
                            {searchQuery ? 'No clients match your search.' : 'No clients registered under your account yet.'}
                          </td>
                        </tr>
                      ) : filteredClients.map((trader, i) => {
                        const balance = Number((trader.wallets as any)?.[0]?.balance || 0)
                        const isVisible = visiblePasswords.has(trader.id)
                        const regDate = trader.created_at ? new Date(trader.created_at).toLocaleDateString('en-GB') : '—'
                        // Password: prefer DB value, fall back to localStorage
                        const localPw = typeof window !== 'undefined' ? localStorage.getItem(`vault_pw_${trader.id}`) : null
                        const passwordDisplay = localPw || '—'
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
                            {/* Reg Date */}
                            <td style={{ padding: '13px 14px', color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}>{regDate}</td>
                            {/* Lead Status */}
                            <td style={{ padding: '13px 14px' }}>
                              {(() => {
                                const status = leadStatuses[trader.id] || 'Active'
                                const colors: Record<string, { bg: string; color: string; border: string }> = {
                                  'Active':      { bg: 'rgba(38,166,154,0.1)',  color: '#26a69a', border: 'rgba(38,166,154,0.3)' },
                                  'Hot Lead':    { bg: 'rgba(255,215,0,0.1)',   color: '#FFD700', border: 'rgba(255,215,0,0.3)' },
                                  'Cold':        { bg: 'rgba(120,123,134,0.1)', color: '#787b86', border: 'rgba(120,123,134,0.3)' },
                                  'Prospect':    { bg: 'rgba(100,150,255,0.1)', color: '#6496ff', border: 'rgba(100,150,255,0.3)' },
                                  'Inactive':    { bg: 'rgba(239,83,80,0.1)',   color: '#ef5350', border: 'rgba(239,83,80,0.3)' },
                                }
                                const c = colors[status] || colors['Active']
                                return (
                                  <select
                                    value={status}
                                    onChange={e => handleLeadStatusChange(trader.id, e.target.value)}
                                    style={{
                                      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                                      borderRadius: 20, padding: '3px 8px', fontSize: 9, fontWeight: 700,
                                      letterSpacing: '0.06em', outline: 'none', cursor: 'pointer',
                                      appearance: 'none', textAlign: 'center'
                                    }}
                                  >
                                    {['Active', 'Hot Lead', 'Cold', 'Prospect', 'Inactive'].map(s => (
                                      <option key={s} value={s} style={{ background: '#1a1e2e', color: '#fff' }}>{s.toUpperCase()}</option>
                                    ))}
                                  </select>
                                )
                              })()}
                            </td>
                            {/* Actions */}
                            <td style={{ padding: '13px 14px' }}>
                              <button
                                onClick={() => router.push(`/sub-admin/${slug}/client/${trader.id}`)}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#FFD700', letterSpacing: '0.05em' }}>FINANCIAL REQUESTS</h2>
                  {pending.length > 0 && (
                    <span style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                      {pending.length} PENDING
                    </span>
                  )}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>DATE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.email}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.type}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.amount}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.proof_of_payment}</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No financial requests yet.</td></tr>
                      ) : allTransactions.map((fin: any) => (
                        <tr key={fin.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: fin.status !== 'pending' ? 0.7 : 1 }}>
                          <td style={{ padding: '12px 16px', color: '#8a8e9b', fontSize: 11 }}>
                            {new Date(fin.created_at).toLocaleDateString('en-GB')}
                          </td>
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
                                <Eye size={12}/> View
                              </button>
                            ) : <span style={{ color: '#555', fontSize: 10 }}>No Receipt</span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                              background: fin.status === 'approved' ? 'rgba(38,166,154,0.1)' : fin.status === 'rejected' ? 'rgba(239,83,80,0.1)' : 'rgba(255,215,0,0.1)',
                              color: fin.status === 'approved' ? '#26a69a' : fin.status === 'rejected' ? '#ef5350' : '#FFD700',
                              border: `1px solid ${fin.status === 'approved' ? 'rgba(38,166,154,0.3)' : fin.status === 'rejected' ? 'rgba(239,83,80,0.3)' : 'rgba(255,215,0,0.3)'}`
                            }}>
                              {fin.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {fin.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => handleFinancialAction(fin.id, 'reject')} style={{
                                  width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.1)',
                                  color: '#ef5350', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                }}>
                                  <X size={16} strokeWidth={2.5} />
                                </button>
                                <button onClick={() => handleFinancialAction(fin.id, 'approve')} style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 32, borderRadius: 6,
                                  border: '1px solid #26a69a', background: 'rgba(38,166,154,0.15)',
                                  color: '#26a69a', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                                }}>
                                  <Check size={16} strokeWidth={2.5} /> APPROVE
                                </button>
                              </div>
                            ) : (
                              <span style={{ color: '#555', fontSize: 11 }}>Processed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Subscription Tab ── */}
            {activeTab === 'subscription' && (
              <div className="crm-section fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#FFD700', letterSpacing: '0.05em' }}>SUBSCRIPTION PAYMENTS</h2>
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    style={{ padding: '8px 20px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: '#FFD700', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + NEW PAYMENT
                  </button>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>DATE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>PACKAGE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>METHOD</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>PROOF</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionPayments.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#8a8e9b' }}>No subscription payments yet. Submit a payment to activate your account.</td></tr>
                      ) : subscriptionPayments.map((sp: any) => (
                        <tr key={sp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', color: '#8a8e9b', fontSize: 11 }}>{new Date(sp.created_at).toLocaleDateString('en-GB')}</td>
                          <td style={{ padding: '12px 16px', color: '#c0c3ce' }}>{sp.package || '—'}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>${Number(sp.amount).toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', color: '#c0c3ce' }}>{sp.method || '—'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {sp.proof_url ? (
                              <button onClick={async () => {
                                const sb = createClient()
                                const { data } = await sb.storage.from('payment-proofs').createSignedUrl(sp.proof_url, 120)
                                if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                              }} style={{ background: 'transparent', border: '1px solid #787b86', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                                <Eye size={12} /> View
                              </button>
                            ) : <span style={{ color: '#555', fontSize: 10 }}>No Receipt</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                              background: sp.status === 'Approved' ? 'rgba(38,166,154,0.1)' : sp.status === 'Rejected' ? 'rgba(239,83,80,0.1)' : 'rgba(255,215,0,0.1)',
                              color: sp.status === 'Approved' ? '#26a69a' : sp.status === 'Rejected' ? '#ef5350' : '#FFD700',
                            }}>
                              {(sp.status || 'Pending').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

      {/* ── Subscription Payment Modal ── */}
      {isPaymentModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            width: '100%', maxWidth: 450, background: '#0b0e11', borderRadius: 16, border: '1px solid rgba(255,215,0,0.2)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden'
          }}>
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#FFD700' }}>SUBSCRIPTION PAYMENT</h2>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8a8e9b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSubscriptionPayment} style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 15 }}>

              {/* BILLING CYCLE */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>BILLING CYCLE</label>
                <select
                  value={billingCycle}
                  onChange={e => setBillingCycle(e.target.value as BillingCycle)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,22,28,1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FFFFFF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: 40 }}
                >
                  {BILLING_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              {/* PACKAGE — hidden for trial */}
              {trialOption === 'none' && <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>PACKAGE</label>
                <select
                  value={selectedPackage}
                  onChange={e => setSelectedPackage(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,22,28,1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FFFFFF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: 40 }}
                >
                  {dbPackages.map(pkg => (
                    <option key={pkg.key} value={pkg.key}>
                      {pkg.label} — ${billingCycle === 'monthly' ? pkg.monthly_price : pkg.yearly_price}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </option>
                  ))}
                </select>
              </div>}

              {/* TRIAL PERIOD */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>TRIAL PERIOD</label>
                <select
                  value={trialOption}
                  onChange={e => setTrialOption(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,22,28,1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FFFFFF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: 40 }}
                >
                  {TRIAL_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* PAYMENT METHOD — hidden for trial */}
              {trialOption === 'none' && (
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>PAYMENT METHOD</label>
                <select
                  required
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,22,28,1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer' }}
                >
                  <option value="">— Select Method —</option>
                  <option value="crypto_usdt">USDT (Tether)</option>
                  <option value="crypto_btc">Bitcoin (BTC)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              )}

              {/* Dynamic payment details panel — hidden for trial */}
              {trialOption === 'none' && paymentMethod === 'bank_transfer' && (
                <div style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', marginBottom: 10, letterSpacing: '0.05em' }}>BANK TRANSFER DETAILS</div>
                  <div style={{ fontSize: 12, color: '#c0c3ce', lineHeight: 2 }}>
                    <div><span style={{ color: '#8a8e9b' }}>Bank:</span> Al Rajhi Bank</div>
                    <div><span style={{ color: '#8a8e9b' }}>Account Name:</span> The Vault Platform LLC</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#8a8e9b' }}>IBAN:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>SA1234567890123456789012</span>
                      <button type="button" onClick={() => { navigator.clipboard.writeText('SA1234567890123456789012') }}
                        style={{ background: '#FFD700', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>COPY</button>
                    </div>
                    <div><span style={{ color: '#8a8e9b' }}>SWIFT:</span> RJHISARI</div>
                  </div>
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_usdt' && (
                <div style={{ background: 'rgba(38,166,154,0.05)', border: '1px solid rgba(38,166,154,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#26a69a', marginBottom: 10, letterSpacing: '0.05em' }}>USDT (TRC-20) DETAILS</div>
                  <div style={{ fontSize: 12, color: '#c0c3ce', lineHeight: 2 }}>
                    <div><span style={{ color: '#8a8e9b' }}>Network:</span> TRON (TRC-20)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#8a8e9b' }}>Address:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>TXxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
                      <button type="button" onClick={() => { navigator.clipboard.writeText('TXxxxxxxxxxxxxxxxxxxxxxxxxxxx') }}
                        style={{ background: '#26a69a', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>COPY</button>
                    </div>
                  </div>
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_btc' && (
                <div style={{ background: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF9800', marginBottom: 10, letterSpacing: '0.05em' }}>BITCOIN (BTC) DETAILS</div>
                  <div style={{ fontSize: 12, color: '#c0c3ce', lineHeight: 2 }}>
                    <div><span style={{ color: '#8a8e9b' }}>Network:</span> Bitcoin (BTC)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#8a8e9b' }}>Address:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
                      <button type="button" onClick={() => { navigator.clipboard.writeText('bc1qxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') }}
                        style={{ background: '#FF9800', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>COPY</button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>
                  AMOUNT (USD)
                  {trialOption !== 'none' && (
                    <span style={{ marginLeft: 8, color: '#10B981', fontSize: 10, fontWeight: 700 }}>(Trial — $0.00 now)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={`$${paymentAmount}`}
                  readOnly
                  style={{ width: '100%', padding: '12px 16px', background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: trialOption !== 'none' ? '#10B981' : '#FFD700', fontSize: 18, fontWeight: 700, cursor: 'not-allowed', outline: 'none' }}
                />
                {trialOption !== 'none' && (
                  <div style={{ marginTop: 5, fontSize: 11, color: '#8a8e9b' }}>
                    After trial: ${billingCycle === 'monthly' ? (activePkg?.monthly_price ?? 0) : (activePkg?.yearly_price ?? 0)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </div>
                )}
              </div>

              {/* Proof Upload — hidden during trial */}
              {trialOption === 'none' ? (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>PAYMENT PROOF (Required)</label>
                  <input
                    type="file" accept="image/*,application/pdf"
                    onChange={e => setPaymentProofFile(e.target.files?.[0] || null)}
                    required
                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${paymentProofFile ? '#26a69a' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: '#fff', cursor: 'pointer' }}
                  />
                  {paymentProofFile && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#26a69a' }}>✓ {paymentProofFile.name}</div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 14, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 4 }}>Trial Mode Active</div>
                  <div style={{ fontSize: 11, color: '#8a8e9b', lineHeight: 1.6 }}>
                    No payment required. You will be charged{' '}
                    <span style={{ color: '#FFD700', fontWeight: 700 }}>
                      ${billingCycle === 'monthly' ? (activePkg?.monthly_price ?? 0) : (activePkg?.yearly_price ?? 0)}
                    </span>/{billingCycle === 'monthly' ? 'mo' : 'yr'} after your trial expires.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={paymentLoading || (trialOption === 'none' && (!paymentMethod || !paymentProofFile))}
                style={{
                  width: '100%', padding: 14, marginTop: 4, background: '#FFD700', border: 'none',
                  borderRadius: 8, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  opacity: (paymentLoading || (trialOption === 'none' && (!paymentMethod || !paymentProofFile))) ? 0.5 : 1
                }}
              >
                {paymentLoading ? 'SUBMITTING...' : 'SUBMIT PAYMENT'}
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
