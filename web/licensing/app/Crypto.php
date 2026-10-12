<?php
declare(strict_types=1);
namespace YariZan\Licensing;

final class Crypto
{
    public static function hwid(string $value): string
    {
        $value = strtoupper(preg_replace('/[\s-]+/', '', trim($value)) ?? '');
        if (!preg_match('/\A[A-F0-9]{64}\z/D', $value)) {
            throw new \InvalidArgumentException('HWID must contain exactly 64 hexadecimal characters.');
        }
        return $value;
    }

    public static function sign(string $keyPath, string $message): string
    {
        $pem = @file_get_contents($keyPath);
        $key = $pem === false ? false : openssl_pkey_get_private($pem);
        $details = $key === false ? false : openssl_pkey_get_details($key);
        if (!$details || $details['type'] !== OPENSSL_KEYTYPE_EC ||
            ($details['ec']['curve_name'] ?? '') !== 'prime256v1') {
            throw new \RuntimeException('A P-256 signing key is required.');
        }
        if (!openssl_sign($message, $der, $key, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('Signing failed.');
        }
        return self::derToRaw($der);
    }

    // PHP OpenSSL emits DER; .NET's existing serial codec uses fixed-width r || s.
    public static function derToRaw(string $der): string
    {
        if (strlen($der) < 8 || ord($der[0]) !== 0x30 || ord($der[1]) !== strlen($der) - 2) {
            throw new \RuntimeException('Invalid ECDSA signature.');
        }
        $offset = 2;
        $raw = '';
        for ($i = 0; $i < 2; $i++) {
            if ($offset + 2 > strlen($der) || ord($der[$offset++]) !== 2) {
                throw new \RuntimeException('Invalid ECDSA integer.');
            }
            $length = ord($der[$offset++]);
            if ($length < 1 || $offset + $length > strlen($der)) {
                throw new \RuntimeException('Invalid ECDSA length.');
            }
            $part = ltrim(substr($der, $offset, $length), "\0");
            $offset += $length;
            if (strlen($part) > 32) throw new \RuntimeException('Oversized ECDSA integer.');
            $raw .= str_pad($part, 32, "\0", STR_PAD_LEFT);
        }
        if ($offset !== strlen($der)) throw new \RuntimeException('Trailing signature data.');
        return $raw;
    }

    public static function serial(string $keyPath, string $hwid): string
    {
        $raw = self::sign($keyPath, 'YariZan-Serial-v1|' . self::hwid($hwid));
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $buffer = 0; $bits = 0; $encoded = '';
        foreach (unpack('C*', $raw) as $byte) {
            $buffer = ($buffer << 8) | $byte;
            $bits += 8;
            while ($bits >= 5) {
                $bits -= 5;
                $encoded .= $alphabet[($buffer >> $bits) & 31];
            }
            $buffer &= (1 << $bits) - 1;
        }
        if ($bits > 0) $encoded .= $alphabet[($buffer << (5 - $bits)) & 31];
        return implode('-', str_split($encoded, 5));
    }
}
