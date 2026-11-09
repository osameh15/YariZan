using System.Windows;
using System.IO;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using YariZan.App.Services;
using YariZan.Core;
using YariZan.Core.V2;

namespace YariZan.App.Views;

public partial class MainWindow : Window
{
    private readonly GameLibrary _library;
    private readonly GameLauncher _launcher = new();
    private readonly DesktopAccessController _access;
    private readonly PaidActivationCoordinator _activation;
    private readonly Func<byte[]> _loadGameKey;
    private bool _launching;
    private bool _closed;
    private bool _compact;
    private readonly bool _bundleInvalid;
    private Brush? _windowBackground, _rootBackground, _overlayBackground;
    private CancellationTokenSource? _launchCancellation;
    private bool IsStandalone => _access.Grade == 0;
    public TimeSpan SplashDuration { get; set; } = TimeSpan.FromSeconds(2);

    public MainWindow() : this(null) { }

    /// <summary>Raised for every page the window displays (diagnostics and UI tests).</summary>
    public event EventHandler<UserControl>? PageShown;

    /// <summary>Pause between the visible success message and entering the game library.</summary>
    public TimeSpan ActivationEntryDelay { get; set; } = TimeSpan.FromMilliseconds(1600);

    /// <summary>
    /// Activation and recovery screens use a centered, movable window (not full screen) so the customer
    /// can switch to the browser and copy the device ID; the book pages use the whole screen. UI checks
    /// that size the window themselves turn this off.
    /// </summary>
    public bool AdaptiveWindowSize { get; set; } = true;

    /// <summary>Whether the window currently shows the compact activation layout.</summary>
    public bool IsCompact => _compact;

    public MainWindow(DesktopAccessController? access, Func<byte[]>? loadGameKey = null, PaidActivationCoordinator? activation = null, GameLibrary? library = null)
    {
        _library = library ?? GameLibrary.LoadOrEmpty();
        if (access is not null) _access = access;
        else
        {
            var product = AppProduct.Resolve(_library.Manifest);
            _access = DesktopAccessFactory.Create(product, deferLicenseCheck: product.IsStandalone);
        }
        // A missing or damaged bundle loads as an empty default manifest. Report it on screen:
        // an exception here would end the process with no message.
        _bundleInvalid = IsStandalone && (_library.Manifest.ProductSku != _access.Sku || _library.Manifest.SelectedGrade != 0);
        _activation = activation ?? new PaidActivationCoordinator(_access, DesktopAccessFactory.CreateActivationIntentStore());
        _activation.Activated += OnPaidActivated;
        _loadGameKey = loadGameKey ?? AppKeys.LoadEmbeddedMasterKey;
        InitializeComponent();
        Title = (IsStandalone ? _library.Manifest.ProductTitle ?? "YariZan" : $"YariZan G{Math.Min(6, Math.Max(1, _library.Manifest.SelectedGrade))}")
            + (DesktopV2Client.LocalAcceptance ? " — LOCAL ACCEPTANCE BUILD (not for distribution)" : "")
#if YARIZAN_ACCEPTANCE_CANDIDATE
            // Physical acceptance candidate: production root and API, but visibly not a release.
            + " — ACCEPTANCE CANDIDATE (not for distribution)"
#endif
#if YARIZAN_LEGACY_EXPERIMENTAL
            + " — نسخهٔ آزمایشی ویندوز ۷ و ۸.۱"
#endif
            ;
        // Must be set before the window appears; only the single product shows a modal-only launch.
        if (IsStandalone) AllowsTransparency = true;
        // Decide the first layout before the window appears, so a not-yet-activated copy never flashes full screen.
        if (IsStandalone) UseSplashWindow();
        else if (_access.IsPurchased) WindowState = WindowState.Maximized;
        else UseCompactWindow();
        MouseLeftButtonDown += (_, e) =>
        {
            // The compact window has no title bar; any free area moves it.
            if (_compact && e.ButtonState == System.Windows.Input.MouseButtonState.Pressed)
                try { DragMove(); } catch (InvalidOperationException) { }
        };
        Loaded += async (_, _) =>
        {
            if (IsStandalone)
            {
                SwapPage(new StudioSplashPage(), animate: false);
                if (_bundleInvalid)
                {
                    MessageBox.Show(this, IncompleteBundleMessage, Title, MessageBoxButton.OK, MessageBoxImage.Error);
                    Close();
                    return;
                }
                // Paint the splash while signature, product/device binding and cached revocation
                // are checked locally. Keep it visible for at least the requested two seconds.
                try
                {
                    await Task.WhenAll(Task.Delay(SplashDuration), Task.Run(() => _access.VerifyStartupLicenseAsync()));
                }
                catch (OperationCanceledException) when (_closed) { return; }
                if (_closed) return;
            }
            ShowStartPage();
        };
        Closed += (_, _) =>
        {
            _closed = true;
            _launchCancellation?.Cancel();
            _activation.Dispose();
            _access.Dispose();
            _launcher.Dispose();
        };
    }

