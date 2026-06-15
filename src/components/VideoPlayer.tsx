// src/components/VideoPlayer.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getAssetUrl, getDownloadFileUrl } from '@/utils/api';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  episodeMp4: string | null;
  thumbnailPng: string | null;
  jobId: string;
  thumbnailVersion?: number;
}

export default function VideoPlayer({ episodeMp4, thumbnailPng, jobId, thumbnailVersion }: VideoPlayerProps) {
  const videoUrl = episodeMp4 ? getAssetUrl(episodeMp4) : '';
  const thumbUrl = thumbnailPng ? `${getAssetUrl(thumbnailPng)}?t=${thumbnailVersion || 0}` : '';


  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Scrubber dragging state checks to prevent connection spam
  const [isDragging, setIsDragging] = useState(false);
  const [localTime, setLocalTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isSeekingRef = useRef(false);

  // Render-phase sync of localTime with currentTime when not dragging
  const [prevCurrentTime, setPrevCurrentTime] = useState(currentTime);
  if (currentTime !== prevCurrentTime) {
    setPrevCurrentTime(currentTime);
    if (!isDragging) {
      setLocalTime(currentTime);
    }
  }



  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeekingRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setLocalTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTime(parseFloat(e.target.value));
  };

  const handleSeekEnd = () => {
    if (videoRef.current) {
      isSeekingRef.current = true;
      videoRef.current.currentTime = localTime;
      setCurrentTime(localTime);
    }
    setIsDragging(false);
  };

  const seekRelative = (seconds: number) => {
    if (videoRef.current) {
      isSeekingRef.current = true;
      const videoDuration = videoRef.current.duration || duration || 100;
      let nextTime = videoRef.current.currentTime + seconds;
      if (nextTime < 0) nextTime = 0;
      if (nextTime > videoDuration) nextTime = videoDuration;
      videoRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
      setLocalTime(nextTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
    if (!nextMute && volume === 0) {
      setVolume(0.5);
      videoRef.current.volume = 0.5;
    }
  };

  // Keyboard accessibility controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses inside form input elements
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, isPlaying, isMuted, volume]);

  const handleSpeedSelect = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn('Failed to enter fullscreen mode:', err);
      });
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };


  if (!episodeMp4) {
    return (
      <div className={`glass ${styles.container}`} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Video file is not available.</p>
      </div>
    );
  }

  return (
    <div className={`glass ${styles.container}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          Compiled Video Output
        </h3>
      </div>

      <div className={styles.videoWrapper} ref={containerRef}>
        <div className={styles.videoContainer}>
          <video 
            ref={videoRef}
            src={videoUrl} 
            poster={thumbUrl} 
            className={styles.video}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onSeeked={handleSeeked}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
          />

          {/* Premium Glass Controls */}
          <div className={styles.customVideoControls}>
            <div className={styles.progressContainer}>
              <input 
                type="range"
                min="0"
                max={duration || 100}
                value={localTime}
                onChange={handleSeekChange}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={handleSeekEnd}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={handleSeekEnd}
                className={styles.videoRange}
              />
            </div>
            
            <div className={styles.controlsRow}>
              <div className={styles.controlsLeft}>
                {/* -10s Rewind Button */}
                <button 
                  type="button" 
                  onClick={() => seekRelative(-10)} 
                  className={styles.controlBtn} 
                  title="Rewind 10s"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <text x="6.5" y="14.5" fontSize="7" fontWeight="900" fill="currentColor">-10</text>
                  </svg>
                </button>

                {/* Play/Pause Button */}
                <button type="button" onClick={togglePlay} className={`${styles.controlBtn} ${styles.playPauseBtn}`} title={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="4" width="4" height="16" />
                      <rect x="15" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                {/* +10s Fast-Forward Button */}
                <button 
                  type="button" 
                  onClick={() => seekRelative(10)} 
                  className={styles.controlBtn} 
                  title="Forward 10s"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <text x="5.5" y="14.5" fontSize="7" fontWeight="900" fill="currentColor">+10</text>
                  </svg>
                </button>

                <div className={styles.volumeContainer}>
                  <button type="button" onClick={toggleMute} className={styles.controlBtn} title={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted || volume === 0 ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                    )}
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className={styles.volumeSlider}
                  />
                </div>

                <span className={styles.videoTime}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className={styles.controlsRight}>
                {/* Speed Controller */}
                <div className={styles.speedMenu}>
                  <button 
                    type="button" 
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className={styles.controlBtn}
                    style={{ fontSize: '0.8rem', fontWeight: 700 }}
                    title="Playback Speed"
                  >
                    {playbackRate}x
                  </button>
                  {showSpeedMenu && (
                    <div className={styles.speedDropdown}>
                      {[0.5, 1, 1.25, 1.5, 2].map(rate => (
                        <button 
                          key={rate} 
                          type="button" 
                          onClick={() => handleSpeedSelect(rate)}
                          className={`${styles.speedOption} ${playbackRate === rate ? styles.speedOptionActive : ''}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                <button type="button" onClick={toggleFullscreen} className={styles.controlBtn} title="Toggle Fullscreen">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.downloadGrid}>
        {/* Video Card */}
        <div className={styles.downloadCard}>
          <div className={styles.cardLeft}>
            <div className={`${styles.iconContainer} ${styles.iconVideo}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
            </div>
            <div>
              <div className={styles.fileLabel}>Video Episode</div>
              <div className={styles.fileName}>episode.mp4</div>
            </div>
          </div>
          <a 
            href={getDownloadFileUrl(jobId, 'video')} 
            className={styles.downloadButton} 
            title="Download Video"
            download={`storyforge_${jobId.slice(0, 8)}_episode.mp4`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
          </a>
        </div>

        {/* Thumbnail Card */}
        {thumbnailPng && (
          <div className={styles.downloadCard}>
            <div className={styles.cardLeft}>
              <div className={`${styles.iconContainer} ${styles.iconThumbnail}`} style={{ padding: 0, overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={thumbUrl} 
                  alt="Thumbnail Preview" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
              <div>
                <div className={styles.fileLabel}>Thumbnail Image</div>
                <div className={styles.fileName}>thumbnail.png</div>
              </div>
            </div>
            <a 
              href={getDownloadFileUrl(jobId, 'thumbnail')} 
              className={styles.downloadButton} 
              title="Download Thumbnail"
              download={`storyforge_${jobId.slice(0, 8)}_thumbnail.png`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
