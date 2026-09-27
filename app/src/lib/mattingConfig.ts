import type { Config } from '@imgly/background-removal';

export const IMGLY_CDN_BASE =
  'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

function originBase(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Prefer self-hosted assets under /models/imgly/; fall back to IMG.LY CDN. */
export function getMattingConfig(overrides?: Partial<Config>): Config {
  const origin = originBase();
  const publicPath = origin ? `${origin}/models/imgly/` : IMGLY_CDN_BASE;
  return {
    publicPath,
    model: 'isnet_quint8',
    device: 'gpu',
    rescale: true,
    proxyToWorker: false,
    output: { format: 'image/png', quality: 1 },
    ...overrides,
  };
}

export function getMattingConfigCdn(overrides?: Partial<Config>): Config {
  return getMattingConfig({ publicPath: IMGLY_CDN_BASE, ...overrides });
}
