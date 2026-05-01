using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core;

public static class SerialCodec
{
    public static string Sign(string privateKeyPem, string hwidHex)
    {
        using var ec = ECDsa.Create();
        ec.ImportFromPem(privateKeyPem);
        var data = Encoding.UTF8.GetBytes("YariZan-Serial-v1|" + hwidHex);
        var sig = ec.SignData(data, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return Format(sig);
    }

    public static bool Verify(string publicKeyPem, string hwidHex, string serial)
    {
        try
        {
            var sig = Unformat(serial);
            using var ec = ECDsa.Create();
            ec.ImportFromPem(publicKeyPem);
            var data = Encoding.UTF8.GetBytes("YariZan-Serial-v1|" + hwidHex);
            return ec.VerifyData(data, sig, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        }
        catch { return false; }
    }

    private static string Format(byte[] sig)
    {
        var b32 = Base32(sig);
        var sb = new StringBuilder();
        for (int i = 0; i < b32.Length; i++)
        {
            if (i > 0 && i % 5 == 0) sb.Append('-');
            sb.Append(b32[i]);
        }
        return sb.ToString();
    }

    private static byte[] Unformat(string serial)
    {
        var clean = new string(serial.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return UnBase32(clean);
    }

    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    private static string Base32(byte[] data)
    {
        var sb = new StringBuilder();
        int buf = 0, bits = 0;
        foreach (var b in data)
        {
            buf = (buf << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                bits -= 5;
                sb.Append(Alphabet[(buf >> bits) & 0x1F]);
            }
        }
        if (bits > 0) sb.Append(Alphabet[(buf << (5 - bits)) & 0x1F]);
        return sb.ToString();
    }

    private static byte[] UnBase32(string s)
    {
        var ms = new MemoryStream();
        int buf = 0, bits = 0;
        foreach (var c in s)
        {
            var v = Alphabet.IndexOf(c);
            if (v < 0) continue;
            buf = (buf << 5) | v;
            bits += 5;
            if (bits >= 8)
            {
                bits -= 8;
                ms.WriteByte((byte)((buf >> bits) & 0xFF));
            }
        }
        return ms.ToArray();
    }
}
