<?php
return [
    'enabled' => env('PARTICIPANT_PORTAL_API_ENABLED', false),
    'issuer' => 'green-life-portal',
    'audience' => 'space-participant-api',
    // Independent keys; retain the previous identifier only during a controlled rotation.
    'keys' => array_filter(['primary' => env('PARTICIPANT_PORTAL_SERVICE_KEY'), 'previous' => env('PARTICIPANT_PORTAL_PREVIOUS_KEY')]),
    'max_bytes' => 65536,
    'media_key'=>env('PARTICIPANT_PORTAL_MEDIA_KEY'),'media_key_id'=>env('PARTICIPANT_PORTAL_MEDIA_KEY_ID','primary'),'website_url'=>env('PARTICIPANT_PORTAL_WEBSITE_URL'),
];
