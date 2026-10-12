using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace YariZan.Core;

public sealed record AccessGrant(string Hwid, string Nonce, string Mode,
    [property: JsonPropertyName("credential_hash")] string CredentialHash, string Signature)
{
    public bool Verify(string publicKey, string hwid, string nonce, string mode, string credential)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential)));
        if (Hwid != hwid || Nonce != nonce || Mode != mode || CredentialHash != hash) return false;
        try
        {
            using var ec = ECDsa.Create(); ec.ImportFromPem(publicKey);
            var signature = Convert.FromBase64String(Signature);
            return signature.Length == 64 && ec.VerifyData(
                Encoding.UTF8.GetBytes($"YariZan-Access-v1|{hwid}|{nonce}|{mode}|{hash}"), signature,
                HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        }
        catch { return false; }
    }
}
