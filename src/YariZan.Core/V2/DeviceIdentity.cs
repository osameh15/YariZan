using System.Management;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;

namespace YariZan.Core.V2;

public interface IDeviceFingerprintProvider
{
    IReadOnlyDictionary<string, IEnumerable<string>> ReadSignals();
    string? ReadMachineFallback();
}

public interface IDeviceIdentity
{
    int FingerprintVersion { get; }
    string FingerprintDigest { get; }
    string Username { get; }
    bool IsAvailable { get; }
}

/// <summary>Public identity only. Neither digest nor username is an authentication credential.</summary>
public sealed class DeviceIdentityV2 : IDeviceIdentity
{
    public int FingerprintVersion => 2;
    public string FingerprintDigest { get; }
    public string Username { get; }
    public bool IsAvailable => FingerprintDigest.Length == 64;

    public DeviceIdentityV2(IDeviceFingerprintProvider provider)
    {
        // Named, length-delimited, sorted signals avoid enumeration and delimiter ambiguity.
        var signals = provider.ReadSignals();
        var seed = new StringBuilder("YariZan-Fingerprint-V2\n");
        bool any = false;
        foreach (string name in new[] { "uuid", "board", "bios", "cpu" })
        {
            var values = signals.TryGetValue(name, out var found) ? found : [];
            foreach (string value in values.Select(Normalize).Where(v => v.Length > 0).Distinct().Order(StringComparer.Ordinal))
            {
                seed.Append(name).Append(':').Append(value.Length).Append(':').Append(value).Append('\n');
                any = true;
            }
        }
        if (!any)
        {
            // Registry MachineGuid is user/grade/path independent but changes on OS reinstall.
            string fallback = Normalize(provider.ReadMachineFallback());
            if (fallback.Length > 0) { seed.Append("machine-guid:").Append(fallback); any = true; }
        }
        FingerprintDigest = any ? Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed.ToString()))) : "";
        // 96 bits, grouped hex for support; server must detect collisions when enrolling.
        Username = any ? "YZ-" + string.Join('-', Enumerable.Range(0, 6).Select(i => FingerprintDigest.Substring(i * 4, 4))) : "YZ-UNAVAILABLE";
    }

    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        string normalized = string.Join(' ', value.Normalize(NormalizationForm.FormKC).Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
        if (normalized is "UNKNOWN" or "NONE" or "N/A" or "DEFAULT STRING" or "TO BE FILLED BY O.E.M." or "SYSTEM SERIAL NUMBER" or "NOT SPECIFIED") return "";
        string significant = new(normalized.Where(char.IsLetterOrDigit).ToArray());
        if (significant.Length == 0 || significant.All(c => c == '0') || significant.All(c => c == 'F')) return "";
        return normalized;
    }
}

public sealed class WindowsFingerprintProvider : IDeviceFingerprintProvider
{
    public IReadOnlyDictionary<string, IEnumerable<string>> ReadSignals() => new Dictionary<string, IEnumerable<string>>
    {
        ["uuid"] = Read("Win32_ComputerSystemProduct", "UUID"),
        ["board"] = Read("Win32_BaseBoard", "SerialNumber"),
        ["bios"] = Read("Win32_BIOS", "SerialNumber"),
        ["cpu"] = Read("Win32_Processor", "ProcessorId")
    };

    private static string[] Read(string table, string property)
    {
        try
        {
            using var query = new ManagementObjectSearcher($"SELECT {property} FROM {table}");
            using var rows = query.Get();
            var result = new List<string>();
            foreach (ManagementObject row in rows)
                using (row) result.Add(row[property]?.ToString() ?? "");
            return result.ToArray();
        }
        catch (Exception ex) when (ex is ManagementException or System.Runtime.InteropServices.COMException or UnauthorizedAccessException) { return []; }
    }

    public string? ReadMachineFallback()
    {
        try
        {
            using var machine = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
            using var key = machine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            return key?.GetValue("MachineGuid") as string;
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or System.Security.SecurityException or IOException) { return null; }
    }
}
