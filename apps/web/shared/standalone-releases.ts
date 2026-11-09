import { standaloneProduct } from './products';
// An installer becomes publicly downloadable only after its reviewed release has been
// published on the mirror. Local builds alone must never create a broken download link.
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
    version: '1.0.0',
    filename: 'YariZan-CombinationLand-Setup-v1.0.0.exe',
    sizeBytes: 95886808,
    sha256: '527bd5db56be71702cc38476d9fa6ddb0cf7cdce93c6fe0103d93fcde2d68684',
    published: false,
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
