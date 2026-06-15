// src/components/CharacterBibleViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getAssetUrl } from '@/utils/api';

interface CharacterProfile {
  name: string;
  role: string;
  gender: string;
  age: string;
  hair: string;
  eyes: string;
  bodyType: string;
  clothing: string;
  facialFeatures: string;
  personality: string;
}

interface CharacterBibleViewerProps {
  characterBibleMd: string | null;
}

export default function CharacterBibleViewer({ characterBibleMd }: CharacterBibleViewerProps) {
  const [profiles, setProfiles] = useState<CharacterProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!characterBibleMd) return;

    const fetchAndParseBible = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = getAssetUrl(characterBibleMd);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load character bible file.');
        const markdown = await res.text();
        
        // Parse markdown
        const parsed: CharacterProfile[] = [];
        const sections = markdown.split(/\n##\s+/);
        
        for (let idx = 1; idx < sections.length; idx++) {
          const lines = sections[idx].split('\n');
          const headerLine = lines[0].trim();
          
          const headerMatch = headerLine.match(/^(.*?)(?:\s+\((.*?)\))?$/);
          const name = headerMatch ? headerMatch[1].trim() : 'Unknown';
          const role = headerMatch && headerMatch[2] ? headerMatch[2].trim() : 'Character';

          const profile: CharacterProfile = {
            name,
            role,
            gender: 'Unknown',
            age: 'Unknown',
            hair: 'Unknown',
            eyes: 'Unknown',
            bodyType: 'Unknown',
            clothing: 'Unknown',
            facialFeatures: 'Unknown',
            personality: ''
          };

          for (const line of lines) {
            const clean = line.trim();
            if (clean.startsWith('- **Gender**:') || clean.startsWith('- **Gender**:')) {
              profile.gender = clean.replace(/^- \*\*Gender\*\*:\s*/, '');
            } else if (clean.startsWith('- **Age**:')) {
              profile.age = clean.replace(/^- \*\*Age\*\*:\s*/, '');
            } else if (clean.startsWith('- **Hair**:')) {
              profile.hair = clean.replace(/^- \*\*Hair\*\*:\s*/, '');
            } else if (clean.startsWith('- **Eyes**:')) {
              profile.eyes = clean.replace(/^- \*\*Eyes\*\*:\s*/, '');
            } else if (clean.startsWith('- **Body Type**:')) {
              profile.bodyType = clean.replace(/^- \*\*Body Type\*\*:\s*/, '');
            } else if (clean.startsWith('- **Signature Clothing**:')) {
              profile.clothing = clean.replace(/^- \*\*Signature Clothing\*\*:\s*/, '');
            } else if (clean.startsWith('- **Facial Features**:')) {
              profile.facialFeatures = clean.replace(/^- \*\*Facial Features\*\*:\s*/, '');
            } else if (clean.startsWith('- **Personality**:')) {
              profile.personality = clean.replace(/^- \*\*Personality\*\*:\s*/, '');
            }
          }
          parsed.push(profile);
        }
        setProfiles(parsed);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Could not parse Character Bible.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndParseBible();
  }, [characterBibleMd]);

  const getAvatarColor = (name: string) => {
    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ef4444', '#d946ef'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  if (loading) {
    return (
      <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
        <svg className="animate-spin-fast" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
          <path d="M12 2v4"/>
        </svg>
        <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Compiling Character Bible Profiles...</p>
      </div>
    );
  }

  if (error || !characterBibleMd) {
    return (
      <div className="glass" style={{ padding: '24px', textAlign: 'center', color: 'var(--accent-red)' }}>
        <p>⚠️ {error || 'No character bible available for this video.'}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '1.5rem' }}>👤</span>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Story Characters Directory</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI-analyzed profiles parsed from production bible</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {profiles.map((char, index) => (
          <div key={index} className="glass-interactive" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div 
                style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '50%', 
                  background: `linear-gradient(135deg, ${getAvatarColor(char.name)} 0%, #000 100%)`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {char.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{char.name}</h4>
                <span 
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    color: 'var(--accent-cyan)', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em' 
                  }}
                >
                  🎭 {char.role}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Gender: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.gender}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Age: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.age}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Hair: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.hair}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Eyes: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.eyes}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>Body Type: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.bodyType}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>Clothing: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.clothing}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>Features: </span>
                <span style={{ color: 'var(--text-secondary)' }}>{char.facialFeatures}</span>
              </div>
            </div>

            {char.personality && (
              <div style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.15)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>🧠 Personality</span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.4' }}>{char.personality}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
