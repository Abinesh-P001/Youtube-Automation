import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export async function generateThumbnail(title, visualSummary, outputPath) {
  console.log(`[ThumbnailGenerator] Generating thumbnail for title: "${title}"`);
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for thumbnail generation.");
  }

  const prompt = `Create a professional YouTube thumbnail background.
Title of the video: "${title}"
Core visual theme: ${visualSummary}
Requirements: Highly engaging, strong visual subject, 16:9 aspect ratio, high visual impact, cinematic style, include short readable text summarizing the title.`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024", 
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI DALL-E 3 failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  const imageUrl = data.data[0].url;

  const imageRes = await fetch(imageUrl);
  const arrayBuffer = await imageRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log(`[ThumbnailGenerator] Thumbnail saved to ${outputPath}`);
  return outputPath;
}
