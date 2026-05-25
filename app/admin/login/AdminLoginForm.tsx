'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { useAdminStore } from '@/store/useAdminStore';

export default function AdminLoginForm() {
  const { login } = useAdminStore();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    console.log('[Admin Login] 1. 開始登入，帳號：', username.trim());
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 380));

    const ok = login(username.trim(), password);
    console.log('[Admin Login] 2. 驗證結果：', ok);

    if (!ok) {
      setLoading(false);
      setError('帳號或密碼錯誤，請重試。');
      setPassword('');
      console.log('[Admin Login] 3. 驗證失敗，停止');
      return;
    }

    // Cookie already written by useAdminStore.login() — proxy.ts will allow through
    console.log('[Admin Login] 3. Cookie 已寫入，準備跳轉至 /admin');
    router.push('/admin');
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, #0a2a18 0%, #060f0a 40%, #050e09 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(45,212,191,0.055) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-sm mx-4"
      >
        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{
            background: 'rgba(10,18,14,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(45,212,191,0.06)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
          }}
        >
          {/* Logo */}
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(45,212,191,0.2) 0%, rgba(5,150,105,0.15) 100%)',
                border: '1px solid rgba(45,212,191,0.25)',
                boxShadow: '0 0 24px rgba(45,212,191,0.2)',
              }}
            >
              <Lock size={20} style={{ color: '#2dd4bf' }} />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.5em] mb-1" style={{ color: 'rgba(232,220,200,0.4)' }}>
              Wild Taitung
            </p>
            <h1 className="font-serif text-xl font-bold" style={{ color: 'rgba(232,220,200,0.92)' }}>
              後台管理系統
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: 'rgba(138,158,143,0.6)' }}>
                帳號
              </label>
              <div className="relative flex items-center">
                <User
                  size={14}
                  className="pointer-events-none absolute left-3.5"
                  style={{ color: 'rgba(138,158,143,0.4)' }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="帳號"
                  autoComplete="off"
                  className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(232,220,200,0.9)',
                    caretColor: '#2dd4bf',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(45,212,191,0.45)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.4em]" style={{ color: 'rgba(138,158,143,0.6)' }}>
                密碼
              </label>
              <div className="relative flex items-center">
                <Lock
                  size={14}
                  className="pointer-events-none absolute left-3.5"
                  style={{ color: 'rgba(138,158,143,0.4)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="密碼"
                  autoComplete="off"
                  className="w-full rounded-xl py-3 pl-10 pr-11 text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'rgba(232,220,200,0.9)',
                    caretColor: '#2dd4bf',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(45,212,191,0.45)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 transition-colors"
                  style={{ color: 'rgba(138,158,143,0.4)' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(138,158,143,0.8)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(138,158,143,0.4)')}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold text-center"
                style={{ color: 'rgba(248,113,113,0.85)' }}
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || !username.trim() || !password}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-black transition-all"
              style={{
                background: 'linear-gradient(135deg, #2dd4bf 0%, #059669 100%)',
                boxShadow: '0 0 36px rgba(45,212,191,0.3), 0 4px 20px rgba(5,150,105,0.2)',
                color: '#051a10',
                opacity: loading || !username.trim() || !password ? 0.5 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  驗證中…
                </>
              ) : '登入系統'}
            </motion.button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-[10px]" style={{ color: 'rgba(138,158,143,0.28)' }}>
          野台東 Wild Taitung · Admin CMS
        </p>
      </motion.div>
    </div>
  );
}
