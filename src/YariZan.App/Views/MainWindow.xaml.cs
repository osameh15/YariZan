using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using YariZan.App.Services;
using YariZan.Core;

namespace YariZan.App.Views;

public partial class MainWindow : Window
{
    private readonly GameLibrary _library = GameLibrary.LoadOrEmpty();
    private readonly GameLauncher _launcher = new();
    private readonly OnlineTrialClient _trials = new();
    private readonly AccessSession _access;
    private readonly System.Windows.Threading.DispatcherTimer _heartbeat = new() { Interval = TimeSpan.FromSeconds(60) };
    private bool _checking;

    public MainWindow()
    {
        _access = new AccessSession(() => _trials.PaidAuthorized, _trials.ConsumeAsync);
        InitializeComponent();
        Loaded += (_, _) => ShowCover(animate: false);
        _heartbeat.Tick += async (_, _) => { if (_access.CanEnter) await CheckSessionAsync(); };
        _heartbeat.Start();
        Closed += (_, _) => { _heartbeat.Stop(); _launcher.Dispose(); };
    }

    public void ShowCover(bool animate = true)
    {
        var page = new CoverPage();
        page.OpenRequested += async (_, _) =>
        {
            if (_checking) return;
            _checking = true;
            page.IsEnabled = false;
            try
            {
                if (_access.CanEnter) await _trials.ValidateSessionAsync();
                else if (ActivationStore.Load() is { } activation) await _trials.AuthorizePaidAsync(activation.Serial);
                if (_access.CanEnter) ShowInfo(); else ShowLock();
            }
            catch { RevokeAccess(); }
            finally { _checking = false; page.IsEnabled = true; }
        };
        SwapPage(page, animate);
    }

    public void ShowLock()
    {
        var page = new LockPage(_access, _trials);
        page.Activated    += (_, _) => ShowInfo();
        page.TrialStarted += (_, _) => ShowInfo();
        page.Cancelled    += (_, _) => ShowCover();
        SwapPage(page, animate: true);
    }

    public void ShowInfo()
    {
        if (!_access.CanEnter) { ShowLock(); return; }
        var page = new InfoPage(_access.TrialRemaining, _trials.PaidAuthorized);
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
        try
        {
            if (_checking) return;
            if (!await CheckSessionAsync()) return;
            if (!_access.CanEnter) { ShowLock(); return; }
            var key = AppKeys.LoadEmbeddedMasterKey();
            try
            {
                var path = AppPaths.ResolveGameFile(e.EncryptedFile);
                _launcher.Launch(key, path, e.Name);
            }
            finally { Array.Clear(key, 0, key.Length); }
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "خطا در اجرای بازی: " + ex.Message, "یاریزان",
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void RevokeAccess()
    {
        _trials.Revoke();
        _access.Revoke();
        _launcher.StopGames();
        ShowLock();
    }

    private async Task<bool> CheckSessionAsync()
    {
        if (_checking) return false;
        _checking = true;
        try { await _trials.ValidateSessionAsync(); return true; }
        catch { RevokeAccess(); return false; }
        finally { _checking = false; }
    }

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
