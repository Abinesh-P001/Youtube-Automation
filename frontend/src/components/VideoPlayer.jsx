export default function VideoPlayer({ url, onDownload, onReset }) {
  if (!url) return null;

  return (
    <div className="video-player-container">
      <div className="video-wrapper">
        <video controls autoPlay loop src={url} className="generated-video" />
      </div>

      <div className="video-actions">
        <a
          href={url}
          download="ltx-video.mp4"
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn download-btn"
          onClick={onDownload}
        >
          ⬇ Download Video
        </a>
        <button onClick={onReset} className="action-btn reset-btn">
          ✨ Generate Another
        </button>
      </div>
    </div>
  );
}
