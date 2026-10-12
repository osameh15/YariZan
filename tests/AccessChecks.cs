using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using YariZan.Core;

using var signer = ECDsa.Create(ECCurve.NamedCurves.nistP256);
AppKeys.PublicKey = signer.ExportSubjectPublicKeyInfoPem();
var hwid = HwidProvider.GetHwid();
var serial = SerialCodec.Sign(signer.ExportPkcs8PrivateKeyPem(), hwid);
void Check(string name, bool ok)
{
    if (!ok) throw new Exception("FAIL: " + name);
    Console.WriteLine("PASS: " + name);
}
bool Throws(Action action)
{
    try { action(); return false; } catch { return true; }
}
AccessSession Session() => new(() => ActivationStore.Load() is not null, () => TrialStore.RecordLaunch());
try
{
    Check("Valid serial accepted", SerialCodec.Verify(AppKeys.PublicKey, hwid, serial));
    Check("Other machine rejected", !SerialCodec.Verify(AppKeys.PublicKey, new string('B', 64), serial));
    Check("Invalid serial rejected", !SerialCodec.Verify(AppKeys.PublicKey, hwid, "INVALID"));
    ActivationStore.Save(new(hwid, "INVALID"));
    Check("Forged saved activation rejected", ActivationStore.Load() is null);
    ActivationStore.Save(new(hwid, serial));
    Check("Valid saved activation accepted", ActivationStore.Load() is not null);
    var blob = File.ReadAllBytes(ActivationStore.DefaultPath);
    blob[0] = (byte)'X';
    File.WriteAllBytes(ActivationStore.DefaultPath, blob);
    Check("Wrong activation header rejected", ActivationStore.Load() is null);
    ActivationStore.Clear();

    TrialStore.Reset();
    var first = Session();
    Check("No automatic access before trial click", !first.CanEnter);
    first.StartTrial();
    Check("First trial grants session access", first.CanEnter && TrialStore.Remaining() == 1);
    first.StartTrial();
    Check("Navigation does not consume another entry", TrialStore.Remaining() == 1);
    var second = Session();
    second.StartTrial();
    Check("Second trial grants access even with zero remaining", second.CanEnter && TrialStore.Remaining() == 0);
    var third = Session();
    Check("Third session blocked", Throws(third.StartTrial) && !third.CanEnter);
    File.Delete(TrialStore.PrimaryFilePath);
    Check("Deleting file alone does not reset trial", TrialStore.Remaining() == 0);
    ActivationStore.Save(new(hwid, serial));
    Check("Activation permits access after trial exhaustion", third.CanEnter);
    ActivationStore.Clear();
    Check("Removing activation blocks non-trial session", !third.CanEnter);

    var failed = new AccessSession(() => false, (Action)(() => throw new IOException("Simulated persistence failure")));
    Check("Failed trial save never authorizes access", Throws(failed.StartTrial) && !failed.CanEnter);
    TrialStore.Reset();
    Directory.CreateDirectory(Path.GetDirectoryName(TrialStore.PrimaryFilePath)!);
    File.WriteAllBytes(TrialStore.PrimaryFilePath, [1, 2, 3]);
    Check("Corrupt trial state blocks trials", TrialStore.Remaining() == 0 && Throws(() => TrialStore.RecordLaunch()));
    TrialStore.Reset();
    int successes = 0;
    Parallel.For(0, 4, _ =>
    {
        try { TrialStore.RecordLaunch(); Interlocked.Increment(ref successes); }
        catch (InvalidOperationException) { }
    });
    Check("Concurrent consumers get exactly two entries", successes == 2 && TrialStore.Remaining() == 0);

    string nonce = new string('C', 64);
    var message = Encoding.UTF8.GetBytes($"YariZan-Trial-v1|{hwid}|{nonce}|1");
    var signature = Convert.ToBase64String(signer.SignData(message, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
    var grant = new TrialGrant(hwid, nonce, 1, signature);
    Check("Signed trial grant accepted", grant.Verify(AppKeys.PublicKey, hwid, nonce));
    Check("Trial grant cannot be replayed in a new session", !grant.Verify(AppKeys.PublicKey, hwid, new string('D', 64)));
    Check("Altered trial grant rejected", !(grant with { Remaining = 0 }).Verify(AppKeys.PublicKey, hwid, nonce));
    Check("Wrong-device trial grant rejected", !grant.Verify(AppKeys.PublicKey, new string('B', 64), nonce));
    int requests = 0;
    var online = new AccessSession(() => false, (Func<Task<int>>)(async () => { await Task.Delay(10); Interlocked.Increment(ref requests); return 0; }));
    Task.WhenAll(online.StartTrialAsync(), online.StartTrialAsync()).GetAwaiter().GetResult();
    Check("Concurrent UI requests consume once and authorize the second trial", online.CanEnter && requests == 1 && online.TrialRemaining == 0);

    var vectorPath = Environment.GetEnvironmentVariable("YARIZAN_TEST_VECTOR");
    if (!string.IsNullOrEmpty(vectorPath))
    {
        using var vector = JsonDocument.Parse(File.ReadAllText(vectorPath));
        var root = vector.RootElement;
        var phpKey = root.GetProperty("publicKey").GetString()!;
        var phpHwid = root.GetProperty("hwid").GetString()!;
        var phpNonce = root.GetProperty("nonce").GetString()!;
        Check("PHP serial verifies in the existing .NET codec", SerialCodec.Verify(phpKey, phpHwid, root.GetProperty("serial").GetString()!));
        Check("PHP trial signature verifies in .NET", new TrialGrant(phpHwid, phpNonce, root.GetProperty("remaining").GetInt32(), root.GetProperty("signature").GetString()!).Verify(phpKey, phpHwid, phpNonce));
    }
}
finally
{
    ActivationStore.Clear();
    TrialStore.Reset();
}

namespace YariZan.Core
{
    public static class HwidProvider { public static string GetHwid() => new string('A', 64); }
    public static class AppKeys
    {
        public static string PublicKey { get; set; } = "";
        public static string LoadEmbeddedPublicKeyPem() => PublicKey;
    }
}
