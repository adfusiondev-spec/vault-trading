import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TickerData {
  symbol: string      // e.g. "BTCUSDT"
  price: number
  priceChange: number
  priceChangePct: number
  high: number
  low: number
  volume: number
  flash: 'up' | 'down' | null  // triggers CSS animation
}

export type PriceMap = Record<string, TickerData>

// Symbols to subscribe to via Binance WebSocket
const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'xrpusdt', 'dogeusdt', 'adausdt', 'ltcusdt']

// Simulated instruments (must stay in sync with MARKET_GROUPS in page.tsx)
const MOCK_COMMODITIES = [
  // Precious Metals
  { symbol: 'XAUUSD', base: 2450.00, volatility: 0.5    },
  { symbol: 'XAGUSD', base: 31.20,   volatility: 0.05   },
  { symbol: 'XPTUSD', base: 980.00,  volatility: 0.3    },
  { symbol: 'XPDUSD', base: 1020.00, volatility: 0.4    },
  // Energy
  { symbol: 'WTIUSD', base: 82.40,   volatility: 0.06   },
  { symbol: 'BRTUSD', base: 85.50,   volatility: 0.06   },
  { symbol: 'NGAS',   base: 2.10,    volatility: 0.01   },
  { symbol: 'GASUSD', base: 2.45,    volatility: 0.01   },
  // FX Majors
  { symbol: 'EURUSD', base: 1.08340, volatility: 0.00008 },
  { symbol: 'GBPUSD', base: 1.26550, volatility: 0.00010 },
  { symbol: 'USDJPY', base: 151.820, volatility: 0.015   },
  { symbol: 'USDCHF', base: 0.90120, volatility: 0.00007 },
  { symbol: 'AUDUSD', base: 0.65240, volatility: 0.00006 },
  { symbol: 'USDCAD', base: 1.36500, volatility: 0.00009 },
  { symbol: 'NZDUSD', base: 0.60320, volatility: 0.00006 },
  // FX Minors
  { symbol: 'EURGBP', base: 0.85600, volatility: 0.00006 },
  { symbol: 'EURJPY', base: 163.800, volatility: 0.012   },
  { symbol: 'GBPJPY', base: 194.200, volatility: 0.015   },
  { symbol: 'USDSEK', base: 10.5200, volatility: 0.0010  },
  { symbol: 'USDNOK', base: 10.7800, volatility: 0.0010  },
  // Regional Markets
  { symbol: 'TASI',   base: 12450,   volatility: 5.0    },
  { symbol: 'ARAMCO', base: 29.40,   volatility: 0.02   },
  { symbol: 'DFM',    base: 4820.0,  volatility: 2.0    },
  { symbol: 'QE',     base: 10120,   volatility: 4.0    },
]

// ─── Chart data generator ─────────────────────────────────────────────────────
// Generates a realistic intraday walk seeded by the asset's base price.

