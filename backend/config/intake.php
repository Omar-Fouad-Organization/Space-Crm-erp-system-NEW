<?php
return [
    'enabled' => env('INTAKE_ENABLED', false),
    'role' => 'erp',
    'peer' => 'website',
    'site' => 'green-life-expo',
    'exhibition_id' => (int) env('INTAKE_EXHIBITION_ID', 0),
    'key_id' => env('INTAKE_KEY_ID', 'primary'),
    'key' => env('INTAKE_SERVICE_KEY'),
    'peer_url' => env('INTAKE_PEER_URL'),
    'policy_version' => env('INTAKE_PRIVACY_VERSION'),
    'retention_days' => env('INTAKE_RETENTION_DAYS'),
    'max_bytes' => 65536,
];
