using System.Security.Cryptography;
using YariZan.Core;

string? cmd = args.Length > 0 ? args[0].ToLowerInvariant() : null;
var secrets = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "secrets"));
Directory.CreateDirectory(secrets);
var privPath = Path.Combine(secrets, "private.pem");
var pubPath = Path.Combine(secrets, "public.pem");
var masterPath = Path.Combine(secrets, "master.key");

switch (cmd)
{
    case "init":
        Init(); break;
    case "hwid":
        Console.WriteLine("HWID: " + HwidProvider.GetHwidPretty());
        Console.WriteLine("Raw : " + HwidProvider.GetHwid());
        break;
    case "sign":
        if (args.Length < 2) { Console.Error.WriteLine("Usage: sign <hwid-hex>"); return 1; }
        Sign(args[1]);
        break;
    default:
        Console.WriteLine("YariZan Serial Generator");
        Console.WriteLine();
        Console.WriteLine("Commands:");
        Console.WriteLine("  init                Generate RSA keypair + master AES key into secrets/");
        Console.WriteLine("  hwid                Print this machine's HWID");
        Console.WriteLine("  sign <HWID-HEX>     Generate a serial bound to the given HWID");
        return 1;
}
return 0;

void Init()
{
    if (File.Exists(privPath) || File.Exists(pubPath) || File.Exists(masterPath))
    {
        Console.WriteLine("Keys already exist in " + secrets);
        Console.WriteLine("Delete them manually if you really want to regenerate.");
        Console.WriteLine("WARNING: regenerating invalidates ALL existing serials and game packs.");
        return;
    }

    using var ec = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    File.WriteAllText(privPath, ec.ExportPkcs8PrivateKeyPem());
    File.WriteAllText(pubPath, ec.ExportSubjectPublicKeyInfoPem());
    File.WriteAllBytes(masterPath, RandomNumberGenerator.GetBytes(32));

    try { File.SetAttributes(privPath, FileAttributes.ReadOnly); } catch { }
    try { File.SetAttributes(masterPath, FileAttributes.ReadOnly); } catch { }

    Console.WriteLine("Generated:");
    Console.WriteLine("  " + privPath + "   (KEEP SECRET)");
    Console.WriteLine("  " + pubPath  + "   (embedded in app)");
    Console.WriteLine("  " + masterPath + "   (embedded in app, used by Packer)");
}

void Sign(string hwidArg)
{
    if (!File.Exists(privPath))
    {
        Console.Error.WriteLine("private.pem not found. Run: YariZan.SerialGen init");
        return;
    }
    var hwid = new string(hwidArg.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
    if (hwid.Length != 64)
    {
        Console.Error.WriteLine("HWID must be 64 hex chars (got " + hwid.Length + ").");
        return;
    }
    var serial = SerialCodec.Sign(File.ReadAllText(privPath), hwid);
    Console.WriteLine();
    Console.WriteLine("HWID  : " + hwid);
    Console.WriteLine("Serial: " + serial);
    Console.WriteLine();
    Console.WriteLine("Send the Serial line to the customer.");
}