export function generateChartData(basePrice: number, points = 60): { t: string; p: number }[] {
  const data: { t: string; p: number }[] = []
  let price = basePrice * (1 - 0.015 + Math.random() * 0.01) // start slightly below
  const now = new Date()

  for (let i = 0; i < points; i++) {
    const time = new Date(now.getTime() - (points - i) * 60000)
    const volatility = basePrice * 0.002
    price += (Math.random() - 0.48) * volatility
    data.push({ t: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), p: price })
  }
  return data
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function useMarketData() {
  const [prices, setPrices] = useState<PriceMap>({})
  const [connected, setConnected] = useState(false)
  const prevPrices = useRef<Record<string, number>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const clearFlash = useCallback((symbol: string) => {
    setPrices(prev => {
      if (!prev[symbol]) return prev
      return { ...prev, [symbol]: { ...prev[symbol], flash: null } }
    })
  }, [])

  useEffect(() => {
    // Binance combined stream — one socket for all symbols
    const streams = SYMBOLS.map(s => `${s}@ticker`).join('/')
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`

    const connect = () => {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        // Auto-reconnect after 3 s
        setTimeout(connect, 3000)
      }
      ws.onerror = () => ws.close()

      let pendingUpdates: PriceMap = {}
      let updateTimer: ReturnType<typeof setTimeout> | null = null

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          const d = msg.data
          if (!d) return

          const sym = (d.s as string).toUpperCase()
          const price = parseFloat(d.c)
          const prev = prevPrices.current[sym]

          const flash: 'up' | 'down' | null =
            prev == null ? null : price > prev ? 'up' : price < prev ? 'down' : null

          prevPrices.current[sym] = price

          pendingUpdates[sym] = {
            symbol: sym,
            price,
            priceChange: parseFloat(d.p),
            priceChangePct: parseFloat(d.P),
            high: parseFloat(d.h),
            low: parseFloat(d.l),
            volume: parseFloat(d.v),
            flash,
          }

          // Throttle updates to 300ms to avoid overwhelming HMR
          if (!updateTimer) {
            updateTimer = setTimeout(() => {
              setPrices(p => ({ ...p, ...pendingUpdates }))
              
              // Handle flash clearing for the batched updates
              Object.keys(pendingUpdates).forEach(s => {
                if (pendingUpdates[s].flash) {
                  if (flashTimers.current[s]) clearTimeout(flashTimers.current[s])
                  flashTimers.current[s] = setTimeout(() => clearFlash(s), 800)
                }
              })
              
              pendingUpdates = {}
              updateTimer = null
            }, 300)
          }
        } catch (_) {}
      }
    }

    connect()

    // ── Simulate live data for Forex / Commodities ──
    const mockPrices = MOCK_COMMODITIES.reduce((acc, c) => {
      acc[c.symbol] = {
        symbol: c.symbol, price: c.base, priceChange: 0, priceChangePct: 0,
        high: c.base * 1.01, low: c.base * 0.99, volume: c.base * 1000, flash: null,
      }
      return acc
    }, {} as PriceMap)
    setPrices(p => ({ ...p, ...mockPrices }))

    const simInterval = setInterval(() => {
      setPrices(prev => {
        let hasChanges = false
        const next = { ...prev }
        
        // 1. Pulse Mock Commodities
        MOCK_COMMODITIES.forEach(c => {
          if (Math.random() > 0.4) return
          hasChanges = true
          const old = next[c.symbol] || mockPrices[c.symbol]
          const jitter = old.price * (Math.random() - 0.5) * 0.0002 
          const newPrice = Number((old.price + jitter).toFixed(old.price < 10 ? 5 : 2))
          const flashStr = newPrice > old.price ? 'up' : newPrice < old.price ? 'down' : null

          next[c.symbol] = {
            ...old, price: newPrice,
            priceChange: Number((newPrice - c.base).toFixed(c.base < 10 ? 5 : 2)),
            priceChangePct: Number((((newPrice - c.base) / c.base) * 100).toFixed(2)),
            flash: flashStr,
          }
          if (flashStr) {
            if (flashTimers.current[c.symbol]) clearTimeout(flashTimers.current[c.symbol])
            flashTimers.current[c.symbol] = setTimeout(() => clearFlash(c.symbol), 800)
          }
        })

        // 2. Pulse Binance Crypto (Jitter for UI smoothness)
        SYMBOLS.forEach(lower => {
          const sym = lower.toUpperCase()
          if (!next[sym] || Math.random() > 0.7) return 
          hasChanges = true
          const old = next[sym]
          const jitter = old.price * (Math.random() - 0.5) * 0.0001
          const newPrice = Number((old.price + jitter).toFixed(2))
          const flashStr = newPrice > old.price ? 'up' : newPrice < old.price ? 'down' : null
          next[sym] = { ...old, price: newPrice, flash: flashStr }
          if (flashStr) {
            if (flashTimers.current[sym]) clearTimeout(flashTimers.current[sym])
            flashTimers.current[sym] = setTimeout(() => clearFlash(sym), 800)
          }
        })
        return hasChanges ? next : prev
      })
    }, 2000) // Increased interval slightly

    return () => {
      if (wsRef.current) wsRef.current.close()
      clearInterval(simInterval)
      Object.values(flashTimers.current).forEach(t => clearTimeout(t))
    }
  }, [clearFlash])


  return { prices, connected }
}
