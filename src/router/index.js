import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/contests',
    name: 'contests',
    // Lazy-loaded: only fetched when navigated to.
    component: () => import('../views/ContestsView.vue'),
  },
  {
    path: '/contests/:id',
    name: 'contest-detail',
    component: () => import('../views/ContestDetailView.vue'),
  },
  {
    path: '/contests/:id/leaderboard',
    name: 'contest-leaderboard',
    component: () => import('../views/LeaderboardView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/admin/requests',
    name: 'contest-requests',
    component: () => import('../views/ContestRequestsView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
