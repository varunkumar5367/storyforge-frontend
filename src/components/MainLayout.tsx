// src/components/MainLayout.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './MainLayout.module.css';
import { sendHeartbeat } from '@/utils/api';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Server Waking & Status states
  const [serverState, setServerState] = useState<'checking' | 'online' | 'waking' | 'timeout'>('checking');
  const [countdown, setCountdown] = useState(120);
  const [wakeMessage, setWakeMessage] = useState('');
  const [sendingWake, setSendingWake] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register';

  const checkServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/server-status');
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      
      if (data.status === 'online' && data.tunnel_url) {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 4000);
          const healthRes = await fetch(`${data.tunnel_url}/health`, {
            signal: controller.signal,
            mode: 'cors'
          });
          clearTimeout(id);
          if (healthRes.ok) {
            localStorage.setItem('storyforge_api_url', data.tunnel_url);
            window.dispatchEvent(new CustomEvent('api-url-changed'));
            setServerState('online');
            return true;
          }
        } catch (err) {
          console.warn('Tunnel health check failed:', err);
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to check server status:', error);
      return false;
    }
  }, []);

  const sendWakeRequest = useCallback(async (message?: string) => {
    const lastWake = localStorage.getItem('storyforge_last_wake');
    const now = Date.now();
    if (lastWake && now - parseInt(lastWake) < 5 * 60 * 1000) {
      console.log('Wake request rate-limited (sent recently). Polling instead.');
      return;
    }
    try {
      await fetch('/api/wake-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message || 'Automatic wake request on page load' })
      });
      localStorage.setItem('storyforge_last_wake', String(now));
    } catch (err) {
      console.error('Failed to send wake request:', err);
    }
  }, []);

  // Check server status on mount or path change
  useEffect(() => {
    if (isAuthPage) {
      setServerState('online');
      checkServerStatus();
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const initCheck = async () => {
      setServerState('checking');
      const isOnline = await checkServerStatus();
      if (!isOnline && isMounted) {
        await sendWakeRequest();
        setServerState('waking');
        setCountdown(120);
      }
    };

    initCheck();

    pollInterval = setInterval(async () => {
      if (isMounted) {
        const isOnline = await checkServerStatus();
        if (isOnline) {
          if (pollInterval) clearInterval(pollInterval);
        }
      }
    }, 4000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pathname, checkServerStatus, sendWakeRequest, isAuthPage]);

  // Countdown timer for waking state
  useEffect(() => {
    if (serverState !== 'waking') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setServerState('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [serverState]);

  const handleManualWakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingWake(true);
    
    const lastWake = localStorage.getItem('storyforge_last_wake');
    const now = Date.now();
    if (lastWake && now - parseInt(lastWake) < 5 * 60 * 1000) {
      const remainingMins = Math.ceil((5 * 60 * 1000 - (now - parseInt(lastWake))) / 60000);
      alert(`Please wait ${remainingMins} minute(s) before sending another wake request.`);
      setSendingWake(false);
      return;
    }

    try {
      await fetch('/api/wake-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: wakeMessage })
      });
      localStorage.setItem('storyforge_last_wake', String(now));
      setWakeMessage('');
      setServerState('waking');
      setCountdown(120);
    } catch (err) {
      alert('Failed to send wake request. Check database status.');
    } finally {
      setSendingWake(false);
    }
  };


  // Auth handler
  const checkAuth = useCallback(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('storyforge_token');
    const userRole = localStorage.getItem('storyforge_role');
    const name = localStorage.getItem('storyforge_username');

    if (!token) {
      setRole(null);
      setUsername(null);
      if (pathname !== '/login' && pathname !== '/register') {
        router.push('/login');
      }
    } else {
      setRole(userRole);
      setUsername(name);
    }
    setAuthChecked(true);
  }, [pathname, router]);

  useEffect(() => {
    checkAuth();
    // Listen for custom auth events from login/logout
    window.addEventListener('auth-changed', checkAuth);
    return () => {
      window.removeEventListener('auth-changed', checkAuth);
    };
  }, [checkAuth]);

  // Sync collapsed state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar_collapsed') === 'true';
      setSidebarCollapsed(stored);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(nextState));
    }
  };

  // Client-side theme resolver
  const applyTheme = useCallback(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = localStorage.getItem('theme') || 'dark';
    let resolvedTheme = storedTheme;

    if (storedTheme === 'system') {
      resolvedTheme = 'dark';
      localStorage.setItem('theme', 'dark');
    }

    document.documentElement.setAttribute('data-theme', resolvedTheme);
    setTheme(resolvedTheme);
  }, []);

  // Sync theme on mount & listen for theme change events
  useEffect(() => {
    applyTheme();
    window.addEventListener('theme-changed', applyTheme);

    return () => {
      window.removeEventListener('theme-changed', applyTheme);
    };
  }, [applyTheme]);

  const toggleTheme = () => {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', nextTheme);
    window.dispatchEvent(new CustomEvent('theme-changed'));
  };

  // Heartbeat ping timer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ping = async () => {
      const token = localStorage.getItem('storyforge_token');
      if (token) {
        try {
          await sendHeartbeat();
        } catch (err) {
          // Silent catch
        }
      }
    };
    ping();
    const intervalId = setInterval(ping, 20000);
    return () => clearInterval(intervalId);
  }, [authChecked]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const getThemeIcon = () => {
    if (theme === 'light') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    }
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  };

  const getThemeLabel = () => {
    return theme === 'light' ? 'Light Theme' : 'Dark Theme';
  };

  const handleLogout = () => {
    localStorage.removeItem('storyforge_token');
    localStorage.removeItem('storyforge_role');
    localStorage.removeItem('storyforge_username');
    setRole(null);
    setUsername(null);
    window.dispatchEvent(new Event('auth-changed'));
    router.push('/login');
  };


  // Render a clean fullscreen layout for login & register pages
  if (isAuthPage) {
    return (
      <div style={{ backgroundColor: 'var(--bg-dark)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    );
  }

  // Prevent flash of page before auth redirect finishes
  if (!authChecked && pathname !== '/login' && pathname !== '/register') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <svg className="animate-spin-fast" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </div>
    );
  }

  if (serverState !== 'online' && !isAuthPage) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-dark)',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
        padding: '20px',
        boxSizing: 'border-box'
      }}>
        <div className="glass" style={{
          maxWidth: '500px',
          width: '100%',
          padding: '40px',
          borderRadius: 'var(--border-radius-lg)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg), var(--glow-purple)',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}>
          {serverState === 'checking' && (
            <>
              <svg className="animate-spin-fast" style={{ margin: '0 auto 24px', color: 'var(--accent-purple)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
              </svg>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px', background: 'var(--gradient-cyber)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Connecting to StoryForge
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Checking if the video generation backend is online...
              </p>
            </>
          )}

          {serverState === 'waking' && (
            <>
              <svg className="animate-spin-slow" style={{ margin: '0 auto 24px', color: 'var(--accent-cyan)' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
              </svg>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Waking up the server...
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
                A wake request was sent to the admin's laptop. The dashboard will load automatically once the server responds.
              </p>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--accent-red)',
                background: 'rgba(239, 68, 68, 0.08)',
                padding: '10px 20px',
                borderRadius: '8px',
                display: 'inline-block',
                border: '1px solid rgba(239, 68, 68, 0.15)'
              }}>
                Waiting for admin response: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </div>
            </>
          )}

          {serverState === 'timeout' && (
            <>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--accent-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                Server is Offline
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
                The server is currently offline. Please contact the admin or send a request to start it.
              </p>
              
              <form onSubmit={handleManualWakeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  value={wakeMessage}
                  onChange={(e) => setWakeMessage(e.target.value)}
                  placeholder="Optional message to the admin..."
                  maxLength={150}
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.9rem',
                    resize: 'none',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={sendingWake}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--gradient-primary)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: 'var(--glow-purple)',
                    transition: 'all 0.2s',
                    opacity: sendingWake ? 0.7 : 1
                  }}
                >
                  {sendingWake ? 'Sending Notification...' : 'Send Wake Request'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.brand} style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className={styles.brandGlow} />
              <h1 className={styles.brandText}>StoryForge AI</h1>
            </div>
          )}
          {sidebarCollapsed && <div className={styles.brandGlow} />}
          <button 
            type="button" 
            onClick={toggleSidebar} 
            className={styles.collapseBtn}
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        {/* Nav Links */}
        <nav className={styles.navSection}>
          <Link 
            href="/" 
            className={`${styles.navLink} ${pathname === '/' ? styles.navLinkActive : ''}`}
            title="Dashboard Home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!sidebarCollapsed && <span>Dashboard Home</span>}
          </Link>

          <Link 
            href="/studio" 
            className={`${styles.navLink} ${pathname.startsWith('/studio') ? styles.navLinkActive : ''}`}
            title="Studio Workbench"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {!sidebarCollapsed && <span>Studio Workbench</span>}
          </Link>

          <Link 
            href="/history" 
            className={`${styles.navLink} ${pathname === '/history' ? styles.navLinkActive : ''}`}
            title="History Archive"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {!sidebarCollapsed && <span>History Archive</span>}
          </Link>

          <Link 
            href="/profile" 
            className={`${styles.navLink} ${pathname === '/profile' ? styles.navLinkActive : ''}`}
            title="User Profile"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {!sidebarCollapsed && <span>User Profile</span>}
          </Link>

          <Link 
            href="/settings" 
            className={`${styles.navLink} ${pathname === '/settings' ? styles.navLinkActive : ''}`}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>

          {role === 'admin' && (
            <Link 
              href="/admin" 
              className={`${styles.navLink} ${pathname.startsWith('/admin') ? styles.navLinkActive : ''}`}
              title="Admin Panel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {!sidebarCollapsed && <span>Admin Panel</span>}
            </Link>
          )}
        </nav>
      </aside>

        {/* Main Content Pane */}
        <div className={styles.contentArea}>
          {/* Sticky Top Header */}
          <header className={styles.header}>
            <div className={styles.headerLinks}>
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className={styles.themeToggleBtn}
                title={`Switch Theme (Current: ${getThemeLabel()})`}
              >
                {getThemeIcon()}
              </button>

              {/* User Avatar Dropdown */}
              {username && (
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className={styles.avatarBtn}
                    title={username}
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                  >
                    {username.charAt(0).toUpperCase()}
                  </button>

                  {dropdownOpen && (
                    <div className={styles.avatarDropdown} role="menu">
                      {/* User info header */}
                      <div className={styles.avatarDropdownHeader}>
                        <div className={styles.avatarDropdownAvatar}>
                          {username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.avatarDropdownName}>{username}</div>
                          {role && <div className={styles.avatarDropdownRole}>{role}</div>}
                        </div>
                      </div>

                      <div className={styles.avatarDropdownDivider} />

                      <Link
                        href="/settings"
                        className={styles.avatarDropdownItem}
                        onClick={() => setDropdownOpen(false)}
                        role="menuitem"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        Settings
                      </Link>

                      <button
                        type="button"
                        className={styles.avatarDropdownItem}
                        onClick={() => setDropdownOpen(false)}
                        role="menuitem"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Help &amp; Support
                      </button>

                      <div className={styles.avatarDropdownDivider} />

                      <button
                        type="button"
                        className={`${styles.avatarDropdownItem} ${styles.avatarDropdownLogout}`}
                        onClick={() => { setDropdownOpen(false); handleLogout(); }}
                        role="menuitem"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                          <polyline points="16 17 21 12 16 7"/>
                          <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Nested Page Render */}
          {children}
        </div>
    </div>
  );
}
