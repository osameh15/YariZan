using YariZan.Core.V2;
using YariZan.Core;
using YariZan.App.Services;
using YariZan.App.Views;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using System.Net.Http;
using System.IO;

internal static partial class Program
{
    private static void StandaloneUiChecks(SigningFixture signing, DeviceIdentityV2 identity)
    {
        var app = new Application { ShutdownMode = ShutdownMode.OnExplicitShutdown };
        SynchronizationContext.SetSynchronizationContext(new DispatcherSynchronizationContext(Dispatcher.CurrentDispatcher));
        app.Resources.MergedDictionaries.Add(new ResourceDictionary { Source = new Uri("/YariZan;component/Resources/Theme.xaml", UriKind.Relative) });
        var product = new Product("YARIZAN-S-NUMBER-BUILDER");
        var server = new FakeServer(signing, identity);
        using var access = new DesktopAccessController(identity, product, signing.Verifier, Store("standalone-ui"), server, new TestEnrollmentProvider(Enrollment(identity)));
        using var activation = UiCoordinator(access);
        var manifest = new GameManifest { SelectedGrade = 0, ProductSku = product.Sku, ProductTitle = "عددساز کوچولو" };
        var window = new MainWindow(access, activation: activation, library: new GameLibrary(manifest));
        Check(window.Width == Math.Min(400, SystemParameters.WorkArea.Width - 32)
            && window.Height == Math.Min(400, SystemParameters.WorkArea.Height - 32), "Standalone splash window is 400 by 400 logical pixels");
        window.ShowInTaskbar = false; window.AdaptiveWindowSize = false;
        window.Left = window.Top = -32000; window.Width = 860; window.Height = 800;
        var shown = new List<UserControl>();
        window.PageShown += (_, page) => shown.Add(page);
        var clock = Stopwatch.StartNew();
        try
        {
            window.Show();
            Pump(() => shown.Count > 0);
            Check(shown[0] is StudioSplashPage, "Standalone first screen is OAR NOVA Games splash");
            Pump(() => Page(window) is LockPage);
            Check(clock.Elapsed >= TimeSpan.FromMilliseconds(1900), "Studio splash remains visible for about two seconds");
            var page = (LockPage)Page(window)!;
            Check(((TextBlock)page.FindName("ActivationTitle")).Text.Contains("عددساز کوچولو"), "Activation identifies the independent game");
            Check(((Button)page.FindName("TrialButton")).Content.ToString() == "آزمایش نسخه", "Independent activation exposes the trial action");
            Check(((Button)page.FindName("BackButton")).Visibility == Visibility.Collapsed, "Independent activation never offers the grade book navigation");
            Check(window.IsCompact, "Independent activation uses the compact G1 window layout");
        }
        finally { window.Close(); app.Shutdown(); }
    }

