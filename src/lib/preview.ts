/**
 * UI preview mode: fakes a signed-in user and skips all Firebase reads/writes so screens can be
 * clicked through without a backend. Only on when built with EXPO_PUBLIC_UI_PREVIEW=1 (never in
 * normal `npx expo start` or App Store builds). Set EXPO_PUBLIC_UI_PREVIEW_STAGE to 'onboarding'
 * or 'app' to pick where it starts.
 */
export const UI_PREVIEW = process.env.EXPO_PUBLIC_UI_PREVIEW === '1';
export const UI_PREVIEW_STAGE = process.env.EXPO_PUBLIC_UI_PREVIEW_STAGE ?? 'onboarding';
