<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { createRng, manhattan, wait, type Point } from './game-utils';

type CardKind = 'step' | 'dash' | 'strike' | 'bolt' | 'guard' | 'mend';
type Card = {
  uid: number;
  kind: CardKind;
  name: string;
  cost: number;
  description: string;
};
type Enemy = Point & {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  elite?: boolean;
};
type RogueAction = {
  card: Card;
  target: Point;
  value: number;
  summary: string;
};

const size = 6;
const seed = ref(616);
const hero = ref({ x: 0, y: 5, hp: 8, maxHp: 8, shield: 0 });
const enemies = ref<Enemy[]>([]);
const room = ref(1);
const turn = ref(1);
const energy = ref(3);
const hand = ref<Card[]>([]);
const drawPile = ref<Card[]>([]);
const discard = ref<Card[]>([]);
const selectedCard = ref<number | null>(null);
const locked = ref(false);
const autoplay = ref(false);
const message = ref('Choose a card, then choose a target.');
const decision = ref('Waiting for your move');
const lastAction = ref('Entered the first chamber');
let random = createRng(seed.value);
let cardSerial = 0;
let runToken = 0;

const won = computed(() => room.value === 3 && enemies.value.length === 0);
const defeated = computed(() => hero.value.hp <= 0);
const roomCleared = computed(() => enemies.value.length === 0 && !won.value);
const selected = computed(() => hand.value.find((card) => card.uid === selectedCard.value) ?? null);
const legal = computed(() => legalActions());
const targetCells = computed(() => {
  if (!selected.value) return new Set<number>();
  return new Set(legal.value.filter((action) => action.card.uid === selected.value!.uid).map((action) => action.target.y * size + action.target.x));
});

const cardLibrary: Record<CardKind, Omit<Card, 'uid' | 'kind'>> = {
  step: { name: 'Step', cost: 1, description: 'Move one tile.' },
  dash: { name: 'Dash', cost: 1, description: 'Move two tiles in a straight line.' },
  strike: { name: 'Strike', cost: 1, description: 'Deal 2 damage to an adjacent foe.' },
  bolt: { name: 'Cinder Bolt', cost: 2, description: 'Deal 2 damage at range 3.' },
  guard: { name: 'Guard', cost: 1, description: 'Gain 2 shield this turn.' },
  mend: { name: 'Mend', cost: 2, description: 'Recover 2 health.' },
};

function createCard(kind: CardKind): Card {
  cardSerial += 1;
  return { uid: cardSerial, kind, ...cardLibrary[kind] };
}

