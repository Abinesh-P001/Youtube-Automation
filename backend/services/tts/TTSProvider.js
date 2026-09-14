export class TTSProvider {
  /**
   * Base class for TTS providers.
   * @param {string} text - The text to synthesize.
   * @param {string} outputPath - The path to save the generated audio.
   * @returns {Promise<string>} The path to the saved audio file.
   */
  async generate(text, outputPath) {
    throw new Error("TTSProvider is an abstract class. You must implement generate().");
  }
}
