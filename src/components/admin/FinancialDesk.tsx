'use client'

import React, { useState } from 'react'
import { Check, X, Eye } from 'lucide-react'
import { usePendingTransactions } from '@/hooks/usePendingTransactions'

export function FinancialDesk() {
  const { pending, reviewTransaction, getProofUrl } = usePendingTransactions()
  const [companyFilter, setCompanyFilter] = useState<string>('all')

  const handleFinancialAction = async (id: string, action: 'approve' | 'reject') => {
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const result = await reviewTransaction(id, newStatus)
    if (!result.success) {
      alert(`Error updating transaction: ${result.error}`)
    }
  }

  // Filter local logic
  const filtered = companyFilter === 'all' 
    ? pending 
    : pending.filter((tx: any) => tx.profiles?.company_slug === companyFilter)

  // Unique companies
  const companies = [...new Set(pending.map((tx: any) => tx.profiles?.company_slug).filter(Boolean))] as string[]

  return (
    <div className="crm-section fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#FFD700', letterSpacing: '0.05em', margin: 0 }}>PENDING FINANCIAL REQUESTS (GLOBAL)</h2>
        
        <select 
          value={companyFilter} 
          onChange={(e) => setCompanyFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.2)', color: '#FFD700', 
            padding: '8px 16px', borderRadius: 6, outline: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          <option value="all" style={{ color: '#000' }}>All Companies</option>
          {companies.map(c => (
            <option key={c} value={c} style={{ color: '#000' }}>Tenant: {c}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead style={{ background: 'rgba(0,0,0,0.2)', color: '#8a8e9b', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>REQ ID</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>TENANT</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>USER EMAIL</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>TYPE</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>AMOUNT</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>RECEIPT</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTION PENDING</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#8a8e9b' }}>All global financial requests have been processed.</td></tr>
            ) : filtered.map((fin: any) => (
              <tr key={fin.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#8a8e9b' }}>{fin.id.substring(0,8)}...</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#FFD700' }}>{fin.profiles?.company_slug || 'Unknown'}</td>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{fin.profiles?.email || 'Unknown'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: fin.type === 'deposit' ? 'rgba(38,166,154,0.1)' : 'rgba(239,83,80,0.1)', color: fin.type === 'deposit' ? '#26a69a' : '#ef5350' }}>{fin.type.toUpperCase()}</span>
                </td>
                <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#fff', fontWeight: 600 }}>${Number(fin.amount).toLocaleString()} <span style={{ color: '#8a8e9b', fontSize: 10 }}>{fin.currency}</span></td>
                <td style={{ padding: '12px 16px' }}>
                  {fin.proof_of_payment_url ? (
                    <button onClick={async () => {
                      const url = await getProofUrl(fin.proof_of_payment_url)
                      if (url) window.open(url, '_blank')
                    }} style={{ background: 'transparent', border: '1px solid #787b86', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', borderRadius: 4, padding: '4px 10px', fontSize: 10, cursor: 'pointer' }}>
                      <Eye size={12}/> View Image
                    </button>
                  ) : <span style={{ color: '#555', fontSize: 10 }}>No Receipt</span>}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => handleFinancialAction(fin.id, 'reject')} style={{
                      width: 32, height: 32, borderRadius: 6, border: '1px solid rgba(239,83,80,0.3)', background: 'rgba(239,83,80,0.1)',
                      color: '#ef5350', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s'
                    }}>
                      <X size={16} strokeWidth={2.5} />
                    </button>
                    <button onClick={() => handleFinancialAction(fin.id, 'approve')} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 6,
                      border: '1px solid #26a69a', background: 'rgba(38,166,154,0.15)',
                      color: '#26a69a', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                    }}>
                      <Check size={16} strokeWidth={2.5} /> APPROVE
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
