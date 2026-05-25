'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';

const NAV_GLASS = {
  background: 'rgba(10,18,14,0.88)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.42)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
  minWidth: 40,
} as const;

// ─── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{
        background: 'rgba(10,18,14,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[90vw] max-w-sm rounded-2xl border border-[#E5E0D8] bg-[#FDFBF6] p-6"
        style={{ boxShadow: '0 16px 64px rgba(0,0,0,0.12)' }}
      >
        <h2 className="font-serif text-base font-bold tracking-wide text-[#5A645A]">
          回報冒險旅途中的問題
        </h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="請描述你遇到的問題⋯⋯"
          rows={4}
          className="mt-4 w-full resize-none rounded-lg bg-white p-3 text-sm text-[#5A645A] placeholder-[#C5B9AA] outline-none focus:ring-1 focus:ring-[#D7AF70]/50"
          style={{ border: '1px solid rgba(229,224,216,0.8)' }}
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => text.trim() && onSubmit()}
            disabled={!text.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#D7AF70] to-[#E5C992] py-2.5 text-sm font-bold text-white shadow-md shadow-[#D7AF70]/30 transition-all hover:from-[#C9A060] hover:to-[#D7AF70] disabled:opacity-40"
          >
            送出回報
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E5E0D8] px-4 py-2.5 text-sm font-medium text-[#8E8377] transition-colors hover:bg-[#F0EDE7]"
          >
            取消
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium"
      style={{
        background: 'rgba(253,251,246,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(215,175,112,0.30)',
        color: '#8E8377',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TopRightActionNav({
  sheetExpanded = false,
  fabOpen: externalFabOpen,
  onFabClose,
}: {
  sheetExpanded?: boolean;
  fabOpen?: boolean;
  onFabClose?: () => void;
}) {
  const [showReport, setShowReport] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [internalFabOpen, setInternalFabOpen] = useState(false);
  const isExternalMode = externalFabOpen !== undefined;
  const fabOpen = isExternalMode ? externalFabOpen! : internalFabOpen;
  function closeFab() {
    if (isExternalMode) onFabClose?.();
    else setInternalFabOpen(false);
  }
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeEmojiRef = useRef<HTMLSpanElement>(null);
  const likeEmojiSmRef = useRef<HTMLSpanElement>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2800);
  }

  function handleReportSubmit() {
    setShowReport(false);
    showToast('✅ 問題已回報，謝謝你的協助！');
  }

  function handleInstallApp() {
    closeFab();
    window.dispatchEvent(new CustomEvent('wildTaitung:openPwaGuide'));
  }

  function handleLike() {
    const next = likeCount + 1;
    setLikeCount(next);
    if (likeEmojiRef.current) {
      animate(likeEmojiRef.current, { scale: [1, 1.2, 1] }, { duration: 0.28 });
    }
    if (likeEmojiSmRef.current) {
      animate(likeEmojiSmRef.current, { scale: [1, 1.2, 1] }, { duration: 0.28 });
    }
    showToast(`感謝你的肯定，小助手充滿了力量 ☕ (累計 ${next} 個讚)`);
  }

  const btnCls = 'flex flex-col items-center justify-center gap-0.5 rounded-xl p-2 w-14';

  return (
    <>
      {/* ── Large screens (sm+): all buttons always visible, positioned by parent wrapper ── */}
      <div className="hidden sm:flex flex-col gap-1.5">
        <motion.button
          onClick={() => setShowReport(true)}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0, type: 'spring', stiffness: 340, damping: 28 }}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.93 }}
          className={btnCls}
          style={NAV_GLASS}
          title="報修"
        >
          <span className="text-[18px] leading-none">🔧</span>
          <span className="text-[8px] font-bold tracking-wide">報修</span>
        </motion.button>

        <motion.button
          onClick={handleLike}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06, type: 'spring', stiffness: 340, damping: 28 }}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.93 }}
          className={btnCls}
          style={NAV_GLASS}
          title="給個讚"
        >
          <span ref={likeEmojiRef} className="inline-block text-[18px] leading-none">👍</span>
          <span className="text-[8px] font-bold tracking-wide">
            {likeCount > 0 ? likeCount : '讚'}
          </span>
        </motion.button>

        <motion.a
          href="https://buymeacoffee.com/"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 340, damping: 28 }}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.93 }}
          className={btnCls}
          style={NAV_GLASS}
          title="請小助手喝咖啡"
        >
          <span className="text-[18px] leading-none">☕</span>
          <span className="text-[8px] font-bold tracking-wide">請小助手</span>
        </motion.a>

        <motion.button
          onClick={handleInstallApp}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, type: 'spring', stiffness: 340, damping: 28 }}
          whileHover={{ scale: 1.1, x: -2 }}
          whileTap={{ scale: 0.93 }}
          className={btnCls}
          style={NAV_GLASS}
          title="安裝 App"
        >
          <span className="text-[18px] leading-none">📲</span>
          <span className="text-[8px] font-bold tracking-wide">安裝 App</span>
        </motion.button>
      </div>

      {/* ── Small screens (< sm): FAB children — anchored above the shared bottom row ── */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            key="fab-children"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="fixed right-4 bottom-[136px] z-[100] sm:hidden flex flex-col items-center gap-1.5"
          >
            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.19, type: 'spring', stiffness: 420, damping: 24 }}
              onClick={handleInstallApp}
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.93 }}
              className={btnCls}
              style={NAV_GLASS}
              title="安裝 App"
            >
              <span className="text-[18px] leading-none">📲</span>
              <span className="text-[8px] font-bold tracking-wide">安裝 App</span>
            </motion.button>

            <motion.a
              href="https://buymeacoffee.com/"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.14, type: 'spring', stiffness: 420, damping: 24 }}
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.93 }}
              className={btnCls}
              style={NAV_GLASS}
              title="請小助手喝咖啡"
            >
              <span className="text-[18px] leading-none">☕</span>
              <span className="text-[8px] font-bold tracking-wide">請小助手</span>
            </motion.a>

            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.09, type: 'spring', stiffness: 420, damping: 24 }}
              onClick={handleLike}
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.93 }}
              className={btnCls}
              style={NAV_GLASS}
              title="給個讚"
            >
              <span ref={likeEmojiSmRef} className="inline-block text-[18px] leading-none">👍</span>
              <span className="text-[8px] font-bold tracking-wide">
                {likeCount > 0 ? likeCount : '讚'}
              </span>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.04, type: 'spring', stiffness: 420, damping: 24 }}
              onClick={() => { setShowReport(true); closeFab(); }}
              whileHover={{ scale: 1.1, x: -2 }}
              whileTap={{ scale: 0.93 }}
              className={btnCls}
              style={NAV_GLASS}
              title="報修"
            >
              <span className="text-[18px] leading-none">🔧</span>
              <span className="text-[8px] font-bold tracking-wide">報修</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <ReportModal
            onClose={() => setShowReport(false)}
            onSubmit={handleReportSubmit}
          />
        )}
      </AnimatePresence>

      {/* Unified Toast — fixed key so message updates in-place */}
      <AnimatePresence>
        {toastMsg && (
          <Toast key="nav-toast">{toastMsg}</Toast>
        )}
      </AnimatePresence>
    </>
  );
}
