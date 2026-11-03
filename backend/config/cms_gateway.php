<?php

return [
    'enabled' => env('CMS_GATEWAY_ENABLED', false),
    'issuer' => 'space-erp',
    'service' => 'space-erp-cms',
    'key_id' => env('CMS_GATEWAY_KEY_ID', 'primary'),
    'key' => env('CMS_GATEWAY_KEY'),
    'max_json_bytes' => 4194304,
    'max_upload_bytes' => 5242880,
    'max_response_bytes' => 8388608,
    'sites' => [
        'green-life-expo' => [
            'name' => 'Green Life Expo',
            'exhibition_id' => env('CMS_ERP_EXHIBITION_ID'),
            'public_origin' => env('GREEN_LIFE_PUBLIC_ORIGIN'),
            'gateway_url' => env('GREEN_LIFE_CMS_GATEWAY_URL'),
            'audience' => 'green-life-cms',
        ],
    ],
];
