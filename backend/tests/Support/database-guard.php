<?php

require __DIR__.'/../../vendor/autoload.php';
$test = new class('testProbe') extends Tests\TestCase {
    public function testProbe(): void {}
};
try {
    $test->createApplication();
    echo 'unexpectedly-accepted'; exit(1);
} catch (RuntimeException $e) {
    if ($e->getMessage() !== 'Refusing test setup outside the dedicated space_crm_test MySQL database.') {
        fwrite(STDERR, 'Unexpected guard failure.'); exit(2);
    }
    echo 'refused-before-refresh';
}
