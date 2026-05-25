'use client';

import 'driver.js/dist/driver.css';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  HOME_TOUR_KEY,
  HOME_TOUR_KEY_V3,
  ITINERARY_TOUR_KEY,
  ITINERARY_TOUR_KEY_V3,
  PWA_PROMPT_KEY,
  homeSteps,
  itinerarySteps,
} from '@/lib/tourConfig';

const LEGACY_TOUR_KEYS = [
  'cultrRoute_homeTour_v1',
  'cultrRoute_itineraryTour_v1',
  'cultrRoute_itineraryTour_v2',
  HOME_TOUR_KEY,
  ITINERARY_TOUR_KEY,
];

function buildTour(steps: DriveStep[], tourKey: string, onDone?: () => void) {
  let tour: ReturnType<typeof driver>;
  tour = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    smoothScroll: true,
    overlayColor: 'rgba(0,0,0,0.8)',
    steps,
    onDestroyStarted: () => {
      localStorage.setItem(tourKey, 'true');
      window.dispatchEvent(new CustomEvent('cultrRoute:tourDestroyed'));
      onDone?.();
      tour.destroy();
    },
  });
  return tour;
}

export default function TourGuide() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isItinerary = pathname === '/itinerary';
  const hasTour = isHome || isItinerary;
  const steps = isItinerary ? itinerarySteps : homeSteps;
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setIsDesktop(window.innerWidth >= 768);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const getFilteredSteps = useCallback(() => {
    if (!isItinerary) return steps;
    const hasEvents = document.querySelector('.planned-event-card') !== null;
    return steps.filter((step) => {
      if ((step as DriveStep & { element?: string }).element === '#tour-itinerary-events' && !hasEvents) return false;
      return true;
    });
  }, [isItinerary, steps]);

  useEffect(() => {
    LEGACY_TOUR_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    if (!hasTour || isDesktop === null) return;
    // Itinerary tour is desktop-only due to complex element layout
    if (isItinerary && !isDesktop) return;

    const effectiveKey = isItinerary ? ITINERARY_TOUR_KEY_V3 : HOME_TOUR_KEY_V3;
    if (localStorage.getItem(effectiveKey)) return;

    const onDone = !isItinerary
      ? () => {
          if (!localStorage.getItem(PWA_PROMPT_KEY)) {
            setTimeout(() => window.dispatchEvent(new CustomEvent('wildTaitung:openPwaGuide')), 700);
          }
        }
      : undefined;

    const timer = setTimeout(() => buildTour(getFilteredSteps(), effectiveKey, onDone).drive(), 800);
    return () => clearTimeout(timer);
  }, [pathname, hasTour, isDesktop, isItinerary, getFilteredSteps]);

  const startTour = useCallback(() => {
    if (window.innerWidth < 768) return;
    const effectiveKey = isItinerary ? ITINERARY_TOUR_KEY_V3 : HOME_TOUR_KEY_V3;
    buildTour(getFilteredSteps(), effectiveKey).drive();
  }, [isItinerary, getFilteredSteps]);

  if (!hasTour) return null;
  if (isItinerary && isDesktop === false) return null;

  return (
    <button
      onClick={startTour}
      id="tour-help-btn"
      aria-label="開啟導覽"
      title="開啟導覽"
      className="fixed bottom-5 left-5 z-40 hidden items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium text-[#1B2E26] shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95 md:flex"
    >
      <CircleHelp size={16} className="shrink-0" />
      <span className="hidden sm:inline">導覽</span>
    </button>
  );
}
