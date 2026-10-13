# Generated game bundle

Run `dotnet run --project src/YariZan.Packer` from the repository root after placing games in `miniApps/<grade>/` and providing your existing local `secrets/master.key`.

The packer creates `manifest.json`, encrypted `.dat` payloads and thumbnails in grade folders. The app reads this manifest and ships these files beside its executable. Rebuild or publish the app after packing. Do not change the master key for an existing release without repacking all games and rebuilding the app with the matching key.

Generated bundles stay local and are ignored by Git. This README is the only tracked file in this folder; the packer preserves it.

The portable EXE is not the entire release: distribute its adjacent `games_encrypted/` directory too. The installer builder includes this directory automatically. Names sort naturally from manifest game names, not hashed payload filenames. After removing/renaming source games, use a fresh publish output to avoid retaining obsolete payloads.

See [build, publish, and setup EXE instructions](../docs/build-and-pack.md). Keep the master key and original source games in secure local backups; do not delete them during artifact cleanup.

Each package includes one grade. Automatic detection chooses the only folder containing direct EXEs; empty folders are ignored. If several grades contain games, pass `-- --grade 2` to the packer or `--grade 2` to `build-installer.bat`. The manifest records `SelectedGrade`; the app uses it for the grade title.
