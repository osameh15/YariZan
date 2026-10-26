using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using YariZan.App.Views;
using YariZan.Core.V2;

internal static partial class Program
{
    /// <summary>Startup recovery after an interrupted purchase: neutral screen, no Lock flash on success.</summary>
    private static void RecoveryUiChecks(SigningFixture signing, IDeviceIdentity identity, string screenshots)
    {
        string shots = Path.Combine(screenshots, "auto-activation");
        T C<T>(UserControl page, string name) where T : FrameworkElement => (T)page.FindName(name);
        (MainWindow Window, List<Type> Pages) Launch(DesktopAccessController access, PaidActivationCoordinator activation, double width = 1216, double height = 779)
        {
            var window = Window(access, activation, width, height);
            var pages = new List<Type>();
            window.PageShown += (_, page) => pages.Add(page.GetType());
            window.Show();
            Pump(() => Page(window) is not null);
            return (window, pages);
        }

        // 1-5, 13. Wait, exit, pay while closed, relaunch: neutral recovery then library; never Lock; no trial.
        {
            var provisioning = new UiProvisioning(identity) { Ready = true };
            var server = new FakeServer(signing, identity);
            var store = Store("recovery-interrupted"); var intent = new MemoryActivationIntentStore();
            var access = new DesktopAccessController(identity, G1, signing.Verifier, store, server, new TestEnrollmentProvider(Enrollment(identity)), provisioning);
            var activation = UiCoordinator(access, intent);
            var (window, _) = Launch(access, activation);
            Pump(() => !activation.IsRunning); window.ShowLock(animate: false);
            var lockPage = (LockPage)Page(window)!;
            Pump(() => C<Button>(lockPage, "TrialButton").IsEnabled);
            C<Button>(lockPage, "ConnectButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Pump(() => activation.Mode == PaidActivationMode.Waiting && activation.Phase == PaidActivationPhase.WaitingForPurchase);
            Check(intent.IsPending(G1) && !access.CanEnter, "customer paired and started waiting for the purchase");
            window.Close();
            Check(!activation.IsRunning && intent.IsPending(G1) && store.ReadLicense(G1).Status == StoreReadStatus.Missing,
                "exit while waiting stops polling, keeps only the wait marker and stores nothing");

            server.EntitlementState = "ACTIVE"; // payment verified and fulfilled while the app was closed
            server.PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously);
            int trialStarts = server.StartRequests;
            access = Access(identity, signing, store, server);
            activation = UiCoordinator(access, intent);
            var (relaunch, pages) = Launch(access, activation);
            var recovery = Page(relaunch) as ActivationRecoveryPage;
            Check(pages.Count == 1 && recovery is not null, "relaunch shows the neutral recovery screen first, not Lock");
            Check(C<TextBlock>(recovery!, "RecoveryTitle").Text == "در حال بررسی مجوز خرید…"
                && AutomationProperties.GetLiveSetting(C<TextBlock>(recovery!, "RecoveryTitle")) == AutomationLiveSetting.Polite
                && C<Button>(recovery!, "SkipButton").IsVisible && recovery!.FindName("TrialButton") is null,
                "recovery screen has an accessible progress state, a skip action and no trial or activation choices");
            Save(recovery!, shots, "11-startup-recovery.png");
            server.PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously);
            server.PendingEntitlements.SetResult("ACTIVE");
            Pump(() => server.PickupRequests == 1);
            Check(!access.CanEnter && Page(relaunch) == recovery, "an entitlement row alone does not unlock or navigate");
            server.PendingPickup.SetResult(signing.License(identity));
            Pump(() => C<TextBlock>(recovery!, "RecoveryTitle").Text == "نسخه شما فعال شد");
            Check(access.IsPurchased && store.ReadLicense(G1).Status == StoreReadStatus.Present && !C<Button>(recovery!, "SkipButton").IsVisible,
                "signed pickup is verified and stored before the success message");
            Save(recovery!, shots, "12-startup-recovery-activated.png");
            Pump(() => Page(relaunch) is InfoPage);
            Check(pages.SequenceEqual(new[] { typeof(ActivationRecoveryPage), typeof(InfoPage) }),
                "successful recovery goes to the information page; no Lock page was created or shown");
            Check(!intent.IsPending(G1) && server.StartRequests == trialStarts && server.Used() == 0,
                "recovery clears the marker and consumes no trial");
            Save((UserControl)Page(relaunch)!, shots, "13-startup-recovery-info.png");
            relaunch.Close();

            // 6. Existing valid paid license: library at once, fully offline, no recovery screen.
            var offline = new FakeServer(signing, identity) { Offline = true };
            intent.MarkPending(G1);
            access = Access(identity, signing, store, offline);
            activation = UiCoordinator(access, intent);
            var (paid, paidPages) = Launch(access, activation);
            Check(paidPages.SequenceEqual(new[] { typeof(CoverPage) }) && offline.EntitlementRequests == 0 && offline.PickupRequests == 0,
                "a stored paid license opens the cover immediately offline, even with a stale wait marker");
            OpenToGames(paid);
            Check(paidPages.SequenceEqual(new[] { typeof(CoverPage), typeof(InfoPage), typeof(GamesBookPage) }) && offline.EntitlementRequests == 0,
                "paid launch follows cover, information, game book with no Lock and no request");
            paid.Close();
        }

