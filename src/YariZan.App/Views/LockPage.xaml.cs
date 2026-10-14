using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Input;
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
    private readonly ILockDesktopActions _desktopActions;
    private readonly StoreDestinations _storeDestinations;
    private enum DialogKind { None, ManualCode, Purchase, Support }
    private DialogKind _dialog;
    private Button? _dialogTrigger;
    private double _backgroundOffset;
    private CancellationTokenSource? _activationCancellation;
    private string _preparedMessage = "";
    private bool _renderAfterDialog;

    public LockPage(DesktopAccessController access, ILockDesktopActions? desktopActions = null, StoreDestinations? storeDestinations = null)
    {
        _access = access;
        _desktopActions = desktopActions ?? new WindowsLockDesktopActions();
        _storeDestinations = storeDestinations ?? StoreDestinations.LoadEmbedded();
        InitializeComponent();
        PurchaseButton.Content = _storeDestinations.ForGrade(access.Grade) is null ? "راهنمای خرید" : "خرید این نسخه";
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
        Unloaded += (_, _) => { _lockRefresh.Stop(); _visible?.Cancel(); _visible?.Dispose(); _visible = null; CloseDialog(false); };
        _lockRefresh.Tick += async (_, _) =>
        {
            if (_access.State == DesktopAccessState.ConnectionUnavailable && _dialog == DialogKind.None)
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

    private void SetBusy(bool busy, bool lockCodeInput = false)
    {
        _busy = busy;
        ActivateButton.IsEnabled = RedeemButton.IsEnabled = !busy;
        ActivationCodeInput.IsEnabled = !busy || !lockCodeInput;
        TrialButton.IsEnabled = !busy && (_access.State is DesktopAccessState.TrialAvailable or DesktopAccessState.ConnectionUnavailable);
    }

    private async Task RefreshTrialAsync()
    {
        if (_busy || _visible is null) return;
        SetBusy(true);
        try
        {
            await _access.RefreshTrialStatusAsync(_visible.Token);
            if (_visible is not null)
            {
                if (_dialog == DialogKind.None) RenderState();
                else _renderAfterDialog = true;
            }
        }
        catch (OperationCanceledException) { }
        finally { SetBusy(false); }
    }

    private static string Persian(int number) => string.Concat(number.ToString().Select(c => c is >= '0' and <= '9' ? "۰۱۲۳۴۵۶۷۸۹"[c - '0'] : c));
    private void CopyHwid_Click(object sender, RoutedEventArgs e) { if (_dialog == DialogKind.None) Copy(_access.Username, "شناسه کاربری کپی شد."); }
    private void CopyPhone_Click(object sender, RoutedEventArgs e) => Copy(SupportPhone, "شماره پشتیبانی کپی شد.");
    private void CopyMessage_Click(object sender, RoutedEventArgs e) => Copy(_preparedMessage, "پیام آماده کپی شد.");
    private void Copy(string text, string message)
    {
        try { _desktopActions.CopyText(text); CopyFeedback(message, false); }
        catch { CopyFeedback("کپی نشد؛ دوباره تلاش کنید.", true); }
    }
    private void CopyFeedback(string text, bool error)
    {
        if (_dialog == DialogKind.None) Message(text, error);
        else
        {
            ModalFeedback.Text = text;
            ModalFeedback.Foreground = error ? new SolidColorBrush(Color.FromRgb(139, 0, 0)) : (Brush)FindResource("InkBrush");
        }
    }

    private void ManualCode_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None) return;
        OpenDialog(DialogKind.ManualCode, ManualCodeButton);
    }
    private void Code_TextChanged(object sender, TextChangedEventArgs e) { if (CodeFeedback is not null) CodeFeedback.Text = ""; }
    private void Support_Click(object sender, RoutedEventArgs e) { if (_dialog == DialogKind.None) OpenDialog(DialogKind.Support, SupportButton); }
    private void Purchase_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None) return;
        if (_storeDestinations.ForGrade(_access.Grade) is { } destination)
        {
            try { _desktopActions.OpenProductPage(destination); Message("صفحه خرید این نسخه در مرورگر باز شد."); return; }
            catch { OpenDialog(DialogKind.Purchase, PurchaseButton); CopyFeedback("صفحه خرید باز نشد. می‌توانید از راهنمای زیر استفاده کنید.", true); return; }
        }
        OpenDialog(DialogKind.Purchase, PurchaseButton);
    }

    private void OpenDialog(DialogKind kind, Button trigger)
    {
        _backgroundOffset = LockScroll.VerticalOffset;
        _dialog = kind; _dialogTrigger = trigger;
        string grade = AppBranding.GradeName(_access.Grade);
        ModalTitle.Text = kind switch { DialogKind.ManualCode => "ثبت کد فعال‌سازی", DialogKind.Purchase => $"راهنمای خرید — پایه {grade}", _ => $"پشتیبانی یاریزان — پایه {grade}" };
        ModalDescription.Text = kind switch
        {
            DialogKind.ManualCode => "کد این نسخه را وارد کنید. ثبت کد به اتصال اینترنت نیاز دارد.",
            DialogKind.Purchase => "برای خرید این نسخه، پیام آماده را کپی کنید و با پشتیبانی تماس بگیرید.",
            _ => "برای دریافت راهنمایی، شماره یا پیام آماده را کپی کنید و با پشتیبانی تماس بگیرید."
        };
        _preparedMessage = $"سلام\n{(kind == DialogKind.Purchase ? "درخواست خرید" : "درخواست پشتیبانی")} یاریزان — پایه {grade}\nشناسه کاربری: {_access.Username}\nسپاسگزارم";
        // Isolate only the public username for readable mixed RTL/LTR presentation.
        PreparedMessageText.Text = _preparedMessage.Replace(_access.Username, "\u2066" + _access.Username + "\u2069");
        ModalFeedback.Text = CodeFeedback.Text = "";
        ManualCodePanel.Visibility = kind == DialogKind.ManualCode ? Visibility.Visible : Visibility.Collapsed;
        ContactPanel.Visibility = kind == DialogKind.ManualCode ? Visibility.Collapsed : Visibility.Visible;
        ModalOverlay.Visibility = Visibility.Visible;
        LockScroll.IsEnabled = false;
        ModalScroll.ScrollToTop();
        UpdateLayout();
        FrameworkElement first = kind == DialogKind.ManualCode && ActivationCodeInput.IsEnabled ? ActivationCodeInput : CopyPhoneButton;
        if (kind == DialogKind.ManualCode && !ActivationCodeInput.IsEnabled) first = CloseModalButton;
        FocusManager.SetFocusedElement(ModalOverlay, first);
        first.Focus();
    }
    private void CloseDialog(bool restoreFocus = true)
    {
        if (_dialog == DialogKind.None) return;
        _activationCancellation?.Cancel();
        ActivationCodeInput.Clear();
        _dialog = DialogKind.None;
        ModalOverlay.Visibility = ManualCodePanel.Visibility = ContactPanel.Visibility = Visibility.Collapsed;
        LockScroll.IsEnabled = true;
        if (_renderAfterDialog && _visible is not null) { _renderAfterDialog = false; RenderState(); }
        if (restoreFocus) _dialogTrigger?.Focus();
        LockScroll.ScrollToVerticalOffset(_backgroundOffset);
        _dialogTrigger = null;
    }
    private void CloseModal_Click(object sender, RoutedEventArgs e) => CloseDialog();
    private void Modal_RequestBringIntoView(object sender, RequestBringIntoViewEventArgs e) => e.Handled = true;
    private void Page_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (PrimaryActions is not null) PrimaryActions.Columns = e.NewSize.Width < 520 ? 1 : 2;
        if (ModalCard is not null)
        {
            bool compact = e.NewSize.Height < 480;
            ModalCard.MaxHeight = Math.Max(1, e.NewSize.Height - 32);
            ModalCard.Padding = new Thickness(compact ? 12 : 20);
            ModalTitle.FontSize = compact ? 20 : 22;
            ModalTitle.Margin = new Thickness(0, 0, 0, compact ? 8 : 12);
            CloseModalButton.Margin = new Thickness(0, compact ? 8 : 12, 0, 0);
        }
    }

    private void Page_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && _dialog != DialogKind.None) { CloseDialog(); e.Handled = true; return; }
        var scroll = _dialog == DialogKind.None ? LockScroll : ModalScroll;
        if (e.Key == Key.PageDown) { scroll.PageDown(); e.Handled = true; }
        else if (e.Key == Key.PageUp) { scroll.PageUp(); e.Handled = true; }
        else if (Keyboard.FocusedElement is not TextBox)
        {
            if (e.Key == Key.Down) { scroll.LineDown(); e.Handled = true; }
            else if (e.Key == Key.Up) { scroll.LineUp(); e.Handled = true; }
            else if (e.Key == Key.Home) { scroll.ScrollToTop(); e.Handled = true; }
            else if (e.Key == Key.End) { scroll.ScrollToBottom(); e.Handled = true; }
        }
    }
    private void Page_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        var scroll = _dialog == DialogKind.None ? LockScroll : ModalScroll;
        if (scroll.ScrollableHeight > 0)
        {
            double step = SystemParameters.WheelScrollLines < 0 ? scroll.ViewportHeight : SystemParameters.WheelScrollLines * 16;
            scroll.ScrollToVerticalOffset(scroll.VerticalOffset - e.Delta / 120.0 * step);
            e.Handled = true;
        }
        else if (_dialog != DialogKind.None) e.Handled = true;
    }

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
        SetBusy(true, lockCodeInput: manual);
        if (manual) CodeFeedback.Text = "در حال فعال‌سازی نسخه…";
        else Message("در حال فعال‌سازی نسخه…");
        using var requestCancellation = CancellationTokenSource.CreateLinkedTokenSource(_visible.Token);
        if (manual) _activationCancellation = requestCancellation;
        try
        {
            if (manual) await _access.RedeemActivationCodeAsync(ActivationCodeInput.Text, requestCancellation.Token);
            else await _access.PickupLicenseAsync(requestCancellation.Token);
            if (_visible is not null && _access.IsPurchased)
            {
                ActivationCodeInput.Clear();
                CloseDialog();
                ManualCodeButton.IsEnabled = PurchaseButton.IsEnabled = false;
                Message("نسخه شما فعال شد. از این پس می‌توانید بدون اینترنت بازی کنید.");
                // Keep success visible; entry is explicit and requires no second network call.
                ActivateButton.Content = "ورود به بازی";
                _ = _access.SynchronizePurchasedAsync();
            }
        }
        catch (OperationCanceledException ex) { if (_visible is not null && !requestCancellation.IsCancellationRequested) { if (!manual) Message(""); ShowFailure(ex, manual); } }
        catch (Exception ex) { if (_visible is not null) { if (!manual) Message(""); ShowFailure(ex, manual); } }
        finally
        {
            _activationCancellation = null; SetBusy(false);
            if (_visible is not null && _access.IsPurchased && _dialog == DialogKind.None) ActivateButton.Focus();
        }
    }
    private async void Activate_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None) return;
        if (_access.IsPurchased) { Activated?.Invoke(this, EventArgs.Empty); return; }
        await ActivateAsync(false);
    }
    private async void Redeem_Click(object sender, RoutedEventArgs e)
    { if (_dialog == DialogKind.ManualCode) await ActivateAsync(true); }

    private async void Trial_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || _visible is null || _dialog != DialogKind.None) return;
        if (_access.State != DesktopAccessState.TrialAvailable) { await RefreshTrialAsync(); return; }
        SetBusy(true);
        try { await _access.StartTrialAsync(_visible.Token); if (_visible is not null) TrialStarted?.Invoke(this, EventArgs.Empty); }
        catch (OperationCanceledException) { }
        catch { if (_visible is not null) RenderState(); }
        finally { SetBusy(false); }
    }
    private void Cancel_Click(object sender, RoutedEventArgs e) { if (_dialog == DialogKind.None) Cancelled?.Invoke(this, EventArgs.Empty); }
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) { if (Window.GetWindow(this) is { } window) window.WindowState = WindowState.Minimized; }
}
