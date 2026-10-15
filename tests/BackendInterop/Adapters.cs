namespace YariZan.Core.V2;
// Test adapters only for platform-independent inputs to the unchanged verifier.
public interface IDeviceIdentity {
    int FingerprintVersion { get; }
    string FingerprintDigest { get; }
    string Username { get; }
    bool IsAvailable { get; }
}
public sealed record TestIdentity(string FingerprintDigest) : IDeviceIdentity {
    public int FingerprintVersion => 2;
    public string Username => "test";
    public bool IsAvailable => true;
}
public sealed record DeviceEnrollment(string DeviceId,int FingerprintVersion,string FingerprintDigest,string DeviceKeyDigest,string ProfileEnrollmentId);
public enum StoreReadStatus { Missing, Present, Corrupt }
public sealed record StoreRead(StoreReadStatus Status,string? Envelope=null);
public interface ILicenseStore {
    StoreRead ReadLicense(Product product);
    StoreRead ReadDecision(Product product);
    void WriteLicense(Product product,string envelope);
    void WriteDecision(Product product,string envelope);
    IDisposable AcquireWriteLock(Product product);
}
public interface ILocalDeviceEnrollmentProvider {DeviceEnrollment? ReadVerifiedIdentity();}
public sealed class UnprovisionedDeviceEnrollment : ILocalDeviceEnrollmentProvider {public DeviceEnrollment? ReadVerifiedIdentity()=>null;}