function shuffle<T>(values: T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function buildDeck() {
  return shuffle([
    createCard('step'), createCard('step'), createCard('step'),
    createCard('strike'), createCard('strike'),
    createCard('dash'), createCard('bolt'), createCard('guard'), createCard('mend'),
  ]);
}

function drawCards(count: number) {
  for (let index = 0; index < count; index += 1) {
    if (!drawPile.value.length) {
      drawPile.value = shuffle(discard.value);
      discard.value = [];
    }
    const card = drawPile.value.pop();
    if (card) hand.value.push(card);
  }
}

function spawnRoom(number: number) {
  const layouts: Enemy[][] = [
    [
      { id: 'r1-a', name: 'Ashling', x: 4, y: 1, hp: 3, maxHp: 3, damage: 1 },
      { id: 'r1-b', name: 'Ashling', x: 5, y: 3, hp: 3, maxHp: 3, damage: 1 },
    ],
    [
      { id: 'r2-a', name: 'Sentinel', x: 5, y: 0, hp: 4, maxHp: 4, damage: 1 },
      { id: 'r2-b', name: 'Ashling', x: 3, y: 2, hp: 3, maxHp: 3, damage: 1 },
      { id: 'r2-c', name: 'Ashling', x: 5, y: 4, hp: 3, maxHp: 3, damage: 1 },
    ],
    [
      { id: 'r3-a', name: 'Vault Heart', x: 4, y: 1, hp: 7, maxHp: 7, damage: 2, elite: true },
      { id: 'r3-b', name: 'Wisp', x: 2, y: 0, hp: 2, maxHp: 2, damage: 1 },
      { id: 'r3-c', name: 'Wisp', x: 5, y: 4, hp: 2, maxHp: 2, damage: 1 },
    ],
  ];
  enemies.value = layouts[number - 1].map((enemy) => ({ ...enemy }));
}

function reset() {
  runToken += 1;
  random = createRng(seed.value);
  cardSerial = 0;
  autoplay.value = false;
  locked.value = false;
  room.value = 1;
  turn.value = 1;
  energy.value = 3;
  hero.value = { x: 0, y: 5, hp: 8, maxHp: 8, shield: 0 };
  drawPile.value = buildDeck();
  discard.value = [];
  hand.value = [];
  drawCards(4);
  spawnRoom(1);
  selectedCard.value = null;
  message.value = 'Choose a card, then choose a target.';
  decision.value = 'Waiting for your move';
  lastAction.value = 'Entered the first chamber';
}

function enemyAt(point: Point) {
  return enemies.value.find((enemy) => enemy.x === point.x && enemy.y === point.y);
}

function occupied(point: Point) {
  return (hero.value.x === point.x && hero.value.y === point.y) || !!enemyAt(point);
}

function inside(point: Point) {
  return point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;
}

function legalActions(): RogueAction[] {
  if (locked.value || defeated.value || won.value || roomCleared.value) return [];
  const actions: RogueAction[] = [];
  for (const card of hand.value) {
    if (card.cost > energy.value) continue;
    const add = (target: Point, value: number, summary: string) => actions.push({ card, target, value, summary });
    if (card.kind === 'guard') {
      add({ x: hero.value.x, y: hero.value.y }, 25 + (hero.value.shield ? -12 : 10), 'raise 2 shield');
    } else if (card.kind === 'mend') {
      if (hero.value.hp < hero.value.maxHp) add({ x: hero.value.x, y: hero.value.y }, 35 + (hero.value.maxHp - hero.value.hp) * 16, 'recover 2 health');
    } else if (card.kind === 'strike' || card.kind === 'bolt') {
      const range = card.kind === 'strike' ? 1 : 3;
      for (const enemy of enemies.value) {
        if (manhattan(hero.value, enemy) <= range) {
          const lethal = enemy.hp <= 2;
          add({ x: enemy.x, y: enemy.y }, lethal ? 150 : 82 - enemy.hp, `${card.kind === 'strike' ? 'strike' : 'bolt'} ${enemy.name}`);
        }
      }
    } else {
      const distance = card.kind === 'step' ? 1 : 2;
      const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of directions) {
        const target = { x: hero.value.x + dx * distance, y: hero.value.y + dy * distance };
        const middle = { x: hero.value.x + dx, y: hero.value.y + dy };
        if (!inside(target) || occupied(target) || (card.kind === 'dash' && occupied(middle))) continue;
        const nearest = Math.min(...enemies.value.map((enemy) => manhattan(target, enemy)));
        const danger = enemies.value.filter((enemy) => manhattan(target, enemy) === 1).length;
        add(target, 52 - nearest * 6 - danger * 14, `move to ${String.fromCharCode(65 + target.x)}${target.y + 1}`);
      }
    }
  }
  return actions.sort((a, b) => b.value - a.value || a.card.cost - b.card.cost);
}

function selectCard(card: Card) {
  if (locked.value || autoplay.value || card.cost > energy.value) return;
  selectedCard.value = selectedCard.value === card.uid ? null : card.uid;
  message.value = selectedCard.value ? `${card.name}: ${card.description}` : 'Choose a card.';
}

function chooseTile(x: number, y: number) {
  if (!selected.value || locked.value || autoplay.value) return;
  const action = legal.value.find((candidate) => candidate.card.uid === selected.value!.uid && candidate.target.x === x && candidate.target.y === y);
  if (action) void playCard(action, 'human');
}

async function playCard(action: RogueAction, actor: 'human' | 'agent') {
  if (locked.value) return;
  locked.value = true;
  energy.value -= action.card.cost;
  selectedCard.value = null;
  hand.value = hand.value.filter((card) => card.uid !== action.card.uid);
  discard.value.push(action.card);
  const { kind } = action.card;
  if (kind === 'step' || kind === 'dash') {
    hero.value = { ...hero.value, x: action.target.x, y: action.target.y };
    lastAction.value = `${action.card.name} to ${String.fromCharCode(65 + action.target.x)}${action.target.y + 1}.`;
  } else if (kind === 'guard') {
    hero.value = { ...hero.value, shield: hero.value.shield + 2 };
    lastAction.value = 'Raised 2 shield.';
  } else if (kind === 'mend') {
    const healed = Math.min(2, hero.value.maxHp - hero.value.hp);
    hero.value = { ...hero.value, hp: hero.value.hp + healed };
    lastAction.value = `Recovered ${healed} health.`;
  } else {
    const target = enemyAt(action.target);
    if (target) {
      const remaining = target.hp - 2;
      enemies.value = enemies.value
        .map((enemy) => enemy.id === target.id ? { ...enemy, hp: remaining } : enemy)
        .filter((enemy) => enemy.hp > 0);
      lastAction.value = `${action.card.name} dealt 2 to ${target.name}${remaining <= 0 ? ' — defeated.' : '.'}`;
    }
  }
  message.value = lastAction.value;
  await wait(320);
  locked.value = false;
  if (enemies.value.length === 0) {
    autoplay.value = false;
    message.value = won.value ? 'The Vault Heart goes dark. Run complete!' : `Chamber ${room.value} cleared.`;
    return;
  }
  if (energy.value <= 0 || !legalActions().length) await endTurn(actor === 'agent');
}

