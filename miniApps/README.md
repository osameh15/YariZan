# Local source games

Game files are not stored in this public repository. Create grade folders `1/` through `6/` locally. Put each game directly inside its grade folder (no nested folders):

```text
miniApps/1/صفحه 3 کتاب ریاضی.exe
miniApps/1/صفحه 3 کتاب ریاضی.jpg
miniApps/1/صفحه 3 کتاب ریاضی.txt
```

The executable, PNG or JPG thumbnail, and UTF-8 description must share the same filename stem. Extract archives locally before packing; RAR/ZIP archives are not game inputs. Only include games you have permission to distribute.

Names sort naturally (`page3`, `page4`, `page115`). Add files directly in the grade directory; nested game folders are not scanned. The packer accepts missing thumbnails/descriptions, but supplying both gives complete tiles. No sample games are shipped by this repository.

With your existing `secrets/master.key` present, run `dotnet run --project src/YariZan.Packer` from the repository root. This rebuilds `games_encrypted/` and its manifest. Rebuild/publish Yarizan afterward to copy the new bundle into the app output. Game payloads remain ignored by Git.

See [complete build and installer steps](../docs/build-and-pack.md) and [hosting setup](../web/licensing/README.md). The app also needs the matching public key and a working licensing service.

Each package includes one grade. Automatic detection chooses the only folder containing direct EXEs; empty folders are ignored. If several grades contain games, pass `-- --grade 2` to the packer or `--grade 2` to `build-installer.bat`. The manifest records `SelectedGrade`; the app uses it for the grade title.

The grade-1 math-book bundle uses filenames such as `صفحه 120 کتاب ریاضی`. To normalize older Persian word titles and English `pageNN` names, preview `python tools/rename_math_pages.py`, then run it with `--apply`. It records the mapping under ignored `publish/` and verifies file hashes without changing contents.

For multiple games on one textbook page, add a suffix to each matching file set, such as `صفحه 119 کتاب ریاضی - جمع با محور`, `صفحه 119 کتاب ریاضی - تفریق با محور`, or `صفحه 81 کتاب ریاضی - بازی دوم`. Page 119 has exactly those two number-line games. The book shows one tile per page; clicking it opens a dialog with a bordered button for every game. Single-game pages open directly. The details badge also lets users select which game's instructions to read. Existing Persian word page titles remain supported; numeric page titles accept English, Persian, and Arabic digits.

Description TXT files should contain only instructions/details. Do not repeat the filename or game title in the body: the app supplies the title separately in the details dialog.

For replacement updates, add `page115/page115.exe`, `.jpg`, and `.txt` (and equivalent folders for other pages) inside `miniApps/1/`. Preview with `powershell -File tools/Import-MathPageUpdates.ps1`; add `-Apply` to replace all older variants of each updated page and move the new files into `1/` with Persian names. Page 119 uses folders `page119-jam` and `page119-tafriq`; page 81's two existing games remain separate. In the current grade-1 collection, only pages 81 and 119 have two games; other folder updates replace earlier versions rather than adding a game. Repack after importing updates.
