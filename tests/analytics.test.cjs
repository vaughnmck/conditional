const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function setup(url = 'https://vaughnmck.github.io/conditional/') {
  const listeners = {}, events = [];
  const window = { location: new URL(url), localStorage: { getItem: () => '1' } };
  const context = vm.createContext({ window, URL, setTimeout, console,
    document: { addEventListener: (type, fn) => { listeners[type] = fn; } },
    DCLogic: class { setState(update) { this.state = { ...this.state, ...update }; } }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/interaction-analytics.js'), 'utf8'), context);
  const analytics = window.conditionalAnalytics;
  analytics.connect((name, data) => events.push({ name, data }));
  return { context, window, analytics, listeners, events };
}
function link(href, placement = 'scenario') {
  const anchor = { href, getAttribute: name => name === 'data-analytics-placement' ? placement : null,
    closest: selector => selector === '[data-analytics-outcome]' ? { getAttribute: () => 'senate_control' } : null };
  return { closest: selector => selector === 'a[href]' ? anchor : null };
}
function component(env) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dataScript = html.match(/<script src="\.\/(assets\/[a-f0-9]+\.js)"><\/script>/)[1];
  vm.runInContext(fs.readFileSync(path.join(root, dataScript), 'utf8'), env.context);
  const script = html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script + '\nglobalThis.Widget = Component;', env.context);
  return new env.context.Widget();
}

function loadPlausible(env, tracker = 'https://plausible.io/js/pa-test.js') {
  const scripts = [];
  env.context.document.currentScript = { getAttribute: () => tracker };
  env.context.document.createElement = () => ({});
  env.context.document.head = { appendChild: script => scripts.push(script) };
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/plausible-analytics.js'), 'utf8'), env.context);
  return scripts;
}

test('Plausible queues one pageview and named interaction events before its script loads', () => {
  const env = setup();
  const scripts = loadPlausible(env);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://plausible.io/js/pa-test.js');
  assert.equal(scripts[0].async, true);
  assert.equal(env.window.plausible.o.autoCapturePageviews, false);
  env.analytics.scrubberUsed('keyboard', 'senate_control');
  env.listeners.click({ button: 0, target: link('https://polymarket.com/event/senate') });
  const queued = Array.from(env.window.plausible.q, args => Array.from(args));
  assert.deepEqual(queued, [['pageview'], ['scrubber_used'], ['market_click']]);
});

test('Plausible sends canonical page URLs and only referral domains', () => {
  const env = setup('https://vaughnmck.github.io/conditional/?utm_source=example&token=secret#private');
  loadPlausible(env);
  const transform = env.window.plausible.o.transformRequest;
  const event = transform({ u: env.window.location.href, r: 'https://example.com/private?token=secret' });
  assert.equal(event.u, 'https://vaughnmck.github.io/conditional/');
  assert.equal(event.r, 'https://example.com');
  assert.equal(transform({ r: 'not a URL' }).r, null);
});

test('Plausible never loads for local previews, explicit opt-outs, or missing configuration', () => {
  for (const url of ['http://localhost:8876/', 'https://vaughnmck.github.io/conditional/?analytics=off']) {
    const env = setup(url);
    assert.equal(loadPlausible(env).length, 0);
    assert.equal(env.window.plausible, undefined);
  }
  const env = setup();
  assert.equal(loadPlausible(env, '').length, 0);
  assert.equal(env.window.plausible, undefined);
});

test('scrubber use is counted once per page load, even across input methods', () => {
  const env = setup();
  env.analytics.scrubberUsed('pointer', 'senate_control');
  env.analytics.scrubberUsed('keyboard', 'senate_control');
  assert.equal(env.events.length, 1);
  assert.equal(env.events[0].name, 'scrubber_used');
  assert.equal(env.events[0].data.input, 'pointer');
});

test('market clicks include safe destinations, venue and placement without arbitrary query data', () => {
  const env = setup();
  const href = 'https://polymarket.com/event/senate?marketSlug=democratic-senate&email=private@example.com#secret';
  env.listeners.click({ button: 0, target: link(href, 'price_detail') });
  const event = env.events[0];
  assert.equal(event.name, 'market_click');
  assert.equal(event.data.destination, 'https://polymarket.com/event/senate');
  assert.equal(event.data.market, 'democratic-senate');
  assert.equal(event.data.venue, 'polymarket');
  assert.equal(event.data.placement, 'price_detail');
  assert.equal(event.data.outcome, 'senate_control');
  assert.ok(!JSON.stringify(event).includes('private'));
  assert.ok(!JSON.stringify(event).includes('secret'));
});

test('modified left clicks and middle clicks count, right clicks and non-market hosts do not', () => {
  const env = setup();
  const target = link('https://kalshi.com/markets/senate');
  env.listeners.click({ button: 0, ctrlKey: true, target });
  env.listeners.auxclick({ button: 1, target });
  env.listeners.auxclick({ button: 2, target });
  for (const href of ['https://gamma-api.polymarket.com/events/1', 'https://polymarket.com.evil.example/event/x', 'http://polymarket.com/event/x', 'javascript:alert(1)']) {
    env.listeners.click({ button: 0, target: link(href) });
  }
  assert.equal(env.events.length, 2);
  assert.equal(env.events[0].data.venue, 'kalshi');
});

test('local previews and analytics=off never send events', () => {
  for (const url of ['http://localhost:8876/', 'https://preview.example/conditional/', 'https://vaughnmck.github.io/another-site/', 'https://vaughnmck.github.io/conditional/?analytics=off']) {
    const env = setup(url);
    env.analytics.scrubberUsed('pointer', 'senate_control');
    env.listeners.click({ button: 0, target: link('https://polymarket.com/event/senate') });
    assert.equal(env.events.length, 0, url);
  }
});

test('provider errors never interrupt interaction', async () => {
  const env = setup();
  env.analytics.connect(() => { throw new Error('blocked'); });
  assert.doesNotThrow(() => env.analytics.scrubberUsed('keyboard', 'senate_control'));
  env.analytics.connect(() => Promise.reject(new Error('offline')));
  assert.doesNotThrow(() => env.listeners.click({ button: 0, target: link('https://polymarket.com/event/senate') }));
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('real chart keyboard handler counts an actual time change, not boundary keys or Escape', () => {
  const env = setup(), widget = component(env);
  const key = key => ({ key, preventDefault() {} });
  widget.renderVals().onChartKey(key('End'));
  widget.renderVals().onChartKey(key('Escape'));
  assert.equal(env.events.length, 0);
  const last = widget.renderVals().selected;
  widget.renderVals().onChartKey(key('ArrowLeft'));
  assert.equal(widget.renderVals().selected, last - 1);
  assert.equal(env.events[0].data.input, 'keyboard');
  widget.renderVals().onChartKey(key('Home'));
  assert.equal(env.events.length, 1);
});

test('real pointer handler counts a changed time, while pin/unpin behavior still works', () => {
  const env = setup(), widget = component(env);
  const pointer = clientX => ({ clientX, currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 100 }) } });
  const last = widget.renderVals().selected;
  widget.renderVals().onChartMove(pointer(100));
  assert.equal(env.events.length, 0);
  widget.renderVals().onChartMove(pointer(0));
  assert.equal(widget.renderVals().selected, 0);
  assert.equal(env.events[0].data.input, 'pointer');
  widget.renderVals().onChartClick(pointer(0));
  widget.renderVals().onChartMove(pointer(50));
  assert.equal(widget.renderVals().selected, 0);
  widget.renderVals().onChartClick(pointer(50));
  assert.equal(widget.renderVals().selected, last);
  assert.equal(env.events.length, 1);
});
