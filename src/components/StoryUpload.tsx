// src/components/StoryUpload.tsx
'use client';

import React, { useState, useRef, DragEvent, ChangeEvent, useEffect, useCallback } from 'react';
import { uploadStoryText, getPollenBalance, getVoiceSampleUrl } from '@/utils/api';
import styles from './StoryUpload.module.css';

const VOICES = [
  { id: 'en-US-JennyNeural', label: 'Jenny (US Female) - Default', gender: 'Female' },
  { id: 'en-US-GuyNeural', label: 'Guy (US Male)', gender: 'Male' },
  { id: 'en-US-AriaNeural', label: 'Aria (US Female)', gender: 'Female' },
  { id: 'en-US-AnaNeural', label: 'Ana (US Child Female)', gender: 'Female' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher (US Male)', gender: 'Male' },
  { id: 'en-US-EricNeural', label: 'Eric (US Male)', gender: 'Male' },
  { id: 'en-US-MichelleNeural', label: 'Michelle (US Female)', gender: 'Female' },
  { id: 'en-US-RogerNeural', label: 'Roger (US Male)', gender: 'Male' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK Male)', gender: 'Male' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)', gender: 'Female' },
  { id: 'en-GB-LibbyNeural', label: 'Libby (UK Female)', gender: 'Female' },
  { id: 'en-GB-OliverNeural', label: 'Oliver (UK Male)', gender: 'Male' },
  { id: 'en-GB-ThomasNeural', label: 'Thomas (UK Male)', gender: 'Male' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (Australia Female)', gender: 'Female' },
  { id: 'en-AU-WilliamNeural', label: 'William (Australia Male)', gender: 'Male' },
  { id: 'en-CA-LiamNeural', label: 'Liam (Canada Male)', gender: 'Male' },
  { id: 'en-CA-ClaraNeural', label: 'Clara (Canada Female)', gender: 'Female' },
  { id: 'en-IE-ConnorNeural', label: 'Connor (Ireland Male)', gender: 'Male' },
  { id: 'en-IE-EmilyNeural', label: 'Emily (Ireland Female)', gender: 'Female' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja (India Female)', gender: 'Female' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat (India Male)', gender: 'Male' },
  { id: 'en-NZ-MitchellNeural', label: 'Mitchell (New Zealand Male)', gender: 'Male' },
  { id: 'en-ZA-LeahNeural', label: 'Leah (South Africa Female)', gender: 'Female' },
  { id: 'en-ZA-LukeNeural', label: 'Luke (South Africa Male)', gender: 'Male' },
];

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Dramatic studio lighting, photorealistic movie feel', icon: '🎬' },
  { id: 'anime', label: 'Anime / Manga', desc: 'Hand-drawn cell-shaded illustration art style', icon: '🎨' },
  { id: 'cyberpunk', label: 'Cyberpunk', desc: 'Neon lighting, high-tech dark futuristic ambiance', icon: '💻' },
  { id: 'watercolor', label: 'Watercolor', desc: 'Soft pastel wash, organic textured artistic look', icon: '🖌️' },
  { id: 'pixel', label: 'Pixel Art', desc: 'Retro 8-bit / 16-bit video game aesthetic', icon: '👾' },
  { id: 'pixar', label: '3D Pixar', desc: 'Volumetric studio lighting, stylized clay modeling', icon: '🎭' },
  { id: 'comic', label: 'Comic Book', desc: 'Bold ink lines, halftone shading, vivid flat colors', icon: '💥' },
  { id: 'horror', label: 'Dark Horror', desc: 'Gritty desaturated tones, eerie shadows, unsettling atmosphere', icon: '🕯️' },
  { id: 'fantasy', label: 'Epic Fantasy', desc: 'Magical golden light, lush medieval landscapes, dragons & lore', icon: '🧙' },
  { id: 'scifi', label: 'Sci-Fi Space', desc: 'Galactic nebula backdrops, chrome surfaces, cosmic scale', icon: '🚀' },
  { id: 'vintage', label: 'Vintage Film', desc: 'Sepia grain, film burn, 1940s old-school photograph', icon: '📷' },
  { id: 'noir', label: 'Film Noir', desc: 'High-contrast monochrome, moody shadows, detective drama', icon: '🕵️' },
  { id: 'manhwa', label: 'Manhwa / Webtoon', desc: 'Modern webtoon style, vibrant digital painting', icon: '📖' },
];

