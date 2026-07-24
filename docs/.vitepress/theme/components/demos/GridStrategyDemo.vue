<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { createRng, manhattan, wait, type Point } from './game-utils';

type Side = 'ember' | 'hollow';
type Unit = Point & {
  id: string;
  side: Side;
  role: 'Vanguard' | 'Ranger' | 'Warden';
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  move: number;
};
type Action =
  | { kind: 'attack'; unitId: string; targetId: string; value: number }
  | { kind: 'move'; unitId: string; to: Point; value: number };

const size = 7;
const seed = ref(903);
const units = ref<Unit[]>([]);
const blocked = ref(new Set<number>());
const activeSide = ref<Side>('ember');
const selected = ref<string | null>(null);
const locked = ref(false);
const autoplay = ref(false);
const turn = ref(1);
const message = ref('Select an Ember unit.');
const decision = ref('Waiting for your command');
const lastAction = ref('Battle initialized');
let runToken = 0;

const emberUnits = computed(() => units.value.filter((unit) => unit.side === 'ember'));
const hollowUnits = computed(() => units.value.filter((unit) => unit.side === 'hollow'));
const winner = computed<Side | null>(() => {
  if (!emberUnits.value.length) return 'hollow';
  if (!hollowUnits.value.length) return 'ember';
  return null;
});
const activeUnit = computed(() => units.value.find((unit) => unit.id === selected.value) ?? null);
const activeActions = computed(() => legalActions(activeSide.value));

function indexAt(x: number, y: number) {
  return y * size + x;
}

function unitAt(x: number, y: number) {
  return units.value.find((unit) => unit.x === x && unit.y === y);
}

function roleMark(role: Unit['role']) {
  return role === 'Vanguard' ? 'V' : role === 'Ranger' ? 'R' : 'W';
}

function reset() {
  runToken += 1;
  autoplay.value = false;
  locked.value = false;
  selected.value = null;
  activeSide.value = 'ember';
  turn.value = 1;
  const random = createRng(seed.value);
  const candidates = [9, 11, 17, 24, 25, 31, 37, 39];
  const shuffled = candidates.sort(() => random() - 0.5).slice(0, 6);
  blocked.value = new Set(shuffled);
  units.value = [
    { id: 'e-v', side: 'ember', role: 'Vanguard', x: 1, y: 5, hp: 5, maxHp: 5, damage: 2, range: 1, move: 2 },
    { id: 'e-r', side: 'ember', role: 'Ranger', x: 3, y: 6, hp: 3, maxHp: 3, damage: 1, range: 3, move: 2 },
    { id: 'e-w', side: 'ember', role: 'Warden', x: 5, y: 5, hp: 4, maxHp: 4, damage: 1, range: 1, move: 2 },
    { id: 'h-v', side: 'hollow', role: 'Vanguard', x: 5, y: 1, hp: 5, maxHp: 5, damage: 2, range: 1, move: 2 },
    { id: 'h-r', side: 'hollow', role: 'Ranger', x: 3, y: 0, hp: 3, maxHp: 3, damage: 1, range: 3, move: 2 },
    { id: 'h-w', side: 'hollow', role: 'Warden', x: 1, y: 1, hp: 4, maxHp: 4, damage: 1, range: 1, move: 2 },
  ];
  message.value = 'Select an Ember unit.';
  decision.value = 'Waiting for your command';
  lastAction.value = 'Battle initialized';
}

function legalActions(side: Side): Action[] {
  const allies = units.value.filter((unit) => unit.side === side);
  const enemies = units.value.filter((unit) => unit.side !== side);
  const actions: Action[] = [];
  for (const unit of allies) {
    for (const enemy of enemies) {
      const distance = manhattan(unit, enemy);
      if (distance <= unit.range) {
        actions.push({
          kind: 'attack',
          unitId: unit.id,
          targetId: enemy.id,
          value: 100 + unit.damage * 12 + (enemy.maxHp - enemy.hp) * 6 - enemy.hp,
        });
      }
    }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (blocked.value.has(indexAt(x, y)) || unitAt(x, y) || manhattan(unit, { x, y }) > unit.move) continue;
        const closest = Math.min(...enemies.map((enemy) => manhattan({ x, y }, enemy)));
        const cover = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .filter(([dx, dy]) => blocked.value.has(indexAt(x + dx, y + dy))).length;
        actions.push({ kind: 'move', unitId: unit.id, to: { x, y }, value: 40 - closest * 4 + cover });
      }
    }
  }
  return actions.sort((a, b) => b.value - a.value);
}

