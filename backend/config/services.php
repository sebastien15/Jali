<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    // SMS for sign-in codes: 'africastalking' in production, 'log' only for local development
    'sms' => [
        'driver' => env('SMS_DRIVER', 'log'),
        'africastalking' => [
            'username'  => env('AFRICASTALKING_USERNAME'),
            'api_key'   => env('AFRICASTALKING_API_KEY'),
            'sender_id' => env('AFRICASTALKING_SENDER_ID'),
        ],
    ],

    // S12.3: critical pushes (driver arrived) fall back to SMS when not opened within this many seconds
    'push' => [
        'sms_fallback_seconds' => (int) env('PUSH_SMS_FALLBACK_SECONDS', 60),
    ],

    // Fixed sign-in code for local development and tests ONLY (ignored in production/staging)
    'otp' => [
        'dev_code' => env('OTP_DEV_CODE'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
