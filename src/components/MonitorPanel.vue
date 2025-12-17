<template>
  <div class="flex flex-col gap-4 w-96 pointer-events-auto z-50">
    <div class="glass-panel p-6 rounded-2xl relative overflow-hidden transition-all duration-300" :class="{ 'animate-pulse-alert': state.isDeviating }">
      <div class="absolute top-0 right-0 w-2 h-full transition-colors duration-300" :class="state.isDeviating ? 'bg-red-500' : 'bg-green-500'"></div>
      <h2 class="text-slate-400 text-sm uppercase tracking-wider mb-1">当前状态</h2>
      <div class="text-3xl font-bold text-white mb-4 flex items-center gap-3">
        <i v-if="state.isDeviating" class="fa-solid fa-triangle-exclamation text-red-500 animate-pulse"></i>
        <i v-else class="fa-solid fa-circle-check text-green-500"></i>
        <span>{{ state.isDeviating ? '严重偏航' : '正常行驶' }}</span>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5">
          <div class="text-xs text-slate-400 mb-1">实时偏离度</div>
          <div class="text-xl font-mono font-bold" :class="state.isDeviating ? 'text-red-400' : 'text-blue-400'">
            {{ state.deviationDistance.toFixed(1) }} <span class="text-xs text-slate-500">m</span>
          </div>
        </div>
        <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5">
          <div class="text-xs text-slate-400 mb-1">当前车速</div>
          <div class="text-xl font-mono font-bold text-white">
            {{ state.currentSpeed }} <span class="text-xs text-slate-500">km/h</span>
          </div>
        </div>
      </div>
    </div>
    <div class="glass-panel p-5 rounded-2xl flex-1 h-64 flex flex-col">
      <h3 class="text-sm font-semibold text-slate-300 mb-3 flex justify-between items-center">
        <span><i class="fa-solid fa-triangle-exclamation mr-2 text-yellow-500"></i>报警日志</span>
        <span class="bg-slate-700 text-xs px-2 py-0.5 rounded text-slate-300">{{ state.logs.length }}</span>
      </h3>
      <div class="overflow-y-auto flex-1 space-y-2 pr-2 custom-scroll">
        <div v-if="state.logs.length === 0" class="text-slate-500 text-center italic mt-10 text-xs">暂无报警记录</div>
        <div v-for="(log, idx) in state.logs" :key="idx" class="flex justify-between border-b border-white/5 pb-1 text-xs font-mono">
          <span class="opacity-60">{{ log.time }}</span> 
          <span :class="log.type === 'alert' ? 'text-red-400' : 'text-blue-400'">{{ log.msg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useSimulation } from '../composables/useSimulation';
const { state } = useSimulation();
</script>