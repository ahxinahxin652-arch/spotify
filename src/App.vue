<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSidebarStore } from './stores/sidebar'
import { useLocalStorageStore } from './stores/localStorage'
import FootBar from './components/FootBar.vue'
import RightSideBar from './components/RightSideBar.vue'

const router = useRouter()
const sidebarStore = useSidebarStore()
const localStorageStore = useLocalStorageStore()
const isMaximized = ref(false)
const sidebarTransition = ref(null)

onMounted(() => {
  window.electronAPI.onWindowMaximized((val) => {
    isMaximized.value = val
  })

  // 根据 localStorage 恢复右侧边栏状态
  sidebarStore.setOpen(localStorageStore.isRightBarShow)
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

// 切换右侧边栏（动画期间禁止重复点击）
function toggleRightSidebar() {
  if (sidebarStore.isAnimating) return
  const newVal = !sidebarStore.isOpen
  sidebarStore.setOpen(newVal)
  localStorageStore.setRightBarShow(newVal)
}

// 动画钩子：标记动画开始/结束
function onSidebarBeforeEnter() {
  sidebarStore.startAnimation()
}
function onSidebarAfterEnter() {
  sidebarStore.endAnimation()
}
function onSidebarBeforeLeave() {
  sidebarStore.startAnimation()
}
function onSidebarAfterLeave() {
  sidebarStore.endAnimation()
}
</script>

<template>
  <div v-if="currentRoute === 'LyricsWidget'" style="width: 100%; height: 100%;">
    <router-view />
  </div>
  <div v-else class="app">
    <!-- ===== 自定义标题栏 ===== -->
    <header class="titlebar" @dblclick="handleMaximize">
      <!-- Logo -->
      <div>
        Satisfy
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
          :class="{ active: currentRoute === 'LyricsUnlock' }"
          @click="router.push('/lyrics-unlock')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M8 10h8"/>
            <path d="M8 14h4"/>
          </svg>
          解密歌词
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
        <button
          class="nav-btn"
          :class="{ active: currentRoute === 'MusicEdit' }"
          @click="router.push('/edit')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑歌曲
        </button>
      </nav>

      <!-- 交通灯按钮 -->
      <div class="traffic-lights">
        <button class="traffic-btn minimize" @click.stop="handleMinimize" title="最小化">
          <svg width="10" height="10" viewView="0 0 10 10">
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

    <!-- ===== 主内容区 ===== -->
    <div class="app-body">
      <!-- 中心区域：路由视图，可滚动 -->
      <main class="main-view">
        <router-view />
      </main>

      <!-- 右侧侧栏：滑出式 Spotify 风格面板 -->
      <Transition
        name="sidebar-slide"
        @before-enter="onSidebarBeforeEnter"
        @after-enter="onSidebarAfterEnter"
        @before-leave="onSidebarBeforeLeave"
        @after-leave="onSidebarAfterLeave"
      >
        <aside
          class="right-sidebar-wrapper"
          v-show="sidebarStore.isOpen"
          @click.stop
        >
          <RightSideBar />
        </aside>
      </Transition>
    </div>

    <!-- ===== 底部播放条 ===== -->
    <FootBar @toggle-right-sidebar="toggleRightSidebar" />
  </div>
</template>