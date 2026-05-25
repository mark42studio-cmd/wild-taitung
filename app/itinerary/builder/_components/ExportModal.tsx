'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Loader2, X } from 'lucide-react';
import { ItineraryCard, type ItineraryCardProps } from '@/components/ItineraryCard';
import { exportElementAsImage } from '@/lib/exportCard';

interface Props extends ItineraryCardProps {
  onClose: () => void;
}

// Card is 360×640. Scale to 0.54 → ~194×346 for modal preview.
const PREVIEW_SCALE = 0.54;
const CARD_W = 360;
const CARD_H = 640;

export function ExportModal({ onClose, ...cardProps }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleDownload() {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      await exportElementAsImage(
        cardRef.current,
        `wild-taitung-${cardProps.title}-${Date.now()}.png`,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl bg-[#0a1510] border border-[#1c2e1e] overflow-hidden max-w-xs mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1c2e1e]">
          <div>
            <p className="text-xs font-bold text-[var(--foreground)]">IG 限動卡片</p>
            <p className="text-[10px] text-[var(--wild-mist)] mt-0.5">1080 × 1920 px · PNG</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--wild-mist)] hover:text-[var(--foreground)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex justify-center py-5 bg-[#060e09]">
          <div style={{
            width: Math.round(CARD_W * PREVIEW_SCALE),
            height: Math.round(CARD_H * PREVIEW_SCALE),
            overflow: 'hidden',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
              <ItineraryCard {...cardProps} />
            </div>
          </div>
        </div>

        {/* Off-screen capture target — no overflow:hidden ancestor, so html2canvas gets full 360×640 */}
        <div style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none' }} aria-hidden>
          <ItineraryCard ref={cardRef} {...cardProps} />
        </div>

        {/* Download */}
        <div className="px-5 py-4 border-t border-[#1c2e1e]">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all ${
              exporting
                ? 'bg-[#111e18] text-[var(--wild-mist)] cursor-not-allowed'
                : 'bg-[var(--wild-earth)] text-background hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {exporting
              ? <><Loader2 size={15} className="animate-spin" /> 匯出中…</>
              : <><Download size={15} /> 下載 PNG</>
            }
          </button>
          <p className="text-[10px] text-[var(--wild-mist)]/40 text-center mt-2.5">
            儲存後長按分享至 Instagram 限動
          </p>
        </div>
      </motion.div>
    </>
  );
}
