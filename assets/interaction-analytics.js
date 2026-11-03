(function (window, document) {
  'use strict';

  var location = window.location;
  var enabled = location.hostname === 'vaughnmck.github.io' &&
    /^\/conditional(?:\/|$)/.test(location.pathname) &&
    new URL(location.href).searchParams.get('analytics') !== 'off';
  var transport = null;
  var scrubberRecorded = false;

  function send(name, data) {
    if (!enabled || !transport) return;
    try {
      var result = transport(name, data);
      if (result && typeof result.catch === 'function') result.catch(function () {});
    } catch (error) { /* Tracking must never interrupt navigation or the chart. */ }
  }

  window.conditionalAnalytics = {
    enabled: enabled,
    // The provider setup supplies this callback before the widget is interactive.
    // Without it, no telemetry leaves the page.
    connect: function (callback) { transport = typeof callback === 'function' ? callback : null; },
    scrubberUsed: function (input, outcome) {
      if (!enabled || !transport || scrubberRecorded) return;
      scrubberRecorded = true;
      send('scrubber_used', { input: input, outcome: outcome });
    }
  };

  function marketClick(event) {
    if (!enabled) return;
    var target = event.target;
    var anchor = target && target.closest ? target.closest('a[href]') : null;
    if (!anchor) return;
    var url;
    try { url = new URL(anchor.href); } catch (error) { return; }
    var hosts = { 'polymarket.com': 'polymarket', 'www.polymarket.com': 'polymarket',
      'kalshi.com': 'kalshi', 'www.kalshi.com': 'kalshi' };
    var venue = hosts[url.hostname];
    if (url.protocol !== 'https:' || !venue) return;
    var scope = anchor.closest('[data-analytics-outcome]');
    var data = {
      venue: venue,
      destination: url.origin + url.pathname,
      placement: anchor.getAttribute('data-analytics-placement') || 'market_link',
      outcome: scope ? scope.getAttribute('data-analytics-outcome') : 'unknown'
    };
    // Keep only the public market identifier, never arbitrary query values.
    var market = url.searchParams.get('marketSlug');
    if (market && /^[a-z0-9-]{1,200}$/.test(market)) data.market = market;
    send('market_click', data);
  }

  document.addEventListener('click', function (event) {
    if (event.button === 0) marketClick(event);
  });
  document.addEventListener('auxclick', function (event) {
    if (event.button === 1) marketClick(event);
  });
})(window, document);
