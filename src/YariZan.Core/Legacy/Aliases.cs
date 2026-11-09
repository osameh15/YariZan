#if NETFRAMEWORK
global using System.Net.Http;
global using System.Diagnostics;
global using Random = YariZan.Core.Legacy.LegacyRandomSource;
global using TaskCompletionSource = YariZan.Core.Legacy.LegacyCompletionSource;
global using Convert = YariZan.Core.Legacy.LegacyConvert;
global using SHA256 = YariZan.Core.Legacy.LegacySha256;
global using HMACSHA256 = YariZan.Core.Legacy.LegacyHmacSha256;
global using RandomNumberGenerator = YariZan.Core.Legacy.LegacyRandom;
global using Rfc2898DeriveBytes = YariZan.Core.Legacy.LegacyPbkdf2;
global using AesGcm = YariZan.Core.Legacy.LegacyAesGcm;
global using ECDsa = YariZan.Core.Legacy.LegacyEcdsa;
global using DSASignatureFormat = YariZan.Core.Legacy.LegacySignatureFormat;
global using CryptographicOperations = YariZan.Core.Legacy.LegacyCryptoOperations;
#endif
