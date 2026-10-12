# Generated game bundle

Run `dotnet run --project src/YariZan.Packer` from the repository root after placing games in `miniApps/<grade>/` and providing your existing local `secrets/master.key`.

The packer creates `manifest.json`, encrypted `.dat` payloads and thumbnails in grade folders. The app reads this manifest and ships these files beside its executable. Rebuild or publish the app after packing. Do not change the master key for an existing release without repacking all games and rebuilding the app with the matching key.

Generated bundles stay local and are ignored by Git. This README is the only tracked file in this folder; the packer preserves it.
