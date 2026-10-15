using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using YariZan.Core.V2;
#if WINDOWS
using Microsoft.Win32;
#endif

internal static class ProvisioningTransportChecks
{
    public static async Task Run(JsonElement input)
    {
        string Text(string key)=>input.GetProperty(key).GetString()!;
        int count=0;
        void Check(bool valid,string name){if(!valid)throw new Exception("Provisioning: "+name);count++;}
        var identity=new ProvisionIdentity(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
        var verifier=new SignedArtifactVerifier(new Dictionary<string,string>{{Text("kid"),Text("publicKey")}});
        var root=Path.Combine(Path.GetTempPath(),"YariZan-phase3-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
#if WINDOWS
        string keyName="OARNOVA.YariZan.Phase3.Test."+Guid.NewGuid().ToString("N");
        Func<IDeviceProofKey> keyFactory=()=>new CngDeviceKeyStore(keyName,preferTpm:false);
#else
        using var softwareKey=ECDsa.Create(ECCurve.NamedCurves.nistP256);
        Func<IDeviceProofKey> keyFactory=()=>new BorrowedKey(softwareKey);
#endif
        using var transport=new LoopbackTransport(new Uri(Text("apiBase")));
        using var http=new HttpClient(transport);
        using var browser=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false,UseCookies=false});
        string route(string value)=>new Uri(new Uri(Text("apiBase")),"api/v2/"+value).AbsoluteUri;
        string customerCookie="",customerCsrf="";
        async Task<JsonDocument> Post(string value,object body,bool admin=false)
        {
            using var request=new HttpRequestMessage(HttpMethod.Post,route(value));
            request.Headers.Add("Origin",Text("origin"));
            if(admin){request.Headers.Add("Cookie",Text("adminCookie"));request.Headers.Add("X-CSRF-Token",Text("adminCsrf"));}
            if(!admin&&value.StartsWith("orders",StringComparison.Ordinal)){request.Headers.Add("Cookie",customerCookie);request.Headers.Add("X-CSRF-Token",customerCsrf);}
            request.Content=new StringContent(JsonSerializer.Serialize(body),Encoding.UTF8,"application/json");
            using var response=await browser.SendAsync(request);
            string result=await response.Content.ReadAsStringAsync();
            if(!response.IsSuccessStatusCode)throw new Exception("Synthetic API operation failed: "+value+" "+(int)response.StatusCode);
            var parsed=StrictJson.Parse(result);
            if(value=="auth/claim"){
                customerCsrf=parsed.RootElement.GetProperty("csrf_token").GetString()!;
                customerCookie=response.Headers.GetValues("Set-Cookie").Single(v=>v.StartsWith("yz_customer=",StringComparison.Ordinal)).Split(';')[0];
            }
            return parsed;
        }
        async Task<JsonDocument> Approve(DesktopPairing pair)
        {
            if(!input.TryGetProperty("browser_callback",out var callback)){
                string mobile="09"+RandomNumberGenerator.GetInt32(100000000,999999999).ToString();
                using var sent=await Post("auth/claim/otp/request",new{pairing_id=pair.Id,pairing_secret=pair.BrowserCode,mobile});
                string challenge=sent.RootElement.GetProperty("challenge_id").GetString()!,code="";
                // Test-only encrypted fake delivery spool; production transport has no OTP retrieval API.
                for(int n=0;n<100 && code.Length==0;n++){
                    if(File.Exists(Text("sms_fixture_path"))){
                    using var stream=new FileStream(Text("sms_fixture_path"),FileMode.Open,FileAccess.Read,FileShare.ReadWrite);using var reader=new StreamReader(stream);
                    foreach(var line in (await reader.ReadToEndAsync()).Split('\n')){

                        if(string.IsNullOrWhiteSpace(line))continue;try{string safeLine=line.Trim();byte[] encrypted=Convert.FromBase64String(safeLine.Replace('-','+').Replace('_','/')+new string('=',(4-safeLine.Length%4)%4));
                        byte[] plain=new byte[encrypted.Length-28];using var aes=new AesGcm(Convert.FromHexString(Text("mobile_key")),16);aes.Decrypt(encrypted.AsSpan(0,12),encrypted.AsSpan(28),encrypted.AsSpan(12,16),plain);
                        using var message=JsonDocument.Parse(plain);if(message.RootElement.GetProperty("challengeId").GetString()==challenge)code=message.RootElement.GetProperty("code").GetString()!;
                        }catch(Exception e) when(e is FormatException or JsonException or CryptographicException){/* A concurrent synthetic fixture append can leave a partial final line. */}
                    }
                    }
                    if(code.Length==0)await Task.Delay(20);
                }
                if(code.Length!=6)throw new Exception("Synthetic SMS delivery unavailable");await Task.Delay(30);
                return await Post("auth/claim",new{pairing_id=pair.Id,pairing_secret=pair.BrowserCode,password="Synthetic!Provisioning12345",otp=new{challenge_id=challenge,code}});
            }
            var destination=new Uri(callback.GetString()!);
            if(destination.Scheme!="http"||!destination.IsLoopback||destination.AbsolutePath!="/approve"||destination.Query.Length!=0||destination.UserInfo.Length!=0)throw new Exception("Unsafe test callback");
            using var request=new HttpRequestMessage(HttpMethod.Post,destination);
            request.Headers.Add("X-Fixture-Proof",Text("browser_callback_token"));
            request.Content=new StringContent(JsonSerializer.Serialize(new{pairing_id=pair.Id,pairing_secret=pair.BrowserCode}),Encoding.UTF8,"application/json");
            using var response=await browser.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return StrictJson.Parse(await response.Content.ReadAsStringAsync());
        }
        object Mutation(string? evidence=null)=>new {request_id=Guid.NewGuid().ToString("D"),reason="Synthetic independently verified provisioning test",expected_revision=1,evidence_ref=evidence??"synthetic-verified-evidence-001"};
        try
        {
            byte[] publicKey;using(var key=keyFactory())publicKey=key.ExportPublicKey();
#if WINDOWS
            var pending=new FilePendingPairingStore(root);
            var enrollmentStore=new VerifiedLocalDeviceEnrollmentProvider(new FileDeviceEnrollmentStore(root),verifier,identity,()=>{using var key=keyFactory();return key.ExportPublicKey();});
            ILicenseStore licenses=new FileLicenseStore(root);
#else
            var pending=new MemoryPending();
            var enrollmentStore=new MemoryEnrollment(verifier,identity,Convert.ToHexString(SHA256.HashData(publicKey)));
            ILicenseStore licenses=new MemoryLicenses();
#endif
            var provisioning=new DesktopProvisioningClient(http,identity,keyFactory,enrollmentStore,pending);
            Check(!await provisioning.ResumeAsync(default),"unenrolled key cannot authenticate");
            var pair=await provisioning.BeginAsync(default);
            Check(pair.Username==identity.Username&&pending.Read()==pair.Id,"pairing identity and restart UUID");
            Check(DesktopProvisioningClient.ConnectPage.Query.Length==0&&DesktopProvisioningClient.ConnectPage.Fragment.Length==0,"browser URL has no proof secret");
            Check(!await provisioning.CompleteAsync(default)&&enrollmentStore.ReadVerifiedIdentity() is null,"browser approval required");
            using var receipt=await Approve(pair);
            StrictJson.Fields(receipt.RootElement,"status","username","expires_at","authenticated","csrf_token");
            Check(receipt.RootElement.GetProperty("authenticated").GetBoolean() && receipt.RootElement.GetProperty("csrf_token").GetString()!.Length == 43,"browser-only initial session receipt has no desktop secrets");
            transport.DropNextPickup=true;
            try{await provisioning.CompleteAsync(default);throw new Exception("Lost response was not injected");}catch(HttpRequestException){count++;}
            Check(enrollmentStore.ReadVerifiedIdentity() is null,"lost delivery does not write unverified local identity");
            var restarted=new DesktopProvisioningClient(http,identity,keyFactory,enrollmentStore,pending);
            Check(await restarted.ResumeAsync(default),"fresh key proof recovers committed pickup after process restart");
            var enrollment=enrollmentStore.ReadVerifiedIdentity()!;
            Check(enrollment.DeviceKeyDigest==Convert.ToHexString(SHA256.HashData(publicKey))&&enrollment.FingerprintDigest==identity.FingerprintDigest,"real key and fingerprint binding");
            Check(pending.Read() is null,"completed pending UUID cleared");
#if WINDOWS
            var reloaded=new VerifiedLocalDeviceEnrollmentProvider(new FileDeviceEnrollmentStore(root),verifier,identity,()=>{using var key=keyFactory();return key.ExportPublicKey();});
            Check(reloaded.ReadVerifiedIdentity()==enrollment,"actual DPAPI signed enrollment reload");
            using var wrong=ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var wrongProfile=new VerifiedLocalDeviceEnrollmentProvider(new FileDeviceEnrollmentStore(root),verifier,identity,()=>wrong.ExportSubjectPublicKeyInfo());
            try{wrongProfile.ReadVerifiedIdentity();throw new Exception("Wrong key accepted");}catch(InvalidDataException){count++;}
#else
            Check(enrollmentStore.ReadVerifiedIdentity()==enrollment,"in-memory enrollment simulation");
#endif
            var client=new DesktopV2Client(http,restarted);
            using var access=new DesktopAccessController(identity,new Product(1),verifier,licenses,client,enrollmentStore,restarted);
            await access.RefreshTrialStatusAsync();Check(access.TrialRemaining==2,"new device status consumes zero");
            await access.StartTrialAsync();Check(access.CanEnter&&access.TrialRemaining==1,"online trial start through renewed device credential");
            transport.Offline=true;int requests=transport.Requests;
            await access.RefreshTrialStatusAsync();await access.StartTrialAsync();
            Check(access.CanEnter&&transport.Requests==requests,"active process trial has no network check");
            transport.Offline=false;
            if(input.TryGetProperty("commerce",out var commerce)&&commerce.GetBoolean()){
                using var order=await Post("orders",new{request_id=Guid.NewGuid().ToString("D"),sku="YARIZAN-G1"});
                string orderId=order.RootElement.GetProperty("id").GetString()!;
                using var initiated=await Post("orders/"+orderId+"/payments",new{request_id=Guid.NewGuid().ToString("D")});
                using var simulated=await Post("orders/"+orderId+"/simulate",new{outcome="SUCCESS"});
                bool fulfilled=false;
                for(int n=0;n<150&&!fulfilled;n++){
                    using var statusRequest=new HttpRequestMessage(HttpMethod.Get,route("orders/"+orderId));statusRequest.Headers.Add("Cookie",customerCookie);
                    using var statusResponse=await browser.SendAsync(statusRequest);statusResponse.EnsureSuccessStatusCode();
                    using var status=StrictJson.Parse(await statusResponse.Content.ReadAsStringAsync());
                    fulfilled=status.RootElement.GetProperty("state").GetString()=="FULFILLED";
                    if(!fulfilled)await Task.Delay(100);
                }
                Check(fulfilled,"verified synthetic order fulfills through durable commerce worker");
            }else{
            using var issued=await Post("admin/licenses/issue",new{request_id=Guid.NewGuid().ToString("D"),reason="Synthetic manual ownership verification",expected_revision=1,evidence_ref="synthetic-evidence-001",device_id=enrollment.DeviceId,sku="YARIZAN-G1"},true);
            }
            await access.PickupLicenseAsync();Check(access.IsPurchased,"real paid pickup and protected storage");
            transport.Offline=true;
            using var paidRestart=new DesktopAccessController(identity,new Product(1),verifier,licenses,client,enrollmentStore);
            Check(paidRestart.IsPurchased,"perpetual paid restart offline");await paidRestart.SynchronizePurchasedAsync();Check(paidRestart.IsPurchased,"network failure cannot revoke paid license");
            using var wrongGrade=new DesktopAccessController(identity,new Product(2),verifier,licenses,client,enrollmentStore);Check(!wrongGrade.CanEnter,"G1 does not unlock G2");
            transport.Offline=false;
            using var code=await Post("admin/activation-codes",new{request_id=Guid.NewGuid().ToString("D"),reason="Synthetic one-time code verification",expected_revision=1,evidence_ref="synthetic-evidence-002",device_id=enrollment.DeviceId,sku="YARIZAN-G1",expires_at=DateTime.UtcNow.AddHours(1).ToString("O")},true);
            string value=code.RootElement.GetProperty("activation_code").GetString()!;
            string redeemed=await client.RedeemAsync(new ActivationCodeRequest(value,enrollment.DeviceId,"YARIZAN-G1",Guid.NewGuid().ToString("D")),default);
            Check(verifier.VerifyLicense(redeemed,identity,new Product(1),enrollment).DeviceId==enrollment.DeviceId,"manual code uses authenticated desktop transport");
            using var paidArtifact=StrictJson.Parse(redeemed);
            string licenseId=paidArtifact.RootElement.GetProperty("payload").GetProperty("license_id").GetString()!;
            using var revoked=await Post("admin/licenses/"+licenseId+"/revoke",Mutation(),true);
            await access.SynchronizePurchasedAsync();Check(access.IsPurchased,"signed revocation leaves current process unchanged");
            using var nextLaunch=new DesktopAccessController(identity,new Product(1),verifier,licenses,client,enrollmentStore);Check(nextLaunch.State==DesktopAccessState.Revoked,"cached signed revocation applies on next launch");
            string customerId=paidArtifact.RootElement.GetProperty("payload").GetProperty("customer_id").GetString()!;
            using var reset=await Post("admin/customers/"+customerId+"/reset",Mutation(),true);
            Check(!await restarted.ResumeAsync(default),"reset credential has tombstone scope and cannot pretend to be current enrollment");
            var freshPair=await restarted.BeginAsync(default);
            using var freshReceipt=await Approve(freshPair);
            Check(await restarted.CompleteAsync(default)&&restarted.DeviceId==enrollment.DeviceId,"authorized new-generation enrollment retains machine UUID");
            Check(await client.GetTrialStatusAsync(new Product(1),default)==2,"authorized generation reset has fresh shared trial budget");
#if WINDOWS
            Console.WriteLine("WINDOWS_PROVISIONING actual CNG SOFTWARE and DPAPI CurrentUser; synthetic identity; no physical ownership claim");
#endif
            Console.WriteLine($"DOTNET_PROVISIONING {count} passed, 0 failed");
        }
        finally
        {
#if WINDOWS
            if(CngKey.Exists(keyName,CngProvider.MicrosoftSoftwareKeyStorageProvider)){using var key=CngKey.Open(keyName,CngProvider.MicrosoftSoftwareKeyStorageProvider);key.Delete();}
            using(var registry=Registry.CurrentUser.OpenSubKey(CngDeviceKeyStore.ProviderRegistryPath,true))registry?.DeleteValue(CngDeviceKeyStore.ProviderValueName(keyName),false);
#endif
            string resolved=Path.GetFullPath(root),expected=Path.Combine(Path.GetFullPath(Path.GetTempPath()),"YariZan-phase3-");
            if(!resolved.StartsWith(expected,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Unsafe test cleanup target");
            Directory.Delete(resolved,true);
        }
    }
    private sealed record ProvisionIdentity(string FingerprintDigest):IDeviceIdentity
    {
        public int FingerprintVersion=>2;public bool IsAvailable=>true;
        public string Username=>"YZ-"+string.Join("-",Enumerable.Range(0,6).Select(i=>FingerprintDigest.Substring(i*4,4)));
    }
    private sealed class LoopbackTransport(Uri target):DelegatingHandler(new HttpClientHandler{AllowAutoRedirect=false,UseCookies=false})
    {
        public bool Offline,DropNextPickup;public int Requests;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation)
        {
            Requests++;if(Offline)throw new HttpRequestException("Simulated disconnected transport");
            bool pickup=request.RequestUri!.AbsolutePath.EndsWith("/pickup");request.RequestUri=new Uri(target,request.RequestUri.AbsolutePath);
            var response=await base.SendAsync(request,cancellation);
            if(pickup&&DropNextPickup){DropNextPickup=false;response.Dispose();throw new HttpRequestException("Simulated lost committed response");}
            return response;
        }
    }
#if !WINDOWS
    private sealed class BorrowedKey(ECDsa key):IDeviceProofKey
    {
        public byte[] ExportPublicKey()=>key.ExportSubjectPublicKeyInfo();
        public byte[] SignChallenge(string id,string nonce,IDeviceIdentity identity){using var data=StrictJson.Parse(JsonSerializer.Serialize(new{challenge_id=id,nonce,fingerprint_version=2,fingerprint_digest=identity.FingerprintDigest,device_public_key=Base64Url.Encode(ExportPublicKey())}));return key.SignData(Encoding.UTF8.GetBytes("YariZan-Device-Challenge-V2\n"+CanonicalJson.Serialize(data.RootElement)),HashAlgorithmName.SHA256,DSASignatureFormat.IeeeP1363FixedFieldConcatenation);}
        public void Dispose(){}
    }
    private sealed class MemoryPending:IPendingPairingStore{private string? _id;public string? Read()=>_id;public void Write(string id)=>_id=id;public void Clear()=>_id=null;}
    private sealed class MemoryEnrollment(ILicenseVerifier verifier,IDeviceIdentity identity,string keyDigest):IProvisionedEnrollmentStore
    {
        private DeviceEnrollment? _identity;public DeviceEnrollment? ReadVerifiedIdentity()=>_identity;
        public void StoreAuthenticatedEnrollment(string envelope){var incoming=verifier.VerifyEnrollment(envelope,identity,keyDigest);if(_identity is not null&&_identity!=incoming)throw new InvalidDataException("Changed enrollment");_identity=incoming;}
    }
    private sealed class MemoryLicenses:ILicenseStore
    {
        private readonly Dictionary<string,string> _licenses=new(),_decisions=new();
        public StoreRead ReadLicense(Product p)=>_licenses.TryGetValue(p.Sku,out var s)?new(StoreReadStatus.Present,s):new(StoreReadStatus.Missing);
        public StoreRead ReadDecision(Product p)=>_decisions.TryGetValue(p.Sku,out var s)?new(StoreReadStatus.Present,s):new(StoreReadStatus.Missing);
        public void WriteLicense(Product p,string s)=>_licenses[p.Sku]=s;public void WriteDecision(Product p,string s)=>_decisions[p.Sku]=s;
        public IDisposable AcquireWriteLock(Product p)=>new Releaser();private sealed class Releaser:IDisposable{public void Dispose(){}}
    }
#endif
}
