// src/app/studio/[jobId]/page.tsx
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import JobDetails from '@/components/JobDetails';

export default function StudioJobDetailsPage() {
  const params = useParams();
  const jobId = typeof params?.jobId === 'string' ? params.jobId : null;

  const handleStatusUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('job-status-updated'));
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
      <JobDetails jobId={jobId} onStatusUpdate={handleStatusUpdate} />
    </div>
  );
}
