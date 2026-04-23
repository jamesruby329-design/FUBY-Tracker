// ============================================================
// FUBY TRACKER — App Logic
// ============================================================

const FUBY = {

  // ── DATA ──────────────────────────────────────────────────
  LEVELS: [
    { name: 'Rookie',       emoji: '🌱', min: 0    },
    { name: 'Rising Star',  emoji: '⭐', min: 300  },
    { name: 'Go-Getter',    emoji: '🔥', min: 600  },
    { name: 'Brand Maker',  emoji: '💎', min: 900  },
    { name: 'Digital Boss', emoji: '👑', min: 1200 },
    { name: 'FUBY Legend',  emoji: '🏆', min: 1500 },
  ],

  XP_PER_TASK: 20,
  XP_PER_GOAL: 50,
  XP_PENALTY: 15,
  XP_PER_LEVEL: 300,

  AFFIRMATIONS: [
    "You are building something extraordinary. One task at a time. 🔥",
    "Every tick is proof you showed up. That's the whole game.",
    "Your future self is watching — make them proud today.",
    "Discipline is just love for your future self. Keep going.",
    "Small, consistent actions create legendary results.",
    "You don't need to be perfect. You need to be persistent.",
    "Progress over perfection. Always.",
    "The version of you who finishes this? She's worth fighting for.",
    "You've done hard things before. This is just another one.",
    "Today's effort is tomorrow's momentum. Don't stop.",
    "Your goals aren't dreams — they're decisions. Execute.",
    "Champions finish what they start. You are a champion.",
    "Every completed sub-task is a vote for the person you're becoming.",
    "The grind is temporary. The results are permanent.",
    "You are not behind. You are exactly where you need to be.",
    "Clarity + Action = Results. You have both.",
    "One more tick. One step closer. Keep moving.",
    "Success is built in the boring moments. Show up anyway.",
    "Your name should mean something. Make it mean something.",
    "The world is waiting for what only you can build.",
  ],

  REMINDERS: [
    "🎯 Don't forget to tick at least one sub-task today — protect your streak!",
    "⚡ Your goals aren't going to complete themselves. You've got this.",
    "🌅 Morning check-in: What's one thing you'll finish today?",
    "🔥 Mid-day pulse check — how many tasks have you ticked?",
    "🌙 Evening wrap-up: Did you show up for your goals today?",
    "💎 Your streak is a precious thing. Guard it daily.",
    "👑 A FUBY Legend doesn't wait for motivation. They create it.",
    "📱 Open FUBY Tracker. Tick something. Feel the XP hit.",
    "⭐ Consistency beats intensity every single time.",
    "🏆 The finish line is just a bunch of ticked boxes. Keep ticking.",
  ],

  // ── STATE ─────────────────────────────────────────────────
  state: {
    goals: [],
    xp: 0,
    level: 0,
    streak: 0,
    lastActiveDate: null,
    totalTasksDone: 0,
    totalGoalsDone: 0,
    notificationsEnabled: false,
    currentTab: 'active',
    affirmationIndex: 0,
  },

  // ── INIT ──────────────────────────────────────────────────
  init() {
    this.loadState();
    this.checkStreak();
    this.checkOverduePenalties();
    this.render();
    this.setupNotifications();
    this.startAffirmationRotation();
    this.registerSW();

    // Check URL param for new-goal shortcut
    if (new URLSearchParams(window.location.search).get('action') === 'new-goal') {
      setTimeout(() => this.openAddGoal(), 500);
    }
  },

  // ── STORAGE ───────────────────────────────────────────────
  loadState() {
    const saved = localStorage.getItem('fuby_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      } catch(e) {}
    }
  },

  saveState() {
    localStorage.setItem('fuby_state', JSON.stringify(this.state));
  },

  // ── STREAK ────────────────────────────────────────────────
  checkStreak() {
    const today = new Date().toDateString();
    const last = this.state.lastActiveDate;
    if (!last) return;

    const lastDate = new Date(last);
    const now = new Date();
    const diff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

    if (diff > 1) {
      this.state.streak = 0;
      this.saveState();
    }
  },

  markActiveToday() {
    const today = new Date().toDateString();
    if (this.state.lastActiveDate !== today) {
      if (this.state.lastActiveDate) {
        const last = new Date(this.state.lastActiveDate);
        const now = new Date();
        const diff = Math.floor((now - last) / (1000 * 60 * 60 * 24));
        if (diff === 1) this.state.streak++;
        else if (diff > 1) this.state.streak = 1;
        else this.state.streak = Math.max(1, this.state.streak);
      } else {
        this.state.streak = 1;
      }
      this.state.lastActiveDate = today;
      this.saveState();
    }
  },

  // ── XP & LEVELS ───────────────────────────────────────────
  addXP(amount) {
    const oldLevel = this.getLevel();
    this.state.xp = Math.max(0, this.state.xp + amount);
    const newLevel = this.getLevel();

    this.saveState();

    if (newLevel > oldLevel) {
      this.state.level = newLevel;
      this.saveState();
      setTimeout(() => this.showLevelUp(newLevel), 300);
    }
  },

  getLevel() {
    for (let i = this.LEVELS.length - 1; i >= 0; i--) {
      if (this.state.xp >= this.LEVELS[i].min) return i;
    }
    return 0;
  },

  getLevelData() {
    return this.LEVELS[this.getLevel()];
  },

  getXPToNextLevel() {
    const lvl = this.getLevel();
    if (lvl >= this.LEVELS.length - 1) return { current: 0, needed: 0, pct: 100 };
    const base = this.LEVELS[lvl].min;
    const next = this.LEVELS[lvl + 1].min;
    const current = this.state.xp - base;
    const needed = next - base;
    return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) };
  },

  // ── OVERDUE PENALTIES ─────────────────────────────────────
  checkOverduePenalties() {
    const today = new Date();
    today.setHours(0,0,0,0);
    let penaltyApplied = false;

    this.state.goals.forEach(goal => {
      if (goal.dueDate && !goal.completed && !goal.penaltyApplied) {
        const due = new Date(goal.dueDate);
        due.setHours(0,0,0,0);
        if (today > due) {
          goal.penaltyApplied = true;
          this.state.xp = Math.max(0, this.state.xp - this.XP_PENALTY);
          penaltyApplied = true;
        }
      }
    });

    if (penaltyApplied) this.saveState();
  },

  // ── GOALS ─────────────────────────────────────────────────
  addGoal(title, dueDate) {
    const goal = {
      id: Date.now().toString(),
      title,
      dueDate: dueDate || null,
      subTasks: [],
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      penaltyApplied: false,
    };
    this.state.goals.unshift(goal);
    this.saveState();
    this.render();
  },

  deleteGoal(id) {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    this.state.goals = this.state.goals.filter(g => g.id !== id);
    this.saveState();
    this.render();
  },

  addSubTask(goalId, text) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    goal.subTasks.push({
      id: Date.now().toString(),
      text,
      done: false,
    });
    this.saveState();
    this.renderGoalCard(goalId);
  },

  toggleSubTask(goalId, taskId) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const task = goal.subTasks.find(t => t.id === taskId);
    if (!task) return;

    task.done = !task.done;

    if (task.done) {
      this.addXP(this.XP_PER_TASK);
      this.state.totalTasksDone++;
      this.markActiveToday();
      this.playTickSound();
    } else {
      this.addXP(-this.XP_PER_TASK);
      this.state.totalTasksDone = Math.max(0, this.state.totalTasksDone - 1);
    }

    // Check goal completion
    const allDone = goal.subTasks.length > 0 && goal.subTasks.every(t => t.done);
    if (allDone && !goal.completed) {
      goal.completed = true;
      goal.completedAt = new Date().toISOString();
      this.addXP(this.XP_PER_GOAL);
      this.state.totalGoalsDone++;
      this.showGoalComplete(goal.title);
    } else if (!allDone && goal.completed) {
      goal.completed = false;
      goal.completedAt = null;
      this.addXP(-this.XP_PER_GOAL);
      this.state.totalGoalsDone = Math.max(0, this.state.totalGoalsDone - 1);
    }

    this.saveState();
    this.renderGoalCard(goalId);
    this.updateStats();
    this.updateXPBar();
  },

  deleteSubTask(goalId, taskId) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const task = goal.subTasks.find(t => t.id === taskId);
    if (task && task.done) {
      this.addXP(-this.XP_PER_TASK);
      this.state.totalTasksDone = Math.max(0, this.state.totalTasksDone - 1);
    }
    goal.subTasks = goal.subTasks.filter(t => t.id !== taskId);
    this.saveState();
    this.renderGoalCard(goalId);
  },

  getFilteredGoals() {
    const tab = this.state.currentTab;
    if (tab === 'active') return this.state.goals.filter(g => !g.completed);
    if (tab === 'done') return this.state.goals.filter(g => g.completed);
    return this.state.goals;
  },

  isOverdue(goal) {
    if (!goal.dueDate || goal.completed) return false;
    const due = new Date(goal.dueDate);
    due.setHours(23,59,59,999);
    return new Date() > due;
  },

  // ── RENDER ────────────────────────────────────────────────
  render() {
    this.updateStats();
    this.updateXPBar();
    this.renderGoals();
    this.updateAffirmation();
  },

  updateStats() {
    const lvl = this.getLevelData();
    const xpProgress = this.getXPToNextLevel();

    const el = id => document.getElementById(id);
    if (el('stat-xp')) el('stat-xp').textContent = this.state.xp.toLocaleString();
    if (el('stat-level')) el('stat-level').textContent = `${lvl.emoji} ${lvl.name}`;
    if (el('stat-streak')) el('stat-streak').textContent = `${this.state.streak} 🔥`;
    if (el('stat-goals')) el('stat-goals').textContent = this.state.totalGoalsDone;
    if (el('stat-tasks')) el('stat-tasks').textContent = this.state.totalTasksDone;
    if (el('xp-label')) el('xp-label').textContent = `${this.state.xp} XP`;
    if (el('level-label')) el('level-label').textContent = `${lvl.emoji} ${lvl.name}`;
    if (el('active-count')) el('active-count').textContent = this.state.goals.filter(g => !g.completed).length;
  },

  updateXPBar() {
    const { pct } = this.getXPToNextLevel();
    const bar = document.getElementById('xp-bar-fill');
    if (bar) bar.style.width = pct + '%';
  },

  renderGoals() {
    const container = document.getElementById('goals-container');
    if (!container) return;

    const goals = this.getFilteredGoals();
    if (goals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>No goals here yet.</p>
          <p class="empty-sub">Tap <strong>+ New Goal</strong> to begin your ascent.</p>
        </div>`;
      return;
    }

    container.innerHTML = goals.map(g => this.goalCardHTML(g)).join('');
    this.bindGoalEvents();
  },

  renderGoalCard(goalId) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const card = document.querySelector(`[data-goal-id="${goalId}"]`);
    if (!card) { this.renderGoals(); return; }
    card.outerHTML = this.goalCardHTML(goal);
    this.bindGoalEvents();
  },

  goalCardHTML(goal) {
    const total = goal.subTasks.length;
    const done = goal.subTasks.filter(t => t.done).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = this.isOverdue(goal);
    const dueFmt = goal.dueDate ? new Date(goal.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;

    return `
    <div class="goal-card ${goal.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-goal-id="${goal.id}">
      <div class="goal-header">
        <div class="goal-title-row">
          <span class="goal-status-dot ${goal.completed ? 'done' : overdue ? 'late' : 'active'}"></span>
          <h3 class="goal-title">${this.escHtml(goal.title)}</h3>
        </div>
        <button class="btn-icon delete-goal" data-id="${goal.id}" title="Delete goal">✕</button>
      </div>

      ${dueFmt ? `<div class="goal-due ${overdue ? 'overdue-badge' : ''}">
        ${overdue ? '⚠️' : '📅'} Due ${dueFmt}${overdue ? ' — OVERDUE' : ''}
      </div>` : ''}

      <div class="progress-row">
        <div class="progress-bar-track">
          <div class="progress-bar-fill ${goal.completed ? 'full' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="progress-pct">${pct}%</span>
      </div>

      <div class="subtasks-list">
        ${goal.subTasks.map(t => `
          <div class="subtask ${t.done ? 'done' : ''}">
            <button class="tick-btn ${t.done ? 'ticked' : ''}" data-goal="${goal.id}" data-task="${t.id}">
              ${t.done ? '<span class="tick-check">✓</span>' : '<span class="tick-empty"></span>'}
            </button>
            <span class="subtask-text">${this.escHtml(t.text)}</span>
            <button class="btn-icon del-task" data-goal="${goal.id}" data-task="${t.id}">✕</button>
          </div>
        `).join('')}
      </div>

      <div class="add-subtask-row">
        <input class="subtask-input" type="text" placeholder="Add sub-task…" data-goal="${goal.id}" maxlength="100" />
        <button class="btn-add-task" data-goal="${goal.id}">+</button>
      </div>

      <div class="goal-footer">
        <span class="xp-badge">⚡ ${done * this.XP_PER_TASK + (goal.completed ? this.XP_PER_GOAL : 0)} XP</span>
        <span class="task-count">${done}/${total} tasks</span>
      </div>
    </div>`;
  },

  bindGoalEvents() {
    // Tick buttons
    document.querySelectorAll('.tick-btn').forEach(btn => {
      btn.onclick = () => this.toggleSubTask(btn.dataset.goal, btn.dataset.task);
    });

    // Delete task
    document.querySelectorAll('.del-task').forEach(btn => {
      btn.onclick = () => this.deleteSubTask(btn.dataset.goal, btn.dataset.task);
    });

    // Delete goal
    document.querySelectorAll('.delete-goal').forEach(btn => {
      btn.onclick = () => this.deleteGoal(btn.dataset.id);
    });

    // Add subtask on Enter
    document.querySelectorAll('.subtask-input').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
          this.addSubTask(input.dataset.goal, input.value.trim());
          input.value = '';
        }
      });
    });

    // Add subtask on + button
    document.querySelectorAll('.btn-add-task').forEach(btn => {
      btn.onclick = () => {
        const input = document.querySelector(`.subtask-input[data-goal="${btn.dataset.goal}"]`);
        if (input && input.value.trim()) {
          this.addSubTask(btn.dataset.goal, input.value.trim());
          input.value = '';
        } else if (input) {
          input.focus();
        }
      };
    });
  },

  // ── MODALS / OVERLAYS ─────────────────────────────────────
  openAddGoal() {
    document.getElementById('modal-add-goal').classList.add('visible');
    document.getElementById('goal-title-input').focus();
  },

  closeAddGoal() {
    document.getElementById('modal-add-goal').classList.remove('visible');
    document.getElementById('goal-title-input').value = '';
    document.getElementById('goal-due-input').value = '';
  },

  submitAddGoal() {
    const title = document.getElementById('goal-title-input').value.trim();
    const due = document.getElementById('goal-due-input').value;
    if (!title) return;
    this.addGoal(title, due || null);
    this.closeAddGoal();
  },

  showLevelUp(levelIndex) {
    const lvl = this.LEVELS[levelIndex];
    const overlay = document.getElementById('levelup-overlay');
    document.getElementById('levelup-emoji').textContent = lvl.emoji;
    document.getElementById('levelup-name').textContent = lvl.name;
    overlay.classList.add('visible');
    this.createConfetti();
    setTimeout(() => overlay.classList.remove('visible'), 4000);
  },

  showGoalComplete(title) {
    const toast = document.createElement('div');
    toast.className = 'toast-complete';
    toast.innerHTML = `🏆 Goal Complete! <strong>${this.escHtml(title)}</strong> +${this.XP_PER_GOAL} bonus XP`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3000);
  },

  createConfetti() {
    const colors = ['#f5c518','#d4a017','#c0392b','#8b0000','#fff','#ffd700'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti-piece';
      c.style.cssText = `
        left:${Math.random()*100}vw;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        animation-duration:${0.8+Math.random()*1.2}s;
        animation-delay:${Math.random()*0.5}s;
        width:${6+Math.random()*8}px;
        height:${6+Math.random()*8}px;
        border-radius:${Math.random()>0.5?'50%':'2px'};
      `;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2500);
    }
  },

  // ── AFFIRMATIONS ──────────────────────────────────────────
  updateAffirmation() {
    const el = document.getElementById('affirmation-text');
    if (el) el.textContent = this.AFFIRMATIONS[this.state.affirmationIndex % this.AFFIRMATIONS.length];
  },

  nextAffirmation() {
    this.state.affirmationIndex = (this.state.affirmationIndex + 1) % this.AFFIRMATIONS.length;
    this.saveState();
    this.updateAffirmation();
    const el = document.getElementById('affirmation-text');
    if (el) {
      el.classList.add('fade-anim');
      setTimeout(() => el.classList.remove('fade-anim'), 600);
    }
  },

  startAffirmationRotation() {
    setInterval(() => this.nextAffirmation(), 30000);
  },

  // ── TABS ──────────────────────────────────────────────────
  setTab(tab) {
    this.state.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    this.renderGoals();
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────
  async setupNotifications() {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      this.state.notificationsEnabled = true;
      this.scheduleReminders();
    }
  },

  async requestNotifications() {
    if (!('Notification' in window)) { alert('Notifications not supported on this browser.'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      this.state.notificationsEnabled = true;
      this.saveState();
      this.scheduleReminders();
      this.showToast('Notifications enabled! 🔔');
    }
  },

  scheduleReminders() {
    // Daily reminder at 9AM and 7PM using Service Worker if available
    // Also show immediate reminder as sample
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDER',
        reminders: this.REMINDERS
      });
    }
  },

  showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast-complete';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 2500);
  },

  // ── SERVICE WORKER ────────────────────────────────────────
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('FUBY SW registered:', reg.scope);
      }).catch(err => console.warn('SW error:', err));
    }
  },

  // ── SOUND (simple Web Audio beep) ─────────────────────────
  playTickSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch(e) {}
  },

  // ── UTIL ──────────────────────────────────────────────────
  escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};

// ── BOOT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => FUBY.init());
