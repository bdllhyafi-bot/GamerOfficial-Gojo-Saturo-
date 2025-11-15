// Simple express server to keep bot alive on Railway
const express = require("express");
const app = express();

app.get("/", (req, res) => {
    res.send("Bot is running!");
});

app.listen(3000, () => {
    console.log("Web server running on port 3000");
});