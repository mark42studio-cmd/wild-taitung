/**
 * ItineraryCard — 固定 360×640px（9:16），用於 IG 限動匯出。
 * 使用 inline styles 確保 html2canvas 能正確捕捉顏色（不依賴 CSS vars）。
 */
import { forwardRef } from 'react';
import type { AdventureTheme, CuratedDayPlan } from '@/types';

// ── Design tokens (explicit hex, not CSS vars) ─────────────────────────────

const BG         = '#0a1510';
const FG         = '#e8dcc8';
const MUTED      = '#8a9e8f';
const VERY_MUTED = '#3a5a3a';
const DIVIDER    = '#1c2e1e';
const CARD_BG    = '#111e18';

const ACCENT: Record<AdventureTheme, string> = {
  ocean:       '#2dd4bf',
  mountain:    '#4a8f5f',
  foodie:      '#c4956a',
  editor_pick: '#FF6B35',
  hidden:      '#8a9e8f',
};

const EMOJI: Record<AdventureTheme, string> = {
  ocean:       '🌊',
  mountain:    '🏔️',
  foodie:      '🍜',
  editor_pick: '📍',
  hidden:      '🗺️',
};

const THEME_LABEL: Record<AdventureTheme, string> = {
  ocean:       '海公主',
  mountain:    '山大王',
  foodie:      '大胃王',
  editor_pick: '小編私房',
  hidden:      '小編秘境',
};

const HASHTAGS: Record<AdventureTheme, string> = {
  ocean:       '#台東 #海公主 #綠島 #東海岸',
  mountain:    '#台東 #山大王 #野溪溫泉 #縱谷',
  foodie:      '#台東 #大胃王 #台東美食 #池上',
  editor_pick: '#台東 #小編私房 #在地人帶路',
  hidden:      '#台東 #小編秘境 #隱藏版 #秘境',
};

// ── Component ─────────────────────────────────────────────────────────────

export interface ItineraryCardProps {
  title: string;
  theme: AdventureTheme;
  days: CuratedDayPlan[];
  rating?: number;
  completionCount?: number;
  highlights?: string[];
}

export const ItineraryCard = forwardRef<HTMLDivElement, ItineraryCardProps>(
  ({ title, theme, days, rating, completionCount, highlights }, ref) => {
    const accent = ACCENT[theme];

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          height: 640,
          background: BG,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Noto Serif TC', Georgia, 'Times New Roman', serif",
          flexShrink: 0,
        }}
      >
        {/* Top gradient wash */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, ${accent}18 0%, transparent 55%)`,
          pointerEvents: 'none',
        }} />

        {/* Bottom vignette */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: `linear-gradient(to top, ${BG} 0%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: '32px 28px 28px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}>

          {/* Branding */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${accent}15`,
              border: `1px solid ${accent}30`,
              borderRadius: 20,
              padding: '4px 10px',
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 14 }}>{EMOJI[theme]}</span>
              <span style={{ color: accent, fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' as const, fontFamily: 'system-ui, sans-serif' }}>
                {THEME_LABEL[theme]}
              </span>
            </div>
            <p style={{ color: MUTED, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase' as const, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
              Wild Taitung · 野台東
            </p>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ color: FG, fontSize: 28, fontWeight: 700, lineHeight: 1.25, margin: 0, marginBottom: 6 }}>
              {title}
            </h1>
            <p style={{ color: MUTED, fontSize: 11, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
              {days.length} 天冒險路線
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: DIVIDER, marginBottom: 16 }} />

          {/* Days */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.slice(0, 3).map(day => (
              <div key={day.day}>
                <p style={{
                  color: accent,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 5,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  DAY {day.day}{'  '}
                  <span style={{ color: MUTED, fontWeight: 400, letterSpacing: '0.05em', textTransform: 'none' as const }}>
                    {day.label.replace(/^Day \d+\s*/, '')}
                  </span>
                  {day.has_island && ' 🚢'}
                </p>
                {day.stops.slice(0, 2).map(stop => (
                  <p key={stop.id} style={{
                    color: MUTED,
                    fontSize: 11,
                    lineHeight: 1.7,
                    paddingLeft: 10,
                    margin: 0,
                    fontFamily: 'system-ui, sans-serif',
                  }}>
                    · {stop.name}
                  </p>
                ))}
                {day.stops.length > 2 && (
                  <p style={{ color: VERY_MUTED, fontSize: 10, paddingLeft: 10, margin: 0, fontFamily: 'system-ui, sans-serif' }}>
                    +{day.stops.length - 2} 個地點
                  </p>
                )}
              </div>
            ))}
            {days.length > 3 && (
              <p style={{ color: VERY_MUTED, fontSize: 10, fontFamily: 'system-ui, sans-serif' }}>
                ···  還有 {days.length - 3} 天行程
              </p>
            )}
          </div>

          {/* Highlights */}
          {highlights && highlights.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginBottom: 14, marginTop: 10 }}>
              {highlights.slice(0, 4).map(h => (
                <span key={h} style={{
                  background: CARD_BG,
                  color: MUTED,
                  fontSize: 9,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 20,
                  border: `1px solid ${DIVIDER}`,
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${DIVIDER}`, paddingTop: 12 }}>
            {(completionCount || rating) && (
              <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                {completionCount && (
                  <span style={{ color: MUTED, fontSize: 10, fontFamily: 'system-ui, sans-serif' }}>
                    🔥 {completionCount.toLocaleString()} 人通關
                  </span>
                )}
                {rating && (
                  <span style={{ color: MUTED, fontSize: 10, fontFamily: 'system-ui, sans-serif' }}>
                    ⭐ {rating} 分
                  </span>
                )}
              </div>
            )}
            <p style={{ color: VERY_MUTED, fontSize: 9, marginBottom: 3, fontFamily: 'system-ui, sans-serif' }}>
              {HASHTAGS[theme]} #野台東
            </p>
            <p style={{ color: VERY_MUTED, fontSize: 9, letterSpacing: '0.05em', fontFamily: 'system-ui, sans-serif' }}>
              wildtaitung.vercel.app
            </p>
          </div>

        </div>
      </div>
    );
  },
);

ItineraryCard.displayName = 'ItineraryCard';
