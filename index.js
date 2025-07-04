const express = require("express");
const app = express();
const { exec } = require("child_process");
const fs = require("fs");

require("dotenv").config();
app.use(express.json());

const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", async (req, res) => {
  const videoUrl = req.body.url;
  const fileName = "audio.mp3";

  exec(`yt-dlp --extract-audio --audio-format mp3 -o "${fileName}" ${videoUrl}`, async (error) => {
    if (error) return res.status(500).send("Download error");

    const audio = fs.createReadStream(fileName);
    const transcript = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
    });

    const analysis = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You analyze video transcripts for truthfulness." },
        { role: "user", content: transcript.text },
      ],
    });

    res.json({ transcript: transcript.text, analysis: analysis.choices[0].message.content });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 3000}`);
});
app.get('/test', (req, res) => {
  res.json({ message: 'Backend is live!' });
});
