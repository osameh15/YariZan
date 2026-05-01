using YariZan.Core;

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var miniApps = Path.Combine(root, "miniApps");
var secrets = Path.Combine(root, "secrets");
var output = Path.Combine(root, "games_encrypted");
var masterPath = Path.Combine(secrets, "master.key");

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

if (Directory.Exists(output)) Directory.Delete(output, true);
Directory.CreateDirectory(output);

var manifest = new GameManifest();
int total = 0;

for (int g = 1; g <= 6; g++)
{
    var gradeDir = Path.Combine(miniApps, g.ToString());
    if (!Directory.Exists(gradeDir)) continue;

    var entry = new GradeEntry { Grade = g };
    var outGradeDir = Path.Combine(output, g.ToString());
    Directory.CreateDirectory(outGradeDir);

    foreach (var exe in Directory.EnumerateFiles(gradeDir, "*.exe"))
    {
        var name = Path.GetFileNameWithoutExtension(exe);
        var pngSrc = Path.Combine(gradeDir, name + ".png");
        var jpgSrc = Path.Combine(gradeDir, name + ".jpg");
        var imageSrc = File.Exists(pngSrc) ? pngSrc : (File.Exists(jpgSrc) ? jpgSrc : null);

        var txtSrc = Path.Combine(gradeDir, name + ".txt");
        var description = File.Exists(txtSrc)
            ? File.ReadAllText(txtSrc, System.Text.Encoding.UTF8).Trim()
            : "";

        var safe = "g" + g + "_" + Math.Abs(name.GetHashCode()).ToString("x8");
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
