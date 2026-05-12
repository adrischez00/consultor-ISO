import { normalizeOptions } from "../utils/diagnostic";

function QuestionCard({ question, selectedValue, savingState, disabled, onSelectOption }) {
  const questionId = String(question.id);
  const options = normalizeOptions(question.options_json);
  const isSaving = savingState === "saving";

  return (
    <article className="question-card premium">
      <div className="question-meta">
        <span>{question.code}</span>
        <span>{question.question_type}</span>
        <span>Peso {question.weight ?? "-"}</span>
      </div>
      <p className="question-text">{question.question_text}</p>
      {question.help_text ? <p className="question-help">{question.help_text}</p> : null}

      {options.length > 0 ? (
        <div className="answer-options">
          {options.map((option) => {
            const optionValue = String(option.value);
            const isSelected = selectedValue === optionValue;

            return (
              <button
                key={`${questionId}-${optionValue}`}
                type="button" className={isSelected ? "answer-option selected" : "answer-option"}
                onClick={() => onSelectOption(questionId, optionValue)}
                disabled={disabled || isSaving}
              >
                <span>{option.label}</span>
                {isSelected ? <strong>Seleccionada</strong> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="question-help">Esta pregunta no tiene opciones configuradas.</p>
      )}
      {savingState === "saving" ? <p className="save-state">Guardando respuesta...</p> : null}
      {savingState === "saved" ? <p className="save-state ok">Respuesta guardada.</p> : null}
      {savingState === "error" ? <p className="save-state error">No se pudo guardar.</p> : null}
    </article>
  );
}

export default QuestionCard;
