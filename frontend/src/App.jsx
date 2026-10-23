
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";

const suggestions = [
  {
    icon: "⚛️",
    title: "React Hooks",
    description: "Understand useState, useEffect, and custom hooks.",
    question: "Explain React Hooks with examples.",
    color: "purple",
  },
  {
    icon: "🐍",
    title: "Python Basics",
    description: "Practice Python fundamentals and coding concepts.",
    question: "What is Python? Explain its important features.",
    color: "blue",
  },
  {
    icon: "🧩",
    title: "OOP Concepts",
    description: "Learn classes, objects, inheritance, and polymorphism.",
    question: "Explain the four pillars of object-oriented programming.",
    color: "pink",
  },
  {
    icon: "🗄️",
    title: "SQL Queries",
    description: "Review joins, subqueries, and database concepts.",
    question: "Explain SQL joins with simple examples.",
    color: "orange",
  },
];

function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState(null);
  const [sources, setSources] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [usedRag, setUsedRag] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch("/api/health");

        if (active) {
          setApiOnline(response.ok);
        }
      } catch {
        if (active) {
          setApiOnline(false);
        }
      }
    }

    checkBackend();

    return () => {
      active = false;
    };
  }, []);

  async function handleAsk(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Please enter an interview question.");
      return;
    }

    setAsking(true);
    setError("");
    setAnswer("");
    setSources([]);
    setUsedRag(false);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "Failed to generate an answer."
        );
      }

      setAnswer(
        typeof data.answer === "string"
          ? data.answer
          : "The server returned no answer. Please try again."
      );

      setSources(Array.isArray(data.sources) ? data.sources : []);
      setUsedRag(Boolean(data.used_rag));
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the backend. Please check your server."
      );
    } finally {
      setAsking(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!file) {
      setUploadMessage("Please select a PDF file first.");
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadMessage("Please select a PDF file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadMessage("");

    try {
      const response = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || "PDF upload failed."
        );
      }

      setUploadMessage(
        `Successfully uploaded ${data.filename || file.name}. ${
          data.chunks_indexed != null
            ? `${data.chunks_indexed} chunks indexed.`
            : "Your document was processed."
        }`
      );

      setFile(null);
      event.target.reset();
    } catch (err) {
      setUploadMessage(
        err.message ||
          "Could not upload the PDF. Check the backend endpoint."
      );
    } finally {
      setUploading(false);
    }
  }

  function chooseSuggestion(suggestion) {
    setQuestion(suggestion);
    setError("");
    document.getElementById("practice")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#home" className="brand">
          <span className="brand-icon">✦</span>
          <span>
            <strong>PrepPilot</strong>
            <small>AI INTERVIEW COACH</small>
          </span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <a href="#home" className="nav-item active">
            <span>▦</span> Dashboard
          </a>
          <a href="#practice" className="nav-item">
            <span>✎</span> Practice questions
          </a>
          <a href="#upload" className="nav-item">
            <span>⇧</span> My documents
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">✧</div>
            <strong>Small steps. Big progress.</strong>
            <p>Practice a little every day to build your confidence.</p>
          </div>

          <div className="connection">
            <span
              className={`status-dot ${apiOnline ? "online" : "offline"}`}
            />
            <span>{apiOnline ? "Backend connected" : "Backend offline"}</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="home">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR PERSONAL AI COACH</p>
            <h1>Interview preparation</h1>
          </div>
          <div className="topbar-right">
            <span className="topbar-badge">✦ AI POWERED</span>
            <div className="avatar">P</div>
          </div>
        </header>

        <section className="hero">
          <div className="hero-content">
            <span className="hero-label">
              <span>✦</span> YOUR NEXT OPPORTUNITY STARTS HERE
            </span>
            <h2>
              Practice smarter.
              <br />
              <span>Show up confident.</span>
            </h2>
            <p>
              Your AI-powered space to explore concepts, practice technical
              questions, and prepare for your next interview.
            </p>
            <a href="#practice" className="primary-button">
              Start practicing <span>→</span>
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-glow" />
            <div className="art-card">
              <span className="art-sparkle">✦</span>
              <span className="art-card-title">YOUR POTENTIAL</span>
              <strong>∞</strong>
              <span className="art-card-bottom">has no limits</span>
            </div>
            <span className="floating-star star-one">✦</span>
            <span className="floating-star star-two">✧</span>
            <span className="floating-star star-three">✦</span>
          </div>
        </section>

        <section className="stats-grid" aria-label="Application features">
          <div className="stat-card">
            <div className="stat-icon purple-icon">✧</div>
            <div>
              <p>AI ASSISTANT</p>
              <h3>Instant answers</h3>
              <span>Learn at your own pace</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue-icon">▤</div>
            <div>
              <p>STUDY MATERIAL</p>
              <h3>PDF learning</h3>
              <span>Use your own notes</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon pink-icon">⌘</div>
            <div>
              <p>PRACTICE MODE</p>
              <h3>Build confidence</h3>
              <span>Explore technical topics</span>
            </div>
          </div>
        </section>

        <section className="section-block" id="practice">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LEARN SOMETHING NEW</p>
              <h2>Choose your practice topic</h2>
              <p className="section-description">
                Pick a topic or enter your own interview question.
              </p>
            </div>
          </div>

          <div className="suggestion-grid">
            {suggestions.map((item) => (
              <button
                className="topic-card"
                key={item.title}
                type="button"
                onClick={() => chooseSuggestion(item.question)}
              >
                <span className={`topic-icon ${item.color}`}>
                  {item.icon}
                </span>
                <strong>{item.title}</strong>
                <span className="topic-description">{item.description}</span>
                <span className="topic-action">
                  Practice now <span>↗</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="work-grid">
          <div className="panel upload-panel" id="upload">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">YOUR LEARNING MATERIAL</p>
                <h2>Upload your notes</h2>
              </div>
              <span className="heading-icon">⇧</span>
            </div>

            <p className="panel-description">
              Add a PDF with interview notes or study material to use as a
              reference for your questions.
            </p>

            <form onSubmit={handleUpload}>
              <label className="upload-dropzone">
                <span className="upload-icon">⇧</span>
                <strong>
                  {file ? file.name : "Choose a PDF to upload"}
                </strong>
                <span>
                  {file
                    ? "File selected — ready to upload"
                    : "Click here to browse your files"}
                </span>
                <span className="file-type">PDF FILES ONLY</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setUploadMessage("");
                  }}
                />
              </label>

              <button
                className="secondary-button full-button"
                type="submit"
                disabled={uploading || !file}
              >
                {uploading ? "Uploading..." : "Upload document"}
                {!uploading && <span>↑</span>}
              </button>
            </form>

            {uploadMessage && (
              <p
                className={`feedback-message ${
                  uploadMessage.toLowerCase().includes("fail") ||
                  uploadMessage.toLowerCase().includes("could not") ||
                  uploadMessage.toLowerCase().includes("please")
                    ? "error-text"
                    : ""
                }`}
                role="status"
              >
                {uploadMessage}
              </p>
            )}

            <p className="privacy-note">
              <span>🔒</span> Only upload documents you are allowed to use.
            </p>
          </div>

          <div className="panel question-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">LET'S GET PRACTICING</p>
                <h2>Ask your AI coach</h2>
              </div>
              <span className="heading-icon">✧</span>
            </div>

            <p className="panel-description">
              Ask anything about programming, technical concepts, or interview
              preparation.
            </p>

            <form onSubmit={handleAsk}>
              <label className="input-label" htmlFor="question-input">
                YOUR QUESTION
              </label>
              <textarea
                id="question-input"
                className="question-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="e.g. Explain Python OOP concepts with examples..."
                rows={5}
              />

              {error && (
                <p className="feedback-message error-text" role="alert">
                  {error}
                </p>
              )}

              <button
                className="primary-button full-button"
                type="submit"
                disabled={asking}
              >
                {asking ? (
                  <>
                    <span className="spinner" /> Generating answer...
                  </>
                ) : (
                  <>
                    Generate answer <span>✦</span>
                  </>
                )}
              </button>
            </form>

            <div className="suggested-prompts">
              <span>TRY ASKING</span>
              <button
                type="button"
                onClick={() =>
                  chooseSuggestion("What is the difference between let, const, and var?")
                }
              >
                JavaScript basics
              </button>
              <button
                type="button"
                onClick={() =>
                  chooseSuggestion("Explain SQL joins with examples.")
                }
              >
                SQL interview
              </button>
            </div>
          </div>
        </section>

        {answer && (
          <section className="panel answer-panel" aria-live="polite">
            <div className="answer-header">
              <div className="answer-title">
                <div className="answer-bot-icon">✦</div>
                <div>
                  <p className="eyebrow">YOUR PERSONAL AI COACH</p>
                  <h2>Interview answer</h2>
                </div>
              </div>
              <span className={`answer-badge ${usedRag ? "rag-badge" : ""}`}>
                {usedRag ? "Document context used" : "AI generated"}
              </span>
            </div>

            <div className="question-summary">
              <span>Q</span>
              <p>{question}</p>
            </div>

            <div className="answer-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {answer}
              </ReactMarkdown>
            </div>

            {sources.length > 0 && (
              <div className="sources-block">
                <h3>Reference sources</h3>
                <ul>
                  {sources.map((source, index) => (
                    <li key={`${source.filename || "source"}-${index}`}>
                      <strong>{source.filename || `Source ${index + 1}`}</strong>
                      {source.page != null && ` · Page ${source.page}`}
                      {typeof source.score === "number" &&
                        ` · Relevance: ${(source.score * 100).toFixed(1)}%`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="answer-footer">
              <span>✦ Keep practicing to build confidence.</span>
              <button
                type="button"
                onClick={() => {
                  setQuestion("");
                  setAnswer("");
                  setSources([]);
                  setError("");
                }}
              >
                Clear answer
              </button>
            </div>
          </section>
        )}

        <footer className="footer">
          <span>✦ PrepPilot AI</span>
          <span>Practice today. Progress tomorrow.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
