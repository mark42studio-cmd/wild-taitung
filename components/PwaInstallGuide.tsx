'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const PWA_PROMPT_KEY = 'hasSeenPwaPrompt_v1';

export default function PwaInstallGuide() {
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState<'ios' | 'android'>('ios');
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsInApp(/FBAN|FBAV|Instagram|Line\/|Snapchat|Threads/i.test(ua));
    if (!/iPhone|iPad|iPod/i.test(ua)) setTab('android');

    const handleOpen = () => setShow(true);
    window.addEventListener('wildTaitung:openPwaGuide', handleOpen);
    return () => window.removeEventListener('wildTaitung:openPwaGuide', handleOpen);
  }, []);

  function handleClose() {
    localStorage.setItem(PWA_PROMPT_KEY, 'true');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(10,18,14,0.50)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(253,251,246,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(90,100,90,0.12)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4 flex items-start justify-between"
          style={{ background: 'linear-gradient(135deg, #1B2E26 0%, #2D4A3E 100%)' }}
        >
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-white/50 mb-1">安裝到主畫面</p>
            <h2 className="font-serif text-base font-bold text-white leading-snug">把野台東帶在身邊</h2>
            <p className="text-xs text-white/55 mt-0.5">像原生 App 一樣，隨時查看</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="關閉"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* In-app browser warning */}
        {isInApp && (
          <div
            className="mx-4 mt-4 rounded-2xl px-4 py-3 text-xs leading-relaxed"
            style={{ background: 'rgba(228,92,28,0.08)', border: '1px solid rgba(228,92,28,0.25)', color: '#B84E1A' }}
          >
            ⚠ 偵測到您使用內建瀏覽器，請先改用 <strong>Safari</strong> 或 <strong>Chrome</strong> 開啟此頁面，以順利安裝 App。
          </div>
        )}

        {/* Platform tabs */}
        <div className="flex gap-2 px-4 pt-4">
          {(['ios', 'android'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all duration-200"
              style={{
                background: tab === t ? '#1B2E26' : 'transparent',
                color: tab === t ? '#fff' : '#8E8377',
                border: tab === t ? '1.5px solid transparent' : '1px solid rgba(90,100,90,0.18)',
              }}
            >
              {t === 'ios' ? '🍎 iPhone / iPad' : '🤖 Android'}
            </button>
          ))}
        </div>

        {/* Step-by-step instructions */}
        <div className="px-4 pt-4 pb-2 space-y-3">
          {tab === 'ios' ? (
            <>
              <InstallStep n={1} icon="📤" text='點擊底部工具列的「分享」按鈕' />
              <InstallStep n={2} icon="📲" text='向下滑動選單，點擊「加入主畫面」' />
              <InstallStep n={3} icon="✅" text='點擊右上角「新增」，完成安裝！' />
            </>
          ) : (
            <>
              <InstallStep n={1} icon="⋮" text='點擊瀏覽器右上角的「⋮」選單' />
              <InstallStep n={2} icon="📲" text='選擇「加到主畫面」或「安裝應用程式」' />
              <InstallStep n={3} icon="✅" text='確認安裝，即可在主畫面找到野台東！' />
            </>
          )}
        </div>

        <div className="px-4 py-4">
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all"
            style={{ background: '#1B2E26', color: 'white' }}
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

function InstallStep({ n, icon, text }: { n: number; icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
        style={{ background: '#1B2E26' }}
      >
        {n}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-sm text-[#5A645A] leading-snug">{text}</span>
      </div>
    </div>
  );
}
