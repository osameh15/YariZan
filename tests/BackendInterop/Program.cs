using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using YariZan.Core.V2;

using var input = JsonDocument.Parse(File.ReadAllText(args[0]));
var p = input.RootElement;
if(p.TryGetProperty("apiBase",out _)){await TransportChecks.Run(p);return;}
string Text(string name) => p.GetProperty(name).GetString()!;
var roots = new Dictionary<string,string> {[Text("kid")]=Text("publicKey")};
var verifier = new SignedArtifactVerifier(roots);
var identity = new TestIdentity(Text("fingerprint"));
string Artifact(string name) => p.GetProperty(name).GetRawText();
int count=0;
void Check(bool valid,string name) {if(!valid)throw new Exception(name);count++;}
void Reject(Action action,string name){try{action();}catch(Exception e) when(e is InvalidDataException or CryptographicException or FormatException or System.Text.Json.JsonException){count++;return;}throw new Exception("Accepted "+name);}
var enrollment=verifier.VerifyEnrollment(Artifact("enrollment"),identity,Text("keyDigest"));Check(enrollment.DeviceId==Text("deviceId"),"enrollment");
var license=verifier.VerifyLicense(Artifact("license"),identity,new Product(1),enrollment);Check(license.DeviceId==enrollment.DeviceId,"offline license");
Reject(()=>verifier.VerifyLicense(Artifact("license"),identity,new Product(2),enrollment),"wrong grade");
Reject(()=>verifier.VerifyLicense(Artifact("license"),new TestIdentity(new string('B',64)),new Product(1),enrollment),"fingerprint");
Reject(()=>verifier.VerifyLicense(Artifact("license"),identity,new Product(1),enrollment with {DeviceId=Guid.NewGuid().ToString("D")}),"device UUID");
Reject(()=>verifier.VerifyEnrollment(Artifact("enrollment"),identity,new string('B',64)),"key digest");
Reject(()=>new SignedArtifactVerifier(new Dictionary<string,string>()).VerifyLicense(Artifact("license"),identity,new Product(1),enrollment),"unknown kid");
var start=p.GetProperty("trial").GetProperty("grant");
var trialPayload=start.GetProperty("payload");
var request=new TrialStartRequest(Text("deviceId"),"YARIZAN-G1",trialPayload.GetProperty("client_nonce").GetString()!,trialPayload.GetProperty("process_session_id").GetString()!);
verifier.VerifyTrial(start.GetRawText(),request,new Product(1));count++;
Check(verifier.VerifyDecision(Artifact("active"),license).Status=="ACTIVE","active");
Check(verifier.VerifyDecision(Artifact("revoked"),license).Status=="REVOKED","revoked");
Check(verifier.VerifyDecision(Artifact("revoked"),license).Version>verifier.VerifyDecision(Artifact("active"),license).Version,"monotonic");
foreach(var invalid in p.GetProperty("invalid").EnumerateArray())Reject(()=>verifier.VerifyLicense(invalid.GetRawText(),identity,new Product(1),enrollment),"negative backend artifact");
Reject(()=>verifier.VerifyEnrollment(Artifact("invalidEnrollment"),identity,Text("keyDigest")),"invalid enrollment");
using var vector=StrictJson.Parse(Text("vector"));Check(CanonicalJson.Serialize(vector.RootElement)==Text("canonical"),"canonical vector");
Check(Convert.ToHexString(Encoding.UTF8.GetBytes(SignedArtifactVerifier.LicenseDomain+CanonicalJson.Serialize(p.GetProperty("license").GetProperty("payload"))))==Text("messageHex"),"message bytes");
Check(Convert.ToHexString(Encoding.UTF8.GetBytes(SignedArtifactVerifier.LicenseDomain+CanonicalJson.Serialize(p.GetProperty("referencePayload"))))==Text("referenceMessageHex"),"fixed message bytes");
Console.WriteLine($"DOTNET_INTEROP {count} passed, 0 failed");
