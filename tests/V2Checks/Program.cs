using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using YariZan.App.Views;
using YariZan.App.Services;
using YariZan.Core;
using YariZan.Core.V2;

internal static partial class Program
{
    private static int _passed;
    private static readonly Product G1 = new(1);
    private static string _root = "";
    private static void Check(bool ok, string name)
    { if (!ok) throw new Exception("FAIL " + name); _passed++; Console.WriteLine("PASS " + name); }
    private static bool Reject(Action action)
    { try { action(); return false; } catch (Exception) { return true; } }
    private static bool RejectAsync(Func<Task> action) => Reject(() => action().GetAwaiter().GetResult());
    private static void Run(Task task) => task.GetAwaiter().GetResult();
    private static T Run<T>(Task<T> task) => task.GetAwaiter().GetResult();
    private static DesktopAccessController Access(IDeviceIdentity id, SigningFixture signing, ILicenseStore store, IDesktopV2Client server, int grade = 1) =>
        new(id, new Product(grade), signing.Verifier, store, server, new TestEnrollmentProvider(Enrollment(id)));
    private static DeviceEnrollment Enrollment(IDeviceIdentity identity) => new(SigningFixture.DeviceId,
        identity.FingerprintVersion, identity.FingerprintDigest, new string('A', 64), SigningFixture.CustomerId);
    private static FileLicenseStore Store(string name) => new(Path.Combine(_root, name));

    [STAThread]
    public static int Main(string[] args)
    {
        if (args.FirstOrDefault()?.StartsWith("--child-", StringComparison.Ordinal) == true) return Child(args);
        _root = Path.Combine(Path.GetTempPath(), "YariZan-v2-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
        try
        {
            using var signing = new SigningFixture();
            var identity = new DeviceIdentityV2(new Signals());
            IdentityChecks(identity);
            CryptoChecks(signing, identity);
            EnrollmentChecks(signing, identity);
            ReleasePolicyChecks(signing);
            ReleaseIntegrationChecks(signing);
            PaidChecks(signing, identity);
            TrialChecks(signing, identity);
            NetworkChecks();
            HttpContractChecks(signing, identity);
            ActivationChecks(signing, identity);
            WindowsKeyChecks(identity);
            CrossLanguage(signing, identity);
            UiChecks(signing, identity, args.FirstOrDefault() ?? Path.Combine(_root, "screenshots"), args.ElementAtOrDefault(1));
            Console.WriteLine($"RESULT {_passed} passed; 0 failed. Windows {Environment.OSVersion}; .NET {Environment.Version}");
            return 0;
        }
        catch (Exception ex) { Console.Error.WriteLine(ex); Console.Error.WriteLine($"RESULT {_passed} passed; 1 failed."); return 1; }
    }

    private static int Child(string[] args)
    {
        try
        {
            if (args[0] == "--child-identity")
            {
                _ = new Product(int.Parse(args[1]));
                return new DeviceIdentityV2(new WindowsFingerprintProvider()).Username == args[2] ? 0 : 1;
            }
            if (args[0] == "--child-key")
            {
                using var key = new CngDeviceKeyStore(args[1], preferTpm: false);
                return Base64Url.Encode(key.ExportPublicKey()) == args[2] ? 0 : 1;
            }
            var identity = new DeviceIdentityV2(new Signals());
            var keys = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(args[2]))!;
            using var signing = new SigningFixture();
            using var access = new DesktopAccessController(identity, G1, new SignedArtifactVerifier(keys), new FileLicenseStore(args[1]), new FakeServer(signing, identity) { Offline = true }, new TestEnrollmentProvider(Enrollment(identity)));
            return access.CanEnter == (args[0] == "--child-paid") ? 0 : 1;
        }
        catch { return 2; }
    }

