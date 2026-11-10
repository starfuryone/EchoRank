// echorank360-crawlers: the Site Crawler's own processes (Nosy Bat), so AI
// checks, alerts and email in echorank360-workers never wait behind a crawl.
// src/lib/site-crawler/capacity.ts holds the same numbers; tests/crawl-capacity.test.ts
// fails if the two disagree.
//
// Start (root):  pm2 start /opt/echorank/app/ecosystem.crawlers.config.js && pm2 save
// Then give echorank360-workers CRAWL_PROCESSES too (it stops running crawls),
// and DB_POOL_MAX=10 now that it has none:
//   CRAWL_PROCESSES=4 DB_POOL_MAX=10 pm2 restart echorank360-workers --update-env && pm2 save
//
// Unprivileged, like the web app: a crawler fetches whatever site a tenant
// names, and needs nothing root has (.env is readable by echorank, the page
// spool under /var/lib/echorank/purchase-spool is echorank's).
//
// SIGTERM lets each running crawl finish the pages in hand and hand its job
// back (resumed by the next process from its frontier), hence kill_timeout.

const PROCESSES = Number(process.env.CRAWL_PROCESSES || 4);
const PER_PROCESS = Number(process.env.CRAWL_CONCURRENCY_PER_PROCESS || 12);
// Postgres: every echorank pool together stays under 60% of max_connections
// (production: 100, so at most 59). Web 20 + workers 10 leave the rest to the
// crawlers: 4 × 7 = 28, 58 in all.
const PG_MAX_CONNECTIONS = Number(process.env.PG_MAX_CONNECTIONS || 100);
const DB_POOL_MAX = Math.max(1, Math.floor((Math.ceil(PG_MAX_CONNECTIONS * 0.6) - 1 - 20 - 10) / PROCESSES));

module.exports = {
  apps: [
    {
      name: 'echorank360-crawlers',
      cwd: '/opt/echorank/app',
      script: '/usr/bin/setpriv',
      args: '--reuid=echorank --regid=echorank --init-groups /usr/bin/npm run crawlers',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: PROCESSES,
      autorestart: true,
      max_restarts: 10,
      kill_timeout: 120000,
      // Above what the load test measured per process, so only a leak trips it
      // (pm2 sends SIGTERM: the crawls resume elsewhere).
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'production',
        HOME: '/var/lib/echorank-web',
        CRAWL_PROCESSES: String(PROCESSES),
        CRAWL_CONCURRENCY_PER_PROCESS: String(PER_PROCESS),
        DB_POOL_MAX: String(DB_POOL_MAX),
      },
    },
  ],
};
