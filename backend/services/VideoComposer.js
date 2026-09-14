import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

export async function composeVideo(videoPaths, audioPath, subtitlePath, outputPath) {
  console.log(`[VideoComposer] Composing final video from ${videoPaths.length} scenes, audio, and subtitles...`);
  
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // Add all video inputs
    videoPaths.forEach((videoPath) => {
      command.input(videoPath);
    });

    // Add audio input
    if (audioPath) {
      command.input(audioPath);
    }

    const complexFilters = [];
    const concatInputs = [];

    // 1. Normalize each video to 1920x1080, 30fps, setsar=1
    videoPaths.forEach((_, i) => {
      complexFilters.push({
        filter: "scale",
        options: "1920:1080:force_original_aspect_ratio=decrease",
        inputs: `${i}:v`,
        outputs: `scale${i}`
      });
      complexFilters.push({
        filter: "pad",
        options: "1920:1080:(ow-iw)/2:(oh-ih)/2",
        inputs: `scale${i}`,
        outputs: `pad${i}`
      });
      complexFilters.push({
        filter: "fps",
        options: "30",
        inputs: `pad${i}`,
        outputs: `fps${i}`
      });
      complexFilters.push({
        filter: "setsar",
        options: "1",
        inputs: `fps${i}`,
        outputs: `v${i}`
      });
      concatInputs.push(`v${i}`);
    });

    // 2. Concat normalized videos
    if (videoPaths.length > 1) {
      complexFilters.push({
        filter: "concat",
        options: { n: videoPaths.length, v: 1, a: 0 },
        inputs: concatInputs,
        outputs: ["concatv"]
      });
    } else {
      complexFilters.push({
        filter: "null",
        inputs: concatInputs[0],
        outputs: ["concatv"]
      });
    }

    // 3. Add subtitles if provided
    let finalVideoOutput = "concatv";
    if (subtitlePath && fs.existsSync(subtitlePath)) {
      // Escape path for Windows FFmpeg
      let escapedSubtitlePath = subtitlePath.replace(/\\/g, '/');
      escapedSubtitlePath = escapedSubtitlePath.replace(/:/g, '\\\\:');

      complexFilters.push({
        filter: "subtitles",
        options: `'${escapedSubtitlePath}':force_style='Fontname=Arial,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=20'`,
        inputs: "concatv",
        outputs: ["outv"]
      });
      finalVideoOutput = "outv";
    }

    command.complexFilter(complexFilters);

    // Map video and audio
    command.outputOptions([`-map`, `[${finalVideoOutput}]`]);

    if (audioPath) {
      command.outputOptions([
        '-map', `${videoPaths.length}:a`,
      ]);
    }

    // Common output options
    command
      .outputOptions([
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest' // Finish encoding when audio ends
      ])
      .on('start', (cmdLine) => {
        console.log('[VideoComposer] Spawned FFmpeg with command: ' + cmdLine);
      })
      .on('error', (err) => {
        console.error('[VideoComposer] FFmpeg Error:', err.message);
        reject(err);
      })
      .on('end', () => {
        console.log(`[VideoComposer] Finished composing video: ${outputPath}`);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}
