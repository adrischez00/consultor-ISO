import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import QuestionCard from "../components/QuestionCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import StepTabs from "../components/StepTabs";
import {
  evaluateDiagnostic,
  fetchDiagnostic,
  fetchDiagnosticAnswers,
  upsertAnswer,
} from "../api/diagnosticsApi";
import { fetchQuestions } from "../api/questionsApi";
import { useDiagnostic } from "../context/DiagnosticContext";
import {
  buildAnswerMap,
  compareClauses,
  formatDiagnosticStatus,
  groupByClause,
} from "../utils/diagnostic";
import { normalizeUuidOrNull } from "../utils/uuid";

function DiagnosticWizardPage() {
  const { id } = useParams();
  const diagnosticId = normalizeUuidOrNull(id);
  const navigate = useNavigate();
  const { setDiagnosticId } = useDiagnostic();

  const [questions, setQuestions] = useState([]);
  const [answersByQuestion, setAnswersByQuestion] = useState({});
  const [questionStateById, setQuestionStateById] = useState({});
  const [diagnosticMeta, setDiagnosticMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [activeClauseIndex, setActiveClauseIndex] = useState(0);
  const saveFeedbackTimersRef = useRef({});
  const resultPath = diagnosticId ? `/diagnosticos/${diagnosticId}/resultado` : "/diagnosticos";

  useEffect(() => {
    if (diagnosticId) {
      setDiagnosticId(diagnosticId);
    }
  }, [diagnosticId, setDiagnosticId]);

  function clearSaveFeedbackTimer(questionId) {
    const timerId = saveFeedbackTimersRef.current[questionId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete saveFeedbackTimersRef.current[questionId];
    }
  }

  function setQuestionSaveState(questionId, state) {
    clearSaveFeedbackTimer(questionId);
    setQuestionStateById((prev) => ({ ...prev, [questionId]: state }));

    if (state === "saved") {
      saveFeedbackTimersRef.current[questionId] = window.setTimeout(() => {
        setQuestionStateById((prev) => {
          if (prev[questionId] !== "saved") return prev;
          return { ...prev, [questionId]: "idle" };
        });
        delete saveFeedbackTimersRef.current[questionId];
      }, 1600);
    }
  }

  useEffect(() => {
    return () => {
      Object.values(saveFeedbackTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      saveFeedbackTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWizardData() {
      if (!diagnosticId) {
        setError("ID de diagnóstico inválido.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [diagnostic, loadedQuestions, loadedAnswers] = await Promise.all([
          fetchDiagnostic(diagnosticId),
          fetchQuestions(),
          fetchDiagnosticAnswers(diagnosticId),
        ]);

        if (!active) return;

        setDiagnosticMeta(diagnostic);
        setQuestions(Array.isArray(loadedQuestions) ? loadedQuestions : []);
        setAnswersByQuestion(buildAnswerMap(Array.isArray(loadedAnswers) ? loadedAnswers : []));
        setQuestionStateById({});
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el diagnóstico.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadWizardData();
    return () => {
      active = false;
    };
  }, [diagnosticId]);

  const groupedQuestions = useMemo(() => groupByClause(questions), [questions]);
  const clauses = useMemo(() => Object.keys(groupedQuestions).sort(compareClauses), [groupedQuestions]);
  const answeredCount = Object.keys(answersByQuestion).length;

  const clauseItems = useMemo(
    () =>
      clauses.map((clause) => {
        const clauseQuestions = groupedQuestions[clause] || [];
        const answered = clauseQuestions.filter((question) => answersByQuestion[String(question.id)]).length;
        const total = clauseQuestions.length;
        const status = answered === 0 ? "draft" : answered === total ? "completed" : "in_progress";

        return {
          key: clause,
          label: `Cláusula ${clause}`,
          status,
          progressText: `${answered}/${total} respondidas`,
        };
      }),
    [clauses, groupedQuestions, answersByQuestion]
  );

  useEffect(() => {
    if (clauses.length === 0) {
      setActiveClauseIndex(0);
      return;
    }

    if (activeClauseIndex > clauses.length - 1) {
      setActiveClauseIndex(0);
      return;
    }

    const firstIncompleteIndex = clauseItems.findIndex((item) => item.status !== "completed");
    if (firstIncompleteIndex >= 0 && activeClauseIndex === 0) {
      setActiveClauseIndex(firstIncompleteIndex);
    }
  }, [clauses.length, activeClauseIndex, clauseItems]);

  const activeClause = clauses[activeClauseIndex] ?? null;
  const activeQuestions = activeClause ? groupedQuestions[activeClause] || [] : [];

  const hasPendingSaves = useMemo(
    () => Object.values(questionStateById).some((state) => state === "saving"),
    [questionStateById]
  );

  async function handleSelectOption(questionId, optionValue) {
    if (!diagnosticId) return;

    const questionIdKey = String(questionId);
    const answerValue = String(optionValue);
    const previousValue = answersByQuestion[questionIdKey];
    const saveState = questionStateById[questionIdKey];

    if (saveState === "saving" || previousValue === answerValue) {
      return;
    }

    setError("");
    setAnswersByQuestion((prev) => ({ ...prev, [questionIdKey]: answerValue }));
    setQuestionSaveState(questionIdKey, "saving");

    try {
      const savedAnswer = await upsertAnswer({
        diagnostic_id: diagnosticId,
        question_id: questionIdKey,
        answer_value: answerValue,
      });

      const savedValue = String(savedAnswer?.answer_value ?? answerValue);
      setAnswersByQuestion((prev) => ({ ...prev, [questionIdKey]: savedValue }));
      setDiagnosticMeta((prev) => ({ ...(prev ?? {}), id: diagnosticId, status: "in_progress" }));
      setQuestionSaveState(questionIdKey, "saved");
    } catch (err) {
      setAnswersByQuestion((prev) => {
        const next = { ...prev };
        if (previousValue == null) {
          delete next[questionIdKey];
        } else {
          next[questionIdKey] = previousValue;
        }
        return next;
      });
      setQuestionSaveState(questionIdKey, "error");
      setError(err instanceof Error ? err.message : "No se pudo guardar la respuesta.");
    }
  }

  async function handleFinalizeDiagnostic() {
    if (!diagnosticId || evaluating || hasPendingSaves) return;
    if (answeredCount === 0) {
      setError("Responde al menos una pregunta antes de finalizar.");
      return;
    }

    setEvaluating(true);
    setError("");
    try {
      await evaluateDiagnostic(diagnosticId);
      navigate(`/diagnosticos/${diagnosticId}/resultado`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo finalizar el diagnóstico.");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <section className="page">
      <PageHeader
        eyebrow="Wizard de Diagnóstico"
        title="Diagnóstico ISO 9001"
        description="Responde por cláusulas para mantener enfoque y trazabilidad de la evaluación."
        actions={
          <div className="inline-actions">
            <StatusBadge
              value={diagnosticMeta?.status || "draft"}
              label={formatDiagnosticStatus(diagnosticMeta?.status)}
            />
            <Link className="btn-ghost link-btn" to={resultPath}>
              Ver resultado
            </Link>
          </div>
        }
      />

      {loading ? <p className="status">Cargando diagnóstico...</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <SectionCard
            title="Navegación por cláusulas"
            description="Avanza por pasos y completa todas las preguntas necesarias."
          >
            <StepTabs
              items={clauseItems}
              activeIndex={activeClauseIndex}
              onChange={setActiveClauseIndex}
              ariaLabel="Navegación por cláusulas"
            />
          </SectionCard>

          <SectionCard
            title={activeClause ? `Cláusula ${activeClause}` : "Preguntas"}
            description={`${activeQuestions.length} preguntas en esta cláusula.`}
            actions={
              <div className="inline-actions">
                <span className="soft-label">{answeredCount} respuestas registradas</span>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleFinalizeDiagnostic}
                  disabled={evaluating || hasPendingSaves || !diagnosticId}
                >
                  {evaluating ? "Finalizando..." : "Finalizar diagnóstico"}
                </button>
              </div>
            }
          >
            {activeQuestions.length === 0 ? (
              <p className="empty-state">No hay preguntas para esta cláusula.</p>
            ) : (
              <div className="stack-list">
                {activeQuestions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    selectedValue={answersByQuestion[String(question.id)] ?? ""}
                    savingState={questionStateById[String(question.id)] ?? "idle"}
                    disabled={!diagnosticId}
                    onSelectOption={handleSelectOption}
                  />
                ))}
              </div>
            )}

            <div className="wizard-nav">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setActiveClauseIndex((prev) => Math.max(prev - 1, 0))}
                disabled={activeClauseIndex === 0}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setActiveClauseIndex((prev) => Math.min(prev + 1, clauses.length - 1))
                }
                disabled={clauses.length === 0 || activeClauseIndex >= clauses.length - 1}
              >
                Siguiente
              </button>
            </div>
          </SectionCard>
        </>
      ) : null}
    </section>
  );
}

export default DiagnosticWizardPage;
