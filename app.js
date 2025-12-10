const express = require("express");
const fetch = require("node-fetch");
const qs = require("querystring");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.static("public"));

const config = JSON.parse(fs.readFileSync("./config.json"));

// OAuth URL
app.get("/auth", (req, res) => {
  const params = qs.stringify({
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    response_type: "code",
    scope: "identify guilds.join"
  });

  res.redirect("https://discord.com/api/oauth2/authorize?" + params);
});

// OAuth Callback
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) return res.status(400).send("Missing ?code=");

  const data = qs.stringify({
    client_id: config.client_id,
    client_secret: config.client_secret,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: config.redirect_uri,
    scope: "identify guilds.join"
  });

  // Exchange code for token
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    body: data,
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  const tokenJSON = await tokenResponse.json();

  if (!tokenJSON.access_token) {
    return res.status(500).json(tokenJSON);
  }

  // Get user info
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenJSON.access_token}` }
  });

  const user = await userResponse.json();

  // Add user to guild
  const joinResponse = await fetch(
    `https://discord.com/api/guilds/${config.guild_id}/members/${user.id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${config.bot_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        access_token: tokenJSON.access_token
      })
    }
  );

  // Success responses: 201 (joined), 204 (already in server)
  if (joinResponse.status === 201) {
    return res.send("User successfully joined the server.");
  } else if (joinResponse.status === 204) {
    return res.send("User is already a member of this server. Auto-join complete.");
  } else {
    const errorText = await joinResponse.text();
    return res.status(joinResponse.status).send("Error: " + errorText);
  }
});

// Start server
app.listen(3000, () => {
  console.log("OAuth server running on port 3000");
});
