using System.Windows;
using System.Windows.Controls;
using YariZan.Core;

namespace YariZan.App.Views;

public partial class LockPage : UserControl
{
    public event EventHandler? Activated;
    public event EventHandler? Cancelled;

    private readonly string _hwid;

    public LockPage()
    {
        InitializeComponent();
        _hwid = HwidProvider.GetHwid();
        HwidText.Text = HwidProvider.GetHwidPretty();
    }

    private void CopyHwid_Click(object sender, RoutedEventArgs e)
    {
        try { Clipboard.SetText(_hwid); StatusText.Foreground = System.Windows.Media.Brushes.DarkGreen; StatusText.Text = "شناسه در حافظه کپی شد."; }
        catch { }
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
}
