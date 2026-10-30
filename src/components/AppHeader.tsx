import { SiteHeader } from './SiteHeader';

/** Classic pages (profiles, solo, rooms) share the main site header so the product reads as one app. */
export function AppHeader() {
  return <SiteHeader compact />;
}
