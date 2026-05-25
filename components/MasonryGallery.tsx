'use client';

import Image from 'next/image';
import { useState } from 'react';
import { MapPin, Star } from 'lucide-react';

export type GalleryItem = {
  id: string | number;
  name: string;
  description?: string | null;
  image_url?: string | null;
  rating?: number | null;
  cuisine_type?: string | null;
  price_range?: string | null;
  source_url?: string | null;
};

function GalleryCard({ item }: { item: GalleryItem }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.image_url && !imgError;

  return (
    <article className="break-inside-avoid mb-4 group relative rounded-xl overflow-hidden border border-white/[0.06] bg-[#0e1c15] hover:border-wild-earth/40 transition-colors duration-300 cursor-pointer">
      {hasImage ? (
        <div className="relative w-full overflow-hidden">
          <Image
            src={item.image_url!}
            alt={item.name}
            width={600}
            height={400}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setImgError(true)}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1c15]/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-[#141f18] flex flex-col items-center justify-center gap-2">
          <MapPin className="w-8 h-8 text-wild-mist/20" />
          <span className="text-wild-mist/30 text-[10px]">暫無圖片</span>
        </div>
      )}

      <div className="p-4">
        <h3 className="text-foreground font-serif text-base font-bold leading-snug mb-1.5">
          {item.name}
        </h3>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          {item.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="w-3 h-3 fill-wild-earth text-wild-earth" />
              <span className="text-wild-earth text-xs font-medium">{item.rating}</span>
            </span>
          )}
          {item.cuisine_type && (
            <span className="text-xs text-wild-mist bg-white/[0.05] px-2 py-0.5 rounded-full">
              {item.cuisine_type}
            </span>
          )}
          {item.price_range && (
            <span className="text-xs text-wild-ocean/80">{item.price_range}</span>
          )}
        </div>

        {item.description && (
          <p className="text-wild-mist text-xs leading-relaxed line-clamp-3">
            {item.description}
          </p>
        )}

        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="mt-3 inline-flex items-center gap-1 text-xs text-wild-mist/50 hover:text-wild-ocean transition-colors"
          >
            <MapPin className="w-3 h-3" />
            Google Maps
          </a>
        )}
      </div>
    </article>
  );
}

type Props = {
  items?: GalleryItem[] | null;
  emptyMessage?: string;
};

export default function MasonryGallery({ items, emptyMessage = '尚無資料' }: Props) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-wild-mist/40 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
      {safeItems.map((item, i) => (
        <div
          key={item.id}
          style={{ '--gallery-delay': `${Math.min(i * 0.04, 0.6)}s` } as React.CSSProperties}
          className="gallery-fade-in"
        >
          <GalleryCard item={item} />
        </div>
      ))}
    </div>
  );
}
