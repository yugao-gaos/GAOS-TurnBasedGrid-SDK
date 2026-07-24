<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { createRng, wait } from './game-utils';

type Swap = { a: number; b: number; value: number };

const width = 7;
const height = 7;
const gemNames = ['Ember', 'Tide', 'Bloom', 'Sun', 'Void', 'Frost'];
const seed = ref(2407);
const board = ref<number[]>([]);
const score = ref(0);
const moves = ref(18);
const target = 1800;
const selected = ref<number | null>(null);
const clearing = ref(new Set<number>());
const locked = ref(false);
const agentPlaying = ref(false);
const message = ref('Make a line of three or more.');
const decision = ref('Waiting for your move');
const combo = ref(0);
let random = createRng(seed.value);
let runToken = 0;

const progress = computed(() => Math.min(100, Math.round((score.value / target) * 100)));
const stateLabel = computed(() => {
  if (score.value >= target) return 'Vault opened';
  if (moves.value <= 0) return 'Run complete';
  return agentPlaying.value ? 'Agent playing' : 'Your turn';
});

function cellRow(index: number) {
  return Math.floor(index / width);
}

function adjacent(a: number, b: number) {
  return Math.abs(cellRow(a) - cellRow(b)) + Math.abs((a % width) - (b % width)) === 1;
}

function swapCells(values: number[], a: number, b: number) {
  [values[a], values[b]] = [values[b], values[a]];
}

