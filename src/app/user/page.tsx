'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Bell, User, Wifi, LogOut, ArrowDownToLine, ArrowUpToLine,
  Search, BarChart2, Briefcase, ChevronDown, CheckCircle2,
  AlertCircle, ChevronRight, Activity, Percent
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useMarketData, type TickerData, type PriceMap } from '@/hooks/useMarketData'
import dynamic from 'next/dynamic'

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
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [wal, setWal] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [tradeAmt, setTradeAmt] = useState('')
  const [bottomTab, setBottomTab] = useState('statements')
  
  const [actionTab, setActionTab] = useState('deposit') // deposit | withdraw
  const [actionAmount, setActionAmount] = useState('')
  const [actionCurrency, setActionCurrency] = useState('USD')
  const [showToast, setShowToast] = useState(false)

  const { prices, connected } = useMarketData()
  const supabase = createClient()
  const userIdRef = useRef<string | null>(null)

  const refresh = useCallback(async (uid: string) => {
    if (!uid) return
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    if (w) setWal(w)
    
    const { data: o } = await supabase.from('trades').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (o) setOrders(o.map((x:any)=>({ id: x.id, type: x.type==='buy'?'Buy':'Sell', symbol: x.symbol, label: x.symbol, amountUSD: Number(x.amount), qty: Number(x.quantity), entryPrice: Number(x.entry_price), status: x.status==='open'?'Open':'Completed' })))
    
    const { data: t } = await supabase.from('transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (t) setTxs(t.map((x:any)=>({ 
      id: x.id, 
      type: x.type==='deposit'?'DEPOSIT':'WITHDRAWAL', 
      method: x.payment_method || 'USDT-TRC20', 
      amount: Number(x.amount), 
      currency: x.currency, 
      status: x.status.charAt(0).toUpperCase()+x.status.slice(1), 
      timestamp: new Date(x.created_at).getTime(),
      reference: `DEP-${new Date(x.created_at).getTime()}`
    })))
  }, [supabase])

  useEffect(() => {
    ensureFlashStyles()
    setMounted(true)
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        userIdRef.current = session.user.id
        const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (p) { setUser(p); refresh(session.user.id) }
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

  const handleActionSubmit = async () => {
    if (!user || parseFloat(actionAmount) <= 0) return
    let tType = actionTab === 'deposit' ? 'deposit' : 'withdrawal'
    const { error } = await supabase.from('transactions').insert({ 
      user_id: user.id, type: tType, amount: parseFloat(actionAmount), currency: actionCurrency, payment_method: 'USDT-TRC20', status: 'pending' 
    })
    if (error) alert(error.message)
    else { 
      refresh(user.id); 
      setActionAmount('')
      setShowToast(true); 
      setTimeout(() => setShowToast(false), 3000); 
    }
  }

  const execTrade = async (type: 'buy' | 'sell') => {
    if (!user || parseFloat(tradeAmt) <= 0 || isNaN(parseFloat(tradeAmt))) return
    const liveP = prices[symbol]?.price || 0
    const { error } = await supabase.rpc('execute_trade', { p_user_id: user.id, p_symbol: symbol, p_amount: parseFloat(tradeAmt), p_type: type, p_entry_price: liveP })
    if (error) alert(error.message)
    else {
      refresh(user.id)
      setTradeAmt('')
    }
  }

  const liveCurrent = prices[symbol]?.price || 0
  const baseChartPrice = useMemo(() => {
    const it = MARKET_GROUPS.flatMap(g => g.items).find(i => i.symbol === symbol)
    return it?.base || liveCurrent || 2000
  }, [symbol, liveCurrent > 0])

  if (!mounted) return null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#131722', color: '#d1d4dc', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      
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
          <Bell size={16} color="#787b86" style={{ cursor: 'pointer' }} />
          <div style={{ width: 1, height: 24, background: '#2a2e3b' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ background: '#2a2e3b', color: '#FFD700', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>G</div>
            <span style={{ fontSize: 12, color: '#d1d4dc' }}>{user?.full_name || 'Guest Trader'}</span>
            <User size={14} color="#787b86" />
          </div>
          <div style={{ width: 1, height: 24, background: '#2a2e3b' }} />
          <button onClick={async () => { await supabase.auth.signOut(); localStorage.clear(); router.push('/login') }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: '#787b86', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <LogOut size={14} /> LOGOUT
          </button>
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
             <button onClick={()=>setActionTab('withdraw')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
               <ArrowUpToLine size={12} /> Withdraw
             </button>
             <button onClick={()=>setActionTab('deposit')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFD700', border: 'none', color: '#000', padding: '4px 16px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
               <ArrowDownToLine size={12} /> Deposit
             </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR: WATCHLIST */}
        <div style={{ width: 300, background: '#131722', borderRight: '1px solid #2a2e3b', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e222d' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#FFD700' }}>Watchlist</span>
            <Search size={14} color="#787b86" />
          </div>
          <div style={{ display: 'flex', fontSize: 10, color: '#787b86', padding: '8px 16px', fontWeight: 600, borderBottom: '1px solid #1e222d' }}>
            <div style={{ flex: 1.5 }}>SYMBOL</div>
            <div style={{ flex: 1, textAlign: 'right' }}>BUY</div>
            <div style={{ flex: 1, textAlign: 'right' }}>SELL</div>
            <div style={{ flex: 0.8, textAlign: 'right' }}>SPD</div>
          </div>
          
          <div className="scroll-hide" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '12px 16px 6px', fontSize: 10, fontWeight: 700, color: '#787b86', letterSpacing: '0.05em' }}>CRYPTO · LIVE</div>
            {BINANCE_ASSETS.map(a => <AssetRow key={a.symbol} asset={a} tick={prices[a.symbol]} active={symbol===a.symbol} onClick={()=>setSymbol(a.symbol)} />)}
            
            {MARKET_GROUPS.map(g => (
              <React.Fragment key={g.category}>
                <div style={{ padding: '16px 16px 6px', fontSize: 10, fontWeight: 700, color: '#787b86', letterSpacing: '0.05em' }}>{g.category}</div>
                {g.items.map(a => <AssetRow key={a.symbol} asset={a} tick={prices[a.symbol]} active={symbol===a.symbol} onClick={()=>setSymbol(a.symbol)} />)}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* MIDDLE SECTION: CHART + TRADING + HISTORY */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid #2a2e3b' }}>
          
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
          <div style={{ padding: '16px', background: '#1a1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a2e3b' }}>
             <div style={{ display: 'flex', gap: 32 }}>
               <div>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>ASSET</div>
                 <div style={{ background: '#131722', border: '1px solid #2a2e3b', padding: '8px 12px', borderRadius: 4, color: '#fff', fontSize: 13, minWidth: 120 }}>
                   {BINANCE_ASSETS.find(x=>x.symbol===symbol)?.short || MARKET_GROUPS.flatMap(x=>x.items).find(x=>x.symbol===symbol)?.short}
                 </div>
               </div>
               <div>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>MARKET PRICE</div>
                 <div style={{ padding: '8px 0', color: '#FFD700', fontSize: 14, fontWeight: 700, minWidth: 80 }}>
                   {fmtPrice(liveCurrent)} <span style={{ fontSize: 10, color: '#787b86', fontWeight: 400 }}></span>
                 </div>
               </div>
               <div>
                 <div style={{ fontSize: 10, color: '#787b86', marginBottom: 6, fontWeight: 600 }}>AMOUNT (USD)</div>
                 <div style={{ position: 'relative' }}>
                   <span style={{ position: 'absolute', left: 10, top: 9, color: '#787b86', fontSize: 13 }}>$</span>
                   <input type="number" placeholder="0.00" value={tradeAmt} onChange={e=>setTradeAmt(e.target.value)} style={{ background: '#131722', outline: 'none', border: '1px solid #2a2e3b', padding: '8px 12px 8px 24px', borderRadius: 4, color: '#d1d4dc', fontSize: 13, width: 140 }} />
                 </div>
               </div>
             </div>
             <div style={{ display: 'flex', gap: 12 }}>
               <button onClick={()=>execTrade('buy')} style={{ width: 120, height: 40, background: '#26a69a', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                 ▲ BUY
               </button>
               <button onClick={()=>execTrade('sell')} style={{ width: 120, height: 40, background: 'transparent', border: '1px solid #ef5350', color: '#ef5350', fontWeight: 700, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}>
                 ▼ SELL
               </button>
             </div>
          </div>

          {/* History Data Table */}
          <div style={{ height: 260, background: '#131722', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #2a2e3b' }}>
              {[ 
                { id: 'open', label: `Open Positions (${orders.filter(o=>o.status==='Open').length})` },
                { id: 'pending', label: 'Pending Orders (0)' },
                { id: 'closed', label: 'Closed Positions (0)' },
                { id: 'statements', label: `Statements (${txs.length})` },
                { id: 'summary', label: 'Account Summary (0)' }
              ].map(t => (
                <button 
                  key={t.id} onClick={()=>setBottomTab(t.id)} 
                  style={{ 
                    background: 'transparent', border: 'none', padding: '12px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    color: bottomTab === t.id ? '#fff' : '#787b86',
                    borderBottom: bottomTab === t.id ? '2px solid #FFD700' : '2px solid transparent'
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }} className="scroll-hide">
              {bottomTab === 'statements' ? (
                <table style={{ width: '100%', fontSize: 11, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ color: '#787b86', borderBottom: '1px solid #1e222d' }}>
                    <tr>
                      <th style={{ padding: '12px 20px', fontWeight: 600 }}>DATE</th>
                      <th style={{ fontWeight: 600 }}>TYPE</th>
                      <th style={{ fontWeight: 600 }}>AMOUNT</th>
                      <th style={{ fontWeight: 600 }}>METHOD</th>
                      <th style={{ fontWeight: 600 }}>REFERENCE</th>
                      <th style={{ fontWeight: 600, paddingRight: 20, textAlign: 'right' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map(tx => (
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
                    {txs.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#787b86' }}>No statements found.</td></tr>}
                  </tbody>
                </table>
              ) : bottomTab === 'open' ? (
                <table style={{ width: '100%', fontSize: 11, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ color: '#787b86', borderBottom: '1px solid #1e222d' }}>
                    <tr><th style={{ padding: '12px 20px' }}>ASSET</th><th>TYPE</th><th>SIZE (USD)</th><th>ENTRY</th><th>PNL</th><th style={{textAlign: 'right', paddingRight:20}}>ACTION</th></tr>
                  </thead>
                  <tbody>
                    {orders.filter(o=>o.status==='Open').map(o => {
                      const lp = prices[o.symbol]?.price || o.entryPrice
                      const pnl = o.type==='Buy' ? (lp - o.entryPrice) * o.qty : (o.entryPrice - lp) * o.qty
                      return (
                        <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 20px', color: '#fff', fontWeight: 600 }}>{o.label}</td>
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
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#787b86', fontSize: 12 }}>No records found.</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR: ACCOUNT & DEPOSIT */}
        <div style={{ width: 320, background: '#1a1e2e', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          <div style={{ padding: 20, borderBottom: '1px solid #2a2e3b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#FFD700', color: '#000', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>G</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{user?.full_name || 'Guest Trader'}</div>
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
              ${wal ? Number(wal.balance).toLocaleString('en-US', {minimumFractionDigits: 2}) : '0.00'}
            </div>
            <div style={{ fontSize: 11, color: '#787b86' }}>USD - Available to trade</div>
          </div>

          <div style={{ padding: '0 20px', marginTop: 10 }}>
            <div style={{ display: 'flex', background: '#131722', borderRadius: 6, padding: 4, marginBottom: 24 }}>
              <button 
                onClick={()=>setActionTab('deposit')} 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: actionTab === 'deposit' ? '#2a2e3b' : 'transparent', color: actionTab === 'deposit' ? '#26a69a' : '#787b86', transition: 'all 0.2s' }}>
                <ArrowDownToLine size={14} /> Deposit
              </button>
              <button 
                onClick={()=>setActionTab('withdraw')} 
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: actionTab === 'withdraw' ? '#2a2e3b' : 'transparent', color: actionTab === 'withdraw' ? '#d1d4dc' : '#787b86', transition: 'all 0.2s' }}>
                <ArrowUpToLine size={14} /> Withdraw
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#787b86', marginBottom: 6 }}>AMOUNT</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 12, color: '#787b86', fontSize: 13 }}>$</span>
                <input type="number" placeholder="0.00" value={actionAmount} onChange={e=>setActionAmount(e.target.value)} style={{ width: '100%', background: '#131722', border: '1px solid #2a2e3b', borderRadius: 4, padding: '12px 12px 12px 24px', color: '#fff', fontSize: 14, outline: 'none' }} />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#787b86', marginBottom: 6 }}>CURRENCY</div>
              <div style={{ position: 'relative' }}>
                <select value={actionCurrency} onChange={e=>setActionCurrency(e.target.value)} style={{ width: '100%', background: '#131722', border: '1px solid #2a2e3b', borderRadius: 4, padding: '12px', color: '#fff', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <ChevronDown size={16} color="#787b86" style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none' }} />
              </div>
            </div>

            <button onClick={handleActionSubmit} style={{ width: '100%', background: actionTab==='deposit' ? '#26a69a' : '#FFD700', color: actionTab==='deposit' ? '#fff' : '#000', border: 'none', borderRadius: 4, padding: '14px', fontSize: 13, fontWeight: 800, letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s' }}>
               {actionTab === 'deposit' ? 'CONFIRM DEPOSIT' : 'REQUEST WITHDRAWAL'}
            </button>
          </div>

          {showToast && (
            <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', background: '#2a2e3b', border: '1px solid #26a69a', color: '#fff', padding: '12px 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 10, width: '90%', fontSize: 12, fontWeight: 600, animation: 'flashUp 0.3s ease-out' }}>
              <CheckCircle2 color="#26a69a" size={16} /> 
              {actionTab === 'deposit' ? 'Deposit request sent successfully!' : 'Withdrawal requested successfully!'}
            </div>
          )}

        </div>
      </div>

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