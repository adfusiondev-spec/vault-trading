import Link from 'next/link'
import { ShieldCheck, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0e11', fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff', position: 'relative',
    }}>

      {/* Background ambient glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 800, height: 800,
        background: 'radial-gradient(circle, rgba(255,215,0,0.05) 0%, rgba(11,14,17,0) 65%)',
        pointerEvents: 'none',
      }} />

      {/* Top-right login link */}
      <div style={{ position: 'absolute', top: 28, right: 36 }}>
        <Link href="/login" style={{
          color: '#8a8e9b', fontSize: 14, letterSpacing: '0.04em',
          textDecoration: 'none', fontWeight: 500,
          transition: 'color 0.2s',
        }}
          onMouseOver={undefined}
        >
          Already a member?{' '}
          <span style={{ color: '#FFD700', fontWeight: 600 }}>Log in</span>
        </Link>
      </div>

      {/* Centre content */}
      <div className="landing-content" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0, position: 'relative', zIndex: 1,
        animation: 'fadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>

        {/* Shield icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 16, background: '#FFD700',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(255,215,0,0.25)',
          marginBottom: 24,
        }}>
          <ShieldCheck size={36} strokeWidth={2.5} color="#000" />
        </div>

        {/* Title */}
        <h1 style={{
          fontWeight: 800, fontSize: 42, letterSpacing: '0.22em',
          margin: 0, lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          Nokhba
        </h1>

        {/* Tagline */}
        <p style={{
          color: '#8a8e9b', fontSize: 11, letterSpacing: '0.18em',
          fontWeight: 600, margin: '14px 0 0',
          textTransform: 'uppercase',
        }}>
          Secure Platform CRM System
        </p>

        {/* Divider */}
        <div style={{
          width: 40, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)',
          margin: '28px 0',
        }} />

        {/* CTA button */}
        <Link href="/signup" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '16px 40px', borderRadius: 8,
          background: '#FFD700', color: '#000',
          fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
          textDecoration: 'none', textTransform: 'uppercase',
          boxShadow: '0 4px 24px rgba(255,215,0,0.2)',
          transition: 'box-shadow 0.2s, opacity 0.2s',
          width: '100%', maxWidth: 340,
          justifyContent: 'center',
        }}>
          Start 1-Day Free Trial
          <ChevronRight size={16} strokeWidth={2.5} />
        </Link>

        {/* Sub-label */}
        <p style={{
          color: '#8a8e9b', fontSize: 13, letterSpacing: '0.04em',
          margin: '14px 0 0', fontWeight: 400,
        }}>
          Free 24-hour access. No credit card required.
        </p>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .landing-content a:hover {
          box-shadow: 0 6px 32px rgba(255,215,0,0.35) !important;
          opacity: 0.92;
        }
      `}} />
    </div>
  )
}
