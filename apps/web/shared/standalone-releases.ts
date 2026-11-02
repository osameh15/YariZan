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
    sku: 'YARIZAN-S-NUMBER-BUILDER',
    version: '1.0.0',
    filename: 'YariZan-NumberBuilder-Setup-v1.0.0.exe',
    sizeBytes: 94518290,
    sha256: 'e3c62a57511b0f53aa7f3df0a27683ecd54bd97f3af271db5b627ca19a77fb5f',
    published: false,
  },
];
export function standaloneRelease(sku: string) {
  return standaloneReleases.find((release) => release.sku === sku && release.published);
}
export function standaloneDownloadUrl(release: StandaloneRelease) {
  return `https://dl.oarnova.games/downloads/windows/products/number-builder/${release.version}/${release.filename}`;
}
