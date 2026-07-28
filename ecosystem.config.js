// echorank360-web: runs unprivileged as `echorank`, bound to loopback only.
// Caddy fronts it on echorank360.com -> 127.0.0.1:4400.
module.exports = {
  apps: [{
    name: 'echorank360-web',
    cwd: '/opt/echorank/app',
    script: '/usr/bin/setpriv',
    args: '--reuid=echorank --regid=echorank --init-groups /usr/bin/npm run start -- -H 127.0.0.1 -p 4400',
    interpreter: 'none',
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    env: { NODE_ENV: 'production', HOME: '/var/lib/echorank-web' }
  }]
}
