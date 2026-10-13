using YariZan.Core;

// Build one grade, inferred from populated source folders unless explicitly selected.
int selectedGrade = 0;
if (args.Length != 0 && (args.Length != 2 || args[0] != "--grade"
    || !int.TryParse(args[1], out selectedGrade) || selectedGrade < 1 || selectedGrade > 6))
{
    Console.Error.WriteLine("Usage: YariZan.Packer [--grade 1..6]");
    return 1;
}

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var miniApps = Path.Combine(root, "miniApps");
var secrets = Path.Combine(root, "secrets");
var output = Path.Combine(root, "games_encrypted");
var masterPath = Path.Combine(secrets, "master.key");

if (args.Length == 0)
{
    var populated = Enumerable.Range(1, 6).Where(g =>
        Directory.Exists(Path.Combine(miniApps, g.ToString())) &&
        Directory.EnumerateFiles(Path.Combine(miniApps, g.ToString()), "*.exe").Any()).ToArray();
    if (populated.Length != 1)
    {
        Console.Error.WriteLine("Exactly one grade folder must contain games. Use --grade 1..6 when several grades have games.");
        return 1;
    }
    selectedGrade = populated[0];
}

if (!File.Exists(masterPath))
{
    Console.Error.WriteLine("master.key not found in " + secrets);
    Console.Error.WriteLine("Run: dotnet run --project src\\YariZan.SerialGen -- init");
    return 1;
}
if (!Directory.Exists(miniApps))
{
    Console.Error.WriteLine("miniApps/ not found at " + miniApps);
    return 1;
}

var masterKey = File.ReadAllBytes(masterPath);
if (masterKey.Length != 32)
{
    Console.Error.WriteLine("master.key must be 32 bytes (was " + masterKey.Length + ").");
    return 1;
}

var sourceGrade = Path.Combine(miniApps, selectedGrade.ToString());
if (!Directory.Exists(sourceGrade) || !Directory.EnumerateFiles(sourceGrade, "*.exe").Any())
{
    Console.Error.WriteLine($"No games in miniApps/{selectedGrade}/. Existing output was not changed.");
    return 1;
}

Directory.CreateDirectory(output);
foreach (var file in Directory.EnumerateFiles(output))
    if (!Path.GetFileName(file).Equals("README.md", StringComparison.OrdinalIgnoreCase)) File.Delete(file);
foreach (var directory in Directory.EnumerateDirectories(output)) Directory.Delete(directory, true);

var manifest = new GameManifest { SelectedGrade = selectedGrade };
int total = 0;

foreach (int g in new[] { selectedGrade })
{
    var gradeDir = Path.Combine(miniApps, g.ToString());
    if (!Directory.Exists(gradeDir)) continue;

    var entry = new GradeEntry { Grade = g };
    var outGradeDir = Path.Combine(output, g.ToString());
    Directory.CreateDirectory(outGradeDir);

    foreach (var exe in Directory.EnumerateFiles(gradeDir, "*.exe")
                                  .OrderBy(path => Path.GetFileNameWithoutExtension(path)!, GameNameComparer.Instance))
    {
        var name = Path.GetFileNameWithoutExtension(exe);
        var pngSrc = Path.Combine(gradeDir, name + ".png");
        var jpgSrc = Path.Combine(gradeDir, name + ".jpg");
        var imageSrc = File.Exists(pngSrc) ? pngSrc : (File.Exists(jpgSrc) ? jpgSrc : null);

        var txtSrc = Path.Combine(gradeDir, name + ".txt");
        var description = File.Exists(txtSrc)
            ? File.ReadAllText(txtSrc, System.Text.Encoding.UTF8).Trim()
            : "";

        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(name));
        var safe = "g" + g + "_" + Convert.ToHexString(hash).ToLowerInvariant();
        var encName = safe + ".dat";
        var imgName = imageSrc != null ? safe + Path.GetExtension(imageSrc) : "";

        GameCrypto.Encrypt(masterKey, exe, Path.Combine(outGradeDir, encName));
        if (imageSrc != null) File.Copy(imageSrc, Path.Combine(outGradeDir, imgName), true);

        entry.Games.Add(new GameEntry
        {
            Name = name,
            Grade = g,
            EncryptedFile = g + "/" + encName,
            ImageFile = imgName.Length > 0 ? g + "/" + imgName : "",
            Description = description,
        });
        total++;
        Console.WriteLine($"[grade {g}] {name}  →  {encName}");
    }

    if (entry.Games.Count > 0) manifest.Grades.Add(entry);
}

GameManifestIo.Write(manifest, Path.Combine(output, "manifest.json"));
Console.WriteLine();
Console.WriteLine($"Packed {total} game(s) into {output}");
return 0;
