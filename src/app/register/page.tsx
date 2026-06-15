// src/app/register/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register } from '@/utils/api';
import { useTheme } from '@/hooks/useTheme';

// ─── Password strength helpers ───────────────────────────────────────────────

interface StrengthResult {
  score: number; // 0–5 (number of requirements met)
  label: string;
  color: string;
  percentage: number;
}

function calcStrength(pw: string): StrengthResult {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[!@#$%^&*]/.test(pw)) score++;

  const map: Record<number, Omit<StrengthResult, 'score'>> = {
    0: { label: 'Weak',        color: '#EF4444', percentage: 10 },
    1: { label: 'Weak',        color: '#EF4444', percentage: 20 },
    2: { label: 'Fair',        color: '#F59E0B', percentage: 50 },
    3: { label: 'Fair',        color: '#F59E0B', percentage: 60 },
    4: { label: 'Strong',      color: '#10B981', percentage: 80 },
    5: { label: 'Very Strong', color: '#06B6D4', percentage: 100 },
  };
  return { score, ...map[score] };
}

const REQUIREMENTS = [
  { key: 'len',    label: 'At least 8 characters',             test: (p: string) => p.length >= 8 },
  { key: 'upper',  label: 'Contains uppercase letter (A–Z)',   test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',  label: 'Contains lowercase letter (a–z)',   test: (p: string) => /[a-z]/.test(p) },
  { key: 'num',    label: 'Contains a number (0–9)',           test: (p: string) => /[0-9]/.test(p) },
  { key: 'sym',    label: 'Contains special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*]/.test(p) },
];

// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function ThemeToggleBtn() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      style={{
        position: 'fixed', top: '20px', right: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '40px', height: '40px', borderRadius: '50%',
        border: '1px solid var(--border-color)', background: 'var(--bg-card)',
        color: 'var(--text-secondary)', cursor: 'pointer',
        transition: 'all var(--transition-fast)', zIndex: 100, backdropFilter: 'blur(8px)',
      }}
    >
      {theme === 'light' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// ─── Eye toggle icon ──────────────────────────────────────────────────────────

function EyeBtn({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? 'Hide password' : 'Show password'}
      style={{
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center',
      }}
    >
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('storyforge_token')) {
      router.push('/');
    }
  }, [router]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const strength = calcStrength(password);
  const allReqsMet = strength.score === 5;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isFormValid = emailValid && username.trim().length >= 3 && allReqsMet && passwordsMatch && termsAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!allReqsMet) {
      setError('Password does not meet all requirements. Please check the checklist.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // NOTE: Backend only accepts username + password for now; email is UI-only (Phase 2)
      await register(username.trim(), password);
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      if (err instanceof TypeError) {
        setError('Cannot connect to server. Please check your connection and try again.');
      } else {
        const msg = (err as Error).message || '';
        if (msg.includes('500') || msg.includes('internal')) {
          setError('Something went wrong on our end. Please try again shortly.');
        } else if (msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('exists')) {
          setError('Username already taken. Please choose a different one.');
        } else {
          setError(msg || 'Registration failed. Please try a different username.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const baseInputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', paddingRight: '48px',
    borderRadius: 'var(--border-radius)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)', fontSize: '15px', outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-secondary)', marginBottom: '8px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', position: 'relative' }}>
      <ThemeToggleBtn />

      <div className="glass" style={{
        width: '100%', maxWidth: '480px', padding: isMobile ? '24px 16px' : '40px',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: 'var(--shadow-lg), var(--glow-purple)',
        border: '1px solid var(--border-color)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--gradient-primary)', boxShadow: 'var(--glow-purple-strong)',
            margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Create Account
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Sign up to start creating automated videos today.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--border-radius)',
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--accent-red)', fontSize: '14px', marginBottom: '20px',
            display: 'flex', alignItems: 'flex-start', gap: '8px',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span><span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--border-radius)',
            backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
            color: 'var(--accent-green)', fontSize: '14px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            ✅ Account created! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="reg-email" style={labelStyle}>Email</label>
            <input
              id="reg-email"
              type="email"
              required
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || success}
              style={{ ...baseInputStyle, paddingRight: '16px' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
              onBlur={(e) => { e.target.style.borderColor = email && !emailValid ? 'var(--accent-red)' : 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
            />
            {email && !emailValid && (
              <span style={{ fontSize: '12px', color: 'var(--accent-red)', marginTop: '4px', display: 'block' }}>✗ Enter a valid email address</span>
            )}
          </div>

          {/* Username */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="reg-username" style={labelStyle}>Username</label>
            <input
              id="reg-username"
              type="text"
              required
              placeholder="e.g. creative_mind"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              disabled={loading || success}
              style={{ ...baseInputStyle, paddingRight: '16px' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
            />
            {username && username.trim().length < 3 && (
              <span style={{ fontSize: '12px', color: 'var(--accent-red)', marginTop: '4px', display: 'block' }}>✗ Minimum 3 characters</span>
            )}
          </div>

          {/* Password + strength */}
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="reg-password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Min 8 chars with uppercase, number & symbol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || success}
                style={baseInputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
              <EyeBtn visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Strength</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: strength.color }}>{strength.label}</span>
                </div>
                <div style={{ height: '5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${strength.percentage}%`,
                    backgroundColor: strength.color,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                  }} />
                </div>

                {/* Checklist */}
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {REQUIREMENTS.map((req) => {
                    const met = req.test(password);
                    return (
                      <div key={req.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{
                          width: '16px', height: '16px', borderRadius: '50%',
                          backgroundColor: met ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${met ? 'var(--accent-green)' : 'var(--border-color)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.2s ease',
                        }}>
                          {met && (
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                              <polyline points="2 6 5 9 10 3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span style={{ color: met ? 'var(--accent-green)' : 'var(--text-muted)', transition: 'color 0.2s ease' }}>
                          {req.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="reg-confirm" style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || success}
                style={baseInputStyle}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
              <EyeBtn visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />
            </div>
            {confirmPassword.length > 0 && (
              <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 600, color: passwordsMatch ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords don\'t match'}
              </div>
            )}
          </div>

          {/* Terms */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <input
              id="reg-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              disabled={loading || success}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-purple)', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
            />
            <label htmlFor="reg-terms" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.5' }}>
              I agree to the{' '}
              <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Terms of Service</span>
              {' '}and{' '}
              <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Privacy Policy</span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isFormValid || loading || success}
            style={{
              width: '100%', padding: '14px', borderRadius: 'var(--border-radius)',
              background: isFormValid && !loading && !success ? 'var(--gradient-primary)' : 'rgba(100,100,120,0.25)',
              color: isFormValid && !loading && !success ? '#fff' : 'var(--text-muted)',
              fontSize: '15px', fontWeight: 600, border: 'none',
              cursor: isFormValid && !loading && !success ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all var(--transition-normal)',
              boxShadow: isFormValid && !loading ? 'var(--shadow-md), var(--glow-purple)' : 'none',
            }}
            onMouseOver={(e) => {
              if (isFormValid && !loading && !success) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--glow-purple-strong)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isFormValid && !loading ? 'var(--shadow-md), var(--glow-purple)' : 'none';
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin-fast" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Creating account...
              </>
            ) : 'Sign Up'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-purple)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in instead
          </Link>
        </div>
      </div>
    </div>
  );
}
