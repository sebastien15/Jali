export type AppEnv = "dev" | "test" | "prod";

export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV ?? "dev") as AppEnv;

export const isDev  = APP_ENV === "dev";
export const isTest = APP_ENV === "test";
export const isProd = APP_ENV === "prod";
