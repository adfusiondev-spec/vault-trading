'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Bell, User, Wifi, LogOut, ArrowDownToLine, ArrowUpToLine,
  Search, BarChart2, Briefcase, ChevronDown, CheckCircle2,
  AlertCircle, ChevronRight, Activity, Percent, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useMarketData, type TickerData, type PriceMap } from '@/hooks/useMarketData'
import dynamic from 'next/dynamic'
import { useTransactions } from '@/hooks/useTransactions'
import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/lib/i18n'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useResponsive } from '@/hooks/useResponsive'

const CandlestickChart = dynamic(() => import('@/components/CandlestickChart'), { ssr: false })

export interface TradeOrder {
  id: string
  type: string
  symbol: string
  label: string
  amountUSD: number
  qty: number
  entryPrice: number
  status: 'Open' | 'Closing...' | 'Completed' | 'Rejected' | 'Cancelled'
}

export interface Transaction {
  id: string
  type: 'Deposit' | 'Withdrawal'
  method: string
  amount: number
  currency: string
  status: string
  timestamp: number
  reference: string
}

const BINANCE_ASSETS = [
  { symbol: 'BTCUSDT', label: 'Bitcoin',   short: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'Ethereum',  short: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'Solana',    short: 'SOL/USDT' },
  { symbol: 'BNBUSDT', label: 'BNB',       short: 'BNB/USDT' },
  { symbol: 'XRPUSDT', label: 'Ripple',    short: 'XRP/USDT' },
  { symbol: 'DOGEUSDT',label: 'Dogecoin',  short: 'DOGE/USDT' },
  { symbol: 'ADAUSDT', label: 'Cardano',   short: 'ADA/USDT' },
  { symbol: 'LTCUSDT', label: 'Litecoin',  short: 'LTC/USDT' },
]

export const MARKET_GROUPS = [
  {
    category: 'PRECIOUS METALS',
    items: [
      { symbol: 'XAUUSD', label: 'Gold',            short: 'XAU/USD', base: 2450.51  },
      { symbol: 'XAGUSD', label: 'Silver',          short: 'XAG/USD', base: 31.20    },
      { symbol: 'XPTUSD', label: 'Platinum',        short: 'XPT/USD', base: 979.86   },
      { symbol: 'XPDUSD', label: 'Palladium',       short: 'XPD/USD', base: 1019.72  },
    ]
  },
  {
    category: 'ENERGY',
    items: [
      { symbol: 'WTIUSD',  label: 'Crude Oil (WTI)',  short: 'WTI/USD',  base: 82.38 },
      { symbol: 'BRTUSD',  label: 'Brent Crude',      short: 'BRT/USD',  base: 85.47 },
      { symbol: 'NGAS',    label: 'Natural Gas',      short: 'NGAS',     base: 2.10  },
      { symbol: 'GASUSD',  label: 'Gasoline',         short: 'GAS/USD',  base: 2.45  },
    ]
  },
  {
    category: 'FX · MAJORS',
    items: [
      { symbol: 'EURUSD', label: 'Euro / US Dollar',      short: 'EUR/USD', base: 1.08 },
      { symbol: 'GBPUSD', label: 'Pound / US Dollar',     short: 'GBP/USD', base: 1.27 },
      { symbol: 'USDJPY', label: 'US Dollar / Yen',       short: 'USD/JPY', base: 151.85 },
      { symbol: 'USDCHF', label: 'US Dollar / Franc',     short: 'USD/CHF', base: 0.90120 },
    ]
  },
  {
    category: 'FX · MINORS',
    items: [
      { symbol: 'EURGBP', label: 'Euro / Pound',          short: 'EUR/GBP', base: 0.85600 },
      { symbol: 'EURJPY', label: 'Euro / Yen',            short: 'EUR/JPY', base: 163.800 },
      { symbol: 'GBPJPY', label: 'Pound / Yen',           short: 'GBP/JPY', base: 194.200 },
    ]
  },
  {
    category: 'SAUDI & REGIONAL',
    items: [
      { symbol: 'TASI',   label: 'Tadawul All Share',     short: 'TASI',    base: 12450 },
      { symbol: 'ARAMCO', label: 'Saudi Aramco',          short: 'ARAMCO',  base: 29.40 },
      { symbol: 'DFM',    label: 'Dubai Financial',       short: 'DFM',     base: 4820.0 },
      { symbol: 'QE',     label: 'Qatar Exchange',        short: 'QE',      base: 10120 },
    ]
  }
]

function fmtPrice(n: number): string {
  if (n == null || isNaN(n)) return '---';
  if (n >= 1000)  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1)     return n.toFixed(2)
  return n.toFixed(4)
}

function ensureFlashStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('vault-flash-styles')) return
  const style = document.createElement('style')
  style.id = 'vault-flash-styles'
  style.textContent = `
    @keyframes flashUp { 0%,100% { background: transparent; color: #fff; } 30% { background: rgba(38,166,154,0.4); color: #26a69a; } }
    @keyframes flashDown { 0%,100% { background: transparent; color: #fff; } 30% { background: rgba(239,83,80,0.4); color: #ef5350; } }
    .flash-up { animation: flashUp 0.6s ease-out; }
    .flash-down { animation: flashDown 0.6s ease-out; }
    .scroll-hide::-webkit-scrollbar { display: none; }
    .scroll-hide { -ms-overflow-style: none; scrollbar-width: none; }
    input[type="number"]::-webkit-inner-spin-button, 
    input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  `
  document.head.appendChild(style)
}

