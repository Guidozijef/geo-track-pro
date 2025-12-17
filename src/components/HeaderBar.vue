<template>
  <header class="flex justify-between items-center pointer-events-auto z-50">
    <div class="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4">
      <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
        <i class="fa-solid fa-route text-xl text-white"></i>
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-wide">
          GeoTrack Pro 
          <span class="text-xs font-normal text-blue-300 ml-2 hidden sm:inline">城市配送路径几何偏航检测系统</span>
        </h1>
        <div class="flex gap-3 text-xs text-slate-400">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span> Turf.js 引擎就绪</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> 缓冲区分析模式</span>
        </div>
      </div>
    </div>
    <div class="glass-panel px-4 py-2 rounded-xl text-sm font-mono text-blue-200">{{ currentTime }}</div>
  </header>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
const currentTime = ref('');
let timer;
onMounted(() => {
  const updateTime = () => currentTime.value = new Date().toLocaleTimeString();
  updateTime();
  timer = setInterval(updateTime, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>