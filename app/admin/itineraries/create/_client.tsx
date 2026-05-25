'use client'

import { useState } from 'react'
import { Plus, Trash2, Map, Flame, Sprout, Save, ChevronDown } from 'lucide-react'
import type { SpotSelectOption } from '../../actions'

type Difficulty = '新手村' | '進階探險' | '硬核求生'

type ItineraryNode = {
  id: string
  spotId: string
  note: string
}

type DayBlock = {
  day: number
  nodes: ItineraryNode[]
}

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { icon: React.ReactNode; bg: string; text: string; border: string }
> = {
  '新手村':   { icon: <Sprout size={13} />, bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200' },
  '進階探險': { icon: <Map size={13} />,    bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
  '硬核求生': { icon: <Flame size={13} />,  bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200'   },
}

function uid() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function buildDays(count: number): DayBlock[] {
  return Array.from({ length: count }, (_, i) => ({ day: i + 1, nodes: [] }))
}

const CATEGORY_EMOJI: Record<string, string> = {
  attraction: '🏛',
  hidden:     '🌿',
  mountain:   '🏔',
  ocean:      '🌊',
  spring:     '♨️',
  cultural:   '🎭',
  food:       '🍴',
}

interface Props {
  spots: SpotSelectOption[]
}

export default function CreateItineraryClient({ spots }: Props) {
  const [title, setTitle]           = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('新手村')
  const [days, setDays]             = useState(2)
  const [dayBlocks, setDayBlocks]   = useState<DayBlock[]>(buildDays(2))

  function handleDaysChange(n: number) {
    const clamped = Math.max(1, Math.min(14, n))
    setDays(clamped)
    setDayBlocks(prev => {
      if (clamped > prev.length) {
        const extra = Array.from({ length: clamped - prev.length }, (_, i) => ({
          day: prev.length + i + 1,
          nodes: [],
        }))
        return [...prev, ...extra]
      }
      return prev.slice(0, clamped)
    })
  }

  function addNode(dayIndex: number) {
    setDayBlocks(prev => prev.map((block, i) =>
      i === dayIndex
        ? { ...block, nodes: [...block.nodes, { id: uid(), spotId: '', note: '' }] }
        : block
    ))
  }

  function removeNode(dayIndex: number, nodeId: string) {
    setDayBlocks(prev => prev.map((block, i) =>
      i === dayIndex
        ? { ...block, nodes: block.nodes.filter(n => n.id !== nodeId) }
        : block
    ))
  }

  function updateNode(dayIndex: number, nodeId: string, field: 'spotId' | 'note', value: string) {
    setDayBlocks(prev => prev.map((block, i) =>
      i === dayIndex
        ? { ...block, nodes: block.nodes.map(n => n.id === nodeId ? { ...n, [field]: value } : n) }
        : block
    ))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log('[CreateItinerary]', { title, difficulty, days, dayBlocks })
    alert('遊程草稿已準備好，待後端 API 接入後寫入 Supabase ✅')
  }

  const diffCfg    = DIFFICULTY_CONFIG[difficulty]
  const totalNodes = dayBlocks.reduce((sum, b) => sum + b.nodes.length, 0)

  return (
    <div className="text-gray-800 font-sans">

      <form onSubmit={handleSubmit}>
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

          <section className="space-y-6">
            <SectionHeader step={1} title="基本設定" />

            <div>
              <FieldLabel>冒險名稱</FieldLabel>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例：三天兩夜 · 南迴秘境開拓計畫"
                required
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-300 font-serif text-base focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 transition-all shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>難度等級</FieldLabel>
                <div className="relative">
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value as Difficulty)}
                    className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-bold text-sm focus:outline-none focus:border-teal-400 cursor-pointer transition-all shadow-sm"
                  >
                    <option value="新手村">🌱 新手村</option>
                    <option value="進階探險">🗺️ 進階探險</option>
                    <option value="硬核求生">🔥 硬核求生</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${diffCfg.bg} ${diffCfg.text} ${diffCfg.border}`}>
                  {diffCfg.icon} {difficulty}
                </div>
              </div>

              <div>
                <FieldLabel>旅程天數</FieldLabel>
                <div className="flex items-center gap-3">
                  <StepBtn onClick={() => handleDaysChange(days - 1)}>−</StepBtn>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-serif font-bold text-teal-600">{days}</span>
                    <span className="text-sm text-gray-400 ml-1.5">天</span>
                  </div>
                  <StepBtn onClick={() => handleDaysChange(days + 1)}>+</StepBtn>
                </div>
                <p className="text-[10px] text-gray-400 text-center mt-1.5 font-mono">1 – 14 天</p>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <SectionHeader step={2} title="行程節點">
              {totalNodes > 0 && (
                <span className="ml-auto text-xs text-gray-400 font-mono">{totalNodes} 個節點</span>
              )}
            </SectionHeader>

            {dayBlocks.map((block, dayIndex) => (
              <div key={block.day} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-serif font-bold text-sm tracking-widest text-teal-600">
                      DAY {block.day}
                    </span>
                    {block.nodes.length > 0 && (
                      <span className="text-[11px] text-gray-400 font-mono">{block.nodes.length} 站</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addNode(dayIndex)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus size={12} /> 新增節點
                  </button>
                </div>

                <div className="bg-white p-4 space-y-3 min-h-[64px]">
                  {block.nodes.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addNode(dayIndex)}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center text-gray-300 text-sm hover:border-gray-300 hover:text-gray-400 transition-all"
                    >
                      點此加入第一個節點 →
                    </button>
                  ) : (
                    block.nodes.map((node, nodeIndex) => (
                      <div
                        key={node.id}
                        className="flex gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 group hover:border-gray-300 transition-colors"
                      >
                        <div className="shrink-0 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-400 mt-2">
                          {nodeIndex + 1}
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="relative">
                            <select
                              value={node.spotId}
                              onChange={e => updateNode(dayIndex, node.id, 'spotId', e.target.value)}
                              className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-teal-400 transition-all cursor-pointer"
                            >
                              <option value="">— 選擇景點 —</option>
                              {spots.length > 0 ? (
                                spots.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {CATEGORY_EMOJI[s.category ?? ''] ?? '📍'} {s.name}
                                  </option>
                                ))
                              ) : (
                                <option disabled>（請先至「景點資料庫」新增景點）</option>
                              )}
                            </select>
                            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>

                          <textarea
                            value={node.note}
                            onChange={e => updateNode(dayIndex, node.id, 'note', e.target.value)}
                            placeholder="策展備註（選填）：例如「這段路濕滑，建議穿防滑登山鞋」"
                            rows={2}
                            className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 placeholder-gray-300 focus:outline-none focus:border-teal-300 resize-none transition-all"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeNode(dayIndex, node.id)}
                          className="shrink-0 mt-2 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>

          <div className="h-16" />
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-6 py-4 flex items-center justify-between z-40">
          <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
            {days} 天 · {totalNodes} 個節點 · 難度：{difficulty}
          </p>
          <div className="flex gap-3 ml-auto">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-[#1B2E26] hover:bg-[#2d3a30] text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
            >
              <Save size={14} /> 儲存草稿
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function SectionHeader({ step, title, children }: { step: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-[#1B2E26] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
        {step}
      </div>
      <h2 className="font-serif font-bold text-base text-[#8d5a2b] tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
      {children}
    </label>
  )
}

function StepBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-10 h-10 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center select-none shadow-sm"
    >
      {children}
    </button>
  )
}
