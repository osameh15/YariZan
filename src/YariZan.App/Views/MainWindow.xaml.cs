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

    public MainWindow()
    {
        _access = new AccessSession(() => ActivationStore.Load() is not null, _trials.ConsumeAsync);
        InitializeComponent();
        Loaded += (_, _) => { if (_access.CanEnter) ShowCover(animate: false); else ShowLock(); };
        Closed += (_, _) => _launcher.Dispose();
    }

    public void ShowCover(bool animate = true)
    {
        var page = new CoverPage();
        page.OpenRequested += (_, _) =>
        {
            if (_access.CanEnter) ShowInfo();
            else ShowLock();
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
        var page = new InfoPage(_access.TrialRemaining);
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

    private void OnGameLaunch(object? sender, GameEntry e)
    {
        try
        {
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
