# UI flow

## Screens

```
        ┌─────────────────┐
        │   CoverPage     │   closed leather book, gold ornaments,
        │  (always first) │   YariZan + logo + Persian version
        └────────┬────────┘
                 │ click
                 ▼
       Activation already valid?
        │                │
       no                yes
        ▼                ▼
 ┌───────────────┐  ┌──────────────────┐
 │   LockPage    │  │    InfoPage      │
 │ HWID + serial │  │ logo+title left  │
 │ entry         │  │ author+about right│
 └──────┬────────┘  └─────┬────────────┘
        │ verify ok       │ "ورود به کتاب بازی‌ها"
        ▼                 ▼
   save activation  ┌────────────────┐
        └──────────►│ GamesBookPage  │
                    │ grade picker + │
                    │ 9 + 9 tile     │
                    │ spread + flip  │
                    └────────────────┘
```

## Why CoverPage every launch (even when activated)

Per product requirement: an activated user still sees the closed-book cover on launch — they just don't see the lock screen. The cover is the *aesthetic entry point*; the lock is the *gate*. Cover → tap → (gate if needed) → inside.

## Persian / RTL

- `App.xaml.cs` sets `CurrentCulture = fa-IR` and overrides `FrameworkElement.LanguageProperty` so XAML inherits `XmlLanguage="fa-IR"`. This drives proper line breaking, digit shaping in `TextBlock`s with `Run`, and correct shaping for connected glyphs.
- Each user control sets `FlowDirection="RightToLeft"` at the root.
- Latin-only elements (the "YariZan" wordmark on the cover) explicitly opt back in with `FlowDirection="LeftToRight"`.
- Persian digits (۰‑۹) are emitted by `ToPersianDigits()` for version strings, page numbers, and grade labels.

## Fonts

Theme.xaml exposes two font keys:

```xml
<FontFamily x:Key="ShabnamFont">/Resources/Fonts/Shabnam/#Shabnam, Tahoma, Segoe UI, Arial</FontFamily>
<FontFamily x:Key="ShabnamBoldFont">/Resources/Fonts/Shabnam/#Shabnam Bold, Tahoma, Segoe UI, Arial</FontFamily>
```

`#Shabnam` and `#Shabnam Bold` are the *family names* registered in the TTF metadata, not file names. Shabnam ships separate files per weight; WPF picks them up by family name once the TTFs are present.

Until the `.ttf`s are dropped in, the fallback chain (Tahoma → Segoe UI → Arial) renders Persian acceptably on Windows.

## Animations

| Where | Effect | Implementation |
|-------|--------|----------------|
| Page swaps in `MainWindow` | small rotate (8° → 0°) + fade-in (0 → 1) over ~400 ms | `RotateTransform.AngleProperty` + `Opacity` `DoubleAnimation` |
| Page-flip in GamesBookPage | one half scales X 1 → 0.05 → reload → 0.05 → 1 (~400 ms total) | `ScaleTransform` X-axis + `Completed` callback |

For a more cinematic page flip, swap `ScaleTransform` for `PlaneProjection` (requires a small custom `Transform3DGroup`); current implementation favors maintainability.

## Tile grid

Each open spread shows 18 games (9 left + 9 right) in a 3 × 3 `UniformGrid`. Empty slots render as faint placeholders so the page never looks half-finished. The `PageIndicator` shows `پایهٔ <grade> — صفحهٔ <i> از <n>`. Switching grade resets to spread 0.

## Grade picker

Six round chips on the top center. Disabled chips correspond to grades with no packed games. Clicking a chip is a single-click toggle; the picker enforces "exactly one selected" by re-checking on click.

## Lock screen UX details

- **HWID** is shown as 8 groups of 4 hex chars for readability; the underlying value passed to `SerialCodec.Verify` is the un-grouped 64-char hex.
- A **Copy** button puts the raw HWID on the clipboard so customers can paste it into chat / email without typos.
- **Status text** turns dark red on errors, dark green on the "copied" confirmation.
- **Cancel** returns to the cover (closes the book), it does *not* exit the app — closing the app is the user's job via the window chrome.

## Author / info page strings

The default Persian copy on `InfoPage.xaml` is editable in‑place; nothing is loaded from a database. To change the studio name or about text, edit the XAML and rebuild.