        // 7. Pending purchase, no internet: recovery then Lock with clear guidance; nothing unlocked.
        {
            var server = new FakeServer(signing, identity) { Offline = true };
            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            var access = Access(identity, signing, Store("recovery-offline"), server);
            var activation = UiCoordinator(access, intent);
            var (window, pages) = Launch(access, activation, 811, 519);
            Pump(() => Page(window) is LockPage page && C<Border>(page, "ActivationProgressPanel").IsVisible
                && activation.Phase == PaidActivationPhase.NetworkUnavailable);
            var page = (LockPage)Page(window)!;
            Check(pages.First() == typeof(ActivationRecoveryPage) && !access.CanEnter && intent.IsPending(G1)
                && C<TextBlock>(page, "ActivationPhaseText").Text == "ارتباط برقرار نشد؛ تلاش مجدد امکان‌پذیر است"
                && C<Button>(page, "TrialButton").IsVisible && C<Button>(page, "CheckNowButton").IsVisible && C<Button>(page, "CancelWaitButton").IsVisible,
                "offline recovery falls back to the Lock wait with guidance, retry, cancel and trial");
            SaveScaled(page, shots, "14-recovery-offline-fallback-150pct.png", 144);
            C<Button>(page, "CancelWaitButton").RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(!activation.IsRunning && !intent.IsPending(G1) && C<Button>(page, "ActivateButton").IsVisible,
                "cancel on the fallback stops polling and clears the marker");
            Save(page, shots, "15-recovery-cancelled.png");
            window.Close();
        }

        // 8. Pending purchase, no entitlement yet: fall back to the waiting state without activation.
        {
            var server = new FakeServer(signing, identity);
            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            var access = Access(identity, signing, Store("recovery-not-paid"), server);
            var activation = UiCoordinator(access, intent);
            var (window, pages) = Launch(access, activation);
            Pump(() => Page(window) is LockPage page && activation.Mode == PaidActivationMode.Waiting
                && activation.Phase == PaidActivationPhase.WaitingForPurchase);
            Check(pages.First() == typeof(ActivationRecoveryPage) && !access.CanEnter && server.PickupRequests == 0,
                "pending purchase without entitlement falls back to waiting and never activates");
            Save((UserControl)Page(window)!, shots, "16-recovery-pending-fallback.png");
            window.Close();
        }

