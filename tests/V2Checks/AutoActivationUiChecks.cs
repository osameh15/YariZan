using System.IO;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using YariZan.App.Views;
using YariZan.Core.V2;

internal static partial class Program
{
    // Real timers, short intervals: these checks drive the actual dispatcher and WPF pages.
    private static readonly PaidActivationTiming UiTiming = PaidActivationTiming.Default with
    {
        FirstInterval = TimeSpan.FromMilliseconds(40), SteadyInterval = TimeSpan.FromMilliseconds(40), Jitter = TimeSpan.Zero,
        NetworkBackoffStart = TimeSpan.FromMilliseconds(40), NetworkBackoffMax = TimeSpan.FromMilliseconds(80),
        AttemptDeadline = TimeSpan.FromSeconds(5), StartupDeadline = TimeSpan.FromSeconds(5)
    };

    private static PaidActivationCoordinator UiCoordinator(DesktopAccessController access, IActivationIntentStore? intent = null, PaidActivationTiming? timing = null) =>
        new(access, intent ?? new MemoryActivationIntentStore(), timing ?? UiTiming);

    private static MainWindow Window(DesktopAccessController access, PaidActivationCoordinator activation, double width = 1216, double height = 779)
    {
        var window = new MainWindow(access, null, activation)
        { ShowInTaskbar = false, AdaptiveWindowSize = false, Left = -32000, Top = -32000, WindowState = WindowState.Normal, Width = width, Height = height,
          ActivationEntryDelay = TimeSpan.FromMilliseconds(600) };
        return window;
    }

    private static object? Page(MainWindow window) => ((ContentControl)window.FindName("PageHost")).Content;

    /// <summary>Cover, then information, then game book, exactly as a customer clicks through.</summary>
    private static void OpenToGames(MainWindow window)
    {
        ((CoverPage)Page(window)!).OpenCommand.Execute(null);
        Pump(() => Page(window) is InfoPage);
        NextFromInfo(window);
        Pump(() => Page(window) is GamesBookPage);
    }

