import { createRouter, createWebHistory } from 'vue-router'
import WelcomeView from '../views/WelcomeView.vue'
import AuthLayout from '../layouts/AuthLayout.vue'
import DashboardView from '../views/DashboardView.vue'
import StatsView from '../views/StatsView.vue'
import ExercisesView from '../views/ExercisesView.vue'
import SettingsView from '../views/SettingsView.vue'
import WorkoutBuilder from '../components/WorkoutBuilder.vue'
import WorkoutDetailView from '../views/WorkoutDetailView.vue'

const routes = [
  {
    path: '/',
    name: 'welcome',
    component: WelcomeView,
    meta: { requiresAuth: false }
  },
  // Geschützte Routen unter AuthLayout, mit identischen (absoluten) Pfaden
  {
    path: '/',
    component: AuthLayout,
    children: [
      { path: 'dashboard', name: 'dashboard', component: DashboardView },
      { path: 'stats', name: 'stats', component: StatsView },
      { path: 'exercises', name: 'exercises', component: ExercisesView },
      { path: 'settings', name: 'settings', component: SettingsView },
      { path: 'workout-builder', name: 'workout-builder', component: WorkoutBuilder },
      { path: 'workouts/:id', name: 'workout-detail', component: WorkoutDetailView }
    ]
  },
  {
    path: '/plan',
    name: 'plan',
    // Weiterleitung zum Workout-Builder
    redirect: '/workout-builder'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Keine Guard-Logik: Auth wird vollständig im AuthLayout gehandhabt
router.beforeEach((to, from, next) => next())

export default router
