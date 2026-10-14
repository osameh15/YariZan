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
    private bool _launching;
    private bool _closed;
    private CancellationTokenSource? _launchCancellation;

    public MainWindow() : this(null) { }

    public MainWindow(DesktopAccessController? access)
    {
        _access = access ?? DesktopAccessFactory.Create(_library.Manifest.SelectedGrade);
        InitializeComponent();
        Title = $"YariZan G{Math.Clamp(_library.Manifest.SelectedGrade, 1, 6)}";
        Loaded += (_, _) =>
        {
            ShowCover(animate: false);
            _ = _access.SynchronizePurchasedAsync();
        };
        Closed += (_, _) =>
        {
            _closed = true;
            _launchCancellation?.Cancel();
            _access.Dispose();
            _launcher.Dispose();
        };
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

    public void ShowLock()
    {
        var page = new LockPage(_access);
        page.Activated    += (_, _) => ShowInfo();
        page.TrialStarted += (_, _) => ShowInfo();
        page.Cancelled    += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowInfo()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        var page = new InfoPage(_access.TrialRemaining, _access.IsPurchased, _library.Manifest.SelectedGrade);
        page.NextRequested += (_, _) => ShowGames();
        page.BackRequested += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowGames()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        var page = new GamesBookPage(_library);
        page.GameLaunchRequested += OnGameLaunch;
        page.BackRequested += (_, _) => ShowInfo();
        SwapPage(page, animate: true);
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
            var key = AppKeys.LoadEmbeddedMasterKey();
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