function actionsForSelected() {
  return activeActions.value.filter((action) => action.unitId === selected.value);
}

function cellState(x: number, y: number) {
  const actions = actionsForSelected();
  const occupant = unitAt(x, y);
  return {
    move: actions.some((action) => action.kind === 'move' && action.to.x === x && action.to.y === y),
    target: occupant && actions.some((action) => action.kind === 'attack' && action.targetId === occupant.id),
  };
}

async function perform(action: Action, actor: 'human' | 'agent') {
  if (locked.value || winner.value) return;
  locked.value = true;
  const unit = units.value.find((item) => item.id === action.unitId);
  if (!unit) {
    locked.value = false;
    return;
  }
  if (action.kind === 'move') {
    units.value = units.value.map((item) => item.id === unit.id ? { ...item, ...action.to } : item);
    lastAction.value = `${unit.side === 'ember' ? 'Ember' : 'Hollow'} ${unit.role} advanced to ${String.fromCharCode(65 + action.to.x)}${action.to.y + 1}.`;
  } else {
    const target = units.value.find((item) => item.id === action.targetId);
    if (target) {
      const remaining = target.hp - unit.damage;
      units.value = units.value
        .map((item) => item.id === target.id ? { ...item, hp: remaining } : item)
        .filter((item) => item.hp > 0);
      lastAction.value = `${unit.role} struck ${target.role} for ${unit.damage}${remaining <= 0 ? ' — unit defeated.' : '.'}`;
    }
  }
  message.value = lastAction.value;
  selected.value = null;
  await wait(360);
  locked.value = false;
  if (winner.value) {
    message.value = winner.value === 'ember' ? 'Ember Company wins the crossing.' : 'The Hollow Host takes the field.';
    autoplay.value = false;
    return;
  }
  activeSide.value = activeSide.value === 'ember' ? 'hollow' : 'ember';
  if (activeSide.value === 'ember') turn.value += 1;
  if (activeSide.value === 'hollow' || autoplay.value) {
    await wait(380);
    if (!locked.value && !winner.value) await agentStep();
  } else if (actor === 'agent') {
    message.value = 'Agent yields control. Select an Ember unit.';
  } else {
    message.value = 'Select an Ember unit.';
  }
}

function chooseCell(x: number, y: number) {
  if (locked.value || autoplay.value || activeSide.value !== 'ember' || winner.value) return;
  const occupant = unitAt(x, y);
  if (occupant?.side === 'ember') {
    selected.value = occupant.id;
    message.value = `${occupant.role} selected · move or attack.`;
    return;
  }
  if (!selected.value) return;
  const action = actionsForSelected().find((candidate) =>
    candidate.kind === 'move'
      ? candidate.to.x === x && candidate.to.y === y
      : candidate.targetId === occupant?.id,
  );
  if (action) void perform(action, 'human');
}

async function agentStep() {
  if (locked.value || winner.value) return;
  const options = legalActions(activeSide.value);
  const best = options[0];
  if (!best) return;
  const unit = units.value.find((item) => item.id === best.unitId)!;
  selected.value = unit.id;
  decision.value = best.kind === 'attack'
    ? `${options.length} actions · ${unit.role} attacks the highest-value target`
    : `${options.length} actions · ${unit.role} advances with score ${best.value}`;
  message.value = `${activeSide.value === 'ember' ? 'Ember' : 'Hollow'} agent is acting.`;
  await wait(320);
  await perform(best, 'agent');
}

async function toggleAutoplay() {
  autoplay.value = !autoplay.value;
  if (autoplay.value && activeSide.value === 'ember' && !locked.value) await agentStep();
}

