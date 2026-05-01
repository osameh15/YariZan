using System.Reflection;
using System.Windows.Controls;
using System.Windows.Input;

namespace YariZan.App.Views;

public partial class CoverPage : UserControl
{
    public event EventHandler? OpenRequested;

    public ICommand OpenCommand { get; }

    public CoverPage()
    {
        OpenCommand = new RelayCommand(() => OpenRequested?.Invoke(this, EventArgs.Empty));
        InitializeComponent();
        DataContext = this;

        var ver = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";
        VersionText.Text = "نسخهٔ " + ToPersianDigits(ver);
    }

    private static string ToPersianDigits(string s)
    {
        var map = new[] { '۰','۱','۲','۳','۴','۵','۶','۷','۸','۹' };
        var arr = s.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
            if (arr[i] >= '0' && arr[i] <= '9') arr[i] = map[arr[i] - '0'];
        return new string(arr);
    }
}

internal sealed class RelayCommand : ICommand
{
    private readonly Action _exec;
    private readonly Func<bool>? _canExec;
    public RelayCommand(Action exec, Func<bool>? canExec = null) { _exec = exec; _canExec = canExec; }
    public bool CanExecute(object? parameter) => _canExec?.Invoke() ?? true;
    public void Execute(object? parameter) => _exec();
    public event EventHandler? CanExecuteChanged
    {
        add { CommandManager.RequerySuggested += value; }
        remove { CommandManager.RequerySuggested -= value; }
    }
}
