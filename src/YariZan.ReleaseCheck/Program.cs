using YariZan.Core.V2;

try
{
    if (args.Length != 2) throw new InvalidDataException("Usage: --commercial <repository-root> | --acceptance-candidate <repository-root> | --public-roots-only <json-path>");
    if (args[0] == "--public-roots-only")
        CommercialReleasePolicy.ReadPublicRoots(Read(args[1], "V2_PUBLIC_ROOTS_MISSING"));
    else if (args[0] == "--acceptance-candidate")
    {
        string repo = Path.GetFullPath(args[1]);
        CommercialReleasePolicy.EnsureAcceptanceCandidate(
            Read(Path.Combine(repo, "secrets", "v2-license-public-keys.json"), "V2_PUBLIC_ROOTS_MISSING"),
            Read(Path.Combine(repo, "release", "v2-approved-public-roots.json"), "V2_REVIEWED_APPROVALS_MISSING"),
            Read(Path.Combine(repo, "secrets", "v2-activation.json"), "V2_ACTIVATION_CONFIG_MISSING"));
    }
    else if (args[0] == "--commercial")
    {
        string repo = Path.GetFullPath(args[1]);
        CommercialReleasePolicy.EnsureCommercialRelease(
            Read(Path.Combine(repo, "secrets", "v2-license-public-keys.json"), "V2_PUBLIC_ROOTS_MISSING"),
            Read(Path.Combine(repo, "release", "v2-approved-public-roots.json"), "V2_REVIEWED_APPROVALS_MISSING"),
            Read(Path.Combine(repo, "secrets", "v2-activation.json"), "V2_ACTIVATION_CONFIG_MISSING"));
    }
    else throw new InvalidDataException("Unknown release-check operation.");
    return 0;
}
catch (Exception ex)
{
    // Do not echo key/config input or sensitive parser errors.
    Console.Error.WriteLine(ex is FileNotFoundException or InvalidDataException or InvalidOperationException
        ? ex.Message : "V2_RELEASE_INPUT_INVALID: expected reviewed P-256 public roots and activation configuration.");
    return 1;
}

static string Read(string path, string missing)
{
    if (!File.Exists(path)) throw new FileNotFoundException(missing);
    if (new FileInfo(path).Length > StrictJson.MaxBytes) throw new InvalidDataException("V2_RELEASE_INPUT_TOO_LARGE");
    return File.ReadAllText(path);
}
