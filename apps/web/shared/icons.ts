export const ICON_NAMES = [
  'home',
  'device',
  'receipt',
  'shield',
  'user',
  'book',
  'blocks',
  'abacus',
  'headset',
  'download',
  'settings',
  'chart',
  'search',
  'filter',
  'pencil',
  'save',
  'upload',
  'trash',
  'logout',
  'calendar',
  'check',
  'plus',
  'minus',
  'info',
  'warning',
  'arrow-left',
  'chevron-down',
  'menu',
  'refresh',
  'copy',
  'play',
  'link',
  'phone',
  'mail',
  'clock',
] as const;
export type IconAsset = (typeof ICON_NAMES)[number];
export const ICON_VARIANTS: Record<string, { asset: IconAsset; rotation: number }> = {
  back: { asset: 'arrow-left', rotation: 180 },
  forward: { asset: 'arrow-left', rotation: 0 },
  previous: { asset: 'arrow-left', rotation: 180 },
  next: { asset: 'arrow-left', rotation: 0 },
  'arrow-right': { asset: 'arrow-left', rotation: 180 },
  'arrow-up': { asset: 'arrow-left', rotation: 90 },
  'arrow-down': { asset: 'arrow-left', rotation: -90 },
  external: { asset: 'arrow-left', rotation: 135 },
  'arrow-up-left': { asset: 'arrow-left', rotation: 45 },
  'chevron-left': { asset: 'chevron-down', rotation: 90 },
  'chevron-right': { asset: 'chevron-down', rotation: -90 },
  'chevron-up': { asset: 'chevron-down', rotation: 180 },
  close: { asset: 'plus', rotation: 45 },
};
export function productIcon(sku: unknown): IconAsset {
  return sku === 'YARIZAN-S-BUNDLE-BUILDER'
    ? 'blocks'
    : sku === 'YARIZAN-S-NUMBER-BUILDER'
      ? 'abacus'
      : 'book';
}
export function navigationIcon(section: unknown): IconAsset {
  const icons: Record<string, IconAsset> = {
    overview: 'home',
    dashboard: 'chart',
    devices: 'device',
    customers: 'user',
    products: 'book',
    licenses: 'shield',
    security: 'shield',
    orders: 'receipt',
    payments: 'receipt',
    commerce: 'receipt',
    finance: 'chart',
    blog: 'pencil',
    trials: 'play',
    codes: 'link',
    'activation-codes': 'link',
    campaigns: 'calendar',
    'discount-codes': 'link',
    refunds: 'refresh',
    audit: 'chart',
    admins: 'user',
    'payment-readiness': 'receipt',
    reconciliation: 'refresh',
    fulfillments: 'shield',
    support: 'headset',
  };
  return icons[String(section)] ?? 'settings';
}
