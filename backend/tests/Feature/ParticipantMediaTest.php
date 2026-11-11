<?php

namespace Tests\Feature;

use App\Services\ParticipantMedia;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ParticipantMediaTest extends TestCase
{
    private function enable(): void
    {
        config(['participant_portal.website_url' => 'http://127.0.0.1:9999', 'participant_portal.media_key' => str_repeat('m', 40)]);
    }

    public function test_private_media_delegation_accepts_complete_chunked_bytes_and_preserves_signature_binding(): void
    {
        $this->enable();
        $base = Utils::streamFor('%PDF-1.4 synthetic');
        $stream = FnStream::decorate($base, ['read' => fn ($length) => $base->read(min(3, $length))]);
        Http::fake(fn () => Http::response($stream, 200, ['Content-Type' => 'application/pdf']));
        $this->assertSame(['%PDF-1.4 synthetic', 'application/pdf'], app(ParticipantMedia::class)->read(['file_id' => 'synthetic']));
        Http::assertSent(fn ($r) => $r->hasHeader('X-Space-Portal-Media-Signature') && $r->data()['file_id'] === 'synthetic');
    }

    public function test_private_media_response_keeps_its_original_size_limit(): void
    {
        $this->enable();
        Http::fake(fn () => Http::response(str_repeat('x', 8388609), 200, ['Content-Type' => 'application/pdf']));
        try {
            app(ParticipantMedia::class)->read(['file_id' => 'synthetic']);
            $this->fail('Oversized private file accepted');
        } catch (HttpException $e) {
            $this->assertSame(502, $e->getStatusCode());
        }Http::assertSentCount(1);
    }

    public function test_private_media_rejects_unapproved_content_types(): void
    {
        $this->enable();
        Http::fake(fn () => Http::response('<html>synthetic</html>', 200, ['Content-Type' => 'text/html']));
        try {
            app(ParticipantMedia::class)->read(['file_id' => 'synthetic']);
            $this->fail('Unexpected private content type accepted');
        } catch (HttpException $e) {
            $this->assertSame(502, $e->getStatusCode());
        }Http::assertSentCount(1);
    }
}
