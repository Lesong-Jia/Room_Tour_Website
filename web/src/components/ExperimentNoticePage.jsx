export default function ExperimentNoticePage({ onContinue }) {
  return (
    <section className="panel experiment-notice-panel" aria-label="Experiment welcome notice">
      <div className="experiment-notice-copy">
        <p className="section-kicker">Before You Begin</p>
        <h1>Welcome to the Experiment</h1>
        <p>
          Thank you for participating. Please read the information below before
          starting so the experiment can run smoothly.
        </p>
        <div className="experiment-notice-sections">
          <section>
            <h2>Participant Requirement</h2>
            <p>
              This study is conducted in English. Please participate only if you
              are a native English speaker or can understand and speak English
              fluently throughout the experiment.
            </p>
          </section>
          <section>
            <h2>Device and Display Setup</h2>
            <p>
              Please make sure you have a working microphone, headphones,
              keyboard, and mouse. If the webpage asks for permission to record
              audio, please allow microphone access.
            </p>
            <p>
              For the best experience, a computer with strong performance and a
              2K or higher-resolution monitor is recommended. The Chrome browser
              is recommended. If the 3D model does not display correctly, please
              try switching to another browser.
            </p>
          </section>
          <section>
            <h2>Careful Participation</h2>
            <p>
              Please complete each part carefully and attentively. Some sections
              may include attention check questions that ask you to select a
              specific response option. Incorrect answers may affect bonus payment
              eligibility.
            </p>
            <p>
              We will provide an additional bonus to the top five participants who
              complete the experiment most carefully.
            </p>
          </section>
        </div>
        <p>
          The next pages will help you verify these requirements and establish an
          initial connection with the robot.
        </p>
      </div>
      <button className="primary-action" type="button" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
