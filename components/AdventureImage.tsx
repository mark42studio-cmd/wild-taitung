'use client';
import { useState } from 'react';

interface AdventureImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export default function AdventureImage({ src, alt, width, height, className = '', style }: AdventureImageProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-[#8d5a2b]/35 bg-[#f5f0e8] text-[#8d5a2b]/55 ${className}`}
        style={{ width, height, ...style }}
        title={alt}
        aria-label={alt}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        <span className="text-[8px] font-black tracking-wide text-center px-2 leading-snug">
          Missing<br />Adventure Image
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width as number}
      height={height as number}
      className={className}
      style={style}
      onError={() => setError(true)}
    />
  );
}
