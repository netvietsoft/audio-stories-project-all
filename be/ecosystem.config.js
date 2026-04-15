module.exports = {
    apps: [
        {
            name: "auth-be",
            script: "./dist/main.js",
            instances: 1,
            exec_mode: "cluster",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                PORT: 8035,
                NODE_ENV: "production",
            },
            error_file: "./logs/err.log",
            out_file: "./logs/out.log",
            log_file: "./logs/combined.log",
            time: true,
        },
    ],
};