    /// <summary>
    /// Launch routing, in priority order:
    /// 1. A locally verified paid license opens the cover at once, full screen, with no network wait;
    ///    the customer continues cover, information, game book as usual and never sees Lock.
    /// 2. An enrolled device whose customer was waiting for a purchase shows a neutral recovery
    ///    screen during one bounded check; success opens the information page without the Lock
    ///    page, anything else falls back to the visible Lock wait.
    /// 3. Any other copy starts on the activation (Lock) page in the compact window; an enrolled device
    ///    also gets one bounded background check, and a found purchase continues to the information page.
    /// The wait marker only selects the screen; it never grants access.
    /// </summary>
    private void ShowStartPage()
    {
        if (_access.IsPurchased)
        {
            _ = _access.SynchronizePurchasedAsync();
            if (IsStandalone) LaunchStandalone(); else ShowCover(animate: false);
            return;
        }
        if (_activation.CanCheckOnline && _activation.HasPendingIntent) { ShowRecovery(); return; }
        ShowLock(animate: false, firstPage: true);
        if (_activation.CanCheckOnline) _ = _activation.StartStartupRecoveryAsync();
    }

    private void UseCompactWindow()
    {
        _compact = true;
        if (!AdaptiveWindowSize) return;
        WindowState = WindowState.Normal;
        var area = SystemParameters.WorkArea;
        Width = Math.Min(860, area.Width - 32);
        Height = Math.Min(800, area.Height - 32);
        Left = area.Left + (area.Width - Width) / 2;
        Top = area.Top + (area.Height - Height) / 2;
    }

    private void UseSplashWindow()
    {
        _compact = true;
        if (!AdaptiveWindowSize) return;
        WindowState = WindowState.Normal;
        var area = SystemParameters.WorkArea;
        Width = Math.Min(400, area.Width - 32);
        Height = Math.Min(400, area.Height - 32);
        Left = area.Left + (area.Width - Width) / 2;
        Top = area.Top + (area.Height - Height) / 2;
    }

    private void UseFullWindow()
    {
        _compact = false;
        if (AdaptiveWindowSize) WindowState = WindowState.Maximized;
    }

    private async void ShowRecovery()
    {
        var page = new ActivationRecoveryPage();
        page.SkipRequested += (_, _) =>
        {
            if (_closed || PageHost.Content != page) return;
            // The customer chose not to wait here; keep the intent but do not restart polling.
            _activation.Stop(clearIntent: false);
            ShowLock(animate: false, resumeWaiting: false);
        };
        UseCompactWindow();
        SwapPage(page, animate: false);
        await _activation.StartStartupRecoveryAsync();
        // Stale completion: the window closed, the customer skipped, or success navigation owns it.
        if (_closed || PageHost.Content != page || _access.IsPurchased || page.Succeeded) return;
        ShowLock(animate: false);
    }

