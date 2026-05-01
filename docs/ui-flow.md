# UI flow

## Window-level behavior

- **Starts maximized** (`WindowState="Maximized"` on `MainWindow`). The standard Windows title bar with min / max / close stays visible because we keep `WindowStyle="SingleBorderWindow"` (the default) — this gives users the familiar OS controls plus the in‑app affordances below.
- **In‑app minimize button** sits at the top‑right corner (visually) of every screen. It's a circular gold‑on‑leather glyph at `MainWindow` level so it survives every page transition. Clicking it calls `WindowState = WindowState.Minimized`.
- **In‑app exit** is on every page after the cover — a red `خروج` button calling `Application.Current.Shutdown()`.
- **Icon**: the window's title‑bar icon is `pack://application:,,,/Resources/icon.png`; the same image is used on the cover and info pages.

## Screens

```
        ┌─────────────────┐
        │   CoverPage     │   closed leather book, gold ornaments,
        │  (always first) │   "YariZan" + icon + Persian version,
        │                 │   "برای ورود کلیک کنید" prompt
        └────────┬────────┘
                 │ click anywhere
                 ▼
        Activation valid?
        │                │
       no                yes
        ▼                ▼
 ┌───────────────┐  ┌──────────────────┐
 │   LockPage    │  │    InfoPage      │
 │ HWID + serial │  │ icon+title left  │
 │ + خروج        │  │ author+about right
 │               │  │ + ورود + بازگشت  │
 │               │  │ + خروج (vertical)│
 └──────┬────────┘  └─────┬────────────┘
        │ activation ok    │ "ورود به کتاب بازی‌ها"
        ▼                  ▼
   save activation  ┌────────────────────┐
        └──────────►│   GamesBookPage    │
                    │ "همه" + ۱..۶ chips │
                    │ first page = right │
                    │ second page = left │
                    │ tile grid: 3x2     │
                    │ landscape          │
                    │ click i = info     │
                    │ click tile = run   │
                    │ + back / exit      │
                    └────────────────────┘
```

## Why CoverPage every launch (even when activated)

Per product requirement, an activated user still sees the closed‑book cover on launch — they just don't see the lock screen. The cover is the *aesthetic entry point*; the lock is the *gate*. Cover → tap → (gate if needed) → inside.

## Persian / RTL specifics

- `App.xaml.cs` sets `CurrentCulture = fa-IR` and overrides `FrameworkElement.LanguageProperty` so XAML inherits `XmlLanguage="fa-IR"`. This drives proper line breaking, digit shaping in `TextBlock`s, and correct shaping for connected glyphs.
- Each user control sets `FlowDirection="RightToLeft"` at the root.
- Latin‑only elements (the "YariZan" wordmark on the cover) opt back in with `FlowDirection="LeftToRight"`.
- Persian digits (`۰`–`۹`) are emitted by `ToPersianDigits()` for version strings, page numbers, and grade labels.
- **Important RTL quirk for `Grid` columns**: when `FlowDirection="RightToLeft"`, `Grid.Column="0"` lands on the **right** visually. We name `UniformGrid x:Name="RightSide" Grid.Column="0"` and `LeftSide Grid.Column="1"` to keep the code self‑documenting.

## Tile grid (games book)

| Aspect | Choice |
|--------|--------|
| Layout | `UniformGrid Rows="3" Columns="2"` per page |
| Tiles per page | 6 |
| Tiles per spread | 12 (6 right + 6 left) |
| Tile aspect | Wider than tall — matches your **landscape** thumbnails |
| Image stretch | `Uniform` (full image is always visible, no edge cropping) |
| Hover | border tint + thicker gold ring + slight elevation |
| Click | full tile click → run game; tap **i** badge → info popup |

**Reading order**: in a Persian book the right page is read first, then the left page, then you turn to the next spread. So `RightSide` carries games `[0..5]` of the current spread, and `LeftSide` carries games `[6..11]`.

