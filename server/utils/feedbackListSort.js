// Reihenfolge der Feedback-Liste (GET /api/workouts/feedbacks, "Feedback-Verlauf" in den Stats).
//
// Absprache Jimmy 23.11.: Ausstehende Einträge (zurückgestellt oder "wird erstellt") stehen NICHT mehr ganz oben, sondern werden
// ganz normal eingereiht. Sie haben noch kein ai_generated_at; für die Einordnung zählt dann das Datum des Workouts. Bei fertigem
// Feedback zählt wie bisher der Zeitpunkt der Erzeugung. Gleichstand: neueres Workout zuerst.
export const FEEDBACK_LIST_SORT_STAGES = Object.freeze([
  { $addFields: { _sortAt: { $ifNull: ['$ai_generated_at', '$date'] } } },
  { $sort: { _sortAt: -1, date: -1 } }
]);
