const express = require("express");
const fs = require("fs");
const ytdl = require("ytdl-core");
const OpenAI = require("openai");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 10000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(bodyParser.json());

app.get("/test", (req, res) => {
  res.json({ message: "Backend is live!" });
});

app.post("/analyze", async (req, res) => {
  let videoUrl = req.body.url;
  const fileName = "audio.mp3";

  // Convert Shorts link to standard format if necessary
  if (videoUrl.includes("shorts")) {
    const id = videoUrl.split("/").pop().split("?")[0];
    videoUrl = `https://www.youtube.com/watch?v=${id}`;
  }

  try {
    // Check if video is playable
    const info = await ytdl.getInfo(videoUrl);
    if (!info.videoDetails || !info.videoDetails.isPlayable) {
      return res.status(400).json({ error: "Video is not playable." });
    }

    const audioStream = ytdl(videoUrl, { filter: "audioonly" });
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
            { role: "system", content: "You analyze video transcripts for truthfulness." },
            { role: "user", content: transcript.text },
          ],
        });

        res.json({
          transcript: transcript.text,
          analysis: analysis.choices[0].message.content,
        });
      } catch (err) {
        res.status(500).json({ error: "Transcription or GPT error: " + err.message });
      }
    });

    fileStream.on("error", (err) => {
      res.status(500).json({ error: "File writing error: " + err.message });
    });

  } catch (err) {
    res.status(500).json({ error: "Video processing error: " + err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