    private static void StandaloneChecks(SigningFixture signing, DeviceIdentityV2 identity)
    {
        var product = new Product("YARIZAN-S-NUMBER-BUILDER");
        Check(product.Grade == 0 && product.IsStandalone, "Standalone identity is outside the six grades");
        Check(AppProduct.Resolve(new GameManifest { SelectedGrade = 1, ProductSku = product.Sku }).Sku == G1.Sku,
            "Editable manifest cannot select a different product identity for a grade executable");
        Check(Reject(() => AppProduct.Resolve(new GameManifest { SelectedGrade = 0, ProductSku = product.Sku })),
            "A grade executable cannot accept a standalone grade-zero manifest");
        var master = System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        var gameKey = ProductGameKey.Derive(master, product);
        var otherKey = ProductGameKey.Derive(master, new Product("YARIZAN-S-OTHER-GAME"));
        var source = Path.Combine(_root, "standalone-fixture.exe");
        var cipher = Path.Combine(_root, "standalone-fixture.dat");
        byte[] original = "standalone game fixture"u8.ToArray();
        File.WriteAllBytes(source, original);
        GameCrypto.Encrypt(gameKey, source, cipher);
        Check(GameCrypto.Decrypt(gameKey, cipher).SequenceEqual(original), "Standalone product-scoped game key decrypts its own bundle");
        Check(Reject(() => GameCrypto.Decrypt(master, cipher)), "Copying standalone ciphertext into a grade bundle cannot use the grade game key");
        Check(Reject(() => GameCrypto.Decrypt(otherKey, cipher)), "Another standalone product cannot decrypt this game's bundle");
        Array.Clear(master); Array.Clear(gameKey); Array.Clear(otherKey);
        Check(Reject(() => new Product("YARIZAN-G0")), "No invented grade zero SKU");
        Check(Reject(() => new Product("YARIZAN-S-../G1")), "Standalone SKU cannot escape the per-product store");
        var payload = signing.LicensePayload(identity);
        payload["sku"] = product.Sku;
        payload["grade"] = 0;
        var license = signing.Sign(payload, SignedArtifactVerifier.LicenseDomain);
        var store = Store("standalone");
        store.WriteLicense(product, license);
        var startupServer = new FakeServer(signing, identity);
        using (var startup = new DesktopAccessController(identity, product, signing.Verifier, store, startupServer,
            new TestEnrollmentProvider(Enrollment(identity)), deferLocalLicenseRead: true))
        {
            Check(!startup.IsPurchased, "Standalone license verification can be deferred until the splash is visible");
            Run(startup.VerifyStartupLicenseAsync());
            Check(startup.IsPurchased, "Splash startup verification accepts the valid saved standalone license");
            Check(startupServer.SyncRequests + startupServer.PickupRequests + startupServer.StatusRequests == 0,
                "Splash license verification works offline without server requests");
        }
        Check(store.ReadLicense(G1).Status == StoreReadStatus.Missing, "Standalone license never occupies the G1 slot");
        Check(Reject(() => signing.Verifier.VerifyLicense(license, identity, G1, Enrollment(identity))), "Standalone paid license rejected by G1");
        Check(Reject(() => signing.Verifier.VerifyLicense(signing.License(identity), identity, product, Enrollment(identity))), "G1 paid license rejected by standalone game");
        var server = new FakeServer(signing, identity);
        using (var paid = new DesktopAccessController(identity, product, signing.Verifier, store, server, new TestEnrollmentProvider(Enrollment(identity))))
        {
            Check(paid.IsPurchased && paid.CanEnter, "Standalone signed paid license enables offline play");
            using var activation = new PaidActivationCoordinator(paid);
            Check(!activation.HasPendingIntent, "Standalone activation coordinator uses its own SKU");
        }
        for (int attempt = 0; attempt < 3; attempt++)
        {
            using var trial = new DesktopAccessController(identity, product, signing.Verifier, Store("standalone-trial"), server, new TestEnrollmentProvider(Enrollment(identity)));
            if (attempt < 2)
            {
                Run(trial.StartTrialAsync());
                Check(trial.CanEnter && trial.TrialRemaining == 1 - attempt, "Standalone signed trial starts " + (attempt + 1));
                Run(trial.StartTrialAsync());
                Check(server.Used(product.Sku) == attempt + 1, "Same process cannot consume another standalone trial");
            }
            else Check(RejectAsync(() => trial.StartTrialAsync()) && !trial.CanEnter, "Third standalone trial is refused");
        }
        Check(server.Used(G1.Sku) == 0, "Standalone trials do not consume grade trials");
        var transportServer = new FakeServer(signing, identity) { EntitlementSku = product.Sku, EntitlementState = "ACTIVE", PickupResponse = license,
            RedemptionSku = product.Sku, RedemptionResponse = license };
        using var http = new HttpClient(new ContractHandler(transportServer));
        var client = new DesktopV2Client(http, new Credentials());
        using (var trial = new DesktopAccessController(identity, product, signing.Verifier, Store("standalone-http"), client, new TestEnrollmentProvider(Enrollment(identity))))
        {
            Run(trial.RefreshTrialStatusAsync());
            Check(trial.TrialRemaining == 2, "Real desktop HTTP client accepts standalone trial status");
            Run(trial.StartTrialAsync());
            Check(trial.CanEnter && transportServer.Used(product.Sku) == 1, "Real desktop HTTP client starts a standalone signed trial");
        }
        Check(Run(client.GetEntitlementsAsync(CancellationToken.None)).Single().Sku == product.Sku, "Real desktop HTTP client accepts standalone entitlements");
        Check(Run(client.RedeemAsync(new(FakeServer.ValidCode, SigningFixture.DeviceId, product.Sku, Guid.NewGuid().ToString("D")), CancellationToken.None)) == license,
            "Real desktop HTTP client sends standalone activation-code redemption");
        using var automatic = new DesktopAccessController(identity, product, signing.Verifier, Store("standalone-auto"), client, new TestEnrollmentProvider(Enrollment(identity)));
        Check(Run(automatic.CheckPurchasedLicenseAsync()) == PaidCheckOutcome.Activated && automatic.IsPurchased,
            "Real desktop HTTP client retrieves and verifies the standalone paid purchase");
    }
}
