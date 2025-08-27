const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Collect all API keys from environment
const apiKeys = [
  process.env.API_KEY_1,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
  process.env.API_KEY_4,
  process.env.API_KEY_5,
].filter(Boolean); // remove any undefined keys

if (apiKeys.length === 0) {
  console.error("No API keys found in environment variables!");
  process.exit(1);
}

app.post("/ask", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // Copy the keys to work on
  let availableKeys = [...apiKeys];

  let responseReceived = false;
  let finalResponse = null;

  while (availableKeys.length > 0 && !responseReceived) {
    // Randomly pick a key
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    const currentKey = availableKeys[randomIndex];

    // Remove that key from the list so we don't reuse it
    availableKeys.splice(randomIndex, 1);

    console.log(`Trying with API key: ${currentKey.substring(0, 6)}...`);

    try {
      // Example request to OpenRouter (replace with your actual API endpoint and params)
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "openai/gpt-3.5-turbo", // adjust as per your setup
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${currentKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      finalResponse = response.data;
      responseReceived = true;
    } catch (error) {
      console.error(`Error with key ${currentKey.substring(0, 6)}:`, error.message);
    }
  }

  if (responseReceived) {
    return res.json({ success: true, data: finalResponse });
  } else {
    return res.status(500).json({ error: "Error occurred, please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
