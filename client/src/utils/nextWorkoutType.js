// Welche Kachel (Push/Pull/Legs/Full Body) am Dashboard als nächstes dran ist: Push → Pull → Legs → Push.
// Nach Full Body oder ohne bisheriges Workout beginnt der Kreis wieder bei Push.
const ROTATION = { push: 'pull', pull: 'legs', legs: 'push' }

export function getNextWorkoutType(lastType) {
  return ROTATION[lastType] || 'push'
}
