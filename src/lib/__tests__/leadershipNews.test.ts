import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLeadershipFeed } from '../leadershipNews';

const now = new Date('2026-09-14T12:00:00Z');
const item = (title: string, date = 'Mon, 14 Sep 2026 08:00:00 GMT', link = 'https://news.google.com/rss/articles/one') => `<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate><source>Publisher</source></item>`;
const feed = (body: string) => `<rss><channel>${body}</channel></rss>`;
test('leadership news requires both person and company; preserves actual date and deduplicates', () => {
  const valid = item('Wonderful CEO Bar Winkler discusses AI');
  const found = parseLeadershipFeed(feed(valid + valid + item('Bar Winkler interview')), 'Bar Winkler', now);
  assert.equal(found.length, 1);
  assert.equal(found[0].sourceDate.toISOString(), '2026-09-14T08:00:00.000Z');
  assert.deepEqual(found[0].people, ['Bar Winkler']);
  assert.equal(found[0].nameInMetadata, true);
  assert.equal(parseLeadershipFeed(feed(item('Wonderful funding')), 'Bar Winkler', now)[0].nameInMetadata, false);
});
test('leadership news excludes old/future/invalid dates and unsafe links', () => {
  const title = 'Wonderful Bar Winkler';
  assert.deepEqual(parseLeadershipFeed(feed(item(title, '2020-01-01') + item(title, '2099-01-01') + item(title, 'bad') + item(title, undefined, 'javascript:alert(1)')), 'Bar Winkler', now), []);
});
test('malformed or non-RSS responses are source failures, valid empty RSS is not', () => {
  assert.throws(() => parseLeadershipFeed('<html>blocked</html>', 'Bar Winkler', now));
  assert.throws(() => parseLeadershipFeed('<rss>', 'Bar Winkler', now));
  assert.deepEqual(parseLeadershipFeed(feed(''), 'Bar Winkler', now), []);
});

