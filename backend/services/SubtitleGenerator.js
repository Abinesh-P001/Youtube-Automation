import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

// Helper to get audio duration in seconds
function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

// Format seconds to SRT timestamp: HH:MM:SS,mmm
function formatSrtTime(seconds) {
  const pad = (num, size) => ('000' + num).slice(size * -1);
  const time = parseFloat(seconds).toFixed(3);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const secs = Math.floor(time % 60);
  const milliseconds = time.split('.')[1] || '000';

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${milliseconds}`;
}

// Split text into subtitle chunks (heuristic)
function generateChunks(text) {
  // Replace newlines and extra spaces
  const cleanText = text.replace(/\\n/g, " ").replace(/\\s+/g, " ");
  
  // Split into sentences using a basic regex
  const sentences = cleanText.match(/[^.?!]+[.?!]+(?:\\s|$)|[^.?!]+$/g) || [cleanText];
  
  const chunks = [];
  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;
    
    // If a sentence is very long, we can split it into smaller chunks, but for now we keep it simple
    // or split by comma if too long
    if (sentence.length > 80) {
       const subparts = sentence.split(', ');
       let tempChunk = "";
       for (let part of subparts) {
         if ((tempChunk.length + part.length) > 60) {
           if (tempChunk) chunks.push(tempChunk.trim());
           tempChunk = part + (part.endsWith('.') ? "" : ", ");
         } else {
           tempChunk += (tempChunk ? " " : "") + part + (part.endsWith('.') ? "" : ", ");
         }
       }
       if (tempChunk) {
         // Clean trailing comma
         chunks.push(tempChunk.replace(/,\\s*$/, "").trim() + (sentence.endsWith('.') && !tempChunk.endsWith('.') ? "." : ""));
       }
    } else {
      chunks.push(sentence);
    }
  }
  return chunks;
}

export async function generateSubtitles(narrationText, audioPath, outputPath) {
  console.log("[SubtitleGenerator] Generating subtitles for audio...");
  
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const duration = await getAudioDuration(audioPath);
  console.log(`[SubtitleGenerator] Audio duration: ${duration}s`);

  const chunks = generateChunks(narrationText);
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  let currentStartTime = 0;
  let srtContent = "";

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Calculate duration based on character weight
    let chunkDuration = (chunk.length / totalChars) * duration;
    
    // Add small buffer between subtitles
    let endTime = currentStartTime + chunkDuration;
    
    srtContent += `${i + 1}\n`;
    srtContent += `${formatSrtTime(currentStartTime)} --> ${formatSrtTime(endTime - 0.1)}\n`; // Leave 0.1s gap
    srtContent += `${chunk}\n\n`;

    currentStartTime = endTime;
  }

  fs.writeFileSync(outputPath, srtContent);
  console.log(`[SubtitleGenerator] Subtitles saved to ${outputPath}`);
  return outputPath;
}
