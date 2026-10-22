// Approval state of the public legal policies. The texts in app/pages/legal are the proposed V2
// policies. Until the owner approves them in a reviewed change, every legal page says so plainly,
// and the production release guard (tools/check-production-copy.mjs) refuses a release build.
// Approval sets `approved: true` with the real date and the version; nothing else may set it.
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
  approved: false,
  approvedOn: null,
  effectiveFrom: null,
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
