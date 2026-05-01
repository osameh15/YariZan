using System.Globalization;
using System.Windows;
using System.Windows.Markup;

namespace YariZan.App;

public partial class App : Application
{
    public App()
    {
        var fa = new CultureInfo("fa-IR");
        Thread.CurrentThread.CurrentCulture = fa;
        Thread.CurrentThread.CurrentUICulture = fa;
        FrameworkElement.LanguageProperty.OverrideMetadata(
            typeof(FrameworkElement),
            new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(fa.IetfLanguageTag)));
    }
}
