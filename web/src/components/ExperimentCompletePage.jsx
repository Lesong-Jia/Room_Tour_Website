export default function ExperimentCompletePage() {
  return (
    <section className="environment-intro-page" aria-label="Experiment complete">
      <div className="environment-complete-panel panel">
        <h1>Experiment Complete</h1>
        <p>
          Thank you for completing the experiment. Your responses have been
          submitted.
        </p>
        <div className="completion-code-panel" aria-label="Completion code">
          <span>CloudResearch completion code</span>
          <strong>4CAD4C4248</strong>
        </div>
      </div>
    </section>
  );
}