    private static void NextFromInfo(MainWindow window) =>
        typeof(InfoPage).GetMethod("Next_Click", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
            .Invoke(Page(window), new object?[] { null, new RoutedEventArgs() });

    private static void AutoActivationUiChecks(SigningFixture signing, IDeviceIdentity identity, string screenshots)
    {
        string shots = Path.Combine(screenshots, "auto-activation");
        T C<T>(LockPage page, string name) where T : FrameworkElement => (T)page.FindName(name);
        void Click(LockPage page, string name) => C<Button>(page, name).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        string Phase(LockPage page) => C<TextBlock>(page, "ActivationPhaseText").Text;

        // First purchase: pairing, automatic wait, checking, retrieval, success, automatic library entry.
        {
            var provisioning = new UiProvisioning(identity);
            var server = new FakeServer(signing, identity);
            var store = Store("auto-ui-first-purchase");
            var access = new DesktopAccessController(identity, G1, signing.Verifier, store, server, new TestEnrollmentProvider(Enrollment(identity)), provisioning);
            var activation = UiCoordinator(access);
            var window = Window(access, activation);
            window.Show();
            Pump(() => Page(window) is LockPage && activation.Mode == PaidActivationMode.StartupRecovery && !activation.IsRunning);
            Check(activation.Phase == PaidActivationPhase.WaitingForPurchase && activation.Mode == PaidActivationMode.StartupRecovery && server.EntitlementRequests == 1,
                "launch of an enrolled unpaid device performs one bounded pickup check and stays on the activation page");
            var first = (LockPage)Page(window)!;
            Check(window.IsCompact && !C<Button>(first, "BackButton").IsVisible && C<Button>(first, "ConnectButton").IsVisible,
                "2.1.0: the activation page opens first in the compact window, without a back button");
            window.ShowLock(animate: false);
            var page = (LockPage)Page(window)!;
            Pump(() => access.State == DesktopAccessState.TrialAvailable && C<Button>(page, "TrialButton").IsEnabled);
            Check(!C<Border>(page, "ActivationProgressPanel").IsVisible && C<Button>(page, "ActivateButton").IsVisible,
                "finished startup check leaves the normal Lock choices without an error");
            Click(page, "ConnectButton"); Pump(() => C<StackPanel>(page, "PairingPanel").IsVisible);
            C<TextBox>(page, "PairingCodeText").Text = "[masked temporary pairing code]";
            Check(C<TextBlock>(page, "PairingFeedback").Text.StartsWith("در انتظار تأیید در مرورگر…") && C<ProgressBar>(page, "PairingProgress").IsVisible && !C<FrameworkElement>(page, "ConnectingOverlay").IsVisible, "pairing dialog shows it is waiting for the browser; the connecting card is gone");
            Save(page, shots, "01-pairing-in-progress.png");
            server.PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously);
            provisioning.Ready = true;
            Pump(() => !C<Grid>(page, "ModalOverlay").IsVisible && C<Border>(page, "ActivationProgressPanel").IsVisible);
            Check(C<TextBlock>(page, "ActivationConnectedText").IsVisible && Phase(page) == "در حال بررسی مجوز خرید…"
                && activation.Mode == PaidActivationMode.Waiting && !C<Button>(page, "ActivateButton").IsVisible,
                "pairing completion closes the dialog and enters the automatic waiting state without another click");
            Check(C<Button>(page, "TrialButton").IsEnabled && C<Button>(page, "SupportButton").IsEnabled && C<Button>(page, "CancelWaitButton").IsEnabled
                && C<Button>(page, "PurchaseButton").IsEnabled && !C<Button>(page, "WaitPurchaseButton").IsVisible,
                "trial, support, purchase guide and cancel stay available while waiting, with no duplicate purchase guide");
            Check(AutomationProperties.GetLiveSetting(C<TextBlock>(page, "ActivationPhaseText")) == AutomationLiveSetting.Polite,
                "activation status is a polite live region");
            Save(page, shots, "02-pairing-completed.png");
            Save(page, shots, "04-checking-entitlement.png");
            server.PendingEntitlements.SetResult(null); server.PendingEntitlements = null;
            Pump(() => activation.Phase == PaidActivationPhase.WaitingForPurchase);
            Check(Phase(page) == "در انتظار تکمیل خرید و آماده‌شدن مجوز…" && !access.CanEnter && server.PickupRequests == 0,
                "payment still pending shows the waiting state and never unlocks");
            Save(page, shots, "03-waiting-for-purchase.png");
            Pump(() => server.EntitlementRequests >= 4);
            Check(!access.CanEnter && activation.IsRunning, "several pending polls keep waiting without unlocking");
            server.PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously); server.EntitlementState = "ACTIVE";
            Pump(() => activation.Phase == PaidActivationPhase.RetrievingLicense);
            Check(Phase(page) == "مجوز آماده است؛ در حال فعال‌سازی…" && !access.CanEnter, "fulfilled purchase shows license retrieval before any access");
            Save(page, shots, "05-retrieving-signed-license.png");
            server.PendingPickup.SetResult(signing.License(identity));
            Pump(() => Phase(page) == "نسخه شما فعال شد");
            Check(access.IsPurchased && store.ReadLicense(G1).Status == StoreReadStatus.Present && Page(window) == page,
                "success is shown only after the signed license is verified and stored");
            Save(page, shots, "06-activation-complete.png");
            Pump(() => C<TextBlock>(page, "ActivationDetailText").Text == "در حال ورود به یاریزان…");
            Pump(() => Page(window) is InfoPage);
            Check(server.PickupRequests == 1 && access.IsPurchased, "automatic activation continues to the information page");
            Save((UserControl)Page(window)!, shots, "07-automatic-info-page.png");
            NextFromInfo(window);
            Pump(() => Page(window) is GamesBookPage);
            Check(access.IsPurchased, "information page continues to the game book after activation");
            window.Close();
        }

