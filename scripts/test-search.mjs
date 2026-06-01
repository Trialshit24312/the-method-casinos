import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import 'dotenv/config';

const query = 'sweepstakes casino email signup';
const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
  signal: AbortSignal.timeout(15000),
});
const html = await res.text();
console.log('DDG status', res.status, 'len', html.length);
console.log('result__a count', (html.match(/result__a/g) || []).length);

const $ = cheerio.load(html);
const links = [];
$('a.result__a').each((_, el) => {
  links.push($(el).attr('href'));
});
console.log('cheerio links', links.slice(0, 8));

if (process.env.SERPER_API_KEY) {
  const sr = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: 'us', num: 10 }),
  });
  console.log('Serper status', sr.status);
  const data = await sr.json();
  console.log('Serper links', data.organic?.slice(0, 5).map((o) => o.link));
}
