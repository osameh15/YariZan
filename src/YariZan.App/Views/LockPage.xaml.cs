using System.Windows;
using System.Windows.Controls;
using YariZan.Core;

namespace YariZan.App.Views;

public partial class LockPage : UserControl
{
    public event EventHandler? Activated;
    public event EventHandler? Cancelled;

    private const string SupportPhone = "0918-876-4024";

    private readonly string _hwid;

    public LockPage()
    {
        InitializeComponent();
        _hwid = HwidProvider.GetHwid();
        HwidText.Text = HwidProvider.GetHwidPretty();
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
            "پیام در حافظه کپی شد. آن را به شمارهٔ " + SupportPhone + " ارسال کنید.");
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

    private void Activate_Click(object sender, RoutedEventArgs e)
    {
        var serial = SerialBox.Text?.Trim() ?? "";
        if (serial.Length == 0)
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "سریال را وارد کنید.";
            return;
        }

        var pubKey = AppKeys.LoadEmbeddedPublicKeyPem();
        if (!SerialCodec.Verify(pubKey, _hwid, serial))
        {
            StatusText.Foreground = System.Windows.Media.Brushes.DarkRed;
            StatusText.Text = "سریال نامعتبر است.";
            return;
        }

        ActivationStore.Save(new ActivationRecord(_hwid, serial));
        Activated?.Invoke(this, EventArgs.Empty);
    }

    private void Cancel_Click(object sender, RoutedEventArgs e) =>
        Cancelled?.Invoke(this, EventArgs.Empty);

    private void Exit_Click(object sender, RoutedEventArgs e) =>
        Application.Current.Shutdown();

    private void Minimize_Click(object sender, RoutedEventArgs e) =>
        Window.GetWindow(this).WindowState = WindowState.Minimized;
}
