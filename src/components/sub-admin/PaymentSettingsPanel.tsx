'use client'
import { useState, useEffect } from 'react'

interface PaymentSettings {
  usdt_address: string
  usdt_network: string
  usdt_is_active: boolean
  btc_address: string
  btc_is_active: boolean
  bank_name: string
  bank_account_holder: string
  bank_rib: string
  bank_is_active: boolean
}

const defaultSettings: PaymentSettings = {
  usdt_address: '',
  usdt_network: 'TRC20',
  usdt_is_active: true,
  btc_address: '',
  btc_is_active: true,
  bank_name: '',
  bank_account_holder: '',
  bank_rib: '',
  bank_is_active: true,
}

export default function SubAdminPaymentSettingsPanel() {
  const [settings, setSettings] = useState<PaymentSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/sub-admin-payment-settings')
      .then(r => r.json())
      .then(({ settings: s }) => { if (s) setSettings(prev => ({ ...prev, ...s })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/sub-admin-payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const result = await res.json()
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error || 'Failed to save settings.')
      }
    } catch {
      setError('An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const update = (key: keyof PaymentSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const cardStyle = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    flex: 1,
    minWidth: '260px',
  }
  const labelStyle = {
    color: '#888', fontSize: '12px',
    display: 'block', marginBottom: '6px',
  }
  const inputStyle = {
    width: '100%', padding: '10px 12px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #333', borderRadius: '6px',
    color: '#fff', fontSize: '13px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  }
  const toggleStyle = {
    display: 'flex', alignItems: 'center',
    gap: '8px', cursor: 'pointer',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <span style={{ color: '#FFD700', fontSize: '16px' }}>Loading payment settings...</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', paddingBottom: '24px' }}>

      <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>
        PAYMENT SETTINGS
      </h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>

        {/* USDT */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>USDT (Tether)</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.usdt_is_active}
                onChange={e => update('usdt_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.usdt_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>Active</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Wallet Address</label>
            <input
              type="text"
              placeholder="TRC20 address..."
              value={settings.usdt_address}
              onChange={e => update('usdt_address', e.target.value)}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Network</label>
            <select
              value={settings.usdt_network}
              onChange={e => update('usdt_network', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20</option>
              <option value="BEP20">BEP20 (BSC)</option>
            </select>
          </div>
        </div>

        {/* Bitcoin */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Bitcoin (BTC)</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.btc_is_active}
                onChange={e => update('btc_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.btc_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>Active</span>
            </label>
          </div>
          <div>
            <label style={labelStyle}>Wallet Address</label>
            <input
              type="text"
              placeholder="1A... or bc1..."
              value={settings.btc_address}
              onChange={e => update('btc_address', e.target.value)}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Bank Transfer */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Bank Transfer</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.bank_is_active}
                onChange={e => update('bank_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.bank_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>Active</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Bank Name</label>
            <input
              type="text"
              placeholder="CIH Bank / Attijariwafa..."
              value={settings.bank_name}
              onChange={e => update('bank_name', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Account Holder</label>
            <input
              type="text"
              placeholder="Full name..."
              value={settings.bank_account_holder}
              onChange={e => update('bank_account_holder', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>RIB / IBAN</label>
            <input
              type="text"
              placeholder="007 XXX XXXXXXXXXX XX"
              value={settings.bank_rib}
              onChange={e => update('bank_rib', e.target.value)}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '12px',
          backgroundColor: saving ? '#b8960a' : '#FFD700',
          border: 'none', borderRadius: '6px',
          color: '#000', fontSize: '14px', fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          letterSpacing: '0.5px',
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved Successfully' : 'Save Payment Settings'}
      </button>

    </div>
  )
}
