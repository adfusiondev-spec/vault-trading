'use client'

import { useEffect, useRef, useMemo } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'

// ─── OHLCV mock generator ─────────────────────────────────────────────────────
export function generateOHLCV(
  basePrice: number,
  bars = 120
): { candles: CandlestickData[]; volume: HistogramData[] } {
  const candles: CandlestickData[] = []
  const volume: HistogramData[] = []

  let price = basePrice * (0.975 + Math.random() * 0.02)
  const now = Math.floor(Date.now() / 1000)
  const BAR_SEC = 60 * 60 // 1-hour bars

  for (let i = bars; i >= 0; i--) {
    const time = (now - i * BAR_SEC) as Time
    const range = basePrice * (0.008 + Math.random() * 0.014)
    const drift = (basePrice - price) * 0.03 + (Math.random() - 0.48) * range * 0.6

    const open  = price
    price = price + drift
    const close = price
    const high = Math.max(open, close) + range * Math.random() * 0.5
    const low  = Math.min(open, close) - range * Math.random() * 0.5

    const bullish = close >= open
    candles.push({ time, open, high, low, close })
    volume.push({
      time,
      value: basePrice * (0.001 + Math.random() * 0.003) * (500 + Math.random() * 2000),
      color: bullish ? 'rgba(38,166,154,0.55)' : 'rgba(239,83,80,0.55)',
    })
  }

  return { candles, volume }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  basePrice: number
  symbol: string
}

export default function CandlestickChart({ basePrice, symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volRef       = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Regenerate OHLCV data when symbol changes or first price arrives
  const { candles, volume } = useMemo(
    () => generateOHLCV(basePrice, 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, basePrice > 0]
  )

  // Create chart once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#787b86',
        fontSize: 11,
        fontFamily: "'Inter', 'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: '#171b26' },
        horzLines: { color: '#171b26' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#444',
          width: 1,
          style: 3 as any,
          labelBackgroundColor: '#2a2e3b',
        },
        horzLine: {
          color: '#444',
          width: 1,
          style: 3 as any,
          labelBackgroundColor: '#d4af37', // gold for price label
        },
      },
      rightPriceScale: {
        borderColor: '#1e222d',
        textColor: '#787b86',
        scaleMargins: { top: 0.05, bottom: 0.28 },
      },
      timeScale: {
        borderColor: '#1e222d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    // ── Candlestick series (v5 API) ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         '#26a69a',
      downColor:       '#ef5350',
      borderUpColor:   '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor:     '#26a69a',
      wickDownColor:   '#ef5350',
    })
    candleRef.current = candleSeries

    // ── Volume histogram (v5 API) ──
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    } as any)
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    })
    volRef.current = volSeries

    // Auto-resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current  = null
      candleRef.current = null
      volRef.current    = null
    }
  }, [])

  // Push new data whenever symbol / price changes
  useEffect(() => {
    if (!candleRef.current || !volRef.current) return
    candleRef.current.setData(candles)
    volRef.current.setData(volume)
    chartRef.current?.timeScale().fitContent()
  }, [candles, volume])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#0d1117' }}
    />
  )
}
