'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Activity, DollarSign, LogOut, ShieldCheck, Check, X, Bell, Eye, Settings, CreditCard, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePendingTransactions } from '@/hooks/usePendingTransactions'
import { useMarketData } from '@/hooks/useMarketData'

import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import SubAdminPaymentSettingsPanel from '@/components/sub-admin/PaymentSettingsPanel'
import { isTrialExpired } from '@/lib/trial'

// Mock Data
const INITIAL_TRADES: any[] = []
const INITIAL_FINANCIALS: any[] = []
const INITIAL_LEADS: any[] = []

type DbPackage = { id: string; key: string; label: string; monthly_price: number; yearly_price: number }

const TRIAL_OPTIONS = [
  { value: 'none',       label: 'None',        days: 0 },
  { value: 'trial_1day', label: 'Trial 1 day', days: 1 },
] as const

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
] as const

type BillingCycle = 'monthly' | 'yearly'

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
    <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', background: copied ? 'rgba(34,197,94,0.15)' : 'transparent', border: `1px solid ${copied ? '#22c55e' : '#374151'}`, color: copied ? '#22c55e' : '#9ca3af', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', width: '100%', justifyContent: 'center' }}>
      {copied ? '✓ Copied!' : '⎘ Copy Address'}
    </button>
  )
}