export default function Dashboard() {
  const router = useRouter()
  const { t } = useTranslation()
  const { isMobile } = useResponsive()
  const [mobileView, setMobileView] = useState<'chart' | 'watchlist' | 'account'>('chart')
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [wal, setWal] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [closedOrders, setClosedOrders] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [watchlistSearch, setWatchlistSearch] = useState('')

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [tradeAmt, setTradeAmt] = useState('')
  const [bottomTab, setBottomTab] = useState('statements')
  
  const [showNotifications, setShowNotifications] = useState(false)
  
  const [actionTab, setActionTab] = useState('deposit') // deposit | withdraw
  const [showToast, setShowToast] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [modalAmount, setModalAmount] = useState('')
  const [modalMethod, setModalMethod] = useState('')
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [modalError, setModalError] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [companySettings, setCompanySettings] = useState<any>({
    usdt_address: 'TRX7xK9mNpQwE3rBvYsD2uF8hGjL4cP6nA',
    usdt_network: 'TRC20',
    usdt_is_active: true,
    btc_address: '1A2b3C4d5E6f7G8h9I0jK1L2m3N4o5P6q7',
    btc_is_active: true,
    bank_name: 'CIH Bank',
    bank_account_holder: 'The Vault Trading',
    bank_rib: '230 780 4567890123456789 12',
    bank_is_active: true,
  })
  const [copiedField, setCopiedField] = useState('')

  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  const [profilePanelOpen, setProfilePanelOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileCountry, setProfileCountry] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const openProfilePanel = () => {
    setProfileName(user?.user_metadata?.full_name || user?.full_name || '')
    setProfilePhone(user?.phone_number || '')
    setProfileCountry(user?.country || '')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setProfilePanelOpen(true)
  }

  const handleSaveProfile = async () => {
    if (!user) return
    const { error: err1 } = await supabase.auth.updateUser({ 
      data: { full_name: profileName, phone: profilePhone, country: profileCountry } 
    })
    const { error: err2 } = await supabase.from('profiles')
      .update({ full_name: profileName, phone_number: profilePhone, country: profileCountry })
      .eq('id', user.id)
    if (err1 || err2) alert(err1?.message || err2?.message)
    else {
      alert('Profile updated successfully')
      setProfilePanelOpen(false)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) setUser(p)
    }
  }

  const handleSavePassword = async () => {
    if (newPw !== confirmPw) return alert('Passwords do not match')
    if (newPw.length < 6) return alert('Password must be at least 6 characters')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) alert(error.message)
    else {
      alert('Password updated successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
  }


  const closeModal = () => {
    setModalOpen(false)
    setModalAmount('')
    setModalMethod('')
    setModalFile(null)
    setModalError('')
    setModalLoading(false)
    setWithdrawAddress('')
    setBankName('')
    setAccountNumber('')
    setAccountHolder('')
  }

  const { prices, connected } = useMarketData()
  const supabase = createClient()
  const userIdRef = useRef<string | null>(null)

  const refresh = useCallback(async (uid: string) => {
    if (!uid) return
    const { data: o } = await supabase.from('trades').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (o) {
      const mapped = o.map((x:any) => ({
        id: x.id, type: x.type==='buy'?'Buy':'Sell', symbol: x.symbol, label: x.symbol,
        amountUSD: Number(x.amount), qty: Number(x.quantity),
        entryPrice: Number(x.entry_price), exitPrice: Number(x.exit_price || 0),
        pnl: Number(x.profit_loss || 0),
        status: x.status==='open'?'Open': x.status==='closed'?'Closed':'Completed',
        created_at: x.created_at, closed_at: x.closed_at,
      }))
      setOrders(mapped.filter(t => t.status === 'Open'))
      setClosedOrders(mapped.filter(t => t.status === 'Closed'))
    }
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    if (w) setWal(w)
  }, [supabase])

  const { submitRequest, wallet, transactions } = useTransactions(user?.id)

  const uiTxs = (transactions || []).map((x:any) => ({ 
    id: x.id, 
    type: x.type==='deposit'?'DEPOSIT':'WITHDRAWAL', 
    method: x.payment_method || 'USDT-TRC20', 
    amount: Number(x.amount), 
    currency: x.currency, 
    status: x.status.charAt(0).toUpperCase()+x.status.slice(1), 
    timestamp: new Date(x.created_at).getTime(),
    reference: `DEP-${new Date(x.created_at).getTime()}`
  }))

  useEffect(() => {
    ensureFlashStyles()
    setMounted(true)
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        userIdRef.current = session.user.id
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (p) { 
          setUser(p); 
          refresh(session.user.id);
          fetch('/api/payment-settings/user')
            .then(r => r.json())
            .then(({ settings }) => { if (settings) setCompanySettings(settings) })
            .catch(() => {})
        }
      } else router.push('/login')
    }
    init()

    const chan = supabase
      .channel('ui-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => {
        if (userIdRef.current) refresh(userIdRef.current)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        if (userIdRef.current) refresh(userIdRef.current)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        if (userIdRef.current) refresh(userIdRef.current)
      })
      .subscribe()

    return () => { supabase.removeChannel(chan) }
  }, [router, refresh, supabase])

  // Removed old handleActionSubmit due to Modal logic

  const execTrade = async (type: 'buy' | 'sell') => {
    if (!user || parseFloat(tradeAmt) <= 0 || isNaN(parseFloat(tradeAmt))) return
    const liveP = prices[symbol]?.price || 0
    const { error } = await supabase.rpc('execute_trade', { p_user_id: user.id, p_symbol: symbol, p_amount: parseFloat(tradeAmt), p_type: type, p_entry_price: liveP })
    if (error) alert(error.message)
    else {
      await refresh(user.id)
      setTradeAmt('')
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('wallet-sync')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${user.id}`
      }, () => {
        refresh(user.id)
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, supabase, refresh])

  const { notifications, unreadCount, markAsRead } = useNotifications(user?.id, user?.role || 'trader')

  const liveCurrent = prices[symbol]?.price || 0
  const baseChartPrice = useMemo(() => {
    const it = MARKET_GROUPS.flatMap(g => g.items).find(i => i.symbol === symbol)
    return it?.base || liveCurrent || 2000
  }, [symbol, liveCurrent > 0])

  const calculateLivePnL = useCallback((trade: any): number => {
    const livePrice = prices[trade.symbol]?.price || trade.entryPrice
    return trade.type === 'Buy'
      ? (livePrice - trade.entryPrice) * trade.qty
      : (trade.entryPrice - livePrice) * trade.qty
  }, [prices])

  const handleCloseTrade = useCallback(async (tradeId: string, symbol: string) => {
    const exitPrice = prices[symbol]?.price || 0
    const { error } = await supabase.rpc('close_trade', { p_trade_id: tradeId, p_exit_price: exitPrice })
    if (error) alert(error.message)
    else if (userIdRef.current) refresh(userIdRef.current)
  }, [prices, supabase, refresh])

  if (!mounted) return null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#131722', color: '#d1d4dc', overflow: isMobile ? 'visible' : 'hidden', fontFamily: "'Inter', sans-serif" }}>
      
      {/* TOP HEADER */}
      <div style={{ height: 50, borderBottom: '1px solid #2a2e3b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#1a1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#FFD700', borderRadius: 4, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', color: '#fff' }}>THE VAULT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: connected ? '#26a69a' : '#ef5350' }}>
            {connected ? <Wifi size={14} /> : <AlertCircle size={14} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>{connected ? 'LIVE' : 'DISCONNECTED'}</span>
          </div>
          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={16} color="#787b86" />
              {unreadCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef5350', color: '#fff', fontSize: 9, fontWeight: 700, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>}
            </div>
            {showNotifications && (
              <div style={{ position: 'absolute', top: 30, right: -80, width: 300, background: '#1a1e2e', border: '1px solid #2a2e3b', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
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
          <div style={{ width: 1, height: 24, background: '#2a2e3b' }} />
          <div onClick={openProfilePanel} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ background: '#2a2e3b', color: '#FFD700', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>G</div>
            <span style={{ fontSize: 12, color: '#d1d4dc', whiteSpace: 'nowrap' }}>{user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Trader'}</span>
            <User size={14} color="#787b86" />
          </div>
          <div style={{ width: 1, height: 24, background: '#2a2e3b' }} />
          {!isMobile && (
            <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/login') }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#787b86', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <LogOut size={14} /> {t.logout}
            </button>
          )}
          {!isMobile && <LanguageToggle />}
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
             {!isMobile && (
               <button type="button" onClick={() => { setModalType('withdrawal'); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                 <ArrowUpToLine size={12} /> {t.withdrawal}
               </button>
             )}
             <button type="button" onClick={() => { setModalType('deposit'); setModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFD700', border: 'none', color: '#000', padding: '4px 16px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
               <ArrowDownToLine size={12} /> {t.deposit}
             </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2e3b', background: '#1a1e2e', flexShrink: 0 }}>
          {(['watchlist', 'chart', 'account'] as const).map(v => (
            <button key={v} onClick={() => setMobileView(v)} style={{
              flex: 1, padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              color: mobileView === v ? '#FFD700' : '#787b86',
              borderBottom: mobileView === v ? '2px solid #FFD700' : '2px solid transparent',
            }}>{v}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: isMobile ? 'visible' : 'hidden' }}>

        {/* LEFT SIDEBAR: WATCHLIST */}
        <div style={{ width: isMobile ? '100%' : 300, background: '#131722', borderRight: isMobile ? 'none' : '1px solid #2a2e3b', display: isMobile ? (mobileView === 'watchlist' ? 'flex' : 'none') : 'flex', flexDirection: 'column', overflowY: isMobile ? 'auto' : 'visible' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e222d' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#FFD700' }}>Watchlist</span>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={12} color="#787b86" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search assets…"
                value={watchlistSearch}
                onChange={e => setWatchlistSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 8px 6px 26px', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2e3b', borderRadius: 4, color: '#d1d4dc', fontSize: 11, outline: 'none' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 10, color: '#787b86', padding: '8px 16px', fontWeight: 600, borderBottom: '1px solid #1e222d' }}>
            <div style={{ flex: 1.5 }}>SYMBOL</div>
            <div style={{ flex: 1, textAlign: 'right' }}>BUY</div>
            <div style={{ flex: 1, textAlign: 'right' }}>SELL</div>
            <div style={{ flex: 0.8, textAlign: 'right' }}>SPD</div>
          </div>

          <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            {(() => {
              const q = watchlistSearch.toLowerCase()
              const filteredCrypto = BINANCE_ASSETS.filter(a => !q || a.symbol.toLowerCase().includes(q) || a.short.toLowerCase().includes(q))
              const filteredGroups = MARKET_GROUPS.map(g => ({ ...g, items: g.items.filter(a => !q || a.symbol.toLowerCase().includes(q) || a.short.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
              return (
                <>
                  {filteredCrypto.length > 0 && (
                    <>
                      <div style={{ padding: '12px 16px 6px', fontSize: 10, fontWeight: 700, color: '#787b86', letterSpacing: '0.05em' }}>CRYPTO · LIVE</div>
                      {filteredCrypto.map(a => <AssetRow key={a.symbol} asset={a} tick={prices[a.symbol]} active={symbol===a.symbol} onClick={()=>setSymbol(a.symbol)} />)}
                    </>
                  )}
                  {filteredGroups.map(g => (
                    <React.Fragment key={g.category}>
                      <div style={{ padding: '16px 16px 6px', fontSize: 10, fontWeight: 700, color: '#787b86', letterSpacing: '0.05em' }}>{g.category}</div>
                      {g.items.map(a => <AssetRow key={a.symbol} asset={a} tick={prices[a.symbol]} active={symbol===a.symbol} onClick={()=>setSymbol(a.symbol)} />)}
                    </React.Fragment>
                  ))}
                  {filteredCrypto.length === 0 && filteredGroups.length === 0 && (
                    <div style={{ padding: 24, textAlign: 'center', color: '#787b86', fontSize: 11 }}>No assets found.</div>
                  )}
                </>
              )
            })()}
          </div>
        </div>

        {/* MIDDLE SECTION: CHART + TRADING + HISTORY */}
        <div style={{ flex: 1, display: isMobile ? (mobileView === 'chart' ? 'flex' : 'none') : 'flex', flexDirection: 'column', minWidth: 0, borderRight: isMobile ? 'none' : '1px solid #2a2e3b' }}>
          
          {/* Chart Header */}
          <div style={{ padding: '0 16px', height: 48, borderBottom: '1px solid #2a2e3b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#131722' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div style={{ background: '#FFD700', padding: '2px 4px', borderRadius: 2, fontSize: 10, color: '#000', fontWeight: 800 }}>VLT</div>
               <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{BINANCE_ASSETS.find(x=>x.symbol===symbol)?.short || MARKET_GROUPS.flatMap(x=>x.items).find(x=>x.symbol===symbol)?.short}</span>
               <span style={{ color: '#787b86', fontSize: 11 }}>1D</span>
               <span style={{ color: '#787b86', fontSize: 11 }}>H <span style={{color:'#26a69a'}}>{fmtPrice(liveCurrent * 1.015)}</span></span>
               <span style={{ color: '#787b86', fontSize: 11 }}>L <span style={{color:'#ef5350'}}>{fmtPrice(liveCurrent * 0.985)}</span></span>
               <span style={{ color: '#26a69a', fontSize: 11 }}>+0.82%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: '#787b86', fontSize: 12 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Activity size={14}/> Indicators</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><BarChart2 size={14}/> Compare</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><Bell size={14}/> Alert</div>
            </div>
          </div>
          
          {/* Chart */}
          <div style={{ flex: 1, position: 'relative' }}>
             <CandlestickChart symbol={symbol} basePrice={baseChartPrice} />
          </div>

          {/* Chart Footer Timeframes */}
          <div style={{ display: 'flex', gap: 16, padding: '8px 16px', background: '#131722', borderTop: '1px solid #2a2e3b', borderBottom: '1px solid #1e222d', fontSize: 11, color: '#787b86', fontWeight: 600 }}>
             {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(t => (
               <span key={t} style={{ color: t==='1D' ? '#fff' : '#787b86', background: t==='1D' ? '#2a2e3b' : 'transparent', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}>{t}</span>
             ))}
          </div>

          {/* Trading Action Bar */}
          <div style={{ padding: isMobile ? '12px' : '16px', background: '#1a1e2e', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a2e3b', gap: isMobile ? 12 : 0 }}>
             <div style={{ display: 'flex', gap: isMobile ? 12 : 32, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
               <div style={{ flex: isMobile ? '1 1 auto' : 'unset' }}>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>ASSET</div>
                 <div style={{ background: '#131722', border: '1px solid #2a2e3b', padding: '8px 12px', borderRadius: 4, color: '#fff', fontSize: 13, minWidth: 100 }}>
                   {BINANCE_ASSETS.find(x=>x.symbol===symbol)?.short || MARKET_GROUPS.flatMap(x=>x.items).find(x=>x.symbol===symbol)?.short}
                 </div>
               </div>
               <div style={{ flex: isMobile ? '1 1 auto' : 'unset' }}>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>PRICE</div>
                 <div style={{ padding: '8px 0', color: '#FFD700', fontSize: 14, fontWeight: 700 }}>
                   {fmtPrice(liveCurrent)}
                 </div>
               </div>
               <div style={{ flex: isMobile ? '1 1 100%' : 'unset' }}>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>AMOUNT (USD)</div>
                 <div style={{ position: 'relative' }}>
                   <span style={{ position: 'absolute', left: 10, top: 9, color: '#787b86', fontSize: 13 }}>$</span>
                   <input type="number" placeholder="0.00" value={tradeAmt} onChange={e=>setTradeAmt(e.target.value)} style={{ background: '#131722', outline: 'none', border: '1px solid #2a2e3b', padding: '8px 12px 8px 24px', borderRadius: 4, color: '#d1d4dc', fontSize: 13, width: isMobile ? '100%' : 140 }} />
                 </div>
               </div>
             </div>
             <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 260 }}>
               <button onClick={()=>execTrade('buy')} style={{ flex: 1, height: 44, background: '#26a69a', color: '#fff', fontWeight: 800, border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, letterSpacing: '0.03em' }}>
                 ▲ {t.buy}
               </button>
               <button onClick={()=>execTrade('sell')} style={{ flex: 1, height: 44, background: '#ef5350', color: '#fff', fontWeight: 800, border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, letterSpacing: '0.03em' }}>
                 ▼ {t.sell}
               </button>
             </div>
          </div>

          {/* History Data Table */}
          <div style={{ height: 260, background: '#131722', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2a2e3b' }}>
              {[
                { id: 'open', label: `${t.open_positions} (${orders.filter(o=>o.status==='Open').length})` },
                { id: 'pending', label: `${t.pending_orders} (0)` },
                { id: 'closed', label: `${t.closed_trades} (${closedOrders.length})` },
                { id: 'statements', label: `${t.statements} (${uiTxs.length})` },
                { id: 'summary', label: `${t.account_summary} (${uiTxs.filter((tx:any) => tx.status === 'Approved').length})` }
              ].map(tab => (
                <button
                  key={tab.id} onClick={()=>setBottomTab(tab.id)}
                  style={{
                    background: 'transparent', border: 'none', padding: '12px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    color: bottomTab === tab.id ? '#fff' : '#787b86',
                    borderBottom: bottomTab === tab.id ? '2px solid #FFD700' : '2px solid transparent'
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }} className="scroll-hide">
              {bottomTab === 'statements' ? (
                <table style={{ width: '100%', fontSize: 11, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ color: '#787b86', borderBottom: '1px solid #1e222d' }}>
                    <tr>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>{t.date}</th>
                      <th style={{ fontWeight: 600 }}>{t.type}</th>
                      <th style={{ fontWeight: 600 }}>{t.amount}</th>
                      <th style={{ fontWeight: 600 }}>{t.payment_method}</th>
                      <th style={{ fontWeight: 600 }}>REFERENCE</th>
                      <th style={{ fontWeight: 600, paddingRight: 20, textAlign: 'right' }}>{t.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uiTxs.map((tx:any) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 20px', color: '#787b86' }}>
                          {new Date(tx.timestamp).toLocaleDateString('en-GB')} <span style={{marginLeft: 6}}>{new Date(tx.timestamp).toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}</span>
                        </td>
                        <td>
                          <span style={{ color: tx.type==='DEPOSIT' ? '#26a69a' : '#ef5350', background: tx.type==='DEPOSIT' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ color: tx.type==='DEPOSIT' ? '#26a69a' : '#ef5350', fontWeight: 600 }}>
                          {tx.type==='DEPOSIT' ? '+' : '-'}{tx.amount.toFixed(2)} USD
                        </td>
                        <td style={{ color: '#d1d4dc' }}>{tx.method}</td>
                        <td style={{ color: '#787b86' }}>{tx.reference}</td>
                        <td style={{ paddingRight: 20, textAlign: 'right' }}>
                          <span style={{ 
                            color: tx.status==='Pending' ? '#FFD700' : tx.status==='Approved' ? '#26a69a' : '#ef5350',
                            border: `1px solid ${tx.status==='Pending' ? '#FFD70066' : tx.status==='Approved' ? '#26a69a66' : '#ef535066'}`,
                            padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600 
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {uiTxs.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#787b86' }}>No statements found.</td></tr>}
                  </tbody>
                </table>
              ) : bottomTab === 'open' ? (
                <table style={{ width: '100%', fontSize: 11, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ color: '#787b86', borderBottom: '1px solid #1e222d' }}>
                    <tr><th style={{ padding: '12px 20px' }}>{t.asset}</th><th>{t.date}</th><th>{t.type}</th><th>SIZE (USD)</th><th>{t.entry_price}</th><th>{t.profit_loss}</th><th style={{textAlign: 'right', paddingRight:20}}>{t.actions}</th></tr>
                  </thead>
                  <tbody>
                    {orders.filter(o=>o.status==='Open').map(o => {
                      const lp = prices[o.symbol]?.price || o.entryPrice
                      const pnl = o.type==='Buy' ? (lp - o.entryPrice) * o.qty : (o.entryPrice - lp) * o.qty
                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 20px', color: '#fff', fontWeight: 600 }}>{o.label}</td>
                          <td style={{ color: '#787b86', fontSize: 10 }}>
                            {new Date(o.created_at || Date.now()).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td style={{ color: o.type==='Buy' ? '#26a69a' : '#ef5350' }}>{o.type.toUpperCase()}</td>
                          <td style={{ color: '#fff' }}>${o.amountUSD.toFixed(2)}</td>
                          <td style={{ color: '#787b86' }}>{fmtPrice(o.entryPrice)}</td>
                          <td style={{ color: pnl>=0 ? '#26a69a' : '#ef5350', fontWeight: 700 }}>{pnl>=0?'+':''}{pnl.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', paddingRight: 20 }}>
                            <button onClick={()=>supabase.rpc('close_trade', {p_trade_id:o.id, p_exit_price:lp}).then(()=>refresh(user?.id))} style={{ background: 'transparent', border: '1px solid #ef5350', color: '#ef5350', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>CLOSE</button>
                          </td>
                        </tr>
                      )
                    })}
                    {orders.filter(o=>o.status==='Open').length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#787b86' }}>No open positions.</td></tr>}
                  </tbody>
                </table>
              ) : bottomTab === 'closed' ? (
                <table style={{ width: '100%', fontSize: 11, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ color: '#787b86', borderBottom: '1px solid #1e222d' }}>
                    <tr>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>{t.asset}</th>
                      <th style={{ fontWeight: 600 }}>{t.date}</th>
                      <th style={{ fontWeight: 600 }}>{t.type}</th>
                      <th style={{ fontWeight: 600 }}>SIZE (USD)</th>
                      <th style={{ fontWeight: 600 }}>{t.entry_price}</th>
                      <th style={{ fontWeight: 600 }}>EXIT PRICE</th>
                      <th style={{ fontWeight: 600, paddingRight: 20, textAlign: 'right' }}>{t.profit_loss}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedOrders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 20px', color: '#fff', fontWeight: 600 }}>{o.label}</td>
                        <td style={{ color: '#787b86', fontSize: 10 }}>
                          {new Date(o.closed_at || o.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ color: o.type==='Buy' ? '#26a69a' : '#ef5350' }}>{o.type.toUpperCase()}</td>
                        <td style={{ color: '#fff' }}>${o.amountUSD.toFixed(2)}</td>
                        <td style={{ color: '#787b86' }}>{fmtPrice(o.entryPrice)}</td>
                        <td style={{ color: '#787b86' }}>{o.exitPrice ? fmtPrice(o.exitPrice) : '—'}</td>
                        <td style={{ paddingRight: 20, textAlign: 'right', color: o.pnl >= 0 ? '#26a69a' : '#ef5350', fontWeight: 700 }}>
                          {o.pnl >= 0 ? '+' : ''}{o.pnl.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {closedOrders.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#787b86' }}>No closed trades.</td></tr>}
                  </tbody>
                </table>
              ) : bottomTab === 'summary' ? (
                (() => {
                  const totalDeposits = uiTxs.filter((tx:any) => tx.type==='DEPOSIT' && tx.status==='Approved').reduce((s:number, tx:any) => s + tx.amount, 0)
                  const totalWithdrawals = uiTxs.filter((tx:any) => tx.type==='WITHDRAWAL' && tx.status==='Approved').reduce((s:number, tx:any) => s + tx.amount, 0)
                  const totalPnL = closedOrders.reduce((s, o) => s + o.pnl, 0)
                  const stats = [
                    { label: 'Balance', value: `$${Number(wal?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#FFD700' },
                    { label: 'Total Deposits', value: `+$${totalDeposits.toFixed(2)}`, color: '#26a69a' },
                    { label: 'Total Withdrawals', value: `-$${totalWithdrawals.toFixed(2)}`, color: '#ef5350' },
                    { label: 'Closed P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, color: totalPnL >= 0 ? '#26a69a' : '#ef5350' },
                    { label: 'Open Positions', value: String(orders.filter(o => o.status==='Open').length), color: '#fff' },
                    { label: 'Closed Trades', value: String(closedOrders.length), color: '#fff' },
                    { label: 'Total Transactions', value: String(uiTxs.length), color: '#fff' },
                  ]
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1e222d' }}>
                      {stats.map(s => (
                        <div key={s.label} style={{ background: '#131722', padding: '16px 20px' }}>
                          <div style={{ fontSize: 10, color: '#787b86', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>{s.label.toUpperCase()}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#787b86', fontSize: 12 }}>No records found.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: ACCOUNT & DEPOSIT */}
        <div style={{ width: isMobile ? '100%' : 320, background: '#1a1e2e', display: isMobile ? (mobileView === 'account' ? 'flex' : 'none') : 'flex', flexDirection: 'column', position: 'relative', overflowY: isMobile ? 'auto' : 'visible' }}>
          
          <div style={{ padding: 20, borderBottom: '1px solid #2a2e3b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#FFD700', color: '#000', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>G</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Trader'}</div>
                <div style={{ fontSize: 11, color: '#787b86' }}>{user?.email || 'trader@institution.io'}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: '#787b86' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Account ID</span>
                <span style={{ color: '#ef5350', fontWeight: 600 }}>#MOCK-{user?.id?.substring(0,6).toUpperCase() || '1234'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Account Type</span>
                <span style={{ color: '#ef5350', fontWeight: 600 }}>Premium</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Status</span>
                <span style={{ color: '#26a69a', fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center' }}>Verified <CheckCircle2 size={12}/></span>
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#787b86', letterSpacing: '0.05em', marginBottom: 8 }}>AVAILABLE BALANCE</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#FFD700', marginBottom: 4 }}>
              ${(wal || wallet) ? Number((wal || wallet).balance).toLocaleString('en-US', {minimumFractionDigits: 2}) : '0.00'}
            </div>
            <div style={{ fontSize: 11, color: '#787b86' }}>USD - Available to trade</div>
          </div>

          {/* Account Info Panel — replaces old sidebar buttons */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: '#131722', borderRadius: 8, border: '1px solid #2a2e3b', padding: '16px' }}>

              {/* Equity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Equity</span>
                <span style={{ fontSize: 12, color: '#d1d4dc', fontFamily: 'monospace' }}>
                  ${((wal || wallet) ? Number((wal || wallet).balance) : 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Margin Used */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Margin Used</span>
                <span style={{ fontSize: 12, color: '#d1d4dc', fontFamily: 'monospace' }}>$0.00</span>
              </div>

              {/* Free Margin */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Free Margin</span>
                <span style={{ fontSize: 12, color: '#FFD700', fontFamily: 'monospace' }}>
                  ${((wal || wallet) ? Number((wal || wallet).balance) : 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ height: 1, background: '#2a2e3b', margin: '12px 0' }} />

              {/* Open Positions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Open Positions</span>
                <span style={{ fontSize: 12, color: '#d1d4dc' }}>{orders.filter((o: any) => o.status === 'Open').length}</span>
              </div>

              {/* Total P&L */}
              {(() => {
                const totalPnL = orders
                  .filter((o: any) => o.status === 'Open')
                  .reduce((acc: number, o: any) => {
                    const lp = prices[o.symbol]?.price || o.entryPrice
                    const pnl = o.type === 'Buy' ? (lp - o.entryPrice) * o.qty : (o.entryPrice - lp) * o.qty
                    return acc + pnl
                  }, 0)
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: '#787b86' }}>Total P&L</span>
                    <span style={{ fontSize: 12, color: totalPnL >= 0 ? '#26a69a' : '#ef5350', fontFamily: 'monospace', fontWeight: 700 }}>
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                    </span>
                  </div>
                )
              })()}

              <div style={{ height: 1, background: '#2a2e3b', margin: '12px 0' }} />

              {/* Member Since */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Member Since</span>
                <span style={{ fontSize: 11, color: '#d1d4dc' }}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>

              {/* Account Level */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#787b86' }}>Account Level</span>
                <span style={{ fontSize: 11, color: '#FFD700', fontWeight: 600 }}>Premium</span>
              </div>

            </div>
          </div>
          {showToast && (
            <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#2a2e3b', border: '1px solid #26a69a', color: '#fff', padding: '12px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 10, width: '90%', fontSize: 12, fontWeight: 600, animation: 'flashUp 0.3s ease-out' }}>
              <CheckCircle2 color="#26a69a" size={16} /> 
              {modalType === 'deposit' ? 'Deposit request sent successfully!' : 'Withdrawal requested successfully!'}
            </div>
          )}

        </div>
      </div>

      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            backgroundColor: '#1a1e2e',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #2a2e3e'
          }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {modalType === 'deposit' ? '+ Deposit' : '↑ Withdraw'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '20px', cursor: 'pointer' }}
              >✕</button>
            </div>

            {/* Balance */}
            <div style={{ backgroundColor: '#131722', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
              <span style={{ color: '#888', fontSize: '12px' }}>Available Balance: </span>
              <span style={{ color: '#FFD700', fontSize: '14px', fontWeight: 700 }}>
                ${(wallet?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Amount Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Amount (USD)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={modalAmount}
                onChange={(e) => setModalAmount(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', backgroundColor: '#131722',
                  border: '1px solid #2a2e3e', borderRadius: '6px',
                  color: '#fff', fontSize: '14px', boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                Payment Method
              </label>
              <select
                value={modalMethod}
                onChange={(e) => setModalMethod(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', backgroundColor: '#131722',
                  border: '1px solid #2a2e3e', borderRadius: '6px',
                  color: '#fff', fontSize: '14px', boxSizing: 'border-box'
                }}
              >
                <option value="">— Select Method —</option>
                <option value="crypto_usdt">USDT (Tether)</option>
                <option value="crypto_btc">Bitcoin (BTC)</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            {/* Payment Details — show after method selected */}
            {modalMethod && modalType === 'deposit' && (
              <div style={{
                backgroundColor: '#131722', borderLeft: '3px solid #FFD700',
                borderRadius: '6px', padding: '12px', marginBottom: '16px'
              }}>
                <p style={{ color: '#888', fontSize: '11px', margin: '0 0 8px' }}>
                  Send to:
                </p>

                {modalMethod === 'crypto_usdt' && (
                  <div>
                    <p style={{ color: '#888', fontSize: '11px', margin: '0 0 6px' }}>
                      USDT Wallet (TRC20)
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ 
                        color: '#fff', fontSize: '11px', fontFamily: 'monospace',
                        flex: 1, wordBreak: 'break-all'
                      }}>
                        {companySettings?.usdt_address || 'Not configured'}
                      </code>
                      {companySettings?.usdt_address && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(companySettings.usdt_address)
                            setCopiedField('usdt')
                            setTimeout(() => setCopiedField(''), 2000)
                          }}
                          style={{
                            background: '#FFD700', border: 'none', borderRadius: '4px',
                            color: '#000', fontSize: '10px', fontWeight: 700,
                            padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                        >
                          {copiedField === 'usdt' ? '✓ Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                    <p style={{ color: '#555', fontSize: '10px', marginTop: '4px' }}>
                      Network: {companySettings?.usdt_network || 'TRC20'}
                    </p>
                  </div>
                )}

                {modalMethod === 'crypto_btc' && (
                  <div>
                    <p style={{ color: '#888', fontSize: '11px', margin: '0 0 6px' }}>
                      Bitcoin Address
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ 
                        color: '#fff', fontSize: '11px', fontFamily: 'monospace',
                        flex: 1, wordBreak: 'break-all'
                      }}>
                        {companySettings?.btc_address || 'Not configured'}
                      </code>
                      {companySettings?.btc_address && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(companySettings.btc_address)
                            setCopiedField('btc')
                            setTimeout(() => setCopiedField(''), 2000)
                          }}
                          style={{
                            background: '#FFD700', border: 'none', borderRadius: '4px',
                            color: '#000', fontSize: '10px', fontWeight: 700,
                            padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                          }}
                        >
                          {copiedField === 'btc' ? '✓ Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {modalMethod === 'bank_transfer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Bank Name', value: companySettings?.bank_name, key: 'bank' },
                      { label: 'Account Holder', value: companySettings?.bank_account_holder, key: 'holder' },
                      { label: 'RIB / IBAN', value: companySettings?.bank_rib, key: 'rib' }
                    ].map(({ label, value, key }) => (
                      <div key={key}>
                        <p style={{ color: '#888', fontSize: '10px', margin: '0 0 3px' }}>{label}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#fff', fontSize: '12px', flex: 1 }}>
                            {value || 'Not configured'}
                          </span>
                          {value && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(value)
                                setCopiedField(key)
                                setTimeout(() => setCopiedField(''), 2000)
                              }}
                              style={{
                                background: '#FFD700', border: 'none', borderRadius: '4px',
                                color: '#000', fontSize: '10px', fontWeight: 700,
                                padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                              }}
                            >
                              {copiedField === key ? '✓ Copied' : 'Copy'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {modalMethod && modalType === 'withdrawal' && (
              <div style={{
                backgroundColor: '#131722', borderLeft: '3px solid #FFD700',
                borderRadius: '6px', padding: '12px', marginBottom: '16px'
              }}>
                {modalMethod === 'crypto_usdt' || modalMethod === 'crypto_btc' ? (
                  <div>
                    <label style={{ color: '#888', fontSize: '11px', display: 'block', marginBottom: '6px' }}>Your Wallet Address</label>
                    <input 
                      type="text"
                      placeholder={modalMethod === 'crypto_usdt' ? 'USDT TRC20 Address' : 'Bitcoin Address'}
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,215,0,0.3)', borderRadius: '6px',
                        color: '#fff', fontSize: '13px', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ) : modalMethod === 'bank_transfer' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Bank Name" 
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,215,0,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box'
                          }} />
                    <input placeholder="RIB / IBAN" 
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,215,0,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box'
                          }} />
                    <input placeholder="Account Holder Name" 
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.4)',
                            border: '1px solid rgba(255,215,0,0.3)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box'
                          }} />
                  </div>
                ) : null}
              </div>
            )}

            {/* Proof Upload — deposit only */}
            {modalMethod && modalType === 'deposit' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                  Payment Proof
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setModalFile(e.target.files?.[0] || null)}
                  style={{ color: '#ccc', fontSize: '12px', width: '100%' }}
                />
                {modalFile && (
                  <p style={{ color: '#4ade80', fontSize: '11px', marginTop: '4px' }}>
                    ✓ {modalFile.name}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {modalError && (
              <p style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>
                {modalError}
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  flex: 1, padding: '10px', backgroundColor: 'transparent',
                  border: '1px solid #444', borderRadius: '6px',
                  color: '#888', fontSize: '13px', cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  setModalError('')
                  if (!modalAmount || parseFloat(modalAmount) <= 0) {
                    setModalError('Please enter a valid amount')
                    return
                  }
                  if (!modalMethod) {
                    setModalError('Please select a payment method')
                    return
                  }
                  if (modalType === 'deposit' && !modalFile) {
                    setModalError('Please upload payment proof')
                    return
                  }
                  if (modalType === 'withdrawal' && !withdrawAddress && !accountNumber) {
                    setModalError('Please enter your withdrawal details')
                    return
                  }
                  if (modalType === 'withdrawal' && parseFloat(modalAmount) > (wallet?.balance || 0)) {
                    setModalError('Insufficient balance')
                    return
                  }
                  setModalLoading(true)
                  const formData = new FormData()
                  formData.append('type', modalType)
                  formData.append('amount', modalAmount)
                  formData.append('currency', 'USD')
                  formData.append('payment_method', modalMethod)
                  if (modalFile) formData.append('proof', modalFile)
                  
                  if (modalType === 'withdrawal') {
                    formData.append('destination_address', withdrawAddress || accountNumber)
                    if (bankName) formData.append('bank_name', bankName)
                  }

                  const result = await submitRequest(formData)
                  setModalLoading(false)
                  if (result.success) {
                    closeModal()
                    setShowToast(true)
                    setTimeout(() => setShowToast(false), 3000)
                  } else {
                    setModalError(result.error || 'Request failed')
                  }
                }}
                style={{
                  flex: 1, padding: '10px', backgroundColor: '#FFD700',
                  border: 'none', borderRadius: '6px',
                  color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  opacity: modalLoading ? 0.7 : 1
                }}
                disabled={modalLoading}
              >
                {modalLoading ? '...' : modalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── PROFILE PANEL ── */}
      {profilePanelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: 400, maxWidth: '100%', background: '#131722', borderLeft: '1px solid #2a2e3b', display: 'flex', flexDirection: 'column', height: '100%', animation: 'slideInRight 0.3s ease-out' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #2a2e3b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', fontSize: 16, margin: 0, letterSpacing: '0.05em' }}>PROFILE SETTINGS</h3>
              <button onClick={() => setProfilePanelOpen(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Email Address</label>
                <input type="text" value={user?.email || ''} readOnly style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid #2a2e3b', borderRadius: 6, color: '#666', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Full Name</label>
                <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Phone Number</label>
                <input type="text" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Country</label>
                <input type="text" value={profileCountry} onChange={e => setProfileCountry(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <hr style={{ borderColor: '#2a2e3b', width: '100%', margin: '10px 0', borderStyle: 'solid' }} />

              <h4 style={{ color: '#FFD700', fontSize: 13, margin: '0 0 -10px', letterSpacing: '0.05em', fontWeight: 600 }}>CHANGE PASSWORD</h4>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Current Password</label>
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>New Password</label>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#888', fontSize: 11, marginBottom: 8, letterSpacing: '0.05em' }}>Confirm Password</label>
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-type new password" style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button 
                onClick={handleSavePassword}
                style={{ padding: '10px', background: 'transparent', border: '1px solid #FFD700', borderRadius: 6, color: '#FFD700', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: -4 }}
              >
                Save Password
              </button>

            </div>
            <div style={{ padding: 20, borderTop: '1px solid #2a2e3b' }}>
              <button 
                onClick={handleSaveProfile}
                style={{ width: '100%', padding: '12px', background: '#FFD700', border: 'none', borderRadius: 6, color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
              >
                SAVE PROFILE
              </button>
            </div>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}} />
    </div>
  )
}

function AssetRow({ asset, tick, active, onClick }: { asset: any, tick: any, active: boolean, onClick: () => void }) {
  const [flash, setFlash] = useState('')
  const prevP = useRef(tick?.price)
  
  useEffect(()=> {
    if (tick && prevP.current && tick.price !== prevP.current) {
       setFlash(tick.price > prevP.current ? 'flash-up' : 'flash-down')
       setTimeout(()=>setFlash(''), 600)
    }
    prevP.current = tick?.price
  }, [tick?.price])

  const buyPrice = tick ? tick.price * 1.0001 : asset.base * 1.0001
  const sellPrice = tick ? tick.price * 0.9999 : asset.base * 0.9999
  const spread = tick ? (buyPrice - sellPrice).toFixed(1) : '---'

  return (
    <div 
      onClick={onClick} 
      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderLeft: active ? '3px solid #FFD700' : '3px solid transparent', background: active ? '#1a1e2e' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }} 
      onMouseEnter={e => e.currentTarget.style.background = '#1a1e2e'} 
      onMouseLeave={e => e.currentTarget.style.background = active ? '#1a1e2e' : 'transparent'}
    >
      <div style={{ flex: 1.5, color: active ? '#fff' : '#d1d4dc', fontSize: 12, fontWeight: 600 }}>{asset.short}</div>
      <div className={flash} style={{ flex: 1, textAlign: 'right', color: active ? '#fff' : '#d1d4dc', fontFamily: 'monospace', fontSize: 12, borderRadius: 2, paddingRight: 4 }}>{fmtPrice(buyPrice)}</div>
      <div style={{ flex: 1, textAlign: 'right', color: active ? '#fff' : '#d1d4dc', fontFamily: 'monospace', fontSize: 12 }}>{fmtPrice(sellPrice)}</div>
      <div style={{ flex: 0.8, textAlign: 'right', color: '#787b86', fontFamily: 'monospace', fontSize: 11 }}>{spread}</div>
    </div>
  )
}