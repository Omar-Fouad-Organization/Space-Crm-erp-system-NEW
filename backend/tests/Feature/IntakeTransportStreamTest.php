<?php

namespace Tests\Feature;

use App\Services\IntakeTransport;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class IntakeTransportStreamTest extends TestCase
{
    private function responseStream(string $body, bool $stalled = false): FnStream
    {
        $stream = Utils::streamFor($body);
        $finished = false;

        return FnStream::decorate($stream, [
            'read' => function (int $length) use ($stream, &$finished, $stalled): string {
                if ($stalled) {
                    return '';
                }
                $chunk = $stream->read(min($length, 4096));
                if ($chunk === '') {
                    $finished = true;
                }

                return $chunk;
            },
            'eof' => function () use (&$finished): bool {
                return $finished;
            },
        ]);
    }

    private function configure(): void
    {
        config(['intake.enabled' => true, 'intake.exhibition_id' => 7001,
            'intake.key' => 'SyntheticStreamTransportKeyForTestsOnly00000000',
            'intake.peer_url' => 'https://authority.example.test']);
        Http::preventStrayRequests();
    }

    public function test_complete_acknowledgment_with_delayed_eof_is_accepted(): void
    {
        $this->configure();
        Http::fake(['https://authority.example.test/api/internal/intake/accept' =>
            Http::response($this->responseStream('{"accepted":true}'), 200)]);

        $this->assertSame(['accepted' => true], app(IntakeTransport::class)->send('accept', ['synthetic' => true]));
        Http::assertSentCount(1);
    }

    public function test_response_over_the_cap_is_rejected_with_502(): void
    {
        $this->configure();
        Http::fake(['https://authority.example.test/api/internal/intake/accept' =>
            Http::response($this->responseStream(str_repeat('x', 262145)), 200)]);

        try {
            app(IntakeTransport::class)->send('accept', ['synthetic' => true]);
            $this->fail('An oversized response must fail closed.');
        } catch (HttpException $error) {
            $this->assertSame(502, $error->getStatusCode());
        }
        Http::assertSentCount(1);
    }

    public function test_stalled_stream_is_rejected_with_502(): void
    {
        $this->configure();
        Http::fake(['https://authority.example.test/api/internal/intake/accept' =>
            Http::response($this->responseStream('', true), 200)]);

        try {
            app(IntakeTransport::class)->send('accept', ['synthetic' => true]);
            $this->fail('An interrupted stream must fail closed.');
        } catch (HttpException $error) {
            $this->assertSame(502, $error->getStatusCode());
        }
        Http::assertSentCount(1);
    }
}
