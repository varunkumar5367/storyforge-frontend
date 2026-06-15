// src/components/JobList.tsx
'use client';

import React, { useState } from 'react';
import { JobSummary } from '@/utils/api';
import styles from './JobList.module.css';

interface JobListProps {
  jobs: JobSummary[];
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onDeleteJob: (jobId: string) => void;
  onRenameJob: (jobId: string, newName: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}


export default function JobList({ jobs, activeJobId, onSelectJob, onDeleteJob, onRenameJob, onRefresh, isLoading }: JobListProps) {
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleSaveRename = (jobId: string) => {
    if (editingName.trim()) {
      onRenameJob(jobId, editingName.trim());
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
        return styles.badgeProcessing; // analyzing, generating_images, etc.
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'Completed';
    if (status === 'failed') return 'Failed';
    if (status === 'pending') return 'Queued';
    
    // Convert Snake_case to Title Case
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
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`glass ${styles.container}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Generation History
        </h3>
        <button 
          className={styles.refreshButton} 
          onClick={onRefresh} 
          disabled={isLoading}
          title="Refresh List"
        >
          <svg 
            className={isLoading ? 'animate-spin-fast' : ''} 
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      <div className={styles.jobScrollArea}>
        {jobs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <p>No jobs created yet.</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Upload a story to start!</p>
          </div>
        ) : (
          jobs.map((job) => {
            const isActive = activeJobId === job.job_id;
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            
            return (
              <div
                key={job.job_id}
                className={`glass-interactive ${styles.jobCard} ${isActive ? styles.activeJob : ''}`}
                onClick={() => onSelectJob(job.job_id)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.cardHeader}>
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
                    <span className={styles.filename} title={job.story_filename || 'Untitled Story'}>
                      {job.story_filename || 'Untitled Story'}
                    </span>
                  )}
                  <div className={styles.headerRight}>
                    {editingJobId !== job.job_id && (
                      <span className={`${styles.badge} ${getBadgeClass(job.status)}`}>
                        {getStatusLabel(job.status)}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${styles.editButton} ${editingJobId === job.job_id ? styles.editButtonActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingJobId === job.job_id) {
                          handleSaveRename(job.job_id);
                        } else {
                          setEditingJobId(job.job_id);
                          setEditingName(job.story_filename || '');
                        }
                      }}
                      title={editingJobId === job.job_id ? "Save Name" : "Rename Story"}
                    >
                      {editingJobId === job.job_id ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete "${job.story_filename || 'this story'}"?`)) {
                          onDeleteJob(job.job_id);
                        }
                      }}
                      title="Delete Job"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </div>

                
                <div className={styles.cardBody}>
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
                  <span className={styles.date}>{formatDate(job.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
