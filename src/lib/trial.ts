function isTrial(pkg?: string | null): boolean {
  if (!pkg) return false
  return pkg === 'Trial_1day' || pkg.toLowerCase() === 'trial'
}

export function isTrialExpired(profile: {
  subscription_package?: string | null
  expires_at?: string | null
}): boolean {
  if (!isTrial(profile.subscription_package)) return false
  if (!profile.expires_at) return false
  return new Date() > new Date(profile.expires_at)
}

export function isTrialActive(profile: {
  subscription_package?: string | null
  expires_at?: string | null
}): boolean {
  if (!isTrial(profile.subscription_package)) return false
  if (!profile.expires_at) return false
  return new Date() <= new Date(profile.expires_at)
}

export { isTrial }
