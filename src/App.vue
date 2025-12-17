<template>
  <div class="relative w-screen h-screen overflow-hidden bg-tech-bg">
    <MapCanvas />
    <div class="absolute inset-0 pointer-events-none flex flex-col p-6">
      <HeaderBar />
      <main class="flex-1 flex justify-between mt-6 relative min-h-0">
        <ControlPanel />
        <MonitorPanel />
      </main>
      <footer class="h-48 mt-4 shrink-0">
        <AnalysisChart />
      </footer>
    </div>
  </div>
</template>
<script setup>
import MapCanvas from './components/MapCanvas.vue';
import HeaderBar from './components/HeaderBar.vue';
import ControlPanel from './components/ControlPanel.vue';
import MonitorPanel from './components/MonitorPanel.vue';
import AnalysisChart from './components/AnalysisChart.vue';
</script>