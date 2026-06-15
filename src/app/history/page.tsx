// src/app/history/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { listAllJobs, deleteJob, updateJob, JobSummary, getAssetUrl } from '@/utils/api';
import styles from './History.module.css';

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('history_view_mode');
      if (saved === 'list' || saved === 'grid') {
        return saved as 'list' | 'grid';
      }
    }
    return 'list';
  });
  const router = useRouter();

  const handleToggleView = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('history_view_mode', mode);
  };

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch up to 100 history items
      const data = await listAllJobs(100);
      setJobs(data.jobs);
    } catch (err) {
      console.warn('Failed to load history jobs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();
  }, [fetchJobs]);

  // Poll job status silently every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleSelectJob = (jobId: string) => {
    router.push(`/studio/${jobId}`);
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string, filename: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${filename || 'this project'}"?`)) {
      try {
        await deleteJob(jobId);
        fetchJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to delete job: ${msg}`);
      }
    }
  };

  const handleStartRename = (e: React.MouseEvent, jobId: string, currentName: string) => {
    e.stopPropagation();
    setEditingJobId(jobId);
    setEditingName(currentName);
  };

  const handleSaveRename = async (jobId: string) => {
    if (editingName.trim()) {
      try {
        await updateJob(jobId, { story_filename: editingName.trim() });
        fetchJobs();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        alert(`Failed to rename: ${msg}`);
      }
    }
    setEditingJobId(null);
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return styles.badgeCompleted;
      case 'failed':
        return styles.badgeFailed;
      case 'pending':
        return styles.badgePending;
      default:
        return styles.badgeProcessing;
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
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Filter jobs based on search term
  const filteredJobs = jobs.filter((job) =>
    (job.story_filename || 'Untitled Story')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Production History Archive</h2>
        <p className={styles.desc}>Search, rename, and manage all your text-to-video jobs.</p>
      </div>

      {/* Search and Refresh bar */}
      <div className={styles.searchBarContainer}>
        <input
          type="text"
          placeholder="🔍 Search past productions by filename..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
        <button
          type="button"
          onClick={() => fetchJobs()}
          disabled={loading}
          className={styles.refreshBtn}
          title="Refresh History List"
        >
          <svg
            className={loading ? 'animate-spin-fast' : ''}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>

        <div className={styles.viewModeToggle}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${viewMode === 'list' ? styles.toggleBtnActive : ''}`}
            onClick={() => handleToggleView('list')}
            title="List View"
          >
            List
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${viewMode === 'grid' ? styles.toggleBtnActive : ''}`}
            onClick={() => handleToggleView('grid')}
            title="Grid / Thumbnail View"
          >
            Grid
          </button>
        </div>
      </div>

      {/* List Area */}
      {loading && jobs.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className="animate-spin-fast" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
            <path d="M12 2v4M12 18v4" />
          </svg>
          <p>Loading history records...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className={`glass ${styles.emptyState}`}>
          <div className={styles.emptyIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h4 style={{ fontWeight: 700 }}>No matching productions found</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {jobs.length === 0 ? "You haven't generated any videos yet." : "Try adjusting your search criteria."}
          </p>
          {jobs.length === 0 && (
            <Link href="/studio" className={styles.refreshBtn} style={{ padding: '10px 20px', textDecoration: 'none' }}>
              Create First Video
            </Link>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className={styles.historyList}>
          {filteredJobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const filename = job.story_filename || 'Untitled Story';

            return (
              <div
                key={job.job_id}
                onClick={() => handleSelectJob(job.job_id)}
                className={`glass-interactive ${styles.jobItem}`}
                style={{ cursor: 'pointer' }}
              >
                {/* Left side: Icon & Title info */}
                <div className={`${styles.itemLeft} ${isCompleted ? styles.itemLeftCompleted : ''}`}>
                  <div className={styles.itemIcon}>
                    {isCompleted ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.infoBlock}>
                    {editingJobId === job.job_id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className={styles.renameInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRename(job.job_id);
                          } else if (e.key === 'Escape') {
                            setEditingJobId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className={styles.filename} title={filename}>
                        {filename}
                      </span>
                    )}
                    <div className={styles.itemMeta}>
                      <span>ID: {job.job_id.substring(0, 16)}...</span>
                      <span>📅 {formatDate(job.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Progress, Badge, Rename, Delete */}
                <div className={styles.itemRight}>
                  {/* Progress fill */}
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

                  {/* Status Badge */}
                  <span className={`${styles.statusBadge} ${getBadgeClass(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>

                  {/* Rename Action */}
                  {editingJobId === job.job_id ? (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveRename(job.job_id);
                      }}
                      title="Save Name"
                      style={{ color: 'var(--accent-green)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={(e) => handleStartRename(e, job.job_id, filename)}
                      title="Rename Project"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete Action */}
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={(e) => handleDelete(e, job.job_id, filename)}
                    title="Delete Project"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.historyGrid}>
          {filteredJobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const isProcessing = !isCompleted && !isFailed;
            const filename = job.story_filename || 'Untitled Story';
            const thumbnailUrl = isCompleted 
              ? getAssetUrl(`output/${job.job_id}/thumbnail.png`) 
              : null;

            return (
              <div
                key={job.job_id}
                onClick={() => handleSelectJob(job.job_id)}
                className={`glass-interactive ${styles.gridItem}`}
                style={{ cursor: 'pointer' }}
              >
                {/* Thumbnail covers top */}
                <div className={styles.thumbnailArea}>
                  {thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img 
                      src={thumbnailUrl} 
                      alt={filename} 
                      className={styles.thumbnailImage}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  {!thumbnailUrl && (
                    <div className={styles.thumbnailFallback}>
                      {isProcessing ? (
                        <svg className="animate-spin-slow" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83" />
                        </svg>
                      ) : (
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                          <line x1="7" y1="2" x2="7" y2="22" />
                        </svg>
                      )}
                      <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>
                        {isProcessing ? 'Generating...' : 'Failed'}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.gridDetails}>
                  <div className={styles.gridTitleRow}>
                    {editingJobId === job.job_id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className={styles.gridRenameInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveRename(job.job_id);
                          } else if (e.key === 'Escape') {
                            setEditingJobId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className={styles.gridTitle} title={filename}>
                        {filename}
                      </span>
                    )}

                    <div className={styles.gridActions}>
                      {editingJobId === job.job_id ? (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveRename(job.job_id);
                          }}
                          style={{ color: 'var(--accent-green)' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={(e) => handleStartRename(e, job.job_id, filename)}
                          title="Rename"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={(e) => handleDelete(e, job.job_id, filename)}
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className={styles.gridProgressContainer}>
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

                  <div className={styles.gridMeta}>
                    <span>📅 {formatDate(job.created_at).split(',')[0]}</span>
                    <span className={`${styles.statusBadge} ${getBadgeClass(job.status)}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>
                      {getStatusLabel(job.status)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
