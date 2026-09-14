export default function GenerationHistory({ history, onSelect }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="history-container">
      <h3 className="history-title">Recent Generations</h3>
      <div className="history-list">
        {history.map((item) => (
          <div key={item.jobId} className="history-item">
            <div className="history-info">
              <p className="history-prompt" title={item.prompt}>
                {item.prompt.length > 60 ? `${item.prompt.slice(0, 60)}...` : item.prompt}
              </p>
              <span className="history-time">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="history-actions">
              {item.videoUrl && (
                <button
                  className="history-view-btn"
                  onClick={() => onSelect(item)}
                >
                  View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
