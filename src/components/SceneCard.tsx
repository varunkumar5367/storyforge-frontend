// src/components/SceneCard.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Scene, getAssetUrl, regenerateScene } from '@/utils/api';
import styles from './SceneCard.module.css';

interface SceneCardProps {
  scene: Scene;
  jobId: string;
  onSceneUpdated?: () => void;
}

const CustomAudioPlayer = ({ src }: { src: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const seekTime = parseFloat(e.target.value);
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  return (
    <div className={styles.customAudio}>
      <audio 
        ref={audioRef} 
        src={src} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="none"
      />
      <button type="button" onClick={togglePlay} className={styles.audioPlayBtn}>
        {isPlaying ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="4" height="16" />
            <rect x="16" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>
      <input 
        type="range" 
        min="0" 
        max={duration || 100} 
        value={currentTime} 
        onChange={handleSeek} 
        className={styles.audioSlider}
      />
      <span className={styles.audioTime}>{formatTime(currentTime)} / {formatTime(duration)}</span>
    </div>
  );
};

export default function SceneCard({ scene, jobId, onSceneUpdated }: SceneCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [editedPrompt, setEditedPrompt] = useState(scene.image_prompt || '');
  const [editedText, setEditedText] = useState(scene.text || scene.narration || '');
  const [editedLocation, setEditedLocation] = useState(scene.location || '');
  const [editedMood, setEditedMood] = useState(scene.mood || '');
  const [regenImage, setRegenImage] = useState(false);
  const [regenVoice, setRegenVoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [prevScene, setPrevScene] = useState(scene);
  if (scene !== prevScene) {
    setPrevScene(scene);
    setEditedPrompt(scene.image_prompt || '');
    setEditedText(scene.text || scene.narration || '');
    setEditedLocation(scene.location || '');
    setEditedMood(scene.mood || '');
  }

  const imageUrl = scene.image_path ? getAssetUrl(scene.image_path) : null;
  const audioUrl = scene.audio_path ? getAssetUrl(scene.audio_path) : null;

  const handleSaveAndRegenerate = async () => {
    setIsSaving(true);
    try {
      await regenerateScene(jobId, scene.scene_number, {
        image_prompt: editedPrompt,
        text: editedText,
        location: editedLocation,
        mood: editedMood,
        regenerate_image: regenImage,
        regenerate_voice: regenVoice
      });
      setIsEditing(false);
      if (onSceneUpdated) {
        onSceneUpdated();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`Save failed: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`glass-interactive ${styles.card}`}>
      <div className={styles.mediaSection}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={scene.title || `Scene ${scene.scene_number}`} 
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <span>Image not generated yet</span>
          </div>
        )}
        <div className={styles.sceneOverlay}>
          <span>🎬</span> Scene {scene.scene_number}
        </div>
        {scene.duration_hint && (
          <div className={styles.durationOverlay}>
            ⏱️ {scene.duration_hint.toFixed(1)}s
          </div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h4 className={styles.sceneTitle}>{scene.title || `Scene ${scene.scene_number}`}</h4>
            <button 
              type="button" 
              onClick={() => setIsEditing(!isEditing)}
              style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600 }}
            >
              {isEditing ? 'Cancel' : 'Edit Scene'}
            </button>
          </div>
          <span className={styles.metaText}>
            📍 Location: <strong>{scene.location}</strong> | Mood: <strong>{scene.mood}</strong>
          </span>
        </div>

        {isEditing ? (
          <div className={styles.editContainer}>
            <div className={styles.editInputGroup}>
              <label className={styles.editLabel}>Location</label>
              <input 
                type="text" 
                value={editedLocation} 
                onChange={(e) => setEditedLocation(e.target.value)}
                className={styles.inputField}
              />
            </div>
            <div className={styles.editInputGroup}>
              <label className={styles.editLabel}>Mood</label>
              <input 
                type="text" 
                value={editedMood} 
                onChange={(e) => setEditedMood(e.target.value)}
                className={styles.inputField}
              />
            </div>
            <div className={styles.editInputGroup}>
              <label className={styles.editLabel}>Narration Script</label>
              <textarea 
                value={editedText} 
                onChange={(e) => setEditedText(e.target.value)}
                className={styles.inputField}
                style={{ minHeight: '60px', resize: 'vertical' }}
              />
            </div>
            <div className={styles.editInputGroup}>
              <label className={styles.editLabel}>Image Prompt</label>
              <textarea 
                value={editedPrompt} 
                onChange={(e) => setEditedPrompt(e.target.value)}
                className={styles.inputField}
                style={{ minHeight: '60px', resize: 'vertical' }}
              />
            </div>
            
            <div className={styles.editCheckboxGroup}>
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={regenImage} 
                  onChange={(e) => setRegenImage(e.target.checked)} 
                />
                🎨 Image
              </label>
              <label className={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={regenVoice} 
                  onChange={(e) => setRegenVoice(e.target.checked)} 
                />
                🎙️ Voice
              </label>
            </div>

            <div className={styles.editActions}>
              <button 
                type="button" 
                onClick={handleSaveAndRegenerate} 
                className={styles.saveBtn}
                disabled={isSaving}
              >
                {isSaving ? 'Re-composing...' : 'Save & Regenerate'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.narrationBox} title="Voice Narration Script">
              {scene.text || scene.narration}
            </div>

            {audioUrl ? (
              <div className={styles.audioContainer}>
                <CustomAudioPlayer src={audioUrl} />
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' }}>
                🎙️ Voice over pending
              </div>
            )}

            {scene.characters_present && scene.characters_present.length > 0 && (
              <div className={styles.characters}>
                {scene.characters_present.map((char, index) => (
                  <span key={index} className={styles.characterTag}>
                    👤 {char}
                  </span>
                ))}
              </div>
            )}

            <div className={styles.expandable}>
              <button 
                type="button" 
                className={styles.toggleExpand} 
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <span>Details & Prompt</span>
                <svg 
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              
              {isExpanded && (
                <div className={styles.expandContent}>
                  <div>
                    <div className={styles.promptLabel}>Setting</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{scene.setting}</div>
                  </div>
                  <div>
                    <div className={styles.promptLabel}>Image Prompt</div>
                    <div className={styles.promptText}>{scene.image_prompt}</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
