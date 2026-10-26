using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using YariZan.App.Services;
using YariZan.Core;
using YariZan.Core.V2;

namespace YariZan.App.Views;

public partial class MainWindow : Window
{
    private readonly GameLibrary _library = GameLibrary.LoadOrEmpty();
    private readonly GameLauncher _launcher = new();
    private readonly DesktopAccessController _access;
    private readonly PaidActivationCoordinator _activation;
    private readonly Func<byte[]> _loadGameKey;
    private bool _launching;
    private bool _closed;
    private bool _compact;
    private CancellationTokenSource? _launchCancellation;

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

    public MainWindow(DesktopAccessController? access, Func<byte[]>? loadGameKey = null, PaidActivationCoordinator? activation = null)
    {
        _access = access ?? DesktopAccessFactory.Create(_library.Manifest.SelectedGrade);
        _activation = activation ?? new PaidActivationCoordinator(_access, DesktopAccessFactory.CreateActivationIntentStore());
        _activation.Activated += OnPaidActivated;
        _loadGameKey = loadGameKey ?? AppKeys.LoadEmbeddedMasterKey;
        InitializeComponent();
        Title = $"YariZan G{Math.Clamp(_library.Manifest.SelectedGrade, 1, 6)}"
            + (DesktopV2Client.LocalAcceptance ? " — LOCAL ACCEPTANCE BUILD (not for distribution)" : "")
#if YARIZAN_ACCEPTANCE_CANDIDATE
            // Physical acceptance candidate: production root and API, but visibly not a release.
            + " — ACCEPTANCE CANDIDATE (not for distribution)"
#endif
            ;
        // Decide the first layout before the window appears, so a not-yet-activated copy never flashes full screen.
        if (_access.IsPurchased) WindowState = WindowState.Maximized; else UseCompactWindow();
        MouseLeftButtonDown += (_, e) =>
        {
            // The compact window has no title bar; any free area moves it.
            if (_compact && e.ButtonState == System.Windows.Input.MouseButtonState.Pressed)
                try { DragMove(); } catch (InvalidOperationException) { }
        };
        Loaded += (_, _) => ShowStartPage();
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
            ShowCover(animate: false);
            _ = _access.SynchronizePurchasedAsync();
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
            await Task.Delay(ActivationEntryDelay / 4);
            if (_closed || PageHost.Content != lockPage) return;
        }
        else if (PageHost.Content is ActivationRecoveryPage recovery)
        {
            recovery.ShowActivationSucceeded();
            await Task.Delay(ActivationEntryDelay);
            if (_closed || PageHost.Content != recovery) return;
            recovery.ShowEntering();
            await Task.Delay(ActivationEntryDelay / 4);
            if (_closed || PageHost.Content != recovery) return;
        }
        // Never pull the customer out of a page they chose (information, library or a running game).
        else if (PageHost.Content is not CoverPage) return;
        // Every activated entry continues through the information page to the game book.
        if (!_closed && _access.IsPurchased) ShowInfo();
    }

    public void ShowCover(bool animate = true)
    {
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
        UseCompactWindow();
        var page = new LockPage(_access, activation: _activation, resumeWaiting: resumeWaiting);
        if (firstPage) page.HideBack();
        page.Activated    += (_, _) => ShowInfo();
        page.TrialStarted += (_, _) => ShowInfo();
        page.Cancelled    += (_, _) => ShowCover();
        SwapPage(page, animate);
    }

    public void ShowInfo()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        UseFullWindow();
        var page = new InfoPage(_access.TrialRemaining, _access.IsPurchased, _library.Manifest.SelectedGrade, _access.Username);
        page.NextRequested += (_, _) => ShowGames();
        page.BackRequested += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowGames(bool animate = true)
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        UseFullWindow();
        var page = new GamesBookPage(_library);
        page.GameLaunchRequested += OnGameLaunch;
        page.BackRequested += (_, _) => ShowInfo();
        SwapPage(page, animate);
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
            try
            {
                var path = AppPaths.ResolveGameFile(e.EncryptedFile);
                var process = await _launcher.LaunchAsync(key, path, e.Name, cancellation.Token);
                await WaitForGameWindowAsync(process, cancellation.Token);
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
            MessageBox.Show(this, "خطا در اجرای بازی: " + failure.Message, "یاریزان",
                MessageBoxButton.OK, MessageBoxImage.Error);
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