    private static bool ChildSucceeds(params string[] arguments)
    {
        var info = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true };
        info.ArgumentList.Add(typeof(Program).Assembly.Location);
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var child = Process.Start(info)!;
        if (!child.WaitForExit(30000)) { child.Kill(); return false; }
        return child.ExitCode == 0;
    }

    private static void IdentityChecks(IDeviceIdentity identity)
    {
        var names = Enumerable.Range(1, 6).Select(_ => new DeviceIdentityV2(new Signals()).Username).ToArray();
        Check(names.Distinct().Count() == 1 && names[0] == identity.Username, "G1-G6 mocked identity identical");
        Check(DeviceIdentityV2.Normalize("  ab\t  cd ") == "AB CD", "invariant whitespace and case normalization");
        Check(DeviceIdentityV2.Normalize("ＴＯ ＢＥ ＦＩＬＬＥＤ ＢＹ Ｏ.Ｅ.Ｍ.") == "", "OEM placeholders rejected after normalization");
        Check(DeviceIdentityV2.Normalize("00000000-0000-0000-0000-000000000000") == "", "zero UUID rejected");
        var reordered = new DeviceIdentityV2(new Signals { Values = new Dictionary<string, IEnumerable<string>>
        { ["bios"] = new[] { " BIOS-456 " }, ["board"] = new[] { "BOARD-123", " board-123 " } } });
        Check(reordered.FingerprintDigest == identity.FingerprintDigest, "WMI enumeration order and duplicate normalization stable");
        foreach (var signal in new[] { "uuid", "board", "bios", "cpu" })
            Check(new DeviceIdentityV2(new Signals { Values = new Dictionary<string, IEnumerable<string>> { [signal] = new[] { "X123" } } }).IsAvailable, "single available WMI signal: " + signal);
        var fallback = new Signals { Values = new Dictionary<string, IEnumerable<string>>(), Fallback = "machine-guid-example" };
        Check(new DeviceIdentityV2(fallback).Username == new DeviceIdentityV2(fallback).Username, "machine fallback repeatable without Windows username");
        Check(!new DeviceIdentityV2(new Signals { Values = new Dictionary<string, IEnumerable<string>>() }).IsAvailable, "all identity sources unavailable fail closed");
        var real = Enumerable.Range(1, 6).Select(_ => new DeviceIdentityV2(new WindowsFingerprintProvider())).ToArray();
        Check(real.All(i => i.IsAvailable) && real.Select(i => i.Username).Distinct().Count() == 1, "actual Windows WMI G1-G6 configurations share username (redacted)");
        Check(Enumerable.Range(1, 6).All(g => ChildSucceeds("--child-identity", g.ToString(), real[0].Username)), "six separate Windows processes with grade configurations share username");
    }

    private static void CryptoChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var verifier = signing.Verifier; string license = signing.License(identity);
        Check(verifier.VerifyLicense(license, identity, G1, Enrollment(identity)).Grade == 1, "valid signed G1 accepted");
        Check(Reject(() => verifier.VerifyLicense(license, identity, new Product(2), Enrollment(identity))), "G1 rejected by G2");
        Check(Reject(() => verifier.VerifyLicense(license, new DeviceIdentityV2(new Signals { Fallback = "different", Values = new Dictionary<string, IEnumerable<string>>() }), G1, Enrollment(identity))), "incorrect device rejected");
        Check(Reject(() => verifier.VerifyLicense(license.Replace("YARIZAN-G1", "YARIZAN-G2"), identity, G1, Enrollment(identity))), "modified payload rejected");
        Check(Reject(() => new SignedArtifactVerifier(new Dictionary<string, string>()).VerifyLicense(license, identity, G1, Enrollment(identity))), "unknown signing key rejected");
        using var other = new SigningFixture();
        Check(Reject(() => other.Verifier.VerifyLicense(license, identity, G1, Enrollment(identity))), "invalid signature rejected");
        foreach (var (field, value) in new (string, object?)[] { ("expires_at", "2099-01-01T00:00:00Z"), ("grade", 2), ("device_fingerprint_version", 1), ("license_revision", 0), ("license_id", "not-uuid"), ("issued_at", "2026-10-14T00:00:00+00:00"), ("extra", true), ("format", "YARIZAN-LICENSE-V1") })
        {
            var p = signing.LicensePayload(identity); p[field] = value;
            Check(Reject(() => verifier.VerifyLicense(signing.Sign(p, SignedArtifactVerifier.LicenseDomain), identity, G1, Enrollment(identity))), "signed invalid claim rejected: " + field);
        }
        Check(Reject(() => verifier.VerifyLicense(license.Replace("ES256-P1363", "ES256"), identity, G1, Enrollment(identity))), "DER/algorithm substitution rejected");
        using (var original = StrictJson.Parse(license))
        {
            string shortSignature = JsonSerializer.Serialize(new { algorithm = "ES256-P1363", payload = original.RootElement.GetProperty("payload"), signature = Base64Url.Encode(new byte[63]) });
            Check(Reject(() => verifier.VerifyLicense(shortSignature, identity, G1, Enrollment(identity))), "63-byte signature rejected");
        }
        Check(Reject(() => verifier.VerifyLicense(license.Replace("\"algorithm\":", "\"algorithm\":\"ES256-P1363\",\"algorithm\":"), identity, G1, Enrollment(identity))), "duplicate envelope keys rejected");
        Check(Reject(() => StrictJson.Parse("{\"x\":1,\"x\":2}")), "duplicate payload keys rejected");
        Check(Reject(() => StrictJson.Parse("{\"x\":0.5}")) && Reject(() => StrictJson.Parse("{\"x\":9007199254740992}")), "floats and unsafe integers rejected");
        Check(Reject(() => StrictJson.Parse("{\"x\":\"\\ud800\"}")), "lone surrogate rejected");
        Check(Reject(() => StrictJson.Parse(new string(' ', 32769))), "oversized envelope rejected");
        Check(Reject(() => verifier.VerifyLicense(signing.Sign(signing.LicensePayload(identity), SignedArtifactVerifier.TrialDomain), identity, G1, Enrollment(identity))), "domain substitution rejected");
    }

    private static void PaidChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var store = Store("paid"); var server = new FakeServer(signing, identity) { Offline = true };
        using (var access = Access(identity, signing, store, server)) Check(!access.CanEnter && access.State == DesktopAccessState.NoLicense, "missing local license locks");
        store.WriteLicense(G1, signing.License(identity));
        using var paid = Access(identity, signing, store, server);
        Check(paid.CanEnter && paid.IsPurchased && server.SyncRequests == 0, "purchased launch succeeds fully offline before any request");
        Run(paid.SynchronizePurchasedAsync());
        Check(paid.CanEnter && store.ReadDecision(G1).Status == StoreReadStatus.Missing, "network failure preserves purchased access and revocation state");
        server.Offline = false;
        server.PendingSync = new(TaskCreationOptions.RunContinuationsAsynchronously);
        var pending = paid.SynchronizePurchasedAsync();
        Check(paid.CanEnter && !pending.IsCompleted, "hanging sync never blocks local entry");
        server.PendingSync.SetResult(signing.Decision(identity, 1, "ACTIVE")); Run(pending); server.PendingSync = null;
        server.SyncResponse = signing.Decision(identity, 2); Run(paid.SynchronizePurchasedAsync());
        Check(paid.CanEnter, "signed revocation does not terminate current purchased process");
        using (var restart = Access(identity, signing, store, server)) Check(!restart.CanEnter && restart.State == DesktopAccessState.Revoked, "signed persisted revocation blocks next launch");
        server.SyncResponse = signing.Decision(identity, 1, "ACTIVE"); Run(paid.SynchronizePurchasedAsync());
        Check(signing.Verifier.VerifyDecision(store.ReadDecision(G1).Envelope!, signing.Verifier.VerifyLicense(signing.License(identity), identity, G1, Enrollment(identity))).Version == 2, "older decision rejected by high watermark");
        server.SyncResponse = signing.Decision(identity, 2, "ACTIVE"); Run(paid.SynchronizePurchasedAsync());
        using (var restart = Access(identity, signing, store, server)) Check(restart.State == DesktopAccessState.Revoked, "equal-version contradictory decision ignored");
        server.SyncResponse = signing.Decision(identity, 3, sku: "YARIZAN-G2"); Run(paid.SynchronizePurchasedAsync());
        using (var restart = Access(identity, signing, store, server)) Check(restart.State == DesktopAccessState.Revoked, "mismatched revocation target ignored");
        string wrongDeviceDecision = signing.Decision(identity, 3).Replace(SigningFixture.DeviceId, SigningFixture.CustomerId);
        Check(Reject(() => signing.Verifier.VerifyDecision(wrongDeviceDecision, signing.Verifier.VerifyLicense(signing.License(identity), identity, G1, Enrollment(identity)))), "wrong-device revocation rejected");
        using (var differentSigner = new SigningFixture())
        {
            server.SyncResponse = differentSigner.Decision(identity, 3); Run(paid.SynchronizePurchasedAsync());
            using var restart = Access(identity, signing, store, server);
            Check(restart.State == DesktopAccessState.Revoked, "fake signing-key revocation rejected");
        }
        server.SyncResponse = signing.Decision(identity, 3).Replace("REVOKED", "ACTIVE"); Run(paid.SynchronizePurchasedAsync());
        Check(paid.CanEnter && signing.Verifier.VerifyDecision(store.ReadDecision(G1).Envelope!, signing.Verifier.VerifyLicense(signing.License(identity), identity, G1, Enrollment(identity))).Version == 2, "forged sync cannot change persisted decision");
        using (var recovering = Access(identity, signing, store, server))
        {
            server.SyncResponse = signing.Decision(identity, 1, "ACTIVE");
            Check(RejectAsync(() => recovering.PickupLicenseAsync()) && !recovering.CanEnter, "stale ACTIVE cannot recover revoked license");
            server.Offline = true;
            Check(RejectAsync(() => recovering.PickupLicenseAsync()) && !recovering.CanEnter, "network failure cannot clear revocation");
            server.Offline = false; server.SyncResponse = signing.Decision(identity, 3, "ACTIVE");
            Run(recovering.PickupLicenseAsync());
            Check(recovering.CanEnter && recovering.IsPurchased, "explicit higher signed ACTIVE decision recovers locally revoked license");
        }
        // Restore authenticated revocation for the separate-process acceptance check below.
        server.SyncResponse = signing.Decision(identity, 4); Run(paid.SynchronizePurchasedAsync());
        var multi = Store("multi");
        foreach (int grade in Enumerable.Range(1, 6)) multi.WriteLicense(new Product(grade), signing.License(identity, grade));
        Check(Enumerable.Range(1, 6).All(g => signing.Verifier.VerifyLicense(multi.ReadLicense(new Product(g)).Envelope!, identity, new Product(g), Enrollment(identity)).Grade == g), "six licenses persist without overwriting");
        multi.WriteLicense(G1, signing.License(identity));
        Check(!Directory.EnumerateFiles(Path.Combine(_root, "multi"), "*.tmp").Any(), "atomic replace leaves no temporary credential");
        File.WriteAllBytes(Path.Combine(_root, "multi", "YARIZAN-G1.license.dat"), [1, 2, 3]);
        using (var corrupt = Access(identity, signing, multi, server)) Check(!corrupt.CanEnter && corrupt.State == DesktopAccessState.InvalidLicense, "corrupt/truncated DPAPI file rejected");
        var invalid = Store("invalid"); invalid.WriteLicense(G1, "{}");
        using (var corrupt = Access(identity, signing, invalid, server)) Check(corrupt.State == DesktopAccessState.InvalidLicense, "malformed protected JSON rejected safely");
        var interrupted = Store("interrupted"); interrupted.WriteLicense(G1, signing.License(identity));
        File.WriteAllBytes(Path.Combine(_root, "interrupted", "YARIZAN-G1.license.dat.abandoned.tmp"), [1, 2]);
        using (var preserved = Access(identity, signing, interrupted, server)) Check(preserved.CanEnter, "interrupted temporary write preserves previously valid license");
        var corruptDecision = Store("corrupt-decision"); corruptDecision.WriteLicense(G1, signing.License(identity));
        File.WriteAllBytes(Path.Combine(_root, "corrupt-decision", "YARIZAN-G1.decision.dat"), [1, 2]);
        using (var denied = Access(identity, signing, corruptDecision, server)) Check(denied.State == DesktopAccessState.InvalidLicense && !denied.CanEnter, "corrupt persisted decision fails closed rather than clearing revocation");
        var pickup = Store("pickup");
        using var activating = Access(identity, signing, pickup, server);
        server.PickupResponse = signing.License(identity);
        Run(activating.PickupLicenseAsync());
        Check(activating.CanEnter && pickup.ReadLicense(G1).Status == StoreReadStatus.Present, "authenticated test pickup verifies then stores paid entitlement");
        server.Offline = true;
        using (var restart = Access(identity, signing, pickup, server)) Check(restart.CanEnter, "paid offline process restart succeeds");
        string publicKeys = Path.Combine(_root, "public-keys.json");
        File.WriteAllText(publicKeys, JsonSerializer.Serialize(new Dictionary<string, string> { ["disposable-test"] = signing.Key.ExportSubjectPublicKeyInfoPem() }));
        Check(ChildSucceeds("--child-paid", Path.Combine(_root, "pickup"), publicKeys), "paid signed store accepted in a new OS process fully offline");
        Check(ChildSucceeds("--child-locked", Path.Combine(_root, "paid"), publicKeys), "persisted revocation enforced in a new OS process");
        var blocked = new DesktopV2Client(new HttpClient(new Handler()), new UnprovisionedDeviceCredentials());
        using var noEnrollment = Access(identity, signing, Store("blocked"), blocked);
        Run(noEnrollment.RefreshTrialStatusAsync());
        Check(noEnrollment.State == DesktopAccessState.EnrollmentRequired && !noEnrollment.CanEnter, "unprovisioned enrollment fails closed without HWID authentication");
    }

    private static void EnrollmentChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var server = new FakeServer(signing, identity) { Offline = true };
        var store = Store("uuid-binding");
        var wrongPayload = signing.LicensePayload(identity); wrongPayload["device_id"] = SigningFixture.CustomerId;
        string wrongLicense = signing.Sign(wrongPayload, SignedArtifactVerifier.LicenseDomain);
        Check(Reject(() => signing.Verifier.VerifyLicense(wrongLicense, identity, G1, Enrollment(identity))),
            "correctly signed different device UUID with identical fingerprint rejected by verifier");
        store.WriteLicense(G1, wrongLicense);
        using (var wrong = Access(identity, signing, store, server))
            Check(!wrong.CanEnter && wrong.State == DesktopAccessState.InvalidLicense, "offline loading rejects same-fingerprint foreign device UUID");
        store.WriteLicense(G1, signing.License(identity));
        using (var missing = new DesktopAccessController(identity, G1, signing.Verifier, store, server))
            Check(!missing.CanEnter && missing.State == DesktopAccessState.EnrollmentRequired,
                "license and online client UUID cannot bootstrap missing independent enrollment");
        var pickupStore = Store("foreign-pickup"); server.Offline = false; server.PickupResponse = wrongLicense;
        using (var pickup = Access(identity, signing, pickupStore, server))
            Check(RejectAsync(() => pickup.PickupLicenseAsync()) && pickupStore.ReadLicense(G1).Status == StoreReadStatus.Missing,
                "foreign UUID signed pickup rejected before persistence");

        using var firstKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        using var secondKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        byte[] firstPublic = firstKey.ExportSubjectPublicKeyInfo(), secondPublic = secondKey.ExportSubjectPublicKeyInfo();
        string firstDigest = Convert.ToHexString(SHA256.HashData(firstPublic));
        string secondDigest = Convert.ToHexString(SHA256.HashData(secondPublic));
        string profileRoot = Path.Combine(_root, "signed-enrollment");
        var enrollmentStore = new FileDeviceEnrollmentStore(profileRoot);
        var provider = new VerifiedLocalDeviceEnrollmentProvider(enrollmentStore, signing.Verifier, identity, () => firstPublic);
        string certificate = signing.Enrollment(identity, firstDigest);
        provider.StoreAuthenticatedEnrollment(certificate);
        Check(provider.ReadVerifiedIdentity()?.DeviceId == SigningFixture.DeviceId, "independent signed profile enrollment verifies after protected persistence");
        var licenseStore = new FileLicenseStore(profileRoot); licenseStore.WriteLicense(G1, signing.License(identity));
        using var http = new HttpClient(new Handler());
        var noOnlineIdentity = new DesktopV2Client(http, new UnprovisionedDeviceCredentials());
        using (var offline = new DesktopAccessController(identity, G1, signing.Verifier, licenseStore, noOnlineIdentity, provider))
        {
            Check(offline.CanEnter && offline.IsPurchased, "paid signed enrollment works offline without any online credential or client UUID");
            Run(offline.SynchronizePurchasedAsync());
            Check(offline.CanEnter, "missing online credential cannot invalidate verified offline enrollment and license");
        }
        var foreignProfile = new VerifiedLocalDeviceEnrollmentProvider(enrollmentStore, signing.Verifier, identity, () => secondPublic);
        Check(Reject(() => foreignProfile.ReadVerifiedIdentity()), "copied enrollment rejected for different profile public key despite identical hardware");
        Check(Reject(() => provider.StoreAuthenticatedEnrollment(certificate.Replace(SigningFixture.DeviceId, SigningFixture.CustomerId))),
            "tampered local enrollment cannot establish a trusted UUID");
        Check(Reject(() => provider.StoreAuthenticatedEnrollment(signing.Enrollment(identity, firstDigest, deviceId: SigningFixture.CustomerId))),
            "same-profile device UUID change requires explicit authenticated recovery");
        using var otherSigner = new SigningFixture();
        Check(Reject(() => signing.Verifier.VerifyEnrollment(otherSigner.Enrollment(identity, firstDigest), identity, firstDigest)),
            "untrusted enrollment signer rejected");
        string secondRoot = Path.Combine(_root, "authorized-profile-b");
        var secondProvider = new VerifiedLocalDeviceEnrollmentProvider(new FileDeviceEnrollmentStore(secondRoot), signing.Verifier, identity, () => secondPublic);
        secondProvider.StoreAuthenticatedEnrollment(signing.Enrollment(identity, secondDigest, profileId: SigningFixture.LicenseId));
        var secondLicenses = new FileLicenseStore(secondRoot); secondLicenses.WriteLicense(G1, signing.License(identity));
        using (var second = new DesktopAccessController(identity, G1, signing.Verifier, secondLicenses, noOnlineIdentity, secondProvider))
            Check(second.CanEnter && secondProvider.ReadVerifiedIdentity()?.DeviceId == provider.ReadVerifiedIdentity()?.DeviceId,
                "backend-authorized distinct profile keys can use the same device entitlement offline (simulated profiles)");
        File.WriteAllBytes(Path.Combine(profileRoot, "device-enrollment.dat"), [1, 2, 3]);
        using (var corrupt = new DesktopAccessController(identity, G1, signing.Verifier, licenseStore, noOnlineIdentity, provider))
            Check(!corrupt.CanEnter, "corrupt independent enrollment fails closed instead of using license UUID");
    }

    private static void ReleasePolicyChecks(SigningFixture signing)
    {
        string pem = signing.Key.ExportSubjectPublicKeyInfoPem();
        string Roots(string kid, string key) => JsonSerializer.Serialize(new Dictionary<string, string> { [kid] = key });
        string Approvals(string kid, string digest) => JsonSerializer.Serialize(new
        { format = "YARIZAN-APPROVED-RELEASE-ROOTS-V2", keys = new Dictionary<string, string> { [kid] = digest } });
        string roots = Roots("release-key-1", pem);
        string approvals = Approvals("release-key-1", CommercialReleasePolicy.PublicKeyFingerprint(pem));
        string config = JsonSerializer.Serialize(new
        {
            format = "YARIZAN-ACTIVATION-CONFIG-V2", api_base = DesktopV2Client.ApiBase.AbsoluteUri,
            enrollment_protocol = "YariZan-Device-Enrollment-V2", additional_profile_enrollment = true
        });
        CommercialReleasePolicy.ValidateConfiguration(roots, approvals, config);
        Check(true, "public P-256 root and matching approval fingerprint validate structurally with disposable unit inputs");
        Check(Reject(() => CommercialReleasePolicy.ReadPublicRoots("{}")), "empty release roots rejected");
        Check(Reject(() => CommercialReleasePolicy.ReadPublicRoots(Roots("release-key-1", "not PEM"))), "malformed verification root rejected");
        Check(Reject(() => CommercialReleasePolicy.ReadPublicRoots(Roots("release-key-1", signing.Key.ExportPkcs8PrivateKeyPem()))), "private signing key forbidden in verification-root input");
        Check(Reject(() => CommercialReleasePolicy.ReadPublicRoots(Roots("release-key-1", pem + signing.Key.ExportPkcs8PrivateKeyPem()))), "private trailing PEM block forbidden");
        using var p384 = ECDsa.Create(ECCurve.NamedCurves.nistP384);
        Check(Reject(() => CommercialReleasePolicy.ReadPublicRoots(Roots("release-key-1", p384.ExportSubjectPublicKeyInfoPem()))), "non-P256 public root forbidden");
        Check(Reject(() => CommercialReleasePolicy.ValidateConfiguration(Roots("disposable-test", pem), Approvals("disposable-test", CommercialReleasePolicy.PublicKeyFingerprint(pem)), config)),
            "disposable test root rejected even with matching approval input");
        Check(Reject(() => CommercialReleasePolicy.ValidateConfiguration(roots, Approvals("release-key-1", new string('0', 64)), config)),
            "renamed disposable or substituted key fails pinned reviewed fingerprint check");
        Check(Reject(() => CommercialReleasePolicy.ValidateConfiguration(roots, "{\"format\":\"YARIZAN-APPROVED-RELEASE-ROOTS-V2\",\"keys\":{}}", config)),
            "repository with no approved roots cannot authorize an accidental test key");
        Check(Reject(() => CommercialReleasePolicy.ValidateConfiguration(roots, approvals, "{}")), "missing activation configuration rejected");
        Check(Reject(() => CommercialReleasePolicy.ValidateConfiguration(roots, approvals, config.Replace("https://yarizan.oarnova.games/api/v2/", "http://localhost/"))),
            "unreviewed activation host rejected");
        Check(Reject(() => CommercialReleasePolicy.EnsureCommercialRelease(roots, approvals, config)),
            "commercial release remains blocked with structurally valid inputs until production enrollment integration exists");
    }

    private static (int Code, string Output) Tool(string executable, params string[] arguments)
    {
        var info = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = FindRepo() };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        using var child = Process.Start(info)!;
        var output = child.StandardOutput.ReadToEndAsync(); var error = child.StandardError.ReadToEndAsync();
        if (!child.WaitForExit(120000)) { child.Kill(entireProcessTree: true); throw new TimeoutException("Release gate check timed out."); }
        return (child.ExitCode, output.GetAwaiter().GetResult() + error.GetAwaiter().GetResult());
    }

    private static void ReleaseIntegrationChecks(SigningFixture signing)
    {
        string repo = FindRepo();
        string validator = Path.Combine(repo, "src", "YariZan.ReleaseCheck", "bin", "Release", "net9.0-windows", "YariZan.ReleaseCheck.dll");
        string fixture = Path.Combine(_root, "release-prerequisites"); Directory.CreateDirectory(fixture);
        var missing = Tool("dotnet", validator, "--commercial", fixture);
        Check(missing.Code != 0 && missing.Output.Contains("V2_PUBLIC_ROOTS_MISSING"), "commercial CLI missing-root gate fails clearly");
        Directory.CreateDirectory(Path.Combine(fixture, "secrets")); Directory.CreateDirectory(Path.Combine(fixture, "release"));
        string rootsPath = Path.Combine(fixture, "secrets", "v2-license-public-keys.json");
        File.WriteAllText(rootsPath, JsonSerializer.Serialize(new Dictionary<string, string> { ["renamed-release-key"] = signing.Key.ExportSubjectPublicKeyInfoPem() }));
        File.WriteAllText(Path.Combine(fixture, "release", "v2-approved-public-roots.json"), "{\"format\":\"YARIZAN-APPROVED-RELEASE-ROOTS-V2\",\"keys\":{}}");
        File.WriteAllText(Path.Combine(fixture, "secrets", "v2-activation.json"), "{}");
        var unreviewed = Tool("dotnet", validator, "--commercial", fixture);
        Check(unreviewed.Code != 0 && unreviewed.Output.Contains("V2_ROOT_NOT_REVIEWED"), "commercial CLI rejects renamed disposable root against repository approval list");
        File.WriteAllText(rootsPath, JsonSerializer.Serialize(new Dictionary<string, string> { ["release-key"] = signing.Key.ExportPkcs8PrivateKeyPem() }));
        var privateKey = Tool("dotnet", validator, "--public-roots-only", rootsPath);
        Check(privateKey.Code != 0 && privateKey.Output.Contains("V2_PUBLIC_SPKI_REQUIRED"), "build public-root input validator refuses disposable private PEM");
        File.Delete(rootsPath); // Only the disposable negative fixture, never a real signing key.
        var build = Tool("dotnet", "build", Path.Combine(repo, "src", "YariZan.App", "YariZan.App.csproj"), "-c", "Release", "--no-restore",
            "-p:CommercialRelease=true", "-p:IncludeGameBundle=false", "-p:IncludeGameKey=false", "--nologo");
        Check(build.Code != 0 && build.Output.Contains("V2_"), "actual commercial MSBuild target refuses unresolved release prerequisites");
        var publish = Tool("dotnet", "publish", Path.Combine(repo, "src", "YariZan.App", "YariZan.App.csproj"), "-c", "Release", "--no-restore",
            "-p:IncludeGameBundle=false", "-p:IncludeGameKey=false", "-o", Path.Combine(_root, "blocked-publish"), "--nologo");
        Check(publish.Code != 0 && publish.Output.Contains("V2_") && !File.Exists(Path.Combine(_root, "blocked-publish", "YariZan.exe")),
            "ordinary app publish cannot silently create commercial output without prerequisite gate");
        var fixturePublish = Tool("dotnet", "publish", Path.Combine(repo, "src", "YariZan.App", "YariZan.App.csproj"), "-c", "Release", "--no-restore",
            "-p:FixtureOnlyBuild=true", "-p:IncludeGameBundle=false", "-p:IncludeGameKey=false", "-o", Path.Combine(_root, "fixture-publish"), "--nologo");
        Check(fixturePublish.Code == 0 && File.Exists(Path.Combine(_root, "fixture-publish", "YariZan.exe")),
            "explicit fixture-only app publish works without production configuration");
        var combined = Tool("dotnet", "build", Path.Combine(repo, "src", "YariZan.App", "YariZan.App.csproj"), "-c", "Release", "--no-restore",
            "-p:CommercialRelease=true", "-p:FixtureOnlyBuild=true", "-p:IncludeGameBundle=false", "-p:IncludeGameKey=false", "--nologo");
        Check(combined.Code != 0 && combined.Output.Contains("FixtureOnlyBuild cannot be combined"), "fixture exemption cannot be combined with commercial release");
        var installer = Tool("cmd.exe", "/d", "/c", "build-installer.bat", "--noninteractive");
        Check(installer.Code != 0 && installer.Output.Contains("V2 commercial release prerequisites are not satisfied") && !installer.Output.Contains("[Step 1/5]"),
            "installer preflight stops before game packing or installer compilation");
    }

    private static void TrialChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var server = new FakeServer(signing, identity); var store = Store("trial");
        using var first = Access(identity, signing, store, server);
        Run(first.RefreshTrialStatusAsync()); Run(first.RefreshTrialStatusAsync());
        Check(server.Used() == 0 && first.State == DesktopAccessState.TrialAvailable, "status lookups consume zero entries");
        server.LoseNextResponse = true;
        Check(RejectAsync(() => first.StartTrialAsync()) && !first.CanEnter && server.Used() == 1, "lost response consumes once but never grants unverified access");
        var lostRequest = server.LastRequest;
        Run(first.StartTrialAsync());
        Check(first.CanEnter && server.LastRequest == lostRequest && server.Used() == 1, "same nonce and process retry idempotent");
        server.PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously);
        var upgrade = first.PickupLicenseAsync();
        Check(first.CanEnter && first.State == DesktopAccessState.TrialStarted && !upgrade.IsCompleted,
            "pending optional paid pickup cannot suspend an active trial");
        server.PendingPickup.SetException(new HttpRequestException("Disconnected during optional upgrade"));
        Check(RejectAsync(() => upgrade) && first.CanEnter && first.State == DesktopAccessState.TrialStarted,
            "network failure during optional paid pickup preserves trial process access");
        server.PendingPickup = null;
        int requests = server.StartRequests + server.StatusRequests;
        server.Offline = true;
        // Deterministic elapsed-time model; controller has no clock/expiry dependency.
        foreach (int minutes in new[] { 1, 61, 1440, 100000 })
        {
            Run(first.RefreshTrialStatusAsync()); Run(first.StartTrialAsync()); Run(first.SynchronizePurchasedAsync());
            Check(first.CanEnter && requests == server.StartRequests + server.StatusRequests, "active offline trial/navigation requires zero requests at modeled minute " + minutes);
        }
        Check(!Directory.Exists(Path.Combine(_root, "trial")), "trial grant never stored on disk");
        string publicKeys = Path.Combine(_root, "trial-public-keys.json");
        File.WriteAllText(publicKeys, JsonSerializer.Serialize(new Dictionary<string, string> { ["disposable-test"] = signing.Key.ExportSubjectPublicKeyInfoPem() }));
        Check(ChildSucceeds("--child-locked", Path.Combine(_root, "trial"), publicKeys), "another OS process cannot restore active trial grant");
        first.Dispose(); Check(!first.CanEnter && first.State == DesktopAccessState.Closed, "full session shutdown clears trial");
        using var second = Access(identity, signing, store, server);
        Check(!second.CanEnter, "new process controller cannot restore trial");
        Check(RejectAsync(() => second.StartTrialAsync()) && !second.CanEnter, "restarted trial requires online start");
        server.Offline = false; Run(second.StartTrialAsync());
        Check(second.CanEnter && second.TrialRemaining == 0 && server.Used() == 2 && server.LastRequest != lostRequest, "second distinct start permitted with fresh process and nonce");
        using var third = Access(identity, signing, store, server);
        Check(RejectAsync(() => third.StartTrialAsync()) && third.State == DesktopAccessState.TrialExhausted && server.Used() == 2, "third distinct start denied by test server");
        using var grade2 = Access(identity, signing, store, server, 2); Run(grade2.StartTrialAsync());
        Check(grade2.CanEnter && server.Used("YARIZAN-G2") == 1, "trial counters are independent by product");
        var concurrentServer = new FakeServer(signing, identity);
        using var same = Access(identity, signing, store, concurrentServer);
        Run(Task.WhenAll(same.StartTrialAsync(), same.StartTrialAsync()));
        Check(concurrentServer.Used() == 1 && concurrentServer.StartRequests == 1, "concurrent UI starts consume once");
        var parallelServer = new FakeServer(signing, identity);
        int successes = 0;
        Parallel.For(0, 10, _ => { using var c = Access(identity, signing, store, parallelServer); try { Run(c.StartTrialAsync()); Interlocked.Increment(ref successes); } catch (TrialExhaustedException) { } });
        Check(successes == 2 && parallelServer.Used() == 2, "ten concurrent distinct starts cannot exceed two in transactional fake");
        var request = lostRequest!;
        Check(Reject(() => signing.Verifier.VerifyTrial(signing.Trial(request), request with { ProcessSessionId = Guid.NewGuid().ToString("D") }, G1)), "trial grant replay into new process rejected");
        Check(Reject(() => signing.Verifier.VerifyTrial(signing.Trial(request), request, new Product(2))), "trial G1 grant cannot unlock G2");
        var invalidServer = new FakeServer(signing, identity) { InvalidTrial = true };
        using var invalid = Access(identity, signing, store, invalidServer);
        Check(RejectAsync(() => invalid.StartTrialAsync()) && !invalid.CanEnter, "tampered start grant never authorizes");
        using var canceled = Access(identity, signing, store, new FakeServer(signing, identity));
        using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
        Check(RejectAsync(() => canceled.StartTrialAsync(cancellation.Token)) && !canceled.CanEnter, "cancelled start cannot authorize");
    }

    private static void NetworkChecks()
    {
        var handler = new Handler(); using var http = new HttpClient(handler);
        var client = new DesktopV2Client(http, new Credentials());
        Check(Run(client.GetTrialStatusAsync(G1, default)) == 2 && handler.LastUri == "https://yarizan.oarnova.games/api/v2/desktop/trials/YARIZAN-G1/status", "V2 status route and enrolled bearer boundary");
        handler.Body = new string('x', 32769);
        Check(RejectAsync(() => client.GetTrialStatusAsync(G1, default)), "oversized HTTP payload bounded");
        handler.Body = "{\"remaining\":3}";
        Check(RejectAsync(() => client.GetTrialStatusAsync(G1, default)), "invalid HTTP count rejected");
        handler.Body = "{\"error\":{\"code\":\"TRIAL_EXHAUSTED\"}}"; handler.Status = HttpStatusCode.Forbidden;
        Check(RejectAsync(() => client.GetTrialStatusAsync(G1, default)), "structured business failure rejected");
        handler.Status = HttpStatusCode.Redirect;
        Check(RejectAsync(() => client.GetTrialStatusAsync(G1, default)), "redirect rejected");
        handler.Delay = true;
        var shortClient = new DesktopV2Client(http, new Credentials(), TimeSpan.FromMilliseconds(30));
        Check(RejectAsync(() => shortClient.GetTrialStatusAsync(G1, default)), "explicit transport timeout enforced");
        using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
        Check(RejectAsync(() => client.GetTrialStatusAsync(G1, cancellation.Token)), "transport supports cancellation");
    }

    private static void WindowsKeyChecks(IDeviceIdentity identity)
    {
        string name = "YariZan.DisposableChecks." + Guid.NewGuid().ToString("N");
        try
        {
            byte[] publicKey;
            using (var key = new CngDeviceKeyStore(name, preferTpm: false))
            {
                publicKey = key.ExportPublicKey();
                using var verifier = ECDsa.Create(); verifier.ImportSubjectPublicKeyInfo(publicKey, out _);
                var signature = key.SignChallenge("test-challenge", new string('A', 64), identity);
                Check(signature.Length == 64 && key.Assurance == "SOFTWARE", "user-scoped software CNG challenge signing works");
                using var transcript = StrictJson.Parse(JsonSerializer.Serialize(new
                {
                    challenge_id = "test-challenge", nonce = new string('A', 64), fingerprint_version = identity.FingerprintVersion,
                    fingerprint_digest = identity.FingerprintDigest, device_public_key = Base64Url.Encode(publicKey)
                }));
                Check(verifier.VerifyData(Encoding.UTF8.GetBytes("YariZan-Device-Challenge-V2\n" + CanonicalJson.Serialize(transcript.RootElement)), signature,
                    HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation), "challenge signature binds challenge, fingerprint and public key");
                using var raw = CngKey.Open(name, CngProvider.MicrosoftSoftwareKeyStorageProvider);
                Check(Reject(() => raw.Export(CngKeyBlobFormat.Pkcs8PrivateBlob)) && !raw.IsMachineKey, "CNG private export denied and key is user scoped");
            }
            using var reopened = new CngDeviceKeyStore(name, preferTpm: false);
            Check(reopened.ExportPublicKey().SequenceEqual(publicKey), "persisted software CNG key reopens unchanged");
            Check(ChildSucceeds("--child-key", name, Base64Url.Encode(publicKey)), "CNG software key persisted across OS processes for same Windows user");
        }
        finally
        {
            if (CngKey.Exists(name, CngProvider.MicrosoftSoftwareKeyStorageProvider))
            { using var raw = CngKey.Open(name, CngProvider.MicrosoftSoftwareKeyStorageProvider); raw.Delete(); }
            using var state = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(CngDeviceKeyStore.ProviderRegistryPath, writable: true);
            state?.DeleteValue(CngDeviceKeyStore.ProviderValueName(name), throwOnMissingValue: false);
        }
        using var user = System.Security.Principal.WindowsIdentity.GetCurrent();
        if (!GetTokenInformation(user.AccessToken, 20, out int elevated, sizeof(int), out _))
            throw new System.ComponentModel.Win32Exception(System.Runtime.InteropServices.Marshal.GetLastWin32Error());
        Console.WriteLine("EVIDENCE TokenElevation.TokenIsElevated=" + elevated
            + "; AdministratorsGroupEnabled=" + new System.Security.Principal.WindowsPrincipal(user).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator));
        string probeName = "YariZan.DisposableChecks." + Guid.NewGuid().ToString("N");
        string provider;
        using (var probe = new CngDeviceKeyStore(probeName))
        {
            provider = probe.Assurance;
            Check(probe.ExportPublicKey().Length > 0 && probe.SignChallenge("test", new string('A', 64), identity).Length == 64, "TPM-preferred provider signs with safe software fallback");
            Console.WriteLine("EVIDENCE TPM-preferred provider selected: " + provider);
            Check(ChildSucceeds("--child-key", probeName, Base64Url.Encode(probe.ExportPublicKey())), "TPM-preferred key reopens in separate process with the same Windows user");
        }
        using var rawProbe = CngKey.Open(probeName, provider == "TPM" ? new CngProvider("Microsoft Platform Crypto Provider") : CngProvider.MicrosoftSoftwareKeyStorageProvider);
        Check(!rawProbe.IsMachineKey && Reject(() => rawProbe.Export(CngKeyBlobFormat.Pkcs8PrivateBlob)), "TPM-preferred key denies private export and unsafe machine scope");
        rawProbe.Delete();
        Check(Reject(() => new CngDeviceKeyStore(probeName)), "recorded provider/key loss fails closed instead of generating replacement");
        using var probeState = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(CngDeviceKeyStore.ProviderRegistryPath, writable: true);
        probeState?.DeleteValue(CngDeviceKeyStore.ProviderValueName(probeName), throwOnMissingValue: false);
    }

    [System.Runtime.InteropServices.DllImport("advapi32.dll", SetLastError = true)]
    [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
    private static extern bool GetTokenInformation(Microsoft.Win32.SafeHandles.SafeAccessTokenHandle token,
        int informationClass, out int elevation, int length, out int returnedLength);

    private static void HttpContractChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var server = new FakeServer(signing, identity);
        using var http = new HttpClient(new ContractHandler(server));
        var client = new DesktopV2Client(http, new Credentials());
        var store = Store("http-contract");
        using var access = Access(identity, signing, store, client);
        Run(access.RefreshTrialStatusAsync());
        Check(server.Used() == 0, "HTTP V2 status contract consumes zero entries");
        server.LoseNextResponse = true;
        Check(RejectAsync(() => access.StartTrialAsync()) && server.Used() == 1, "HTTP lost start response retains spent nonce");
        Run(access.StartTrialAsync());
        Check(access.CanEnter && server.Used() == 1, "HTTP retry DTO matches original signed start contract");
        server.Offline = true; int calls = server.StartRequests + server.StatusRequests;
        Run(access.StartTrialAsync()); Run(access.RefreshTrialStatusAsync());
        Check(access.CanEnter && calls == server.StartRequests + server.StatusRequests, "HTTP active trial needs no transport after disconnect");
        server.Offline = false; Run(access.PickupLicenseAsync());
        Check(access.IsPurchased && store.ReadLicense(G1).Status == StoreReadStatus.Present, "HTTP signed pickup verifies and persists");
        server.SyncResponse = signing.Decision(identity, 1); Run(access.SynchronizePurchasedAsync());
        using var next = Access(identity, signing, store, client);
        Check(access.CanEnter && next.State == DesktopAccessState.Revoked, "HTTP signed sync applies only to next process access");
    }

    private static void CrossLanguage(SigningFixture signing, IDeviceIdentity identity)
    {
        string fixture = Path.Combine(_root, "interop.json");
        string unicode = "{\"z\":\"یاریزان\\u000f\\n😀\u2028\",\"a\":1,\"arr\":[true,null,\"/\\\\\\\"\"]}";
        using var u = StrictJson.Parse(unicode);
        string envelope = signing.License(identity);
        File.WriteAllText(fixture, JsonSerializer.Serialize(new { envelope, publicKey = signing.Key.ExportSubjectPublicKeyInfoPem(), unicode, canonical = CanonicalJson.Serialize(u.RootElement) }));
        var start = new ProcessStartInfo("node") { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, CreateNoWindow = true };
        start.ArgumentList.Add(Path.Combine(FindRepo(), "tests", "V2Checks", "interop.mjs")); start.ArgumentList.Add(fixture);
        using var process = Process.Start(start)!;
        string output = process.StandardOutput.ReadToEnd(); string error = process.StandardError.ReadToEnd(); process.WaitForExit();
        if (process.ExitCode != 0) throw new Exception(error);
        using var result = StrictJson.Parse(output);
        Check(result.RootElement.GetProperty("verified").GetBoolean(), ".NET license P1363 signature verified in Node.js");
        Check(result.RootElement.GetProperty("canonical_matches").GetBoolean(), "RFC8785 subset unicode/control/safe-integer bytes match Node.js");
        var nodeVerifier = new SignedArtifactVerifier(new Dictionary<string, string> { ["disposable-test"] = result.RootElement.GetProperty("publicKey").GetString()! });
        Check(nodeVerifier.VerifyLicense(result.RootElement.GetProperty("envelope").GetRawText(), identity, G1, Enrollment(identity)).Grade == 1, "Node.js disposable signed license verifies in .NET");
    }

    private static string FindRepo()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, ".git"))) dir = dir.Parent;
        return dir?.FullName ?? throw new Exception("Repository not found");
    }

    private static void Pump(Func<bool> done)
    {
        var watch = Stopwatch.StartNew();
        while (!done() && watch.Elapsed < TimeSpan.FromSeconds(15))
        {
            var frame = new DispatcherFrame(); Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => frame.Continue = false));
            Dispatcher.PushFrame(frame); Thread.Sleep(5);
        }
        if (!done()) throw new Exception("WPF timeout");
    }
    private static void UiChecks(SigningFixture signing, IDeviceIdentity identity, string screenshots, string? syntheticGame)
    {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(Dispatcher.CurrentDispatcher));
        app.Resources.MergedDictionaries.Add(new ResourceDictionary { Source = new Uri("/YariZan;component/Resources/Theme.xaml", UriKind.Relative) });
        var store = Store("ui"); var server = new FakeServer(signing, identity);
        using var access = Access(identity, signing, store, server);
        byte[] gameKey = RandomNumberGenerator.GetBytes(32);
        var window = new MainWindow(access, () => gameKey.ToArray()) { ShowInTaskbar = false, Left = -32000, Top = -32000 };
        window.Show(); window.ShowLock();
        var host = (ContentControl)window.FindName("PageHost");
        Pump(() => access.State == DesktopAccessState.TrialAvailable);
        var page = (LockPage)host.Content;
        Check(((TextBox)page.FindName("HwidText")).Text == identity.Username && server.Used() == 0, "WPF Lock displays common username without spending trial");
        ActivationUiChecks(signing, identity, screenshots);
        Save(page, screenshots, "lock-v2.png");
        ((Button)page.FindName("TrialButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Pump(() => host.Content is InfoPage);
        Check(access.CanEnter && server.Used() == 1, "explicit WPF Start Trial opens Information");
        server.Offline = true; int requests = server.StatusRequests + server.StartRequests;
        window.ShowGames(); Pump(() => host.Content is GamesBookPage);
        window.ShowCover(false); window.ShowInfo(); window.ShowGames();
        Check(access.CanEnter && requests == server.StatusRequests + server.StartRequests, "actual WPF offline navigation never reauthorizes trial");
        Check(!typeof(MainWindow).GetFields(BindingFlags.NonPublic | BindingFlags.Instance).Any(f => f.FieldType == typeof(DispatcherTimer)), "MainWindow contains no periodic access timer");
        List<Process>? ownedGames = null;
        string[] temporaryDirectories = [];
        if (syntheticGame is not null)
        {
            Directory.CreateDirectory(AppPaths.GamesEncryptedDir);
            string encrypted = AppPaths.ResolveGameFile("v2-synthetic.dat");
            GameCrypto.Encrypt(gameKey, syntheticGame, encrypted);
            var launch = typeof(MainWindow).GetMethod("OnGameLaunch", BindingFlags.Instance | BindingFlags.NonPublic)!;
            bool Launching() => (bool)typeof(MainWindow).GetField("_launching", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(window)!;
            for (int i = 1; i <= 2; i++)
            {
                launch.Invoke(window, new object?[] { null, new GameEntry { Grade = 1, Name = "synthetic-" + i, EncryptedFile = "v2-synthetic.dat" } });
                Pump(() => !Launching());
            }
            var launcher = (GameLauncher)typeof(MainWindow).GetField("_launcher", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(window)!;
            ownedGames = ((List<Process>)typeof(GameLauncher).GetField("_processes", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(launcher)!).ToList();
            temporaryDirectories = ownedGames.Select(p => p.StartInfo.WorkingDirectory).ToArray();
            Check(ownedGames.Count == 2 && ownedGames.All(p => !p.HasExited) && requests == server.StartRequests + server.StatusRequests,
                "actual WPF trial launches two encrypted synthetic games while transport is disconnected with zero reauthorization");
            Check(((UIElement)window.FindName("LoadingOverlay")).Visibility == Visibility.Collapsed,
                "WPF loading overlay restored after synthetic game launches");
        }
        window.Close(); Check(!access.CanEnter, "WPF window shutdown ends trial process access");
        if (ownedGames is not null) Check(temporaryDirectories.All(d => !Directory.Exists(d)), "WPF shutdown cleans both decrypted synthetic game directories");
        using var restart = Access(identity, signing, store, server);
        Check(!restart.CanEnter, "WPF restart has no retained trial");
        var paidStore = Store("ui-paid"); paidStore.WriteLicense(G1, signing.License(identity));
        using var paid = Access(identity, signing, paidStore, server);
        var paidWindow = new MainWindow(paid) { ShowInTaskbar = false, Left = -32000, Top = -32000 }; paidWindow.Show(); paidWindow.ShowInfo();
        Check(((ContentControl)paidWindow.FindName("PageHost")).Content is InfoPage && paid.CanEnter, "WPF purchased entry succeeds offline");
        paidWindow.Close(); app.Shutdown();
    }
    private static void Save(UserControl page, string root, string name, int width = 1200, int height = 740)
    {
        // Snapshot the settled view; off-screen test HWNDs need not advance composition animations.
        page.BeginAnimation(UIElement.OpacityProperty, null); page.Opacity = 1;
        page.RenderTransform = Transform.Identity;
        Directory.CreateDirectory(root); page.Measure(new Size(width, height)); page.Arrange(new Rect(0, 0, width, height)); page.UpdateLayout();
        var bitmap = new RenderTargetBitmap(width, height, 96, 96, PixelFormats.Pbgra32); bitmap.Render(page);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var file = File.Create(Path.Combine(root, name)); encoder.Save(file);
    }
    private sealed class Credentials : IDeviceCredentialProvider
    { public string? DeviceId => SigningFixture.DeviceId; public Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation) => Task.FromResult("test-only-enrolled-token"); }
    private sealed class Handler : HttpMessageHandler
    {
        public string Body = "{\"remaining\":2}"; public HttpStatusCode Status = HttpStatusCode.OK; public bool Delay; public string? LastUri;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
        {
            LastUri = request.RequestUri!.ToString();
            if (Delay) await Task.Delay(Timeout.Infinite, cancellation);
            return new(Status) { Content = new StringContent(Body) };
        }
    }
    private sealed class ContractHandler(FakeServer server) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
        {
            if (request.Headers.Authorization?.Parameter != "test-only-enrolled-token") throw new Exception("Missing device proof");
            string route = request.RequestUri!.AbsolutePath;
            object? body = null;
            string? signedBody = null;
            if (route.EndsWith("/status")) body = new { remaining = await server.GetTrialStatusAsync(G1, cancellation) };
            else
            {
                using var dto = StrictJson.Parse(await request.Content!.ReadAsStringAsync(cancellation));
                var p = dto.RootElement;
                if (route.EndsWith("/start"))
                {
                    StrictJson.Fields(p, "device_id", "client_nonce", "client_process_session_id");
                    var start = new TrialStartRequest(p.GetProperty("device_id").GetString()!, G1.Sku, p.GetProperty("client_nonce").GetString()!, p.GetProperty("client_process_session_id").GetString()!);
                    var response = await server.StartTrialAsync(start, cancellation);
                    using var grant = StrictJson.Parse(response.Grant);
                    body = new { grant = grant.RootElement.Clone(), remaining = response.Remaining, server_time = response.ServerTime };
                }
                else if (route.EndsWith("/pickup"))
                {
                    StrictJson.Fields(p, "sku");
                    signedBody = await server.PickupAsync(G1, cancellation);
                }
                else if (route.EndsWith("/activation-codes/redeem"))
                {
                    StrictJson.Fields(p, "activation_code", "device_id", "sku", "request_id");
                    try
                    {
                        signedBody = await server.RedeemAsync(new(p.GetProperty("activation_code").GetString()!,
                            p.GetProperty("device_id").GetString()!, p.GetProperty("sku").GetString()!, p.GetProperty("request_id").GetString()!), cancellation);
                    }
                    catch (V2ApiException ex)
                    {
                        return new(ex.Status ?? HttpStatusCode.BadRequest) { Content = new StringContent(JsonSerializer.Serialize(new { error = new { code = ex.Code } })) };
                    }
                }
                else if (route.EndsWith("/sync"))
                {
                    StrictJson.Fields(p, "license_id", "sku");
                    signedBody = server.SyncResponse;
                }
                else throw new Exception("Unexpected route");
            }
            return new(HttpStatusCode.OK) { Content = new StringContent(signedBody ?? JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };
        }
    }
}
