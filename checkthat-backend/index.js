const express = require("express");
const app = express();
const { exec } = require("child_process");
const fs = require("fs");
const { Configuration, OpenAIApi } = require("openai");

require("dotenv").config();
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post("/analyze", async (req, res) => {
  const videoUrl = req.body.url;
  const fileName = "audio.mp3";

  exec(`yt-dlp --extract-audio --audio-format mp3 -o "${fileName}" ${videoUrl}`, async (error) => {
    if (error) return res.status(500).send("Download error");

    const audio = fs.createReadStream(fileName);
    const transcript = await openai.createTranscription(audio, "whisper-1");
    const analysis = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You analyze video transcripts for truthfulness." },
        { role: "user", content: transcript.data.text },
      ],
    });

    res.json({ transcript: transcript.data.text, analysis: analysis.data.choices[0].message.content });
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 3000}`);
});