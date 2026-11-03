# Conditional Odds

A static export of the Butter / PRISM Senate conditional-odds widget.

[Open the widget](https://vaughnmck.github.io/conditional/).

Displays Democratic and Republican Senate control odds under oil-price and Hormuz scenarios, with an interactive historical time scrubber. Market data is embedded; no live market API integration.

## Source

Exported from the latest completed Claude Design artifact on 2026-11-02. This publication contains the Senate widget; the five-outcome expansion is a separate work in progress.


## Run locally

Serve this directory with `python3 -m http.server 8876` and open `http://localhost:8876/`.

## Publish

GitHub Pages serves the root of the main branch. The bundled Claude Design runtime renders the exported component. Google Fonts supplies typography.

## Analytics

[Plausible dashboard](https://plausible.io/vaughnmck.github.io) (account access required).

Plausible records pageviews, approximate unique visitors and referral sources. Two custom event goals measure engagement:

| Event | Meaning |
| --- | --- |
| `scrubber_used` | The first actual change of the historical time selection per page load, by pointer or keyboard. |
| `market_click` | Each activation of a Polymarket or Kalshi link, including modified and middle clicks. Data-source API links are excluded. |

These are event counts, not evidence of completed trades. One visitor can produce multiple pageviews and market clicks. Browser privacy controls and blockers can reduce reported totals; unique visitors are estimates, not identified people.

Tracking runs only on `vaughnmck.github.io/conditional`. Local previews and URLs with `?analytics=off` do not load Plausible. Query strings and fragments are stripped from page URLs; referrers are reduced to their origin. The dashboard therefore reports referring sites, not referring-page paths or UTM campaigns. No custom event properties, user identities or session recordings are sent. This setup uses features available on Starter after the trial.

The public tracker URL is configured on the `plausible-analytics.js` script tag in `index.html`; no account credentials or private API keys are included. Event failures never block widget interaction or navigation. The site still uses embedded market data with no live market API connection.

Run the interaction and integration checks with `node --test tests/analytics.test.cjs`.
