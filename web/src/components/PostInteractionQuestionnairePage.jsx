import { useEffect, useMemo, useState } from "react";
import { postJson } from "../experiment/api.js";
import {
  getCompletedTaskPhaseTaskKey,
  getStoredCompletedTaskPhaseTasks,
  getTaskPhaseTaskDisplayName
} from "../experiment/completedTaskPhaseTasks.js";
import {
  isNoRoomTourCondition
} from "../experiment/roomTourCondition.js";

const UEQ_SCALE = [1, 2, 3, 4, 5, 6, 7];
const TASK_EVALUATION_SCALE = [1, 2, 3, 4, 5];
const AGREEMENT_SCALE = [1, 2, 3, 4, 5];
const OPEN_ENDED_MIN_WORDS = 10;
const BASE_INTERACTION_LABEL = "interaction between you and the robot";
const ROOM_TOUR_INTERACTION_DETAIL =
  "including the Room Tour part where you introduced the home objects to the robot and the task part where you asked the robot to perform tasks";

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

const PHASE_ATTENTION_CHECK = {
  id: "phase_attention_check",
  label: "To confirm that you are paying attention, please select Agree a little.",
  expectedValue: "4"
};

const FINAL_OPEN_ENDED_ITEMS = [
  {
    id: "room_tour_suggestions",
    label:
      "Do you have any suggestions about the Room Tour that the user gave to the robot during the initial part of the experiment?"
  },
  {
    id: "voice_feedback_suggestions",
    label:
      "Do you have any suggestions about the robot's voice feedback after the user gave task instructions?"
  }
];

