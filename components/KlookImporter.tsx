'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Loader2, Sparkles, Database, ExternalLink,
  AlertCircle, CheckCircle, MapPin, Link2, Search, X,
} from 'lucide-react'
import {
  parseAffiliateData,
  saveAffiliateData,
  fetchAllPlaces,
  bindKlookToPlace,
  type KlookParseResult,
  type PlaceSuggestion,
} from '@/app/admin/klook-actions'

const CATEGORY_LABEL: Record<KlookParseResult['category'], string> = {
  ticket:    '🎫 門票',
  activity:  '🏄 體驗活動',
  multi_day: '🗺️ 多日行程',
}

const NO_BIND = '__none__'

/** 前端模糊比對：找出名稱包含於標題中的最長景點名稱 */
function fuzzyBestMatch(title: string, places: PlaceSuggestion[]): string {
  const matches = places.filter(p => title.includes(p.name))
  if (matches.length === 0) return NO_BIND
  return matches.sort((a, b) => b.name.length - a.name.length)[0].id
}

export default function KlookImporter() {
  // ── 輸入區狀態 ─────────────────────────────────────────────────────────────
  const [sourceUrl, setSourceUrl] = useState('')
  const [rawText,   setRawText]   = useState('')
  const [imageUrl,  setImageUrl]  = useState('')

  // ── 解析結果狀態 ───────────────────────────────────────────────────────────
  const [result, setResult] = useState<KlookParseResult | null>(null)
  const [toast,  setToast]  = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // ── 景點 Combo Box 狀態 ────────────────────────────────────────────────────
  const [allPlaces,       setAllPlaces]       = useState<PlaceSuggestion[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(NO_BIND)
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false)
  const [autoMatchName,   setAutoMatchName]   = useState<string | null>(null)
  const [placeSearch,     setPlaceSearch]     = useState('')
  const [showDropdown,    setShowDropdown]    = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [isParsing, startParsing] = useTransition()
  const [isSaving,  startSaving]  = useTransition()

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  function resetAll() {
    setResult(null)
    setAllPlaces([])
    setSelectedPlaceId(NO_BIND)
    setAutoMatchName(null)
    setPlaceSearch('')
    setShowDropdown(false)
    setSourceUrl('')
    setRawText('')
    setImageUrl('')
  }

  function selectPlace(p: PlaceSuggestion) {
    setSelectedPlaceId(p.id)
    setPlaceSearch(p.name)
    setShowDropdown(false)
  }

  function clearPlaceSelection() {
    setSelectedPlaceId(NO_BIND)
    setPlaceSearch('')
    setShowDropdown(false)
    searchInputRef.current?.focus()
  }

  // ── 過濾後的景點清單（由搜尋輸入框驅動）───────────────────────────────────
  const filteredPlaces = placeSearch.trim()
    ? allPlaces.filter(p => p.name.includes(placeSearch.trim()))
    : allPlaces

  const selectedPlaceName = allPlaces.find(p => p.id === selectedPlaceId)?.name

  // ── Event Handlers ─────────────────────────────────────────────────────────

  function handleParse() {
    startParsing(async () => {
      try {
        const data = await parseAffiliateData(sourceUrl, rawText, imageUrl)
        setResult(data)
        showToast('ok', 'AI 解析完成，請確認右側結果')

        // 非同步載入全部景點並自動前端模糊比對
        setIsLoadingPlaces(true)
        setAllPlaces([])
        setSelectedPlaceId(NO_BIND)
        setAutoMatchName(null)
        setPlaceSearch('')

        fetchAllPlaces()
          .then(places => {
            setAllPlaces(places)
            const bestId = fuzzyBestMatch(data.title, places)
            setSelectedPlaceId(bestId)
            if (bestId !== NO_BIND) {
              const bestName = places.find(p => p.id === bestId)?.name ?? null
              setAutoMatchName(bestName)
              setPlaceSearch(bestName ?? '')
            }
          })
          .finally(() => setIsLoadingPlaces(false))
      } catch (err: unknown) {
        showToast('err', err instanceof Error ? err.message : '解析失敗')
      }
    })
  }

  function handleSave() {
    if (!result) return
    startSaving(async () => {
      try {
        // ─ Step 1：景點綁定優先，完全獨立於 AI 圖片管線 ────────────────────
        // 不等 saveAffiliateData，直接寫入 places.affiliate_link
        if (selectedPlaceId !== NO_BIND) {
          console.log('[KlookImporter] 準備綁定景點，placeId:', selectedPlaceId, 'url:', result.affiliateUrl)
          const bindRes = await bindKlookToPlace(selectedPlaceId, result.affiliateUrl)
          if (!bindRes.success) {
            showToast('err', `景點綁定失敗：${bindRes.error}`)
            return
          }
          showToast('ok', `✓ 分潤連結已寫入「${selectedPlaceName}」— 正在儲存商品資料…`)
        }

        // ─ Step 2：寫入 klook_products（AI 圖片管線，可能較慢）─────────────
        // 不阻塞景點綁定，失敗只警告
        const saveRes = await saveAffiliateData({ ...result, sourceUrl })
        if (!saveRes.success) {
          if (selectedPlaceId !== NO_BIND) {
            // 景點已綁定成功，只告知商品寫入有問題
            showToast('ok', `「${selectedPlaceName}」已綁定。（商品寫入警告：${saveRes.error}）`)
          } else {
            showToast('err', saveRes.error ?? '資料庫寫入失敗')
            return
          }
        } else if (selectedPlaceId === NO_BIND) {
          showToast('ok', `「${result.title}」已成功寫入 klook_products`)
        } else {
          showToast('ok', `「${selectedPlaceName}」景點已綁定，商品資料已儲存 ✓`)
        }

        // ─ Step 3：清空表單，準備下一筆 ────────────────────────────────────
        resetAll()
      } catch (err: unknown) {
        showToast('err', err instanceof Error ? err.message : '寫入失敗')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-bold transition-all ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div>
        <h2 className="text-base font-bold text-gray-800">Klook 半自動分潤匯入器</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          手動複製 Klook 商品頁文字 → AI 萃取結構化資料 → 自動關聯景點 → 一鍵寫入資料庫
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── 左側：輸入區 ────────────────────────────────────── */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">① 貼入原始資料</h3>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">商品原始網址</label>
            <input
              type="url"
              placeholder="https://www.klook.com/zh-TW/activity/..."
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">
              網頁全部文字內容
              <span className="ml-1 font-normal text-gray-400">（Ctrl+A → 複製貼上）</span>
            </label>
            <textarea
              rows={12}
              placeholder="請將 Klook 商品頁面的全部文字貼入此處，包含商品名稱、價格、說明等..."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">商品圖片網址（可選）</label>
            <input
              type="url"
              placeholder="https://res.klook.com/image/..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          <button
            onClick={handleParse}
            disabled={isParsing || !sourceUrl.trim() || !rawText.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors"
          >
            {isParsing
              ? <><Loader2 size={15} className="animate-spin" /> AI 解析中...</>
              : <><Sparkles size={15} /> AI 分析與轉換</>
            }
          </button>
        </section>

        {/* ── 右側：預覽區 ────────────────────────────────────── */}
        <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">② 確認 AI 解析結果</h3>

          {!result ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-300 border-2 border-dashed border-gray-100 rounded-xl gap-3">
              <Sparkles size={32} />
              <p className="text-sm">AI 解析結果將顯示於此</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* 預覽卡片 */}
              <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/20">

                {/* 圖片區 */}
                <div className="relative w-full h-44 bg-gray-100 overflow-hidden">
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                      無圖片
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-gray-700 shadow-sm">
                    {CATEGORY_LABEL[result.category]}
                  </span>
                </div>

                {/* 資訊區 */}
                <div className="p-4 space-y-3">
                  <h4 className="font-bold text-gray-900 text-base leading-snug">{result.title}</h4>

                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-amber-600">{result.price}</span>
                    <span className="text-xs text-gray-400 font-mono">起</span>
                  </div>

                  <a
                    href={result.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    <ExternalLink size={14} />
                    前往預訂
                  </a>
                </div>
              </div>

              {/* ── 手動關聯主景點（可搜尋 Combo Box）──────────── */}
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500 shrink-0" />
                  <span className="text-xs font-bold text-blue-700">手動關聯主景點</span>
                  {isLoadingPlaces && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-blue-400">
                      <Loader2 size={11} className="animate-spin" /> 載入景點清單...
                    </span>
                  )}
                  {!isLoadingPlaces && allPlaces.length > 0 && (
                    <span className="ml-auto text-xs text-blue-400">
                      共 {allPlaces.length} 個景點
                    </span>
                  )}
                </div>

                {/* Combo Box */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search size={13} className="absolute left-3 text-gray-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={placeSearch}
                      onChange={e => {
                        setPlaceSearch(e.target.value)
                        setSelectedPlaceId(NO_BIND)
                        setShowDropdown(true)
                      }}
                      onFocus={() => { if (allPlaces.length > 0) setShowDropdown(true) }}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      disabled={isLoadingPlaces}
                      placeholder={isLoadingPlaces ? '載入中...' : '輸入景點名稱過濾，如：初鹿、布農…'}
                      className="w-full border border-blue-200 rounded-lg pl-8 pr-8 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                    />
                    {placeSearch && (
                      <button
                        type="button"
                        onMouseDown={clearPlaceSelection}
                        className="absolute right-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* 浮動下拉清單 */}
                  {showDropdown && !isLoadingPlaces && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-blue-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                      {/* 不綁定選項 */}
                      <button
                        type="button"
                        onMouseDown={() => { setSelectedPlaceId(NO_BIND); setPlaceSearch(''); setShowDropdown(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-100"
                      >
                        — 不綁定景點 —
                      </button>

                      {filteredPlaces.length > 0 ? (
                        filteredPlaces.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selectPlace(p)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              p.id === selectedPlaceId
                                ? 'bg-blue-50 text-blue-700 font-bold'
                                : 'text-gray-700 hover:bg-blue-50'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2.5 text-xs text-gray-400">找不到「{placeSearch}」，請換個關鍵字</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 狀態提示 */}
                {!isLoadingPlaces && allPlaces.length === 0 && (
                  <p className="text-xs text-gray-400">未能載入景點清單，可跳過綁定</p>
                )}
                {autoMatchName && selectedPlaceId !== NO_BIND && (
                  <p className="text-xs text-blue-500">
                    自動比對推薦：「{autoMatchName}」已預先選取，可搜尋更改
                  </p>
                )}
                {selectedPlaceId !== NO_BIND && (
                  <p className="text-xs text-blue-600 font-medium">
                    確認後，分潤連結將寫入「{selectedPlaceName}」的 affiliate_link 欄位
                  </p>
                )}
              </div>

              {/* 確認寫入按鈕 */}
              <button
                onClick={handleSave}
                disabled={isSaving || isLoadingPlaces}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors"
              >
                {isSaving ? (
                  <><Loader2 size={15} className="animate-spin" /> AI 插畫生成中...</>
                ) : selectedPlaceId !== NO_BIND ? (
                  <><Link2 size={15} /> 確認並綁定景點</>
                ) : (
                  <><Database size={15} /> 確認並寫入資料庫</>
                )}
              </button>

              <button
                onClick={() => setResult(null)}
                className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                重新解析
              </button>
            </div>
          )}
        </section>

      </div>

      {/* Supabase 資料表提醒 */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
        <p className="font-bold mb-1">📋 Supabase Schema 說明</p>
        <p className="mb-2 text-blue-600">商品寫入 <code className="bg-white px-1 rounded">klook_products</code>，景點分潤連結更新 <code className="bg-white px-1 rounded">places.affiliate_link</code>（text 欄位，單數）。</p>
        <pre className="mt-2 bg-white border border-blue-100 rounded-lg p-3 font-mono text-[11px] text-gray-600 overflow-x-auto whitespace-pre-wrap">{`-- klook_products（已存在）
-- affiliate_url UNIQUE → upsert ON CONFLICT

-- places 表欄位（確認欄位名稱為單數）：
ALTER TABLE places ADD COLUMN IF NOT EXISTS
  affiliate_link text DEFAULT NULL;

-- 查詢範例（前台讀取 klook 票券連結）：
SELECT name, affiliate_link
FROM places
WHERE affiliate_link IS NOT NULL;`}</pre>
      </div>
    </div>
  )
}
