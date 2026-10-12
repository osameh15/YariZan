# UI flow

## Desktop

The Persian RTL WPF app always starts on the closed-book cover. Opening it checks access online and shows Information for accepted paid activation or Lock otherwise.

| Screen | Behavior |
|---|---|
| Cover | Branded first page; opening initiates access checks |
| Lock | HWID/support copy, serial entry, server trial count, connection retry, back/exit |
| Information | Existing introductory About, paid/trial state, enter book |
| Game book | Grades, twelve tiles per spread, natural order, details/About overlays |

Online status registers a new device's PC name/HWID and displays two trials without consumption. Explicit trial entry consumes one signed grant. Both trial numbers use Persian digits. Retry checks a saved paid serial first; outages do not require retyping. A rejected paid serial does not silently become a trial.

Manifest names sort by numeric chunks (`page3`, `page4`, `page115`), retaining RTL page order. Game details are scrollable with a launch action. The book-toolbar About action displays hardcoded Persian `AboutText` from `GamesBookPage.xaml.cs`; scrolling works with its scrollbar hidden. Escape, Close, and backdrop dismissal restore focus; keyboard focus remains inside the overlay while open. Introductory About remains on Information.

Shabnam fonts and PNG branding are embedded resources. `Resources/icon.ico` supplies the EXE icon; the installer builder regenerates it from PNG before publishing.

## Panel

Login fits the viewport without the admin header. The signed-in page shows the table first; search covers name, description, serial and HWID. Page sizes: 10, 25, 50, 100, 200. Search/select/buttons have aligned heights, and the search placeholder fits with responsive wrapping.

Edit opens a closable section below the table. Name/description are editable, HWID read-only, and serial shown with Copy. Metadata Save preserves serial. Regenerate aligns with Save/Close and submits a separate form. Add with HWID supports manual registration/issuance. Reset/remove/regenerate use a shared styled dialog with confirm/cancel, Escape/backdrop and focus handling, not browser default confirmation.

Counts and dates use Persian digits. Dates use the Persian Solar Hijri/Jalali calendar and Tehran timezone via browser Intl. Versioned assets cache; authenticated pages/API do not.

## Installer

Inno shows welcome, bilingual EULA, Persian RTL About, options, progress and completion. About is generated from the app constant, not a separate `about.txt`. Both EULA language sections, wizard contact details and installed-app support metadata include `osameh.dev` and `support@osameh.dev`.
