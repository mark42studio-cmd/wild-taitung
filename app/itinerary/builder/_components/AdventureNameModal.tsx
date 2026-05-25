'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

interface Props {
  defaultName: string;
  onConfirm: (name: string) => Promise<{ error?: string }>;
  onClose: () => void;
}

export function AdventureNameModal({ defaultName, onConfirm, onClose }: Props) {
  const [name, setName] = useState(defaultName);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed || status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    const result = await onConfirm(trimmed);
    if (result.error) {
      setStatus('error');
      setErrorMsg(result.error);
    }
    // On success the parent closes the modal and shows a toast
  }

  function handleBackdropClick() {
    if (status !== 'loading') onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto rounded-3xl overflow-hidden"
        style={{
          background: '#FDFBF6',
          border: '1px solid #E5E0D8',
          boxShadow: '0 24px 80px rgba(0,0,0,0.14)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottom: '1px solid #E5E0D8' }}
        >
          <div>
            <p
              className="text-[10px] font-black tracking-[0.4em] uppercase"
              style={{ color: '#D7AF70' }}
            >
              冒險命名
            </p>
            <h3
              className="font-serif text-base font-bold mt-0.5"
              style={{ color: '#5A645A' }}
            >
              為你的冒險命名
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={status === 'loading'}
            className="p-1.5 rounded-full transition-colors disabled:opacity-40"
            style={{ color: '#8E8377' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#5A645A')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#8E8377')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label
              className="block text-xs font-semibold mb-2"
              style={{ color: '#8E8377' }}
            >
              冒險名稱 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="例如：台東野溪溫泉三日制霸"
              maxLength={50}
              autoFocus
              className="w-full text-sm px-4 py-3 rounded-xl outline-none transition-all"
              style={{
                background: 'white',
                border: `1px solid ${status === 'error' ? '#ef4444' : '#E5E0D8'}`,
                color: '#5A645A',
                caretColor: '#D7AF70',
              }}
              onFocus={e => {
                if (status !== 'error')
                  (e.currentTarget as HTMLInputElement).style.borderColor =
                    'rgba(215,175,112,0.60)';
              }}
              onBlur={e => {
                if (status !== 'error')
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#E5E0D8';
              }}
            />
          </div>

          {status === 'error' && errorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs px-4 py-2.5 rounded-xl"
              style={{
                color: '#b91c1c',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.18)',
              }}
            >
              {errorMsg}
            </motion.p>
          )}

          <p className="text-[10px]" style={{ color: 'rgba(90,100,90,0.45)' }}>
            這個名稱將作為你的冒險印記，公開展示給其他探險者。每個名稱僅限一位冒險者使用。
          </p>
        </div>

        {/* Footer */}
        <div
          className="px-6 pb-6 flex justify-end gap-3"
          style={{ borderTop: '1px solid #E5E0D8', paddingTop: 16 }}
        >
          <button
            onClick={onClose}
            disabled={status === 'loading'}
            className="px-5 py-2.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ border: '1px solid #E5E0D8', color: '#8E8377' }}
            onMouseEnter={e =>
              ((e.currentTarget as HTMLElement).style.background =
                'rgba(90,100,90,0.04)')
            }
            onMouseLeave={e =>
              ((e.currentTarget as HTMLElement).style.background = 'transparent')
            }
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={status === 'loading' || !name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #D7AF70 0%, #C4956A 100%)',
            }}
          >
            {status === 'loading' && (
              <Loader2 size={12} className="animate-spin" />
            )}
            確認分享
          </button>
        </div>
      </motion.div>
    </>
  );
}
