export function isTrialExpired(profile: {
  subscription_package?: string | null
  expires_at?: string | null
}): boolean {
  if (profile.subscription_package !== 'Trial_1day') return false
  if (!profile.expires_at) return false
  return new Date() > new Date(profile.expires_at)
}

export function isTrialActive(profile: {
  subscription_package?: string | null
  expires_at?: string | null
}): boolean {
  if (profile.subscription_package !== 'Trial_1day') return false
  if (!profile.expires_at) return false
  return new Date() <= new Date(profile.expires_at)
}