function matches(values: number[]) {
  const found = new Set<number>();
  for (let y = 0; y < height; y += 1) {
    let start = 0;
    for (let x = 1; x <= width; x += 1) {
      const changed = x === width || values[y * width + x] !== values[y * width + start];
      if (changed) {
        if (x - start >= 3) {
          for (let at = start; at < x; at += 1) found.add(y * width + at);
        }
        start = x;
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let start = 0;
    for (let y = 1; y <= height; y += 1) {
      const changed = y === height || values[y * width + x] !== values[start * width + x];
      if (changed) {
        if (y - start >= 3) {
          for (let at = start; at < y; at += 1) found.add(at * width + x);
        }
        start = y;
      }
    }
  }
  return found;
}

function legalSwaps(values = board.value): Swap[] {
  const options: Swap[] = [];
  for (let index = 0; index < values.length; index += 1) {
    for (const next of [index + 1, index + width]) {
      if (next >= values.length || (next === index + 1 && cellRow(next) !== cellRow(index))) continue;
      const copy = [...values];
      swapCells(copy, index, next);
      const made = matches(copy);
      if (made.size) {
        const rareBonus = [...made].filter((cell) => copy[cell] === 4).length * 4;
        options.push({ a: index, b: next, value: made.size * 10 + rareBonus });
      }
    }
  }
  return options.sort((a, b) => b.value - a.value || a.a - b.a);
}

function makeBoard() {
  const values: number[] = [];
  for (let index = 0; index < width * height; index += 1) {
    let gem = Math.floor(random() * gemNames.length);
    const x = index % width;
    const y = Math.floor(index / width);
    while (
      (x >= 2 && values[index - 1] === gem && values[index - 2] === gem)
      || (y >= 2 && values[index - width] === gem && values[index - width * 2] === gem)
    ) gem = (gem + 1) % gemNames.length;
    values.push(gem);
  }
  if (!legalSwaps(values).length) {
    values[0] = 0;
    values[1] = 1;
    values[2] = 0;
    values[width + 1] = 0;
  }
  return values;
}

function reset() {
  runToken += 1;
  agentPlaying.value = false;
  random = createRng(seed.value);
  board.value = makeBoard();
  score.value = 0;
  moves.value = 18;
  selected.value = null;
  clearing.value = new Set();
  combo.value = 0;
  locked.value = false;
  message.value = 'Make a line of three or more.';
  decision.value = 'Waiting for your move';
}

async function resolveBoard(token: number) {
  combo.value = 0;
  let found = matches(board.value);
  while (found.size && token === runToken) {
    combo.value += 1;
    clearing.value = found;
    const gained = found.size * 10 * combo.value;
    score.value += gained;
    message.value = combo.value > 1 ? `Cascade ×${combo.value} · +${gained}` : `Match · +${gained}`;
    await wait(180);
    if (token !== runToken) return;

    const next = [...board.value];
    for (const index of found) next[index] = -1;
    for (let x = 0; x < width; x += 1) {
      const column = [];
      for (let y = height - 1; y >= 0; y -= 1) {
        const value = next[y * width + x];
        if (value >= 0) column.push(value);
      }
      while (column.length < height) column.push(Math.floor(random() * gemNames.length));
      for (let y = height - 1; y >= 0; y -= 1) next[y * width + x] = column[height - 1 - y];
    }
    board.value = next;
    clearing.value = new Set();
    await wait(180);
    found = matches(board.value);
  }
}

async function playSwap(a: number, b: number, actor: 'human' | 'agent') {
  if (locked.value || moves.value <= 0 || score.value >= target) return;
  locked.value = true;
  selected.value = null;
  const token = runToken;
  const next = [...board.value];
  swapCells(next, a, b);
  board.value = next;
  await wait(120);
  const found = matches(board.value);
  if (!found.size) {
    const reverted = [...board.value];
    swapCells(reverted, a, b);
    board.value = reverted;
    message.value = 'That swap makes no match.';
    decision.value = actor === 'human' ? 'Illegal action rejected' : decision.value;
    locked.value = false;
    return;
  }
  moves.value -= 1;
  await resolveBoard(token);
  if (token !== runToken) return;
  if (score.value >= target) message.value = 'Vault opened — run won!';
  else if (moves.value <= 0) message.value = `Run over · ${score.value} points`;
  else if (!agentPlaying.value) message.value = 'Your move.';
  locked.value = false;
}

function chooseCell(index: number) {
  if (locked.value || agentPlaying.value) return;
  if (selected.value === null) {
    selected.value = index;
    message.value = 'Choose an adjacent gem.';
    return;
  }
  if (selected.value === index) {
    selected.value = null;
    return;
  }
  if (!adjacent(selected.value, index)) {
    selected.value = index;
    message.value = 'Choose an adjacent gem.';
    return;
  }
  void playSwap(selected.value, index, 'human');
}

async function agentStep() {
  if (locked.value || moves.value <= 0 || score.value >= target) return;
  const options = legalSwaps();
  if (!options.length) {
    decision.value = 'No legal swaps · reshuffling';
    seed.value += 1;
    reset();
    return;
  }
  const best = options[0];
  selected.value = best.a;
  decision.value = `${options.length} legal swaps · chose +${best.value} immediate value`;
  message.value = `Agent targets ${gemNames[board.value[best.a]]}`;
  await wait(300);
  await playSwap(best.a, best.b, 'agent');
}

async function toggleAgent() {
  agentPlaying.value = !agentPlaying.value;
  const token = runToken;
  while (agentPlaying.value && token === runToken && moves.value > 0 && score.value < target) {
    await agentStep();
    await wait(420);
  }
  if (token === runToken) agentPlaying.value = false;
}

onUnmounted(() => {
  runToken += 1;
});

reset();
</script>

<template>
  <section class="game-demo game-demo--match">
    <header class="game-hero">
      <div>
        <span class="game-eyebrow">Playable system demo · deterministic seed {{ seed }}</span>
        <h2>Prism Vault</h2>
        <p>Chain elemental matches before the vault seals. Play it yourself or let the search agent take the board.</p>
      </div>
      <div class="game-status-pill" :data-active="agentPlaying">{{ stateLabel }}</div>
    </header>

    <div class="game-layout">
      <div class="game-stage">
        <div class="match-hud">
          <div><span>Score</span><strong>{{ score.toLocaleString() }}</strong></div>
          <div><span>Moves</span><strong>{{ moves }}</strong></div>
          <div><span>Target</span><strong>{{ target.toLocaleString() }}</strong></div>
        </div>
        <div class="goal-track" aria-label="Score progress">
          <div :style="{ width: `${progress}%` }"></div>
        </div>
        <div class="match-board" :aria-busy="locked">
          <button
            v-for="(gem, index) in board"
            :key="index"
            class="gem-cell"
            :class="[`gem-${gem}`, { selected: selected === index, clearing: clearing.has(index) }]"
            :aria-label="`${gemNames[gem]} gem, row ${cellRow(index) + 1}, column ${(index % width) + 1}`"
            :disabled="locked || agentPlaying || moves <= 0 || score >= target"
            @click="chooseCell(index)"
          >
            <span class="gem-shape"></span>
          </button>
        </div>
        <div class="game-message">{{ message }}</div>
      </div>

      <aside class="agent-console">
        <div class="agent-console__head">
          <span class="agent-orb" :class="{ thinking: agentPlaying || locked }"></span>
          <div><strong>Search agent</strong><small>One-ply value + cascade resolution</small></div>
        </div>
        <div class="agent-decision">
          <span>Latest decision</span>
          <p>{{ decision }}</p>
        </div>
        <div class="agent-metrics">
          <div><span>Legal actions</span><strong>{{ legalSwaps().length }}</strong></div>
          <div><span>Combo</span><strong>×{{ Math.max(1, combo) }}</strong></div>
          <div><span>Progress</span><strong>{{ progress }}%</strong></div>
        </div>
        <div class="game-actions">
          <button class="primary-action" :disabled="locked || moves <= 0 || score >= target" @click="toggleAgent">
            {{ agentPlaying ? 'Pause agent' : 'Watch agent' }}
          </button>
          <button :disabled="locked || agentPlaying || moves <= 0 || score >= target" @click="agentStep">Step once</button>
          <button @click="reset">Restart seed</button>
        </div>
        <label class="seed-control">
          <span>Seed</span>
          <input v-model.number="seed" type="number" min="1" @change="reset">
        </label>
      </aside>
    </div>
  </section>
</template>
