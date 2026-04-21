'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function FinancialDesk() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedSubPayment, setSelectedSubPayment] = useState<any>(null)
  const [subPaymentModalOpen, setSubPaymentModalOpen] = useState(false)
  const [subPaymentProofUrl, setSubPaymentProofUrl] = useState<string | null>(null)
  const [subPaymentDownloading, setSubPaymentDownloading] = useState(false)

  const supabase = createClient()

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('subscription_payments')
      .select('*, profiles(full_name, company_slug, subscription_package, email)')
      .order('created_at', { ascending: false })
    if (data) setPayments(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchPayments()
    const channel = supabase.channel('subscription-payments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payments' }, fetchPayments)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    setSubPaymentProofUrl(null)
    if (subPaymentModalOpen && selectedSubPayment?.proof_url) {
      supabase.storage
        .from('payment-proofs')
        .createSignedUrl(selectedSubPayment.proof_url, 300)
        .then(({ data }) => {
          if (data?.signedUrl) setSubPaymentProofUrl(data.signedUrl)
        })
    }
  }, [selectedSubPayment?.id, subPaymentModalOpen])

  const handleAction = async (id: string, newStatus: string) => {
    const payment = payments.find(p => p.id === id)
    const { error } = await (supabase.from('subscription_payments') as any).update({ status: newStatus }).eq('id', id)
    if (error) { alert('Error updating payment: ' + error.message); return }
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    if (selectedSubPayment?.id === id) {
      setSelectedSubPayment((prev: any) => prev ? { ...prev, status: newStatus } : prev)
    }

    if (payment?.sub_admin_id) {
      const isApproved = newStatus === 'Approved'
      await (supabase.from('notifications') as any).insert({
        user_id: payment.sub_admin_id,
        user_role: 'sub_admin',
        title: isApproved ? 'Subscription Approved' : 'Subscription Rejected',
        message: isApproved
          ? `Your subscription payment of $${Number(payment.amount).toLocaleString()} has been approved. Your account is now active.`
          : `Your subscription payment of $${Number(payment.amount).toLocaleString()} was rejected. Please contact support.`,
        read: false,
      })
    }
  }

  const handleSubPaymentDownload = async () => {
    if (!subPaymentProofUrl) return
    setSubPaymentDownloading(true)
    try {
      const response = await fetch(subPaymentProofUrl)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('pdf') ? 'pdf' : 'jpg'
      link.download = `sub-proof-${selectedSubPayment?.id?.slice(0, 8) ?? 'payment'}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
    } catch {
      window.open(subPaymentProofUrl, '_blank')
    } finally {
      setSubPaymentDownloading(false)
    }
  }

  const SubPaymentDetailModal = () => {
    if (!subPaymentModalOpen || !selectedSubPayment) return null
    const sp = selectedSubPayment

    const row = (label: string, value: any) => (
      <div style={{ display: 'flex', justifyContent: 'space-between',
        borderBottom: '1px solid #1f1f1f', padding: '10px 0', gap: '16px' }}>
        <span style={{ color: '#9ca3af', fontSize: '13px', minWidth: '130px' }}>{label}</span>
        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '600',
          textAlign: 'right', wordBreak: 'break-all' }}>{value ?? '—'}</span>
      </div>
    )

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px' }}
        onClick={() => setSubPaymentModalOpen(false)}>
        <div style={{ background: '#0f0f0f', border: '1px solid #FFD700',
          borderRadius: '14px', width: '100%', maxWidth: '680px',
          maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
          onClick={(e) => e.stopPropagation()}>

          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ color: '#FFD700', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                $ Subscription Payment Details
              </h2>
              <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0' }}>
                {sp.profiles?.company_slug || sp.profiles?.email || '—'}
              </p>
            </div>
            <button onClick={() => setSubPaymentModalOpen(false)}
              style={{ background: 'none', border: 'none', color: '#9ca3af',
                fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold',
                letterSpacing: '1px', marginBottom: '8px' }}>PAYMENT INFO</div>
              {row('Date', new Date(sp.created_at).toLocaleString())}
              {row('Company', sp.profiles?.company_slug || sp.profiles?.full_name || '—')}
              {row('Package',
                <span style={{
                  padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                  background: sp.package === 'VIP' ? 'rgba(34,197,94,0.15)'
                             : sp.package === 'Standard' ? 'rgba(255,215,0,0.15)'
                             : 'rgba(107,114,128,0.15)',
                  color: sp.package === 'VIP' ? '#22c55e'
                       : sp.package === 'Standard' ? '#FFD700' : '#9ca3af',
                  border: `1px solid ${sp.package === 'VIP' ? '#22c55e'
                       : sp.package === 'Standard' ? '#FFD700' : '#6b7280'}`,
                }}>{sp.package || '—'}</span>
              )}
              {row('Amount', `$${Number(sp.amount).toFixed(2)}`)}
              {row('Method', sp.method?.toUpperCase() || '—')}
              {row('Reference', sp.reference || '—')}
              {row('Status',
                <span style={{
                  color: sp.status === 'Approved' ? '#22c55e'
                       : sp.status === 'Rejected' ? '#ef4444' : '#f59e0b',
                  fontWeight: 'bold', textTransform: 'uppercase',
                }}>{sp.status}</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 'bold',
                letterSpacing: '1px', marginBottom: '8px' }}>PAYMENT PROOF</div>
              {subPaymentProofUrl ? (
                <div>
                  <img src={subPaymentProofUrl} alt="Payment Proof"
                    style={{ width: '100%', borderRadius: '8px',
                      border: '1px solid #333', maxHeight: '260px',
                      objectFit: 'contain', background: '#1a1a1a', display: 'block' }} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <a href={subPaymentProofUrl} target="_blank" rel="noreferrer"
                      style={{ flex: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: '8px',
                        background: 'transparent', border: '1px solid #374151',
                        color: '#9ca3af', borderRadius: '6px',
                        fontSize: '12px', textDecoration: 'none' }}>
                      ↗ Open
                    </a>
                    <button onClick={handleSubPaymentDownload}
                      disabled={subPaymentDownloading}
                      style={{ flex: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: '8px',
                        background: subPaymentDownloading ? '#b8950a' : '#FFD700',
                        border: 'none', color: '#000', borderRadius: '6px',
                        fontSize: '12px', fontWeight: 'bold',
                        cursor: subPaymentDownloading ? 'not-allowed' : 'pointer' }}>
                      {subPaymentDownloading ? '...' : '↓ Download'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px', background: '#111',
                  borderRadius: '8px', border: '1px dashed #333', textAlign: 'center' }}>
                  <p style={{ color: '#4b5563', fontSize: '13px', margin: 0 }}>
                    No payment proof uploaded.
                  </p>
                </div>
              )}
            </div>
          </div>

          {(sp.status === 'Pending' || sp.status === 'pending') && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button
                onClick={async () => {
                  await handleAction(sp.id, 'Approved')
                  setSubPaymentModalOpen(false)
                }}
                style={{ flex: 1, padding: '12px', background: 'transparent',
                  border: '2px solid #22c55e', color: '#22c55e',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '6px' }}>
                ✓ Approve
              </button>
              <button
                onClick={async () => {
                  await handleAction(sp.id, 'Rejected')
                  setSubPaymentModalOpen(false)
                }}
                style={{ flex: 1, padding: '12px', background: 'transparent',
                  border: '2px solid #ef4444', color: '#ef4444',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '6px' }}>
                ✕ Reject
              </button>
            </div>
          )}

          {sp.status !== 'Pending' && sp.status !== 'pending' && (
            <p style={{ textAlign: 'center', color: '#6b7280',
              fontSize: '13px', marginTop: '20px' }}>
              This payment has been {sp.status?.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#8a8e9b' }}>Loading payments...</div>
  }

  return (
    <>
      <SubPaymentDetailModal />
      <div className="crm-section fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: 0 }}>SUBSCRIPTION PAYMENTS</h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                {['DATE', 'COMPANY', 'PACKAGE', 'AMOUNT', 'METHOD', 'STATUS', 'DETAIL'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: '#6b7280',
                    fontWeight: '600',
                    fontSize: '11px',
                    letterSpacing: '0.5px',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No subscription payments.</td></tr>
              ) : payments.map((fin: any) => (
                <tr key={fin.id}
                  style={{ borderBottom: '1px solid #111' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#111')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', color: '#9ca3af', whiteSpace: 'nowrap', fontSize: '13px' }}>
                    {new Date(fin.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                    <span style={{ color: '#FFD700', fontWeight: '600' }}>
                      {fin.profiles?.company_slug || fin.profiles?.full_name || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '13px' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                      background: fin.package === 'VIP' ? 'rgba(34,197,94,0.15)'
                               : fin.package === 'Standard' ? 'rgba(255,215,0,0.15)'
                               : 'rgba(107,114,128,0.15)',
                      color: fin.package === 'VIP' ? '#22c55e'
                           : fin.package === 'Standard' ? '#FFD700' : '#9ca3af',
                      border: `1px solid ${fin.package === 'VIP' ? '#22c55e'
                           : fin.package === 'Standard' ? '#FFD700' : '#6b7280'}`,
                    }}>
                      {fin.package || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#fff', fontWeight: '600', fontSize: '13px' }}>
                    ${Number(fin.amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#9ca3af', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {fin.method?.toUpperCase() || '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                      fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap',
                      background: fin.status === 'Approved' ? 'rgba(34,197,94,0.15)'
                               : fin.status === 'Rejected'  ? 'rgba(239,68,68,0.15)'
                               : 'rgba(245,158,11,0.15)',
                      color: fin.status === 'Approved' ? '#22c55e'
                           : fin.status === 'Rejected'  ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${
                        fin.status === 'Approved' ? '#22c55e'
                      : fin.status === 'Rejected'  ? '#ef4444' : '#f59e0b'}`,
                    }}>
                      {fin.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={() => {
                        setSelectedSubPayment(fin)
                        setSubPaymentModalOpen(true)
                      }}
                      style={{
                        padding: '6px 16px', background: 'transparent',
                        border: '1px solid #FFD700', color: '#FFD700',
                        borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                      DETAIL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
