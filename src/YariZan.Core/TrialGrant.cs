using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core;

public sealed record TrialGrant(string Hwid, string Nonce, int Remaining, string Signature)
{
    public bool Verify(string publicKeyPem, string expectedHwid, string expectedNonce)
    {
        if (Remaining is < 0 or > 1 || Hwid != expectedHwid || Nonce != expectedNonce) return false;
        try
        {
            var signature = Convert.FromBase64String(Signature);
            if (signature.Length != 64) return false;
            using var ec = ECDsa.Create();
            ec.ImportFromPem(publicKeyPem);
            var message = Encoding.UTF8.GetBytes($"YariZan-Trial-v1|{Hwid}|{Nonce}|{Remaining}");
            return ec.VerifyData(message, signature, HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        }
        catch { return false; }
    }
}
