import { questionnaireScopes } from "../experiment/questionnaires.js";

export default function QuestionnairePage() {
  return (
    <section>
      <h2>Questionnaires</h2>
      <ul className="placeholder-list">
        {questionnaireScopes.map((scope) => (
          <li key={scope.id}>{scope.label}</li>
        ))}
      </ul>
    </section>
  );
}
