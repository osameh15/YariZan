using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Win32;
using YariZan.Core;
using YariZan.Core.Legacy;
using YariZan.Core.V2;

internal static class Program
{
    private static int _passed;
    private static readonly Product Product = new("YARIZAN-S-COMBINATION-LAND");
    private static void Check(bool value, string name)
    { if (!value) throw new Exception("FAIL " + name); Console.WriteLine("PASS " + name); _passed++; }
    private static bool Reject(Action operation) { try { operation(); return false; } catch { return true; } }
    private static byte[] Bytes(JsonElement fixture, string name) => System.Convert.FromBase64String(fixture.GetProperty(name).GetString()!);
    private static string Text(JsonElement fixture, string name) => fixture.GetProperty(name).GetString()!;

    [STAThread]
    public static int Main(string[] args)
    {
        var work = Path.Combine(Path.GetTempPath(), "YariZan-LegacyChecks-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(work);
        try
        {
            Check(typeof(GameCrypto).Assembly.ImageRuntimeVersion == "v4.0.30319", "legacy core targets CLR 4");
            if (args.Length > 2) Check(IntPtr.Size == (args[2] == "x64" ? 8 : 4), "check process runs as " + args[2]);
            using var doc = JsonDocument.Parse(File.ReadAllText(args[0]));
            var fixture = doc.RootElement;
            var identity = new Identity();
            var verifier = new SignedArtifactVerifier(new Dictionary<string, string> { ["disposable-legacy-test"] = Text(fixture, "publicKey") });
            string pem = Text(fixture, "publicKey");
            Check(CommercialReleasePolicy.PublicKeyFingerprint(pem) == Text(fixture, "fingerprint"), "Node and net48 agree on canonical SPKI fingerprint");
            foreach (string invalid in new[] { pem + pem, pem + "garbage", "garbage" + pem, Text(fixture, "p384"), Text(fixture, "k256"), pem.Replace("PUBLIC KEY", "PRIVATE KEY") })
                Check(Reject(() => CommercialReleasePolicy.PublicKeyFingerprint(invalid)), "unreviewed or malformed public root rejected");
            using (var wrongCurve = LegacyEcdsa.Create()) Check(Reject(() => wrongCurve.ImportFromPem(Text(fixture, "k256"))), "256-bit wrong-curve PEM rejected");
            Check(Reject(() => LegacyConvert.FromHexString("+1")), "hex parser rejects signed hex");
            Check(Reject(() => StrictJson.Parse("{\"a\":1,\"a\":2}")), "duplicate JSON keys rejected");
            var enrollment = verifier.VerifyEnrollment(Text(fixture, "enrollment"), identity, new string('C', 64));
            var license = verifier.VerifyLicense(Text(fixture, "license"), identity, Product, enrollment);
            Check(license.Sku == Product.Sku && license.Grade == 0, "Node-signed standalone license verified");
            Check(Reject(() => verifier.VerifyLicense(Text(fixture, "license"), identity, new Product(1), enrollment)), "standalone license cannot unlock G1");
            Check(Reject(() => verifier.VerifyLicense(Text(fixture, "license"), identity, new Product("YARIZAN-S-NUMBER-BUILDER"), enrollment)), "standalone license cannot unlock another standalone product");
            Check(Reject(() => verifier.VerifyLicense(Text(fixture, "license"), new Identity('B'), Product, enrollment)), "license cannot unlock another device");
            Check(Reject(() => verifier.VerifyEnrollment(Text(fixture, "enrollment"), identity, new string('B', 64))), "enrollment bound to profile key");
            Check(verifier.VerifyDecision(Text(fixture, "revoked"), license).Status == "REVOKED", "Node-signed revocation verified");
            Check(Reject(() => verifier.VerifyLicense(Text(fixture, "license").Replace("COMBINATION-LAND", "NUMBER-BUILDER"), identity, Product, enrollment)), "tampered signature rejected");

            string game = Path.Combine(work, "fixture.yzg"); File.WriteAllBytes(game, Bytes(fixture, "blob"));
            byte[] key = ProductGameKey.Derive(Bytes(fixture, "master"), Product);
            Check(key.SequenceEqual(Bytes(fixture, "gameKey")), "Node and legacy SKU-bound keys match");
            Check(GameCrypto.Decrypt(key, game).SequenceEqual(Bytes(fixture, "plain")), "Node AES-GCM game payload decrypted");
            byte[] blob = Bytes(fixture, "blob"); blob[16] ^= 1; File.WriteAllBytes(game, blob);
            Check(Reject(() => GameCrypto.Decrypt(key, game)), "altered AES-GCM tag rejected");
            File.WriteAllBytes(game, Bytes(fixture, "blob"));
            Check(Reject(() => GameCrypto.Decrypt(ProductGameKey.Derive(Bytes(fixture, "master"), new Product("YARIZAN-S-NUMBER-BUILDER")), game)), "another product's game key rejected");
            Check(LegacyPbkdf2.Pbkdf2(Encoding.UTF8.GetBytes("legacy-password"), Encoding.UTF8.GetBytes("legacy-salt"), 100000, HashAlgorithmName.SHA256, 32).SequenceEqual(Bytes(fixture, "pbkdf2")), "PBKDF2 matches Node SHA256 vector");
            var plain = Bytes(fixture, "plain"); var encrypted = new byte[plain.Length]; var tag = new byte[16]; var nonce = Bytes(fixture, "blob").Skip(4).Take(12).ToArray();
            using (var aes = new LegacyAesGcm(key, 16)) aes.Encrypt(nonce, plain, encrypted, tag);
            Check(encrypted.SequenceEqual(Bytes(fixture, "blob").Skip(32)), "legacy AES-GCM encryption matches Node ciphertext");
            Check(tag.SequenceEqual(Bytes(fixture, "blob").Skip(16).Take(16)), "legacy AES-GCM authentication tag matches Node");
            var buffer = Enumerable.Repeat((byte)255, plain.Length).ToArray(); tag[0] ^= 1;
            using (var aes = new LegacyAesGcm(key, 16)) Check(Reject(() => aes.Decrypt(nonce, encrypted, tag, buffer)) && buffer.All(b => b == 0), "unauthenticated plaintext is never released");
            var disposed = new LegacyAesGcm(key, 16); disposed.Dispose();
            Check(Reject(() => disposed.Encrypt(nonce, plain, encrypted, tag)), "disposed cipher cannot encrypt with a zeroed key");

            var store = new FileLicenseStore(Path.Combine(work, "license"));
            store.WriteLicense(Product, Text(fixture, "license"));
            Check(store.ReadLicense(Product).Envelope == Text(fixture, "license"), "DPAPI license round trip");
            using (var offline = new DesktopAccessController(identity, Product, verifier, store, new Server { Offline = true }, new Enrollment(enrollment)))
                Check(offline.IsPurchased && offline.CanEnter, "paid startup works offline");
            store.WriteDecision(Product, Text(fixture, "revoked"));
            using (var revoked = new DesktopAccessController(identity, Product, verifier, store, new Server { Offline = true }, new Enrollment(enrollment)))
                Check(!revoked.CanEnter && revoked.State == DesktopAccessState.Revoked, "persisted revocation blocks offline access");
            File.WriteAllText(Path.Combine(work, "license", Product.Sku + ".license.dat"), "corrupt");
            Check(store.ReadLicense(Product).Status == StoreReadStatus.Corrupt, "corrupt DPAPI file rejected");
            ProductMatrixChecks(fixture, work, identity, enrollment, verifier);

            using (var signing = new ECDsaCng(256))
            {
                var server = new Server { Signing = signing };
                string testPem = PublicPem(signing.ExportSubjectPublicKeyInfo());
                var trialVerifier = new SignedArtifactVerifier(new Dictionary<string, string> { ["disposable-legacy-test"] = testPem });
                for (int attempt = 0; attempt < 3; attempt++)
                {
                    using var access = new DesktopAccessController(identity, Product, trialVerifier, new FileLicenseStore(Path.Combine(work, "trials")), server, new Enrollment(enrollment));
                    try { access.StartTrialAsync().GetAwaiter().GetResult(); }
                    catch (TrialExhaustedException) when (attempt == 2) { }
                    Check(access.CanEnter == (attempt < 2), "trial attempt " + (attempt + 1) + " preserves two-start policy");
                }
                Check(server.Starts == 2, "third trial never consumes or grants a start");
            }
            CngChecks(args[1]);
            HttpChecks();
            ProcessChecks();
            var application = new YariZan.App.App();
            application.InitializeComponent();
            var page = new YariZan.App.Views.LockPage(new DesktopAccessController(identity, Product, verifier, new FileLicenseStore(Path.Combine(work, "ui")), new Server(), new Enrollment(enrollment)));
            page.Measure(new Size(1100, 900)); page.Arrange(new Rect(0, 0, 1100, 900));
            Check(page.ActualWidth > 0 && page.ActualHeight > 0, "legacy WPF activation page constructs and lays out");
            application.Shutdown();
            Console.WriteLine("PASS legacy checks: " + _passed); return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
        finally { Directory.Delete(work, true); }
    }

    private static string PublicPem(byte[] bytes) => "-----BEGIN PUBLIC KEY-----\n" + System.Convert.ToBase64String(bytes) + "\n-----END PUBLIC KEY-----\n";
    private static void ProductMatrixChecks(JsonElement fixture, string work, IDeviceIdentity identity, DeviceEnrollment enrollment, ILicenseVerifier verifier)
    {
        var rows = fixture.GetProperty("products").EnumerateArray().ToArray();
        var expected = StandaloneCatalog.All.Select(p => p.Sku).Concat(new[] { "YARIZAN-G1" }).OrderBy(s => s).ToArray();
        Check(rows.Select(p => Text(p, "sku")).OrderBy(s => s).SequenceEqual(expected), "legacy matrix covers every currently released product");
        var store = new FileLicenseStore(Path.Combine(work, "all-products"));
        foreach (var row in rows)
        {
            var product = new Product(Text(row, "sku"));
            string envelope = Text(row, "license");
            var paid = verifier.VerifyLicense(envelope, identity, product, enrollment);
            Check(paid.Sku == product.Sku && paid.Grade == product.Grade, "legacy license verification: " + product.Sku);
            foreach (var other in expected.Where(s => s != product.Sku))
                Check(Reject(() => verifier.VerifyLicense(envelope, identity, new Product(other), enrollment)), product.Sku + " cannot unlock " + other);
            store.WriteLicense(product, envelope);
            using (var offline = new DesktopAccessController(identity, product, verifier, store, new Server { Offline = true }, new Enrollment(enrollment)))
                Check(offline.CanEnter && offline.IsPurchased, "legacy offline paid access: " + product.Sku);
            byte[] key = product.IsStandalone ? ProductGameKey.Derive(Bytes(fixture, "master"), product) : Bytes(fixture, "master");
            Check(key.SequenceEqual(Bytes(row, "key")), "legacy game key: " + product.Sku);
            string game = Path.Combine(work, product.Sku + ".yzg"); File.WriteAllBytes(game, Bytes(row, "blob"));
            Check(GameCrypto.Decrypt(key, game).SequenceEqual(Bytes(fixture, "plain")), "legacy encrypted payload: " + product.Sku);
            using var signing = new ECDsaCng(256);
            var server = new Server { Signing = signing };
            var trialVerifier = new SignedArtifactVerifier(new Dictionary<string, string> { ["disposable-legacy-test"] = PublicPem(signing.ExportSubjectPublicKeyInfo()) });
            for (int attempt = 0; attempt < 3; attempt++)
            {
                using var access = new DesktopAccessController(identity, product, trialVerifier, new FileLicenseStore(Path.Combine(work, "matrix-trials")), server, new Enrollment(enrollment));
                try { access.StartTrialAsync().GetAwaiter().GetResult(); }
                catch (TrialExhaustedException) when (attempt == 2) { }
                Check(access.CanEnter == (attempt < 2), product.Sku + " legacy trial attempt " + (attempt + 1));
            }
        }
        foreach (var row in rows)
            Check(store.ReadLicense(new Product(Text(row, "sku"))).Envelope == Text(row, "license"), "license store retains separate product slot: " + Text(row, "sku"));
    }
    private static void HttpChecks()
    {
        foreach (var test in new[] { "valid", "redirect", "oversized", "duplicate", "cancelled-read" })
        {
            using var http = new HttpClient(new Handler(test));
            var client = new DesktopV2Client(http, new Credential(), TimeSpan.FromMilliseconds(150));
            if (test == "valid") Check(client.GetTrialStatusAsync(Product, CancellationToken.None).GetAwaiter().GetResult() == 2, "legacy bounded HTTP response read");
            else Check(Reject(() => client.GetTrialStatusAsync(Product, CancellationToken.None).GetAwaiter().GetResult()), "legacy HTTP rejects " + test);
        }
    }
    private static void ProcessChecks()
    {
        string command = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "cmd.exe");
        using var process = Process.Start(new ProcessStartInfo(command, "/d /c ping.exe -n 30 127.0.0.1")
        { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true })!;
        try
        {
            using var cancellation = new CancellationTokenSource(100);
            Check(Reject(() => process.WaitForExitAsync(cancellation.Token).GetAwaiter().GetResult()), "legacy process wait respects cancellation");
            process.Kill(entireProcessTree: true);
            Check(process.WaitForExit(5000), "legacy process tree termination completes");
            process.WaitForExitAsync(CancellationToken.None).GetAwaiter().GetResult();
            Check(process.HasExited, "legacy process wait handles already-exited process");
        }
        finally { if (!process.HasExited) process.Kill(entireProcessTree: true); }
    }
    private sealed class Credential : IDeviceCredentialProvider
    {
        public string DeviceId => "10000000-0000-4000-8000-000000000001";
        public Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation) => Task.FromResult("test-only-device-credential");
    }
    private sealed class Handler(string mode) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
        {
            var response = new HttpResponseMessage(mode == "redirect" ? HttpStatusCode.Redirect : HttpStatusCode.OK);
            response.Content = mode == "cancelled-read" ? new StreamContent(new BlockingStream())
                : new StringContent(mode == "duplicate" ? "{\"remaining\":2,\"remaining\":0}" : "{\"remaining\":2}");
            if (mode == "oversized") response.Content.Headers.ContentLength = StrictJson.MaxBytes + 1;
            return Task.FromResult(response);
        }
    }
    private sealed class BlockingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanWrite => false;
        public override bool CanSeek => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellation)
        { await Task.Delay(Timeout.Infinite, cancellation); return 0; }
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
    private static void CngChecks(string output)
    {
        string name = "YariZan.LegacyChecks." + Guid.NewGuid().ToString("N");
        byte[] first;
        try
        {
            using (var key = new CngDeviceKeyStore(name, preferTpm: false))
            {
                first = key.ExportPublicKey();
                Check(key.Assurance == "SOFTWARE", "Windows software CNG key available without TPM");
                byte[] signature = key.SignChallenge("legacy-check", new string('D', 64), new Identity());
                using var doc = StrictJson.Parse(JsonSerializer.Serialize(new { challenge_id = "legacy-check", nonce = new string('D', 64), fingerprint_version = 2, fingerprint_digest = new string('A', 64), device_public_key = Base64Url.Encode(first) }));
                byte[] message = Encoding.UTF8.GetBytes("YariZan-Device-Challenge-V2\n" + CanonicalJson.Serialize(doc.RootElement));
                using var verifier = LegacyEcdsa.Create(); verifier.ImportSubjectPublicKeyInfo(first, out _);
                Check(verifier.VerifyData(message, signature, HashAlgorithmName.SHA256, LegacySignatureFormat.IeeeP1363FixedFieldConcatenation), "CNG proof signature verified by managed P1363 verifier");
                File.WriteAllText(output, JsonSerializer.Serialize(new { publicKey = PublicPem(first), message = System.Convert.ToBase64String(message), signature = System.Convert.ToBase64String(signature) }));
            }
            using (var reopened = new CngDeviceKeyStore(name, preferTpm: false)) Check(first.SequenceEqual(reopened.ExportPublicKey()), "persisted CNG key is not replaced on reopen");
            using var raw = CngKey.Open(name, CngProvider.MicrosoftSoftwareKeyStorageProvider);
            Check(Reject(() => raw.Export(CngKeyBlobFormat.Pkcs8PrivateBlob)), "private device key remains nonexportable");
        }
        finally
        {
            if (CngKey.Exists(name, CngProvider.MicrosoftSoftwareKeyStorageProvider)) { using var key = CngKey.Open(name, CngProvider.MicrosoftSoftwareKeyStorageProvider); key.Delete(); }
            using var registry = Registry.CurrentUser.OpenSubKey(CngDeviceKeyStore.ProviderRegistryPath, true);
            registry?.DeleteValue(CngDeviceKeyStore.ProviderValueName(name), false);
        }
    }
    private sealed class Identity(char digit = 'A') : IDeviceIdentity
    {
        public int FingerprintVersion => 2;
        public string FingerprintDigest => new(digit, 64);
        public string Username => "YZ-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA";
        public bool IsAvailable => true;
    }
    private sealed class Enrollment(DeviceEnrollment value) : ILocalDeviceEnrollmentProvider
    { public DeviceEnrollment ReadVerifiedIdentity() => value; }
    private sealed class Server : IDesktopV2Client
    {
        public ECDsaCng? Signing;
        public bool Offline;
        public int Starts;
        public string DeviceId => "10000000-0000-4000-8000-000000000001";
        public Task<int> GetTrialStatusAsync(Product product, CancellationToken cancellation) => Task.FromResult(2 - Starts);
        public Task<TrialStartResponse> StartTrialAsync(TrialStartRequest request, CancellationToken cancellation)
        {
            if (Starts >= 2) throw new TrialExhaustedException();
            using var document = StrictJson.Parse(JsonSerializer.Serialize(new { format = "YARIZAN-TRIAL-START-V2", kid = "disposable-legacy-test", issued_at = "2026-11-09T00:00:00Z", device_id = request.DeviceId, sku = request.Sku, grade = new Product(request.Sku).Grade, client_nonce = request.ClientNonce, process_session_id = request.ProcessSessionId }));
            var message = Encoding.UTF8.GetBytes(SignedArtifactVerifier.TrialDomain + CanonicalJson.Serialize(document.RootElement));
            string grant = JsonSerializer.Serialize(new { algorithm = "ES256-P1363", payload = document.RootElement, signature = Base64Url.Encode(Signing!.SignData(message, HashAlgorithmName.SHA256)) });
            Starts++; return Task.FromResult(new TrialStartResponse(grant, 2 - Starts, "2026-11-09T00:00:00Z"));
        }
        public Task<string> SynchronizeAsync(PaidLicense license, CancellationToken cancellation) => throw new HttpRequestException(Offline ? "Offline" : "Not configured");
        public Task<string> PickupAsync(Product product, CancellationToken cancellation) => throw new HttpRequestException();
        public Task<IReadOnlyList<DesktopEntitlement>> GetEntitlementsAsync(CancellationToken cancellation) => throw new HttpRequestException();
        public Task<string> RedeemAsync(ActivationCodeRequest request, CancellationToken cancellation) => throw new HttpRequestException();
    }
}
