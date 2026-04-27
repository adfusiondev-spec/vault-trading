'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ChevronRight } from 'lucide-react'

const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
  'Egypt', 'Jordan', 'Lebanon', 'Iraq', 'Morocco', 'Tunisia', 'Algeria', 'Libya',
  'United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia',
  'Turkey', 'Pakistan', 'India', 'Other',
]

type Field = 'company_name' | 'full_name' | 'email' | 'password' | 'phone_number' | 'country'

export default function SignupPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [focusedField, setFocusedField] = useState<Field | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    company_name: '',
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
    country: '',
  })

  useEffect(() => { setMounted(true) }, [])

  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      router.push('/login?msg=Account+created+successfully.+Please+log+in.')
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputStyle = (field: Field): React.CSSProperties => ({
    width: '100%',
    padding: '14px 16px',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.02)',
    border: focusedField === field ? '1px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    boxSizing: 'border-box',
  })

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#8a8e9b',
    fontSize: 11,
    letterSpacing: '0.08em',
    fontWeight: 600,
    marginBottom: 8,
  }

  const isValid =
    form.company_name.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    form.phone_number.trim() &&
    form.country

  return (
    <div className="signup-wrapper" style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0e11', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff',
    }}>

      {/* Background ambient glow */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(255,215,0,0.03) 0%, rgba(11,14,17,0) 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Card — 650px wide, 2-column grid layout */}
      <div style={{
        width: '100%', maxWidth: 650, padding: '32px 40px 28px',
        background: 'rgba(11,14,17,0.7)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,215,0,0.15)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.05)',
        borderRadius: 12, position: 'relative', zIndex: 10,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(15px)',
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: '#FFD700',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            boxShadow: '0 4px 15px rgba(255,215,0,0.2)',
          }}>
            <ShieldCheck size={24} strokeWidth={2.5} color="#000" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 20, letterSpacing: '0.15em', marginBottom: 4 }}>Nokhba</h1>
          <p style={{ color: '#8a8e9b', fontSize: 12, letterSpacing: '0.05em' }}>1-Day Free Trial</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── 2-column grid for all 6 fields ── */}
          <div className="signup-grid">

            {/* Row 1 — Left: Company Name */}
            <div>
              <label style={labelStyle}>COMPANY NAME</label>
              <input
                type="text"
                value={form.company_name}
                onChange={set('company_name')}
                onFocus={() => setFocusedField('company_name')}
                onBlur={() => setFocusedField(null)}
                placeholder="Acme Trading Co."
                required
                style={inputStyle('company_name')}
              />
            </div>

            {/* Row 1 — Right: Administrator Name */}
            <div>
              <label style={labelStyle}>
                ADMINISTRATOR NAME{' '}
                <span style={{ color: '#4b5563', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={set('full_name')}
                onFocus={() => setFocusedField('full_name')}
                onBlur={() => setFocusedField(null)}
                placeholder="John Smith"
                style={inputStyle('full_name')}
              />
            </div>

            {/* Row 2 — Left: Email */}
            <div>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="admin@company.io"
                required
                style={{ ...inputStyle('email'), fontFamily: 'monospace' }}
              />
            </div>

            {/* Row 2 — Right: Password */}
            <div>
              <label style={labelStyle}>PASSWORD</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="••••••••••••"
                required
                minLength={6}
                style={{ ...inputStyle('password'), fontFamily: 'monospace', letterSpacing: '0.15em' }}
              />
            </div>

            {/* Row 3 — Left: Phone Number */}
            <div>
              <label style={labelStyle}>PHONE NUMBER</label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={set('phone_number')}
                onFocus={() => setFocusedField('phone_number')}
                onBlur={() => setFocusedField(null)}
                placeholder="+1 555 000 0000"
                required
                style={inputStyle('phone_number')}
              />
            </div>

            {/* Row 3 — Right: Country */}
            <div>
              <label style={labelStyle}>COUNTRY</label>
              <select
                value={form.country}
                onChange={set('country')}
                onFocus={() => setFocusedField('country')}
                onBlur={() => setFocusedField(null)}
                required
                style={{
                  ...inputStyle('country'),
                  appearance: 'none',
                  cursor: 'pointer',
                  color: form.country ? '#fff' : '#4b5563',
                }}
              >
                <option value="" disabled style={{ color: '#4b5563', background: '#0b0e11' }}>Select your country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c} style={{ background: '#0b0e11', color: '#fff' }}>{c}</option>
                ))}
              </select>
            </div>

          </div>{/* end signup-grid */}

          {/* Error — full width */}
          {error && (
            <div style={{
              color: '#EF5350', fontSize: 12, letterSpacing: '0.02em',
              background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.2)',
              borderRadius: 6, padding: '10px 14px',
            }}>
              {error}
            </div>
          )}

          {/* Submit — full width */}
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            style={{
              marginTop: 4, padding: '14px 0', width: '100%', borderRadius: 6,
              background: '#FFD700', border: 'none', cursor: isSubmitting || !isValid ? 'not-allowed' : 'pointer',
              color: '#000', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
              opacity: isSubmitting || !isValid ? 0.7 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {isSubmitting ? (
              <div style={{
                width: 18, height: 18, border: '2px solid rgba(0,0,0,0.2)',
                borderTopColor: '#000', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <>START FREE TRIAL <ChevronRight size={16} strokeWidth={2.5} /></>
            )}
          </button>
        </form>

        {/* Footer — full width */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ color: '#8a8e9b', fontSize: 12 }}>
            Already a member?{' '}
            <Link href="/login" style={{ color: '#FFD700', textDecoration: 'none', fontWeight: 600 }}>
              Log in
            </Link>
          </p>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }

        /* 2-column grid — desktop default */
        .signup-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        /* Mobile: collapse to 1 column and allow scroll */
        @media (max-width: 640px) {
          .signup-grid { grid-template-columns: 1fr; }
          .signup-wrapper {
            overflow-y: auto !important;
            align-items: flex-start !important;
            padding: 40px 16px !important;
          }
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #0b0e11 inset !important;
          -webkit-text-fill-color: white !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        select option { background: #0b0e11; color: #fff; }
      `}} />
    </div>
  )
}
