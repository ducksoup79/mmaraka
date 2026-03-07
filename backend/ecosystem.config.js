module.exports = {
  apps: [{
    name: 'mmaraka-api',
    script: 'src/index.js',
    cwd: '/var/www/mmaraka.com/backend',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
