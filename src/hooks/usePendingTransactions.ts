import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function usePendingTransactions() {
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchPending()

    // Realtime — يظهر الطلب فوراً عند إنشائه
    const channel = supabase
      .channel('admin-transactions')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions'
      }, () => fetchPending())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchPending = async () => {
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        profiles!transactions_user_id_fkey (
          full_name, email, company_slug
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    
    setPending(data ?? [])
    setLoading(false)
  }

  const reviewTransaction = async (
    id: string, 
    action: 'approved' | 'rejected', 
    notes?: string
  ) => {
    const res = await fetch('/api/transactions/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: id, action, admin_notes: notes })
    })
    const result = await res.json()
    if (result.success) fetchPending()
    return result
  }

  const getProofUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(path, 60) // صالح لمدة 60 ثانية فقط
    return data?.signedUrl
  }

  return { pending, loading, reviewTransaction, getProofUrl }
}
