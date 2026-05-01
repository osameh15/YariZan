using System.Management;
using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core;

public static class HwidProvider
{
    public static string GetHwid()
    {
        var parts = new List<string>
        {
            Wmi("Win32_BaseBoard", "SerialNumber"),
            Wmi("Win32_Processor", "ProcessorId"),
            Wmi("Win32_BIOS", "SerialNumber"),
            Wmi("Win32_DiskDrive", "SerialNumber", "WHERE Index=0"),
        };

        var seed = string.Join("|", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
        if (seed.Length == 0)
            seed = Environment.MachineName + "|" + Environment.UserName;

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("YariZan-HWID-v1|" + seed));
        return Convert.ToHexString(hash);
    }

    public static string GetHwidPretty()
    {
        var hex = GetHwid();
        return string.Join("-",
            Enumerable.Range(0, 8).Select(i => hex.Substring(i * 4, 4)));
    }

    private static string Wmi(string cls, string prop, string where = "")
    {
        try
        {
            var query = $"SELECT {prop} FROM {cls} {where}";
            using var s = new ManagementObjectSearcher(query);
            foreach (ManagementObject o in s.Get())
                return (o[prop]?.ToString() ?? "").Trim();
        }
        catch { }
        return "";
    }
}
