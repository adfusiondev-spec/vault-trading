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

export function calculateMonthlyPrice(
  selectedMarkets: string[],
  billingCycle: 'monthly' | 'annual',
  packageType: 'Trial' | 'Standard' | 'VIP'
): { monthly: number; total: number; discount: number; label: string } {
  if (packageType === 'Trial') {
    return { monthly: 0, total: 0, discount: 0, label: 'Free Trial' }
  }

  let price = BASE_PRICE
  if (selectedMarkets.includes('global_indices')) price += 100
  if (selectedMarkets.includes('saudi_indices')) price += 300
  price = Math.min(price, MAX_PRICE)

  const monthly = price
  const discount = billingCycle === 'annual' ? Math.round(monthly * 0.2) : 0
  const total = billingCycle === 'annual' ? Math.round(monthly * 12 * 0.8) : monthly
  const label = billingCycle === 'annual'
    ? `$${total}/year (saves $${discount * 12}/yr)`
    : `$${monthly}/month`

  return { monthly, total, discount, label }
}
