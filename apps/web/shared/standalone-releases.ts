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
    sku: 'YARIZAN-S-NUMBER-BUILDER',
    version: '1.1.0',
    filename: 'YariZan-NumberBuilder-Setup-v1.1.0.exe',
    sizeBytes: 94512318,
    sha256: '4d54015a3fe471221d39bf114fb3947056b4f07e1d1a8baf54bf93dcd4e37382',
    published: true,
  },
  {
    sku: 'YARIZAN-S-BUNDLE-BUILDER',
    version: '1.1.0',
    filename: 'YariZan-BundleBuilder-Setup-v1.1.0.exe',
    sizeBytes: 94538307,
    sha256: 'd6d61e5e27276a9545188a2b5a3de798d9704e811335e22b344ed5695296d966',
    published: true,
  },
  {
    sku: 'YARIZAN-S-COMBINATION-LAND',
    version: '1.1.0',
    filename: 'YariZan-CombinationLand-Setup-v1.1.0.exe',
    sizeBytes: 95956008,
    sha256: '417891d30cd91248d604011e975c4f8bd39905f166970465274f5640c3d11c08',
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
  const current = {
    version: '1.1.0',
    notes: ['راهنمای تازهٔ اتصال به حساب، فعال‌سازی و شروع آزمایش در بازی.'],
  };
  if (sku === 'YARIZAN-S-COMBINATION-LAND')
    return [
      current,
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
    current,
    { version: '1.0.0', notes: ['انتشار نخستین نسخهٔ مستقل بازی با فعال‌سازی و مجوز اختصاصی.'] },
  ];
}
