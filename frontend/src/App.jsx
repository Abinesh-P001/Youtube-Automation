import { useState, useEffect } from "react";
import TopicInput from "./components/TopicInput";
import GenerateButton from "./components/GenerateButton";
import ProgressTracker from "./components/ProgressTracker";
import { generateScriptPhase, updateScriptPhase, generateMediaPhase, createJobStream, checkHealth } from "./services/api";
import "./index.css";

export default function App() {
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState("Wan");
  const [scriptModel, setScriptModel] = useState("OpenAI");
  
  // idle -> generating_script -> previewing -> editing_script -> generating_media -> success (or error)
  const [status, setStatus] = useState("idle"); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [jobId, setJobId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [stepStatus, setStepStatus] = useState(null);
  const [stepDetails, setStepDetails] = useState(null);

  const [scriptData, setScriptData] = useState(null);
  const [visualPlan, setVisualPlan] = useState(null);
  
  const [editedScript, setEditedScript] = useState(null);

  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);

  const [isBackendHealthy, setIsBackendHealthy] = useState(true);

  useEffect(() => {
    checkHealth()
      .then(() => setIsBackendHealthy(true))
      .catch(() => {
        setErrorMsg("Cannot connect to backend server. Is it running on port 3001?");
        setIsBackendHealthy(false);
      });
  }, []);

  useEffect(() => {
    if (jobId) {
      const stream = createJobStream(jobId, (data) => {
        setCurrentStep(data.step);
        setStepStatus(data.status);
        setStepDetails(data.details);

        if (data.step === "Script" && data.status === "completed") {
          setScriptData(data.data);
          setEditedScript(data.data);
        }
        if (data.step === "Scene Planning" && data.status === "completed") {
          setVisualPlan(data.data);
          // Wait briefly then switch to preview if we were just generating script
          if (status === "generating_script") {
            setTimeout(() => setStatus("previewing"), 500);
          }
        }
        if (data.step === "Complete" && data.status === "completed") {
          setFinalVideoUrl(`http://localhost:3001/api/video/download/${jobId}/video`);
          setThumbnailUrl(`http://localhost:3001/api/video/download/${jobId}/thumbnail`);
          setStatus("success");
          stream.close();
        }
        if (data.status === "failed") {
          setErrorMsg(data.error);
          setStatus("error");
          stream.close();
        }
      });
      return () => stream.close();
    }
  }, [jobId, status]);

  const handleGenerateScript = async () => {
    const cleanedTopic = topic.trim();
    if (cleanedTopic.length < 3) {
      setErrorMsg("Topic is required and must be at least 3 characters.");
      return;
    }

    setStatus("generating_script");
    setErrorMsg(null);
    setJobId(null);
    setCurrentStep(null);
    setScriptData(null);
    setVisualPlan(null);
    setFinalVideoUrl(null);
    setThumbnailUrl(null);

    try {
      const result = await generateScriptPhase({ topic: cleanedTopic, scriptModel });
      setJobId(result.jobId);
    } catch (err) {
      setErrorMsg(err.message || "Script generation failed.");
      setStatus("error");
    }
  };

  const handleRegenerateScript = async () => {
    const cleanedTopic = topic.trim();
    if (cleanedTopic.length < 3) {
      setErrorMsg("Topic is required and must be at least 3 characters.");
      return;
    }

    setStatus("generating_script");
    setErrorMsg(null);
    setScriptData(null);
    setVisualPlan(null);
    try {
      const result = await generateScriptPhase({ topic: cleanedTopic, scriptModel });
      setJobId(result.jobId);
    } catch (err) {
      setErrorMsg(err.message || "Script generation failed.");
      setStatus("error");
    }
  };

  const handleSaveEdits = async () => {
    setStatus("generating_script");
    setErrorMsg(null);
    try {
      await updateScriptPhase({ jobId, script: editedScript, scriptModel });
      setScriptData(editedScript);
      setStatus("previewing");
    } catch (err) {
      setErrorMsg(err.message || "Failed to update script.");
      setStatus("error");
    }
  };

  const handleApproveAndGenerateVideo = async () => {
    setStatus("generating_media");
    setErrorMsg(null);
    try {
      await generateMediaPhase({ jobId, model });
    } catch (err) {
      setErrorMsg(err.message || "Media generation failed.");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setTopic("");
    setStatus("idle");
    setErrorMsg(null);
    setJobId(null);
    setCurrentStep(null);
    setScriptData(null);
    setVisualPlan(null);
    setFinalVideoUrl(null);
    setThumbnailUrl(null);
  };

  const renderScriptPreview = () => {
    if (status === "editing_script") {
      return (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ccc' }}>
          <h3>Edit Script</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Title:</label>
            <input 
              style={{ width: '100%', padding: '8px', marginTop: '5px' }} 
              value={editedScript.title} 
              onChange={e => setEditedScript({...editedScript, title: e.target.value})} 
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Hook:</label>
            <textarea 
              style={{ width: '100%', padding: '8px', marginTop: '5px', height: '60px' }} 
              value={editedScript.hook} 
              onChange={e => setEditedScript({...editedScript, hook: e.target.value})} 
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Complete Narration:</label>
            <textarea 
              style={{ width: '100%', padding: '8px', marginTop: '5px', height: '150px' }} 
              value={editedScript.narration} 
              onChange={e => setEditedScript({...editedScript, narration: e.target.value})} 
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Ending:</label>
            <textarea 
              style={{ width: '100%', padding: '8px', marginTop: '5px', height: '60px' }} 
              value={editedScript.ending} 
              onChange={e => setEditedScript({...editedScript, ending: e.target.value})} 
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" onClick={handleSaveEdits}>Save & Replan Scenes</button>
            <button className="btn btn-secondary" onClick={() => {
              setEditedScript(scriptData);
              setStatus("previewing");
            }}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>Script Preview</h3>
        <h2 style={{ color: '#0056b3' }}>{scriptData.title}</h2>
        <p><strong>Hook:</strong> <em>{scriptData.hook}</em></p>
        <p><strong>Narration:</strong><br/>{scriptData.narration}</p>
        
        <h4 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>Scene Breakdown</h4>
        {scriptData.scenes.map((scene, i) => (
          <div key={i} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
            <strong>Scene {i + 1} ({scene.duration}s):</strong>
            <p style={{ margin: '5px 0' }}><em>"{scene.narration}"</em></p>
            {visualPlan && visualPlan.scenes[i] && (
              <p style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
                <strong>Visual:</strong> {visualPlan.scenes[i].visualDescription}
              </p>
            )}
          </div>
        ))}
        
        <p><strong>Ending:</strong> <em>{scriptData.ending}</em></p>
        <p><strong>CTA:</strong> <em>{scriptData.cta}</em></p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
          <button className="btn btn-secondary" onClick={() => setStatus("editing_script")}>Edit Script</button>
          <button className="btn btn-secondary" onClick={handleRegenerateScript}>Regenerate Script</button>
          <button className="btn btn-primary" onClick={handleApproveAndGenerateVideo} style={{ backgroundColor: '#28a745', border: 'none' }}>Approve & Generate Video</button>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">AI YouTube Video Automation</h1>
        <p className="subtitle">Topic to complete YouTube video in minutes</p>
      </header>

      {errorMsg && (
        <div className="global-error">
          <p>{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      <main className="main-content" style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>
        
        <div className="card">
          <TopicInput 
            value={topic} 
            onChange={setTopic} 
            disabled={(status !== "idle" && status !== "error") || !isBackendHealthy} 
          />
          
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Script AI:</label>
              <select 
                value={scriptModel} 
                onChange={(e) => setScriptModel(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', width: '200px' }}
                disabled={status === "generating_script" || status === "generating_media"}
              >
                <option value="OpenAI">OpenAI</option>
                <option value="Gemini">Gemini</option>
                <option value="Groq">Groq</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Video Model:</label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem', width: '200px' }}
                disabled={status === "generating_media"}
              >
                <option value="Wan">Wan</option>
                <option value="LTX">LTX</option>
              </select>
            </div>
          </div>

          {(status === "idle" || status === "error") && (
            <div style={{ marginTop: '20px' }}>
              <GenerateButton 
                onClick={() => {
                   if (status === "error" && jobId && scriptData && visualPlan) {
                      // Retry media generation
                      handleApproveAndGenerateVideo();
                   } else if (status === "error" && jobId) {
                      // Retry script generation
                      handleRegenerateScript();
                   } else {
                      handleGenerateScript();
                   }
                }} 
                isLoading={false} 
                disabled={!topic.trim() || !isBackendHealthy} 
                text={status === "error" && jobId ? "Retry" : "Generate Script & Preview"}
              />
            </div>
          )}

          {(status === "generating_script" || status === "generating_media") && (
            <div style={{ marginTop: '20px' }}>
              <ProgressTracker 
                currentStep={currentStep} 
                status={stepStatus} 
                details={stepDetails} 
              />
            </div>
          )}
          
          {(status === "previewing" || status === "editing_script") && scriptData && renderScriptPreview()}
        </div>

        {status === "success" && (
          <div className="card">
            <h2>Generation Complete!</h2>

            <div style={{ padding: '15px', backgroundColor: '#e9ecef', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ marginTop: 0 }}>Processing Status</h4>
              <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: 0 }}>
                <li>✅ <strong>Script:</strong> Approved</li>
                <li>✅ <strong>Scenes:</strong> Generated</li>
                <li>✅ <strong>Audio:</strong> Ready</li>
                <li>✅ <strong>Subtitles:</strong> Ready</li>
                <li>✅ <strong>Video:</strong> Ready</li>
                <li>✅ <strong>Thumbnail:</strong> Ready</li>
              </ul>
            </div>
            
            {thumbnailUrl && (
              <div style={{ marginBottom: '20px' }}>
                <h4>YouTube Thumbnail</h4>
                <img src={thumbnailUrl} alt="Generated Thumbnail" style={{ width: '100%', maxWidth: '600px', borderRadius: '8px' }} />
                <br/>
                <a href={thumbnailUrl} download="thumbnail.png" className="btn btn-secondary" style={{ marginTop: '10px', display: 'inline-block' }}>Download Thumbnail</a>
              </div>
            )}

            {finalVideoUrl && (
              <div style={{ marginBottom: '20px' }}>
                <h4>Final Video</h4>
                <video src={finalVideoUrl} controls style={{ width: '100%', maxWidth: '600px', borderRadius: '8px', backgroundColor: '#000' }} />
                <br/>
                <a href={finalVideoUrl} download="final_video.mp4" className="btn btn-primary" style={{ marginTop: '10px', display: 'inline-block' }}>Download Video</a>
              </div>
            )}

            <button onClick={handleReset} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>Create Another</button>
          </div>
        )}
      </main>
    </div>
  );
}