        // Restart cases: cached paid (offline), paid while closed, resumed wait, unpaid offline.
        {
            var paidStore = Store("auto-ui-first-purchase");
            var offline = new FakeServer(signing, identity) { Offline = true };
            var access = Access(identity, signing, paidStore, offline);
            var activation = UiCoordinator(access);
            var window = Window(access, activation);
            var seen = new List<Type>();
            window.Show(); Pump(() => Page(window) is not null);
            seen.Add(Page(window)!.GetType());
            Check(Page(window) is CoverPage && offline.EntitlementRequests == 0 && offline.PickupRequests == 0 && offline.StatusRequests == 0,
                "restart with a cached paid license opens the cover at once, fully offline, without the Lock page");
            Save((UserControl)Page(window)!, shots, "08-restart-offline-cached-paid.png");
            OpenToGames(window);
            Check(seen.Count == 1 && !seen.Contains(typeof(LockPage)) && offline.EntitlementRequests == 0 && offline.StatusRequests == 0,
                "cached paid license walks cover, information, game book offline with no Lock and no request");
            window.Close();

            var closedStore = Store("auto-ui-paid-while-closed");
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            access = Access(identity, signing, closedStore, server);
            activation = UiCoordinator(access);
            window = Window(access, activation);
            seen.Clear();
            window.Show();
            Pump(() => { if (Page(window) is { } current && !seen.Contains(current.GetType())) seen.Add(current.GetType()); return Page(window) is InfoPage; });
            Check(access.IsPurchased && server.PickupRequests == 1 && seen.SequenceEqual(new[] { typeof(LockPage), typeof(InfoPage) })
                && closedStore.ReadLicense(G1).Status == StoreReadStatus.Present && !window.IsCompact,
                "purchase completed while closed: the activation page checks at launch, activates and opens the information page full screen");
            window.Close();

            var intent = new MemoryActivationIntentStore(); intent.MarkPending(G1);
            server = new FakeServer(signing, identity);
            access = Access(identity, signing, Store("auto-ui-resume"), server);
            activation = UiCoordinator(access, intent);
            window = Window(access, activation);
            window.Show(); Pump(() => Page(window) is LockPage);
            Check(Page(window) is LockPage, "a pending wait with no purchase yet falls back from recovery to the activation page");
            var page = (LockPage)Page(window)!;
            Pump(() => activation.Phase == PaidActivationPhase.WaitingForPurchase);
            Check(C<Border>(page, "ActivationProgressPanel").IsVisible && !access.CanEnter, "resumed wait shows the waiting state and stays locked");
            server.EntitlementState = "ACTIVE";
            Pump(() => Page(window) is InfoPage);
            Check(access.IsPurchased && !intent.IsPending(G1), "resumed wait activates automatically and clears the marker");
            window.Close();

            server = new FakeServer(signing, identity) { Offline = true };
            access = Access(identity, signing, Store("auto-ui-unpaid-offline"), server);
            activation = UiCoordinator(access);
            window = Window(access, activation);
            window.Show();
            Pump(() => !activation.IsRunning);
            Check(Page(window) is LockPage && activation.Phase == PaidActivationPhase.NetworkUnavailable && !access.CanEnter,
                "unpaid launch offline fails closed on the activation page");
            window.ShowLock(animate: false); page = (LockPage)Page(window)!;
            Pump(() => access.State == DesktopAccessState.ConnectionUnavailable && C<Button>(page, "TrialButton").IsEnabled);
            Check(C<TextBlock>(page, "StatusText").Text.Contains("برای فعال‌سازی اولیه") && !access.CanEnter,
                "unpaid offline Lock explains the one-time online activation");
            Save(page, shots, "09-restart-unpaid-offline.png");
            Click(page, "ActivateButton");
            Pump(() => activation.Phase == PaidActivationPhase.NetworkUnavailable && C<Border>(page, "ActivationProgressPanel").IsVisible);
            Check(Phase(page) == "ارتباط برقرار نشد؛ تلاش مجدد امکان‌پذیر است" && C<Button>(page, "CheckNowButton").IsVisible
                && C<Button>(page, "CancelWaitButton").IsEnabled && access.LocalLicenseState == DesktopAccessState.NoLicense,
                "network failure while waiting is recoverable and never a revocation");
            Save(page, shots, "10-recoverable-network-failure.png");
            server.Offline = false; server.EntitlementState = "ACTIVE";
            Click(page, "CheckNowButton");
            Pump(() => Page(window) is InfoPage);
            Check(access.IsPurchased, "check again after the network returns activates automatically");
            window.Close();
        }

