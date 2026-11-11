<?php

namespace App\Services;

use Illuminate\Encryption\Encrypter;

class ParticipantDeliveryCipher
{
    private function encrypter(string $identifier): Encrypter
    {
        abort_unless(in_array($identifier, ['primary', 'previous'], true), 503);
        $encoded = config('participant_onboarding.keys.'.$identifier);
        $key = is_string($encoded) && str_starts_with($encoded, 'base64:') ? base64_decode(substr($encoded, 7), true) : false;
        abort_unless(is_string($key) && strlen($key) === 32, 503, 'Managed invitation delivery key is unavailable.');

        return new Encrypter($key, 'AES-256-CBC');
    }

    public function assertConfigured(): void
    {
        $this->encrypter((string) config('participant_onboarding.key_id'));
    }

    public function seal(#[\SensitiveParameter] array $payload): string
    {
        return $this->encrypter((string) config('participant_onboarding.key_id'))->encryptString(json_encode($payload, JSON_THROW_ON_ERROR));
    }

    public function open(string $identifier, #[\SensitiveParameter] string $ciphertext): array
    {
        return json_decode($this->encrypter($identifier)->decryptString($ciphertext), true, 16, JSON_THROW_ON_ERROR);
    }
}
