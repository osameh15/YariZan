using System.Text.Json;
using YariZan.Core.V2;

internal static class TransportChecks {
    public static async Task Run(JsonElement input) {
        string Text(string key)=>input.GetProperty(key).GetString()!;
        int count=0;
        void Check(bool valid,string name){if(!valid)throw new Exception(name);count++;}
        var identity=new TestIdentity(Text("fingerprint"));
        var verifier=new SignedArtifactVerifier(new Dictionary<string,string>{{Text("kid"),Text("publicKey")}});
        var enrollment=verifier.VerifyEnrollment(input.GetProperty("enrollment").GetRawText(),identity,Text("keyDigest"));
        var local=new Enrollment(enrollment);
        using var transport=new LocalTransport(new Uri(Text("apiBase")));
        using var http=new HttpClient(transport);
        var client=new DesktopV2Client(http,new Credential(Text("deviceId"),Text("credential")));
        var store=new MemoryStore();
        using var access=new DesktopAccessController(identity,new Product(1),verifier,store,client,local);
        await access.RefreshTrialStatusAsync();Check(access.TrialRemaining==2,"status consumes zero");
        await access.StartTrialAsync();Check(access.State==DesktopAccessState.TrialStarted&&access.TrialRemaining==1,"real API trial");
        int calls=transport.Requests;transport.Offline=true;
        await access.RefreshTrialStatusAsync();await access.StartTrialAsync();
        Check(access.CanEnter&&transport.Requests==calls,"started trial makes no network request");
        try{await access.PickupLicenseAsync();throw new Exception("network failure accepted");}catch(HttpRequestException){}
        Check(access.CanEnter,"optional pickup failure preserves trial");
        transport.Offline=false;
        await access.PickupLicenseAsync();Check(access.IsPurchased,"real API perpetual pickup");
        await access.SynchronizePurchasedAsync();Check(access.IsPurchased,"real API signed ACTIVE sync");
        transport.Offline=true;
        using var restart=new DesktopAccessController(identity,new Product(1),verifier,store,client,local);
        Check(restart.IsPurchased,"paid restart offline using real API artifact");
        await restart.SynchronizePurchasedAsync();Check(restart.IsPurchased,"network failure does not revoke paid");
        using var wrongGrade=new DesktopAccessController(identity,new Product(2),verifier,store,client,local);
        Check(!wrongGrade.CanEnter,"G1 cannot unlock G2");
        using var noPaidRestart=new DesktopAccessController(identity,new Product(1),verifier,new MemoryStore(),client,local);
        Check(!noPaidRestart.CanEnter,"trial grant is not retained after process lifecycle");
        Console.WriteLine($"DOTNET_API {count} passed, 0 failed");
    }
    private sealed class Enrollment(DeviceEnrollment identity):ILocalDeviceEnrollmentProvider {public DeviceEnrollment? ReadVerifiedIdentity()=>identity;}
    private sealed class Credential(string id,string value):IDeviceCredentialProvider {
        public string? DeviceId=>id;
        public Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation)=>Task.FromResult(value);
    }
    private sealed class LocalTransport(Uri target):DelegatingHandler(new HttpClientHandler()) {
        public bool Offline;
        public int Requests;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation){
            Requests++;
            if(Offline)throw new HttpRequestException("Synthetic disconnected transport");
            // Test-only host mapping; production client source and request DTOs remain unchanged.
            request.RequestUri=new Uri(target,request.RequestUri!.AbsolutePath);
            return base.SendAsync(request,cancellation);
        }
    }
    private sealed class MemoryStore:ILicenseStore {
        private readonly Dictionary<string,string> licenses=new(),decisions=new();
        public StoreRead ReadLicense(Product p)=>licenses.TryGetValue(p.Sku,out var s)?new(StoreReadStatus.Present,s):new(StoreReadStatus.Missing);
        public StoreRead ReadDecision(Product p)=>decisions.TryGetValue(p.Sku,out var s)?new(StoreReadStatus.Present,s):new(StoreReadStatus.Missing);
        public void WriteLicense(Product p,string s)=>licenses[p.Sku]=s;
        public void WriteDecision(Product p,string s)=>decisions[p.Sku]=s;
        public IDisposable AcquireWriteLock(Product p)=>new Releaser();
        private sealed class Releaser:IDisposable{public void Dispose(){}}
    }
}
