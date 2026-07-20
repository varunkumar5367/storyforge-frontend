'use client';

import { useEffect, useState } from 'react';

interface AdBannerProps {
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
}

export default function AdBanner({
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
}: AdBannerProps) {
  const [hasError, setHasError] = useState(false);
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;
  const isDev = process.env.NODE_ENV === 'development';
  const isConfigured = adsenseId && adsenseId !== 'pub-XXXXXXXXXXXXXXXX';

  useEffect(() => {
    // If not configured, we don't try to push.
    if (!isConfigured) return;

    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense script initialization failed:', e);
      setHasError(true);
    }
  }, [isConfigured]);

  // Show a helpful visual placeholder in development to indicate where the ad goes
  if (!isConfigured || isDev) {
    return (
      <div className="my-6 flex flex-col items-center justify-center p-4 border border-dashed border-zinc-700 bg-zinc-900/50 rounded-lg text-center min-h-[100px] w-full">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Google AdSense Space</span>
        <span className="text-sm font-medium text-zinc-400 mt-1">Slot ID: {adSlot}</span>
        {!isConfigured && (
          <span className="text-xs text-amber-500 mt-1">
            (Configure `NEXT_PUBLIC_ADSENSE_PUB_ID` in your .env file to enable live ads)
          </span>
        )}
      </div>
    );
  }

  if (hasError) {
    return null; // Don't show anything if ads fail to load
  }

  return (
    <div className="my-6 overflow-hidden flex justify-center w-full">
      <ins
        className="adsbygoogle w-full"
        style={{ display: 'block' }}
        data-ad-client={adsenseId}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </div>
  );
}
