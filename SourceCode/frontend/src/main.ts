import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';
import { connectWebSocket } from './ws/client';
import { useSLDStore } from './store';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const store = useSLDStore();
store.setBackendStatus('connecting');

connectWebSocket((connected) => {
  store.setBackendStatus(connected ? 'connected' : 'error');
});

app.mount('#app');
