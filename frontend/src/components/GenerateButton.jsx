export default function GenerateButton({ onClick, isLoading, disabled }) {
  return (
    <button
      className={`generate-btn ${isLoading ? "loading" : ""}`}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <span className="spinner"></span>
          Generating Video...
        </>
      ) : (
        "Generate Video"
      )}
    </button>
  );
}
