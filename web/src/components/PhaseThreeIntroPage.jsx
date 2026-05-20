export default function PhaseThreeIntroPage({ onContinue }) {
  return (
    <section
      className="environment-intro-page"
      aria-label="Second interaction round introduction"
    >
      <div className="environment-complete-panel panel">
        <h1>Many Days Later</h1>
        <p>
          Many days later, Aria has continued helping you handle household
          tasks in your home...
        </p>
        <div className="environment-intro-actions">
          <button className="primary-action" type="button" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}
