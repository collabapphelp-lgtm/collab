import * as WebBrowser from 'expo-web-browser';

/** Public pages on Firebase Hosting (hosting/public). Deploy with: firebase deploy --only hosting */
export const LEGAL_URLS = {
  privacy: 'https://collab-609ac.web.app/privacy',
  terms: 'https://collab-609ac.web.app/terms',
};
export const SUPPORT_EMAIL = 'collabapphelp@gmail.com';

export function openLegal(page: keyof typeof LEGAL_URLS) {
  return WebBrowser.openBrowserAsync(LEGAL_URLS[page]).catch(() => {});
}