    private async void OnPaidActivated(object? sender, EventArgs e)
    {
        if (_closed || !_access.IsPurchased) return;
        _ = _access.SynchronizePurchasedAsync();
        if (PageHost.Content is LockPage lockPage)
        {
            lockPage.ShowActivationSucceeded();
            await Task.Delay(ActivationEntryDelay);
            if (_closed || PageHost.Content != lockPage) return;
            lockPage.ShowEntering();
            await Task.Delay(TimeSpan.FromTicks(ActivationEntryDelay.Ticks / 4));
            if (_closed || PageHost.Content != lockPage) return;
        }
        else if (PageHost.Content is ActivationRecoveryPage recovery)
        {
            recovery.ShowActivationSucceeded();
            await Task.Delay(ActivationEntryDelay);
            if (_closed || PageHost.Content != recovery) return;
            recovery.ShowEntering();
            await Task.Delay(TimeSpan.FromTicks(ActivationEntryDelay.Ticks / 4));
            if (_closed || PageHost.Content != recovery) return;
        }
        // Never pull the customer out of a page they chose (information, library or a running game).
        else if (PageHost.Content is not CoverPage) return;
        // Every activated entry continues through the information page to the game book.
        if (!_closed && _access.IsPurchased) ShowInfo();
    }

    public void ShowCover(bool animate = true)
    {
        if (IsStandalone) { if (_access.CanEnter) LaunchStandalone(); else ShowLock(animate, firstPage: true); return; }
        UseFullWindow();
        var page = new CoverPage(_library.Manifest.SelectedGrade);
        page.OpenRequested += (_, _) =>
        {
            if (_access.CanEnter) ShowInfo(); else ShowLock();
        };
        SwapPage(page, animate);
    }

    /// <param name="firstPage">The activation page opened at launch: there is no cover to go back to.</param>
    public void ShowLock(bool animate = true, bool resumeWaiting = true, bool firstPage = false)
    {
        if (IsStandalone) UseModalOnlyLook(false);
        UseCompactWindow();
        var page = new LockPage(_access, activation: _activation, resumeWaiting: resumeWaiting,
            productTitle: IsStandalone ? _library.Manifest.ProductTitle : null);
        if (firstPage || IsStandalone) page.HideBack();
        page.Activated    += (_, _) => ShowInfo();
        page.TrialStarted += (_, _) => ShowInfo();
        page.Cancelled    += (_, _) => ShowCover();
        SwapPage(page, animate);
    }

