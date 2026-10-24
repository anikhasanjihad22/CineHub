export type Stream = {
  url: string;
  format?: 'hls' | 'mp4' | 'dash';
  quality?: string;
  headers?: Record<string, string>;
  label?: string;
};

export type Plugin = {
  id: string;
  name: string;
  slug: string;
  version: string;
  kind: 'stream' | 'catalog';
  categories: string[];
  priority: number;
  timeout_ms: number;
  code: string;
  enabled: boolean;
  updated_at: string;
};

// What a plugin's code really offers (found by reading the code, not by the "kind" label).
export type Caps = { stream: boolean; catalog: boolean; links: boolean; error?: string };

// One item as a plugin returns it (already cleaned).
export type RawCatalogItem = {
  id: string;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year?: string;
  overview?: string;
  rating?: number;
  tmdbId?: number;
  type?: 'movie' | 'tv';
  section?: string;
  streams: Stream[];
};

export type CatalogItem = {
  key: string;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year?: string;
  overview?: string;
  rating?: number;
  tmdbId?: number;
  type?: 'movie' | 'tv';
  section: string;
  category: string;
  refs: { pluginId: string; id: string }[];
  streams: Stream[];
};
