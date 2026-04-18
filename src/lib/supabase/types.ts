export type Profile = {
  id: string
  email: string
  full_name: string
  role: 'super_admin' | 'sub_admin' | 'trader'
  assigned_to: string | null
  created_at: string
  is_banned?: boolean
  subscription_package?: string
  market_access?: string[]
  phone_number?: string
  country?: string
  notes?: string
}

export type Wallet = {
  id: string
  user_id: string
  balance: number
  currency: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile>
        Update: Partial<Profile>
      }
      wallets: {
        Row: Wallet
        Insert: Partial<Wallet>
        Update: Partial<Wallet>
      }
    }
  }
}
