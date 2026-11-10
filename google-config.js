// Public OAuth client and API-executable deployment identifiers only.
window.MR_GOOGLE_CONFIG = Object.freeze({ clientId: '545919931653-shf20qk6un973q9mpkci2dnk38btvteh.apps.googleusercontent.com', deploymentId: 'AKfycbzcx-u3LKQbJV-E9ESfZ74xN04T86zvrwpjO4VvfSO6BcUE4gTxA7xVNAqI5p_1uJKw', guestUrl: 'https://script.google.com/macros/s/AKfycbzDs7HhH2AoaNu81wYzY46QYUchZ1kmi4t87tsG2WlLb08BRUCgVyBkfRtr-2IyIqnK/exec', publicUrl: 'https://servicehubbotia-glitch.github.io/My-Reintegration/' });

// The public address is a fictional demonstration. It never loads the real journal.
// Authorized editors use ?edit=1; private readers use the separate revocable link.
(() => {
  const query = new URLSearchParams(window.location.search);
  window.MR_MODE = query.get('edit') === '1' ? 'editor' : 'demo';
  window.MR_PUBLIC_MODE = window.MR_MODE !== 'editor';
  if (window.MR_MODE === 'editor') {
    const signIn = document.createElement('script');
    signIn.src = 'https://accounts.google.com/gsi/client';
    signIn.async = true;
    signIn.onerror = () => document.dispatchEvent(new Event('google-signin-unavailable'));
    document.head.appendChild(signIn);
  }
})();
