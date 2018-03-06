const PROXY_CONFIG = [
    {
        context: [
            "/control",
            "/auth",
            "/api",
            "/login",
            "/backoffice",
            "/scripts",
            "/styles"
        ],
        target: "https://35.189.8.82",
        secure: false,
        changeOrigin: true
    },
    {
        context: [
            "/control/websocket",
        ],
        target: "wss://35.189.8.82",
        secure: false,
        changeOrigin: true,
        ws: true
    }
];

module.exports = PROXY_CONFIG;
