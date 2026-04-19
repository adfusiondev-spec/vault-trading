'use client'

import React, { useState, useEffect } from 'react'
import { Check, X, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function FinancialDesk() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = async () => {
    const adminClient = createClient()
    const { data } = await adminClient
      .from('subscription_payments')
      .select('*, profiles(full_name, company_slug, subscription_package)')
      .order('created_at', { ascending: false })
    
    if (data) setPayments(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchPayments()
    
    const supabase = createClient()
    const channel = supabase.channel('subscription-payments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_payments' }, fetchPayments)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleAction = async (id: string, newStatus: string) => {
    const adminClient = createClient()
    const payment = payments.find(p => p.id === id)
    const { error } = await adminClient.from('subscription_payments').update({ status: newStatus }).eq('id', id)
    if (error) { alert('Error updating payment: ' + error.message); return }
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))

    // Send notification to sub_admin
    if (payment?.sub_admin_id) {
      const isApproved = newStatus === 'Approved'
      await (adminClient.from('notifications') as any).insert({
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

  if (loading) {
    return <div style={{ padding: 20, color: '#8a8e9b' }}>Loading payments...</div>
  }

  return (
    <div className="crm-section fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: 0 }}>SUBSCRIPTION PAYMENTS</h2>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>DATE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>COMPANY</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PACKAGE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>METHOD</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>PROOF</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>STATUS</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>No subscription payments.</td></tr>
            ) : payments.map((fin: any) => (
              <tr key={fin.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', color: '#8a8e9b' }}>
                  {new Date(fin.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#FFD700' }}>
                  {fin.profiles?.company_slug || 'Unknown'}
                </td>
                <td style={{ padding: '12px 16px', color: '#c0c3ce' }}>
                  {fin.profiles?.subscription_package || '—'}
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>
                  ${Number(fin.amount).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px' }}>{fin.method}</td>
                <td style={{ padding: '12px 16px' }}>
                  {fin.proof_url ? (
                    <button onClick={async () => {
                      const { data } = await createClient().storage.from('payment-proofs').createSignedUrl(fin.proof_url, 120)
                      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                    }} style={{ background: 'transparent', border: '1px solid #787b86', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                      <Eye size={12}/> View Proof
                    </button>
                  ) : <span style={{ color: '#555', fontSize: 10 }}>No Receipt</span>}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                    background: fin.status === 'Approved' ? 'rgba(38,166,154,0.1)' : fin.status === 'Rejected' ? 'rgba(239,83,80,0.1)' : 'rgba(255,215,0,0.1)', 
                    color: fin.status === 'Approved' ? '#26a69a' : fin.status === 'Rejected' ? '#ef5350' : '#FFD700' 
                  }}>
                    {fin.status.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  {fin.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => handleAction(fin.id, 'Rejected')} style={{
                        width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.1)',
                        color: '#ef5350', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s'
                      }}>
                        <X size={16} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => handleAction(fin.id, 'Approved')} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 6,
                        border: '1px solid #26a69a', background: 'rgba(38,166,154,0.15)',
                        color: '#26a69a', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                      }}>
                        <Check size={16} strokeWidth={2.5} /> APPROVE
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
