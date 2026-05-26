import { useEffect, useMemo, useState } from "react";
import { postJson } from "../experiment/api.js";
import {
  clearQuestionnaireDraft,
  getQuestionnaireDraft,
  saveQuestionnaireDraft
} from "../experiment/questionnaireDrafts.js";
import { preExperimentQuestionnaire } from "../experiment/questionnaires.js";

export default function DemographicPage({ identity, onComplete }) {
  const questionnaire = preExperimentQuestionnaire;
  const [answers, setAnswers] = useState({});
  const [otherText, setOtherText] = useState({});
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const visibleQuestions = useMemo(
    () =>
      questionnaire.sections.flatMap((section) =>
        section.questions.filter((question) => isQuestionVisible(question, answers))
      ),
    [answers, questionnaire.sections]
  );

  const isSubmitting = submitState === "submitting";
  const isComplete = submitState === "complete";

  useEffect(() => {
    setDraftLoaded(false);
    const draft = getQuestionnaireDraft(identity?.sessionId, questionnaire.id);

    if (draft?.answers) {
      setAnswers(draft.answers);
    }

    if (draft?.otherText) {
      setOtherText(draft.otherText);
    }

    setDraftLoaded(true);
  }, [identity?.sessionId, questionnaire.id]);

  useEffect(() => {
    if (!identity?.sessionId || !draftLoaded || isComplete) {
      return;
    }

    saveQuestionnaireDraft(identity.sessionId, questionnaire.id, {
      answers,
      otherText
    });
  }, [
    answers,
    otherText,
    identity?.sessionId,
    draftLoaded,
    isComplete,
    questionnaire.id
  ]);

  function updateSingleAnswer(questionId, value) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value
    }));
    clearError(questionId);
  }

  function updateMultiAnswer(question, value, checked) {
    setAnswers((current) => {
      const currentValues = Array.isArray(current[question.id])
        ? current[question.id]
        : [];
      const option = question.options.find((candidate) => candidate.value === value);
      let nextValues = checked
        ? [...currentValues, value]
        : currentValues.filter((candidate) => candidate !== value);

      if (checked && option?.exclusive) {
        nextValues = [value];
      } else if (checked) {
        nextValues = nextValues.filter((candidate) => {
          const candidateOption = question.options.find(
            (possibleOption) => possibleOption.value === candidate
          );
          return !candidateOption?.exclusive;
        });
      }

      return {
        ...current,
        [question.id]: nextValues
      };
    });
    clearError(question.id);
  }

  function updateLikertAnswer(questionId, itemId, value) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || {}),
        [itemId]: value
      }
    }));
    clearError(questionId);
  }

  function updateOtherText(questionId, value) {
    setOtherText((current) => ({
      ...current,
      [questionId]: value
    }));
    clearError(questionId);
  }

  function clearError(questionId) {
    setErrors((current) => {
      if (!current[questionId]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[questionId];
      return nextErrors;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitMessage("");

    const nextErrors = validateQuestions(visibleQuestions, answers, otherText);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitState("idle");
      setSubmitMessage("Please complete the highlighted questions before continuing.");
      focusFirstInvalidQuestion(nextErrors);
      return;
    }

    try {
      if (!identity?.participantId || !identity?.sessionId) {
        throw new Error("Experiment identity is not ready. Please refresh the page.");
      }

      setSubmitState("submitting");
      await postJson("/api/questionnaires/submission", {
        participantId: identity.participantId,
        participantCode: identity.participantCode,
        sessionId: identity.sessionId,
        questionnaireId: questionnaire.id,
        sourceSurveyId: questionnaire.sourceSurveyId,
        questionnaireScope: questionnaire.scope,
        phase: questionnaire.phase,
        submittedAtBrowser: new Date().toISOString(),
        nextFlowStep: "environment_intro",
        answers: buildAnswerRecords(visibleQuestions, answers, otherText, questionnaire)
      });
      clearQuestionnaireDraft(identity.sessionId, questionnaire.id);
      setSubmitState("complete");
      setSubmitMessage("Questionnaire submitted. You are ready for the next part.");
      onComplete?.();
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(
        error.message || "The questionnaire could not be submitted. Please try again."
      );
    }
  }

  return (
    <section
      className="panel demographic-panel"
      aria-label="Demographic questionnaire"
    >
      <div className="questionnaire-shell">
        <header className="questionnaire-header">
          <div>
            <h1>{questionnaire.title}</h1>
            <p>{questionnaire.subtitle}</p>
          </div>
        </header>

        <form className="questionnaire-form" onSubmit={handleSubmit}>
          {questionnaire.sections.map((section) => {
            const sectionQuestions = section.questions.filter((question) =>
              isQuestionVisible(question, answers)
            );

            if (sectionQuestions.length === 0) {
              return null;
            }

            return (
              <section className="questionnaire-section" key={section.id}>
                <div className="questionnaire-section-heading">
                  <h2>{section.title}</h2>
                  {section.description ? <p>{section.description}</p> : null}
                </div>

                <div className="question-stack">
                  {sectionQuestions.map((question) => (
                    <QuestionField
                      key={question.id}
                      question={question}
                      questionnaire={questionnaire}
                      value={answers[question.id]}
                      otherTextValue={otherText[question.id] || ""}
                      error={errors[question.id]}
                      disabled={isSubmitting || isComplete}
                      onSingleAnswer={updateSingleAnswer}
                      onMultiAnswer={updateMultiAnswer}
                      onLikertAnswer={updateLikertAnswer}
                      onNumberAnswer={updateSingleAnswer}
                      onOtherText={updateOtherText}
                    />
                  ))}
                </div>
              </section>
            );
          })}

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
            <button
              className="primary-action"
              type="submit"
              disabled={isSubmitting || isComplete}
            >
              {isSubmitting
                ? "Submitting..."
                : isComplete
                  ? "Submitted"
                  : "Submit questionnaire"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function QuestionField({
  question,
  questionnaire,
  value,
  otherTextValue,
  error,
  disabled,
  onSingleAnswer,
  onMultiAnswer,
  onLikertAnswer,
  onNumberAnswer,
  onOtherText
}) {
  const options = getQuestionOptions(question, questionnaire);
  const questionLabelId = `${question.id}-label`;

  return (
    <div
      className={error ? "question-field invalid" : "question-field"}
      data-question-id={question.id}
      role="group"
      aria-labelledby={questionLabelId}
    >
      <h3 id={questionLabelId}>
        {question.prompt}
        {question.required ? <span aria-hidden="true"> *</span> : null}
      </h3>

      {question.helper ? <p className="question-helper">{question.helper}</p> : null}

      {question.type === "single_choice" ? (
        <div className="choice-grid">
          {options.map((option) => (
            <label className="choice-option" key={option.value}>
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={value === option.value}
                disabled={disabled}
                onChange={() => onSingleAnswer(question.id, option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.type === "multi_choice" ? (
        <div className="choice-grid">
          {options.map((option) => (
            <label className="choice-option" key={option.value}>
              <input
                type="checkbox"
                name={question.id}
                value={option.value}
                checked={Array.isArray(value) && value.includes(option.value)}
                disabled={disabled}
                onChange={(event) =>
                  onMultiAnswer(question, option.value, event.target.checked)
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.type === "likert_single" ? (
        <div className="likert-stack">
          <div className="likert-item compact-likert-item">
            <div
              className="likert-options"
              role="radiogroup"
              aria-label={question.prompt}
            >
              {options.map((option) => (
                <label className="likert-option" key={option.value}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={value === option.value}
                    disabled={disabled}
                    onChange={() => onSingleAnswer(question.id, option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {question.type === "number" ? (
        <label className="number-field">
          <input
            type="number"
            inputMode="numeric"
            aria-label={question.prompt}
            min={question.min}
            max={question.max}
            step="1"
            value={value || ""}
            placeholder={question.placeholder || ""}
            disabled={disabled}
            onChange={(event) => onNumberAnswer(question.id, event.target.value)}
          />
          <span>years old</span>
        </label>
      ) : null}

      {shouldShowOtherText(question, value) ? (
        <label className="other-text-field">
          <span>{question.otherTextLabel || "Please describe"}</span>
          <input
            type="text"
            value={otherTextValue}
            disabled={disabled}
            onChange={(event) => onOtherText(question.id, event.target.value)}
          />
        </label>
      ) : null}

      {question.type === "likert_group" ? (
        <div className="likert-stack">
          {question.items.map((item) => (
            <div className="likert-item" key={item.id}>
              <p>{item.text}</p>
              <div
                className="likert-options"
                role="radiogroup"
                aria-label={item.text}
              >
                {options.map((option) => (
                  <label className="likert-option" key={option.value}>
                    <input
                      type="radio"
                      name={`${question.id}_${item.id}`}
                      value={option.value}
                      checked={value?.[item.id] === option.value}
                      disabled={disabled}
                      onChange={() =>
                        onLikertAnswer(question.id, item.id, option.value)
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="question-error">{error}</p> : null}
    </div>
  );
}

function isQuestionVisible(question, answers) {
  if (!question.visibleWhen) {
    return true;
  }

  const controllingAnswer = answers[question.visibleWhen.questionId];

  if (Array.isArray(controllingAnswer)) {
    return controllingAnswer.includes(question.visibleWhen.includes);
  }

  if ("equals" in question.visibleWhen) {
    return controllingAnswer === question.visibleWhen.equals;
  }

  return false;
}

function isQuestionAnswered(question, answers, otherText) {
  const value = answers[question.id];

  if (!question.required) {
    return true;
  }

  if (question.type === "single_choice" || question.type === "likert_single") {
    return Boolean(value) && hasRequiredOtherText(question, value, otherText);
  }

  if (question.type === "multi_choice") {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      hasRequiredOtherText(question, value, otherText)
    );
  }

  if (question.type === "number") {
    const numericValue = Number(value);

    return (
      value !== "" &&
      value !== undefined &&
      Number.isInteger(numericValue) &&
      (question.min === undefined || numericValue >= question.min) &&
      (question.max === undefined || numericValue <= question.max)
    );
  }

  if (question.type === "likert_group") {
    return question.items.every((item) => Boolean(value?.[item.id]));
  }

  return Boolean(value);
}

function hasRequiredOtherText(question, value, otherText) {
  if (!shouldShowOtherText(question, value)) {
    return true;
  }

  return Boolean(otherText[question.id]?.trim());
}

function shouldShowOtherText(question, value) {
  if (!question.allowOtherTextFor) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.includes(question.allowOtherTextFor);
  }

  return value === question.allowOtherTextFor;
}

function validateQuestions(questions, answers, otherText) {
  return questions.reduce((nextErrors, question) => {
    if (!isQuestionAnswered(question, answers, otherText)) {
      nextErrors[question.id] = getValidationMessage(question, answers);
    }

    return nextErrors;
  }, {});
}

function getValidationMessage(question, answers) {
  if (shouldShowOtherText(question, answers[question.id])) {
    return "Please add a short description.";
  }

  if (question.type === "multi_choice") {
    return "Please select at least one option.";
  }

  if (question.type === "likert_group") {
    return "Please answer every statement in this group.";
  }

  if (question.type === "number") {
    return `Please enter a whole number${question.min ? ` of at least ${question.min}` : ""}.`;
  }

  return "Please choose an option.";
}

function focusFirstInvalidQuestion(errors) {
  const firstQuestionId = Object.keys(errors)[0];

  window.requestAnimationFrame(() => {
    const field = document.querySelector(`[data-question-id="${firstQuestionId}"]`);
    field?.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    field?.querySelector("input, button, select, textarea")?.focus();
  });
}

function getQuestionOptions(question, questionnaire) {
  if (question.optionsRef) {
    return questionnaire[question.optionsRef] || [];
  }

  return question.options || [];
}

function buildAnswerRecords(questions, answers, otherText, questionnaire) {
  return questions.map((question) => {
    const value = answers[question.id];

    return {
      questionId: question.id,
      exportTag: question.exportTag,
      type: question.type,
      prompt: question.prompt,
      value,
      otherText: shouldShowOtherText(question, value)
        ? otherText[question.id] || ""
        : "",
      labels: getAnswerLabels(question, value, questionnaire),
      ...(question.attentionCheckExpectedValue
        ? {
            metadata: {
              expectedValue: question.attentionCheckExpectedValue,
              passed: value === question.attentionCheckExpectedValue
            }
          }
        : {})
    };
  });
}

function getAnswerLabels(question, value, questionnaire) {
  const options = getQuestionOptions(question, questionnaire);

  if (question.type === "likert_group") {
    return question.items.map((item) => ({
      itemId: item.id,
      itemText: item.text,
      value: value?.[item.id] || "",
      label:
        options.find((option) => option.value === value?.[item.id])?.label || ""
    }));
  }

  if (Array.isArray(value)) {
    return value.map(
      (selectedValue) =>
        options.find((option) => option.value === selectedValue)?.label ||
        selectedValue
    );
  }

  return options.find((option) => option.value === value)?.label || value || "";
}
