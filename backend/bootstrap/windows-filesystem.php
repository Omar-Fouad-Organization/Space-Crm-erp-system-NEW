<?php

namespace Illuminate\Foundation;

// Windows restricted tokens can report a writable directory as read-only.
// Verify an actual temporary write only for this application's cache directory.
function is_writable($path): bool
{
    if (\is_writable($path)) return true;
    if (PHP_OS_FAMILY !== 'Windows' || realpath($path) !== realpath(__DIR__.'/cache')) return false;
    $probe = $path.'/probe-'.bin2hex(random_bytes(8));
    $handle = @fopen($probe, 'x');
    if ($handle === false) return false;
    fclose($handle); unlink($probe);
    return true;
}