export default function PostInteractionQuestionnairePage({
  identity,
  onComplete,
  phase = "phase_2_end_questionnaire",
  questionnaireId = "post_interaction_room_tour_task_questionnaire",
  nextFlowStep = "phase_3_second_round",
  intro,
  interactionLabel
}) {
  const [ueqAnswers, setUeqAnswers] = useState({});
  const [nasaAnswers, setNasaAnswers] = useState({});
  const [trustAnswers, setTrustAnswers] = useState({});
  const [attentionCheckAnswer, setAttentionCheckAnswer] = useState("");
  const [taskEvaluationAnswers, setTaskEvaluationAnswers] = useState({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState({});
  const [openEndedErrors, setOpenEndedErrors] = useState({});
  const [completedTaskRecords, setCompletedTaskRecords] = useState([]);
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const showFinalTaskEvaluation = phase === "phase_3_end_questionnaire";
  const effectiveInteractionLabel =
    interactionLabel || getDefaultInteractionLabel(identity?.roomTourCondition);
  const showAttentionCheckAfterNasa = phase === "phase_2_end_questionnaire";
  const showAttentionCheckAfterTrust = !showAttentionCheckAfterNasa;
  const finalTaskEvaluationGroups = useMemo(
    () => buildFinalTaskEvaluationGroups(completedTaskRecords),
    [completedTaskRecords]
  );
  const finalTaskEvaluationItemCount = finalTaskEvaluationGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const answeredTaskEvaluationItemCount = finalTaskEvaluationGroups.reduce(
    (count, group) =>
      count +
      group.items.filter((item) => Boolean(taskEvaluationAnswers[item.id])).length,
    0
  );

  useEffect(() => {
    if (!showFinalTaskEvaluation || !identity?.sessionId) {
      setCompletedTaskRecords([]);
      return;
    }

    setCompletedTaskRecords(getStoredCompletedTaskPhaseTasks(identity.sessionId));
  }, [identity?.sessionId, showFinalTaskEvaluation]);

  const missingCount = useMemo(() => {
    const answeredCount =
      Object.keys(ueqAnswers).length +
      Object.keys(nasaAnswers).length +
      Object.keys(trustAnswers).length +
      (attentionCheckAnswer ? 1 : 0) +
      (showFinalTaskEvaluation ? answeredTaskEvaluationItemCount : 0) +
      (showFinalTaskEvaluation
        ? FINAL_OPEN_ENDED_ITEMS.filter(
            (item) => countWords(openEndedAnswers[item.id]) >= OPEN_ENDED_MIN_WORDS
          ).length
        : 0);
    const expectedCount =
      UEQ_ITEMS.length +
      NASA_TLX_ITEMS.length +
      TRUST_ITEMS.length +
      1 +
      (showFinalTaskEvaluation
        ? finalTaskEvaluationItemCount + FINAL_OPEN_ENDED_ITEMS.length
        : 0);
    return expectedCount - answeredCount;
  }, [
    answeredTaskEvaluationItemCount,
    finalTaskEvaluationItemCount,
    attentionCheckAnswer,
    nasaAnswers,
    openEndedAnswers,
    showFinalTaskEvaluation,
    taskEvaluationAnswers,
    trustAnswers,
    ueqAnswers
  ]);

  const isSubmitting = submitState === "submitting";
  const isComplete = submitState === "complete";

  async function submitQuestionnaire(event) {
    event.preventDefault();
    setSubmitMessage("");
    const nextOpenEndedErrors = showFinalTaskEvaluation
      ? getOpenEndedErrors(openEndedAnswers)
      : {};
    setOpenEndedErrors(nextOpenEndedErrors);

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
          },
          {
            questionId: PHASE_ATTENTION_CHECK.id,
            exportTag: "Phase_Attention_Check",
            type: "attention_check",
            prompt: PHASE_ATTENTION_CHECK.label,
            value: attentionCheckAnswer,
            metadata: {
              expectedValue: PHASE_ATTENTION_CHECK.expectedValue,
              passed: attentionCheckAnswer === PHASE_ATTENTION_CHECK.expectedValue
            }
          },
          ...(showFinalTaskEvaluation
              ? [
                  {
                    questionId: "final_task_evaluation_by_completed_task",
                    exportTag: "Final_Task_Evaluation_By_Completed_Task",
                    type: "task_rating_group",
                    value: taskEvaluationAnswers,
                    metadata: {
                      taskRecords: completedTaskRecords
                    }
                  },
                  {
                    questionId: "final_open_ended_feedback",
                    exportTag: "Final_Open_Ended_Feedback",
                    type: "open_text_group",
                    value: openEndedAnswers,
                    metadata: {
                      minWordCount: OPEN_ENDED_MIN_WORDS
                    }
                  }
                ]
            : [])
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
                <strong>the {effectiveInteractionLabel}</strong> you just completed was your{" "}
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
              <p>{`I think the ${effectiveInteractionLabel} was...`}</p>
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
                  item={getNasaItemForInteraction(item, effectiveInteractionLabel)}
                  key={item.id}
                  scale={UEQ_SCALE}
                  value={nasaAnswers[item.id]}
                  disabled={isSubmitting || isComplete}
                  onChange={(value) =>
                    setNasaAnswers((current) => ({ ...current, [item.id]: value }))
                  }
                />
              ))}
              {showAttentionCheckAfterNasa ? (
                <AgreementItem
                  item={PHASE_ATTENTION_CHECK}
                  value={attentionCheckAnswer}
                  disabled={isSubmitting || isComplete}
                  onChange={setAttentionCheckAnswer}
                />
              ) : null}
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
              {showAttentionCheckAfterTrust ? (
                <AgreementItem
                  item={PHASE_ATTENTION_CHECK}
                  value={attentionCheckAnswer}
                  disabled={isSubmitting || isComplete}
                  onChange={setAttentionCheckAnswer}
                />
              ) : null}
            </div>
          </section>

          {showFinalTaskEvaluation ? (
            <section className="questionnaire-section">
              <div className="questionnaire-section-heading">
                <h2>Task Evaluation</h2>
                <p>
                  Please evaluate how difficult and dangerous you think each
                  of the following tasks would be for a robot to perform.
                </p>
              </div>
              {finalTaskEvaluationGroups.length > 0 ? (
                <div className="task-evaluation-stack">
                  {finalTaskEvaluationGroups.map((group) => (
                    <div className="task-evaluation-group" key={group.key}>
                      <div className="task-evaluation-group-heading">
                        <span>{`${group.displayIndex}/${group.totalCount}`}</span>
                        <h3>{group.taskLabel}</h3>
                      </div>
                      <div className="question-stack">
                        {group.items.map((item) => (
                          <RatingScaleItem
                            item={item}
                            key={item.id}
                            scale={TASK_EVALUATION_SCALE}
                            value={taskEvaluationAnswers[item.id]}
                            disabled={isSubmitting || isComplete}
                            onChange={(value) =>
                              setTaskEvaluationAnswers((current) => ({
                                ...current,
                                [item.id]: value
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="question-helper">
                  No completed task records have been saved in this session yet.
                </p>
              )}
            </section>
          ) : null}

          {showFinalTaskEvaluation ? (
            <section className="questionnaire-section">
              <div className="questionnaire-section-heading">
                <h2>Open-Ended Feedback</h2>
                <p>Please write at least 10 words for each response.</p>
              </div>
              <div className="open-ended-stack">
                {FINAL_OPEN_ENDED_ITEMS.map((item) => (
                  <OpenEndedItem
                    disabled={isSubmitting || isComplete}
                    error={openEndedErrors[item.id]}
                    item={item}
                    key={item.id}
                    minWords={OPEN_ENDED_MIN_WORDS}
                    value={openEndedAnswers[item.id] || ""}
                    onChange={(value) => {
                      setOpenEndedAnswers((current) => ({
                        ...current,
                        [item.id]: value
                      }));
                      setOpenEndedErrors((current) => ({
                        ...current,
                        [item.id]: ""
                      }));
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

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

function buildFinalTaskEvaluationGroups(taskRecords) {
  const uniqueRecords = [];
  const seenTaskIds = new Set();

  for (const record of taskRecords || []) {
    const normalizedTaskId = String(record?.taskId || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const uniqueKey = normalizedTaskId || getCompletedTaskPhaseTaskKey(record, uniqueRecords.length);

    if (seenTaskIds.has(uniqueKey)) {
      continue;
    }

    seenTaskIds.add(uniqueKey);
    uniqueRecords.push({
      ...record,
      taskId: normalizedTaskId || record?.taskId
    });
  }

  const totalCount = uniqueRecords.length;

  return uniqueRecords.map((record, index) => {
    const taskKey = record.taskId || getCompletedTaskPhaseTaskKey(record, index);
    const taskLabel =
      record.taskLabel || getTaskPhaseTaskDisplayName(record.taskId);

    return {
      key: taskKey,
      record,
      taskLabel,
      displayIndex: index + 1,
      totalCount,
      items: [
        {
          id: `${taskKey}-difficulty`,
          label: "How difficult would this task be for a robot to perform?",
          low: "Very easy",
          high: "Very difficult"
        },
        {
          id: `${taskKey}-danger`,
          label: "How dangerous would this task be for a robot to perform?",
          low: "Very safe",
          high: "Very dangerous"
        }
      ]
    };
  });
}

function getDefaultInteractionLabel(roomTourCondition) {
  if (isNoRoomTourCondition(roomTourCondition)) {
    return BASE_INTERACTION_LABEL;
  }

  return `${BASE_INTERACTION_LABEL} (${ROOM_TOUR_INTERACTION_DETAIL})`;
}

function getOpenEndedErrors(openEndedAnswers) {
  return FINAL_OPEN_ENDED_ITEMS.reduce((errors, item) => {
    const wordCount = countWords(openEndedAnswers[item.id]);

    if (wordCount < OPEN_ENDED_MIN_WORDS) {
      return {
        ...errors,
        [item.id]: `Please write at least ${OPEN_ENDED_MIN_WORDS} words.`
      };
    }

    return errors;
  }, {});
}

function countWords(value) {
  const matches = String(value || "").match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g);
  return matches ? matches.length : 0;
}

function OpenEndedItem({ item, value, minWords, error, disabled, onChange }) {
  const wordCount = countWords(value);

  return (
    <fieldset className={`question-field open-ended-field ${error ? "invalid" : ""}`}>
      <legend className="sr-only">{item.label}</legend>
      <h3>{item.label}</h3>
      <textarea
        disabled={disabled}
        minLength={1}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your response here..."
        rows={5}
        value={value}
      />
      <div className="open-ended-footer">
        <span>
          {wordCount}/{minWords} words minimum
        </span>
        {error ? <p className="question-error">{error}</p> : null}
      </div>
    </fieldset>
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
      <div
        className={`phase-scale-options ${
          scale.length === 5 ? "five-point" : "seven-point"
        }`}
      >
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