onUnmounted(() => {
  runToken += 1;
});

reset();
</script>

<template>
  <section class="game-demo game-demo--strategy">
    <header class="game-hero">
      <div>
        <span class="game-eyebrow">Playable system demo · tactical multi-agent turns</span>
        <h2>Ashfall Crossing</h2>
        <p>Command three specialists across a compact battlefield. Every move and attack is exposed through the same legal-action contract used by the agents.</p>
      </div>
      <div class="game-status-pill" :data-active="autoplay">{{ winner ? `${winner} wins` : `${activeSide} turn` }}</div>
    </header>

    <div class="game-layout">
      <div class="game-stage strategy-stage">
        <div class="strategy-hud">
          <div><span>Round</span><strong>{{ turn }}</strong></div>
          <div class="army-count ember-text"><span>Ember</span><strong>{{ emberUnits.length }}</strong></div>
          <div class="army-count hollow-text"><span>Hollow</span><strong>{{ hollowUnits.length }}</strong></div>
        </div>
        <div class="strategy-board">
          <button
            v-for="index in size * size"
            :key="index"
            class="strategy-cell"
            :class="{
              blocked: blocked.has(index - 1),
              selected: unitAt((index - 1) % size, Math.floor((index - 1) / size))?.id === selected,
              reachable: cellState((index - 1) % size, Math.floor((index - 1) / size)).move,
              targetable: cellState((index - 1) % size, Math.floor((index - 1) / size)).target,
            }"
            :aria-label="`Tile ${String.fromCharCode(65 + ((index - 1) % size))}${Math.floor((index - 1) / size) + 1}`"
            @click="chooseCell((index - 1) % size, Math.floor((index - 1) / size))"
          >
            <template v-if="unitAt((index - 1) % size, Math.floor((index - 1) / size))">
              <span
                class="unit-token"
                :class="unitAt((index - 1) % size, Math.floor((index - 1) / size))!.side"
              >
                <b>{{ roleMark(unitAt((index - 1) % size, Math.floor((index - 1) / size))!.role) }}</b>
                <i>
                  <span
                    :style="{ width: `${(unitAt((index - 1) % size, Math.floor((index - 1) / size))!.hp / unitAt((index - 1) % size, Math.floor((index - 1) / size))!.maxHp) * 100}%` }"
                  ></span>
                </i>
              </span>
            </template>
            <span v-else-if="blocked.has(index - 1)" class="ruin-mark">✦</span>
            <small>{{ String.fromCharCode(65 + ((index - 1) % size)) }}{{ Math.floor((index - 1) / size) + 1 }}</small>
          </button>
        </div>
        <div class="game-message">{{ message }}</div>
      </div>

      <aside class="agent-console">
        <div class="agent-console__head">
          <span class="agent-orb" :class="{ thinking: locked || autoplay }"></span>
          <div><strong>Tactical evaluator</strong><small>Attack priority · distance · cover</small></div>
        </div>
        <div class="agent-decision">
          <span>Latest decision</span>
          <p>{{ decision }}</p>
        </div>
        <div class="agent-decision battle-log">
          <span>Battle log</span>
          <p>{{ lastAction }}</p>
        </div>
        <div class="agent-metrics">
          <div><span>Legal actions</span><strong>{{ activeActions.length }}</strong></div>
          <div><span>Units</span><strong>{{ units.length }}</strong></div>
          <div><span>Round</span><strong>{{ turn }}</strong></div>
        </div>
        <div class="game-actions">
          <button class="primary-action" :disabled="locked || !!winner" @click="toggleAutoplay">
            {{ autoplay ? 'Take control' : 'Watch both sides' }}
          </button>
          <button :disabled="locked || autoplay || !!winner" @click="agentStep">Agent step</button>
          <button @click="reset">Restart battle</button>
        </div>
        <label class="seed-control">
          <span>Seed</span>
          <input v-model.number="seed" type="number" min="1" @change="reset">
        </label>
      </aside>
    </div>
  </section>
</template>
