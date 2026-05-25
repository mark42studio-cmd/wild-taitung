'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { submitEvent } from '@/app/actions/submitEvent';

type SubmitForm = {
  name: string;
  category: 'food' | 'spot';
  time: string;
  location: string;
  description: string;
  image_url: string;
  comments: string;
};

const EMPTY_FORM: SubmitForm = {
  name: '', category: 'spot', time: '', location: '',
  description: '', image_url: '', comments: '',
};

export default function SubmitSpotModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SubmitForm>(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.time.trim() || !form.location.trim() || !form.description.trim()) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await submitEvent(form);
      if (result.error) { setStatus('error'); setErrorMsg(result.error); return; }
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('送出失敗，請稍後再試。');
    }
  };

  const handleClose = () => {
    if (status !== 'loading') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 flex flex-col gap-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">🗺️ 冒險地點申請</h3>
              <p className="text-xs text-gray-400 mt-0.5">我們審核後會儘快聯繫</p>
            </div>
            <button
              onClick={handleClose}
              disabled={status === 'loading'}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>

          {status === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-5xl">🎊</div>
              <p className="text-green-700 font-bold text-base">申請已送出！</p>
              <p className="text-gray-500 text-sm text-center">感謝您的投稿，我們將盡快審核並與您聯繫。</p>
              <button
                onClick={() => { setForm(EMPTY_FORM); setStatus('idle'); onClose(); }}
                className="mt-2 px-6 py-2 bg-gray-800 text-white text-sm rounded-full hover:bg-gray-700 transition-colors"
              >
                關閉
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {/* 地點名稱 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    地點 / 美食名稱 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="例：栗松野溪溫泉、正氣路無名臭豆腐"
                    maxLength={100}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 類別 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    類別 <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'spot', label: '秘境景點 🏔️' },
                      { value: 'food', label: '在地美食 🍜' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, category: opt.value }))}
                        className={[
                          'rounded-xl border px-4 py-3 text-sm font-bold transition-colors',
                          form.category === opt.value
                            ? 'border-amber-500 bg-amber-100 text-amber-800'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 開放時間 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    開放 / 營業時間 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    placeholder="例：全年開放、週二至週日 09:00–17:00"
                    maxLength={200}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 地點位置 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    所在位置 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="例：台東縣海端鄉中平路（近利稻村）"
                    maxLength={200}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 介紹說明 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    介紹說明 <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="請描述這個地點的特色、前往方式或注意事項..."
                    maxLength={2000}
                    rows={4}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>

                {/* 代表圖片 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    代表圖片連結 <span className="text-gray-300 font-normal">（選填）</span>
                  </label>
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://example.com/photo.jpg"
                    maxLength={500}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {/* 其他留言 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    其他留言 <span className="text-gray-300 font-normal">（選填）</span>
                  </label>
                  <textarea
                    value={form.comments}
                    onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                    placeholder="有什麼特別想告訴我們的嗎？"
                    maxLength={1000}
                    rows={2}
                    className="w-full text-sm p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                  {errorMsg || '送出失敗，請稍後再試。'}
                </p>
              )}

              <p className="text-[11px] text-gray-400">
                <span className="text-red-400">*</span> 為必填欄位
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  disabled={status === 'loading'}
                  className="px-5 py-2 text-sm border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    status === 'loading' ||
                    !form.name.trim() || !form.time.trim() ||
                    !form.location.trim() || !form.description.trim()
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-bold rounded-full hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {status === 'loading' && <Loader2 size={13} className="animate-spin" />}
                  送出申請
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
