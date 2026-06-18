// src/app/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { listAllJobs, getPollenBalance, JobSummary, PollenBalanceResponse, getAssetUrl } from '@/utils/api';
import styles from './DashboardHome.module.css';

export default function DashboardHome() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [pollen, setPollen] = useState<PollenBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUsername(localStorage.getItem('storyforge_username'));
    }
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [jobsData, pollenData] = await Promise.all([
        listAllJobs(),
        getPollenBalance().catch(() => ({ success: false, pollen: null, images_left: null }))
      ]);
      setJobs(jobsData.jobs);
      setPollen(pollenData);
    } catch (err) {
      console.warn('Failed to load dashboard data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Periodic poll of dashboard status every 5 seconds to keep stats and progress up to date
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derive stats
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const runningJobs = jobs.filter(j => !['completed', 'failed', 'pending'].includes(j.status));
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const pendingJobs = jobs.filter(j => j.status === 'pending');

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return styles.badgeCompleted;
      case 'failed': return styles.badgeFailed;
      case 'pending': return styles.badgePending;
      default: return styles.badgeProcessing;
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'failed') return 'Failed';
    if (status === 'pending') return 'Queued';
    return status
      .replace('generating_', 'Gen ')
      .replace('composing_', 'Composing ')
      .replace('_', ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      if (diffHrs < 1) {
        const mins = Math.round(diffMs / 60000);
        return mins <= 1 ? 'Just now' : `${mins}m ago`;
      }
      if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading && jobs.length === 0) {
    return (
      <div className={styles.emptyState} style={{ minHeight: '60vh' }}>
        <svg className="animate-spin-fast" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p>Loading dashboard metrics...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* Hero Welcome Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <p className={styles.heroGreeting}>
              {getGreeting()}{username ? `, ${username}` : ''} 👋
            </p>
            <h2 className={styles.heroTitle}>Your Creative Studio</h2>
            <p className={styles.heroDesc}>
              Transform written stories into cinematic AI-generated video productions.
              {runningJobs.length > 0 && (
                <span className={styles.heroPill}>
                  🔄 {runningJobs.length} job{runningJobs.length > 1 ? 's' : ''} processing
                </span>
              )}
            </p>
          </div>
          <Link href="/studio" className={styles.heroBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Video
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className={styles.statsGrid}>
        {/* Metric 1 — Completed */}
        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statTitle}>Completed Videos</span>
            <span className={styles.statValue}>{completedJobs.length}</span>
            <span className={styles.statSub}>Ready to download</span>
          </div>
          <div className={styles.statAccent} style={{ background: '#10b981' }} />
        </div>

        {/* Metric 2 — Processing */}
        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(139, 92, 246, 0.12)', color: 'var(--accent-purple)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statTitle}>Active / Queued</span>
            <span className={styles.statValue}>{runningJobs.length + pendingJobs.length}</span>
            <span className={styles.statSub}>In the pipeline now</span>
          </div>
          <div className={styles.statAccent} style={{ background: 'var(--accent-purple)' }} />
        </div>

        {/* Metric 3 — Pollen */}
        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statTitle}>Pollen Balance</span>
            <span className={styles.statValue}>
              {pollen?.success && pollen.pollen !== null ? pollen.pollen : '—'}
            </span>
            <span className={styles.statSub}>
              {pollen?.success && pollen.images_left !== null
                ? `~${pollen.images_left} AI images left`
                : 'Free Tier Unlimited'}
            </span>
          </div>
          <div className={styles.statAccent} style={{ background: 'var(--accent-cyan)' }} />
        </div>

        {/* Metric 4 — Total Productions */}
        <div className={`glass ${styles.statCard}`}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.2)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className={styles.statContent}>
            <span className={styles.statTitle}>Total Productions</span>
            <span className={styles.statValue}>{jobs.length}</span>
            <span className={styles.statSub}>
              {failedJobs.length > 0 ? `${failedJobs.length} failed` : 'All time'}
            </span>
          </div>
          <div className={styles.statAccent} style={{ background: '#f97316' }} />
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className={styles.quickActions}>
        <Link href="/studio" className={`glass-interactive ${styles.quickCard}`}>
          <span className={styles.quickIcon}>🎬</span>
          <span className={styles.quickLabel}>New Video</span>
          <span className={styles.quickDesc}>Upload story script</span>
        </Link>
        <Link href="/history" className={`glass-interactive ${styles.quickCard}`}>
          <span className={styles.quickIcon}>📂</span>
          <span className={styles.quickLabel}>History</span>
          <span className={styles.quickDesc}>Browse all productions</span>
        </Link>
        <Link href="/accuracy" className={`glass-interactive ${styles.quickCard}`}>
          <span className={styles.quickIcon}>📊</span>
          <span className={styles.quickLabel}>Accuracy</span>
          <span className={styles.quickDesc}>Score video fidelity</span>
        </Link>
        <Link href="/settings" className={`glass-interactive ${styles.quickCard}`}>
          <span className={styles.quickIcon}>⚙️</span>
          <span className={styles.quickLabel}>Settings</span>
          <span className={styles.quickDesc}>Configure pipeline</span>
        </Link>
      </div>

      {/* Recent Video Projects Section */}
      <div className={styles.recentSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Recent Productions</h3>
          {jobs.length > 0 && (
            <Link href="/history" className={styles.viewAllBtn}>
              View All {jobs.length} ➔
            </Link>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className={`glass ${styles.emptyState}`}>
            <div className={styles.emptyIcon}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="17" x2="22" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
              </svg>
            </div>
            <h4 className={styles.emptyTitle}>Create your first video project</h4>
            <p className={styles.emptyDesc}>StoryForge transforms your story text file into dynamic video scenes, voice narrator audio, and synced subtitles.</p>
            <Link href="/studio" className={styles.createBtn}>
              Upload Story Script
            </Link>
          </div>
        ) : (
          <div>
            <div className={styles.grid}>
              {jobs.slice(0, 3).map((job) => {
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';
                const isProcessing = !isCompleted && !isFailed;
                const thumbnailUrl = isCompleted
                  ? getAssetUrl(`output/${job.job_id}/thumbnail.png`)
                  : null;

                return (
                  <Link
                    href={`/studio/${job.job_id}`}
                    key={job.job_id}
                    className={`glass-interactive ${styles.card}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Thumbnail Cover Area */}
                    <div className={styles.thumbnailArea}>
                      {thumbnailUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumbnailUrl}
                          alt={job.story_filename || 'Video Thumbnail'}
                          className={styles.thumbnailImage}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}

                      {!thumbnailUrl && (
                        <div className={styles.thumbnailFallback}>
                          {isProcessing ? (
                            <svg className="animate-spin-slow" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                            </svg>
                          ) : (
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                              <line x1="7" y1="2" x2="7" y2="22" />
                              <line x1="17" y1="2" x2="17" y2="22" />
                            </svg>
                          )}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {isProcessing ? 'Generating...' : 'Failed'}
                          </span>
                        </div>
                      )}

                      {/* Status Badge Overlaid */}
                      <span className={`${styles.badge} ${getBadgeClass(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    </div>

                    {/* Card Info Details */}
                    <div className={styles.cardDetails}>
                      <h4 className={styles.cardTitle} title={job.story_filename || 'Untitled Video'}>
                        {job.story_filename || 'Untitled Video'}
                      </h4>

                      <div className={styles.progressContainer}>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={`
                              ${styles.progressBarFill}
                              ${isCompleted ? styles.progressBarFillCompleted : ''}
                              ${isFailed ? styles.progressBarFillFailed : ''}
                            `}
                            style={{ width: `${job.progress_percent}%` }}
                          />
                        </div>
                        <span className={styles.progressText}>{job.progress_percent}%</span>
                      </div>

                      <div className={styles.cardMeta}>
                        <span>ID: {job.job_id.substring(0, 8)}...</span>
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {jobs.length > 3 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                <Link href="/history" className={styles.createBtn} style={{ margin: 0, textDecoration: 'none' }}>
                  📂 Browse All {jobs.length} Productions
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
