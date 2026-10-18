using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Controls;

namespace YariZan.App.Views;

/// <summary>
/// Neutral launch screen while one bounded check looks for a purchase the customer was waiting for.
/// It shows no trial or activation choices and never decides access; the window navigates.
/// </summary>
public partial class ActivationRecoveryPage : UserControl
{
    public event EventHandler? SkipRequested;
    public bool Succeeded { get; private set; }

    public ActivationRecoveryPage()
    {
        InitializeComponent();
        // Reduced motion: a still bar instead of the moving runner.
        RecoveryProgress.IsIndeterminate = SystemParameters.ClientAreaAnimation;
        Loaded += (_, _) => SkipButton.Focus();
    }

    public void ShowActivationSucceeded() => Show("نسخه شما فعال شد", "از این پس می‌توانید بدون اینترنت بازی کنید.");
    public void ShowEntering() => Show("نسخه شما فعال شد", "در حال ورود به یاریزان…");

    private void Show(string title, string detail)
    {
        Succeeded = true;
        RecoveryProgress.IsIndeterminate = false; RecoveryProgress.Value = 100;
        SkipButton.Visibility = Visibility.Collapsed;
        RecoveryTitle.Text = title; RecoveryDetail.Text = detail;
        (UIElementAutomationPeer.FromElement(RecoveryTitle) ?? UIElementAutomationPeer.CreatePeerForElement(RecoveryTitle))
            ?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
    }

    private void Skip_Click(object sender, RoutedEventArgs e) { if (!Succeeded) SkipRequested?.Invoke(this, EventArgs.Empty); }
}
