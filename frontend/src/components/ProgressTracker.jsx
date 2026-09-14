import React from "react";

const STEPS = [
  "Script",
  "Scene Planning",
  "Voice Generation",
  "Thumbnail Generation",
  "Video Generation",
  "Composition",
  "Complete"
];

export default function ProgressTracker({ currentStep, status, details }) {
  const currentIndex = STEPS.indexOf(currentStep);

  return (
    <div className="progress-tracker" style={{ margin: '20px 0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
      <h3>Generation Progress</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
        {STEPS.map((step, idx) => {
          let stepStatus = "pending";
          if (idx < currentIndex) stepStatus = "completed";
          else if (idx === currentIndex) stepStatus = status;

          let color = "#aaa";
          if (stepStatus === "completed") color = "green";
          if (stepStatus === "in-progress") color = "blue";
          if (stepStatus === "failed") color = "red";

          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: color, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px'
              }}>
                {stepStatus === "completed" ? "✓" : (idx + 1)}
              </div>
              <strong style={{ color: color === "#aaa" ? "#888" : "#333" }}>{step}</strong>
              {idx === currentIndex && details && <span style={{ fontSize: '0.85rem', color: '#666' }}>({details})</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