async function endTurn(fromAgent = false) {
  if (locked.value || defeated.value || won.value || roomCleared.value || (!fromAgent && autoplay.value)) return;
  locked.value = true;
  selectedCard.value = null;
  message.value = 'Enemy phase.';
  const token = runToken;
  for (const current of [...enemies.value]) {
    if (token !== runToken || hero.value.hp <= 0) break;
    const enemy = enemies.value.find((item) => item.id === current.id);
    if (!enemy) continue;
    if (manhattan(enemy, hero.value) === 1) {
      const absorbed = Math.min(hero.value.shield, enemy.damage);
      hero.value = {
        ...hero.value,
        shield: hero.value.shield - absorbed,
        hp: hero.value.hp - (enemy.damage - absorbed),
      };
      lastAction.value = `${enemy.name} attacks for ${enemy.damage}${absorbed ? ` · ${absorbed} blocked` : ''}.`;
    } else {
      const candidates = [
        { x: enemy.x + Math.sign(hero.value.x - enemy.x), y: enemy.y },
        { x: enemy.x, y: enemy.y + Math.sign(hero.value.y - enemy.y) },
      ].filter((point) => inside(point) && !occupied(point));
      candidates.sort((a, b) => manhattan(a, hero.value) - manhattan(b, hero.value));
      if (candidates[0]) {
        enemies.value = enemies.value.map((item) => item.id === enemy.id ? { ...item, ...candidates[0] } : item);
        lastAction.value = `${enemy.name} closes in.`;
      }
    }
    message.value = lastAction.value;
    await wait(300);
  }
  if (hero.value.hp <= 0) {
    hero.value = { ...hero.value, hp: 0 };
    message.value = 'The run ends in the vault.';
    autoplay.value = false;
    locked.value = false;
    return;
  }
  discard.value.push(...hand.value);
  hand.value = [];
  drawCards(4);
  hero.value = { ...hero.value, shield: 0 };
  energy.value = 3;
  turn.value += 1;
  locked.value = false;
  message.value = autoplay.value ? 'Agent turn.' : 'Your turn. Choose a card.';
}

async function agentStep() {
  if (locked.value || defeated.value || won.value || roomCleared.value) return;
  const options = legalActions();
  const best = options[0];
  if (!best || (best.value < 12 && energy.value < 3)) {
    decision.value = `${options.length} legal actions · conserve cards and end turn`;
    await endTurn(true);
    if (autoplay.value && !defeated.value && !won.value) {
      await wait(300);
      await agentStep();
    }
    return;
  }
  selectedCard.value = best.card.uid;
  decision.value = `${options.length} legal actions · ${best.card.name}: ${best.summary} · value ${best.value}`;
  message.value = `Agent selects ${best.card.name}.`;
  await wait(350);
  await playCard(best, 'agent');
  if (autoplay.value && !locked.value && !roomCleared.value && !won.value && !defeated.value && energy.value > 0) {
    await wait(320);
    await agentStep();
  }
}

async function toggleAutoplay() {
  autoplay.value = !autoplay.value;
  if (autoplay.value) await agentStep();
}

function nextRoom() {
  if (!roomCleared.value) return;
  room.value += 1;
  turn.value += 1;
  hero.value = {
    x: 0,
    y: 5,
    maxHp: hero.value.maxHp + 1,
    hp: Math.min(hero.value.maxHp + 1, hero.value.hp + 3),
    shield: 0,
  };
  energy.value = 3;
  discard.value.push(...hand.value);
  hand.value = [];
  drawCards(4);
  spawnRoom(room.value);
  message.value = `Chamber ${room.value}: new threats stir.`;
  lastAction.value = 'Rested, gained 1 max health, and descended.';
}

function cardGlyph(kind: CardKind) {
  return { step: '→', dash: '»', strike: '†', bolt: '✦', guard: '◇', mend: '+' }[kind];
}

onUnmounted(() => {
  runToken += 1;
});

reset();
</script>

