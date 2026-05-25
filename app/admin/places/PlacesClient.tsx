'use client';

import { useState, useTransition } from 'react';
import {
  Edit2, Link as LinkIcon, Loader2, MapPin, Plus, Save, Search, X,
  CheckCircle, AlertCircle, Clock, Calendar,
} from 'lucide-react';
import { insertPlace, updatePlaceAffiliate, type PlaceRecord, type AffiliateRecord } from '../actions';

const CATEGORY_OPTIONS = [
  { value: 'attraction', label: '景點' },
  { value: 'hidden',     label: '秘境' },
  { value: 'mountain',   label: '山林' },
  { value: 'ocean',      label: '海洋' },
  { value: 'spring',     label: '溫泉' },
  { value: 'cultural',   label: '文化' },
  { value: 'food',       label: '美食' },
] as const;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

type FormState = {
  name: string;
  description: string;
  category: string;
  stay_duration: string;
  closed_days: number[];
  image_url: string;
  affiliate_url: string;
  latitude: string;
  longitude: string;
  vibe_tags: string;
};

const emptyForm: FormState = {
  name: '', description: '', category: 'attraction', stay_duration: '60',
  closed_days: [], image_url: '', affiliate_url: '',
  latitude: '', longitude: '', vibe_tags: '',
};

interface Props {
  initialPlaces: PlaceRecord[];
  affiliates?: AffiliateRecord[];
}

