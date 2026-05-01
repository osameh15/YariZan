using System.Reflection;
using System.Windows;
using System.Windows.Controls;

namespace YariZan.App.Views;

public partial class InfoPage : UserControl
{
    public event EventHandler? NextRequested;
    public event EventHandler? BackRequested;

    public InfoPage()
    {
        InitializeComponent();
        var ver = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
        VersionText.Text = "نسخهٔ " + ToPersianDigits(ver);
    }

    private void Next_Click(object sender, RoutedEventArgs e) =>
        NextRequested?.Invoke(this, EventArgs.Empty);

    private void Back_Click(object sender, RoutedEventArgs e) =>
        BackRequested?.Invoke(this, EventArgs.Empty);

    private void Exit_Click(object sender, RoutedEventArgs e) =>
        Application.Current.Shutdown();

    private static string ToPersianDigits(string s)
    {
        var map = new[] { '۰','۱','۲','۳','۴','۵','۶','۷','۸','۹' };
        var arr = s.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
            if (arr[i] >= '0' && arr[i] <= '9') arr[i] = map[arr[i] - '0'];
        return new string(arr);
    }
}
