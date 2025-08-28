import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Load API keys from API_KEY_1, API_KEY_2, ...
const keys = [];
for (let i = 1; i <= 10; i++) {
  const key = process.env[`API_KEY_${i}`];
  if (key) keys.push(key);
}

if (keys.length === 0) {
  console.error('❌ No API keys found! Please set API_KEY_1, API_KEY_2, ... in environment.');
  process.exit(1);
}

// ✅ Round-robin key selector
let currentIndex = 0;
function getNextKey() {
  const key = keys[currentIndex];
  currentIndex = (currentIndex + 1) % keys.length;
  return key;
}

// ✅ API route
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getNextKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-8b-instruct:free',
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('❌ Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

