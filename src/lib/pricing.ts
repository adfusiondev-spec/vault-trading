export const MARKET_OPTIONS = [
  {
    key: 'crypto',
    label: 'Crypto',
    includedInBase: true,
  },
  {
    key: 'forex',
    label: 'Forex (Majors & Minors)',
    includedInBase: true,
  },
  {
    key: 'commodities',
    label: 'Commodities (Metals & Energy)',
    includedInBase: true,
  },
  {
    key: 'global_indices',
    label: 'Global Markets (Indices & Stocks)',
    includedInBase: false,
    addon: 100,
  },
  {
    key: 'saudi_indices',
    label: 'Saudi & Regional Markets',
    includedInBase: false,
    addon: 300,
  },
]

export const BASE_PRICE = 300
export const MAX_PRICE = 700

export type PricingConfig = {
  base: number
  globalAddon: number
  saudiAddon: number
}

const DEFAULT_CONFIG: PricingConfig = { base: BASE_PRICE, globalAddon: 100, saudiAddon: 300 }

export function calculateMonthlyPrice(
  selectedMarkets: string[],
  billingCycle: 'monthly' | 'annual',
  packageType: 'Trial' | 'Standard' | 'VIP',
  config: PricingConfig = DEFAULT_CONFIG
): { monthly: number; total: number; discount: number; label: string } {
  if (packageType === 'Trial') {
    return { monthly: 0, total: 0, discount: 0, label: 'Free Trial' }
  }

  let price = config.base
  if (selectedMarkets.includes('global_indices')) price += config.globalAddon
  if (selectedMarkets.includes('saudi_indices')) price += config.saudiAddon
  price = Math.min(price, MAX_PRICE)

  const monthly = price
  const discount = billingCycle === 'annual' ? Math.round(monthly * 0.2) : 0
  const total = billingCycle === 'annual' ? Math.round(monthly * 12 * 0.8) : monthly
  const label = billingCycle === 'annual'
    ? `$${total}/year (saves $${discount * 12}/yr)`
    : `$${monthly}/month`

  return { monthly, total, discount, label }
}
