# Local source games

Game files are not stored in this public repository. Create grade folders `1/` through `6/` locally. Put each game directly inside its grade folder (no nested folders):

```text
miniApps/1/page3.exe
miniApps/1/page3.jpg
miniApps/1/page3.txt
```

The executable, PNG or JPG thumbnail, and UTF-8 description must share the same filename stem. Extract archives locally before packing; RAR/ZIP archives are not game inputs. Only include games you have permission to distribute.

Names sort naturally (`page3`, `page4`, `page115`). Add files directly in the grade directory; nested game folders are not scanned. The packer accepts missing thumbnails/descriptions, but supplying both gives complete tiles. No sample games are shipped by this repository.

With your existing `secrets/master.key` present, run `dotnet run --project src/YariZan.Packer` from the repository root. This rebuilds `games_encrypted/` and its manifest. Rebuild/publish Yarizan afterward to copy the new bundle into the app output. Game payloads remain ignored by Git.

See [complete build and installer steps](../docs/build-and-pack.md) and [hosting setup](../web/licensing/README.md). The app also needs the matching public key and a working licensing service.
