(function (window, document) {
  'use strict';

  var analytics = window.conditionalAnalytics;
  var tracker = document.currentScript.getAttribute('data-tracker-src');
  if (!analytics || !analytics.enabled || !tracker) return;

  // Plausible's standard queue preserves early interactions while its async script loads.
  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  window.plausible.init = window.plausible.init || function (options) {
    window.plausible.o = options || {};
  };
  window.plausible.init({
    autoCapturePageviews: false,
    outboundLinks: false,
    fileDownloads: false,
    formSubmissions: false,
    transformRequest: function (payload) {
      payload.u = window.location.origin + window.location.pathname;
      if (payload.r) {
        try { payload.r = new URL(payload.r).origin; }
        catch (error) { payload.r = null; }
      }
      return payload;
    }
  });

  // Named event counts work on Starter; no Business-only custom properties are sent.
  analytics.connect(function (name) { window.plausible(name); });
  window.plausible('pageview');

  var script = document.createElement('script');
  script.async = true;
  script.src = tracker;
  document.head.appendChild(script);
})(window, document);
