'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n'

type Package = {
  id: string
  key: string
  label: string
  monthly_price: number
  yearly_price: number
  is_active: boolean
  sort_order: number
}

const emptyForm = { key: '', label: '', monthly_price: '', yearly_price: '' }

export function PackageSettings() {
  const { t } = useTranslation()
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const fetch = async () => {
    const { data } = await (supabase as any)
      .from('subscription_packages')
      .select('*')
      .order('sort_order')
    setPackages(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const startEdit = (pkg: Package) => {
    setEditingId(pkg.id)
    setForm({ key: pkg.key, label: pkg.label, monthly_price: String(pkg.monthly_price), yearly_price: String(pkg.yearly_price) })
    setShowAdd(false)
    setError('')
  }

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm); setError('') }

  const validate = () => {
    if (!form.key.trim() || !form.label.trim()) return 'Key and label are required.'
    if (!/^[a-z0-9_]+$/.test(form.key)) return 'Key must be lowercase letters, numbers, or underscores.'
    if (isNaN(Number(form.monthly_price)) || Number(form.monthly_price) < 0) return 'Invalid monthly price.'
    if (isNaN(Number(form.yearly_price)) || Number(form.yearly_price) < 0) return 'Invalid yearly price.'
    return ''
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true); setError('')
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      monthly_price: Number(form.monthly_price),
      yearly_price: Number(form.yearly_price),
    }
    if (editingId) {
      const { error } = await (supabase as any).from('subscription_packages').update(payload).eq('id', editingId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await (supabase as any).from('subscription_packages').insert({ ...payload, sort_order: packages.length + 1 })
      if (error) { setError(error.message); setSaving(false); return }
    }
    await fetch()
    cancelEdit()
    setShowAdd(false)
    setSaving(false)
  }

  const handleToggle = async (pkg: Package) => {
    await (supabase as any).from('subscription_packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id)
    await fetch()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package? Sub-admins will no longer see it in the subscription modal.')) return
    await (supabase as any).from('subscription_packages').delete().eq('id', id)
    await fetch()
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none', width: '100%',
  }

  const FormRow = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto', gap: 10, alignItems: 'center', padding: '12px 16px', background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <input placeholder="key (e.g. pro)" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} style={inputStyle} disabled={!!editingId} />
      <input placeholder="Label (e.g. Pro)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputStyle} />
      <input placeholder="Monthly price" type="number" min="0" value={form.monthly_price} onChange={e => setForm(f => ({ ...f, monthly_price: e.target.value }))} style={inputStyle} />
      <input placeholder="Yearly price" type="number" min="0" value={form.yearly_price} onChange={e => setForm(f => ({ ...f, yearly_price: e.target.value }))} style={inputStyle} />
      <button onClick={handleSave} disabled={saving} style={{ background: '#FFD700', border: 'none', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#000' }}>
        {saving ? '...' : <Check size={14} />}
      </button>
      <button onClick={() => { cancelEdit(); setShowAdd(false) }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', color: '#8a8e9b' }}>
        <X size={14} />
      </button>
    </div>
  )

  return (
    <div className="crm-section fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: 0 }}>{t.subscription_packages}</h2>
        {!showAdd && !editingId && (
          <button onClick={() => { setShowAdd(true); setForm(emptyForm); setError('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFD700', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#000' }}>
            <Plus size={14} /> {t.add_package}
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 6, color: '#ef5350', fontSize: 12 }}>{error}</div>}

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px 100px', gap: 10, padding: '10px 16px', background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span>{t.pkg_key}</span>
          <span>{t.pkg_label}</span>
          <span>{t.monthly_usd}</span>
          <span>{t.yearly_usd}</span>
          <span>{t.status.toUpperCase()}</span>
          <span style={{ textAlign: 'right' }}>{t.actions.toUpperCase()}</span>
        </div>

        {showAdd && !editingId && <FormRow />}

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#8a8e9b' }}>{t.loading}</div>
        ) : packages.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#8a8e9b' }}>{t.no_packages}</div>
        ) : packages.map(pkg => (
          <React.Fragment key={pkg.id}>
            {editingId === pkg.id ? (
              <FormRow />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 80px 100px', gap: 10, alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: pkg.is_active ? 1 : 0.5 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#FFD700' }}>{pkg.key}</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{pkg.label}</span>
                <span style={{ fontFamily: 'monospace', color: '#26a69a' }}>${pkg.monthly_price.toFixed(2)}/mo</span>
                <span style={{ fontFamily: 'monospace', color: '#26a69a' }}>${pkg.yearly_price.toFixed(2)}/yr</span>
                <span>
                  <button onClick={() => handleToggle(pkg)} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: pkg.is_active ? 'rgba(38,166,154,0.15)' : 'rgba(255,255,255,0.07)', color: pkg.is_active ? '#26a69a' : '#8a8e9b' }}>
                    {pkg.is_active ? t.active_status : t.off_status}
                  </button>
                </span>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => startEdit(pkg)} style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: '#FFD700' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(pkg.id)} style={{ background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.2)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: '#ef5350' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
