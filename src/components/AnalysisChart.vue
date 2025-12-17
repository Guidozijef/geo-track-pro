<template>
  <div class="glass-panel p-4 rounded-2xl w-full h-full flex flex-col pointer-events-auto z-50">
    <div class="flex justify-between items-center mb-2">
      <h3 class="text-xs font-bold text-slate-400 uppercase">偏离距离时序分析 (Deviation Analysis)</h3>
      <div class="flex items-center gap-4 text-xs">
           <div class="flex items-center gap-1"><span class="w-3 h-1 bg-blue-500"></span> 实际距离</div>
           <div class="flex items-center gap-1"><span class="w-3 h-1 border-t border-dashed border-red-500"></span> 报警阈值</div>
      </div>
    </div>
    <div ref="chartRef" class="w-full flex-1 min-h-0"></div>
  </div>
</template>
<script setup>
import { ref, onMounted, watch } from 'vue';
import * as echarts from 'echarts';
import { useSimulation } from '../composables/useSimulation';

const { state } = useSimulation();
const chartRef = ref(null);
let chartInstance = null;
const chartData = { time: [], value: [] };

const updateChart = () => {
  if (!chartInstance) return;
  const nowStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
  if (chartData.time.length > 50) { chartData.time.shift(); chartData.value.shift(); }
  chartData.time.push(nowStr);
  chartData.value.push(state.deviationDistance);

  chartInstance.setOption({
    series: [{ data: chartData.value, markLine: { data: [{ yAxis: state.threshold }] } }],
    xAxis: { data: chartData.time }
  });
};

onMounted(() => {
  chartInstance = echarts.init(chartRef.value);
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 10, right: 10, bottom: 20, left: 40, containLabel: false },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false, data: [], axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
    series: [{
      data: [], type: 'line', smooth: true, symbol: 'none', lineStyle: { color: '#3b82f6', width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59, 130, 246, 0.3)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]) },
      markLine: { symbol: 'none', silent: true, data: [{ yAxis: 30, lineStyle: { color: '#ef4444', type: 'dashed' } }] }
    }]
  };
  chartInstance.setOption(option);
  window.addEventListener('resize', () => chartInstance.resize());
});

watch(() => state.progress, () => { if(state.playing) updateChart(); });
watch(() => state.threshold, (val) => { if(chartInstance) { chartInstance.setOption({ series: [{ markLine: { data: [{ yAxis: val }] } }] }); } });
</script>