const STYLE_PROMPTS: Record<string, string> = {
  cinematic: 'dramatic studio lighting, photorealistic movie feel, volumetric haze, movie atmosphere, highly detailed',
  anime: 'hand-drawn cell-shaded illustration art style, vibrant colors, detailed anime background, anime aesthetic',
  cyberpunk: 'neon lighting, high-tech dark futuristic ambiance, glowing reflections, synthwave aesthetic, rainy night',
  watercolor: 'soft pastel wash, organic textured artistic look, flowing pigments, elegant watercolor bleed, hand-painted',
  pixel: 'retro 8-bit / 16-bit video game aesthetic, pixelated texture, vibrant colors, pixel art scene',
  pixar: 'volumetric studio lighting, stylized clay modeling, 3D render style, cute cartoon characters, smooth shaders',
  comic: 'bold black ink outlines, halftone dot shading, vivid flat primary colors, classic comic book panel style',
  horror: 'gritty desaturated color palette, deep eerie shadows, unsettling atmosphere, dim flickering candlelight, dark horror film',
  fantasy: 'epic fantasy art, magical golden hour light, lush medieval environment, intricate world-building detail, painterly',
  scifi: 'sci-fi space setting, galactic nebula backdrop, chrome metallic surfaces, bioluminescent glow, cinematic cosmic scale',
  vintage: 'sepia toned aged photograph, film grain texture, 1940s old-school style, vignette edges, nostalgic warm light',
  noir: 'high contrast monochrome black and white, moody dramatic shadows, venetian blind light streaks, classic film noir detective drama',
  manhwa: 'modern manhwa webtoon style, vibrant digital painting, colorful clean webtoon illustration, crisp digital line art',
};


const RATIOS = [
  { id: '16:9', label: 'Landscape 16:9', sub: 'YouTube / Widescreen', w: 14, h: 8 },
  { id: '9:16', label: 'Vertical 9:16', sub: 'Shorts / TikTok / Reels', w: 8, h: 14 },
  { id: '1:1', label: 'Square 1:1', sub: 'Instagram Feed / Post', w: 10, h: 10 },
];

const SUBTITLE_STYLES = [
  { id: 'classic', label: 'Classic White', desc: 'Standard clean centered subtitles', icon: '⚪' },
  { id: 'neon', label: 'Neon Cyber', desc: 'Bright cyan letters with neon glowing outline', icon: '🔷' },
  { id: 'minimalist', label: 'Minimalist', desc: 'Translucent dark bar backdrop, gray text', icon: '▫️' },
];

const QUALITY_PRESETS = [
  { id: 'normal', label: 'Normal (Fast)', desc: 'SDXL-Lightning 4 steps — ultra-fast drafts (~15–25s / scene)', icon: '⚡', chocoPerScene: 1, inferenceSteps: 4, adminOnly: false },
  { id: 'high', label: 'High Quality', desc: 'FLUX-Schnell 4 steps — sharp, fast (~10s / scene)', icon: '✨', chocoPerScene: 2, inferenceSteps: 4, adminOnly: false },
  { id: 'very_high', label: 'Very High Quality', desc: 'FLUX-Dev 28 steps — maximum accuracy & detail (~60–90s / scene)', icon: '🔮', chocoPerScene: 3, inferenceSteps: 28, adminOnly: false },
];

const QUALITY_MODELS = {
  normal: 'ByteDance/SDXL-Lightning-4step',
  high: 'black-forest-labs/FLUX.1-schnell',
  very_high: 'black-forest-labs/FLUX.1-dev',
};