<template>
  <section class="game-demo game-demo--rogue">
    <header class="game-hero">
      <div>
        <span class="game-eyebrow">Playable system demo · cards × grid × agent</span>
        <h2>Cinder Vault</h2>
        <p>Spend cards and energy to cross three hostile chambers. The agent sees the same hand, targets, health, and legal actions as the player.</p>
      </div>
      <div class="game-status-pill" :data-active="autoplay">{{ won ? 'Run won' : defeated ? 'Run lost' : `Chamber ${room} · Turn ${turn}` }}</div>
    </header>

    <div class="game-layout">
      <div class="game-stage rogue-stage">
        <div class="rogue-hud">
          <div class="hero-vitals">
            <span>Wayfarer</span>
            <strong>{{ hero.hp }}/{{ hero.maxHp }} HP</strong>
            <i><b :style="{ width: `${(hero.hp / hero.maxHp) * 100}%` }"></b></i>
          </div>
          <div class="energy-pips" :aria-label="`${energy} energy`">
            <span v-for="pip in 3" :key="pip" :class="{ full: pip <= energy }">◆</span>
          </div>
          <div class="deck-counts"><span>Draw {{ drawPile.length }}</span><span>Discard {{ discard.length }}</span></div>
        </div>

        <div class="rogue-board">
          <button
            v-for="index in size * size"
            :key="index"
            class="rogue-cell"
            :class="{
              targetable: targetCells.has(index - 1),
              hero: hero.x === ((index - 1) % size) && hero.y === Math.floor((index - 1) / size),
              occupied: !!enemyAt({ x: (index - 1) % size, y: Math.floor((index - 1) / size) }),
            }"
            @click="chooseTile((index - 1) % size, Math.floor((index - 1) / size))"
          >
            <span
              v-if="hero.x === ((index - 1) % size) && hero.y === Math.floor((index - 1) / size)"
              class="rogue-actor wayfarer"
            >
              <b>W</b><i v-if="hero.shield">{{ hero.shield }}</i>
            </span>
            <span
              v-else-if="enemyAt({ x: (index - 1) % size, y: Math.floor((index - 1) / size) })"
              class="rogue-actor enemy"
              :class="{ elite: enemyAt({ x: (index - 1) % size, y: Math.floor((index - 1) / size) })!.elite }"
            >
              <b>{{ enemyAt({ x: (index - 1) % size, y: Math.floor((index - 1) / size) })!.elite ? 'H' : 'A' }}</b>
              <i>{{ enemyAt({ x: (index - 1) % size, y: Math.floor((index - 1) / size) })!.hp }}</i>
            </span>
            <small>{{ String.fromCharCode(65 + ((index - 1) % size)) }}{{ Math.floor((index - 1) / size) + 1 }}</small>
          </button>
        </div>

        <div class="game-message">{{ message }}</div>

        <div v-if="roomCleared || won || defeated" class="run-gate">
          <template v-if="roomCleared">
            <strong>Chamber cleared</strong>
            <span>Rest: +3 health and +1 maximum health</span>
            <button @click="nextRoom">Descend to chamber {{ room + 1 }}</button>
          </template>
          <template v-else>
            <strong>{{ won ? 'Vault conquered' : 'Run ended' }}</strong>
            <span>{{ won ? `Completed in ${turn} turns` : `Reached chamber ${room}` }}</span>
            <button @click="reset">Start another run</button>
          </template>
        </div>

        <div v-else class="rogue-hand">
          <button
            v-for="card in hand"
            :key="card.uid"
            class="action-card"
            :class="[{ selected: selectedCard === card.uid, exhausted: card.cost > energy }, `card-${card.kind}`]"
            :disabled="locked || autoplay || card.cost > energy"
            @click="selectCard(card)"
          >
            <span class="card-cost">{{ card.cost }}</span>
            <b class="card-glyph">{{ cardGlyph(card.kind) }}</b>
            <strong>{{ card.name }}</strong>
            <small>{{ card.description }}</small>
          </button>
          <button class="end-turn-card" :disabled="locked || autoplay" @click="endTurn(false)">End<br>turn</button>
        </div>
      </div>

      <aside class="agent-console">
        <div class="agent-console__head">
          <span class="agent-orb" :class="{ thinking: locked || autoplay }"></span>
          <div><strong>Run evaluator</strong><small>Damage · survival · position · energy</small></div>
        </div>
        <div class="agent-decision">
          <span>Latest decision</span>
          <p>{{ decision }}</p>
        </div>
        <div class="agent-decision battle-log">
          <span>Run log</span>
          <p>{{ lastAction }}</p>
        </div>
        <div class="agent-metrics">
          <div><span>Legal actions</span><strong>{{ legal.length }}</strong></div>
          <div><span>Energy</span><strong>{{ energy }}</strong></div>
          <div><span>Enemies</span><strong>{{ enemies.length }}</strong></div>
        </div>
        <div class="game-actions">
          <button class="primary-action" :disabled="locked || won || defeated || roomCleared" @click="toggleAutoplay">
            {{ autoplay ? 'Take control' : 'Watch agent' }}
          </button>
          <button :disabled="locked || autoplay || won || defeated || roomCleared" @click="agentStep">Agent step</button>
          <button @click="reset">Restart run</button>
        </div>
        <label class="seed-control">
          <span>Seed</span>
          <input v-model.number="seed" type="number" min="1" @change="reset">
        </label>
      </aside>
    </div>
  </section>
</template>
