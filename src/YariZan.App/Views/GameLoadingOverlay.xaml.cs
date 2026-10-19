using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace YariZan.App.Views;

public partial class GameLoadingOverlay : UserControl
{
    public GameLoadingOverlay() => InitializeComponent();
    public string GameName { set => LoadingGameName.Text = Services.PersianText.Digits(value); }

    private void VisibilityChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (LoadingLogo is null) return;
        LoadingLogo.BeginAnimation(OpacityProperty, IsVisible
            ? new DoubleAnimation(0.6, 1, TimeSpan.FromMilliseconds(700))
            { AutoReverse = true, RepeatBehavior = RepeatBehavior.Forever }
            : null);
    }
}
