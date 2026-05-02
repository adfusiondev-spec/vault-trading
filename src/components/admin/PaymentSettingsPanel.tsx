'use client'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

export default function PaymentSettingsPanel() {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({
    usdt_address: '',
    usdt_network: 'TRC20',
    usdt_is_active: true,
    btc_address: '',
    btc_is_active: true,
    bank_name: '',
    bank_account_holder: '',
    bank_rib: '',
    bank_swift: '',
    bank_is_active: true,
  })

  useEffect(() => {
    fetch('/api/payment-settings')
      .then(r => r.json())
      .then(({ settings: s }) => { if (s) setSettings(prev => ({ ...prev, ...s })) })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const res = await fetch('/api/payment-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    const result = await res.json()
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError(result.error || 'Failed to save')
    }
  }

  const cardStyle = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px'
  }
  const labelStyle = {
    color: '#888', fontSize: '12px',
    display: 'block', marginBottom: '6px'
  }
  const inputStyle = {
    width: '100%', padding: '10px 12px',
    backgroundColor: '#0d0d0d',
    border: '1px solid #333', borderRadius: '6px',
    color: '#fff', fontSize: '13px',
    boxSizing: 'border-box' as const
  }
  const toggleStyle = {
    display: 'flex', alignItems: 'center',
    gap: '8px', cursor: 'pointer'
  }

  return (
    <div style={{ width: '100%', paddingBottom: '24px' }}>

      <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>
        {t.payment_settings.toUpperCase()}
      </h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>

        {/* USDT */}
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.usdt_tether}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.usdt_is_active}
                onChange={e => setSettings(p => ({ ...p, usdt_is_active: e.target.checked }))}
              />
              <span style={{ color: '#888', fontSize: '12px' }}>{t.active_toggle}</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.wallet_address}</label>
            <input
              type="text"
              value={settings.usdt_address}
              onChange={e => setSettings(p => ({ ...p, usdt_address: e.target.value }))}
              placeholder="TRC20 address..."
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={labelStyle}>{t.network}</label>
            <select
              value={settings.usdt_network}
              onChange={e => setSettings(p => ({ ...p, usdt_network: e.target.value }))}
              style={inputStyle}
            >
              <option value="TRC20">TRC20</option>
              <option value="ERC20">ERC20</option>
              <option value="BEP20">BEP20 (BSC)</option>
            </select>
          </div>
        </div>

        {/* Bitcoin */}
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.bitcoin_btc}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.btc_is_active}
                onChange={e => setSettings(p => ({ ...p, btc_is_active: e.target.checked }))}
              />
              <span style={{ color: '#888', fontSize: '12px' }}>{t.active_toggle}</span>
            </label>
          </div>
          <div>
            <label style={labelStyle}>{t.wallet_address}</label>
            <input
              type="text"
              value={settings.btc_address}
              onChange={e => setSettings(p => ({ ...p, btc_address: e.target.value }))}
              placeholder="1A... or bc1..."
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Bank Transfer */}
        <div style={{ ...cardStyle, flex: 1, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.bank_transfer}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.bank_is_active}
                onChange={e => setSettings(p => ({ ...p, bank_is_active: e.target.checked }))}
              />
              <span style={{ color: '#888', fontSize: '12px' }}>{t.active_toggle}</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.bank_name_label}</label>
            <input
              type="text"
              value={settings.bank_name}
              onChange={e => setSettings(p => ({ ...p, bank_name: e.target.value }))}
              placeholder="CIH Bank / Attijariwafa..."
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.account_holder}</label>
            <input
              type="text"
              value={settings.bank_account_holder}
              onChange={e => setSettings(p => ({ ...p, bank_account_holder: e.target.value }))}
              placeholder="Full name..."
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t.rib_iban}</label>
            <input
              type="text"
              value={settings.bank_rib}
              onChange={e => setSettings(p => ({ ...p, bank_rib: e.target.value }))}
              placeholder="007 XXX XXXXXXXXXX XX"
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
          <div style={{ marginTop: '12px' }}>
            <label style={labelStyle}>{t.swift_bic_code}</label>
            <input
              type="text"
              value={settings.bank_swift}
              onChange={e => setSettings(p => ({ ...p, bank_swift: e.target.value }))}
              placeholder="AAAABBCCXXX"
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
          cursor: saving ? 'not-allowed' : 'pointer'
        }}
      >
        {saving ? t.saving : saved ? t.saved_successfully : t.save_payment_settings}
      </button>

    </div>
  )
}
