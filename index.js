/* ---------- imports & setup ---------- */
const express = require("express");
const fs = require("fs");
const { spawn } = require("child_process");   // (still handy if you ever shell out)
const ytdl = require("ytdl-core");

require("dotenv").config();

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());

/* ---------- POST /analyze ---------- */
app.post("/analyze", async (req, res) => {
  const videoUrl = req.body.url;
  const fileName = "audio.mp3";

  try {
    /* 1️⃣  stream audio from YouTube into a local mp3 file */
    const audioStream = ytdl(videoUrl, { filter: "audioonly" });
    const fileStream  = fs.createWriteStream(fileName);
    audioStream.pipe(fileStream);

    /* 2️⃣  wait until file is written, then transcribe & fact-check */
    fileStream.on("finish", async () => {
      try {
        /* Whisper */
        const transcriptObj = await openai.audio.transcriptions.create({
          file: fs.createReadStream(fileName),
          model: "whisper-1",
        });
        const transcript = transcriptObj.text;

        /* GPT-4 analysis */
        const chat = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You analyze video transcripts for truthfulness." },
            { role: "user",    content: transcript },
          ],
        });

        res.json({
          transcript,
          analysis: chat.choices[0].message.content,
        });
      } catch (err) {
        res.status(500).send("Transcription/GPT error: " + err.message);
      }
    });

    /* handle download errors */
    audioStream.on("error", (err) =>
      res.status(500).send("ytdl streaming error: " + err.message)
    );
  } catch (err) {
    res.status(500).send("ytdl error: " + err.message);
  }
});

/* ---------- simple health check ---------- */
app.get("/test", (req, res) => {
  res.json({ message: "Backend is live!" });
});

/* ---------- start server ---------- */
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 3000}`);
});