    public void ShowInfo()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        if (IsStandalone) { LaunchStandalone(); return; }
        UseFullWindow();
        var page = new InfoPage(_access.TrialRemaining, _access.IsPurchased, _library.Manifest.SelectedGrade, _access.Username);
        page.NextRequested += (_, _) => ShowGames();
        page.BackRequested += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowGames(bool animate = true)
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        if (IsStandalone) { LaunchStandalone(); return; }
        UseFullWindow();
        var page = new GamesBookPage(_library);
        page.GameLaunchRequested += OnGameLaunch;
        page.BackRequested += (_, _) => ShowInfo();
        SwapPage(page, animate);
    }

    private void LaunchStandalone()
    {
        if (!_access.CanEnter || _closed || _launching) return;
        var games = _library.Manifest.Grades.SelectMany(g => g.Games).ToArray();
        if (games.Length != 1)
        {
            MessageBox.Show(this, IncompleteBundleMessage, Title, MessageBoxButton.OK, MessageBoxImage.Error);
            RecoverFromStandaloneFailure();
            return;
        }
        // There is no book-page navigation to unload the activation page in this mode.
        // Stop purchase polling before play; a trial never needs background authorization.
        _activation.Stop(clearIntent: false);
        // Only the preparing card stays visible, with nothing behind it. A failed launch
        // rebuilds the activation page, which restores the normal window look.
        PageHost.Content = null;
        UseSplashWindow();
        UseModalOnlyLook(true);
        LoadingOverlay.Title = "آماده‌سازی برنامه…";
        OnGameLaunch(this, games[0]);
    }

    private void UseModalOnlyLook(bool modalOnly)
    {
        if (modalOnly)
        {
            _windowBackground ??= Background;
            _rootBackground ??= RootGrid.Background;
            _overlayBackground ??= LoadingOverlay.Background;
        }
        Background = modalOnly ? Brushes.Transparent : _windowBackground ?? Background;
        RootGrid.Background = modalOnly ? Brushes.Transparent : _rootBackground ?? RootGrid.Background;
        LoadingOverlay.Background = modalOnly ? Brushes.Transparent : _overlayBackground ?? LoadingOverlay.Background;
        BrandMark.Visibility = modalOnly ? Visibility.Collapsed : Visibility.Visible;
    }

    private const string IncompleteBundleMessage = "فایل بازی کامل نیست. لطفاً برنامه را دوباره نصب کنید.";

    // The splash has no controls, and polling stopped before the launch. A paid copy has nothing
    // left to offer, so it exits; any other copy returns to a fresh activation page, which resumes polling.
    private void RecoverFromStandaloneFailure()
    {
        if (_closed) return;
        if (_access.IsPurchased) Close(); else ShowLock(animate: false);
    }

    private async void OnGameLaunch(object? sender, GameEntry e)
    {
        if (_launching || _closed) return;
        _launching = true;
        using var cancellation = new CancellationTokenSource();
        _launchCancellation = cancellation;
        LoadingOverlay.GameName = e.Name;
        LoadingOverlay.Visibility = Visibility.Visible;
        PageHost.IsEnabled = false;
        Exception? failure = null;
        try
        {
            if (!_access.CanEnter) { ShowLock(); return; }
            var key = _loadGameKey();
            if (IsStandalone)
            {
                var master = key;
                try { key = ProductGameKey.Derive(master, new Product(_access.Sku)); }
                finally { Array.Clear(master, 0, master.Length); }
            }
            try
            {
                var path = AppPaths.ResolveGameFile(e.EncryptedFile);
                var process = await _launcher.LaunchAsync(key, path, e.Name, cancellation.Token);
                await WaitForGameWindowAsync(process, cancellation.Token);
                if (IsStandalone && !_closed)
                {
                    // An early failed exit must not look like a normal close of the game.
                    if (process.HasExited && process.ExitCode != 0)
                        throw new InvalidOperationException($"بازی اجرا نشد (کد {process.ExitCode}).");
                    // Keep the licensing process alive while the child runs: one trial permits
                    // one game process, and disposal must not terminate it prematurely.
                    Hide();
                    await process.WaitForExitAsync(cancellation.Token);
                    if (!_closed) Close();
                }
            }
            finally { Array.Clear(key, 0, key.Length); }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { failure = ex; }
        finally
        {
            _launchCancellation = null;
            _launching = false;
            if (!_closed)
            {
                LoadingOverlay.Visibility = Visibility.Collapsed;
                PageHost.IsEnabled = true;
            }
        }
        if (failure is not null && !_closed)
        {
            if (IsStandalone) Show();
            MessageBox.Show(this, "خطا در اجرای بازی: " + failure.Message, "یاریزان",
                MessageBoxButton.OK, MessageBoxImage.Error);
            if (IsStandalone) RecoverFromStandaloneFailure();
        }
    }

    private static Task WaitForGameWindowAsync(System.Diagnostics.Process process, CancellationToken cancellation) =>
        Task.Run(() =>
        {
            var timer = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                while (timer.Elapsed < TimeSpan.FromSeconds(10))
                {
                    cancellation.ThrowIfCancellationRequested();
                    if (process.HasExited) return;
                    bool ready = process.WaitForInputIdle(100);
                    process.Refresh();
                    if (ready && process.MainWindowHandle != IntPtr.Zero) return;
                    Thread.Sleep(50);
                }
            }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
        }, cancellation);

    private void SwapPage(UserControl next, bool animate)
    {
        PageShown?.Invoke(this, next);
        if (!animate || PageHost.Content is null)
        {
            PageHost.Content = next;
            return;
        }

        next.Opacity = 0;
        next.RenderTransformOrigin = new Point(0.5, 0.5);
        var rotate = new RotateTransform(8);
        next.RenderTransform = rotate;
        PageHost.Content = next;

        var fade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(380))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };
        var unrotate = new DoubleAnimation(8, 0, TimeSpan.FromMilliseconds(420))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
        };
        next.BeginAnimation(OpacityProperty, fade);
        rotate.BeginAnimation(RotateTransform.AngleProperty, unrotate);
    }
}
