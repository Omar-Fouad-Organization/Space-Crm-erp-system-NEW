<?php

return [
    // A separately authorized schema-first rollout is required for operational users.
    'enabled' => env('GRANULAR_AUTHORIZATION_ENABLED', false),
    'standalone_resources' => ['tasks', 'meetings', 'documents', 'tickets', 'channels'],
    'reserved_namespaces' => ['website', 'content', 'seo', 'media', 'submissions', 'buyers', 'visitors', 'hosted_buyers', 'matchmaking'],
];
