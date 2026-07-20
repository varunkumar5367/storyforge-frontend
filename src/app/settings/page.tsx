// src/app/settings/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getPollenBalance, PollenBalanceResponse, BASE_URL, claimAdRewardCredits } from '@/utils/api';
import styles from './Settings.module.css';

const MAX_QUOTA = 20;

const VOICES = [
  { id: 'en-US-JennyNeural', label: 'Jenny (US Female) - Default' },
  { id: 'en-US-GuyNeural', label: 'Guy (US Male)' },
  { id: 'en-US-AriaNeural', label: 'Aria (US Female)' },
  { id: 'en-US-AnaNeural', label: 'Ana (US Child Female)' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher (US Male)' },
  { id: 'en-US-EricNeural', label: 'Eric (US Male)' },
  { id: 'en-US-MichelleNeural', label: 'Michelle (US Female)' },
  { id: 'en-US-RogerNeural', label: 'Roger (US Male)' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK Male)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)' },
  { id: 'en-GB-LibbyNeural', label: 'Libby (UK Female)' },
  { id: 'en-GB-OliverNeural', label: 'Oliver (UK Male)' },
  { id: 'en-GB-ThomasNeural', label: 'Thomas (UK Male)' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (Australia Female)' },
  { id: 'en-AU-WilliamNeural', label: 'William (Australia Male)' },
  { id: 'en-CA-LiamNeural', label: 'Liam (Canada Male)' },
  { id: 'en-CA-ClaraNeural', label: 'Clara (Canada Female)' },
  { id: 'en-IE-ConnorNeural', label: 'Connor (Ireland Male)' },
  { id: 'en-IE-EmilyNeural', label: 'Emily (Ireland Female)' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja (India Female)' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat (India Male)' },
  { id: 'en-NZ-MitchellNeural', label: 'Mitchell (New Zealand Male)' },
  { id: 'en-ZA-LeahNeural', label: 'Leah (South Africa Female)' },
  { id: 'en-ZA-LukeNeural', label: 'Luke (South Africa Male)' },
];

/** Returns a date object at the next top-of-the-hour */
function getNextHourReset(): Date {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}

/** Formats ms difference into HH:MM:SS */
function formatCountdown(diffMs: number): string {
  const total = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
}

export default function SettingsPage() {
  // ── Role-based control ───────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Production Presets ───────────────────────────────────────────────────
  const [defaultVoice, setDefaultVoice] = useState('en-US-JennyNeural');
  const [subtitleStyle, setSubtitleStyle] = useState('yellow-outline');

  // ── Pollen / Quota ───────────────────────────────────────────────────────
  const [pollen, setPollen] = useState<PollenBalanceResponse | null>(null);
  const [checkingPollen, setCheckingPollen] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [resetTarget] = useState<Date>(getNextHourReset);
  const [userPollenBalance, setUserPollenBalance] = useState(20);

  // ── Ad Watching States ──────────────────────────────────────────────────
  const [showAdModal, setShowAdModal] = useState(false);
  const [adSeconds, setAdSeconds] = useState(15);
  const [claimingReward, setClaimingReward] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  // ── Bootstrap from localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const role = localStorage.getItem('storyforge_role');
    setIsAdmin(role === 'admin');
    setDefaultVoice(localStorage.getItem('storyforge_default_voice') || 'en-US-JennyNeural');
    setSubtitleStyle(localStorage.getItem('storyforge_sub_style') || 'yellow-outline');

    // Fetch user profile to get their custom quota limit if non-admin
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('storyforge_token');
        if (!token) return;
        const response = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUserPollenBalance(data.pollen_balance ?? 20);
        }
      } catch (err) {
        // Silent catch
      }
    };
    fetchUserProfile();
  }, []);

  // ── Live countdown timer ─────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(resetTarget.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resetTarget]);

  // ── Pollen fetch ─────────────────────────────────────────────────────────
  const checkPollen = useCallback(async () => {
    setCheckingPollen(true);
    try {
      const res = await getPollenBalance();
      setPollen(res);
    } catch (err) {
      console.warn('Failed to load Pollen balance:', err);
    } finally {
      setCheckingPollen(false);
    }
  }, []);

  useEffect(() => {
    checkPollen();
    window.addEventListener('pollen-updated', checkPollen);
    return () => window.removeEventListener('pollen-updated', checkPollen);
  }, [checkPollen]);

  // ── Ad Watching Logic ───────────────────────────────────────────────────
  const handleWatchAd = () => {
    setAdSeconds(15);
    setClaimSuccessMsg(null);
    setClaimError(null);
    setClaimingReward(false);
    setShowAdModal(true);
  };

  useEffect(() => {
    if (!showAdModal) return;
    if (adSeconds > 0) {
      const timer = setInterval(() => {
        setAdSeconds((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      const claim = async () => {
        setClaimingReward(true);
        setClaimError(null);
        try {
          const res = await claimAdRewardCredits();
          setClaimSuccessMsg(res.message || "Successfully claimed +5 Choco credits!");
          await checkPollen();
          window.dispatchEvent(new CustomEvent('pollen-updated'));
        } catch (err: any) {
          setClaimError(err.message || "Failed to claim ad reward credits.");
        } finally {
          setClaimingReward(false);
        }
      };
      claim();
    }
  }, [showAdModal, adSeconds, checkPollen]);

  // ── Save handler ─────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveWarning(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('storyforge_default_voice', defaultVoice);
      localStorage.setItem('storyforge_sub_style', subtitleStyle);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // ── Derived quota values ─────────────────────────────────────────────────
  const quotaLimit = isAdmin ? 100 : userPollenBalance;
  const rawPollen = pollen?.pollen ?? (isAdmin ? 0 : quotaLimit);
  const quotaPercent = isAdmin 
    ? 100 
    : Math.min(100, Math.round(((pollen?.images_left ?? rawPollen) / quotaLimit) * 100));
  const barColor = isAdmin 
    ? 'var(--accent-green)' 
    : (rawPollen <= 5 ? 'var(--accent-red)' : rawPollen < 15 ? 'var(--accent-orange)' : 'var(--accent-green)');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>System Settings</h2>
        <p className={styles.desc}>
          {isAdmin
            ? 'Customize dashboard appearance, server connections, default voice engines, and AI quota.'
            : 'Customize dashboard visual appearance and AI preferences.'}
        </p>
      </div>

      {/* Save warning */}
      {saveWarning && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--border-radius)',
          backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          color: 'var(--accent-orange)', fontSize: '14px', display: 'flex', gap: '8px',
        }}>
          ⚠️ {saveWarning}
        </div>
      )}

      <form onSubmit={handleSave} className={styles.grid}>

        {/* ── Production Presets ──────────────────────────────────────────── */}
        <div className={`glass ${styles.card}`}>
          <h3 className={styles.cardTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
            Production Presets
          </h3>
          <div className={styles.cardBody}>

            {/* TTS Voice */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Default TTS Narration Voice</label>
              <select
                value={defaultVoice}
                onChange={(e) => setDefaultVoice(e.target.value)}
                className={styles.select}
              >
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <span className={styles.helpText}>TTS voice used for newly uploaded scripts.</span>
            </div>

            {/* Captions Style */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Captions Styling Preset</label>
              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value)}
                className={styles.select}
              >
                <option value="yellow-outline">🔥 Neon Yellow with Black Outline</option>
                <option value="cyan-glow">🌐 Cyber Cyan with Glow Shadow</option>
                <option value="classic-white">📄 Minimal White with Translucent Plate</option>
                <option value="bold-uppercase">💥 Bold Red Uppercase Impact</option>
              </select>
              <span className={styles.helpText}>Font overlay preset for Whisper compiled subtitles.</span>
            </div>
          </div>
        </div>

        {/* ── AI Generator Account ────────────────────────────────────────── */}
        <div className={`glass ${styles.card}`}>
          <h3 className={styles.cardTitle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l3 3"/>
            </svg>
            AI Generator Account
          </h3>
          <div className={styles.cardBody}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Illustrations are powered by local GPU acceleration or cloud inference fallback.
            </p>

            {/* ── Quota card ── */}
            <div className={styles.quotaCard}>
              <div className={styles.quotaHeader}>
                <span className={styles.quotaLabel}>CHOCO CREDITS</span>
                {checkingPollen && (
                  <svg className="animate-spin-fast" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                    <path d="M12 2v4"/>
                  </svg>
                )}
              </div>

              {/* Progress bar */}
              <div className={styles.quotaBarTrack}>
                <div
                  className={styles.quotaBarFill}
                  style={{ width: `${quotaPercent}%`, backgroundColor: barColor }}
                />
              </div>

              {/* Credit count */}
              <div className={styles.quotaCredits}>
                <span className={styles.quotaCreditsMain} style={{ color: barColor }}>
                  {checkingPollen 
                    ? '–' 
                    : (rawPollen < 1 && rawPollen > 0) || !Number.isInteger(rawPollen) 
                      ? Math.round(rawPollen) 
                      : Math.round(rawPollen)}
                </span>
                {!isAdmin && (
                  <>
                    <span className={styles.quotaCreditsSlash}>/</span>
                    <span className={styles.quotaCreditsMax}>{quotaLimit} Choco Available</span>
                  </>
                )}
                {isAdmin && (
                  <span className={styles.quotaCreditsMax}> Choco Available</span>
                )}
              </div>

              {/* Countdown */}
              <div className={styles.quotaCountdown} style={{ color: barColor }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Resets in: <strong>{countdown || '–'}</strong>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={checkPollen}
                disabled={checkingPollen || !isAdmin}
                className={styles.quotaRefreshBtn}
                style={{
                  opacity: isAdmin ? 1 : 0.4,
                  cursor: isAdmin ? 'pointer' : 'not-allowed',
                }}
                title={isAdmin ? 'Refresh quota data' : 'Only admins can manually refresh quota'}
              >
                {checkingPollen ? 'Refreshing…' : 'Refresh Quota'}
              </button>

              {!isAdmin && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0', textAlign: 'center' }}>
                  Contact your administrator to refresh quota
                </p>
              )}

              {/* Watch Ad section for non-admins */}
              {!isAdmin && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px dashed rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>EARN EXTRA CREDITS</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>+5 Choco / Ad</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleWatchAd}
                    className={styles.quotaRefreshBtn}
                    style={{
                      backgroundColor: 'var(--accent-purple)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      opacity: 1,
                      backgroundImage: 'var(--gradient-primary)',
                      boxShadow: 'var(--glow-purple)',
                      fontWeight: 700
                    }}
                  >
                    📺 Watch Ad (+5 Choco)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Save row ────────────────────────────────────────────────────── */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button type="submit" className={styles.btn}>
            Save Configuration
          </button>
          {savedSuccess && (
            <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Settings saved successfully!
            </span>
          )}
        </div>
      </form>

      {/* ── Rewarded Ad Modal Overlay ────────────────────────────────────── */}
      {showAdModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass" style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'rgba(20,20,25,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '30px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg), var(--glow-purple)'
          }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '16px', background: 'var(--gradient-cyber)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sponsored Advertisement
            </h3>
            
            {/* Simulated Video Player */}
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#000',
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: '20px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}>
              {adSeconds > 0 ? (
                <>
                  <div className="animate-spin-fast" style={{ width: '32px', height: '32px', border: '3px solid transparent', borderTopColor: 'var(--accent-purple)', borderRadius: '50%' }} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Playing sponsor video...
                  </p>
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {adSeconds}s remaining
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    color: 'var(--accent-green)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                    border: '1px solid rgba(16,185,129,0.2)'
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Ad Completed!
                  </p>
                </div>
              )}
            </div>

            {/* Status & Close button */}
            <div style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              {claimingReward && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  Adding 5 Choco credits to your account...
                </p>
              )}
              
              {claimSuccessMsg && (
                <p style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                  {claimSuccessMsg}
                </p>
              )}

              {claimError && (
                <p style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>
                  ⚠️ {claimError}
                </p>
              )}

              {adSeconds === 0 && !claimingReward && (
                <button
                  type="button"
                  onClick={() => setShowAdModal(false)}
                  className={styles.quotaRefreshBtn}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'white',
                    cursor: 'pointer',
                    borderRadius: 'var(--border-radius)',
                    fontWeight: 600,
                    marginTop: '8px'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
