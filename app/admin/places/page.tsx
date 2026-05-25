import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listPlaces } from '../actions';
import PlacesClient from './PlacesClient';

export const dynamic = 'force-dynamic';

export default async function AdminPlacesPage() {
  let places: Awaited<ReturnType<typeof listPlaces>> = [];

  try {
    places = await listPlaces();
  } catch (err) {
    console.error('[AdminPlacesPage] listPlaces failed:', err);
  }

  console.log('[AdminPlacesPage] Fetched raw places:', places, '| count:', places.length);

  return (
    <main className="min-h-screen bg-[#F5F5DC] px-5 py-8 text-[#1B2E26]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1 text-xs font-black text-[#8d5a2b] hover:underline"
          >
            <ArrowLeft size={13} /> 返回後台
          </Link>
          <h1 className="font-serif text-3xl font-black flex-1">景點資料庫管理</h1>
        </div>
        <PlacesClient initialPlaces={places} />
      </div>
    </main>
  );
}
