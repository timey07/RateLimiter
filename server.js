// server.js

const express = require("express");
const rateLimiterMiddleware = require("./middleware");

const app = express();

// Apply middleware globally
app.use(rateLimiterMiddleware);

app.get("/", (req, res) => {
    res.send("Hello! Request allowed ✅");
});

app.get("/heavy", (req, res) => {
    res.send("Heavy endpoint accessed 🚀");
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});