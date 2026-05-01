# CI

## Do you need it?

Honest take, scoped to *this* project today: **not strictly.** It's a Windows‑only WPF app, single developer, no test suite yet, manual release cadence. A build‑only CI catches very little that you wouldn't notice in your next `dotnet run`.

CI starts to earn its keep when **any** of these become true:

| Trigger | What CI gives you |
|---------|-------------------|
| You add unit tests | Catches regressions before merge — the biggest payoff |
| Contributors join | Every PR builds automatically; no "works on my machine" |
| You want release automation | Tag a version → CI builds → uploads `YariZan-win-x64.zip` to GitHub Releases |
| You add code‑signing | Centralizes the signing certificate in one secure CI secret instead of every dev's machine |

For now this repo carries one minimal workflow at `.github/workflows/ci.yml` that just verifies the solution builds. It's there as scaffolding — flip it on (push to GitHub) and it costs you nothing; ignore it for as long as you want.

## What the included workflow does

```yaml
on: [push to main, pull_request, workflow_dispatch]
runs-on: windows-latest
```

1. **Checks out** the repo.
2. **Installs .NET 9** SDK on the runner.
3. **Restores** NuGet for `src/YariZan.sln`.
4. **Generates ephemeral keys** by running `YariZan.SerialGen init`. These keys live only in the runner sandbox and disappear when the job ends. **Your real `secrets/private.pem` and `secrets/master.key` never leave your machine.**
5. **Packs** the sample games in `miniApps/` so the launcher project has something to embed.
6. **Builds Release** for the entire solution (`Core`, `App`, `SerialGen`, `Packer`).
7. **Smoke check**: confirms `YariZan.exe` was produced.

## Why ephemeral keys are safe

The `secrets/` directory is `.gitignored` for `private.pem` and `master.key`. The CI workflow regenerates them per‑run inside the GitHub‑hosted runner; nothing is uploaded back to GitHub, and the runner is destroyed after the job. This means:

- ✅ Your real signing key stays offline on your machine.
- ✅ CI can still build the entire solution end‑to‑end (including the launcher's embedded resources).
- ❌ A binary produced by CI is **not shippable** — its embedded master key is one‑time, so you couldn't later issue serials that would unlock games for that build.

This is on purpose. Releases should always be built **on your machine** with your real keys, not by CI. CI here is a *correctness* check, not a release pipeline.

## Adding tests later

When you write your first xUnit / NUnit project (e.g. `tests/YariZan.Core.Tests/`), uncomment the test step in `ci.yml`:

```yaml
- name: Test
  run: dotnet test src/YariZan.sln --configuration Release --no-build --logger "trx;LogFileName=test-results.trx"

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: '**/TestResults/*.trx'
```

## Adding release automation later

When you're ready to ship from CI (will require shipping your real `master.key` to GitHub Secrets — read the trade‑off carefully):

```yaml
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: windows-latest
    steps:
      # ... checkout + setup-dotnet ...

      - name: Restore real secrets from GH Secrets
        env:
          PRIVATE_PEM: ${{ secrets.YARIZAN_PRIVATE_PEM }}
          PUBLIC_PEM:  ${{ secrets.YARIZAN_PUBLIC_PEM }}
          MASTER_KEY_B64: ${{ secrets.YARIZAN_MASTER_KEY_B64 }}
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path secrets | Out-Null
          $env:PRIVATE_PEM | Out-File -FilePath secrets/private.pem -Encoding ascii
          $env:PUBLIC_PEM  | Out-File -FilePath secrets/public.pem  -Encoding ascii
          [IO.File]::WriteAllBytes("secrets/master.key", [Convert]::FromBase64String($env:MASTER_KEY_B64))

      - name: Pack & Publish
        run: |
          dotnet run --project src/YariZan.Packer
          dotnet publish src/YariZan.App/YariZan.App.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeAllContentForSelfExtract=true -o publish/YariZan-win-x64

      - name: Zip
        shell: pwsh
        run: Compress-Archive -Path publish/YariZan-win-x64/* -DestinationPath publish/YariZan-${{ github.ref_name }}-win-x64.zip

      - name: Attach to release
        uses: softprops/action-gh-release@v2
        with:
          files: publish/YariZan-${{ github.ref_name }}-win-x64.zip
```

**Trade‑off**: storing `master.key` as a GitHub secret means anyone with admin on your repo (or who steals your GitHub account) can extract it. For a small operation, keeping the release build local on your machine is safer. For a team, the convenience of `git tag v1.2 && git push --tags` triggering a signed release may be worth it.

## Cost

GitHub Actions on public repos is **free**. On private repos, you get 2,000 free minutes/month for Free accounts (more on paid). A single build run for this project is ~2 min, so even with several pushes a day you're nowhere near the cap.

## Summary

The workflow ships in this repo. Do nothing → it stays inert. Push to GitHub → CI starts running on every push. Add tests → uncomment the test step. Want release automation → see the snippet above.
