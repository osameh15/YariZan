# Local source games

Game files are not stored in this public repository. Create grade folders `1/` through `6/` locally. Put each game directly inside its grade folder (no nested folders):

```text
miniApps/1/صفحه سوم کتاب ریاضی.exe
miniApps/1/صفحه سوم کتاب ریاضی.jpg
miniApps/1/صفحه سوم کتاب ریاضی.txt
```

The executable, PNG or JPG thumbnail, and UTF-8 description must share the same filename stem. Extract archives locally before packing; RAR/ZIP archives are not game inputs. Only include games you have permission to distribute.

Names sort naturally (`page3`, `page4`, `page115`). Add files directly in the grade directory; nested game folders are not scanned. The packer accepts missing thumbnails/descriptions, but supplying both gives complete tiles. No sample games are shipped by this repository.

With your existing `secrets/master.key` present, run `dotnet run --project src/YariZan.Packer` from the repository root. This rebuilds `games_encrypted/` and its manifest. Rebuild/publish Yarizan afterward to copy the new bundle into the app output. Game payloads remain ignored by Git.

See [complete build and installer steps](../docs/build-and-pack.md) and [hosting setup](../web/licensing/README.md). The app also needs the matching public key and a working licensing service.

Each package includes one grade. Automatic detection chooses the only folder containing direct EXEs; empty folders are ignored. If several grades contain games, pass `-- --grade 2` to the packer or `--grade 2` to `build-installer.bat`. The manifest records `SelectedGrade`; the app uses it for the grade title.

The current grade-1 math-book bundle uses Persian filenames such as `صفحه سوم کتاب ریاضی`. This is catalog naming only: YariZan remains a general educational launcher. Persian page titles retain numeric textbook-page ordering; matching EXE/image/description stems are required.

Description TXT files should contain only instructions/details. Do not repeat the filename or game title in the body: the app supplies the title separately in the details dialog.
