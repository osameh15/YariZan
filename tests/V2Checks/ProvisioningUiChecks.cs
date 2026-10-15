using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using YariZan.App.Views;
using YariZan.Core.V2;

internal static partial class Program
{
    private sealed class UiProvisioning(IDeviceIdentity identity):IDesktopProvisioning
    {
        public bool Ready;public int Pickups;
        public Task<bool> ResumeAsync(CancellationToken cancellation)=>Task.FromResult(false);
        public Task<DesktopPairing> BeginAsync(CancellationToken cancellation)=>Task.FromResult(new DesktopPairing("10000000-0000-4000-8000-000000000003",new string('A',43),identity.Username,DateTimeOffset.UtcNow.AddMinutes(5)));
        public Task<bool> CompleteAsync(CancellationToken cancellation){Pickups++;return Task.FromResult(Ready);}
    }
    private static void ProvisioningUiChecks(SigningFixture signing,IDeviceIdentity identity,string screenshots)
    {
        var provisioning=new UiProvisioning(identity);var server=new FakeServer(signing,identity);
        using var access=new DesktopAccessController(identity,G1,signing.Verifier,Store("provisioning-ui"),server,new TestEnrollmentProvider(Enrollment(identity)),provisioning);
        var actions=new RecordingDesktopActions();var page=new LockPage(access,actions);
        var host=new Window{Content=page,Width=1216,Height=779,ShowInTaskbar=false,Left=-32000,Top=-32000};
        host.Show();host.Activate();Pump(()=>access.State==DesktopAccessState.TrialAvailable);
        T C<T>(string name) where T:FrameworkElement=>(T)page.FindName(name);
        void Click(string name)=>C<Button>(name).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(C<Button>("ConnectButton").IsEnabled,"review-injected provisioning enables explicit Lock connection action");
        Click("ConnectButton");Pump(()=>C<StackPanel>("PairingPanel").IsVisible);
        Check(!C<StackPanel>("ContactPanel").IsVisible&&!C<FrameworkElement>("ManualCodePanel").IsVisible,"pairing modal isolates proof delivery from manual code/support UI");
        Check(C<TextBox>("PairingIdText").Text=="10000000-0000-4000-8000-000000000003"&&C<TextBox>("PairingCodeText").Text.Length==43,"Lock displays only pairing UUID and browser approval code");
        Click("OpenConnectButton");Check(actions.Opened==DesktopProvisioningClient.ConnectPage&&actions.Opened.Query.Length==0&&actions.BrowserCalls==1,"WPF Connect browser action uses only fixed HTTPS URL without credential query");
        Click("CopyPairingIdButton");Check(actions.Copied==C<TextBox>("PairingIdText").Text,"copy action targets public pairing UUID");
        Click("CopyPairingCodeButton");Check(actions.Copied==new string('A',43),"browser approval code copy is explicit and separate from device credentials");
        // Screenshot masks the synthetic approval code as it would be a short-lived secret in a real pairing.
        C<TextBox>("PairingCodeText").Text="[masked temporary pairing code]";
        Save(page,screenshots,"phase3-windows-connect.png");
        Click("CloseModalButton");Pump(()=>C<Button>("ConnectButton").IsEnabled);
        Check(C<TextBox>("PairingCodeText").Text.Length==0&&C<TextBox>("PairingIdText").Text.Length==0,"closing WPF pairing clears visible code and cancels polling");
        Check(Keyboard.FocusedElement==C<Button>("ConnectButton"),"pairing modal restores keyboard focus");
        int before=server.StatusRequests;Click("ConnectButton");Pump(()=>C<StackPanel>("PairingPanel").IsVisible);provisioning.Ready=true;
        Pump(()=>C<Grid>("ModalOverlay").Visibility!=Visibility.Visible&&C<Button>("ConnectButton").IsEnabled);
        Check(provisioning.Pickups>0&&server.StatusRequests>before&&C<Button>("TrialButton").IsEnabled,"successful key pickup refreshes Lock trial status without busy-state deadlock");
        Check(C<TextBox>("PairingCodeText").Text.Length==0,"successful provisioning clears browser approval code");host.Close();
        using var blocked=Access(identity,signing,Store("blocked-provisioning-ui"),new FakeServer(signing,identity));
        var stock=new LockPage(blocked,actions);Check(!((Button)stock.FindName("ConnectButton")).IsEnabled,"stock unreviewed provisioning path stays disabled without injected provider");
    }
}
