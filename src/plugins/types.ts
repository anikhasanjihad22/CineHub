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

export type CatalogItem = {
  key: string;
  title: string;
  poster: string | null;
  refs: { pluginId: string; id: string }[];
};
