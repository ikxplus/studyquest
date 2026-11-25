/*
 * StudyQuest — базовая логика приложения.
 * Задачи добавляются, отмечаются выполненными, приносят очки
 * и сохраняются в localStorage этого браузера.
 */

const POINTS_PER_TASK = 10;
const STORAGE_KEY = 'studyquest.state.v1';

const ITEMS = [
  { id: 'potion', emoji: '🧪', name: 'Зелье концентрации', cost: 20, power: 2 },
  { id: 'boots', emoji: '👟', name: 'Ботинки скорости', cost: 25, power: 2 },
  { id: 'sword', emoji: '🗡️', name: 'Меч знаний', cost: 30, power: 3 },
  { id: 'shield', emoji: '🛡️', name: 'Щит упорства', cost: 40, power: 4 }
];

const TRAINING_STEP = 2;
const TRAINING_BASE_COST = 20;
const QUEST_GOAL = 3;

const ENEMIES = [
  { id: 'lazy', emoji: '🦠', name: 'Микроб лени', power: 3 },
  { id: 'quiz', emoji: '🤖', name: 'Робот-контрольная', power: 7 },
  { id: 'dragon', emoji: '🐉', name: 'Дракон дедлайнов', power: 12 }
];

const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-input');
const taskList = document.querySelector('#task-list');
const emptyState = document.querySelector('#empty-state');
const taskCounter = document.querySelector('#task-counter');
const scoreValue = document.querySelector('#score-value');
const scoreStat = document.querySelector('#score-stat');
const completedStat = document.querySelector('#completed-stat');
const activeStat = document.querySelector('#active-stat');
const balanceValue = document.querySelector('#balance-value');
const heroBalance = document.querySelector('#hero-balance');
const heroPower = document.querySelector('#hero-power');
const heroTraining = document.querySelector('#hero-training');
const inventoryList = document.querySelector('#inventory-list');
const shopGrid = document.querySelector('#shop-grid');
const shopStatus = document.querySelector('#shop-status');
const trainingBtn = document.querySelector('#training-btn');
const enemySelect = document.querySelector('#enemy-select');
const battleBtn = document.querySelector('#battle-btn');
const battleResult = document.querySelector('#battle-result');
const questSteps = document.querySelectorAll('#quest-track span');
const questProgress = document.querySelector('#quest-progress');
const questBadge = document.querySelector('#quest-badge');
const questFoot = document.querySelector('#quest-foot');

function readReward() {
  const selected = document.querySelector('input[name="points"]:checked');
  const value = selected ? Number(selected.value) : POINTS_PER_TASK;
  return Number.isFinite(value) && value > 0 ? value : POINTS_PER_TASK;
}

let tasks = [];
let score = 0;
let balance = 0;
let inventory = {};
let training = 0;
let nextId = 1;

function resetState() {
  tasks = [];
  score = 0;
  balance = 0;
  inventory = {};
  training = 0;
  nextId = 1;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, score, balance, inventory, training, nextId }));
  } catch (error) {
    console.warn('[StudyQuest] Не удалось сохранить прогресс.', error);
  }
}

function loadState() {
  let raw;

  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[StudyQuest] Хранилище недоступно, начинаем с пустого списка.', error);
    resetState();
    return;
  }

  if (!raw) return;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.warn('[StudyQuest] Повреждённые данные, начинаем с пустого списка.', error);
    resetState();
    return;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.tasks)) {
    console.warn('[StudyQuest] Неожиданный формат данных, начинаем с пустого списка.');
    resetState();
    return;
  }

  const restored = [];

  for (const item of data.tasks) {
    if (!item || typeof item !== 'object' || typeof item.title !== 'string') continue;

    const title = item.title.trim();
    if (!title) continue;

    const reward = Number(item.reward);
    const validReward = Number.isFinite(reward) && reward > 0 ? reward : POINTS_PER_TASK;

    restored.push({ id: restored.length + 1, title, done: item.done === true, reward: validReward });
  }

  tasks = restored;
  nextId = tasks.length + 1;

  const expectedScore = tasks.reduce((total, task) => total + (task.done ? task.reward : 0), 0);
  score = Number.isFinite(data.score) && data.score >= 0 ? data.score : expectedScore;

  // Если счёт и галочки не совпадают, доверяем галочкам — так интерфейс всегда целостен.
  if (score !== expectedScore) score = expectedScore;

  const storedBalance = Number(data.balance);
  balance = Number.isFinite(storedBalance) && storedBalance >= 0 ? Math.min(storedBalance, score) : score;

  const storedInventory = data.inventory && typeof data.inventory === 'object' && !Array.isArray(data.inventory)
    ? data.inventory
    : {};
  inventory = {};
  ITEMS.forEach((item) => {
    inventory[item.id] = storedInventory[item.id] === true;
  });

  const storedTraining = Number(data.training);
  training = Number.isFinite(storedTraining) && storedTraining >= 0 ? Math.floor(storedTraining) : 0;
}

