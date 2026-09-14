import React from "react";

export default function TopicInput({ value, onChange, disabled }) {
  return (
    <div className="input-group">
      <label>Video Topic</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        placeholder="Enter a topic for your YouTube video (e.g. History of Rome)"
        className="text-input"
        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
      />
    </div>
  );
}
