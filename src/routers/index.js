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
    path: '/lyrics-unlock',
    name: 'LyricsUnlock',
    component: () => import('../views/LyricsUnlockView.vue'),
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
  {
    path: '/lyrics-widget',
    name: 'LyricsWidget',
    component: () => import('../components/LyricsWidget.vue'),
  },
  {
    path: '/artist/:id',
    name: 'ArtistDetail',
    component: () => import('../views/ArtistDetailView.vue'),
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router