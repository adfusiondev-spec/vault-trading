'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, ArrowUpCircle, ArrowDownCircle, ShieldCheck, Search, ShieldAlert, FileText, CheckCircle2, Activity, User, ArrowLeft, Phone, Mail } from 'lucide-react'
import { PasswordField } from '@/components/PasswordField'
import { createClient } from '@/lib/supabase/client'
import { useMarketData } from '@/hooks/useMarketData'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'

type Order = {
  id: string
  symbol: string
  asset: string // kept for simple UI mapping
  label: string
  type: 'Buy' | 'Sell' | string
  amountUSD: number
  qty: number
  entryPrice: number
  pnl: number
  status: string
  timestamp: number
}

export default function ClientDetailsPage({ params }: { params: Promise<{ slug: string, id: string }> }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { id, slug } = React.use(params)
  const [mounted, setMounted] = useState(false)
  
  // Auth State
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [viewerRole, setViewerRole] = useState<string>('')
  
  // State
  const [balance, setBalance] = useState(0)
  const [clientName, setClientName] = useState('Loading...')
  const [clientEmail, setClientEmail] = useState('')
  const [asset, setAsset] = useState('BTCUSDT') // match binance formatting
  const [tradeAmount, setTradeAmount] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [clientTxs, setClientTxs] = useState<any[]>([])
  const [allRawTrades, setAllRawTrades] = useState<any[]>([])
  const [leadStatus, setLeadStatus] = useState('New Prospect')
  const [notes, setNotes] = useState('')
  const [clientUUID, setClientUUID] = useState<string | null>(null)

  // Edit & Security state
  const [editForm, setEditForm] = useState({ full_name: '', phone_number: '', country: '' })
  const [newPassword, setNewPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjType, setAdjType] = useState<'credit' | 'debit'>('credit')
  const [adjNote, setAdjNote] = useState('')
  const [adjLoading, setAdjLoading] = useState(false)
const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [togglingBan, setTogglingBan] = useState(false)

  const { prices } = useMarketData()
  const livePrice = prices[asset]?.price || 0

  const clientId = decodeURIComponent(id)

  const syncData = React.useCallback(async () => {
    const supabase = createClient()
    setLoading(true)
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', clientId).single()
      if (profileError) throw profileError
      setClientName(profileData.full_name || profileData.email || 'Loading...')
      setClientEmail(profileData.email || '')
      setEditForm({
        full_name: profileData.full_name || '',
        phone_number: profileData.phone_number || '',
        country: profileData.country || ''
      })
      setIsBanned(!!profileData.is_banned)
      if (profileData.notes) setNotes(profileData.notes)
      if ((profileData as any).lead_status) setLeadStatus((profileData as any).lead_status)
      setClientUUID(clientId)

      const { data: walletData } = await supabase
        .from('wallets').select('*').eq('user_id', clientId).single()
      setBalance(walletData?.balance ? parseFloat(walletData.balance) : 0)

      const { data: tradesData } = await supabase
        .from('trades').select('*').eq('user_id', clientId)
        .order('created_at', { ascending: false })
      if (tradesData) {
        setAllRawTrades(tradesData)
        const formattedTrades = tradesData.map((o: any) => {
          const entryPrice = parseFloat(o.entry_price || '0')
          const amount = parseFloat(o.amount || '0')
          return {
            id: o.id, symbol: o.symbol, asset: o.symbol, label: o.symbol,
            type: o.type === 'buy' ? 'Buy' : 'Sell',
            amountUSD: amount, qty: entryPrice > 0 ? amount / entryPrice : 0,
            entryPrice, timestamp: new Date(o.created_at).getTime(),
            status: o.status === 'open' ? 'Open' : (o.status === 'closed' ? 'Completed' : 'Cancelled'),
            pnl: parseFloat(o.profit_loss || '0'),
          }
        })
        setOrders(formattedTrades.filter((t: any) => t.status === 'Open'))
      }

      const { data: txData } = await supabase
        .from('transactions').select('*').eq('user_id', clientId)
      setClientTxs(txData || [])
    } catch (err) {
      console.error('syncData error:', err)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  const loadClientData = React.useCallback(async () => {
    const supabase = createClient()
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', clientId)
      .single()
    
    setBalance(wallet?.balance ? parseFloat(wallet.balance) : 0)
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone_number, country, notes, is_banned')
      .eq('id', clientId)
      .maybeSingle()
    
    if (profile) {
      setClientName(profile.full_name || profile.email || 'Loading...')
      setClientEmail(profile.email || '')
      setEditForm({
        full_name: profile.full_name || '',
        phone_number: profile.phone_number || '',
        country: profile.country || ''
      })
      setIsBanned(!!profile.is_banned)
      if (profile.notes) setNotes(profile.notes)
      if ((profile as any).lead_status) setLeadStatus((profile as any).lead_status)
      setClientUUID(clientId)
    }

    // Sync Trades
    const { data: oData } = await supabase.from('trades').select('*').eq('user_id', clientId).order('created_at', { ascending: false })
    if (oData) {
      setAllRawTrades(oData)
      const formattedTrades = oData.map((o: any) => {
        const entryPrice = parseFloat(o.entry_price || '0')
        const amount = parseFloat(o.amount || '0')
        return {
          id: o.id,
          symbol: o.symbol,
          asset: o.symbol,
          label: o.symbol,
          type: o.type === 'buy' ? 'Buy' : 'Sell',
          amountUSD: amount,
          qty: entryPrice > 0 ? amount / entryPrice : 0,
          entryPrice: entryPrice,
          timestamp: new Date(o.created_at).getTime(),
          status: o.status === 'open' ? 'Open' : (o.status === 'closed' ? 'Completed' : 'Cancelled'),
          pnl: parseFloat(o.profit_loss || '0'),
        }
      })
      setOrders(formattedTrades.filter((t: any) => t.status === 'Open'))
    }

    const { data: txData } = await supabase
      .from('transactions').select('*').eq('user_id', clientId)
    setClientTxs(txData || [])
  }, [clientId])

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

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        
        // Allow sub_admin, super_admin, or sales
        if (!profile || (profile.role !== 'sub_admin' && profile.role !== 'super_admin' && profile.role !== 'sales')) {
          if (profile?.role === 'trader' || profile?.role === 'user') router.push('/user')
          else router.push('/login')
          return
        }
        setViewerRole(profile.role)
        setIsAuthorized(true)
      } catch (e) {
        console.error('Auth error:', e)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()

    loadClientData()

    const tradesChannel = supabase.channel('trades-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trades',
        filter: `user_id=eq.${clientId}`
      }, () => {
        loadClientData()
      })
      .subscribe()

    const walletChannel = supabase.channel('wallet-sync-admin')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${clientId}`
      }, () => {
        loadClientData()
      })
      .subscribe()

    // Refresh clientTxs (and thus totalDeposits/totalWithdrawals) whenever
    // a transaction changes status (e.g. pending → approved)
    const txChannel = supabase.channel('client-tx-sync')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${clientId}`
      }, () => {
        loadClientData()
      })
      .subscribe()

    return () => {
        supabase.removeChannel(tradesChannel)
        supabase.removeChannel(walletChannel)
        supabase.removeChannel(txChannel)
    }
  }, [router, clientId, loadClientData])

  const clientStats = useMemo(() => {
    const totalDeposits = clientTxs
      .filter((tx: any) => tx.type === 'deposit' && tx.status === 'approved')
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0)
    const totalWithdrawals = clientTxs
      .filter((tx: any) => tx.type === 'withdrawal' && tx.status === 'approved')
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0)
    const closedTrades = allRawTrades.filter((t: any) => t.status === 'closed')
    const totalPnL = closedTrades.reduce((sum: number, t: any) => sum + Number(t.profit_loss || 0), 0)
    const openTradesCount = allRawTrades.filter((t: any) => t.status === 'open').length
    return { totalDeposits, totalWithdrawals, totalPnL, openTradesCount }
  }, [clientTxs, allRawTrades])

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

  const handleTrade = async (type: 'Buy' | 'Sell') => {
    const amountNum = parseFloat(tradeAmount)
    if (!amountNum || amountNum <= 0) return alert('Enter a valid amount')
    
    const supabase = createClient()
    if (!clientId) return alert('User ID not resolved.')

    const { data: rpcData, error: rpcError } = await supabase.rpc('execute_trade', {
      p_user_id: clientId,
      p_symbol: asset,
      p_amount: amountNum,
      p_type: type.toLowerCase(),
      p_entry_price: livePrice > 0 ? livePrice : 65000
    })

    if (rpcError) {
      alert(`Trade failed: ${rpcError.message}`)
    } else if (rpcData && !rpcData.success) {
      alert(`Trade rejected: ${rpcData.message}`)
    } else {
      setTradeAmount('')
      loadClientData() // Refresh data immediately
    }
  }

  const handleSaveCRMNotes = async () => {
    const supabase = createClient()
    if (!clientUUID) return alert('User ID not resolved.')
    const uid = clientUUID
    const { error } = await supabase.from('profiles').update({ notes }).eq('id', uid)
    if (error) alert('Failed to save notes: ' + error.message)
    else alert('CRM notes saved successfully.')
  }

  const handleUpdateProfile = async () => {
    if (!clientUUID) return alert('User ID not resolved.')
    setSavingProfile(true)
    try {
      const res = await fetch('/api/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: clientUUID,
          action: 'update_profile',
          data: { full_name: editForm.full_name, phone_number: editForm.phone_number, country: editForm.country }
        })
      })
      const result = await res.json()
      if (!res.ok) alert('Error: ' + result.error)
      else { setClientName(editForm.full_name || clientName); alert('Profile updated successfully.') }
    } catch { alert('Network error.') }
    setSavingProfile(false)
  }

  const handleChangePassword = async () => {
    if (!clientUUID) return alert('User ID not resolved.')
    if (!newPassword.trim() || newPassword.length < 6) return alert('Password must be at least 6 characters.')
    setSavingPassword(true)
    try {
      const res = await fetch('/api/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: clientUUID, action: 'update_password', data: { password: newPassword } })
      })
      const result = await res.json()
      if (!res.ok) alert('Error: ' + result.error)
      else { setNewPassword(''); alert('Password updated successfully.') }
    } catch { alert('Network error.') }
    setSavingPassword(false)
  }

  const handleToggleBan = async () => {
    if (!clientUUID) return alert('User ID not resolved.')
    const willBan = !isBanned
    if (!confirm(willBan
      ? 'BAN this client? They will be unable to log in until unbanned.'
      : 'UNBAN this client and restore their access?')) return
    setTogglingBan(true)
    try {
      const res = await fetch('/api/update-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: clientUUID, action: 'toggle_ban', data: { ban: willBan } })
      })
      const result = await res.json()
      if (!res.ok) alert('Error: ' + result.error)
      else setIsBanned(willBan)
    } catch { alert('Network error.') }
    setTogglingBan(false)
  }

  const clientIdStr = id ? decodeURIComponent(id) : 'client'
  const displayEmail = clientEmail || (clientIdStr.includes('@') ? clientIdStr : `${clientIdStr.substring(0, 8)}...`)

  return (
    <div className="nk-dashboard-shell" style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      background: '#0b0e11', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff', overflow: 'hidden'
    }}>
      
      {/* ── Top Header ── */}
      <div className="nk-dashboard-header" style={{
        height: 70, flexShrink: 0, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', background: 'rgba(11,14,17,0.95)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={() => router.push(viewerRole === 'sales' ? `/sub-admin/${slug}/sales` : `/sub-admin/${slug}`)} style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s'
          }}>
            <ArrowLeft size={16} /> {t.back_to_crm}
          </button>
          <div style={{ paddingLeft: 20, borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(38,166,154,0.1)', border: '1px solid #26a69a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#26a69a" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '0.05em', color: '#fff' }}>{clientName}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <span style={{ color: '#26a69a', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>{displayEmail}</span>
                <span style={{ color: '#26a69a', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> {t.verified_client}</span>
                <span style={{ color: '#8a8e9b', fontSize: 11 }}>ID: {clientIdStr.toUpperCase().substring(0, 8)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <LanguageToggle />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#8a8e9b', fontSize: 11, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 2 }}>{t.current_balance}</div>
            <div style={{ color: '#FFD700', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="nk-dashboard-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        
        {/* ── Center: Admin Execution Terminal ── */}
        <div className="nk-client-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#06080a', overflowY: 'auto', padding: 30, borderRight: '1px solid var(--border)' }}>

          {/* Quick Stats Grid */}
          <div className="nk-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 30 }}>
            {[
              { label: t.total_deposits, value: `$${clientStats.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#FFD700' },
              { label: t.total_withdrawals, value: `$${clientStats.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#FFD700' },
              { label: t.closed_trades_pnl, value: `${clientStats.totalPnL >= 0 ? '+' : ''}$${Math.abs(clientStats.totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: clientStats.totalPnL >= 0 ? '#22c55e' : '#ef4444' },
              { label: t.open_trades, value: String(clientStats.openTradesCount), color: '#FFD700' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#0a0a0a', border: '1px solid #FFD700', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, fontFamily: 'monospace' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="fade-in">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#FFD700', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={20} /> {t.portfolio_terminal}
            </h2>

            {/* Execution Bar */}
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: 24,
              display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 40, boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>ASSET</label>
                <select value={asset} onChange={(e) => setAsset(e.target.value)} style={{
                  width: '100%', padding: '12px 16px', borderRadius: 6, background: '#0b0e11', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: 14, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none'
                }}>
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="XAUUSD">XAU/USD</option>
                  <option value="EURUSD">EUR/USD</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>MOCK MARKET PRICE</label>
                <div style={{ width: '100%', padding: '12px 16px', borderRadius: 6, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', color: livePrice > 0 ? '#FFD700' : '#8a8e9b', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                  {livePrice > 0 ? `$${livePrice.toLocaleString()}` : 'Live Rate Managed by HQ'}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>AMOUNT (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 16, top: 12, color: '#8a8e9b', fontWeight: 600 }}>$</span>
                  <input type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} placeholder="0.00" style={{
                    width: '100%', padding: '12px 16px 12px 32px', borderRadius: 6, background: '#0b0e11', border: '1px solid #FFD700',
                    color: '#FFD700', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'monospace'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => handleTrade('Buy')} style={{
                  padding: '12px 30px', borderRadius: 6, background: '#26a69a', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase'
                }}>
                  BUY
                </button>
                <button onClick={() => handleTrade('Sell')} style={{
                  padding: '12px 30px', borderRadius: 6, background: '#ef5350', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase'
                }}>
                  SELL
                </button>
              </div>
            </div>

            {/* Open Positions */}
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: '#fff' }}>{t.active_open_positions}</h3>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead style={{ background: 'rgba(0,0,0,0.3)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.ticket}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.asset} & {t.type}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.amount}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>{t.profit_loss}</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>{t.admin_action}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: '#8a8e9b' }}>{t.no_active_trades}</td></tr>
                  ) : orders.map(trade => (
                    <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#8a8e9b' }}>{trade.id}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{trade.symbol || trade.asset}</span>
                        <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, background: trade.type === 'Buy' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: trade.type === 'Buy' ? '#26a69a' : '#ef5350' }}>{trade.type}</span>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#FFD700' }}>${trade.amountUSD.toLocaleString()}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: (() => { const lp = prices[trade.symbol || trade.asset]?.price || trade.entryPrice; const pnl = trade.type === 'Buy' ? (lp - trade.entryPrice) * trade.qty : (trade.entryPrice - lp) * trade.qty; return pnl >= 0 ? '#26a69a' : '#ef5350' })() }}>{(() => { const lp = prices[trade.symbol || trade.asset]?.price || trade.entryPrice; const pnl = trade.type === 'Buy' ? (lp - trade.entryPrice) * trade.qty : (trade.entryPrice - lp) * trade.qty; return <>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</> })()}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={async () => {
                            if (!confirm('Are you sure you want to close this position at market price?')) return
                            const supabase = createClient()
                            
                            const currentLivePrice = prices[trade.symbol || trade.asset]?.price || 0
                            const mockExitPrice = currentLivePrice > 0 ? currentLivePrice : trade.entryPrice * 1.02 // Fallback mock 

                            const { data, error } = await supabase.rpc('close_trade', {
                              p_trade_id: trade.id,
                              p_exit_price: mockExitPrice
                            })
                            if (error) alert('Error: ' + error.message)
                            else if (data && !data.success) alert('Failed: ' + data.message)
                            else {
                               alert('Position closed successfully.')
                               syncData()
                            }
                          }}
                          style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)',
                          color: '#ef5350', padding: '6px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer'
                        }}>
                          <ShieldAlert size={14} /> EMERGENCY CLOSE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          {/* Transaction History */}
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '32px 0 16px', color: '#fff' }}>Transaction History</h3>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ background: 'rgba(0,0,0,0.3)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>AMOUNT</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>DESTINATION</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {clientTxs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No transactions yet.</td></tr>
                ) : clientTxs.map((tx: any) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: tx.status !== 'pending' ? 0.75 : 1 }}>
                    <td style={{ padding: '10px 16px', color: '#8a8e9b', fontSize: 11 }}>
                      {new Date(tx.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: tx.type === 'deposit' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: tx.type === 'deposit' ? '#26a69a' : '#ef5350' }}>
                        {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>${Number(tx.amount).toLocaleString()}</td>
                    <td style={{ padding: '10px 16px', maxWidth: 180 }}>
                      {tx.type === 'withdrawal' && (tx.destination_address || tx.payment_details) ? (
                        <div style={{ fontSize: 11, color: '#ccc' }}>
                          {tx.payment_details ? (
                            <>
                              {tx.payment_details.bank_name && <div style={{ color: '#8a8e9b' }}>{tx.payment_details.bank_name}</div>}
                              {tx.payment_details.account_holder && <div>{tx.payment_details.account_holder}</div>}
                              {tx.payment_details.iban && <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#FFD700' }}>{tx.payment_details.iban}</div>}
                            </>
                          ) : (
                            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#FFD700', wordBreak: 'break-all' }}>{tx.destination_address}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#555', fontSize: 10 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                        background: tx.status === 'approved' ? 'rgba(38,166,154,0.1)' : tx.status === 'rejected' ? 'rgba(239,83,80,0.1)' : 'rgba(255,215,0,0.1)',
                        color: tx.status === 'approved' ? '#26a69a' : tx.status === 'rejected' ? '#ef5350' : '#FFD700',
                        border: `1px solid ${tx.status === 'approved' ? 'rgba(38,166,154,0.3)' : tx.status === 'rejected' ? 'rgba(239,83,80,0.3)' : 'rgba(255,215,0,0.3)'}`
                      }}>
                        {tx.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          </div>
        </div>

        {/* ── Right: CRM + Edit + Security ── */}
        <div className="nk-client-panel" style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(11,14,17,0.98)', borderLeft: '1px solid var(--border)', overflowY: 'auto' }}>
          
          {/* Ban Warning Banner */}
          {isBanned && (
            <div style={{ padding: '12px 24px', background: 'rgba(239,83,80,0.1)', borderBottom: '1px solid rgba(239,83,80,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={16} color="#ef5350" />
              <span style={{ color: '#ef5350', fontSize: 12, fontWeight: 700 }}>THIS CLIENT IS BANNED</span>
            </div>
          )}

          {/* SALES & CRM */}
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.05em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={16} color="#FFD700" /> {t.sales_crm}
            </h2>
            
            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>LEAD STATUS</label>
            <select
              value={leadStatus}
              onChange={async (e) => {
                const newStatus = e.target.value
                setLeadStatus(newStatus)
                const supabase = createClient()
                await (supabase.from('profiles') as any).update({ lead_status: newStatus }).eq('id', clientId)
              }}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#FFD700', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer', appearance: 'none', marginBottom: 20
              }}
            >
              <option>Active</option>
              <option>Hot Lead</option>
              <option>Cold</option>
              <option>Prospect</option>
              <option>Inactive</option>
              <option>New Prospect</option>
              <option>Contacted</option>
              <option>In Negotiation</option>
              <option>Active / Funded</option>
            </select>

            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>CONTACT METHODS</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#c0c3ce', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                <Phone size={14} /> CALL
              </button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#c0c3ce', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                <Mail size={14} /> MAIL
              </button>
            </div>
          </div>

          {/* CLIENT INFORMATION (editable) */}
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.08em', marginBottom: 16 }}>{t.client_information}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'FULL NAME', key: 'full_name' },
                { label: 'PHONE NUMBER', key: 'phone_number' },
                { label: 'COUNTRY', key: 'country' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8e9b', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</label>
                  <input
                    value={(editForm as any)[key]}
                    onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                </div>
              ))}
              <button
                onClick={handleUpdateProfile}
                disabled={savingProfile}
                style={{ padding: '10px', background: '#FFD700', border: 'none', borderRadius: 6, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: savingProfile ? 0.6 : 1, letterSpacing: '0.05em' }}
              >
                {savingProfile ? t.saving : t.save_changes}
              </button>
            </div>
          </div>

          {/* BALANCE ADJUSTMENT — hidden for sales role */}
          {viewerRole !== 'sales' && <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.08em', marginBottom: 16 }}>BALANCE ADJUSTMENT</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['credit', 'debit'] as const).map(type => (
                  <button key={type} onClick={() => setAdjType(type)} style={{
                    flex: 1, padding: '8px', borderRadius: 6,
                    border: `1px solid ${adjType === type ? (type === 'credit' ? '#26a69a' : '#ef5350') : 'rgba(255,255,255,0.1)'}`,
                    background: adjType === type ? (type === 'credit' ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)') : 'transparent',
                    color: adjType === type ? (type === 'credit' ? '#26a69a' : '#ef5350') : '#8a8e9b',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em'
                  }}>{type === 'credit' ? '+ CREDIT' : '− DEBIT'}</button>
                ))}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 10, color: '#8a8e9b', fontSize: 13 }}>$</span>
                <input type="number" value={adjAmount} onChange={e => setAdjAmount(e.target.value)} placeholder="0.00"
                  style={{ width: '100%', padding: '9px 12px 9px 26px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }} />
              </div>
              <input type="text" value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="Note (optional)"
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }} />
              <button
                onClick={async () => {
                  const amt = parseFloat(adjAmount)
                  if (!amt || amt <= 0) return alert('Enter a valid amount.')
                  if (!confirm(`${adjType === 'credit' ? 'Credit' : 'Debit'} $${amt.toFixed(2)} ${adjType === 'credit' ? 'to' : 'from'} this client's balance?`)) return
                  setAdjLoading(true)
                  try {
                    const supabase = createClient()
                    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', clientId).single()
                    const current = parseFloat((w as any)?.balance || '0')
                    const updated = adjType === 'credit' ? current + amt : Math.max(0, current - amt)
                    const { error } = await supabase.from('wallets').update({ balance: updated }).eq('user_id', clientId)
                    if (error) throw error
                    setBalance(updated)
                    setAdjAmount('')
                    setAdjNote('')
                    alert(`Balance ${adjType === 'credit' ? 'credited' : 'debited'} successfully. New balance: $${updated.toFixed(2)}`)
                  } catch (e: any) {
                    alert('Error: ' + e.message)
                  } finally {
                    setAdjLoading(false)
                  }
                }}
                disabled={adjLoading || !adjAmount}
                style={{
                  padding: '10px', background: adjType === 'credit' ? '#26a69a' : '#ef5350', border: 'none',
                  borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: adjLoading || !adjAmount ? 'not-allowed' : 'pointer',
                  opacity: adjLoading || !adjAmount ? 0.6 : 1, letterSpacing: '0.05em'
                }}
              >
                {adjLoading ? 'PROCESSING…' : `APPLY ${adjType.toUpperCase()}`}
              </button>
            </div>
          </div>}

          {/* SECURITY & ACCESS */}
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, color: '#FFD700', letterSpacing: '0.08em', marginBottom: 16 }}>{t.security_access}</h3>

            {/* ─ Current Password (encrypted ref) ─ */}
            {clientUUID && (
              <PasswordField userId={clientUUID} label="Current Password" containerStyle={{ marginBottom: 16 }} />
            )}

            {/* ─ New Password ─ */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#8a8e9b', letterSpacing: '0.05em', marginBottom: 8 }}>NEW PASSWORD</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  style={{
                    flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                    color: '#fff', fontSize: 13, outline: 'none'
                  }}
                />
                <button
                  onClick={() => setShowNewPw(!showNewPw)}
                  style={{
                    padding: '9px 14px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                    color: '#8a8e9b', cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap'
                  }}
                >
                  {showNewPw ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <button
                onClick={handleChangePassword}
                disabled={savingPassword || newPassword.trim().length < 6}
                style={{
                  width: '100%', padding: '10px',
                  background: newPassword.trim().length >= 6 ? 'rgba(38,166,154,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${newPassword.trim().length >= 6 ? '#26a69a' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 6, color: newPassword.trim().length >= 6 ? '#26a69a' : '#555',
                  fontWeight: 700, fontSize: 12,
                  cursor: newPassword.trim().length >= 6 ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.05em', opacity: savingPassword ? 0.6 : 1
                }}
              >
                {savingPassword ? t.saving : t.reset_password}
              </button>
            </div>

            {/* ─ Ban / Unban ─ */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 4 }}>
              <button
                onClick={handleToggleBan}
                disabled={togglingBan}
                style={{
                  width: '100%', padding: '11px',
                  background: isBanned ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.08)',
                  border: `1px solid ${isBanned ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)'}`,
                  borderRadius: 6, color: isBanned ? '#26a69a' : '#ef5350',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: togglingBan ? 0.6 : 1
                }}
              >
                <ShieldAlert size={14} />
                {togglingBan ? t.loading : isBanned ? t.unban_client : t.ban_client}
              </button>
            </div>
          </div>

          {/* RETENTION NOTES */}
          <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', color: '#8a8e9b', fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>{t.retention_notes}</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Keep track of all interactions, required documents, and trading preferences..."
              style={{
                flex: 1, width: '100%', padding: 16, borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.1)',
                color: '#fff', fontSize: 13, lineHeight: '1.6', outline: 'none', resize: 'none', fontFamily: 'system-ui'
              }}
            />
            <button 
              onClick={handleSaveCRMNotes}
              style={{
                width: '100%', marginTop: 16, padding: '12px', borderRadius: 6, background: '#FFD700', border: 'none',
                color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', letterSpacing: '0.05em'
              }}
            >
              {t.save_crm_notes}
            </button>
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
    </div>
  )
}
