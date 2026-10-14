using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using YariZan.App.Services;
using YariZan.Core.V2;

namespace YariZan.App.Views;

public partial class LockPage : UserControl
{
    public event EventHandler? Activated;
    public event EventHandler? TrialStarted;
    public event EventHandler? Cancelled;
    private const string SupportPhone = "0918-876-4024";
    private const string NetworkMessage = "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.";
    private const string CodeMessage = "کد فعال‌سازی معتبر نیست یا برای این نسخه صادر نشده است.";
    private const string BlockMessage = "دسترسی این دستگاه به این نسخه مسدود شده است. لطفاً با پشتیبانی تماس بگیرید.";
    private readonly DesktopAccessController _access;
    private readonly DispatcherTimer _lockRefresh = new() { Interval = TimeSpan.FromSeconds(15) };
    private CancellationTokenSource? _visible;
    private bool _busy;

    public LockPage(DesktopAccessController access)
    {
        _access = access;
        InitializeComponent();
        ActivationTitle.Text = $"فعال‌سازی یاریزان — پایه {AppBranding.GradeName(access.Grade)}";
        HwidText.Text = access.Username;
        TrialCountText.Text = "در حال بررسی فرصت‌های آزمایشی…";
        TrialButton.IsEnabled = false;
        Loaded += async (_, _) =>
        {
            _visible = new CancellationTokenSource();
            _lockRefresh.Start();
            await RefreshTrialAsync();
        };
        Unloaded += (_, _) => { _lockRefresh.Stop(); _visible?.Cancel(); _visible?.Dispose(); _visible = null; ActivationCodeInput.Clear(); };
        _lockRefresh.Tick += async (_, _) =>
        {
            if (_access.State == DesktopAccessState.ConnectionUnavailable && ManualCodePanel.Visibility != Visibility.Visible)
                await RefreshTrialAsync();
        };
    }

    private void Message(string text, bool error = false)
    {
        StatusText.Text = text;
        StatusPanel.Visibility = string.IsNullOrEmpty(text) ? Visibility.Collapsed : Visibility.Visible;
        StatusText.Foreground = error ? new SolidColorBrush(Color.FromRgb(139, 0, 0)) : (Brush)FindResource("InkBrush");
        StatusPanel.Background = new SolidColorBrush(error ? Color.FromArgb(20, 139, 0, 0) : Color.FromArgb(16, 70, 90, 20));
    }

    private void RenderState()
    {
        TrialButton.IsEnabled = _access.State is DesktopAccessState.TrialAvailable or DesktopAccessState.ConnectionUnavailable;
        TrialCountText.Text = _access.TrialRemaining is { } count ? $"{Persian(count)} فرصت باقی‌مانده" : "فرصت‌های آزمایشی هنوز بررسی نشده است.";
        Message(_access.State switch
        {
            DesktopAccessState.TrialExhausted => "فرصت‌های آزمایشی این نسخه به پایان رسیده است.",
            DesktopAccessState.ProductBlocked => BlockMessage,
            DesktopAccessState.ConnectionUnavailable => NetworkMessage,
            DesktopAccessState.EnrollmentRequired => "اتصال امن این دستگاه هنوز آماده نیست. لطفاً با پشتیبانی تماس بگیرید.",
            _ => ""
        }, _access.State is DesktopAccessState.ProductBlocked or DesktopAccessState.ConnectionUnavailable);
        if (_access.LocalLicenseState == DesktopAccessState.Revoked)
            Message("مجوز این نسخه لغو شده است. لطفاً با پشتیبانی تماس بگیرید.", true);
        else if (_access.LocalLicenseState == DesktopAccessState.InvalidLicense)
            Message("مجوز ذخیره‌شده معتبر نیست. لطفاً فعال‌سازی نسخه را دوباره بررسی کنید.", true);
    }

    private void SetBusy(bool busy)
    {
        _busy = busy;
        ActivateButton.IsEnabled = RedeemButton.IsEnabled = ActivationCodeInput.IsEnabled = !busy;
        TrialButton.IsEnabled = !busy && (_access.State is DesktopAccessState.TrialAvailable or DesktopAccessState.ConnectionUnavailable);
    }

    private async Task RefreshTrialAsync()
    {
        if (_busy || _visible is null) return;
        SetBusy(true);
        try { await _access.RefreshTrialStatusAsync(_visible.Token); if (_visible is not null) RenderState(); }
        catch (OperationCanceledException) { }
        finally { SetBusy(false); }
    }

