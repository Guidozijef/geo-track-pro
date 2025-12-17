<template>
  <div class="z-50 flex flex-col gap-4 pointer-events-auto w-80">
    <div class="p-5 glass-panel rounded-2xl">
      <h3 class="pb-2 mb-4 text-sm font-semibold border-b text-slate-300 border-slate-700">
        <i class="mr-2 fa-solid fa-sliders"></i>模拟控制
      </h3>
      <div class="mb-4">
        <label class="block mb-1 text-xs text-slate-400">演示场景</label>
        <select v-model="state.currentScenario" @change="onScenarioChange" class="w-full p-2 text-sm text-white transition border rounded-lg bg-slate-800 border-slate-600 focus:outline-none focus:border-blue-500">
          <option value="normal">场景1：正常行驶 (Normal)</option>
          <option value="deviate">场景2：突发偏航 (Deviation)</option>
        </select>
      </div>
      <div class="flex gap-2 mb-4">
        <button @click="play" class="flex-1 py-2 text-white transition bg-blue-600 rounded-lg shadow-lg hover:bg-blue-500 shadow-blue-900/50">
          <i class="fa-solid" :class="state.playing ? 'fa-pause' : 'fa-play'"></i>
        </button>
        <button @click="pause" class="flex-1 py-2 text-white transition rounded-lg bg-slate-700 hover:bg-slate-600">
          <i class="fa-solid fa-pause"></i>
        </button>
        <button @click="reset" class="flex-1 py-2 text-white transition rounded-lg bg-slate-700 hover:bg-slate-600">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      </div>
      <div class="mb-2">
        <div class="flex justify-between mb-1 text-xs text-slate-400">
          <span>倍速 x1</span>
          <span>x{{ state.speedMultiplier }}</span>
          <span>x5</span>
        </div>
        <input type="range" v-model.number="state.speedMultiplier" min="1" max="5" step="0.5" class="w-full h-1 rounded-lg appearance-none cursor-pointer bg-slate-700">
      </div>
    </div>
    <div class="p-5 glass-panel rounded-2xl">
      <h3 class="pb-2 mb-4 text-sm font-semibold border-b text-slate-300 border-slate-700">
        <i class="mr-2 fa-solid fa-microchip"></i>算法参数
      </h3>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400">缓冲区阈值 (Buffer)</span>
        <div class="flex items-center gap-2">
          <input type="number" v-model.number="state.threshold" class="w-12 text-sm text-center text-blue-300 border rounded bg-slate-800 border-slate-600">
          <span class="text-xs text-slate-500">m</span>
        </div>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs text-slate-400">检测频率</span>
        <span class="text-xs text-slate-200">1000 ms</span>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useSimulation } from '../composables/useSimulation';
const { state, play, pause, reset, plannedRoute } = useSimulation();
const onScenarioChange = () => {
  reset();
  // if we have a planned route, place the car at its start so UI shows initial state
  if (plannedRoute && plannedRoute.value && plannedRoute.value.length > 0) {
    const p = plannedRoute.value[0];
    state.currentCarPos = { x: p.x, y: p.y, angle: 0 };
  }
};
</script>