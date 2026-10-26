# Collab — mobile app

React Native + Expo (SDK 58) app for Collab, sharing the Firebase project (`collab-609ac`) with the web prototype.

## Run it on your iPhone

1. Install [Node.js LTS](https://nodejs.org) on your computer (one time).
2. In a terminal, from this folder:
   ```
   npm install
   npx expo start --tunnel
   ```
3. Open the **Camera** app on your iPhone and scan the QR code. It opens in **Expo Go**.

`--tunnel` works even when your phone and computer are on different networks. On the same Wi‑Fi, plain `npx expo start` is faster.

## Project layout

```
src/app/            screens (every file is a route)
  index.tsx         decides where to send someone: welcome, onboarding, or the app
  (auth)/           welcome, signup, login
  onboarding/       onboarding flow (Phase 2)
  (app)/            the main app: discover, matches, messages, profile (Phases 3–4)
src/components/     shared UI: Button, TextField, BackButton…
src/lib/            firebase setup, auth state, brand theme, types
```

## Checks before committing

```
npm run typecheck
npx eslint .
```

## Roadmap

- [x] Phase 1 — foundation, login, signup
- [ ] Phase 2 — onboarding (location, creator type, skills, looking for, genres, showcase, bio)
- [ ] Phase 3 — discover and matching
- [ ] Phase 4 — messaging and push notifications
- [ ] Phase 5 — safety (report/block, account deletion), privacy policy, Firestore security rules
- [ ] Phase 6 — TestFlight, then App Store
