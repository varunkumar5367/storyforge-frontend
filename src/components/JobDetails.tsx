// src/components/JobDetails.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getJobStatus, 
  getDownloadLinks, 
  JobStatusResponse, 
  JobOutputLinks,
  pauseJob,
  resumeJob,
  regenerateThumbnailCustom,
  getAssetUrl
} from '@/utils/api';
import VideoPlayer from './VideoPlayer';
import SceneCard from './SceneCard';
import CharacterBibleViewer from './CharacterBibleViewer';
import styles from './JobDetails.module.css';

interface JobDetailsProps {
  jobId: string | null;
  onStatusUpdate: () => void;
}

const STEPS = [
  { id: 'analyzing', label: 'Story Analyze', percent: 15 },
  { id: 'generating_images', label: 'Generate Images', percent: 35 },
  { id: 'generating_voice', label: 'Voice Narration', percent: 55 },
  { id: 'generating_subtitles', label: 'Transcribe Subtitles', percent: 65 },
  { id: 'composing_video', label: 'Compose Video', percent: 85 },
  { id: 'generating_metadata', label: 'Generate Metadata', percent: 95 },
  { id: 'generating_thumbnail', label: 'Create Thumbnail', percent: 100 },
];

export default function JobDetails({ jobId, onStatusUpdate }: JobDetailsProps) {
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [links, setLinks] = useState<JobOutputLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Advanced Frontend States
  const [activeTab, setActiveTab] = useState<'video' | 'bible' | 'scenes' | 'thumbnail_editor'>('video');
  const [scenePage, setScenePage] = useState(0);
  const [showTerminal, setShowTerminal] = useState(true);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  // Pause / Resume and Thumbnail Editor States
  const [togglingPause, setTogglingPause] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedScene, setSelectedScene] = useState<number>(1);
  const [regeneratingThumbnail, setRegeneratingThumbnail] = useState(false);
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const [isEditorInitialized, setIsEditorInitialized] = useState(false);
  const [isTabInitialized, setIsTabInitialized] = useState(false);

  const handlePause = async () => {
    if (!jobId) return;
    setTogglingPause(true);
    try {
      await pauseJob(jobId);
      await fetchJobDetails(jobId, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pause pipeline';
      alert(msg);
    } finally {
      setTogglingPause(false);
    }
  };

  const handleResume = async () => {
    if (!jobId) return;
    setTogglingPause(true);
    try {
      await resumeJob(jobId);
      await fetchJobDetails(jobId, false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resume pipeline';
      alert(msg);
    } finally {
      setTogglingPause(false);
    }
  };

  const handleRegenerateThumbnail = async () => {
    if (!jobId) return;
    setRegeneratingThumbnail(true);
    try {
      await regenerateThumbnailCustom(jobId, {
        title: customTitle,
        scene_number: selectedScene,
        prompt: customPrompt
      });
      await fetchJobDetails(jobId, false);
      setThumbnailVersion(v => v + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate thumbnail';
      alert(msg);
    } finally {
      setRegeneratingThumbnail(false);
    }
  };

  // Load custom title and custom prompt when completed or tab opening exactly once
  useEffect(() => {
    if (activeTab === 'thumbnail_editor' && links && !isEditorInitialized) {
      setIsEditorInitialized(true);
      
      if (links.title_txt) {
        fetch(getAssetUrl(links.title_txt))
          .then((res) => res.text())
          .then((text) => setCustomTitle(text.trim()))
          .catch(() => setCustomTitle(job?.story_filename || ''));
      } else {
        setCustomTitle(job?.story_filename || '');
      }

      if (links.thumbnail_prompt_txt) {
        fetch(getAssetUrl(links.thumbnail_prompt_txt))
          .then((res) => res.text())
          .then((text) => setCustomPrompt(text.trim()))
          .catch(() => {});
      }
    }
  }, [activeTab, links, job, isEditorInitialized]);

  const fetchJobDetails = useCallback(async (id: string, showLoadingSpinner: boolean) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      const statusData = await getJobStatus(id);
      setJob(statusData);
      
      // If completed, fetch download links
      if (statusData.status === 'completed') {
        const linkData = await getDownloadLinks(id);
        setLinks(linkData);
      } else {
        setLinks(null);
      }
      
      setError(null);
      onStatusUpdate(); // Tell parent list to refresh
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch job data.';
      setError(message);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  }, [onStatusUpdate]);

  // Set default active tab based on job completion exactly once
  useEffect(() => {
    if (job && !isTabInitialized) {
      setIsTabInitialized(true);
      if (job.status === 'completed') {
        setActiveTab('video');
      } else if (job.scenes && job.scenes.length > 0) {
        setActiveTab('scenes');
      }
    }
  }, [job, isTabInitialized]);

  // Terminal auto-scrolling
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [job?.logs, showTerminal]);

  // Clear states when jobId changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(null);
    setLinks(null);
    setError(null);
    setScenePage(0);
    setCustomTitle('');
    setCustomPrompt('');
    setSelectedScene(1);
    setThumbnailVersion(0);
    setIsEditorInitialized(false);
    setIsTabInitialized(false);
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    if (jobId) {
      fetchJobDetails(jobId, true);
    }
  }, [jobId, fetchJobDetails]);

  // Handle polling for active jobs
  useEffect(() => {
    if (job && jobId && !['completed', 'failed'].includes(job.status)) {
      pollTimerRef.current = setTimeout(() => {
        fetchJobDetails(jobId, false);
      }, 3000);
    }
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [job, jobId, fetchJobDetails]);





  if (!jobId) {
    return (
      <div className={styles.noJobSelected}>
        <div className={styles.welcomeIcon}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <h3>Select a production job or upload a new story to begin</h3>
        <p>Your video queue and outputs will be displayed here.</p>
      </div>
    );
  }

  if (loading && !job) {
    return (
      <div className={styles.noJobSelected}>
        <svg className="animate-spin-fast" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <p>Loading production logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBanner}>
          <div className={styles.errorIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <div className={styles.errorTitle}>Error Loading Job</div>
            <div className={styles.errorMessage}>{error}</div>
            <button 
              type="button" 
              className={styles.actionBtn} 
              style={{ marginTop: '12px' }} 
              onClick={() => fetchJobDetails(jobId, true)}
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = !isCompleted && !isFailed;

  const scenesPerPage = 8;
  const totalPages = job.scenes ? Math.ceil(job.scenes.length / scenesPerPage) : 0;
  const startIndex = scenePage * scenesPerPage;
  const visibleScenes = job.scenes ? job.scenes.slice(startIndex, startIndex + scenesPerPage) : [];

  // Find active step index based on progress and status
  const getStepStatus = (stepId: string, stepPercent: number) => {
    if (isFailed && job.current_step === stepId) return 'failed';
    if (isCompleted) return 'completed';
    
    // Check if the current backend status matches this step
    if (job.status === stepId) return 'active';
    
    // If progress is greater, it is completed
    if (job.progress_percent > stepPercent) return 'completed';
    
    // If progress matches or we are on it
    if (job.progress_percent === stepPercent && isProcessing) return 'active';
    
    return 'idle';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.jobTitle}>{job.story_filename || 'Untitled Production'}</h2>
          <div className={styles.jobId}>Job ID: {job.job_id}</div>
          <div className={styles.timeInfo}>
            {job.created_at && (
              <span>📅 Started: {new Date(job.created_at).toLocaleString()}</span>
            )}
            {job.completed_at && (
              <span>✅ Completed: {new Date(job.completed_at).toLocaleString()}</span>
            )}
          </div>
        </div>
        {isProcessing && (
          <div className={styles.headerRight}>
            {job.status === 'paused' ? (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.resumeBtn}`}
                onClick={handleResume}
                disabled={togglingPause}
              >
                ▶ Resume Generation
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.pauseBtn}`}
                onClick={handlePause}
                disabled={togglingPause}
              >
                ⏸ Pause Generation
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stepper Node Graph */}
      <div className={`glass ${styles.stepperContainer}`}>
        <div className={styles.stepperTitle}>
          {isProcessing ? (
            <>
              <svg className="animate-spin-fast" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                <path d="M12 2v4M12 18v4"/>
              </svg>
              Pipeline Processing — {job.progress_percent}%
            </>
          ) : isCompleted ? (
            '🎉 Production Completed'
          ) : (
            '❌ Production Failed'
          )}
        </div>
        <div className={styles.stepper}>
          <div className={styles.stepperLine}>
            <div 
              className={styles.stepperLineProgress}
              style={{ width: `${job.progress_percent}%` }}
            />
          </div>
          {STEPS.map((step, idx) => {
            const stepStatus = getStepStatus(step.id, step.percent);
            
            let classStatus = '';
            let dotContent: React.ReactNode = idx + 1;
            
            if (stepStatus === 'active') {
              classStatus = styles.stepActive;
              dotContent = (
                <svg className="animate-spin-fast" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2v4"/>
                </svg>
              );
            } else if (stepStatus === 'completed') {
              classStatus = styles.stepCompleted;
              dotContent = (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              );
            } else if (stepStatus === 'failed') {
              classStatus = styles.stepFailed;
              dotContent = '×';
            }

            return (
              <div key={step.id} className={`${styles.step} ${classStatus}`}>
                <div className={styles.stepDot}>{dotContent}</div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time System Console Logs */}
      {job.logs && job.logs.length > 0 && (
        <div className="glass" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onClick={() => setShowTerminal(!showTerminal)}
          >
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>💻</span> System Console Logs
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}>
              {showTerminal ? 'Hide Console [−]' : 'Show Console [+]'}
            </span>
          </div>
          
          {showTerminal && (
            <div className="terminal-container" ref={terminalRef}>
              {job.logs.map((logLine, idx) => {
                let statusClass = 'terminal-line-info';
                if (logLine.includes('✓') || logLine.includes('complete') || logLine.includes('success') || logLine.includes('completed')) {
                  statusClass = 'terminal-line-success';
                } else if (logLine.includes('✗') || logLine.includes('failed') || logLine.includes('FAILED') || logLine.includes('Error') || logLine.includes('failed:')) {
                  statusClass = 'terminal-line-error';
                } else if (logLine.includes('⚠') || logLine.includes('warning') || logLine.includes('Warning')) {
                  statusClass = 'terminal-line-warning';
                }
                
                const match = logLine.match(/^\[(.*?)\] (.*)$/);
                const timestamp = match ? match[1] : '';
                const textContent = match ? match[2] : logLine;
                
                return (
                  <div key={idx} className="terminal-line">
                    {timestamp && <span className="terminal-line-timestamp">[{timestamp}]</span>}
                    <span className={`terminal-line-text ${statusClass}`}>{textContent}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Error Output Card */}
      {isFailed && (
        <div className={styles.errorBanner}>
          <div className={styles.errorIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className={styles.errorTitle}>Pipeline Stopped — Failed at Step: &quot;{job.current_step}&quot;</div>
            <div className={styles.errorMessage}>{job.error_message}</div>
          </div>
        </div>
      )}

      {/* Completed Output Grid / Workspace tabs */}
      {job.scenes && job.scenes.length > 0 && (
        <>
          <div className="glass-tabs">
            {isCompleted && links && (
              <button 
                type="button" 
                className={`glass-tab-btn ${activeTab === 'video' ? 'glass-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('video')}
              >
                🎬 Compiled Video
              </button>
            )}
            {links?.character_bible_md && (
              <button 
                type="button" 
                className={`glass-tab-btn ${activeTab === 'bible' ? 'glass-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('bible')}
              >
                👤 Character Bible
              </button>
            )}
            <button 
              type="button" 
              className={`glass-tab-btn ${activeTab === 'scenes' ? 'glass-tab-btn-active' : ''}`}
              onClick={() => setActiveTab('scenes')}
            >
              📦 Scene Breakdown ({job.scenes.length})
            </button>
            {isCompleted && links && (
              <button 
                type="button" 
                className={`glass-tab-btn ${activeTab === 'thumbnail_editor' ? 'glass-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('thumbnail_editor')}
              >
                🖼️ Thumbnail Editor
              </button>
            )}
          </div>

          {/* Tab 1: Video Player */}
          {activeTab === 'video' && isCompleted && links && (
            <div className={styles.singleColumnOutput}>
              <VideoPlayer 
                episodeMp4={links.episode_mp4} 
                thumbnailPng={links.thumbnail_png} 
                jobId={jobId || ''} 
                thumbnailVersion={thumbnailVersion}
              />
            </div>
          )}

          {/* Tab 2: Character Bible */}
          {activeTab === 'bible' && links?.character_bible_md && (
            <CharacterBibleViewer characterBibleMd={links.character_bible_md} />
          )}

          {/* Tab 4: Thumbnail Editor */}
          {activeTab === 'thumbnail_editor' && isCompleted && links && (
            <div className={`glass ${styles.thumbnailEditorContainer}`}>
              <div className={styles.stackedEditorLayout}>
                {/* 1. Large Thumbnail Preview at the Top */}
                <div className={styles.largePreviewContainer}>
                  <h4 className={styles.editorSubTitle} style={{ textAlign: 'center', marginBottom: '8px' }}>
                    Current Thumbnail Preview
                  </h4>
                  <div className={styles.largeThumbnailPreviewWrapper}>
                    {links.thumbnail_png ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={`${getAssetUrl(links.thumbnail_png)}?t=${thumbnailVersion}`} 
                        alt="Thumbnail Preview" 
                        className={styles.largeThumbnailPreviewImage}
                      />
                    ) : (
                      <div className={styles.noThumbnail}>No Thumbnail Available</div>
                    )}
                    {regeneratingThumbnail && (
                      <div className={styles.editorOverlay}>
                        <svg className="animate-spin-fast" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                          <path d="M12 2v4M12 18v4" />
                        </svg>
                        <p style={{ marginTop: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Saving & Regenerating Thumbnail...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '20px 0' }} />

                {/* 2. Controls Stacked Below */}
                <div className={styles.stackedEditorControls}>
                  <h3 className={styles.editorMainTitle}>Customise Overlay Text & Background</h3>
                  
                  <div className={styles.editorInputGroup}>
                    <label className={styles.editorLabel}>Thumbnail Title Overlay (Optional)</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Enter bold overlay text (leave empty for no text)..."
                      className={styles.editorInput}
                      disabled={regeneratingThumbnail}
                    />
                    <span className={styles.editorHelpText}>This text will be written in large bold white letters over a dark bottom gradient. Clear it to remove the text overlay.</span>
                  </div>

                  <div className={styles.editorInputGroup}>
                    <label className={styles.editorLabel}>Custom Image Prompt (Optional)</label>
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. An epic cinematic battle on a snowy mountain, photorealistic..."
                      className={styles.editorInput}
                      disabled={regeneratingThumbnail}
                    />
                    <span className={styles.editorHelpText}>Type a custom prompt to generate a new AI background. Leave blank to revert back to selected background scene image below.</span>
                  </div>

                  <div className={styles.editorInputGroup}>
                    <label className={styles.editorLabel}>Background Scenes Available</label>
                    <span className={styles.editorHelpText} style={{ marginBottom: '6px' }}>
                      {customPrompt.trim() 
                        ? "Ignored because a custom AI image prompt is entered above. Clear the prompt to enable selected scene background." 
                        : "Choose which generated scene image to use as the background canvas for the thumbnail."}
                    </span>
                    <div className={`${styles.scenesScrollGrid} ${customPrompt.trim() ? styles.scenesScrollGridDisabled : ''}`}>
                      {job.scenes?.map((scene) => {
                        const isSelected = selectedScene === scene.scene_number;
                        const sceneImgUrl = scene.image_path ? getAssetUrl(scene.image_path) : '';
                        return (
                          <div 
                            key={scene.scene_number} 
                            className={`${styles.sceneThumbCard} ${isSelected ? styles.sceneThumbCardActive : ''}`}
                            onClick={() => {
                              if (!regeneratingThumbnail && !customPrompt.trim()) {
                                setSelectedScene(scene.scene_number);
                              }
                            }}
                          >
                            <div className={styles.sceneThumbImgWrapper}>
                              {sceneImgUrl ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={sceneImgUrl} alt={`Scene ${scene.scene_number}`} className={styles.sceneThumbImg} />
                              ) : (
                                <div className={styles.noThumbnail}>No Image</div>
                              )}
                            </div>
                            <div className={styles.sceneThumbMeta}>
                              <span className={styles.sceneThumbNumber}>Scene {scene.scene_number}</span>
                              <span className={styles.sceneThumbPrompt} title={scene.image_prompt}>
                                Prompt: {scene.image_prompt}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={handleRegenerateThumbnail}
                      disabled={regeneratingThumbnail}
                      className={styles.editorSaveBtn}
                    >
                      {regeneratingThumbnail ? (
                        <>
                          <svg className="animate-spin-fast" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                            <path d="M12 2v4"/>
                          </svg>
                          Saving & Regenerating...
                        </>
                      ) : (
                        '💾 Save Changes'
                      )}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Scene Breakdown */}
          {activeTab === 'scenes' && (
            <div>
              <div className={styles.sectionHeader} style={{ marginBottom: '16px' }}>
                <h3 className={styles.sectionTitle}>
                  <span>📦</span> Scene Breakdown ({job.scenes.length} Scenes)
                </h3>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className={styles.actionBtn}
                      onClick={() => setScenePage(prev => Math.max(0, prev - 1))}
                      disabled={scenePage === 0}
                    >
                      ◀ Previous 8
                    </button>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Page {scenePage + 1} of {totalPages}
                    </span>
                    <button 
                      type="button" 
                      className={styles.actionBtn}
                      onClick={() => setScenePage(prev => Math.min(totalPages - 1, prev + 1))}
                      disabled={scenePage === totalPages - 1}
                    >
                      Next 8 ▶
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.sceneGrid}>
                {visibleScenes.map((scene, idx) => (
                  <SceneCard 
                    key={startIndex + idx} 
                    scene={scene} 
                    jobId={jobId || ''}
                    onSceneUpdated={() => fetchJobDetails(jobId || '', false)}
                  />
                ))}
              </div>
              
              {/* Bottom Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', marginTop: '24px' }}>
                  <button 
                    type="button" 
                    className={styles.actionBtn}
                    onClick={() => setScenePage(prev => Math.max(0, prev - 1))}
                    disabled={scenePage === 0}
                  >
                    ◀ Previous 8
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Page {scenePage + 1} of {totalPages}
                  </span>
                  <button 
                    type="button" 
                    className={styles.actionBtn}
                    onClick={() => setScenePage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={scenePage === totalPages - 1}
                  >
                    Next 8 ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
