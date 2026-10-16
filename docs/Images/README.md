# Curated screenshots

These PNGs replace the earlier UI screenshots. They are rendered from the current WPF views at 1440 x 900 with the real local grade-1 game catalog. The cover, book, details and loading screens use the shipped logos and current game descriptions.

Activation/trial images show illustrative UI states, not customer records. HWIDs are masked and the invalid-serial example is a placeholder. Capture does not call the licensing service, consume trials, launch games or change saved activation.

Regenerate from the repository root after packing games:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Capture-AppScreenshots.ps1
```

The script copies only thumbnails and builds a temporary renderer. Generated captures overwrite the documented PNGs. `game-loading.png` replaces the old `lunch-mini-app.png` launch image. Other user-provided images in this directory are preserved.

## Web screenshots

`web/` holds a small curated set copied from the Playwright browser suite (synthetic data only). Browser tests now write their full screenshot output to the ignored `apps/web/.local/screenshots/`, and web CI uploads it as the `web-commerce-browser-evidence` artifact. Older phase evidence (`phase1-*`, `phase3/`, `phase3-1/`, `phase4/`, `phase4-premium/` and extra trial states) remains in git history at main@30ffa05.