export default function SubAdminDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { slug } = React.use(params)
  useMarketData()


  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'monitor' | 'leads' | 'deposits' | 'withdrawals' | 'subscription' | 'payment-settings'>('monitor')
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [proofSignedUrl, setProofSignedUrl] = useState<string | null>(null)
  const [proofDownloading, setProofDownloading] = useState(false)
  const [subscriptionPayments, setSubscriptionPayments] = useState<any[]>([])
  const [dbPackages, setDbPackages] = useState<DbPackage[]>([])
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [companyProfile, setCompanyProfile] = useState<{ id: string, full_name: string, invite_token?: string, subscription_package?: string | null, expires_at?: string | null } | null>(null)

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
  // Admin payment settings (fetched when modal opens)
  const [adminPaymentSettings, setAdminPaymentSettings] = useState<any>(null)
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false)

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
          const { data: company } = await (supabase as any)
            .from('profiles')
            .select('id, full_name, invite_token, subscription_package, expires_at')
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
          const { data: company } = await (supabase as any)
            .from('profiles')
            .select('id, full_name, invite_token, subscription_package, expires_at')
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

        const { data: company } = await (supabase as any)
          .from('profiles')
          .select('id, full_name, invite_token')
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
            .order('created_at', { ascending: false })
            .limit(100)

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
              status: o.status,
              profit_loss: parseFloat(o.profit_loss || '0'),
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

  useEffect(() => {
    setProofSignedUrl(null)
    if (detailModalOpen && selectedTx?.type === 'deposit' && selectedTx?.proof_of_payment_url) {
      const supabase = createClient()
      supabase.storage
        .from('payment-proofs')
        .createSignedUrl(selectedTx.proof_of_payment_url, 300)
        .then(({ data }: any) => { if (data?.signedUrl) setProofSignedUrl(data.signedUrl) })
    }
  }, [selectedTx?.id, detailModalOpen])

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

  // ── Fetch admin payment settings (used by both Subscription buttons) ──
  const fetchAdminPaymentSettings = async () => {
    if (adminPaymentSettings || adminSettingsLoading) return
    setAdminSettingsLoading(true)
    try {
      const res = await fetch('/api/payment-settings/admin')
      const json = await res.json()
      if (json.settings) setAdminPaymentSettings(json.settings)
    } catch (e) {
      console.error('Failed to load admin payment settings:', e)
    } finally {
      setAdminSettingsLoading(false)
    }
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


  const handleDownloadProof = async () => {
    if (!proofSignedUrl) return
    setProofDownloading(true)
    try {
      const response = await fetch(proofSignedUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('pdf') ? 'pdf' : 'jpg'
      link.download = `proof-${selectedTx?.id?.slice(0, 8) ?? 'payment'}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
    } catch (err) {
      console.error('Download failed:', err)
      window.open(proofSignedUrl, '_blank')
    } finally {
      setProofDownloading(false)
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

  const trialExpired = isTrialExpired(companyProfile ?? {})

  const TransactionDetailModal = () => {
    const tx = selectedTx
    if (!detailModalOpen || !tx) return null
    const isDeposit = tx.type === 'deposit'
    const isWithdrawal = tx.type === 'withdrawal'
    const row = (label: string, value: any) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1f1f1f', padding: '10px 0', gap: '16px' }}>
        <span style={{ color: '#9ca3af', fontSize: '13px', minWidth: '130px' }}>{label}</span>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600', textAlign: 'right', wordBreak: 'break-all' }}>{value ?? '—'}</span>
      </div>
    )
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        onClick={() => setDetailModalOpen(false)}>
        <div style={{ background: '#0f0f0f', border: '1px solid #FFD700', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                {isDeposit ? '↓ Deposit Details' : '↑ Withdrawal Details'}
              </h2>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0' }}>
                {isDeposit ? 'Deposit' : 'Withdraw'} Via {tx.payment_method?.toUpperCase() || '—'}
              </p>
            </div>
            <button onClick={() => setDetailModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>TRANSACTION INFO</div>
              {row('Date', new Date(tx.created_at).toLocaleString())}
              {row('Transaction ID', tx.id?.slice(0, 16) + '...')}
              {row('Client', tx.profiles?.full_name || tx.profiles?.email || '—')}
              {row('Method', tx.payment_method?.toUpperCase())}
              {row('Amount', `$${Number(tx.amount).toFixed(2)} USD`)}
              {row('Status', <span style={{ color: tx.status === 'approved' ? '#22c55e' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b', fontWeight: 'bold', textTransform: 'uppercase' }}>{tx.status}</span>)}
            </div>
            <div style={{ flex: 1, minWidth: '240px' }}>
              {isWithdrawal && (
                <>
                  <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>USER WITHDRAW INFORMATION</div>
                  {tx.payment_method?.toLowerCase().includes('usdt') && <>
                    {row('Network', tx.payment_details?.network || 'TRC20')}
                    {row('Amount', `$${Number(tx.amount).toFixed(2)}`)}
                    {tx.destination_address ? (
                      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '12px 0' }}>
                        <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '8px' }}>Wallet Address</div>
                        <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px', color: '#FFD700', wordBreak: 'break-all', lineHeight: '1.6', letterSpacing: '0.3px', marginBottom: '8px' }}>{tx.destination_address}</div>
                        <CopyAddressButton address={tx.destination_address} />
                      </div>
                    ) : row('Wallet Address', '—')}
                  </>}
                  {tx.payment_method?.toLowerCase().includes('btc') && <>
                    {row('Amount', `$${Number(tx.amount).toFixed(2)}`)}
                    {tx.destination_address ? (
                      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '12px 0' }}>
                        <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '8px' }}>BTC Address</div>
                        <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px', color: '#FFD700', wordBreak: 'break-all', lineHeight: '1.6', letterSpacing: '0.3px', marginBottom: '8px' }}>{tx.destination_address}</div>
                        <CopyAddressButton address={tx.destination_address} />
                      </div>
                    ) : row('BTC Address', '—')}
                  </>}
                  {tx.payment_method?.toLowerCase().includes('bank') && <>
                    {row('Bank Name', tx.payment_details?.bank_name)}
                    {row('Account Holder', tx.payment_details?.account_holder)}
                    {tx.payment_details?.iban ? (
                      <div style={{ borderBottom: '1px solid #1f1f1f', padding: '12px 0' }}>
                        <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '8px' }}>RIB / IBAN</div>
                        <div style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px', color: '#FFD700', wordBreak: 'break-all', lineHeight: '1.6', marginBottom: '8px' }}>{tx.payment_details.iban}</div>
                        <CopyAddressButton address={tx.payment_details.iban} />
                      </div>
                    ) : row('RIB / IBAN', '—')}
                  </>}
                  {!tx.destination_address && !tx.payment_details && (
                    <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '12px' }}>No destination info provided by client.</p>
                  )}
                </>
              )}
              {isDeposit && (
                <>
                  <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px' }}>USER DEPOSIT INFORMATION</div>
                  {proofSignedUrl ? (
                    <div style={{ marginTop: '8px' }}>
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>Payment Proof:</p>
                      <img src={proofSignedUrl} alt="Payment Proof" style={{ width: '100%', borderRadius: '8px', border: '1px solid #333', maxHeight: '220px', objectFit: 'contain', background: '#1a1a1a', display: 'block' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <a href={proofSignedUrl} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: 'transparent', border: '1px solid #374151', color: '#9ca3af', borderRadius: '6px', fontSize: '12px', textDecoration: 'none' }}>↗ Open</a>
                        <button onClick={handleDownloadProof} disabled={proofDownloading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', background: proofDownloading ? '#b8950a' : '#FFD700', border: 'none', color: '#000', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: proofDownloading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>{proofDownloading ? '...' : '↓ Download'}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '12px', padding: '24px', background: '#111', borderRadius: '8px', border: '1px dashed #333', textAlign: 'center' }}>
                      <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>No payment proof uploaded.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {tx.status === 'pending' && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button onClick={async () => { await handleFinancialAction(tx.id, 'approve'); setDetailModalOpen(false) }} style={{ flex: 1, padding: '12px', background: 'transparent', border: '2px solid #22c55e', color: '#22c55e', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                ✓ Approve
              </button>
              <button onClick={async () => { await handleFinancialAction(tx.id, 'reject'); setDetailModalOpen(false) }} style={{ flex: 1, padding: '12px', background: 'transparent', border: '2px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                ✕ Reject
              </button>
            </div>
          )}
          {tx.status !== 'pending' && (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginTop: '20px' }}>This transaction has been {tx.status}.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      background: '#0b0e11', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', overflow: 'auto'
    }}>
      <TransactionDetailModal />

      {trialExpired && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: '#0f0f0f',
            border: '1px solid #FFD700',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <h2 style={{ color: '#FFD700', fontSize: '22px', fontWeight: 'bold', margin: '0 0 12px' }}>
              Trial Period Expired
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px' }}>
              Your 24-hour free trial has ended.
              Upgrade your subscription to continue accessing the platform.
            </p>
            <button
              onClick={() => setActiveTab('subscription')}
              style={{
                width: '100%', padding: '14px',
                background: '#FFD700', color: '#000',
                border: 'none', borderRadius: '8px',
                fontSize: '15px', fontWeight: 'bold',
                cursor: 'pointer', letterSpacing: '0.5px',
              }}>
              🚀 Upgrade Now
            </button>
            <p style={{ color: '#4b5563', fontSize: '12px', marginTop: '16px' }}>
              Need help? Contact your platform administrator.
            </p>
          </div>
        </div>
      )}

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
            <h1 style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.1em', margin: 0 }}>{companyProfile?.full_name || 'Nokhba'}</h1>
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

          <button onClick={async () => {
            setIsPaymentModalOpen(true)
            await fetchAdminPaymentSettings()
          }} style={{
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

      {companyProfile?.subscription_package === 'Trial_1day' && !trialExpired && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '10px 20px',
          margin: '12px 24px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>
            ⚠️ Trial Mode — Your free trial expires 24 hours from activation. Upgrade to keep full access.
          </span>
          <button
            onClick={() => setActiveTab('subscription')}
            style={{
              padding: '6px 16px', background: 'transparent',
              border: '1px solid #f59e0b', color: '#f59e0b',
              borderRadius: '6px', fontSize: '12px',
              fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            Upgrade
          </button>
        </div>
      )}

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>

        {/* ── Sidebar CRM Navigation ── */}
        <div style={{
          width: 240, flexShrink: 0, overflowY: 'hidden', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)',
          display: 'flex', flexDirection: 'column', gap: 4, padding: '20px 10px'
        }}>
          {[
            { id: 'monitor', icon: Activity, label: t.trade_monitor },
            { id: 'leads', icon: Users, label: t.clients },
            { id: 'deposits', icon: ArrowDownCircle, label: 'Deposits' },
            { id: 'withdrawals', icon: ArrowUpCircle, label: 'Withdrawals' },
            { id: 'subscription', icon: CreditCard, label: 'Subscription' },
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
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => router.push(`/sub-admin/${slug}/profile`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                borderRadius: 8, border: '1px solid rgba(255,215,0,0.2)', cursor: 'pointer', textAlign: 'left', width: '100%',
                background: 'transparent', color: '#FFD700',
                fontSize: 13, fontWeight: 600, transition: 'all 0.15s'
              }}
            >
              <Settings size={18} strokeWidth={1.5} />
              My Profile
            </button>
          </div>
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
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>NAME</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>ASSET & TYPE</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>P&amp;L</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600 }}>DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No trades on record.</td></tr>
                      ) : trades.map((trade) => (
                        <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', color: '#fff' }}>{trade.userName}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{trade.asset}</span>
                            {' '}
                            <span style={{
                              background: trade.type === 'Buy' ? '#22c55e' : '#ef4444',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                            }}>
                              {trade.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#fff' }}>
                            ${Number(trade.amount).toFixed(2)}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: Number(trade.profit_loss) >= 0 ? '#22c55e' : '#ef4444',
                            fontWeight: 'bold',
                          }}>
                            {Number(trade.profit_loss) >= 0 ? '+' : ''}
                            {Number(trade.profit_loss || 0).toFixed(2)} USD
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              background: trade.status === 'open' ? '#22c55e22' : '#6b728022',
                              color: trade.status === 'open' ? '#22c55e' : '#9ca3af',
                              border: `1px solid ${trade.status === 'open' ? '#22c55e' : '#6b7280'}`,
                              borderRadius: '4px',
                              padding: '2px 10px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                            }}>
                              {trade.status === 'open' ? 'OPEN' : 'CLOSED'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => router.push(`/sub-admin/${slug}/client/${trade.userId}`)}
                              style={{
                                background: 'transparent',
                                border: '1px solid #FFD700',
                                color: '#FFD700',
                                borderRadius: '4px',
                                padding: '4px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                              }}
                            >
                              DETAILS
                            </button>
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
                    <Users size={16} strokeWidth={2.5} /> {t.add_client}
                  </button>
                </div>

                {/* ── Invite Link ── */}
                <div style={{
                  background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: 8, padding: '16px 18px', marginBottom: 20,
                }}>
                  <div style={{ color: '#FFD700', fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', marginBottom: 10 }}>📨 TRADER INVITE LINK</div>
                  <div style={{ color: '#8a8e9b', fontSize: 12, marginBottom: 12 }}>
                    Share this link — traders who register via it are automatically assigned to your account.
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      readOnly
                      onClick={e => (e.target as HTMLInputElement).select()}
                      value={companyProfile?.invite_token
                        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?invite=${companyProfile.invite_token}`
                        : 'Loading…'}
                      style={{
                        flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)',
                        color: '#c0c3ce', padding: '9px 12px', borderRadius: 6,
                        fontFamily: 'monospace', fontSize: 12, outline: 'none',
                      }}
                    />
                    <button
                      disabled={!companyProfile?.invite_token}
                      onClick={() => {
                        const link = `${window.location.origin}/register?invite=${companyProfile!.invite_token}`
                        navigator.clipboard.writeText(link).then(() => alert('Invite link copied!')).catch(() => alert(link))
                      }}
                      style={{
                        background: companyProfile?.invite_token ? '#FFD700' : '#555', color: '#000', border: 'none', borderRadius: 6,
                        padding: '9px 20px', cursor: companyProfile?.invite_token ? 'pointer' : 'not-allowed',
                        fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      Copy Link
                    </button>
                  </div>
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
                        {[t.full_name, t.email, t.phone_number, t.country, `${t.balance} (USD)`, 'REG DATE', t.status, t.actions].map(col => (
                          <th key={col} style={{ padding: '13px 14px', fontWeight: 700, color: '#FFD700', fontSize: 10, letterSpacing: '0.08em', whiteSpace: 'nowrap', userSelect: 'none' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: 50, textAlign: 'center', color: '#8a8e9b', background: 'rgba(255,255,255,0.01)' }}>
                            {searchQuery ? 'No clients match your search.' : 'No clients registered under your account yet.'}
                          </td>
                        </tr>
                      ) : filteredClients.map((trader, i) => {
                        const balance = Number((trader.wallets as any)?.[0]?.balance || 0)
                        const isVisible = visiblePasswords.has(trader.id)
                        const regDate = trader.created_at ? new Date(trader.created_at).toLocaleDateString('en-GB') : '—'
                        const passwordDisplay = '—'
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

            {/* ── Deposits Tab ── */}
            {activeTab === 'deposits' && (
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>DEPOSIT REQUESTS</h2>
                  <span style={{ background: '#1a1a1a', border: '1px solid #333', color: '#9ca3af', borderRadius: '20px', padding: '4px 14px', fontSize: '13px' }}>
                    {allTransactions.filter((t: any) => t.type === 'deposit' && t.status === 'pending').length} Pending
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        {['DATE', 'CLIENT', 'AMOUNT', 'METHOD', 'STATUS', 'DETAIL'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions.filter((t: any) => t.type === 'deposit').map((tx: any) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #111', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 14px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 14px', color: '#fff' }}>{tx.profiles?.full_name || tx.profiles?.email || '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#fff', fontWeight: '600' }}>${Number(tx.amount).toFixed(2)}<span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>USD</span></td>
                          <td style={{ padding: '12px 14px', color: '#9ca3af' }}>{tx.payment_method?.toUpperCase() || '—'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', background: tx.status === 'approved' ? 'rgba(34,197,94,0.15)' : tx.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: tx.status === 'approved' ? '#22c55e' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b', border: `1px solid ${tx.status === 'approved' ? '#22c55e' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b'}` }}>{tx.status}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button onClick={() => { setSelectedTx(tx); setDetailModalOpen(true) }} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>DETAIL</button>
                          </td>
                        </tr>
                      ))}
                      {allTransactions.filter((t: any) => t.type === 'deposit').length === 0 && (
                        <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#4b5563', fontSize: '14px' }}>No deposit requests</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Withdrawals Tab ── */}
            {activeTab === 'withdrawals' && (
              <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>WITHDRAWAL REQUESTS</h2>
                  <span style={{ background: '#1a1a1a', border: '1px solid #333', color: '#9ca3af', borderRadius: '20px', padding: '4px 14px', fontSize: '13px' }}>
                    {allTransactions.filter((t: any) => t.type === 'withdrawal' && t.status === 'pending').length} Pending
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #222' }}>
                        {['DATE', 'CLIENT', 'AMOUNT', 'METHOD', 'DESTINATION', 'STATUS', 'DETAIL'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allTransactions.filter((t: any) => t.type === 'withdrawal').map((tx: any) => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #111' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 14px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 14px', color: '#fff' }}>{tx.profiles?.full_name || tx.profiles?.email || '—'}</td>
                          <td style={{ padding: '12px 14px', color: '#fff', fontWeight: '600' }}>${Number(tx.amount).toFixed(2)}<span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '4px' }}>USD</span></td>
                          <td style={{ padding: '12px 14px', color: '#9ca3af' }}>{tx.payment_method?.toUpperCase() || '—'}</td>
                          <td style={{ padding: '12px 14px', maxWidth: '180px' }}>
                            {tx.destination_address ? (
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#FFD700', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={tx.destination_address}>
                                {tx.destination_address.slice(0, 10)}...{tx.destination_address.slice(-6)}
                              </span>
                            ) : tx.payment_details?.bank_name ? (
                              <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                                <div style={{ color: '#fff' }}>{tx.payment_details.bank_name}</div>
                                <div style={{ color: '#9ca3af' }}>{tx.payment_details.account_holder}</div>
                                <div style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tx.payment_details.iban?.slice(0, 12)}...</div>
                              </div>
                            ) : (
                              <span style={{ color: '#4b5563' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', background: tx.status === 'approved' ? 'rgba(34,197,94,0.15)' : tx.status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: tx.status === 'approved' ? '#22c55e' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b', border: `1px solid ${tx.status === 'approved' ? '#22c55e' : tx.status === 'rejected' ? '#ef4444' : '#f59e0b'}` }}>{tx.status}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button onClick={() => { setSelectedTx(tx); setDetailModalOpen(true) }} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>DETAIL</button>
                          </td>
                        </tr>
                      ))}
                      {allTransactions.filter((t: any) => t.type === 'withdrawal').length === 0 && (
                        <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#4b5563', fontSize: '14px' }}>No withdrawal requests</td></tr>
                      )}
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
                    onClick={async () => {
                      setIsPaymentModalOpen(true)
                      await fetchAdminPaymentSettings()
                    }}
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

            {/* ── Payment Settings ── */}
            {activeTab === 'payment-settings' && (
              <div className="crm-section fade-in" style={{ padding: 24 }}>
                <SubAdminPaymentSettingsPanel />
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

              {/* BILLING CYCLE — hidden for trial */}
              {trialOption === 'none' && <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8a8e9b', marginBottom: 6 }}>BILLING CYCLE</label>
                <select
                  value={billingCycle}
                  onChange={e => setBillingCycle(e.target.value as BillingCycle)}
                  style={{ width: '100%', padding: '12px 16px', background: 'rgba(20,22,28,1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23FFFFFF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: 40 }}
                >
                  {BILLING_CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>}

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

              {/* Dynamic payment details panel — fetched from Admin payment_settings */}
              {trialOption === 'none' && adminSettingsLoading && (
                <div style={{ padding: 16, textAlign: 'center', color: '#8a8e9b', fontSize: 12 }}>
                  ⏳ Loading payment details...
                </div>
              )}

              {trialOption === 'none' && !adminSettingsLoading && !adminPaymentSettings && paymentMethod && (
                <div style={{ background: 'rgba(239,83,80,0.05)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#ef5350', fontWeight: 600 }}>⚠ Payment details not configured yet</div>
                  <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>Please contact the platform administrator.</div>
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'bank_transfer' && adminPaymentSettings?.bank_is_active && (
                <div style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', marginBottom: 12, letterSpacing: '0.05em' }}>🏦 BANK TRANSFER DETAILS</div>
                  {adminPaymentSettings.bank_name ? (
                    <div style={{ fontSize: 12, color: '#c0c3ce', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><span style={{ color: '#8a8e9b', marginRight: 8 }}>Bank:</span>{adminPaymentSettings.bank_name}</div>
                      {adminPaymentSettings.bank_account_holder && (
                        <div><span style={{ color: '#8a8e9b', marginRight: 8 }}>Account Name:</span>{adminPaymentSettings.bank_account_holder}</div>
                      )}
                      {adminPaymentSettings.bank_rib && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: '#8a8e9b' }}>RIB / IBAN:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{adminPaymentSettings.bank_rib}</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(adminPaymentSettings.bank_rib)}
                            style={{ background: '#FFD700', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>COPY</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#8a8e9b' }}>Bank details not configured. Contact admin.</div>
                  )}
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'bank_transfer' && adminPaymentSettings && !adminPaymentSettings.bank_is_active && (
                <div style={{ background: 'rgba(239,83,80,0.05)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#ef5350', fontWeight: 600 }}>⚠ Bank Transfer is currently disabled</div>
                  <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>Please choose another payment method.</div>
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_usdt' && adminPaymentSettings?.usdt_is_active && (
                <div style={{ background: 'rgba(38,166,154,0.05)', border: '1px solid rgba(38,166,154,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#26a69a', marginBottom: 12, letterSpacing: '0.05em' }}>💎 USDT ({adminPaymentSettings.usdt_network || 'TRC20'}) DETAILS</div>
                  {adminPaymentSettings.usdt_address ? (
                    <div style={{ fontSize: 12, color: '#c0c3ce', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><span style={{ color: '#8a8e9b', marginRight: 8 }}>Network:</span>{adminPaymentSettings.usdt_network || 'TRC20'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#8a8e9b' }}>Address:</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{adminPaymentSettings.usdt_address}</span>
                        <button type="button" onClick={() => navigator.clipboard.writeText(adminPaymentSettings.usdt_address)}
                          style={{ background: '#26a69a', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>COPY</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#8a8e9b' }}>USDT address not configured. Contact admin.</div>
                  )}
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_usdt' && adminPaymentSettings && !adminPaymentSettings.usdt_is_active && (
                <div style={{ background: 'rgba(239,83,80,0.05)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#ef5350', fontWeight: 600 }}>⚠ USDT payments are currently disabled</div>
                  <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>Please choose another payment method.</div>
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_btc' && adminPaymentSettings?.btc_is_active && (
                <div style={{ background: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF9800', marginBottom: 12, letterSpacing: '0.05em' }}>₿ BITCOIN (BTC) DETAILS</div>
                  {adminPaymentSettings.btc_address ? (
                    <div style={{ fontSize: 12, color: '#c0c3ce', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div><span style={{ color: '#8a8e9b', marginRight: 8 }}>Network:</span>Bitcoin (BTC)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#8a8e9b' }}>Address:</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, wordBreak: 'break-all' }}>{adminPaymentSettings.btc_address}</span>
                        <button type="button" onClick={() => navigator.clipboard.writeText(adminPaymentSettings.btc_address)}
                          style={{ background: '#FF9800', color: '#000', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>COPY</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#8a8e9b' }}>BTC address not configured. Contact admin.</div>
                  )}
                </div>
              )}

              {trialOption === 'none' && paymentMethod === 'crypto_btc' && adminPaymentSettings && !adminPaymentSettings.btc_is_active && (
                <div style={{ background: 'rgba(239,83,80,0.05)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#ef5350', fontWeight: 600 }}>⚠ Bitcoin payments are currently disabled</div>
                  <div style={{ fontSize: 11, color: '#8a8e9b', marginTop: 4 }}>Please choose another payment method.</div>
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
                    <span style={{ color: '#FFD700', fontWeight: 700 }}>$0</span>{' '}
                    after your trial expires.
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
