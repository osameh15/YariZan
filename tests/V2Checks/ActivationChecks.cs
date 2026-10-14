using System.Net;
using System.Net.Http;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using YariZan.App.Services;
using YariZan.App.Views;
using YariZan.Core.V2;

internal static partial class Program
{
    private static void ActivationChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        Check(ActivationCode.Normalize(FakeServer.ValidCode.ToLowerInvariant().Replace("-", " ")) == FakeServer.ValidCode,
            "manual code ASCII grouping and case normalize without changing credential");
        foreach (string bad in new[] { "", "legacy-serial", new string('A', 65), FakeServer.ValidCode.Replace("AAAA", "IIII"), FakeServer.ValidCode.Replace("A", "Ａ") })
            Check(Reject(() => ActivationCode.Normalize(bad)), "invalid/legacy/lookalike activation format rejected");
        var server = new FakeServer(signing, identity) { LoseRedemptionResponse = true };
        using var http = new HttpClient(new ContractHandler(server));
        var client = new DesktopV2Client(http, new Credentials());
        var store = Store("code-http");
        using var access = Access(identity, signing, store, client);
        Check(RejectAsync(() => access.RedeemActivationCodeAsync("bad")) && server.RedemptionRequests == 0,
            "invalid manual code makes no network request");
        Check(RejectAsync(() => access.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !access.CanEnter && server.Redemptions == 1,
            "HTTP lost redemption response spends once but grants no unverified access");
        string retryId = server.LastRedemption!.RequestId;
        Run(access.RedeemActivationCodeAsync(FakeServer.ValidCode.ToLowerInvariant()));
        Check(access.IsPurchased && server.Redemptions == 1 && server.LastRedemption.RequestId == retryId,
            "HTTP same-code retry retains idempotency ID and returns signed perpetual license");
        Check(server.LastRedemption.DeviceId == SigningFixture.DeviceId && server.LastRedemption.Sku == G1.Sku,
            "redemption DTO binds enrolled UUID and selected product");
        Check(!server.LastRedemption.ToString().Contains(FakeServer.ValidCode), "request diagnostic string redacts code");
        server.Offline = true;
        using (var restart = Access(identity, signing, store, server)) Check(restart.IsPurchased, "redeemed perpetual license starts offline after process restart");
        Check(RejectAsync(() => client.RedeemAsync(new(FakeServer.ValidCode, SigningFixture.CustomerId, G1.Sku, Guid.NewGuid().ToString("D")), default)),
            "transport rejects credential/device mismatch before sending code");
        using var unprovisionedHttp = new HttpClient(new Handler());
        var unprovisioned = new DesktopV2Client(unprovisionedHttp, new UnprovisionedDeviceCredentials());
        using (var locked = Access(identity, signing, Store("code-unprovisioned"), unprovisioned))
            Check(RejectAsync(() => locked.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !locked.CanEnter,
                "manual code cannot bootstrap secure enrollment");

        foreach (string error in new[] { "ACTIVATION_CODE_INVALID", "ACTIVATION_CODE_EXPIRED", "ACTIVATION_CODE_CANCELLED", "ACCOUNT_RESTRICTED", "RATE_LIMITED" })
        {
            var deniedServer = new FakeServer(signing, identity) { RedemptionError = error };
            using var deniedHttp = new HttpClient(new ContractHandler(deniedServer));
            using var denied = Access(identity, signing, Store("code-" + error), new DesktopV2Client(deniedHttp, new Credentials()));
            Check(RejectAsync(() => denied.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !denied.CanEnter && deniedServer.Redemptions == 0,
                "structured redemption denial grants nothing: " + error);
        }
        var bannedServer = new FakeServer(signing, identity) { ProductBlocked = true };
        using (var bannedHttp = new HttpClient(new ContractHandler(bannedServer)))
        using (var denied = Access(identity, signing, Store("code-ban"), new DesktopV2Client(bannedHttp, new Credentials())))
            Check(RejectAsync(() => denied.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !denied.CanEnter && bannedServer.Redemptions == 0,
                "HTTP blocked-product redemption rejected before transaction");
        using (var banned = Access(identity, signing, Store("trial-ban"), bannedServer))
        {
            Run(banned.RefreshTrialStatusAsync());
            Check(banned.State == DesktopAccessState.ProductBlocked && !banned.CanEnter, "blocked trial status represented separately from connectivity");
            Check(RejectAsync(() => banned.StartTrialAsync()) && banned.State == DesktopAccessState.ProductBlocked && bannedServer.Used() == 0,
                "blocked product cannot start or consume trial");
        }
        var payload = signing.LicensePayload(identity); payload["device_id"] = SigningFixture.CustomerId;
        string[] invalid = ["{}", signing.License(identity, 2), signing.License(identity).Replace("YARIZAN-G1", "YARIZAN-G2"),
            signing.Sign(payload, SignedArtifactVerifier.LicenseDomain)];
        for (int i = 0; i < invalid.Length; i++)
        {
            var invalidServer = new FakeServer(signing, identity) { RedemptionResponse = invalid[i] };
            var invalidStore = Store("invalid-code-response-" + i);
            using var denied = Access(identity, signing, invalidStore, invalidServer);
            Check(RejectAsync(() => denied.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !denied.CanEnter && invalidStore.ReadLicense(G1).Status == StoreReadStatus.Missing,
                "malformed/cross-grade/tampered/foreign-UUID redemption response cannot activate " + i);
        }
        using (var grade2 = Access(identity, signing, Store("g2-code"), new FakeServer(signing, identity), 2))
            Check(RejectAsync(() => grade2.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !grade2.CanEnter, "G1 code rejected for G2 product");
        var once = new FakeServer(signing, identity);
        var req = new ActivationCodeRequest(FakeServer.ValidCode, SigningFixture.DeviceId, G1.Sku, Guid.NewGuid().ToString("D"));
        string result = Run(once.RedeemAsync(req, default));
        Check(Run(once.RedeemAsync(req, default)) == result && once.Redemptions == 1, "duplicate transaction returns exactly original artifact");
        Check(RejectAsync(() => once.RedeemAsync(new(req.Code, req.DeviceId, "YARIZAN-G2", req.RequestId), default)), "changed product with same request denied");
        Check(RejectAsync(() => once.RedeemAsync(new(req.Code, req.DeviceId, req.Sku, Guid.NewGuid().ToString("D")), default)) && once.Redemptions == 1,
            "second distinct request cannot spend one-time code twice");
        var concurrent = new FakeServer(signing, identity);
        int successes = Run(Task.WhenAll(Enumerable.Range(0, 10).Select(_ => Task.Run(async () =>
        {
            try { await concurrent.RedeemAsync(new(req.Code, req.DeviceId, req.Sku, Guid.NewGuid().ToString("D")), default); return 1; }
            catch (V2ApiException) { return 0; }
        })))).Sum();
        Check(successes == 1 && concurrent.Redemptions == 1, "ten concurrent distinct redemption requests consume one code once in transactional test transport");
        using (var wrongSigner = new SigningFixture())
        using (var denied = Access(identity, signing, Store("code-wrong-signer"), new FakeServer(signing, identity) { RedemptionResponse = wrongSigner.License(identity) }))
            Check(RejectAsync(() => denied.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !denied.CanEnter, "invalid redemption signature never authorizes");
        var revokedStore = Store("code-revoked"); revokedStore.WriteLicense(G1, signing.License(identity)); revokedStore.WriteDecision(G1, signing.Decision(identity, 10));
        using (var revoked = Access(identity, signing, revokedStore, new FakeServer(signing, identity)))
            Check(RejectAsync(() => revoked.RedeemActivationCodeAsync(FakeServer.ValidCode)) && revoked.State == DesktopAccessState.Revoked,
                "manual code cannot override newer local signed revocation");
        var reissuePayload = signing.LicensePayload(identity); reissuePayload["license_id"] = SigningFixture.CustomerId;
        using (var revoked = Access(identity, signing, revokedStore, new FakeServer(signing, identity) { RedemptionResponse = signing.Sign(reissuePayload, SignedArtifactVerifier.LicenseDomain) }))
            Check(RejectAsync(() => revoked.RedeemActivationCodeAsync(FakeServer.ValidCode)) && !revoked.CanEnter,
                "different-license-ID manual reissue fails closed against retained decision");
        var trialServer = new FakeServer(signing, identity) { PendingRedemption = new(TaskCreationOptions.RunContinuationsAsynchronously) };
        using var trial = Access(identity, signing, Store("trial-code-upgrade"), trialServer);
        Run(trial.StartTrialAsync()); var upgrade = trial.RedeemActivationCodeAsync(FakeServer.ValidCode);
        Check(trial.CanEnter && !upgrade.IsCompleted && trial.State == DesktopAccessState.TrialStarted, "pending manual upgrade never suspends current trial");
        trialServer.PendingRedemption.SetException(new HttpRequestException("simulated disconnect"));
        Check(RejectAsync(() => upgrade) && trial.CanEnter && trialServer.Used() == 1, "failed manual upgrade leaves offline trial active without another entry");
        var cancelledServer = new FakeServer(signing, identity) { PendingRedemption = new(TaskCreationOptions.RunContinuationsAsynchronously) };
        using var cancelled = Access(identity, signing, Store("code-cancel"), cancelledServer);
        using var token = new CancellationTokenSource(); var pending = cancelled.RedeemActivationCodeAsync(FakeServer.ValidCode, token.Token); token.Cancel();
        Check(RejectAsync(() => pending) && !cancelled.CanEnter, "cancelled redemption cannot activate");
    }

    private static void ActivationUiChecks(SigningFixture signing, IDeviceIdentity identity, string screenshots)
    {
        var server = new FakeServer(signing, identity);
        using var access = Access(identity, signing, Store("manual-ui"), server);
        var page = new LockPage(access);
        var host = new Window { Content = page, Width = 820, Height = 740, ShowInTaskbar = false, Left = -32000, Top = -32000 };
        host.Show(); Pump(() => access.State == DesktopAccessState.TrialAvailable);
        T Control<T>(string name) where T : FrameworkElement => (T)page.FindName(name);
        Check(Control<TextBlock>("ActivationTitle").Text == "فعال‌سازی یاریزان — پایه اول"
            && Control<TextBlock>("TrialCountText").Text == "۲ فرصت باقی‌مانده", "Persian grade title and separate remaining trial count");
        Check(page.FlowDirection == FlowDirection.RightToLeft && Control<TextBox>("HwidText").FlowDirection == FlowDirection.LeftToRight
            && Control<TextBox>("ActivationCodeInput").FlowDirection == FlowDirection.LeftToRight, "Persian RTL with LTR identifier and code");
        Check(Control<Border>("StatusPanel").Visibility == Visibility.Collapsed && Control<Border>("ManualCodePanel").Visibility == Visibility.Collapsed,
            "normal availability is not error and manual form initially collapsed");
        Check(Control<Button>("TrialButton").Content.ToString() == "ورود آزمایشی" && Control<Button>("ActivateButton").Content.ToString() == "فعال‌سازی نسخه",
            "primary Persian action labels");
        Check(AutomationProperties.GetName(Control<Button>("CopyHwidBtn")) == "کپی شناسه کاربری"
            && Control<TextBox>("HwidText").IsReadOnly && AutomationProperties.GetLabeledBy(Control<TextBox>("ActivationCodeInput")) is Label,
            "copy action and input have accessible labels with selectable read-only identity");
        Save(page, screenshots, "lock-activation-v2.png");
        Control<Button>("ManualCodeButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(Control<Border>("ManualCodePanel").Visibility == Visibility.Visible && !Control<ScrollViewer>("LockScroll").IsEnabled,
            "manual action opens modal with disabled background");
        Control<TextBox>("ActivationCodeInput").Text = "bad"; Control<Button>("RedeemButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(server.RedemptionRequests == 0 && Control<TextBlock>("CodeFeedback").Text.StartsWith("کد فعال‌سازی معتبر نیست"), "invalid input shows inline Persian feedback without request");
        Save(page, screenshots, "lock-manual-code-v2.png");
        server.Offline = true; Control<TextBox>("ActivationCodeInput").Text = FakeServer.ValidCode;
        Control<Button>("RedeemButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Pump(() => Control<Button>("RedeemButton").IsEnabled);
        Check(Control<TextBlock>("CodeFeedback").Text == "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید." && !access.CanEnter,
            "manual UI disconnect displays inline network error and stays locked");
        server.Offline = false;
        foreach (string code in new[] { "ACTIVATION_CODE_INVALID", "PRODUCT_BLOCKED" })
        {
            server.RedemptionError = code;
            Control<TextBox>("ActivationCodeInput").Text = FakeServer.ValidCode;
            Control<Button>("RedeemButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Pump(() => Control<Button>("RedeemButton").IsEnabled);
            Check(!access.CanEnter && Control<TextBlock>("CodeFeedback").Text.Contains(code == "PRODUCT_BLOCKED" ? "مسدود" : "معتبر نیست"),
                "mocked UI denial remains locked with correct message " + code);
        }
        server.RedemptionError = null;
        Control<Button>("RedeemButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Pump(() => access.IsPurchased && Control<Button>("RedeemButton").IsEnabled);
        Check(Control<TextBlock>("StatusText").Text == "نسخه شما فعال شد. از این پس می‌توانید بدون اینترنت بازی کنید."
            && Control<Button>("ActivateButton").Content.ToString() == "ورود به بازی", "valid signed UI redemption displays success before explicit offline entry");
        bool entered = false; page.Activated += (_, _) => entered = true; server.Offline = true;
        Control<Button>("ActivateButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(entered && access.IsPurchased && server.RedemptionRequests == 3, "successful UI entry offline does not redeem again");
        host.Close();
        LockDialogChecks(signing, identity, screenshots);
        for (int grade = 1; grade <= 6; grade++)
        {
            using var gradeAccess = Access(identity, signing, Store("label-" + grade), server, grade);
            var gradePage = new LockPage(gradeAccess);
            Check(((TextBlock)gradePage.FindName("ActivationTitle")).Text.EndsWith("پایه " + AppBranding.GradeName(grade)), "dynamic activation grade label G" + grade);
        }
    }
}
