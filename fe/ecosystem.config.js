module.exports = {
    apps: [
        {
            name: "web-truyen-audio-fe",
            script: "node_modules/next/dist/bin/next",
            args: "start",
            cwd: "./",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                PORT: 3058,
                DISPLAY: ":99",
            },
            error_file: "./logs/fe-err.log",
            out_file: "./logs/fe-out.log",
            log_file: "./logs/fe-combined.log",
            time: true,
        },
    ],
};