        // Small window and 150% scale: the waiting state keeps all actions reachable.
        {
            var server = new FakeServer(signing, identity);
            var access = Access(identity, signing, Store("auto-ui-small"), server);
            var activation = UiCoordinator(access);
            var window = Window(access, activation, 800, 600);
            window.Show(); Pump(() => Page(window) is not null && !activation.IsRunning); window.ShowLock(animate: false);
            var page = (LockPage)Page(window)!;
            Pump(() => C<Button>(page, "TrialButton").IsEnabled);
            Click(page, "ActivateButton");
            Pump(() => activation.Phase == PaidActivationPhase.WaitingForPurchase);
            Check(((System.Windows.Controls.Primitives.UniformGrid)page.FindName("PrimaryActions")).Columns == 1 && C<Button>(page, "CancelWaitButton").IsVisible,
                "small window waiting layout stacks actions and keeps cancel available");
            Save(page, shots, "03-waiting-for-purchase-800x600.png", 800, 600);
            // A 1216x779-pixel display at 150% scaling offers an 811x519 logical window.
            window.Width = 811; window.Height = 519; window.UpdateLayout(); Pump(() => page.ActualHeight < 530);
            Check(C<Button>(page, "CancelWaitButton").IsVisible && C<Border>(page, "ActivationProgressPanel").ActualWidth <= page.ActualWidth,
                "150% scale logical window keeps the waiting panel within the page");
            SaveScaled(page, shots, "03-waiting-for-purchase-150pct.png", 144);
            // Cancel, then close during an in-flight request: no callbacks, no pickup, nothing stored.
            Click(page, "CancelWaitButton");
            Check(!activation.IsRunning && !C<Border>(page, "ActivationProgressPanel").IsVisible && C<Button>(page, "ActivateButton").IsVisible,
                "cancel waiting stops polling and restores the activation button");
            server.PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously);
            Click(page, "ActivateButton"); Pump(() => server.EntitlementRequests > 0 && activation.Phase == PaidActivationPhase.Checking);
            window.Close();
            server.PendingEntitlements.SetResult("ACTIVE");
            Pump(() => true); Thread.Sleep(100); Pump(() => true);
            Check(activation.Phase == PaidActivationPhase.Checking && server.PickupRequests == 0 && !access.CanEnter && !activation.IsRunning
                && Store("auto-ui-small").ReadLicense(G1).Status == StoreReadStatus.Missing,
                "closing the window while polling cancels the request with no later callback, pickup or navigation");
        }

        // Back to cover ends the visible wait (no background polling); cached revocation is never bypassed.
        {
            var server = new FakeServer(signing, identity);
            var access = Access(identity, signing, Store("auto-ui-back"), server);
            var activation = UiCoordinator(access);
            var window = Window(access, activation);
            window.Show(); Pump(() => Page(window) is not null && !activation.IsRunning); window.ShowLock(animate: false);
            var page = (LockPage)Page(window)!;
            Pump(() => C<Button>(page, "TrialButton").IsEnabled);
            Click(page, "ActivateButton"); Pump(() => activation.Phase == PaidActivationPhase.WaitingForPurchase);
            window.ShowCover(false);
            Pump(() => !activation.IsRunning);
            int requests = server.EntitlementRequests;
            Thread.Sleep(200); Pump(() => true);
            Check(!activation.IsRunning && server.EntitlementRequests == requests, "leaving the waiting page stops polling");
            window.Close();

            var revokedStore = Store("auto-ui-revoked"); revokedStore.WriteLicense(G1, signing.License(identity)); revokedStore.WriteDecision(G1, signing.Decision(identity, 7));
            server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            access = Access(identity, signing, revokedStore, server);
            activation = UiCoordinator(access);
            window = Window(access, activation);
            window.Show(); Pump(() => Page(window) is not null);
            Check(Page(window) is LockPage && !access.CanEnter && server.EntitlementRequests == 0 && server.PickupRequests == 0,
                "cached signed revocation starts on the activation page with no automatic pickup");
            window.Close();
        }
    }

    private static void SaveScaled(UserControl page, string root, string name, double dpi)
    {
        // Renders the live logical layout at a higher DPI (144 = 150%); not a physical high-DPI display test.
        page.BeginAnimation(UIElement.OpacityProperty, null); page.Opacity = 1; page.RenderTransform = Transform.Identity;
        Directory.CreateDirectory(root); page.UpdateLayout();
        double width = page.ActualWidth, height = page.ActualHeight, scale = dpi / 96;
        var bitmap = new RenderTargetBitmap((int)(width * scale), (int)(height * scale), dpi, dpi, PixelFormats.Pbgra32); bitmap.Render(page);
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var file = File.Create(Path.Combine(root, name)); encoder.Save(file);
    }
}
