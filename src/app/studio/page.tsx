// src/app/studio/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import StoryUpload from '@/components/StoryUpload';

export default function StudioUploadPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUploadSuccess = (jobId: string) => {
    router.push(`/studio/${jobId}`);
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '40px', maxWidth: '640px', margin: isMobile ? '16px auto 0' : '40px auto 0', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: isMobile ? '1.5rem' : '1.85rem', fontWeight: 800, background: 'var(--gradient-cyber)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' }}>
          Creator Studio
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Upload a script file or paste your story text to generate a complete AI video production.
        </p>
      </div>
      <StoryUpload onUploadSuccess={handleUploadSuccess} />
    </div>
  );
}
