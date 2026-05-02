'use client'

import { useState, useEffect } from 'react'
export function PackageSettings() {
  const [form, setForm] = useState({ base_price: '300', global_indices_addon: '100', saudi_indices_addon: '300' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/pricing-config')
      .then(r => r.json())
      .then(d => {
        if (d.base_price !== undefined) {
          setForm({
            base_price: String(d.base_price),
            global_indices_addon: String(d.global_indices_addon),
            saudi_indices_addon: String(d.saudi_indices_addon),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setError('')
    const base_price = Number(form.base_price)
    const global_indices_addon = Number(form.global_indices_addon)
    const saudi_indices_addon = Number(form.saudi_indices_addon)

    if ([base_price, global_indices_addon, saudi_indices_addon].some(v => isNaN(v) || v < 0)) {
      setError('All prices must be valid non-negative numbers.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/pricing-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_price, global_indices_addon, saudi_indices_addon }),
    })
    const result = await res.json()
    setSaving(false)

    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.error || 'Failed to save.')
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: 700,
    outline: 'none',
    width: '120px',
    textAlign: 'right',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }

  const maxPrice = (Number(form.base_price) || 0) + (Number(form.global_indices_addon) || 0) + (Number(form.saudi_indices_addon) || 0)

  return (
    <div className="crm-section fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: '0 0 4px' }}>
          MODULE PRICING
        </h2>
        <p style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
          Set the monthly subscription prices for each market access module. Changes apply to all future cost calculations immediately.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#8a8e9b' }}>Loading...</div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '10px 20px', background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', fontSize: 11, fontWeight: 600 }}>
            <span>MODULE</span>
            <span style={{ textAlign: 'right', paddingRight: 4 }}>PRICE / MO</span>
          </div>

          {/* Base Price row */}
          <div style={rowStyle}>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Base Subscription</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Includes Crypto, Forex, and Commodities</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8a8e9b', fontSize: 13 }}>$</span>
              <input
                type="number"
                min="0"
                value={form.base_price}
                onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                style={inputStyle}
              />
              <span style={{ color: '#6b7280', fontSize: 12, width: 32 }}>/mo</span>
            </div>
          </div>

          {/* Global Indices row */}
          <div style={rowStyle}>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Global Markets Add-on</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Indices & Stocks (international)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8a8e9b', fontSize: 13 }}>+$</span>
              <input
                type="number"
                min="0"
                value={form.global_indices_addon}
                onChange={e => setForm(f => ({ ...f, global_indices_addon: e.target.value }))}
                style={inputStyle}
              />
              <span style={{ color: '#6b7280', fontSize: 12, width: 32 }}>/mo</span>
            </div>
          </div>

          {/* Saudi Markets row */}
          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Saudi & Regional Add-on</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Saudi Tadawul & GCC regional markets</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8a8e9b', fontSize: 13 }}>+$</span>
              <input
                type="number"
                min="0"
                value={form.saudi_indices_addon}
                onChange={e => setForm(f => ({ ...f, saudi_indices_addon: e.target.value }))}
                style={inputStyle}
              />
              <span style={{ color: '#6b7280', fontSize: 12, width: 32 }}>/mo</span>
            </div>
          </div>

        </div>
      )}

      {/* Max cap note */}
      <div style={{ marginTop: 12, padding: '10px 16px', background: 'rgba(255,215,0,0.04)', borderRadius: 6, border: '1px solid rgba(255,215,0,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#8a8e9b', fontSize: 12 }}>
          Max billable (all add-ons selected) — capped at <span style={{ color: '#FFD700', fontWeight: 700 }}>${700}</span>/mo
        </span>
        <span style={{ color: maxPrice > 700 ? '#ef5350' : '#26a69a', fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
          ${maxPrice}/mo {maxPrice > 700 ? '⚠ exceeds cap' : ''}
        </span>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 6, color: '#ef5350', fontSize: 12 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || loading}
        style={{
          marginTop: 16,
          width: '100%',
          padding: '12px',
          background: saved ? '#26a69a' : saving ? '#b8960a' : '#FFD700',
          border: 'none',
          borderRadius: 6,
          color: '#000',
          fontSize: 14,
          fontWeight: 700,
          cursor: saving || loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.5px',
        }}
      >
        {saved ? '✓ SAVED' : saving ? 'SAVING...' : 'SAVE CHANGES'}
      </button>
    </div>
  )
}
