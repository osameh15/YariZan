using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
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
    private CancellationTokenSource? _pairingCancellation;
    private readonly ILockDesktopActions _desktopActions;
    private readonly StoreDestinations _storeDestinations;
    private enum DialogKind { None, ManualCode, Purchase, Support, Pairing }
    private DialogKind _dialog;
    private Button? _dialogTrigger;
    private double _backgroundOffset;
    private CancellationTokenSource? _activationCancellation;
    private string _preparedMessage = "";
    private bool _renderAfterDialog;
    private readonly PaidActivationCoordinator _activation;
    private bool _connectedThisVisit;
    private bool _entering;

    public LockPage(DesktopAccessController access, ILockDesktopActions? desktopActions = null, StoreDestinations? storeDestinations = null,
        PaidActivationCoordinator? activation = null)
    {
        _access = access;
        _desktopActions = desktopActions ?? new WindowsLockDesktopActions();
        _storeDestinations = storeDestinations ?? StoreDestinations.LoadEmbedded();
        // The window normally owns the coordinator; a standalone page gets a private, memory-only one.
        _activation = activation ?? new PaidActivationCoordinator(access);
        InitializeComponent();
        WaitPurchaseButton.Content = _storeDestinations.ForGrade(access.Grade) is null ? "راهنمای خرید" : "باز کردن صفحه خرید";
        ConnectButton.IsEnabled = access.Provisioning is not null;
        ConnectButton.ToolTip = access.Provisioning is null ? "اتصال تجاری تا تأیید امنیت و کلیدهای رسمی بسته است." : "تأیید مرورگر؛ دریافت مجوز فقط در برنامه";
        PurchaseButton.Content = _storeDestinations.ForGrade(access.Grade) is null ? "راهنمای خرید" : "خرید این نسخه";
        ActivationTitle.Text = $"فعال‌سازی یاریزان — پایه {AppBranding.GradeName(access.Grade)}";
        HwidText.Text = access.Username;
        TrialCountText.Text = "در حال بررسی فرصت‌های آزمایشی…";
        TrialButton.IsEnabled = false;
        Loaded += async (_, _) =>
        {
            _visible = new CancellationTokenSource();
            _activation.Changed += Activation_Changed;
            _lockRefresh.Start();
            // A wait the customer started earlier resumes; nothing is assumed paid until a signed license verifies.
            if (_activation.HasPendingIntent && _activation.CanCheckOnline && !_activation.IsRunning) _ = _activation.StartWaitingAsync();
            RenderActivation();
            await RefreshTrialAsync();
        };
        Unloaded += (_, _) =>
        {
            _lockRefresh.Stop(); _visible?.Cancel(); _visible?.Dispose(); _visible = null; CloseDialog(false);
            _activation.Changed -= Activation_Changed;
            // Leaving the page ends the visible wait; the customer's intent is kept for the next visit or launch.
            if (_activation.Mode == PaidActivationMode.Waiting && _activation.IsRunning) _activation.Stop(clearIntent: false);
        };
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
            DesktopAccessState.ConnectionUnavailable => "ارتباط با سرور برقرار نشد. برای فعال‌سازی اولیه یا شروع آزمایش به اینترنت نیاز دارید.",
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
        ConnectButton.IsEnabled = !busy && _access.Provisioning is not null;
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

    private async void Connect_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None || _access.Provisioning is null || _busy) return;
        SetBusy(true);
        _pairingCancellation?.Dispose();
        _pairingCancellation=CancellationTokenSource.CreateLinkedTokenSource(_visible?.Token ?? CancellationToken.None);
        var cancellation=_pairingCancellation.Token;
        try
        {
            if(await _access.Provisioning.ResumeAsync(cancellation))
            {
                await _access.ReloadProvisionedIdentityAsync(cancellation); SetBusy(false); await RefreshTrialAsync();
                Message("اتصال امن دستگاه آماده است."); BeginWaitingAfterConnect(); return;
            }
            var pair=await _access.Provisioning.BeginAsync(cancellation);
            cancellation.ThrowIfCancellationRequested();
            OpenDialog(DialogKind.Pairing,ConnectButton);
            PairingIdText.Text=pair.Id; PairingCodeText.Text=pair.BrowserCode;
            PairingFeedback.Text="در حال اتصال امن دستگاه… پس از تأیید در مرورگر، اتصال خودکار بررسی می‌شود. کد پنج دقیقه اعتبار دارد.";
            while(DateTimeOffset.UtcNow<pair.ExpiresAt)
            {
                await Task.Delay(TimeSpan.FromSeconds(5),cancellation);
                if(await _access.Provisioning.CompleteAsync(cancellation))
                {
                    CloseDialog(); await _access.ReloadProvisionedIdentityAsync(_visible?.Token??CancellationToken.None);
                    SetBusy(false); await RefreshTrialAsync(); Message(""); BeginWaitingAfterConnect(); return;
                }
            }
            PairingCodeText.Clear(); PairingFeedback.Text="درخواست منقضی شد. پنجره را ببندید و دوباره درخواست بگیرید.";
        }
        catch(OperationCanceledException) { }
        catch(Exception ex) { if(_dialog==DialogKind.Pairing)PairingFeedback.Text="اتصال کامل نشد. پنجره را ببندید و دوباره تلاش کنید؛ مجوز آفلاین موجود تغییر نمی‌کند."; else ShowFailure(ex,false); }
        finally { SetBusy(false); if(_dialog==DialogKind.None && _visible is not null)ConnectButton.Focus(); }
    }
    private void CopyPairingId_Click(object sender,RoutedEventArgs e) { try { _desktopActions.CopyText(PairingIdText.Text); PairingFeedback.Text="شناسه کپی شد."; } catch { PairingFeedback.Text="کپی ممکن نشد؛ متن را انتخاب کنید."; } }
    private void CopyPairingCode_Click(object sender,RoutedEventArgs e) { try { _desktopActions.CopyText(PairingCodeText.Text); PairingFeedback.Text="کد کپی شد؛ فقط در صفحهٔ اتصال وارد کنید."; } catch { PairingFeedback.Text="کپی ممکن نشد؛ متن را انتخاب کنید."; } }
    private void OpenConnect_Click(object sender,RoutedEventArgs e) { try { _desktopActions.OpenConnectPage(); } catch { PairingFeedback.Text="صفحه باز نشد. نشانی رسمی صفحهٔ اتصال را در مرورگر باز کنید."; } }

    private void OpenDialog(DialogKind kind, Button trigger)
    {
        _backgroundOffset = LockScroll.VerticalOffset;
        _dialog = kind; _dialogTrigger = trigger;
        string grade = AppBranding.GradeName(_access.Grade);
        ModalTitle.Text = kind switch { DialogKind.Pairing => "اتصال امن به حساب", DialogKind.ManualCode => "ثبت کد فعال‌سازی", DialogKind.Purchase => $"راهنمای خرید — پایه {grade}", _ => $"پشتیبانی یاریزان — پایه {grade}" };
        ModalDescription.Text = kind switch
        {
            DialogKind.Pairing => "شناسه و کد را فقط در صفحهٔ اتصال وارد کنید. مرورگر دستگاه را تأیید می‌کند؛ مجوز فقط در همین برنامه دریافت می‌شود.",
            DialogKind.ManualCode => "کد این نسخه را وارد کنید. ثبت کد به اتصال اینترنت نیاز دارد.",
            DialogKind.Purchase => "برای خرید این نسخه، پیام آماده را کپی کنید و با پشتیبانی تماس بگیرید.",
            _ => "برای دریافت راهنمایی، شماره یا پیام آماده را کپی کنید و با پشتیبانی تماس بگیرید."
        };
        _preparedMessage = $"سلام\n{(kind == DialogKind.Purchase ? "درخواست خرید" : "درخواست پشتیبانی")} یاریزان — پایه {grade}\nشناسه کاربری: {_access.Username}\nسپاسگزارم";
        // Isolate only the public username for readable mixed RTL/LTR presentation.
        PreparedMessageText.Text = _preparedMessage.Replace(_access.Username, "\u2066" + _access.Username + "\u2069");
        ModalFeedback.Text = CodeFeedback.Text = "";
        ManualCodePanel.Visibility = kind == DialogKind.ManualCode ? Visibility.Visible : Visibility.Collapsed;
        ContactPanel.Visibility = kind is DialogKind.ManualCode or DialogKind.Pairing ? Visibility.Collapsed : Visibility.Visible;
        PairingPanel.Visibility = kind == DialogKind.Pairing ? Visibility.Visible : Visibility.Collapsed;
        ModalOverlay.Visibility = Visibility.Visible;
        LockScroll.IsEnabled = false;
        ModalScroll.ScrollToTop();
        UpdateLayout();
        FrameworkElement first = kind == DialogKind.ManualCode && ActivationCodeInput.IsEnabled ? ActivationCodeInput : CopyPhoneButton;
        if (kind == DialogKind.ManualCode && !ActivationCodeInput.IsEnabled) first = CloseModalButton;
        FocusManager.SetFocusedElement(ModalOverlay, first);
        if(kind==DialogKind.Pairing)first=OpenConnectButton;
        first.Focus();
    }
    private void CloseDialog(bool restoreFocus = true)
    {
        if (_dialog == DialogKind.None) return;
        _activationCancellation?.Cancel();
        _pairingCancellation?.Cancel();
        PairingCodeText.Clear(); PairingIdText.Clear();
        ActivationCodeInput.Clear();
        _dialog = DialogKind.None;
        ModalOverlay.Visibility = ManualCodePanel.Visibility = ContactPanel.Visibility = PairingPanel.Visibility = Visibility.Collapsed;
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
        if (PrimaryActions is not null) PrimaryActions.Columns = e.NewSize.Width < 520 || ActivationProgressPanel.IsVisible ? 1 : 2;
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
        if (_busy || _visible is null) return;
        // A locally revoked license recovers only through the explicit authenticated decision request.
        if (_access.LocalLicenseState == DesktopAccessState.Revoked) { await ActivateAsync(false); return; }
        // One automatic path: check now, then keep waiting visibly until a signed license is stored.
        _ = _activation.StartWaitingAsync();
        RenderActivation();
        CancelWaitButton.Focus();
    }

    private void BeginWaitingAfterConnect()
    {
        if (_visible is null || _access.IsPurchased || !_activation.CanCheckOnline) return;
        _connectedThisVisit = true;
        _ = _activation.StartWaitingAsync();
        RenderActivation();
        if (_dialog == DialogKind.None) CancelWaitButton.Focus();
    }

    private void CheckNow_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None || _visible is null || _entering) return;
        _ = _activation.CheckNowAsync();
        RenderActivation();
    }

    private void CancelWait_Click(object sender, RoutedEventArgs e)
    {
        if (_dialog != DialogKind.None || _entering) return;
        _activation.Stop(clearIntent: true);
        _connectedThisVisit = false;
        Message(_access.IsPurchased ? "" : "انتظار برای مجوز لغو شد. هر زمان خرید کامل شد، «فعال‌سازی نسخه» را انتخاب کنید.");
        ActivateButton.Focus();
    }

    private void Activation_Changed(object? sender, EventArgs e)
    {
        if (!Dispatcher.CheckAccess()) { Dispatcher.BeginInvoke(new Action(() => Activation_Changed(sender, e))); return; }
        if (_visible is null) return;
        RenderActivation();
    }

    /// <summary>Called by the window only after the signed license is verified and durably stored.</summary>
    public void ShowActivationSucceeded() { _entering = true; RenderActivation(); }
    public void ShowEnteringGames() { _entering = true; RenderActivation("در حال ورود به بازی‌ها…"); }

    private void RenderActivation(string? enteringText = null)
    {
        if (ActivationProgressPanel is null) return;
        var phase = _activation.Phase;
        bool waiting = _activation.Mode == PaidActivationMode.Waiting;
        bool startup = _activation.Mode == PaidActivationMode.StartupRecovery && _activation.IsRunning;
        bool show = _entering || waiting || startup;
        ActivationProgressPanel.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        ActivateButton.Visibility = show ? Visibility.Collapsed : Visibility.Visible;
        PrimaryActions.Columns = show || ActualWidth is > 0 and < 520 ? 1 : 2;
        if (!show) return;
        if (_entering) phase = PaidActivationPhase.Activated;
        (string title, string detail) = phase switch
        {
            PaidActivationPhase.Activated => ("نسخه شما فعال شد", enteringText ?? "از این پس می‌توانید بدون اینترنت بازی کنید."),
            PaidActivationPhase.RetrievingLicense => ("مجوز آماده است؛ در حال فعال‌سازی…", "مجوز امضاشده دریافت و روی این دستگاه بررسی می‌شود."),
            PaidActivationPhase.WaitingForPurchase => ("در انتظار تکمیل خرید و آماده‌شدن مجوز…",
                "خرید را در سایت کامل کنید. پس از تأیید پرداخت، مجوز به‌طور خودکار دریافت و نسخه فعال می‌شود."),
            PaidActivationPhase.NetworkUnavailable => ("ارتباط برقرار نشد؛ تلاش مجدد امکان‌پذیر است",
                "برای فعال‌سازی اولیه به اینترنت نیاز دارید. بررسی به‌طور خودکار تکرار می‌شود."),
            PaidActivationPhase.RateLimited => ("تعداد درخواست‌ها زیاد است", "بررسی کمی بعد به‌طور خودکار تکرار می‌شود."),
            PaidActivationPhase.Paused => ("بررسی خودکار متوقف شد", "اگر خرید را کامل کرده‌اید، «بررسی دوباره» را انتخاب کنید."),
            PaidActivationPhase.EnrollmentRequired => ("اتصال امن دستگاه لازم است", "لطفاً «اتصال به حساب» را انتخاب کنید."),
            PaidActivationPhase.ProductBlocked => ("دسترسی مسدود است", BlockMessage),
            PaidActivationPhase.ProductUnavailable => ("فعال‌سازی این نسخه فعلاً در دسترس نیست", "لطفاً بعداً تلاش کنید یا با پشتیبانی تماس بگیرید."),
            PaidActivationPhase.AccountRestricted => ("دسترسی حساب محدود شده است", "لطفاً با پشتیبانی تماس بگیرید."),
            PaidActivationPhase.LicenseRevoked => ("مجوز این نسخه لغو شده است", "لطفاً با پشتیبانی تماس بگیرید."),
            PaidActivationPhase.InvalidLicense => ("مجوز دریافتی معتبر نبود", "نسخه فعال نشد. لطفاً با پشتیبانی تماس بگیرید."),
            PaidActivationPhase.Cancelled => ("انتظار متوقف شد", "برای ادامه، «بررسی دوباره» را انتخاب کنید."),
            _ => ("در حال بررسی مجوز خرید…", "وضعیت خرید شما به‌صورت امن از سرور بررسی می‌شود.")
        };
        bool busy = phase is PaidActivationPhase.Checking or PaidActivationPhase.RetrievingLicense
            or PaidActivationPhase.WaitingForPurchase or PaidActivationPhase.Idle;
        bool recoverable = phase is PaidActivationPhase.NetworkUnavailable or PaidActivationPhase.RateLimited
            or PaidActivationPhase.Paused or PaidActivationPhase.Cancelled;
        bool final = !_entering && !busy && !recoverable && phase != PaidActivationPhase.Activated;
        ActivationConnectedText.Visibility = _connectedThisVisit && !_entering ? Visibility.Visible : Visibility.Collapsed;
        ActivationProgress.Visibility = final || recoverable ? Visibility.Collapsed : Visibility.Visible;
        // One indicator: moving while the app works, full once the license is stored; still under reduced motion.
        ActivationProgress.IsIndeterminate = busy && SystemParameters.ClientAreaAnimation;
        ActivationProgress.Value = phase == PaidActivationPhase.Activated ? 100 : phase == PaidActivationPhase.RetrievingLicense ? 75 : 40;
        ActivationProgressPanel.Background = new SolidColorBrush(final ? Color.FromArgb(24, 139, 0, 0) : Color.FromArgb(38, 0xC9, 0xA4, 0x5C));
        ActivationPhaseText.Foreground = final ? new SolidColorBrush(Color.FromRgb(139, 0, 0)) : (Brush)FindResource("LeatherDarkBrush");
        ActivationActions.Visibility = _entering ? Visibility.Collapsed : Visibility.Visible;
        WaitPurchaseButton.Visibility = busy || recoverable ? Visibility.Visible : Visibility.Collapsed;
        CheckNowButton.Visibility = final || startup ? Visibility.Collapsed : Visibility.Visible;
        CheckNowButton.IsEnabled = phase is not (PaidActivationPhase.Checking or PaidActivationPhase.RetrievingLicense);
        CancelWaitButton.Visibility = startup ? Visibility.Collapsed : Visibility.Visible;
        CancelWaitButton.Content = final ? "بستن" : "لغو انتظار";
        if (ActivationPhaseText.Text != title || ActivationDetailText.Text != detail)
        {
            ActivationPhaseText.Text = title; ActivationDetailText.Text = detail;
            AutomationProperties.SetHelpText(ActivationProgressPanel, detail);
            (UIElementAutomationPeer.FromElement(ActivationPhaseText) ?? UIElementAutomationPeer.CreatePeerForElement(ActivationPhaseText))
                ?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
        }
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
    private void Cancel_Click(object sender, RoutedEventArgs e) { if (_dialog == DialogKind.None && !_entering) Cancelled?.Invoke(this, EventArgs.Empty); }
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) { if (Window.GetWindow(this) is { } window) window.WindowState = WindowState.Minimized; }
}
