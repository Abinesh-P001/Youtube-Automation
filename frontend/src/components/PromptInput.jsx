import { useRef, useEffect } from "react";

const MAX_CHARS = 2000;

const EXAMPLE_PROMPTS = [
  "An ancient forest at sunrise, golden sunlight passing through the trees, morning mist, birds flying, cinematic camera movement, photorealistic.",
  "A futuristic city at night with neon lights reflecting off rain-slicked streets, flying cars zooming past, cyberpunk aesthetic.",
  "Ocean waves crashing against rocky cliffs at golden hour, dramatic clouds, seagulls soaring, slow motion cinematography.",
  "A majestic snow-capped mountain landscape with pine forests, a frozen lake reflecting the sky, serene and epic.",
];

export default function PromptInput({ 
  value, 
  onChange, 
  aspectRatio, 
  onAspectRatioChange, 
  duration, 
  onDurationChange, 
  disabled 
}) {
  const textareaRef = useRef(null);
  const charCount   = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
  }, [value]);

  const handleExampleClick = (example) => {
    onChange(example);
    textareaRef.current?.focus();
  };

  return (
    <div className="prompt-input-container">
      <div className="prompt-label-row">
        <label htmlFor="video-prompt" className="prompt-label">
          Describe your video
        </label>
        <span className={`char-counter ${isOverLimit ? "over-limit" : charCount > MAX_CHARS * 0.85 ? "near-limit" : ""}`}>
          {charCount} / {MAX_CHARS}
        </span>
      </div>

      <textarea
        id="video-prompt"
        ref={textareaRef}
        className={`prompt-textarea ${isOverLimit ? "error-border" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your video scene in detail — include the setting, mood, lighting, camera movement, and any specific elements you want to see..."
        disabled={disabled}
        rows={5}
        spellCheck
        aria-describedby="prompt-hint"
      />

      {isOverLimit && (
        <p className="input-error" id="prompt-hint" role="alert">
          Prompt exceeds {MAX_CHARS} characters. Please shorten it.
        </p>
      )}

      {/* Kling Options */}
      <div className="options-row" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <div className="option-group" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Aspect Ratio</label>
          <select 
            value={aspectRatio} 
            onChange={(e) => onAspectRatioChange(e.target.value)}
            disabled={disabled}
            style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: 'var(--panel-bg)', color: 'white', border: '1px solid var(--border-color)' }}
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Portrait)</option>
            <option value="1:1">1:1 (Square)</option>
          </select>
        </div>
        <div className="option-group" style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Duration</label>
          <select 
            value={duration} 
            onChange={(e) => onDurationChange(e.target.value)}
            disabled={disabled}
            style={{ padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: 'var(--panel-bg)', color: 'white', border: '1px solid var(--border-color)' }}
          >
            <option value="5">5 Seconds</option>
            <option value="10">10 Seconds</option>
          </select>
        </div>
      </div>

      {/* Example prompts */}
      <div className="examples-section">
        <p className="examples-label">✨ Try an example:</p>
        <div className="examples-grid">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              className="example-chip"
              onClick={() => handleExampleClick(ex)}
              disabled={disabled}
              type="button"
              title={ex}
            >
              {ex.slice(0, 60)}…
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
