// frontend/js/walletDetection.js
// Robust browser-wallet detection.
//
// Many wallets (Rabby, Brave Wallet, Phantom, Coinbase Wallet, and even
// MetaMask in some setups) inject their provider asynchronously via the
// EIP-6963 announcement event, so a single synchronous check for
// `window.ethereum` is unreliable. This script gathers every announced
// provider, waits a short grace period, and exposes the best available
// one so the rest of the app can connect to it.

(function (global) {
  'use strict';

  const EIP6963_ANNOUNCE_EVENT = 'eip6963:announceProvider';
  const ETHEREUM_INITIALIZED_EVENT = 'ethereum#initialized';
  const DETECTION_TIMEOUT_MS = 1500;

  let detectionPromise = null;

  /**
   * Collects every wallet provider announced via EIP-6963 and/or
   * window.ethereum, then resolves with the best one (or null).
   *
   * Resolution is cached so repeated calls are cheap.
   */
  function detectWalletProvider() {
    if (detectionPromise) return detectionPromise;

    // Simple timeout fallback
    let fallbackTimer = null;

    detectionPromise = new Promise(function (resolve) {
      const providers = new Map(); // key -> { info, provider }

      function emit(provider, info) {
        if (!provider) return;
        // Guard against accessing properties on undefined (e.g., .origin)
        try {
          const key = (info && info.uuid) ||
            (provider === window.ethereum ? 'window.ethereum' : 'anonymous');
          if (!providers.has(key)) {
            providers.set(key, { info: info || null, provider: provider });
          }
        } catch (e) {
          console.warn('WalletDetection: emit error:', e);
        }
      }

      // Initialize with current state to catch already-injected wallets
      try {
        if (window.ethereum) {
          emit(window.ethereum, { uuid: 'window.ethereum', name: 'Detected Wallet' });
        }
      } catch (e) {
        console.warn('WalletDetection: initial emit error:', e);
      }

      // Some wallets set window.ethereum synchronously but announce via
      // EIP-6963 later (or vice versa). Listen for both.
      // Protect against reading undefined properties during init
      setTimeout(function () {
        try {
          if (window.ethereum) {
            emit(window.ethereum, { uuid: 'window.ethereum', name: 'Detected Wallet' });
          }
        } catch (e) {
          console.warn('WalletDetection: delayed emit error:', e);
        }
      }, 50);

      function onAnnounce(event) {
        try {
          var detail = event && event.detail;
          if (detail && detail.info && detail.provider) {
            // Guard against invalid detail with undefined/null properties
            try {
              emit(detail.provider, detail.info);
            } catch (e) {
              console.warn('WalletDetection: emit error in onAnnounce:', e);
            }
          }
        } catch (e) {
          console.warn('WalletDetection: onAnnounce error:', e);
        }
      }

      window.addEventListener(EIP6963_ANNOUNCE_EVENT, onAnnounce);

      // Some older wallets fire `ethereum#initialized` when they're ready.
      function onInitialized() {
        try {
          if (window.ethereum) {
            // Guard against invalid window.ethereum
            emit(window.ethereum, { uuid: 'window.ethereum', name: 'Detected Wallet' });
          }
        } catch (e) {
          console.warn('WalletDetection: onInitialized error:', e);
        }
      }
      window.addEventListener(ETHEREUM_INITIALIZED_EVENT, onInitialized);

      // If the wallet never announces, we still want to fall back to
      // window.ethereum after a short grace period.
      const timer = setTimeout(function () {
        cleanup();
        resolve(pickProvider(providers));
      }, DETECTION_TIMEOUT_MS);

      function cleanup() {
        try {
          window.removeEventListener(EIP6963_ANNOUNCE_EVENT, onAnnounce);
          window.removeEventListener(ETHEREUM_INITIALIZED_EVENT, onInitialized);
        } catch (e) {
          console.warn('WalletDetection: cleanup error:', e);
        }
        clearTimeout(timer);
      }

      function maybeResolve() {
        var picked = pickProvider(providers);
        if (picked) {
          cleanup();
          resolve(picked);
        }
      }

      // Check again whenever a new provider is announced.
      function onAnnounceWrapped(event) {
        try {
          onAnnounce(event);
          maybeResolve();
        } catch (e) {
          console.warn('WalletDetection: onAnnounceWrapped error:', e);
        }
      }
      window.addEventListener(EIP6963_ANNOUNCE_EVENT, onAnnounceWrapped);

      // Keep reference to event handler for cleanup
      window.WalletDetectionEventHandler = onAnnounceWrapped;
      fallbackTimer = setTimeout(function() {
        cleanup();
        resolve(pickProvider(providers));
      }, DETECTION_TIMEOUT_MS);
    });

    return detectionPromise;
  }

  /**
   * Pick the best provider from the collected set.
   * Prefers MetaMask when present (most reliable, sets window.ethereum),
   * then the first announced EIP-6963 provider, then window.ethereum.
   */
  function pickProvider(providers) {
    if (providers.size === 0) return null;
    for (var entry of providers.values()) {
      if (entry.info && /metamask/i.test(entry.info.name)) return entry;
    }
    for (var entry of providers.values()) {
      if (entry.info && entry.info.uuid !== 'window.ethereum') return entry;
    }
    for (var entry of providers.values()) {
      return entry;
    }
    return null;
  }

  /**
   * Returns a helpful, actionable message when no wallet is detected.
   */
  async function getNoWalletMessage() {
    var names = await getDetectedWalletNames();
    if (names.length > 0) {
      return 'Wallet detected (' + names.join(', ') +
        ') but it could not be used. Please refresh the page and try again.';
    }
    return (
      'No browser wallet detected! ' +
      'Install one (e.g. MetaMask, Rabby, Brave Wallet) and make sure it is unlocked. ' +
      'If you already have one, refresh this page.'
    );
  }

  async function getDetectedWalletNames() {
    var result = await detectWalletProvider();
    if (!result) return [];
    var names = [];
    if (result.info && result.info.name) names.push(result.info.name);
    return names;
  }

  global.WalletDetection = {
    detectWalletProvider: detectWalletProvider,
    getDetectedWalletNames: getDetectedWalletNames,
    getNoWalletMessage: getNoWalletMessage,
    DETECTION_TIMEOUT_MS: DETECTION_TIMEOUT_MS,
  };
})(window);