<?php
namespace App\Services;
class Totp
{
    public function secret(): string
    {
        $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        $value = "";
        for ($i = 0; $i < 32; $i++) {
            $value .= $alphabet[random_int(0, 31)];
        }
        return $value;
    }
    public function code(string $secret, int $counter): string
    {
        $alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        $bits = "";
        foreach (str_split($secret) as $c) {
            $bits .= str_pad(
                decbin(strpos($alphabet, $c)),
                5,
                "0",
                STR_PAD_LEFT,
            );
        }
        $key = "";
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $key .= chr(bindec($byte));
            }
        }
        $hash = hash_hmac("sha1", pack("N2", 0, $counter), $key, true);
        $offset = ord($hash[19]) & 15;
        $number = unpack("N", substr($hash, $offset, 4))[1] & 0x7fffffff;
        return str_pad((string) ($number % 1000000), 6, "0", STR_PAD_LEFT);
    }
    public function verify(
        string $secret,
        string $code,
        ?int $last = null,
    ): ?int {
        if (!preg_match('/^\d{6}$/', $code)) {
            return null;
        }
        $now = intdiv(time(), 30);
        for ($i = -1; $i <= 1; $i++) {
            $counter = $now + $i;
            if (
                ($last === null || $counter > $last) &&
                hash_equals($this->code($secret, $counter), $code)
            ) {
                return $counter;
            }
        }
        return null;
    }
}
