/**
 * CustomHeadScripts — SECURITY DISABLED
 *
 * Injecting arbitrary <script> tags from database content is a Stored XSS vector.
 * This component has been intentionally disabled until a safe implementation
 * using server-side Next.js <Script> with strict CSP nonces is in place.
 *
 * DO NOT re-enable innerHTML / document.createElement('script') injection.
 */
export default function CustomHeadScripts() {
  // Disabled: no scripts are injected from the backend.
  return null;
}
