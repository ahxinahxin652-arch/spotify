<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import FootBar from './components/FootBar.vue'

const router = useRouter()
const isMaximized = ref(false)

onMounted(() => {
  window.electronAPI.onWindowMaximized((val) => {
    isMaximized.value = val
  })
})

function handleMinimize() {
  window.electronAPI.minimizeWindow()
}

function handleMaximize() {
  window.electronAPI.maximizeWindow()
}

function handleClose() {
  window.electronAPI.closeWindow()
}

const currentRoute = ref(router.currentRoute.value.name)
router.afterEach((to) => {
  currentRoute.value = to.name
})
</script>

<template>
  <div class="app">
    <!-- ===== 自定义标题栏 ===== -->
    <header class="titlebar" @dblclick="handleMaximize">
      <!-- Logo -->
      <div>
        Spotify
      </div>

      <!-- 主导航 -->
      <nav class="main-nav">
        <button
          class="nav-btn"
          :class="{ active: currentRoute === 'Home' }"
          @click="router.push('/')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          主页
        </button>
        <button
          class="nav-btn"
          :class="{ active: currentRoute === 'MusicUnlock' }"
          @click="router.push('/unlock')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          解密音乐
        </button>
        <button
          class="nav-btn"
          :class="{ active: currentRoute === 'MusicConverter' }"
          @click="router.push('/converter')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
          </svg>
          格式转换
        </button>
      </nav>

      <!-- 交通灯按钮 -->
      <div class="traffic-lights">
        <button class="traffic-btn minimize" @click.stop="handleMinimize" title="最小化">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 5h8" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="traffic-btn maximize" @click.stop="handleMaximize" title="最大化">
          <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
            <rect x="1.5" y="1.5" width="7" height="7" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" fill="none" rx="0.5"/>
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <rect x="2.5" y="2.5" width="5" height="5" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" fill="none" rx="0.5"/>
            <path d="M1.5 4.5h3v3.5h-3.5v-3z" stroke="rgba(0,0,0,0.5)" stroke-width="1.1" fill="none" rx="0.3"/>
          </svg>
        </button>
        <button class="traffic-btn close" @click.stop="handleClose" title="关闭">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

    </header>

    <!-- ===== 路由视图 ===== -->
    <main class="main-view">
      <router-view />
    </main>

    <!-- ===== 底部播放条 ===== -->
    <FootBar />
  </div>
</template>