function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function plural(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function getPower() {
  const itemsPower = ITEMS.reduce((total, item) => total + (inventory[item.id] ? item.power : 0), 0);
  return itemsPower + training * TRAINING_STEP;
}

function getTrainingCost() {
  return TRAINING_BASE_COST * (training + 1);
}

function renderGame() {
  balanceValue.textContent = balance;
  heroBalance.textContent = balance;
  heroPower.textContent = getPower();
  heroTraining.textContent = training;

  const owned = ITEMS.filter((item) => inventory[item.id]);
  inventoryList.replaceChildren();

  if (owned.length === 0) {
    inventoryList.append(makeEl('span', 'inventory-empty', 'Пока пусто — купи первый предмет 🛒'));
  } else {
    owned.forEach((item) => {
      inventoryList.append(makeEl('span', 'inventory-chip', `${item.emoji} ${item.name}`));
    });
  }

  shopGrid.replaceChildren();
  ITEMS.forEach((item) => {
    const button = makeEl('button', 'shop-item');
    button.type = 'button';
    button.dataset.itemId = item.id;

    const ownedItem = inventory[item.id];
    const affordable = balance >= item.cost;
    button.disabled = ownedItem || !affordable;

    button.append(
      makeEl('span', 'shop-emoji', item.emoji),
      makeEl('span', 'shop-name', item.name),
      makeEl('span', 'shop-bonus', `+${item.power} силы`),
      makeEl('span', 'shop-cost', ownedItem ? 'Куплено ✓' : affordable ? `${item.cost} очков` : `Нужно ещё ${item.cost - balance}`)
    );

    shopGrid.append(button);
  });

  const trainingCost = getTrainingCost();
  trainingBtn.disabled = balance < trainingCost;
  trainingBtn.textContent = `Тренировка +${TRAINING_STEP} силы · ${trainingCost} очков`;

  const selectedEnemy = enemySelect.value;
  enemySelect.replaceChildren();
  ENEMIES.forEach((enemy) => {
    const option = makeEl('option', '', `${enemy.emoji} ${enemy.name} · сила ${enemy.power}`);
    option.value = enemy.id;
    enemySelect.append(option);
  });
  if (ENEMIES.some((enemy) => enemy.id === selectedEnemy)) enemySelect.value = selectedEnemy;
}

function createTaskItem(task) {
  const item = document.createElement('li');
  item.className = 'task-item';
  if (task.done) item.classList.add('is-done');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'task-checkbox';
  checkbox.id = `task-${task.id}`;
  checkbox.checked = task.done;
  checkbox.dataset.id = String(task.id);

  const label = document.createElement('label');
  label.className = 'task-title';
  label.htmlFor = checkbox.id;
  label.textContent = task.title;

  const points = document.createElement('span');
  points.className = 'task-points';
  points.textContent = task.done ? `+${task.reward}` : `${task.reward} очков`;

  item.append(checkbox, label, points);
  return item;
}

function render() {
  taskList.replaceChildren();

  if (tasks.length === 0) {
    taskList.append(emptyState);
  } else {
    tasks.forEach((task) => taskList.append(createTaskItem(task)));
  }

  const completed = tasks.filter((task) => task.done).length;
  const active = tasks.length - completed;

  scoreValue.textContent = score;
  scoreStat.textContent = score;
  completedStat.textContent = completed;
  activeStat.textContent = active;
  taskCounter.textContent = `${tasks.length} ${plural(tasks.length, 'задача', 'задачи', 'задач')}`;

  const questDone = Math.min(completed, QUEST_GOAL);
  questSteps.forEach((step, index) => step.classList.toggle('is-filled', index < questDone));
  questProgress.textContent = `Выполнено ${questDone} из ${QUEST_GOAL} задач`;
  questBadge.hidden = completed < QUEST_GOAL;
  questFoot.textContent = completed >= QUEST_GOAL
    ? 'Звание получено! Ты — Учебный герой 🎉'
    : 'Продолжай в том же духе! 🚀';

  renderGame();
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) return;

  tasks.push({ id: nextId++, title, done: false, reward: readReward() });
  taskInput.value = '';
  taskInput.focus();
  saveState();
  render();
});

taskList.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.matches('.task-checkbox')) return;

  const task = tasks.find((item) => item.id === Number(checkbox.dataset.id));
  if (!task) return;

  const changedId = task.id;

  task.done = checkbox.checked;
  const delta = task.done ? task.reward : -task.reward;
  score = Math.max(0, score + delta);
  balance = Math.max(0, balance + delta);
  saveState();
  render();

  // После перерисовки возвращаем фокус на ту же галочку (важно с клавиатуры).
  const updatedCheckbox = taskList.querySelector(`[data-id="${changedId}"]`);
  if (updatedCheckbox) updatedCheckbox.focus();
});

shopGrid.addEventListener('click', (event) => {
  const button = event.target.closest('.shop-item');
  if (!button || button.disabled) return;

  const item = ITEMS.find((entry) => entry.id === button.dataset.itemId);
  if (!item || inventory[item.id] || balance < item.cost) return;

  inventory[item.id] = true;
  balance -= item.cost;
  shopStatus.textContent = `${item.emoji} ${item.name} куплен! Сила +${item.power}.`;
  saveState();
  render();
});

trainingBtn.addEventListener('click', () => {
  const cost = getTrainingCost();
  if (balance < cost) return;

  balance -= cost;
  training += 1;
  shopStatus.textContent = `💪 Тренировка завершена! Сила +${TRAINING_STEP}.`;
  saveState();
  render();
});

battleBtn.addEventListener('click', () => {
  const enemy = ENEMIES.find((entry) => entry.id === enemySelect.value) || ENEMIES[0];
  const power = getPower();

  if (power >= enemy.power) {
    battleResult.className = 'battle-result is-win';
    battleResult.textContent = `🏆 Победа! ${enemy.emoji} ${enemy.name} повержен: сила ${power} против ${enemy.power}.`;
  } else {
    battleResult.className = 'battle-result is-loss';
    battleResult.textContent = `💥 Пока не вышло: нужно ${enemy.power} силы, а у тебя ${power}. Купи инвентарь или потренируйся!`;
  }
});

loadState();
saveState();
render();
