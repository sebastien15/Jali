export type AppEnv = "dev" | "test" | "prod";

export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as AppEnv;

// dev  → full mocks, no network, works in Expo Go
// test → mocks for read, real calls for writes (Google sign-in, bookings)
// prod → everything real, no mocks ever
export const isDev  = APP_ENV === "dev";
export const isTest = APP_ENV === "test";
export const isProd = APP_ENV === "prod";

// Use mock data for listings/trips if dev or test
export const useMocks = isDev || isTest;
