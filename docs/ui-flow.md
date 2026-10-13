# UI flow

## Desktop

The Persian RTL WPF app always starts on the closed-book cover. Opening it checks access online and shows Information for accepted paid activation or Lock otherwise.

| Screen | Behavior |
|---|---|
| Cover | Branded first page; opening initiates access checks |
| Lock | HWID/support copy, serial entry, server trial count, connection retry, back/exit |
| Information | Existing introductory About, paid/trial state, enter book |
| Game book | One grade title, twelve portrait tiles per spread (3 columns x 2 rows per page), natural order, details/About overlays |

Online status registers a new device's PC name/HWID and displays two trials without consumption. Explicit trial entry consumes one signed grant. Both trial numbers use Persian digits. Retry checks a saved paid serial first; outages do not require retyping. A rejected paid serial does not silently become a trial.

Manifest names sort by numeric chunks (`page3`, `page4`, `page115`), retaining RTL page order. Game details are scrollable with a launch action. The book-toolbar About action displays hardcoded Persian `AboutText` from `GamesBookPage.xaml.cs`; scrolling works with its scrollbar hidden. Escape, Close, and backdrop dismissal restore focus; keyboard focus remains inside the overlay while open. Introductory About remains on Information.

Shabnam fonts and PNG branding are embedded resources. `Resources/icon.ico` supplies the EXE icon; the installer builder regenerates it from PNG before publishing.

## Panel

Login fits the viewport without the admin header. The signed-in page shows the table first; search covers name, description, serial and HWID. Page sizes: 10, 25, 50, 100, 200. Search/select/buttons have aligned heights, and the search placeholder fits with responsive wrapping.

Edit opens a closable section below the table. Name/description are editable, HWID read-only, and serial shown with Copy. Metadata Save preserves serial. Regenerate aligns with Save/Close and submits a separate form. Add with HWID supports manual registration/issuance. Reset/remove/regenerate use a shared styled dialog with confirm/cancel, Escape/backdrop and focus handling, not browser default confirmation.

Counts and dates use Persian digits. Dates use the Persian Solar Hijri/Jalali calendar and Tehran timezone via browser Intl. Versioned assets cache; authenticated pages/API do not.

## Installer

Inno shows welcome, bilingual EULA, Persian RTL About, options, progress and completion. About is generated from the app constant, not a separate `about.txt`. Both EULA language sections, wizard contact details and installed-app support metadata include `osameh.dev` and `support@osameh.dev`.

The center footer accepts a spread number using English, Persian, or Arabic digits; press Enter or Go. Previous/Next disable at boundaries. Invalid numbers retain the current spread. Thumbnail decoding runs on two background workers, at 360 pixels high, with at most 48 cached images. Revisited spreads reuse thumbnails. A 170 ms fold and 200 ms unfold around the spine restore the book animation; thumbnails prefetch during the fold, and overlapping turns are prevented.

The cover displays the OAR NOVA GAMES STUDIO logo and a Persian title derived from the selected grade. The information page displays the primary Yarizan logo from the brand kit. Window/EXE/setup icons use the kit app icon; setup preserves the supplied multi-size Windows ICO. The studio identity is shared by app credits, installer metadata and EULA. English studio text sits in the RTL layout without reversing its characters.

The studio PNG retains its original transparency on the cover; its container has no opaque backing. The game-book toolbar centers the transparent Yarizan primary logo between equal-width side sections.

A game click immediately opens a centered animated Yarizan-logo loading overlay and disables the book until startup finishes. Access is checked before background decryption and file preparation. The overlay remains until the game window is input-ready (up to ten seconds of startup observation), and closes on errors or cancellation. Revocation/shutdown cancel preparation and prevent a pending game from starting. Description bodies contain instructions only; the modal already displays the filename as its title.
