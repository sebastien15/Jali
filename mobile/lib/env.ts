export type AppEnv = "dev" | "test" | "prod";

const RAW_ENV = process.env.EXPO_PUBLIC_APP_ENV;

// Default to "prod": a build that lost its env var must never ship the dev
// shortcuts (Google login bypass, Sign-In stub) or point at a LAN API.
export const APP_ENV: AppEnv =
  RAW_ENV === "dev" || RAW_ENV === "test" || RAW_ENV === "prod" ? RAW_ENV : "prod";

if (!RAW_ENV) {
  console.warn("[env] EXPO_PUBLIC_APP_ENV is not set — defaulting to prod");
}

export const isDev  = APP_ENV === "dev";
export const isTest = APP_ENV === "test";
export const isProd = APP_ENV === "prod";
