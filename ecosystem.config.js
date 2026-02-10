module.exports = {
    apps: [{
        name: 'bitnova-bot',
        script: 'dist/index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        exp_backoff_restart_delay: 100, // Wait 100ms then double each restart
        restart_delay: 3000,           // Wait at least 3 seconds between restarts
        env: {
            NODE_ENV: 'production',
        }
    }]
};
