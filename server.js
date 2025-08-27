import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    const apiKeys = process.env.OPENROUTER_KEYS.split(','); // store keys in Render secrets
    let reply = "Error";

    for (const key of apiKeys) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-r1-0528:free",
                    messages: [{ role: "user", content: message }]
                })
            });
            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                reply = data.choices[0].message.content;
                break;
            }
        } catch (err) {
            console.error(`Error with key ${key}:`, err.message);
        }
    }

    res.json({ reply });
});

app.listen(process.env.PORT || 3000, () => console.log("Server running"));
