import { useMemo, useState } from "react";
import { postJson } from "../experiment/api.js";

const UEQ_SCALE = [1, 2, 3, 4, 5, 6, 7];
const AGREEMENT_SCALE = [1, 2, 3, 4, 5];

const UEQ_ITEMS = [
  { id: "obstructive_supportive", left: "obstructive", right: "supportive" },
  { id: "complicated_easy", left: "complicated", right: "easy" },
  { id: "inefficient_efficient", left: "inefficient", right: "efficient" },
  { id: "confusing_clear", left: "confusing", right: "clear" },
  { id: "boring_exciting", left: "boring", right: "exciting" },
  { id: "not_interesting_interesting", left: "not interesting", right: "interesting" },
  { id: "conventional_inventive", left: "conventional", right: "inventive" },
  { id: "usual_leading_edge", left: "usual", right: "leading edge" }
];

const NASA_TLX_ITEMS = [
  {
    id: "mental_demand",
    label: "How mentally demanding was the Room Tour process with the robot?",
    low: "Very low",
    high: "Very high"
  },
  {
    id: "physical_demand",
    label: "How physically demanding was the Room Tour process with the robot?",
    low: "Very low",
    high: "Very high"
  },
  {
    id: "temporal_demand",
    label: "How hurried or rushed did you feel during the Room Tour process?",
    low: "Very low",
    high: "Very high"
  },
  {
    id: "performance",
    label: "How successful were you in accomplishing what you were asked to do?",
    low: "Very successful",
    high: "Not successful at all"
  },
  {
    id: "effort",
    label: "How hard did you have to work during the Room Tour process?",
    low: "Very low",
    high: "Very high"
  },
  {
    id: "frustration",
    label: "How insecure, discouraged, irritated, stressed, or annoyed did you feel?",
    low: "Very low",
    high: "Very high"
  }
];

const TRUST_ITEMS = [
  {
    id: "good_idea",
    label: "I think it is a good idea to use this domestic robot."
  },
  {
    id: "life_interesting",
    label: "This domestic robot would make daily life more interesting."
  },
  {
    id: "good_to_use",
    label: "It would be good to make use of this domestic robot."
  },
  {
    id: "trust_tasks",
    label: "I would trust this domestic robot to perform household tasks well."
  },
  {
    id: "rely_tasks",
    label: "I would rely on this domestic robot to complete household tasks."
  }
];

const AGREEMENT_LABELS = {
  1: "Disagree strongly",
  2: "Disagree a little",
  3: "Neither agree nor disagree",
  4: "Agree a little",
  5: "Agree strongly"
};