        // 9. Pending purchase, invalid signed license: never unlocks; the refusal stays visible.
        {
            using var wrongSigner = new SigningFixture();
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE", PickupResponse = wrongSigner.License(identity) };
            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            var store = Store("recovery-invalid");
            var access = Access(identity, signing, store, server);
            var activation = UiCoordinator(access, intent);
            var (window, pages) = Launch(access, activation);
            Pump(() => Page(window) is LockPage lp && C<Border>(lp, "ActivationProgressPanel").IsVisible);
            var page = (LockPage)Page(window)!;
            Check(!access.CanEnter && store.ReadLicense(G1).Status == StoreReadStatus.Missing && activation.Phase == PaidActivationPhase.InvalidLicense
                && C<Border>(page, "ActivationProgressPanel").IsVisible && C<TextBlock>(page, "ActivationPhaseText").Text == "مجوز دریافتی معتبر نبود"
                && !pages.Contains(typeof(InfoPage)) && !pages.Contains(typeof(GamesBookPage)), "invalid signature during recovery never unlocks and shows the refusal on Lock");
            window.Close();
        }

        // 10-11. Exit or skip while the recovery check is pending: no later navigation, pickup or storage.
        {
            var server = new FakeServer(signing, identity) { PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            var store = Store("recovery-exit");
            var access = Access(identity, signing, store, server);
            var activation = UiCoordinator(access, intent);
            var (window, pages) = Launch(access, activation);
            Pump(() => server.EntitlementRequests == 1);
            window.Close();
            server.PendingEntitlements.SetResult("ACTIVE");
            Pump(() => true); Thread.Sleep(100); Pump(() => true);
            Check(pages.Count == 1 && server.PickupRequests == 0 && store.ReadLicense(G1).Status == StoreReadStatus.Missing && !activation.IsRunning,
                "exit during the recovery check leaves no callback, navigation, pickup or stored license");

            server = new FakeServer(signing, identity) { PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            access = Access(identity, signing, Store("recovery-skip"), server);
            activation = UiCoordinator(access, intent);
            (window, pages) = Launch(access, activation);
            Pump(() => server.EntitlementRequests == 1);
            ((Button)((UserControl)Page(window)!).FindName("SkipButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(Page(window) is LockPage && !activation.IsRunning, "skip ends the recovery check and shows the activation choices");
            server.PendingEntitlements.SetResult("ACTIVE");
            Thread.Sleep(150); Pump(() => true);
            Check(Page(window) is LockPage && server.PickupRequests == 0 && !access.CanEnter && intent.IsPending(G1) && !activation.IsRunning,
                "a late recovery response after skip neither navigates nor picks up; the wait is not restarted");
            window.Close();
        }

        // 12. Cached signed revocation plus a wait marker: no recovery screen, no request, stays locked.
        {
            var store = Store("recovery-revoked"); store.WriteLicense(G1, signing.License(identity)); store.WriteDecision(G1, signing.Decision(identity, 9));
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            var access = Access(identity, signing, store, server);
            var activation = UiCoordinator(access, intent);
            var (window, pages) = Launch(access, activation);
            Check(pages.SequenceEqual(new[] { typeof(LockPage) }) && !access.CanEnter && server.EntitlementRequests == 0 && server.PickupRequests == 0,
                "cached signed revocation is never bypassed by a wait marker or recovery");
            window.Close();
        }
    

        // Recovery screen at 800x600 and at 150% scale (811x519 logical), with the skip action reachable.
        foreach (var (width, height, dpi, name) in new[] { (800.0, 600.0, 96.0, "11-startup-recovery-800x600.png"), (811.0, 519.0, 144.0, "11-startup-recovery-150pct.png") })
        {
            var page = new ActivationRecoveryPage();
            var host = new Window { Content = page, Width = width, Height = height, WindowStyle = WindowStyle.None, ShowInTaskbar = false, Left = -32000, Top = -32000 };
            host.Show(); host.UpdateLayout();
            var card = (FrameworkElement)page.FindName("RecoveryCard"); var skip = (FrameworkElement)page.FindName("SkipButton");
            var bottom = skip.TransformToAncestor(page).Transform(new Point(0, skip.ActualHeight)).Y;
            Check(card.ActualWidth <= page.ActualWidth && bottom <= page.ActualHeight, "recovery screen fits with its action visible at " + name);
            SaveScaled(page, shots, name, dpi);
            host.Close();
        }
    }
}
