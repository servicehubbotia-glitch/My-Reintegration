// Public OAuth client and API-executable deployment identifiers only.
window.MR_GOOGLE_CONFIG = Object.freeze({ clientId: '545919931653-shf20qk6un973q9mpkci2dnk38btvteh.apps.googleusercontent.com', deploymentId: 'AKfycbzcx-u3LKQbJV-E9ESfZ74xN04T86zvrwpjO4VvfSO6BcUE4gTxA7xVNAqI5p_1uJKw', guestUrl: 'https://script.google.com/macros/s/AKfycbzDs7HhH2AoaNu81wYzY46QYUchZ1kmi4t87tsG2WlLb08BRUCgVyBkfRtr-2IyIqnK/exec' });

// Read-only entry routing for the public GitHub Pages address.
// The owner's editor remains accessible with ?edit=1 and still requires Google OAuth.
// Keep the original spreadsheet Restricted; only the separate guest service serves read-only data.
(() => {
  const pathname = window.location.pathname.replace(/\/index\.html$/, '/');
  const onPublicPage = window.location.hostname === 'servicehubbotia-glitch.github.io'
    && pathname === '/My-Reintegration/';
  const editing = new URLSearchParams(window.location.search).get('edit') === '1';
  if (onPublicPage && !editing) {
    window.location.replace(window.MR_GOOGLE_CONFIG.guestUrl);
  }
})();
