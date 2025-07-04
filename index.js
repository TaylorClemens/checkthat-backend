const express = require("express");
const app = express();
const fs = require("fs");
const ytdl = require("ytdl-core");
const { OpenAI } = require("openai");
require("dotenv").config();

app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", async (req, res) => {
  const videoUrl = req.body.url;
  const fileName = "audio.mp3";

  try {
    const audioStream = ytdl(videoUrl, {
      filter: "audioonly",
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    });

    const fileStream = fs.createWriteStream(fileName);

    audioStream.pipe(fileStream);

    fileStream.on("finish", async () => {
      try {
        const audio = fs.createReadStream(fileName);
        const transcript = await openai.audio.transcriptions.create({
          file: audio,
          model: "whisper-1",
        });

        const analysis = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You analyze video transcripts for truthfulness.",
            },
            { role: "user", content: transcript.text },
          ],
        });

        res.json({
          transcript: transcript.text,
          analysis: analysis.choices[0].message.content,
        });
      } catch (err) {
        res.status(500).send("Transcription or GPT error: " + err.message);
      }
    });

    fileStream.on("error", (err) => {
      res.status(500).send("File writing error: " + err.message);
    });
  } catch (err) {
    res.status(500).send("ytdl streaming error: " + err.message);
  }
});

// Health check/test route
app.get("/test", (req, res) => {
  res.json({ message: "Backend is live!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
