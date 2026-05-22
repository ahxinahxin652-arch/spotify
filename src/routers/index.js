import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/warehouse/:id',
    name: 'MusicWareHouse',
    component: () => import('../views/MusicWareHouseView.vue'),
  },
  {
    path: '/unlock',
    name: 'MusicUnlock',
    component: () => import('../views/MusicUnlockView.vue'),
  },
  {
    path: '/converter',
    name: 'MusicConverter',
    component: () => import('../views/MusicConverterView.vue'),
  },
  {
    path: '/edit',
    name: 'MusicEdit',
    component: () => import('../views/MusicEditView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router