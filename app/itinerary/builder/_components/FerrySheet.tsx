'use client';

import { motion } from 'framer-motion';
import { Ship, X } from 'lucide-react';

const FERRY_INFO: Record<string, {
  operators: { name: string; note: string }[];
  duration: string;
  klookUrl: string;
}> = {
  綠島: {
    operators: [
      { name: '綠島之星', note: '富岡漁港出發，每日多班' },
      { name: '凱旋客輪', note: '台東市富岡港，可線上預訂' },
    ],
    duration: '約 50 分鐘',
    klookUrl: 'https://www.klook.com/zh-TW/activity/2617-green-island-ferry-taitung/',
  },
  蘭嶼: {
    operators: [
      { name: '蘭嶼之星', note: '富岡漁港出發，請提前預訂' },
      { name: '達悟輪', note: '航程較長，建議非暈船體質乘客選此班' },
    ],
    duration: '約 2.5 小時',
    klookUrl: 'https://www.klook.com/zh-TW/activity/3316-orchid-island-ferry-taitung/',
  },
};

const FALLBACK_INFO = {
  operators: [
    { name: '富岡漁港定期航班', note: '請至台東市富岡漁港搭乘' },
  ],
  duration: '依島嶼而異',
  klookUrl: 'https://www.klook.com/',
};

interface Props {
  islandName: string;
  onClose: () => void;
}

export function FerrySheet({ islandName, onClose }: Props) {
  const info = FERRY_INFO[islandName] ?? FALLBACK_INFO;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-[#1c2e1e] flex flex-col"
        style={{ background: '#0a1510', maxHeight: '82vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#1c2e1e]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1c2e1e] shrink-0">
          <div className="flex items-center gap-2.5">
            <Ship size={17} className="text-[#5bb8d4]" />
            <h2 className="font-serif text-base" style={{ color: 'var(--foreground)' }}>
              前往{islandName}，別忘了預訂船票！
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 transition-colors"
            style={{ color: 'var(--wild-mist)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--foreground)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--wild-mist)')}
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-6 flex flex-col gap-5">

          {/* Operator info cards */}
          <div className="flex flex-col gap-3">
            <p className="text-[9px] tracking-[0.45em] uppercase" style={{ color: 'var(--wild-mist)' }}>
              主要航運業者
            </p>
            {info.operators.map(op => (
              <div
                key={op.name}
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'rgba(91,184,212,0.05)', border: '1px solid rgba(91,184,212,0.14)' }}
              >
                <span className="text-2xl">⛴️</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: '#5bb8d4' }}>{op.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(138,158,143,0.65)' }}>{op.note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Duration info */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-lg">🕐</span>
            <p className="text-sm" style={{ color: 'rgba(232,220,200,0.7)' }}>
              航程時間：<span className="font-bold" style={{ color: 'rgba(232,220,200,0.92)' }}>{info.duration}</span>
            </p>
          </div>

          {/* Affiliate CTA */}
          <a
            href={info.klookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-black transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #f5c842 0%, #e8a020 100%)',
              boxShadow: '0 0 40px rgba(245,200,66,0.3), 0 4px 20px rgba(232,160,32,0.2)',
              color: '#1a1200',
              letterSpacing: '0.03em',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                '0 0 60px rgba(245,200,66,0.45), 0 6px 28px rgba(232,160,32,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                '0 0 40px rgba(245,200,66,0.3), 0 4px 20px rgba(232,160,32,0.2)';
            }}
          >
            🎟️ 前往 Klook 查看時刻表並預訂
          </a>

          <p className="text-[10px] text-center leading-relaxed pb-2" style={{ color: 'rgba(138,158,143,0.35)' }}>
            建議提前 3–7 天預訂，旺季（6–9 月）請至少提前 2 週
          </p>
        </div>
      </motion.div>
    </>
  );
}
