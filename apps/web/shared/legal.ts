// Owner-approved V2 legal policies. Approved on 2026-10-22 after exact-text review;
// effective from 2026-10-22 for subsequent publication and new transactions.
// Legal identity and payment activation are verified separately from policy approval.
export interface LegalApproval {
  /** Policy text version, e.g. "2.0.0". */
  version: string;
  approved: boolean;
  /** ISO date of the owner's approval; null until approved. Never back-dated. */
  approvedOn: string | null;
  /** Date from which the approved text applies; null until approved. */
  effectiveFrom: string | null;
}

export const LEGAL_APPROVAL: LegalApproval = {
  version: '2.0.0',
  approved: true,
  approvedOn: '2026-10-22',
  effectiveFrom: '2026-10-22',
};

export function legalStatusText(a: LegalApproval = LEGAL_APPROVAL): string {
  if (a.approved && a.effectiveFrom)
    return `نسخهٔ ${persian(a.version)}، معتبر از ${persianDate(a.effectiveFrom)}`;
  return `نسخهٔ پیشنهادی ${persian(a.version)}: این متن هنوز به تأیید نهایی نرسیده و پس از تأیید، تاریخ اعتبار آن همین‌جا اعلام می‌شود.`;
}

function persian(s: string) {
  return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
}
function persianDate(iso: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(new Date(iso + 'T12:00:00Z'));
}
