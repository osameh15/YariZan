using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using YariZan.Core.V2;

namespace YariZan.App.Views;

public partial class LockPage : UserControl
{
    public event EventHandler? Activated;
    public event EventHandler? TrialStarted;
    public event EventHandler? Cancelled;
    private const string SupportPhone = "0918-876-4024";
    private readonly DesktopAccessController _access;
    private readonly DispatcherTimer _lockRefresh = new() { Interval = TimeSpan.FromSeconds(15) };
    private CancellationTokenSource? _visible;
    private bool _busy;

    public LockPage(DesktopAccessController access)
    {
        _access = access;
        InitializeComponent();
        HwidText.Text = access.Username;
        TrialButton.Content = "بررسی آزمایش…";
        TrialButton.IsEnabled = false;
        Loaded += async (_, _) =>
        {
            _visible = new CancellationTokenSource();
            _lockRefresh.Start();
            await RefreshTrialAsync();
        };
        Unloaded += (_, _) => { _lockRefresh.Stop(); _visible?.Cancel(); _visible?.Dispose(); _visible = null; };
        _lockRefresh.Tick += async (_, _) =>
        {
            if (_access.State == DesktopAccessState.ConnectionUnavailable) await RefreshTrialAsync();
        };
    }

    private void RenderState()
    {
        TrialButton.IsEnabled = true;
        switch (_access.State)
        {
            case DesktopAccessState.TrialAvailable:
                TrialButton.Content = $"شروع آزمایش ({Persian(_access.TrialRemaining ?? 0)}/۲)";
                StatusText.Text = "بررسی وضعیت مصرف نمی‌کند. پس از شروع، این اجرای برنامه به اینترنت نیاز ندارد.";
                break;
            case DesktopAccessState.TrialExhausted:
                TrialButton.IsEnabled = false; TrialButton.Content = "آزمایش به پایان رسیده";
                StatusText.Text = "دو ورود آزمایشی این پایه مصرف شده است. برای فعال‌سازی به حساب متصل شوید.";
                break;
            case DesktopAccessState.EnrollmentRequired:
                TrialButton.IsEnabled = false; TrialButton.Content = "ثبت دستگاه لازم است";
                StatusText.Text = "اتصال امن دستگاه و سرویس جدید هنوز آماده نیست. با پشتیبانی تماس بگیرید.";
                break;
            default:
                TrialButton.Content = "بررسی دوبارهٔ ارتباط";
                StatusText.Text = "برای شروع آزمایش یا دریافت مجوز به سرویس آنلاین نیاز است. دوباره تلاش کنید.";
                break;
        }
        if (_access.LocalLicenseState == DesktopAccessState.Revoked)
            StatusText.Text += " مجوز خریداری‌شده قبلاً لغو شده است؛ با پشتیبانی تماس بگیرید.";
        if (_access.LocalLicenseState == DesktopAccessState.InvalidLicense)
            StatusText.Text += " مجوز ذخیره‌شده معتبر نیست؛ دریافت مجدد را بررسی کنید.";
    }

    private async Task RefreshTrialAsync()
    {
        if (_busy || _visible is null) return;
        _busy = true;
        ActivateButton.IsEnabled = TrialButton.IsEnabled = false;
        try
        {
            await _access.RefreshTrialStatusAsync(_visible.Token);
            if (_visible is not null) RenderState();
        }
        catch (OperationCanceledException) { }
        finally { _busy = false; if (_visible is not null) ActivateButton.IsEnabled = true; }
    }

    private static string Persian(int number) => string.Concat(number.ToString().Select(c => c is >= '0' and <= '9' ? "۰۱۲۳۴۵۶۷۸۹"[c - '0'] : c));
    private void CopyHwid_Click(object sender, RoutedEventArgs e) => Copy(_access.Username, "نام کاربری دستگاه کپی شد.");
    private void CopyPhone_Click(object sender, RoutedEventArgs e) => Copy(SupportPhone, "شمارهٔ پشتیبانی کپی شد.");
    private void CopyMessage_Click(object sender, RoutedEventArgs e) => Copy(
        $"سلام\nدرخواست راهنمایی فعال‌سازی یاریزان\nنام کاربری دستگاه: {_access.Username}\nسپاسگزارم", "پیام پشتیبانی کپی شد.");
    private void Copy(string text, string message)
    { try { Clipboard.SetText(text); StatusText.Text = message; } catch { StatusText.Text = "کپی نشد؛ دوباره تلاش کنید."; } }

    private async void Activate_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || _visible is null) return;
        _busy = true; IsEnabled = false;
        try
        {
            await _access.PickupLicenseAsync(_visible.Token);
            if (_visible is not null) { Activated?.Invoke(this, EventArgs.Empty); _ = _access.SynchronizePurchasedAsync(); }
        }
        catch (EnrollmentRequiredException) { if (_visible is not null) StatusText.Text = "اتصال امن دستگاه و سرویس فعال‌سازی جدید هنوز آماده نیست."; }
        catch (OperationCanceledException) { }
        catch { if (_visible is not null) StatusText.Text = "مجوز دریافت نشد. ارتباط، حساب و دسترسی ذخیره‌سازی را بررسی کنید."; }
        finally { _busy = false; IsEnabled = true; }
    }

    private async void Trial_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || _visible is null) return;
        if (_access.State != DesktopAccessState.TrialAvailable) { await RefreshTrialAsync(); return; }
        _busy = true; IsEnabled = false;
        try
        {
            await _access.StartTrialAsync(_visible.Token);
            if (_visible is not null) TrialStarted?.Invoke(this, EventArgs.Empty);
        }
        catch (OperationCanceledException) { }
        catch { if (_visible is not null) RenderState(); }
        finally { _busy = false; IsEnabled = true; }
    }
    private void Cancel_Click(object sender, RoutedEventArgs e) => Cancelled?.Invoke(this, EventArgs.Empty);
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) => Window.GetWindow(this).WindowState = WindowState.Minimized;
}
