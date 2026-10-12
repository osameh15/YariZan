using System.Windows;
using System.Windows.Controls;
using YariZan.Core;
using YariZan.App.Services;

namespace YariZan.App.Views;

public partial class LockPage : UserControl
{
    public event EventHandler? Activated;
    public event EventHandler? TrialStarted;
    public event EventHandler? Cancelled;

    private const string SupportPhone = "0918-876-4024";

    private readonly string _hwid;
    private readonly AccessSession _access;
    private readonly OnlineTrialClient _trials;
    private bool _registered;
    private bool _refreshing;

    public LockPage(AccessSession access, OnlineTrialClient trials)
    {
        _access = access;
        _trials = trials;
        InitializeComponent();
        _hwid = HwidProvider.GetHwid();
        HwidText.Text = HwidProvider.GetHwidPretty();
        TrialButton.IsEnabled = false;
        TrialButton.Content = "بررسی آزمایش…";
        Loaded += async (_, _) => await RefreshTrialAsync();
    }

    private void UpdateTrialButton(int remaining)
    {
        if (remaining > 0)
        {
            TrialButton.IsEnabled = true;
            TrialButton.Content =
                "ورود آزمایشی (" + ToPersianDigits(remaining.ToString()) +
                "/" + ToPersianDigits(TrialStore.MaxTrialLaunches.ToString()) + ")";
        }
        else
        {
            TrialButton.IsEnabled = false;
            TrialButton.Content = "آزمایش به پایان رسیده";
        }
    }

    private async Task RefreshTrialAsync()
    {
        if (_refreshing) return;
        _refreshing = true;
        ActivateButton.IsEnabled = false;
        var savedActivation = ActivationStore.Load();
        TrialButton.IsEnabled = false;
        TrialButton.Content = "بررسی ارتباط…";
        try
        {
            if (savedActivation is not null)
            {
                await _trials.AuthorizePaidAsync(savedActivation.Serial);
                Activated?.Invoke(this, EventArgs.Empty);
                return;
            }
            UpdateTrialButton(await _trials.RemainingAsync());
            _registered = true;
            StatusText.Text = "دستگاه ثبت شد. بررسی وضعیت، ورود آزمایشی مصرف نمی‌کند.";
            StatusText.Foreground = System.Windows.Media.Brushes.DarkGreen;
        }
        catch (AccessDeniedException)
        {
            _trials.Revoke();
            _registered = false;
            TrialButton.IsEnabled = true;
            TrialButton.Content = "بررسی دوبارهٔ دسترسی";
            StatusText.Text = "دسترسی این دستگاه لغو شده است. برای دریافت سریال جدید با پشتیبانی تماس بگیرید.";
        }
        catch
        {
            _registered = false;
            TrialButton.IsEnabled = true;
            TrialButton.Content = "بررسی دوبارهٔ ارتباط";
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = savedActivation is not null
                ? "سریال ذخیره‌شده حفظ شده است. اتصال اینترنت و سرور را بررسی کنید و دوباره تلاش کنید."
                : System.Net.NetworkInformation.NetworkInterface.GetIsNetworkAvailable()
                ? "سرور آزمایش در دسترس نیست. ارتباط اینترنت را بررسی کنید و دوباره تلاش کنید، یا سریال را وارد کنید."
                : "برای بررسی دسترسی و فعال‌سازی، به اینترنت متصل شوید.";
        }
        finally { _refreshing = false; ActivateButton.IsEnabled = true; }
    }

    private static string ToPersianDigits(string s)
    {
        var map = new[] { '۰','۱','۲','۳','۴','۵','۶','۷','۸','۹' };
        var arr = s.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
            if (arr[i] >= '0' && arr[i] <= '9') arr[i] = map[arr[i] - '0'];
        return new string(arr);
    }

    private void CopyHwid_Click(object sender, RoutedEventArgs e) =>
        SetClipboardWithStatus(_hwid, "شناسهٔ دستگاه در حافظه کپی شد.");

    private void CopyPhone_Click(object sender, RoutedEventArgs e) =>
        SetClipboardWithStatus(SupportPhone, "شمارهٔ پشتیبانی در حافظه کپی شد.");

    private void CopyMessage_Click(object sender, RoutedEventArgs e)
    {
        var msg =
            "سلام\n" +
            "درخواست فعال‌سازی برنامهٔ یاریزان\n" +
            "\n" +
            "شناسهٔ دستگاه:\n" +
            _hwid + "\n" +
            "\n" +
            "لطفاً سریال فعال‌سازی را برای من ارسال نمایید.\n" +
            "سپاسگزارم";
        SetClipboardWithStatus(msg,
            "پیام در حافظه کپی شد. آن را به شمارهٔ پشتیبانی ارسال کنید.");
    }

    private void SetClipboardWithStatus(string text, string okMessage)
    {
        try
        {
            Clipboard.SetText(text);
            StatusText.Foreground = System.Windows.Media.Brushes.DarkGreen;
            StatusText.Text = okMessage;
        }
        catch
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "کپی نشد. لطفاً دوباره تلاش کنید.";
        }
    }

    private async void Activate_Click(object sender, RoutedEventArgs e)
    {
        var serial = SerialBox.Text?.Trim() ?? "";
        if (serial.Length == 0)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "سریال را وارد کنید.";
            return;
        }

        try
        {
            IsEnabled = false;
            var pubKey = AppKeys.LoadEmbeddedPublicKeyPem();
            if (!SerialCodec.Verify(pubKey, _hwid, serial))
            {
                StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
                StatusText.Text = "سریال نامعتبر است.";
                return;
            }

            await _trials.AuthorizePaidAsync(serial);
            ActivationStore.Save(new ActivationRecord(_hwid, serial));
            Activated?.Invoke(this, EventArgs.Empty);
        }
        catch (AccessDeniedException)
        {
            _trials.Revoke();
            StatusText.Text = "سریال لغو شده یا دستگاه غیرفعال است. سریال جدید را از پشتیبانی دریافت کنید.";
        }
        catch (Exception)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "فعال‌سازی انجام نشد. ارتباط اینترنت، سرویس فعال‌سازی و دسترسی نوشتن را بررسی کنید.";
        }
        finally { IsEnabled = true; }
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) =>
        Cancelled?.Invoke(this, EventArgs.Empty);

    private async void Trial_Click(object sender, RoutedEventArgs e)
    {
        if (!_registered) { await RefreshTrialAsync(); return; }
        IsEnabled = false;
        try
        {
            await _access.StartTrialAsync();
            TrialStarted?.Invoke(this, EventArgs.Empty);
        }
        catch (TrialExhaustedException)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "آزمایش رایگان به پایان رسیده است. لطفاً سریال را وارد کنید.";
            UpdateTrialButton(0);
        }
        catch (Exception)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "ارتباط با سرویس آزمایش برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید، یا سریال را وارد کنید.";
        }
        finally { IsEnabled = true; }
    }

    private void Exit_Click(object sender, RoutedEventArgs e) =>
        Application.Current.Shutdown();

    private void Minimize_Click(object sender, RoutedEventArgs e) =>
        Window.GetWindow(this).WindowState = WindowState.Minimized;
}
