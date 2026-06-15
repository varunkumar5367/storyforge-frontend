// src/app/login/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login } from '@/utils/api';
import { useTheme } from '@/hooks/useTheme';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function ThemeToggleBtn() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-card)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On mount: check existing auth, lockout state, and remember-me
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('storyforge_token')) {
      router.push('/');
      return;
    }
    const lockoutUntil = parseInt(localStorage.getItem('storyforge_lockout_until') || '0');
    if (lockoutUntil > Date.now()) {
      setIsLocked(true);
    }
    setRememberMe(localStorage.getItem('storyforge_remember') === 'true');
  }, [router]);

  // Live countdown when locked
  useEffect(() => {
    if (!isLocked) return;
    const interval = setInterval(() => {
      const lockoutUntil = parseInt(localStorage.getItem('storyforge_lockout_until') || '0');
      if (lockoutUntil <= Date.now()) {
        localStorage.removeItem('storyforge_fail_count');
        localStorage.removeItem('storyforge_lockout_until');
        setIsLocked(false);
        setError(null);
        return;
      }
      const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      const mm = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
      const ss = (secondsLeft % 60).toString().padStart(2, '0');
      setError(`Too many failed attempts. Please try again in ${mm}:${ss}.`);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || loading) return;

    // Double-check lockout (could have been set on another tab)
    const lockoutUntil = parseInt(localStorage.getItem('storyforge_lockout_until') || '0');
    if (lockoutUntil > Date.now()) { setIsLocked(true); return; }

    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      localStorage.removeItem('storyforge_fail_count');
      localStorage.removeItem('storyforge_lockout_until');
      if (rememberMe) {
        localStorage.setItem('storyforge_remember', 'true');
      } else {
        localStorage.removeItem('storyforge_remember');
      }
      window.dispatchEvent(new Event('auth-changed'));
      router.push('/');
    } catch (err: unknown) {
      const failCount = parseInt(localStorage.getItem('storyforge_fail_count') || '0');
      const newCount = failCount + 1;
      localStorage.setItem('storyforge_fail_count', newCount.toString());

      if (newCount >= MAX_ATTEMPTS) {
        localStorage.setItem('storyforge_lockout_until', (Date.now() + LOCKOUT_DURATION_MS).toString());
        localStorage.removeItem('storyforge_fail_count');
        setIsLocked(true);
        setError('Too many failed attempts. Please try again in 30:00.');
      } else {
        // Classify error type
        if (err instanceof TypeError) {
          setError('Cannot connect to server. Please check your connection and try again.');
        } else {
          const msg = (err as Error).message || '';
          if (msg.includes('500') || msg.includes('internal')) {
            setError('Something went wrong on our end. Please try again shortly.');
          } else {
            setError('Invalid credentials. Please check your username and password.');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const baseInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--border-radius)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', position: 'relative' }}>
      <ThemeToggleBtn />

      <div className="glass" style={{
        width: '100%',
        maxWidth: '440px',
        padding: isMobile ? '24px 16px' : '40px',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: 'var(--shadow-lg), var(--glow-purple)',
        border: '1px solid var(--border-color)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--gradient-primary)', boxShadow: 'var(--glow-purple-strong)',
            margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '8px', color: 'var(--text-primary)' }}>
            Welcome to StoryForge
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Please log in to your account to continue.
          </p>
        </div>

        {/* Error / Lockout Banner */}
        {error && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--border-radius)',
            backgroundColor: isLocked ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isLocked ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.2)'}`,
            color: isLocked ? 'var(--accent-orange)' : 'var(--accent-red)',
            fontSize: '14px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            lineHeight: '1.4',
          }}>
            <span style={{ flexShrink: 0 }}>{isLocked ? '🔒' : '⚠️'}</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login-username" style={labelStyle}>Username</label>
            <input
              id="login-username"
              type="text"
              required
              placeholder="e.g. varun5367"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || isLocked}
              style={baseInputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Password + visibility toggle */}
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="login-password" style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isLocked}
                style={{ ...baseInputStyle, paddingRight: '48px' }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.boxShadow = 'var(--glow-purple)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading || isLocked}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center',
                  transition: 'color var(--transition-fast)',
                }}
              >
                {showPassword ? (
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
            </div>
          </div>

          {/* Remember Me */}
          <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              id="login-remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading || isLocked}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-purple)', cursor: 'pointer', flexShrink: 0 }}
            />
            <label htmlFor="login-remember" style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              Remember Me
            </label>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading || isLocked}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 'var(--border-radius)',
              background: isLocked ? 'rgba(100,100,120,0.25)' : 'var(--gradient-primary)',
              color: isLocked ? 'var(--text-muted)' : '#fff',
              fontSize: '15px', fontWeight: 600, border: 'none',
              cursor: loading || isLocked ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all var(--transition-normal)',
              boxShadow: isLocked ? 'none' : 'var(--shadow-md), var(--glow-purple)',
            }}
            onMouseOver={(e) => {
              if (!loading && !isLocked) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--glow-purple-strong)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isLocked ? 'none' : 'var(--shadow-md), var(--glow-purple)';
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin-fast" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Signing in...
              </>
            ) : isLocked ? '🔒 Account Locked' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: '28px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'var(--accent-purple)', fontWeight: 600, textDecoration: 'none' }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