export default function PostInteractionQuestionnairePage({
  identity,
  onComplete,
  phase = "phase_2_end_questionnaire",
  questionnaireId = "post_interaction_room_tour_task_questionnaire",
  nextFlowStep = "phase_3_second_round",
  intro,
  interactionLabel = "Room Tour process with the robot"
}) {
  const [ueqAnswers, setUeqAnswers] = useState({});
  const [nasaAnswers, setNasaAnswers] = useState({});
  const [trustAnswers, setTrustAnswers] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const missingCount = useMemo(() => {
    const answeredCount =
      Object.keys(ueqAnswers).length +
      Object.keys(nasaAnswers).length +
      Object.keys(trustAnswers).length;
    return UEQ_ITEMS.length + NASA_TLX_ITEMS.length + TRUST_ITEMS.length - answeredCount;
  }, [nasaAnswers, trustAnswers, ueqAnswers]);

  const isSubmitting = submitState === "submitting";
  const isComplete = submitState === "complete";

  async function submitQuestionnaire(event) {
    event.preventDefault();
    setSubmitMessage("");

    if (missingCount > 0) {
      setSubmitState("idle");
      setSubmitMessage("Please answer all items before submitting.");
      return;
    }

    try {
      setSubmitState("submitting");
      await postJson("/api/questionnaires/submission", {
        participantId: identity?.participantId,
        participantCode: identity?.participantCode,
        sessionId: identity?.sessionId,
        questionnaireId,
        questionnaireScope: "phase_end",
        phase,
        submittedAtBrowser: new Date().toISOString(),
        nextFlowStep,
        answers: [
          {
            questionId: "ueq_s_room_tour",
            exportTag: "UEQ_S_RoomTour",
            type: "semantic_differential_group",
            value: ueqAnswers
          },
          {
            questionId: "nasa_tlx_short_room_tour",
            exportTag: "NASA_TLX_Short_RoomTour",
            type: "rating_group",
            value: nasaAnswers
          },
          {
            questionId: "attitudes_trust_domestic_robot",
            exportTag: "Attitudes_Trust_Domestic_Robot",
            type: "likert_group",
            value: trustAnswers
          }
        ]
      });
      setSubmitState("complete");
      setSubmitMessage("Questionnaire submitted. Thank you.");
      onComplete?.();
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(
        error.message || "The questionnaire could not be submitted. Please try again."
      );
    }
  }

  return (
    <section className="panel demographic-panel" aria-label="Post-interaction questionnaire">
      <div className="questionnaire-shell">
        <header className="questionnaire-header">
          <div>
            <h1>Post-Interaction Questionnaire</h1>
            {intro || (
              <p className="post-interaction-questionnaire-intro">
                Please imagine that{" "}
                <strong>the introduction and task execution</strong> you just
                completed were your{" "}
                <strong>first-day interaction with this robot</strong> after it
                arrived at your home. Based on your experience, please complete
                the questionnaire below.
              </p>
            )}
          </div>
        </header>

        <form className="questionnaire-form" onSubmit={submitQuestionnaire}>
          <section className="questionnaire-section">
            <div className="questionnaire-section-heading">
              <h2>UEQ-S</h2>
              <p>{`I think the ${interactionLabel} was...`}</p>
            </div>
            <div className="question-stack">
              {UEQ_ITEMS.map((item) => (
                <SemanticDifferentialItem
                  item={item}
                  key={item.id}
                  value={ueqAnswers[item.id]}
                  disabled={isSubmitting || isComplete}
                  onChange={(value) =>
                    setUeqAnswers((current) => ({ ...current, [item.id]: value }))
                  }
                />
              ))}
            </div>
          </section>

          <section className="questionnaire-section">
            <div className="questionnaire-section-heading">
              <h2>NASA-TLX</h2>
            </div>
            <div className="question-stack">
              {NASA_TLX_ITEMS.map((item) => (
                <RatingScaleItem
                  item={getNasaItemForInteraction(item, interactionLabel)}
                  key={item.id}
                  scale={UEQ_SCALE}
                  value={nasaAnswers[item.id]}
                  disabled={isSubmitting || isComplete}
                  onChange={(value) =>
                    setNasaAnswers((current) => ({ ...current, [item.id]: value }))
                  }
                />
              ))}
            </div>
          </section>

          <section className="questionnaire-section">
            <div className="questionnaire-section-heading">
              <h2>Attitudes and Trust Toward This Domestic Robot</h2>
            </div>
            <div className="question-stack">
              {TRUST_ITEMS.map((item) => (
                <AgreementItem
                  item={item}
                  key={item.id}
                  value={trustAnswers[item.id]}
                  disabled={isSubmitting || isComplete}
                  onChange={(value) =>
                    setTrustAnswers((current) => ({ ...current, [item.id]: value }))
                  }
                />
              ))}
            </div>
          </section>

          <div className="questionnaire-actions">
            {submitMessage ? (
              <p
                className={
                  submitState === "error" || submitState === "idle"
                    ? "questionnaire-message error"
                    : "questionnaire-message success"
                }
                role="status"
              >
                {submitMessage}
              </p>
            ) : null}
            <button className="primary-action" type="submit" disabled={isSubmitting || isComplete}>
              {isSubmitting ? "Submitting..." : isComplete ? "Submitted" : "Submit questionnaire"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function SemanticDifferentialItem({ item, value, disabled, onChange }) {
  return (
    <fieldset className="question-field phase-scale-field">
      <legend className="sr-only">{`${item.left} to ${item.right}`}</legend>
      <div className="phase-semantic-scale">
        <span>{item.left}</span>
        <div className="phase-scale-options seven-point">
          {UEQ_SCALE.map((option) => (
            <ScaleRadio
              disabled={disabled}
              groupName={`ueq-${item.id}`}
              key={option}
              label={String(option)}
              value={String(option)}
              checked={value === String(option)}
              onChange={onChange}
            />
          ))}
        </div>
        <span>{item.right}</span>
      </div>
    </fieldset>
  );
}

function getNasaItemForInteraction(item, interactionLabel) {
  return {
    ...item,
    label: item.label
      .replace("the Room Tour process with the robot", `the ${interactionLabel}`)
      .replace("the Room Tour process", `the ${interactionLabel}`)
  };
}

function RatingScaleItem({ item, scale, value, disabled, onChange }) {
  return (
    <fieldset className="question-field phase-scale-field">
      <legend className="sr-only">{item.label}</legend>
      <h3>{item.label}</h3>
      <div className="phase-scale-endpoints">
        <span>{item.low}</span>
        <span>{item.high}</span>
      </div>
      <div className="phase-scale-options seven-point">
        {scale.map((option) => (
          <ScaleRadio
            disabled={disabled}
            groupName={`nasa-${item.id}`}
            key={option}
            label={String(option)}
            value={String(option)}
            checked={value === String(option)}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

function AgreementItem({ item, value, disabled, onChange }) {
  return (
    <fieldset className="question-field phase-scale-field">
      <legend className="sr-only">{item.label}</legend>
      <h3>{item.label}</h3>
      <div className="phase-scale-options five-point">
        {AGREEMENT_SCALE.map((option) => (
          <ScaleRadio
            disabled={disabled}
            groupName={`trust-${item.id}`}
            key={option}
            label={`${option}`}
            helper={AGREEMENT_LABELS[option]}
            value={String(option)}
            checked={value === String(option)}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ScaleRadio({ groupName, value, label, helper = "", checked, disabled, onChange }) {
  return (
    <label className="phase-scale-option">
      <input
        checked={checked}
        disabled={disabled}
        name={groupName}
        onChange={() => onChange(value)}
        type="radio"
        value={value}
      />
      <span>{label}</span>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}
