<template>
  <div class="assistant-panel">
    <div class="chat-history" ref="historyRef">
      <div
        v-for="(msg, idx) in store.chatHistory"
        :key="idx"
        :class="['message', msg.role]"
      >
        {{ msg.content }}
      </div>
    </div>
    <div class="input-area">
      <select v-model="geometryType">
        <option value="point">点</option>
        <option value="line">线</option>
        <option value="polygon">面</option>
      </select>
      <input
        v-model="instruction"
        @keydown.enter="send"
        placeholder="描述你想要的样式..."
        :disabled="store.busy"
      />
      <button @click="send" :disabled="store.busy || !instruction">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStyleStore } from '../stores/styleStore';

const store = useStyleStore();
const instruction = ref('');
const geometryType = ref('point');

async function send() {
  if (!instruction.value || store.busy) return;
  await store.generate(instruction.value, geometryType.value);
  instruction.value = '';
}
</script>

<style scoped>
.assistant-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.message {
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.message.user {
  background: #2a2a4a;
  align-self: flex-end;
}

.message.assistant {
  background: #2d2d44;
}

.input-area {
  padding: 12px;
  border-top: 1px solid #333;
  display: flex;
  gap: 8px;
}

.input-area input {
  flex: 1;
  background: #252538;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 6px 10px;
  border-radius: 4px;
}
</style>