export default function PlacesClient({ initialPlaces, affiliates = [] }: Props) {
  console.log('[PlacesClient] Fetched raw places:', initialPlaces, '| count:', initialPlaces.length);
  const [places, setPlaces] = useState<PlaceRecord[]>(initialPlaces);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapResults, setMapResults] = useState<any[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<string | null>(null);
  const [affiliateValue, setAffiliateValue] = useState('');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleMapSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setMapLoading(true);
    setMapResults([]);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (data.places) setMapResults(data.places);
      else showToast('err', 'Google API 找不到結果');
    } catch {
      showToast('err', '搜尋失敗，請檢查網路');
    } finally {
      setMapLoading(false);
    }
  }

  function selectMapResult(place: any) {
    setForm(prev => ({
      ...prev,
      name:      place.displayName?.text ?? '',
      description: place.editorialSummary?.text ?? '',
      latitude:  place.location?.latitude?.toString() ?? '',
      longitude: place.location?.longitude?.toString() ?? '',
      image_url: place.photoUrl ?? '',
    }));
    setMapResults([]);
    setSearchQuery('');
  }

  function toggleClosedDay(day: number) {
    setForm(prev => ({
      ...prev,
      closed_days: prev.closed_days.includes(day)
        ? prev.closed_days.filter(d => d !== day)
        : [...prev.closed_days, day],
    }));
  }

  async function handleSave() {
    if (!form.name || !form.latitude || !form.longitude) {
      showToast('err', '請填寫名稱與座標（搜尋 Google 地圖後自動填入）');
      return;
    }
    startTransition(async () => {
      try {
        await insertPlace({
          name:          form.name,
          description:   form.description,
          latitude:      parseFloat(form.latitude),
          longitude:     parseFloat(form.longitude),
          category:      form.category,
          stay_duration: parseInt(form.stay_duration, 10),
          closed_days:   form.closed_days,
          vibe_tags:     form.vibe_tags.split(',').map(t => t.trim()).filter(Boolean),
          image_url:     form.image_url,
          affiliate_url: form.affiliate_url,
        });
        const newPlace: PlaceRecord = {
          id: `temp-${Date.now()}`,
          name: form.name,
          description: form.description,
          lat: parseFloat(form.latitude),
          lng: parseFloat(form.longitude),
          category: form.category,
          image_url: form.image_url,
          affiliate_link: form.affiliate_url || null,
          wild_tags: form.vibe_tags.split(',').map(t => t.trim()).filter(Boolean),
        };
        setPlaces(prev => [newPlace, ...prev]);
        setForm(emptyForm);
        setShowModal(false);
        showToast('ok', `已新增景點：${form.name}`);
      } catch (err: any) {
        showToast('err', err.message);
      }
    });
  }

  function startEditAffiliate(place: PlaceRecord) {
    setEditingAffiliate(place.id);
    setAffiliateValue(place.affiliate_link ?? '');
  }

  async function saveAffiliate(placeId: string) {
    startTransition(async () => {
      try {
        await updatePlaceAffiliate(placeId, affiliateValue || null);
        setPlaces(prev =>
          prev.map(p => p.id === placeId ? { ...p, affiliate_link: affiliateValue || null } : p)
        );
        setEditingAffiliate(null);
        showToast('ok', '分潤連結已更新');
      } catch (err: any) {
        showToast('err', err.message);
      }
    });
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-bold ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{places.length} 筆景點</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
        >
          <Plus size={15} /> 新增景點
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {places.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <MapPin size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">尚無景點資料</p>
            <p className="text-sm mt-1">點擊右上角「新增景點」開始建立</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">景點名稱</th>
                <th className="text-left px-4 py-3.5">分類 / 停留</th>
                <th className="text-left px-4 py-3.5">座標</th>
                <th className="text-left px-4 py-3.5">分潤連結</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {places.map(place => (
                <tr key={place.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {place.image_url ? (
                        <img src={place.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <MapPin size={14} className="text-gray-300" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-800">{place.name}</p>
                        {place.description && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{place.description}</p>
                        )}
                        {place.wild_tags && place.wild_tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {place.wild_tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-xs font-bold text-gray-600">
                      {CATEGORY_OPTIONS.find(c => c.value === place.category)?.label ?? place.category ?? '—'}
                    </p>
                    {place.type && (
                      <p className="text-xs text-gray-400 mt-0.5">{place.type}</p>
                    )}
                    {place.quote && (
                      <p className="text-[10px] text-amber-600 mt-0.5 italic">「{place.quote}」</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {place.lat != null ? (
                      <span className="font-mono text-xs text-gray-400">
                        {place.lat.toFixed(4)}, {place.lng?.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500 font-bold">⚠ 未設定</span>
                    )}
                  </td>
                  <td className="px-4 py-4 min-w-[200px]">
                    {editingAffiliate === place.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={affiliateValue}
                          onChange={e => setAffiliateValue(e.target.value)}
                          placeholder="https://www.klook.com/..."
                          autoFocus
                          className="flex-1 text-xs border border-amber-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50/30"
                        />
                        <button
                          onClick={() => saveAffiliate(place.id)}
                          disabled={isPending}
                          className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        </button>
                        <button
                          onClick={() => setEditingAffiliate(null)}
                          className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {place.affiliate_link ? (
                          <a
                            href={place.affiliate_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-600 font-bold hover:underline truncate max-w-[160px]"
                          >
                            🔗 {place.affiliate_link.replace('https://', '')}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                        <button
                          onClick={() => startEditAffiliate(place)}
                          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
                          title="編輯分潤連結"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Place Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-gray-800 text-lg">新增景點</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Google Places Search — auto-fills coordinates */}
              <section className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5">
                <p className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1.5">
                  <Search size={13} /> 搜尋 Google 地圖（自動填入座標）
                </p>
                <form onSubmit={handleMapSearch} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="輸入景點名稱（建議加上台東）…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    disabled={mapLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    {mapLoading ? <Loader2 size={15} className="animate-spin" /> : '搜尋'}
                  </button>
                </form>
                {mapResults.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {mapResults.slice(0, 5).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => selectMapResult(p)}
                        className="text-left p-3 bg-white border border-blue-100 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <p className="font-bold text-gray-800 text-sm">{p.displayName?.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.formattedAddress}</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">景點名稱 *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">分類</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    <Clock size={11} className="inline mr-1" />建議停留時間（分鐘）
                  </label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={form.stay_duration}
                    onChange={e => setForm(p => ({ ...p, stay_duration: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                {/* Closed Days */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-2">
                    <Calendar size={11} className="inline mr-1" />公休日（點選）
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAY_LABELS.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleClosedDay(day)}
                        className={`w-10 h-10 rounded-xl text-sm font-bold border transition-colors ${
                          form.closed_days.includes(day)
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {form.closed_days.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, closed_days: [] }))}
                        className="px-3 h-10 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 border border-gray-100"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">緯度 *（Google 搜尋自動填入）</label>
                  <input
                    type="text"
                    readOnly
                    value={form.latitude}
                    className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">經度 *</label>
                  <input
                    type="text"
                    readOnly
                    value={form.longitude}
                    className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-500 font-mono"
                  />
                </div>

                {/* Affiliate — manual Klook URL */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-amber-600 mb-1 flex items-center gap-1">
                    <LinkIcon size={11} /> 手動填寫 Klook 分潤連結
                  </label>
                  <input
                    type="text"
                    value={form.affiliate_url}
                    onChange={e => setForm(p => ({ ...p, affiliate_url: e.target.value }))}
                    placeholder="https://www.klook.com/..."
                    className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">封面圖片網址</label>
                  {form.image_url && (
                    <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200 mb-2" />
                  )}
                  <input
                    type="text"
                    value={form.image_url}
                    onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1">客群標籤（逗號分隔）</label>
                  <input
                    type="text"
                    value={form.vibe_tags}
                    onChange={e => setForm(p => ({ ...p, vibe_tags: e.target.value }))}
                    placeholder="文青, 親子, 冒險"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isPending || !form.name || !form.latitude}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm disabled:opacity-40"
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  儲存至景點資料庫
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
