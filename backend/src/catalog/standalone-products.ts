// Reviewed independent games (grade 0). Their prices live in approved-pricing.ts; this list holds
// the Persian product title that bootstrap and seed write to new product rows.
export const standaloneTitles: Readonly<Record<string, string>> = {
  "YARIZAN-S-BUNDLE-BUILDER": "دسته‌ساز کوچک",
  "YARIZAN-S-NUMBER-BUILDER": "عددساز کوچولو",
};

export function productTitle(sku: string, grade: number) {
  const names = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"];
  if (grade !== 0) return `یاریزان پایه ${names[grade - 1]} دبستان`;
  const title = standaloneTitles[sku];
  if (!title) throw new Error("STANDALONE_TITLE_MISSING: " + sku);
  return title;
}