    private static string Persian(int number) => string.Concat(number.ToString().Select(c => c is >= '0' and <= '9' ? "۰۱۲۳۴۵۶۷۸۹"[c - '0'] : c));
    private void CopyHwid_Click(object sender, RoutedEventArgs e) => Copy(_access.Username, "شناسه کاربری کپی شد.");
    private void CopyPhone_Click(object sender, RoutedEventArgs e) => Copy(SupportPhone, "شماره پشتیبانی کپی شد.");
    private void CopyMessage_Click(object sender, RoutedEventArgs e) => Copy(
        $"سلام\nدرخواست راهنمایی فعال‌سازی یاریزان — پایه {AppBranding.GradeName(_access.Grade)}\nشناسه کاربری: {_access.Username}\nسپاسگزارم", "پیام پشتیبانی کپی شد.");
    private void Copy(string text, string message)
    { try { Clipboard.SetText(text); Message(message); } catch { Message("کپی نشد؛ دوباره تلاش کنید.", true); } }

    private void ManualCode_Click(object sender, RoutedEventArgs e)
    {
        ManualCodePanel.Visibility = ManualCodePanel.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible;
        if (ManualCodePanel.Visibility == Visibility.Visible) { ActivationCodeInput.Focus(); ManualCodePanel.BringIntoView(); }
    }
    private void Code_TextChanged(object sender, TextChangedEventArgs e) { if (CodeFeedback is not null) CodeFeedback.Text = ""; }
    private void Support_Click(object sender, RoutedEventArgs e) { PhoneText.Focus(); SupportCard.BringIntoView(); }
    private void Purchase_Click(object sender, RoutedEventArgs e) =>
        Message($"برای خرید نسخه پایه {AppBranding.GradeName(_access.Grade)} با پشتیبانی تماس بگیرید.");

    private void ShowFailure(Exception ex, bool manual)
    {
        string text = ex switch
        {
            EnrollmentRequiredException => "اتصال امن این دستگاه هنوز آماده نیست. لطفاً با پشتیبانی تماس بگیرید.",
            V2ApiException { Code: "PRODUCT_BLOCKED" } => BlockMessage,
            V2ApiException { Code: "ACCOUNT_RESTRICTED" } => "دسترسی حساب محدود شده است. لطفاً با پشتیبانی تماس بگیرید.",
            V2ApiException { Code: "RATE_LIMITED" } => "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
            V2ApiException { Code: "ACTIVATION_CODE_INVALID" or "ACTIVATION_CODE_EXPIRED" or "ACTIVATION_CODE_CANCELLED" or "ACTIVATION_CODE_USED" } => CodeMessage,
            System.Net.Http.HttpRequestException or OperationCanceledException => NetworkMessage,
            _ => "فعال‌سازی انجام نشد. لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید."
        };
        if (manual) CodeFeedback.Text = text; else Message(text, true);
    }

    private async Task ActivateAsync(bool manual)
    {
        if (_busy || _visible is null) return;
        if (manual)
        {
            try { ActivationCode.Normalize(ActivationCodeInput.Text); }
            catch (ArgumentException) { CodeFeedback.Text = CodeMessage; ActivationCodeInput.Focus(); return; }
        }
        SetBusy(true);
        Message("در حال فعال‌سازی نسخه…");
        try
        {
            if (manual) await _access.RedeemActivationCodeAsync(ActivationCodeInput.Text, _visible.Token);
            else await _access.PickupLicenseAsync(_visible.Token);
            if (_visible is not null && _access.IsPurchased)
            {
                ActivationCodeInput.Clear();
                ManualCodePanel.Visibility = Visibility.Collapsed;
                ManualCodeButton.IsEnabled = PurchaseButton.IsEnabled = false;
                Message("نسخه شما فعال شد. از این پس می‌توانید بدون اینترنت بازی کنید.");
                // Keep success visible; entry is explicit and requires no second network call.
                ActivateButton.Content = "ورود به بازی";
                _ = _access.SynchronizePurchasedAsync();
            }
        }
        catch (OperationCanceledException ex) { if (_visible is not null) { Message(""); ShowFailure(ex, manual); } }
        catch (Exception ex) { if (_visible is not null) { Message(""); ShowFailure(ex, manual); } }
        finally { SetBusy(false); }
    }
    private async void Activate_Click(object sender, RoutedEventArgs e)
    {
        if (_access.IsPurchased) { Activated?.Invoke(this, EventArgs.Empty); return; }
        await ActivateAsync(false);
    }
    private async void Redeem_Click(object sender, RoutedEventArgs e) => await ActivateAsync(true);

    private async void Trial_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || _visible is null) return;
        if (_access.State != DesktopAccessState.TrialAvailable) { await RefreshTrialAsync(); return; }
        SetBusy(true);
        try { await _access.StartTrialAsync(_visible.Token); if (_visible is not null) TrialStarted?.Invoke(this, EventArgs.Empty); }
        catch (OperationCanceledException) { }
        catch { if (_visible is not null) RenderState(); }
        finally { SetBusy(false); }
    }
    private void Cancel_Click(object sender, RoutedEventArgs e) => Cancelled?.Invoke(this, EventArgs.Empty);
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) { if (Window.GetWindow(this) is { } window) window.WindowState = WindowState.Minimized; }
}
