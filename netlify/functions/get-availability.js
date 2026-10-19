const https = require('https');
const http = require('http');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseIcal(icalText) {
  const dates = [];
  const lines = icalText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let inEvent = false, dtstart = null, dtend = null, status = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; dtstart = null; dtend = null; status = null; }
    else if (line === 'END:VEVENT') {
      if (inEvent && dtstart && dtend) {
        if (!status || status !== 'CANCELLED') {
          const start = new Date(dtstart), end = new Date(dtend);
          let d = new Date(start);
          while (d < end) {
            dates.push(d.toISOString().slice(0,10));
            d.setDate(d.getDate() + 1);
          }
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (line.startsWith('DTSTART')) dtstart = line.split(':').slice(1).join(':').slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      else if (line.startsWith('DTEND')) dtend = line.split(':').slice(1).join(':').slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      else if (line.startsWith('STATUS:')) status = line.split(':')[1].trim();
    }
  }
  return dates;
}

exports.handler = async () => {
  const FEEDS = [
    'https://www.airbnb.es/calendar/ical/969324715237583598.ics?t=5c48c4ea9b064360bb23d1ae25f9611e',
    'https://www.vrbo.com/icalendar/e4c9d860e3bc4c24be0bdf051381b537.ics?nonTentative',
    'https://ical.booking.com/v1/export?t=0b2ae70a-9fc9-4a06-841a-2576f31eaf68'
  ];

  const occupied = new Set();
  await Promise.allSettled(FEEDS.map(async (url) => {
    try {
      const text = await fetchUrl(url);
      parseIcal(text).forEach(d => occupied.add(d));
    } catch(e) {
      console.error('Feed error:', url, e.message);
    }
  }));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ occupied: Array.from(occupied).sort() })
  };
};
