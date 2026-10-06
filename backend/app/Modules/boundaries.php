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
    'Bus'            => ['Identity', 'LegacyBookings', 'Locations'],   // implements Identity\Contracts\AccountClosure (station agent unassigned); implements LegacyBookings\Contracts\BookingTypeHandler (type=bus, trip) and Locations\Contracts\TerminalNetwork
    'DriverHire'     => ['Notifications', 'Payments', 'Pricing', 'Providers'],   // PushSender; MoneyRecorder, ReceiptMailer; PricingPolicy (hire limits/fees); ProviderReputation, ProviderDisplay
    'Identity'       => ['Notifications', 'Payments'],   // OTP codes via SmsSender, sign-out forgets the push token via PushTokens; staff earnings on the admin profile via Payments\Contracts\StaffEarnings
    'LegacyBookings' => [],
    'Locations'      => ['Pricing'],         // road factor from Pricing\Contracts\PricingPolicy
    'NearbyRides'    => ['Locations', 'Notifications', 'Payments', 'Pricing', 'Providers'],   // Geography; PushSender; MoneyRecorder, ReceiptMailer; PricingPolicy + implements ProviderRateRevalidator; ProviderDisplay, ProviderEligibility, ProviderReputation
    'Notifications'  => [],
    'Payments'       => ['Notifications', 'Pricing'],   // settlement review pushes via PushSender; commission debt limit and earnings settings from PricingPolicy
    'Pricing'        => [],
    'Providers'      => ['Identity', 'Notifications', 'Payments', 'Pricing'],   // implements Identity\Contracts\AccountClosure (driver profile removed), promotes verified riders via ProviderRoles; verification pushes via PushSender and setup saves the push token via PushTokens; go-online blocker via Payments\Contracts\ProviderDebtLimit; review thresholds from PricingPolicy
    'Rentals'        => ['Identity', 'LegacyBookings'],  // implements Identity\Contracts\AccountClosure (cars deactivated) and LegacyBookings\Contracts\BookingTypeHandler (type=rental)
    'Safety'         => ['Notifications', 'Providers'],   // SOS pushes via PushSender and texts via SmsSender; driver short name via ProviderDisplay
    'SharedJourneys' => ['Identity', 'LegacyBookings'],  // implements Identity\Contracts\AccountClosure (listings deactivated) and LegacyBookings\Contracts\BookingTypeHandler (type=private)
];
