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
    private CancellationTokenSource? _launchCancellation;

    public MainWindow() : this(null) { }

    /// <summary>Pause between the visible success message and entering the game library.</summary>
    public TimeSpan ActivationEntryDelay { get; set; } = TimeSpan.FromMilliseconds(1600);

    public MainWindow(DesktopAccessController? access, Func<byte[]>? loadGameKey = null, PaidActivationCoordinator? activation = null)
    {
        _access = access ?? DesktopAccessFactory.Create(_library.Manifest.SelectedGrade);
        _activation = activation ?? new PaidActivationCoordinator(_access, DesktopAccessFactory.CreateActivationIntentStore());
        _activation.Activated += OnPaidActivated;
        _loadGameKey = loadGameKey ?? AppKeys.LoadEmbeddedMasterKey;
        InitializeComponent();
        Title = $"YariZan G{Math.Clamp(_library.Manifest.SelectedGrade, 1, 6)}";
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
    /// Launch routing. A locally verified paid license enters the library at once with no network wait.
    /// An enrolled device without one gets a short bounded online pickup check, or resumes a wait the
    /// customer started earlier. Everything else starts at the cover as before.
    /// </summary>
    private void ShowStartPage()
    {
        if (_access.IsPurchased)
        {
            ShowGames(animate: false);
            _ = _access.SynchronizePurchasedAsync();
            return;
        }
        if (_activation.CanCheckOnline && _activation.HasPendingIntent) { ShowLock(animate: false); return; }
        ShowCover(animate: false);
        if (_activation.CanCheckOnline) _ = _activation.StartStartupRecoveryAsync();
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
            lockPage.ShowEnteringGames();
            await Task.Delay(ActivationEntryDelay / 4);
            if (_closed || PageHost.Content != lockPage) return;
        }
        // Never pull the customer out of a page they chose (information, library or a running game).
        else if (PageHost.Content is not CoverPage) return;
        if (!_closed && _access.IsPurchased) ShowGames();
    }

    public void ShowCover(bool animate = true)
    {
        var page = new CoverPage(_library.Manifest.SelectedGrade);
        page.OpenRequested += (_, _) =>
        {
            if (_access.CanEnter) ShowInfo(); else ShowLock();
        };
        SwapPage(page, animate);
    }

    public void ShowLock(bool animate = true)
    {
        var page = new LockPage(_access, activation: _activation);
        page.Activated    += (_, _) => ShowInfo();
        page.TrialStarted += (_, _) => ShowInfo();
        page.Cancelled    += (_, _) => ShowCover();
        SwapPage(page, animate);
    }

    public void ShowInfo()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        var page = new InfoPage(_access.TrialRemaining, _access.IsPurchased, _library.Manifest.SelectedGrade);
        page.NextRequested += (_, _) => ShowGames();
        page.BackRequested += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowGames(bool animate = true)
    {
        if (!_access.CanEnter) { ShowLock(); return; }
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