const QUALITY_CHOCO_RATE: Record<string, number> = { normal: 1, high: 2, very_high: 3 };
const QUALITY_INFERENCE_STEPS: Record<string, number> = { normal: 4, high: 4, very_high: 28 };

interface StoryUploadProps {
  onUploadSuccess: (jobId: string) => void;
}


const MAX_QUOTA = 20;

/** Returns HH:MM:SS countdown to next top-of-hour */
function getNextHourReset(): Date {
  const next = new Date();
  next.setHours(next.getHours() + 1, 0, 0, 0);
  return next;
}
function formatCountdown(diffMs: number): string {
  const total = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
}

export default function StoryUpload({ onUploadSuccess }: StoryUploadProps) {
  // Wizard Navigation Step
  const [step, setStep] = useState(1);

  // Step 1: Story Details States
  const [storyTitle, setStoryTitle] = useState('');
  const [storyText, setStoryText] = useState('');
  const [toneStyle, setToneStyle] = useState('');
  const [fileImportedName, setFileImportedName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Step 2: Prompt Refinements
  const [visualStyle, setVisualStyle] = useState('cinematic');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [customPrompt, setCustomPrompt] = useState(STYLE_PROMPTS.cinematic);

  // Step 3: Generation & Voice Settings
  const [selectedVoice, setSelectedVoice] = useState('en-US-JennyNeural');
  const [subtitleStyle, setSubtitleStyle] = useState('classic');
  const [selectedQuality, setSelectedQuality] = useState('normal'); // 'normal' | 'high' | 'very_high'

  // General Async States
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pollen balance tracking
  const [pollen, setPollen] = useState<number | null>(null);
  const [imagesLeft, setImagesLeft] = useState<number | null>(null);
  const [pollenError, setPollenError] = useState<string | null>(null);
  const [pollenMsg, setPollenMsg] = useState<string | null>(null);

  // Role & quota enforcement
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('');

  // Voice Actor preview state
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isSampleLoading, setIsSampleLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default voice setting from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const defVoice = localStorage.getItem('storyforge_default_voice');
      if (defVoice) {
        setSelectedVoice(defVoice);
      }
    }
  }, []);

  // Stop playing if voice changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingSample(false);
      setIsSampleLoading(false);
    }
  }, [selectedVoice]);

  const handleTogglePlaySample = () => {
    if (!audioRef.current) return;
    
    if (isPlayingSample) {
      audioRef.current.pause();
      setIsPlayingSample(false);
    } else {
      setIsSampleLoading(true);
      setError(null);
      const sampleUrl = getVoiceSampleUrl(selectedVoice);
      audioRef.current.src = sampleUrl;
      audioRef.current.play()
        .then(() => {
          setIsPlayingSample(true);
          setIsSampleLoading(false);
        })
        .catch(err => {
          console.warn("Failed to play sample:", err);
          setIsSampleLoading(false);
          setError("Failed to load voice sample. Please try again.");
        });
    }
  };

  const fetchPollen = useCallback(async () => {
    try {
      const res = await getPollenBalance();
      if (res.success) {
        setPollen(res.pollen);
        setImagesLeft(res.images_left);
        setPollenError(null);
        setPollenMsg(null);
      } else {
        setPollen(null);
        setImagesLeft(null);
        setPollenError(res.error || 'Authentication error');
        setPollenMsg(res.message || null);
      }
    } catch (err) {
      console.warn('Failed to load Pollen balance:', err);
    }
  }, []);

  useEffect(() => {
    fetchPollen();
    window.addEventListener('pollen-updated', fetchPollen);
    return () => window.removeEventListener('pollen-updated', fetchPollen);
  }, [fetchPollen]);

  // Read role from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('storyforge_role');
      setIsAdmin(role === 'admin');
    }
  }, []);

  // Live reset countdown
  useEffect(() => {
    const resetTarget = getNextHourReset();
    const tick = () => setResetCountdown(formatCountdown(resetTarget.getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Clean up audio preview on component unmount
  useEffect(() => {
    const currentAudio = audioRef.current;
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, []);

  // Drag & drop file handlers inside Step 1 textarea
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFileImport = (importedFile: File) => {
    if (!importedFile.name.endsWith('.txt')) {
      setError('Only plain text (.txt) files are supported.');
      return;
    }
    if (importedFile.size > 500_000) {
      setError('File size exceeds the 500 KB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setStoryText(text || '');
      
      // Infer Title from Filename if not already typed
      if (!storyTitle.trim()) {
        const inferredTitle = importedFile.name
          .replace(/\.txt$/i, '')
          .replace(/[_\-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setStoryTitle(inferredTitle);
      }

      setFileImportedName(importedFile.name);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read text file.');
    };
    reader.readAsText(importedFile);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileImport(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileImport(e.target.files[0]);
    }
  };

  const removeImportedFile = () => {
    setFileImportedName(null);
    setStoryText('');
    setStoryTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearForm = () => {
    setStoryTitle('');
    setStoryText('');
    setToneStyle('');
    setFileImportedName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);

    try {
      if (!storyTitle.trim() || !storyText.trim()) {
        setError('Missing required details. Please check Step 1.');
        setStep(1);
        setIsUploading(false);
        return;
      }

      // Format custom metadata tags at the top of the text file for the LLM Story Analyzer
      const styleInfo = STYLES.find(s => s.id === visualStyle)?.label || 'Cinematic';
      const ratioInfo = RATIOS.find(r => r.id === aspectRatio)?.label || 'Landscape 16:9';
      
      let finalScript = `[STORY CONFIGURATION
Title: "${storyTitle.trim()}"
Tone & Mood: "${toneStyle.trim() || 'Default'}"
Visual Style: "${styleInfo}"
Aspect Ratio: "${ratioInfo}"
Subtitles style: "${subtitleStyle}"
]
`;

      if (customPrompt.trim()) {
        finalScript += `[ARTISTIC NOTE: ${customPrompt.trim()}]\n`;
      }

      finalScript += `\n${storyText.trim()}`;

      const name = `${storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.txt`;
      const modelId = QUALITY_MODELS[selectedQuality as keyof typeof QUALITY_MODELS] || QUALITY_MODELS.normal;
      const inferenceSteps = QUALITY_INFERENCE_STEPS[selectedQuality] ?? 15;
      const res = await uploadStoryText(finalScript, name, selectedVoice, modelId, inferenceSteps);

      // Reset form states
      handleClearForm();
      setStep(1);
      
      // Trigger callback
      onUploadSuccess(res.job_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during submission.';
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  // Live Calculations for Step 1
  const wordCount = storyText.trim() ? storyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const estimatedScenes = Math.max(0, Math.ceil(wordCount / 45));
  
  const formatEstLength = (words: number) => {
    if (words === 0) return '0 min';
    const totalSecs = Math.round(words * 0.4); // 0.4 seconds per word average
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins === 0) return `${secs} sec`;
    return `${mins} min ${secs} sec`;
  };

  const creditsAvailable = imagesLeft ?? MAX_QUOTA;
  // Choco cost per scene varies by quality tier
  const chocoRate = QUALITY_CHOCO_RATE[selectedQuality] ?? 1;
  const chocoCost = estimatedScenes * chocoRate;
  // Quota check: only block for non-admin users on Step 2 when quality is selected
  const chocoInsufficient = !isAdmin && estimatedScenes > 0 && chocoCost > creditsAvailable;
  // Keep step 1 unblocked — only step 2 Continue is gated by balance
  const quotaExceeded = false; // removed from step 1

  const isStep1Valid = storyTitle.trim() && storyText.trim();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Creator Studio</h2>
      <p className={styles.description}>
        Convert story scripts into high-quality AI video productions in a few simple steps.
      </p>

      {/* 3-Step Wizard Navigation Stepper */}
      <div className={styles.stepperContainer}>
        <div className={styles.stepperRow}>
          <div className={`${styles.stepNode} ${step === 1 ? styles.stepNodeActive : ''} ${step > 1 ? styles.stepNodeCompleted : ''}`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <div className={`${styles.stepConnector} ${step > 1 ? styles.stepConnectorActive : ''}`} />
          <div className={`${styles.stepNode} ${step === 2 ? styles.stepNodeActive : ''} ${step > 2 ? styles.stepNodeCompleted : ''} ${quotaExceeded ? styles.stepNodeLocked : ''}`}>
            {quotaExceeded ? '🔒' : step > 2 ? '✓' : '2'}
          </div>
          <div className={`${styles.stepConnector} ${step > 2 ? styles.stepConnectorActive : ''}`} />
          <div className={`${styles.stepNode} ${step === 3 ? styles.stepNodeActive : ''} ${quotaExceeded ? styles.stepNodeLocked : ''}`}>
            {quotaExceeded ? '🔒' : '3'}
          </div>
        </div>
        <div className={styles.labelsRow}>
          <span className={`${styles.stepLabel} ${step === 1 ? styles.stepLabelActive : ''} ${step > 1 ? styles.stepLabelCompleted : ''}`}>
            Story details
          </span>
          <span className={`${styles.stepLabel} ${step === 2 ? styles.stepLabelActive : ''} ${step > 2 ? styles.stepLabelCompleted : ''} ${quotaExceeded ? styles.stepLabelLocked : ''}`}>
            Refine prompt
          </span>
          <span className={`${styles.stepLabel} ${step === 3 ? styles.stepLabelActive : ''} ${quotaExceeded ? styles.stepLabelLocked : ''}`}>
            Generate
          </span>
        </div>
      </div>

      <form onSubmit={handleUploadSubmit}>
        {/* ================================================================= */}
        {/* STEP 1: Story Details */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>
                Story Title <span className={styles.requiredAsterisk}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. The Last Corner Store"
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className={styles.textInput}
                required
              />
            </div>



            <div className={styles.inputGroup}>
              <div className={styles.fileImportHeader}>
                <label className={styles.inputLabel}>
                  Story Text <span className={styles.requiredAsterisk}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.fileImportBtn}
                >
                  📁 Import .txt file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {fileImportedName && (
                <div className={styles.importedFileInfo}>
                  <span>Imported Script: <strong>{fileImportedName}</strong></span>
                  <span onClick={removeImportedFile} className={styles.removeImportedFile}>
                    Remove [×]
                  </span>
                </div>
              )}

              <div className={styles.textAreaContainer}>
                <textarea
                  placeholder="Paste your story here or upload a text file..."
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`${styles.textArea} ${dragActive ? styles.textAreaDragActive : ''}`}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Tone & Style</label>
              <input
                type="text"
                placeholder="e.g. dark, mysterious, hopeful, comedic"
                value={toneStyle}
                onChange={(e) => setToneStyle(e.target.value)}
                className={styles.textInput}
              />
            </div>

            {/* Quota warning banner (non-admin, quota exceeded) */}
            {quotaExceeded && (
              <div className={styles.quotaBanner}>
                <div className={styles.quotaBannerIcon}>⚠️</div>
                <div className={styles.quotaBannerBody}>
                  <strong className={styles.quotaBannerTitle}>INSUFFICIENT CREDITS</strong>
                  <p className={styles.quotaBannerMsg}>
                    This project requires <strong>{estimatedScenes}</strong> credits but you only have{' '}
                    <strong>{creditsAvailable}</strong> available. You cannot proceed to the next step.
                  </p>
                  <ul className={styles.quotaBannerList}>
                    <li>Reduce your story length (~1 scene per 45 words)</li>
                    <li>Wait for quota reset — resets in <strong>{resetCountdown}</strong></li>
                    <li>Contact your administrator for a quota increase</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Dynamic Estimations Dashboard box */}
            <div className={styles.estimationsBox}>
              <div className={styles.estimationItem}>
                <span className={styles.estimationLabel}>Word Count</span>
                <span className={styles.estimationValue}>{wordCount.toLocaleString()}</span>
              </div>
              <div className={styles.estimationItem}>
                <span className={styles.estimationLabel}>Estimated Scenes</span>
                <span className={styles.estimationValue}>{estimatedScenes}</span>
              </div>
              <div className={styles.estimationItem}>
                <span className={styles.estimationLabel}>Est. Video Length</span>
                <span className={styles.estimationValue}>{formatEstLength(wordCount)}</span>
              </div>
            </div>

            {/* Actions for Step 1 */}
            <div className={styles.footerActions}>
              <button
                type="button"
                onClick={handleClearForm}
                className={styles.clearBtn}
                disabled={!storyTitle && !storyText && !toneStyle}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={styles.continueBtn}
                disabled={!isStep1Valid}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: Refine Prompt / Visual Style */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Visual Style Preset</label>
              <div className={styles.presetsGrid}>
                {STYLES.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setVisualStyle(s.id);
                      setCustomPrompt(STYLE_PROMPTS[s.id] || '');
                    }}
                    className={`${styles.presetCard} ${visualStyle === s.id ? styles.presetCardActive : ''}`}
                  >
                    <span className={styles.presetIcon}>{s.icon}</span>
                    <span className={styles.presetTitle}>{s.label}</span>
                    <span className={styles.presetDesc}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Aspect Ratio</label>
              <div className={styles.ratioWrapper}>
                {RATIOS.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setAspectRatio(r.id)}
                    className={`${styles.ratioCard} ${aspectRatio === r.id ? styles.ratioCardActive : ''}`}
                  >
                    <div
                      className={styles.ratioBox}
                      style={{ width: `${r.w}px`, height: `${r.h}px` }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className={styles.ratioLabel}>{r.label}</span>
                      <span className={styles.ratioSub}>{r.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Image Generation Quality</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {QUALITY_PRESETS.filter(q => !q.adminOnly || isAdmin).map((q) => (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuality(q.id)}
                    className={`${styles.presetCard} ${selectedQuality === q.id ? styles.presetCardActive : ''}`}
                    style={{ minHeight: '80px', padding: '12px 16px', position: 'relative' }}
                  >
                    {q.adminOnly && (
                      <span style={{
                        position: 'absolute', top: '6px', right: '8px',
                        fontSize: '9px', fontWeight: 700, color: 'var(--accent-purple)',
                        background: 'rgba(139,92,246,0.15)', borderRadius: '4px',
                        padding: '2px 5px', letterSpacing: '0.5px', textTransform: 'uppercase',
                      }}>Admin Only</span>
                    )}
                    <span className={styles.presetIcon}>{q.icon}</span>
                    <span className={styles.presetTitle} style={{ fontSize: '14px', fontWeight: 700 }}>{q.label}</span>
                    <span className={styles.presetDesc} style={{ fontSize: '11px', marginTop: '4px' }}>{q.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Custom Style Prompts (Optional)</label>
              <textarea
                placeholder="e.g. volumetric haze, dramatic shadows, award-winning cinematography, ultra-detailed..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className={styles.textArea}
                style={{ minHeight: '80px' }}
              />
            </div>

            {/* Choco Cost Summary + quota check for Step 2 */}
            {!isAdmin && estimatedScenes > 0 && (
              <div style={{
                borderRadius: '12px',
                padding: '14px 18px',
                background: chocoInsufficient
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(139,92,246,0.07)',
                border: `1px solid ${chocoInsufficient ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.25)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '22px' }}>🍫</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: chocoInsufficient ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                      {chocoInsufficient ? 'Insufficient Choco Balance' : 'Choco Cost Breakdown'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {estimatedScenes} scenes × {chocoRate} 🍫/scene ({selectedQuality.replace('_', ' ')}) = <strong style={{ color: chocoInsufficient ? 'var(--accent-red)' : 'var(--accent-purple)' }}>{chocoCost} 🍫 required</strong>
                    </div>
                    {chocoInsufficient && (
                      <div style={{ fontSize: '11px', color: 'var(--accent-orange)', marginTop: '4px' }}>
                        You have {creditsAvailable} 🍫 available. Reduce story length or choose a lower quality tier.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Balance: </span>
                  <span style={{ fontWeight: 800, fontSize: '16px', color: chocoInsufficient ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {creditsAvailable} 🍫
                  </span>
                </div>
              </div>
            )}

            {/* Actions for Step 2 */}
            <div className={styles.footerActions}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={styles.backBtn}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className={styles.continueBtn}
                disabled={chocoInsufficient}
                title={chocoInsufficient ? `Need ${chocoCost} 🍫 but you only have ${creditsAvailable}` : ''}
                style={chocoInsufficient ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: Voice Actor & Subtitles & Generate */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className={styles.formSection}>
            <audio ref={audioRef} onEnded={() => setIsPlayingSample(false)} style={{ display: 'none' }} />
            
            <div className={styles.inputGroup}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className={styles.inputLabel} style={{ marginBottom: 0 }}>Voice Actor</label>
                <button
                  type="button"
                  onClick={handleTogglePlaySample}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: isPlayingSample ? 'var(--accent-red)' : 'var(--accent-purple)',
                    opacity: isSampleLoading ? 0.5 : 1,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  disabled={isSampleLoading}
                >
                  {isSampleLoading ? (
                    <>
                      <svg className="animate-spin-fast" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                        <path d="M12 2v4"/>
                      </svg>
                      Loading...
                    </>
                  ) : isPlayingSample ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      Pause Preview
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Preview Voice
                    </>
                  )}
                </button>
              </div>
              
              <div className={styles.selectWrapper}>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className={styles.voiceSelect}
                >
                  <optgroup label="Female Voices" className={styles.optgroup}>
                    {VOICES.filter(v => v.gender === 'Female').map(v => (
                      <option key={v.id} value={v.id} className={styles.option}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Male Voices" className={styles.optgroup}>
                    {VOICES.filter(v => v.gender === 'Male').map(v => (
                      <option key={v.id} value={v.id} className={styles.option}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className={styles.selectArrow}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Subtitle Styling</label>
              <div className={styles.presetsGrid}>
                {SUBTITLE_STYLES.map((sub) => (
                  <div
                    key={sub.id}
                    onClick={() => setSubtitleStyle(sub.id)}
                    className={`${styles.presetCard} ${subtitleStyle === sub.id ? styles.presetCardActive : ''}`}
                    style={{ minHeight: '80px' }}
                  >
                    <span className={styles.presetIcon}>{sub.icon}</span>
                    <span className={styles.presetTitle}>{sub.label}</span>
                    <span className={styles.presetDesc}>{sub.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pollen Balance display */}
            {(pollen !== null || pollenError !== null) && (
              <div className={styles.pollenBox}>
                {pollenError ? (
                  <div>
                    <div className={styles.pollenInfo}>
                      <span className={styles.pollenLabel}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 2v2M12 18v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        </svg>
                        Choco Balance
                      </span>
                      <span className={styles.pollenError}>Setup Required</span>
                    </div>
                    {pollenMsg && <p className={styles.pollenTip}>{pollenMsg}</p>}
                  </div>
                ) : (
                  <div>
                    <div className={styles.pollenInfo}>
                      <span className={styles.pollenLabel}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="m9 12 2 2 4-4"/>
                        </svg>
                        Choco Balance
                      </span>
                      <span className={styles.pollenValueGreen}>{pollen !== null ? Math.round(pollen) : 0} 🍫 Choco</span>
                    </div>
                    {imagesLeft !== null && (
                      <div className={styles.pollenInfo} style={{ marginTop: '4px' }}>
                        <span className={styles.pollenLabel}>Estimated Images Remaining</span>
                        <span className={styles.pollenValue}>{imagesLeft} images</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions for Step 3 */}
            <div className={styles.footerActions}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={styles.backBtn}
                disabled={isUploading}
              >
                ← Back
              </button>
              <button
                type="submit"
                className={styles.generateBtn}
                disabled={isUploading || !isStep1Valid}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin-fast" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Starting Production...
                  </>
                ) : (
                  'Generate Video'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Global form errors */}
        {error && (
          <div className={styles.errorMsg}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
