import { standaloneProduct } from './products';
// The coordinated deployment publishes reviewed installers on the mirror before routing
// traffic to the storefront that links to them.
export interface StandaloneRelease {
  sku: string;
  version: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  published: boolean;
}
export const standaloneReleases: readonly StandaloneRelease[] = [
  {
    sku: 'YARIZAN-S-COMBINATION-LAND',
    version: '1.0.2',
    filename: 'YariZan-CombinationLand-Setup-v1.0.2.exe',
    sizeBytes: 95953781,
    sha256: 'fdeb3f0b2ffb64bed774498f767abe790cfdf3b29fa347502abaecc54a1fc0a0',
    published: true,
  },
  {
    sku: 'YARIZAN-S-NUMBER-BUILDER',
    version: '1.0.0',
    filename: 'YariZan-NumberBuilder-Setup-v1.0.0.exe',
    sizeBytes: 94518290,
    sha256: 'e3c62a57511b0f53aa7f3df0a27683ecd54bd97f3af271db5b627ca19a77fb5f',
    published: true,
  },
  {
    sku: 'YARIZAN-S-BUNDLE-BUILDER',
    version: '1.0.0',
    filename: 'YariZan-BundleBuilder-Setup-v1.0.0.exe',
    sizeBytes: 94541090,
    sha256: '8e4e371ddd2d412db3d7e38c9c337536502a5cbee5bad4c80aef26967ade2af0',
    published: true,
  },
];
export function standaloneRelease(sku: string) {
  return standaloneReleases.find((release) => release.sku === sku && release.published);
}
export function standaloneDownloadUrl(release: StandaloneRelease) {
  const slug = standaloneProduct(release.sku)?.slug;
  if (!slug) throw new Error('UNREVIEWED_STANDALONE_PRODUCT');
  return `https://dl.oarnova.games/downloads/windows/products/${slug}/${release.version}/${release.filename}`;
}

export function standaloneReleaseHistory(sku: string) {
  if (!standaloneRelease(sku)) return [];
  if (sku === 'YARIZAN-S-COMBINATION-LAND')
    return [
      {
        version: '1.0.2',
        notes: ['به‌روزرسانی محتوای بازی و ساخت نصب‌کننده‌های جدید ۳۲ و ۶۴ بیتی.'],
      },
      {
        version: '1.0.1',
        notes: [
          'به‌روزرسانی محتوای بازی سرزمین ترکیب‌ها.',
          'انتشار نصب‌کننده‌های به‌روز برای ویندوز ۱۰ و ۱۱ و ویندوز ۷ SP1 و ۸.۱، با معماری ۳۲ و ۶۴ بیتی.',
        ],
      },
      {
        version: '1.0.0',
        notes: ['انتشار نخستین نسخهٔ مستقل سرزمین ترکیب‌ها با فعال‌سازی و مجوز اختصاصی.'],
      },
    ];
  return [
    { version: '1.0.0', notes: ['انتشار نخستین نسخهٔ مستقل بازی با فعال‌سازی و مجوز اختصاصی.'] },
  ];
}
