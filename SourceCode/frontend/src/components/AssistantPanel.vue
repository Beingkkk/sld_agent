<template>
  <aside class="assistant-panel">
    <div class="panel-header">
      <div class="panel-title">
        <h2>智能助手</h2>
        <span>Natural Language Interface</span>
      </div>
      <div class="panel-tools">
        <button class="icon-btn" title="清空对话" @click="clearChat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="chat-messages" ref="historyRef">
      <div v-if="!store.chatHistory.length" class="chat-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h3>描述你的地图样式</h3>
        <p>用自然语言生成样式初稿；细节调整请用右侧「规则列表」+「参数精修」面板，精确控制颜色、线宽、Filter 等参数。</p>
      </div>

      <div
        v-for="(msg, idx) in store.chatHistory"
        :key="idx"
        :class="['message', msg.role]"
      >
        <div class="message-meta">{{ msg.role === 'assistant' ? 'SLDAgent' : '用户' }}</div>
        <div class="message-bubble">{{ msg.content }}</div>
      </div>

      <div v-if="store.busy" class="typing">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="suggestion-group">
        <button class="suggestion-chip" @click="sendPreset('用蓝色虚线样式渲染道路图层')">蓝色虚线道路</button>
        <button class="suggestion-chip" @click="sendPreset('为土地利用图层做分级设色，使用绿-黄-棕配色')">土地利用分级</button>
        <button class="suggestion-chip" @click="sendPreset('给城市 POI 添加红色圆点标记，半径随等级变化')">POI 分级标记</button>
      </div>
      <div class="chat-input-wrapper">
        <textarea
          v-model="instruction"
          class="chat-input"
          rows="1"
          placeholder="输入样式需求，例如：把河流改成 2px 的深蓝色实线..."
          :disabled="store.busy"
          @keydown.enter="onEnter"
          @input="autoResize"
        />
        <button class="send-btn" @click="send" :disabled="store.busy || !instruction.trim()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="input-hint">Enter 发送 · Shift+Enter 换行 · 支持多轮修改</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useStyleStore } from '../stores/styleStore';

const store = useStyleStore();
const instruction = ref('');
const historyRef = ref<HTMLDivElement | null>(null);

function autoResize(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function detectGeometryType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('道路') || t.includes('road') || t.includes('河流') || t.includes('river') || t.includes('线')) return 'line';
  if (t.includes('土地利用') || t.includes('landuse') || t.includes('面') || t.includes('polygon')) return 'polygon';
  if (t.includes('poi') || t.includes('标记') || t.includes('点') || t.includes('point')) return 'point';
  return 'line';
}

async function send() {
  const text = instruction.value.trim();
  if (!text || store.busy) return;
  instruction.value = '';
  resetTextarea();

  if (store.currentStyle) {
    await store.modify(text);
  } else {
    await store.generate(text, detectGeometryType(text));
  }
}

function onEnter(event: KeyboardEvent) {
  if (event.shiftKey) return;
  event.preventDefault();
  send();
}

function sendPreset(text: string) {
  instruction.value = text;
  send();
}

function resetTextarea() {
  nextTick(() => {
    const el = historyRef.value?.querySelector('.chat-input') as HTMLTextAreaElement | null;
    if (el) {
      el.style.height = 'auto';
    }
  });
}

function clearChat() {
  store.clearChat();
}

watch(() => store.chatHistory.length, async () => {
  await nextTick();
  if (historyRef.value) {
    historyRef.value.scrollTop = historyRef.value.scrollHeight;
  }
});
</script>

<style scoped>
.assistant-panel {
  background: var(--panel-left);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
}

.panel-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.panel-title h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.panel-title span {
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.panel-tools {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--dim);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--elevated);
  border-color: var(--border);
  color: var(--text);
}

.icon-btn svg {
  width: 14px;
  height: 14px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  max-width: 92%;
  animation: messageIn 0.35s ease forwards;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.assistant {
  align-self: flex-start;
}

.message.user {
  align-self: flex-end;
}

.message-bubble {
  padding: 14px 16px;
  border-radius: var(--radius);
  font-size: 12.5px;
  line-height: 1.65;
}

.message.assistant .message-bubble {
  background: var(--elevated);
  border: 1px solid var(--border);
  color: var(--text);
  border-top-left-radius: 2px;
}

.message.user .message-bubble {
  background: var(--accent-dim);
  border: 1px solid var(--border-strong);
  color: var(--accent);
  border-top-right-radius: 2px;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.message.assistant .message-meta {
  color: var(--accent);
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--dim);
}

.chat-empty svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: var(--border-strong);
}

.chat-empty h3 {
  margin: 0 0 8px;
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--text);
}

.chat-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  align-self: flex-start;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: typingBounce 1.2s ease infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.chat-input-area {
  padding: 16px 20px 20px;
  border-top: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
}

.suggestion-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.suggestion-chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.suggestion-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.chat-input-wrapper {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 10px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chat-input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  resize: none;
  outline: none;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  max-height: 120px;
  min-height: 24px;
}

.chat-input::placeholder {
  color: var(--dim);
}

.send-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  border: none;
  color: var(--bg);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 16px var(--accent-glow);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn svg {
  width: 16px;
  height: 16px;
}

.input-hint {
  margin-top: 10px;
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.04em;
}
</style>
