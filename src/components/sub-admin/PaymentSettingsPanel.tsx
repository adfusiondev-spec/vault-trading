'use client'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/i18n'

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

export default function SubAdminPaymentSettingsPanel({ isTrial = false }: { isTrial?: boolean }) {
  const { t } = useTranslation()
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
    opacity: isTrial ? 0.6 : 1,
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
    cursor: isTrial ? 'not-allowed' : 'auto',
  }
  const toggleStyle = {
    display: 'flex', alignItems: 'center',
    gap: '8px', cursor: isTrial ? 'not-allowed' : 'pointer',
    pointerEvents: isTrial ? 'none' as const : 'auto' as const,
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <span style={{ color: '#FFD700', fontSize: '16px' }}>{t.loading_payment_settings}</span>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', paddingBottom: '24px' }}>

      <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>
        {t.payment_settings.toUpperCase()}
      </h2>

      {isTrial && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>
            {t.trial_plan_restriction}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>

        {/* USDT */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.usdt_tether}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.usdt_is_active}
                onChange={e => update('usdt_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.usdt_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>{t.active_toggle}</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.wallet_address}</label>
            <input
              type="text"
              placeholder="TRC20 address..."
              value={settings.usdt_address}
              onChange={e => update('usdt_address', e.target.value)}
              disabled={isTrial}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={labelStyle}>{t.network}</label>
            <select
              value={settings.usdt_network}
              onChange={e => update('usdt_network', e.target.value)}
              disabled={isTrial}
              style={{ ...inputStyle, cursor: isTrial ? 'not-allowed' : 'pointer' }}
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
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.bitcoin_btc}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.btc_is_active}
                onChange={e => update('btc_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.btc_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>{t.active_toggle}</span>
            </label>
          </div>
          <div>
            <label style={labelStyle}>{t.wallet_address}</label>
            <input
              type="text"
              placeholder="1A... or bc1..."
              value={settings.btc_address}
              onChange={e => update('btc_address', e.target.value)}
              disabled={isTrial}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Bank Transfer */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t.bank_transfer}</span>
            <label style={toggleStyle}>
              <input
                type="checkbox"
                checked={settings.bank_is_active}
                onChange={e => update('bank_is_active', e.target.checked)}
                style={{ accentColor: '#FFD700', width: '15px', height: '15px' }}
              />
              <span style={{ color: settings.bank_is_active ? '#FFD700' : '#6b7280', fontSize: '12px', fontWeight: 600 }}>{t.active_toggle}</span>
            </label>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.bank_name_label}</label>
            <input
              type="text"
              placeholder="CIH Bank / Attijariwafa..."
              value={settings.bank_name}
              onChange={e => update('bank_name', e.target.value)}
              disabled={isTrial}
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t.account_holder}</label>
            <input
              type="text"
              placeholder="Full name..."
              value={settings.bank_account_holder}
              onChange={e => update('bank_account_holder', e.target.value)}
              disabled={isTrial}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t.rib_iban}</label>
            <input
              type="text"
              placeholder="007 XXX XXXXXXXXXX XX"
              value={settings.bank_rib}
              onChange={e => update('bank_rib', e.target.value)}
              disabled={isTrial}
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
        disabled={saving || isTrial}
        title={isTrial ? t.trial_plan_restriction : undefined}
        style={{
          width: '100%', padding: '12px',
          backgroundColor: isTrial ? '#4b4b00' : saving ? '#b8960a' : '#FFD700',
          border: 'none', borderRadius: '6px',
          color: isTrial ? '#888' : '#000', fontSize: '14px', fontWeight: 700,
          cursor: isTrial || saving ? 'not-allowed' : 'pointer',
          letterSpacing: '0.5px',
          opacity: isTrial ? 0.5 : 1,
        }}
      >
        {isTrial ? t.trial_plan_restriction : saving ? t.saving : saved ? t.saved_successfully : t.save_payment_settings}
      </button>

    </div>
  )
}
