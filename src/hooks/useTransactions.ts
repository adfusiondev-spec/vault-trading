import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useTransactions(userId: string) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [wallet, setWallet] = useState<{ balance: number; currency: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    fetchData()

    // Realtime — تحديث فوري عند تغيير حالة الطلب
    const channel = supabase
      .channel('user-transactions')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`
      }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const fetchData = async () => {
    const [txResult, walletResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', userId)
        .single()
    ])
    
    setTransactions(txResult.data ?? [])
    setWallet(walletResult.data)
    setLoading(false)
  }

  const submitRequest = async (formData: FormData) => {
    const res = await fetch('/api/transactions/create', {
      method: 'POST',
      body: formData
    })
    const result = await res.json()
    if (result.success) fetchData()
    return result
  }

  return { transactions, wallet, loading, submitRequest }
}
