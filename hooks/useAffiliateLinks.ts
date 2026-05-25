'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AffiliateLink = {
  id: string;
  title: string;
  description: string | null;
  link_url: string;
  icon_emoji: string | null;
  sort_order: number;
  key?: string;
  label?: string;
  url?: string | null;
  icon?: string | null;
};

type AffiliateRow = Omit<AffiliateLink, 'link_url'> & {
  link_url: string | null;
};

export function useAffiliateLinks(): AffiliateLink[] {
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  useEffect(() => {
    supabase
      .from('affiliates')
      .select('id, title, description, link_url, icon_emoji, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load affiliates:', error);
          return;
        }
        if (data && data.length > 0) {
          setLinks(
            (data as AffiliateRow[]).filter((link): link is AffiliateLink => Boolean(link.link_url)),
          );
        }
      });
  }, []);
  return links;
}