**Navigation buttons**: in the bottom row, **`صفحهٔ قبل`** (Previous) is positioned on the **right** (where you came from in reading flow) and **`صفحهٔ بعد`** (Next) on the **left** (where you're heading). They're aligned via `HorizontalAlignment="Left"` / `"Right"` — WPF flips these under RTL so the visual placement is correct.

## Grade picker

A horizontal row of round chips with the `GradeChip` style. Order:

```
 [ همه ]  [ ۱ ]  [ ۲ ]  [ ۳ ]  [ ۴ ]  [ ۵ ]  [ ۶ ]
   ↑ default
```

- **همه** is the first chip, selected by default when `GamesBookPage` mounts → the spread shows games from every grade, ordered by grade.
- Chips for grades that have **no packed games** are disabled (50% opacity).
- Clicking a chip resets `_spreadIndex = 0` and re‑renders.
- The `PageIndicator` text reads `<grade-label>  —  صفحهٔ X از Y` so the user always knows what they're filtering and where they are.

## Info popup

Every tile has a small circular **i** badge (gold ring on leather) anchored to its bottom row. Clicking it (the click is `Handled = true` so it doesn't bubble up to launch the game) shows a parchment modal centered over the spread, with:

- **Title** — the game's Persian name
- A gold horizontal divider
- A scrollable description (`ScrollViewer` with `MaxHeight="320"`) populated from the `.txt` sidecar; if no description was provided, a neutral placeholder shows
- An **اجرا** button that closes the popup and immediately launches the game
- A **بستن** (Close) button

Click outside the popup card → `HideInfo()`. Click on the card itself swallows the event so the overlay doesn't dismiss prematurely.

## Lock screen UX

- **HWID** is shown as 8 groups of 4 hex chars for readability; the underlying value passed to `SerialCodec.Verify` is the un‑grouped 64‑char hex.
- **Copy** button puts the raw HWID on the clipboard so customers can paste it into chat / email without typos.
- **Status text** turns dark red on errors, dark green on the "copied" confirmation.
- **بازگشت** returns to the cover (closes the book), it does *not* exit the app.
- **خروج** exits the app immediately.

## Info page (post‑activation)

Two columns inside the open book:

| Right column (read first) | Left column (read second) |
|---------------------------|---------------------------|
| Big icon, "یاریزان" title, subtitle | "درباره" heading, about‑paragraph, author/version card, action buttons |

The action buttons are **stacked vertically** to avoid overflow at narrower window widths:

```
┌────────────────────────────────┐
│   ورود به کتاب بازی‌ها        │  primary
└────────────────────────────────┘
┌──────────────┐  ┌──────────────┐
│   بازگشت     │  │     خروج     │  secondary side-by-side
└──────────────┘  └──────────────┘
```

## Animations

| Where | Effect | Implementation |
|-------|--------|----------------|
| Page swaps in `MainWindow` | small rotate 8°→0° + fade 0→1 over ~400 ms | `RotateTransform.AngleProperty` + `Opacity` `DoubleAnimation` |
| Page‑flip in GamesBookPage | one half scales X 1→0.05 → reload tiles → 0.05→1 (~400 ms) | `ScaleTransform` with `RenderTransformOrigin` set to the spine‑side |

For a more cinematic flip, swap `ScaleTransform` for a `Transform3DGroup` on a `Viewport2DVisual3D` — current implementation is intentionally simple and maintainable.

## Fonts

```xml
<FontFamily x:Key="ShabnamFont">/Resources/Fonts/Shabnam/#Shabnam, Tahoma, Segoe UI, Arial</FontFamily>
<FontFamily x:Key="ShabnamBoldFont">/Resources/Fonts/Shabnam/#Shabnam Bold, Tahoma, Segoe UI, Arial</FontFamily>
```

`#Shabnam` and `#Shabnam Bold` are the **family names** registered in the TTF metadata, not file names. WPF picks weights up by family name once the `.ttf` files are present; until then it falls back to Tahoma.

The repo ships Shabnam `.ttf`, `.eot`, `.woff`, `.woff2`. Only the `.ttf` files are loaded by WPF; the others are kept for completeness if you ever need a web build. The csproj only includes the `.ttf`/`.otf` patterns:

```xml
<Resource Include="Resources\Fonts\Shabnam\*.ttf" />
<Resource Include="Resources\Fonts\Shabnam\*.otf" />
```
