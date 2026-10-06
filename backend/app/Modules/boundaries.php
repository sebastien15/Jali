<?php

/**
 * Reviewed module dependency manifest (runbook §4, M01/M02).
 *
 * module => modules it may depend on. A module may use another module ONLY
 * through that module's `Contracts\` namespace, and only when the other module
 * is listed here. Enforced by tests/Feature/Architecture/ModuleBoundaryTest.php.
 * Every folder under app/Modules must have an entry. Changing this file is a
 * reviewed architecture decision — record it in docs/migration/MIGRATION_LOG.md.
 */
return [
    'Bus'            => ['LegacyBookings', 'Locations'],   // implements LegacyBookings\Contracts\BookingTypeHandler (type=bus, trip) and Locations\Contracts\TerminalNetwork
    'DriverHire'     => ['Notifications', 'Payments', 'Pricing', 'Providers'],   // PushSender; MoneyRecorder, ReceiptMailer; PricingPolicy (hire limits/fees); ProviderReputation, ProviderDisplay
    'Identity'       => ['Notifications'],   // OTP codes are sent through Notifications\Contracts\SmsSender
    'LegacyBookings' => [],
    'Locations'      => ['Pricing'],         // road factor from Pricing\Contracts\PricingPolicy
    'NearbyRides'    => ['Locations', 'Notifications', 'Payments', 'Pricing', 'Providers'],   // Geography; PushSender; MoneyRecorder, ReceiptMailer; PricingPolicy + implements ProviderRateRevalidator; ProviderDisplay, ProviderEligibility, ProviderReputation
    'Notifications'  => [],
    'Payments'       => ['Pricing'],         // commission debt limit from PricingPolicy
    'Pricing'        => [],
    'Providers'      => ['Payments'],        // go-online blocker via Payments\Contracts\ProviderDebtLimit
    'Rentals'        => ['LegacyBookings'],  // implements LegacyBookings\Contracts\BookingTypeHandler (type=rental)
    'Safety'         => ['Notifications', 'Providers'],   // SOS pushes via PushSender and texts via SmsSender; driver short name via ProviderDisplay
    'SharedJourneys' => ['LegacyBookings'],  // implements LegacyBookings\Contracts\BookingTypeHandler (type=private)
];
