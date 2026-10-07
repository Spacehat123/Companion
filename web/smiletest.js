/**
 * web/smiletest.js — "The Smile Test" Empirical Validation Engine.
 * Stage 1 Shippable v0.1.0
 * 
 * Features:
 * - Unobtrusive bottom strip prompt that appears 2.2s after interaction and auto-hides
 * - Comprehensive telemetry per reaction: counts, smiles, playtime, anonymous tester ID, device type
 * - Triple-tap hot-corner export or ?dev=1 panel
 * - Prefilled "Send results" feedback link
 * - 100% on-device local storage (Zero network tracking)
 */

export class SmileTestManager {
  constructor(options = {}) {
    this.promptEl = options.promptEl;
    this.tallyListEl = options.tallyListEl;
    this.statsHeaderEl = options.statsHeaderEl;
    this.exportBtn = options.exportBtn;
    this.resetBtn = options.resetBtn;
    this.onFeedbackCallback = options.onFeedback || (() => {});

    this.STORAGE_KEY = 'companion_smile_telemetry_v1';

    // Anonymous Tester ID & Device Detection
    this.testerId = this._getOrCreateTesterId();
    this.deviceType = this._detectDevice();

    // Session Timers
    this.sessionStartTime = Date.now();
    this.firstSmileTimeSec = null;
    this.playTimeSec = 0;
    this.currentPendingAction = null;
    this.showTimer = null;
    this.autoHideTimer = null;

    // Load persisted state
    this.data = this._loadData();

    this._startPlaytimeStopwatch();
    this._bindEvents();
    this._setupHotCorner();
    this.render();
  }

  static isDevMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1';
  }

  static isTestMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('test') === '1';
  }

  _getOrCreateTesterId() {
    let tid = localStorage.getItem('companion_tester_id');
    if (!tid) {
      tid = 'fox_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('companion_tester_id', tid);
    }
    return tid;
  }

  _detectDevice() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/.test(ua)) return 'macOS Desktop';
    if (/Windows/.test(ua)) return 'Windows Desktop';
    if (/Linux/.test(ua)) return 'Linux Desktop';
    return 'Web';
  }

  _startPlaytimeStopwatch() {
    setInterval(() => {
      if (!document.hidden) {
        this.playTimeSec += 1;
      }
    }, 1000);
  }

  _loadData() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.firstSmileTimeSec) this.firstSmileTimeSec = parsed.firstSmileTimeSec;
        return parsed.reactions || {};
      }
    } catch (e) {
      console.warn('[SmileTest] Failed to load telemetry:', e);
    }
    return {};
  }

  _saveData() {
    try {
      const payload = {
        testerId: this.testerId,
        deviceType: this.deviceType,
        firstSmileTimeSec: this.firstSmileTimeSec,
        reactions: this.data,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[SmileTest] Failed to save telemetry:', e);
    }
  }

  prompt(actionName) {
    this.currentPendingAction = actionName;

    // Log reaction occurrence even before answer
    if (!this.data[actionName]) {
      this.data[actionName] = { count: 0, yes: 0, no: 0 };
    }
    this.data[actionName].count++;
    this._saveData();

    clearTimeout(this.showTimer);
    clearTimeout(this.autoHideTimer);

    // Unobtrusively show strip after 2.2 seconds
    this.showTimer = setTimeout(() => {
      if (this.promptEl) {
        this.promptEl.classList.add('visible');
      }
      // Auto-hide after 6.5 seconds if ignored
      this.autoHideTimer = setTimeout(() => {
        this.dismiss();
      }, 6500);
    }, 2200);
  }

  dismiss() {
    clearTimeout(this.showTimer);
    clearTimeout(this.autoHideTimer);
    this.currentPendingAction = null;
    if (this.promptEl) {
      this.promptEl.classList.remove('visible');
    }
  }

  recordAnswer(smiled) {
    const act = this.currentPendingAction || 'general';
    if (!this.data[act]) {
      this.data[act] = { count: 1, yes: 0, no: 0 };
    }

    if (smiled) {
      this.data[act].yes++;
      if (this.firstSmileTimeSec === null) {
        this.firstSmileTimeSec = Math.max(0.1, (Date.now() - this.sessionStartTime) / 1000);
      }
    } else {
      this.data[act].no++;
    }

    this._saveData();
    this.dismiss();
    this.render();
    this.onFeedbackCallback(smiled);
  }

  getTelemetryPayload() {
    let totalYes = 0;
    let totalAnswered = 0;
    let totalInteractions = 0;

    for (const [_, c] of Object.entries(this.data)) {
      totalYes += c.yes || 0;
      totalAnswered += (c.yes || 0) + (c.no || 0);
      totalInteractions += c.count || 0;
    }

    return {
      version: 'v0.1.0',
      testerId: this.testerId,
      device: this.deviceType,
      sessionStartTime: new Date(this.sessionStartTime).toISOString(),
      activePlayTimeSec: this.playTimeSec,
      timeToFirstSmileSec: this.firstSmileTimeSec ? Number(this.firstSmileTimeSec.toFixed(1)) : null,
      totalInteractions,
      totalRated: totalAnswered,
      totalSmiled: totalYes,
      smileRate: totalAnswered > 0 ? `${((totalYes / totalAnswered) * 100).toFixed(1)}%` : '0%',
      reactions: this.data,
      userAgent: navigator.userAgent,
    };
  }

  render() {
    if (!this.tallyListEl) return;

    const entries = Object.entries(this.data);
    let totalYes = 0;
    let totalAnswered = 0;

    for (const [_, c] of entries) {
      totalYes += c.yes || 0;
      totalAnswered += (c.yes || 0) + (c.no || 0);
    }

    if (this.statsHeaderEl) {
      const rate = totalAnswered > 0 ? Math.round((totalYes / totalAnswered) * 100) : 0;
      let text = `<b>Tester:</b> ${this.testerId} (${this.deviceType})<br>` +
                 `<b>Total Smiles:</b> ${totalYes} of ${totalAnswered} (${rate}%)`;
      if (this.firstSmileTimeSec !== null) {
        text += ` • <b>1st smile:</b> ${this.firstSmileTimeSec.toFixed(1)}s`;
      }
      this.statsHeaderEl.innerHTML = text;
    }

    if (entries.length === 0) {
      this.tallyListEl.innerHTML = '<li class="muted">No test answers yet. Touch or play with kitsune!</li>';
      return;
    }

    this.tallyListEl.innerHTML = entries
      .map(([k, v]) => {
        const total = (v.yes || 0) + (v.no || 0);
        const pct = total > 0 ? Math.round(((v.yes || 0) / total) * 100) : 0;
        return `<li><b>${k}</b>: ${v.yes || 0} of ${total} smiled (${pct}%) [fired ${v.count || 0}x]</li>`;
      })
      .join('');
  }

  exportJSON() {
    const payload = this.getTelemetryPayload();
    const jsonStr = JSON.stringify(payload, null, 2);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        alert(`Smile Test JSON copied to clipboard!\n\nTester: ${this.testerId}\nSmiles: ${payload.totalSmiled} (${payload.smileRate})`);
      }).catch(() => {
        prompt('Copy your Smile Test telemetry JSON:', jsonStr);
      });
    } else {
      prompt('Copy your Smile Test telemetry JSON:', jsonStr);
    }
  }

  sendResults() {
    const payload = this.getTelemetryPayload();
    const summary = `Kitsune Companion Smile Test Results:\nTester: ${payload.testerId}\nDevice: ${payload.device}\nSmiles: ${payload.totalSmiled}/${payload.totalRated} (${payload.smileRate})\nTime to 1st smile: ${payload.timeToFirstSmileSec}s\nPlaytime: ${payload.activePlayTimeSec}s`;
    const mailUrl = `mailto:?subject=${encodeURIComponent('Kitsune Smile Test Results: ' + payload.testerId)}&body=${encodeURIComponent(summary + '\n\n' + JSON.stringify(payload, null, 2))}`;
    window.open(mailUrl, '_blank');
  }

  resetData() {
    if (confirm('Reset all Smile Test data?')) {
      this.data = {};
      this.firstSmileTimeSec = null;
      this.playTimeSec = 0;
      this._saveData();
      this.render();
    }
  }

  _setupHotCorner() {
    // Triple-tap top-right corner to export on mobile without needing ?dev=1
    let tapCount = 0;
    let lastTapTime = 0;

    const hotCorner = document.getElementById('hotCorner');
    if (hotCorner) {
      hotCorner.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTapTime < 500) {
          tapCount++;
        } else {
          tapCount = 1;
        }
        lastTapTime = now;

        if (tapCount >= 3) {
          tapCount = 0;
          this.exportJSON();
        }
      });
    }
  }

  _bindEvents() {
    if (this.exportBtn) {
      this.exportBtn.onclick = () => this.exportJSON();
    }
    if (this.resetBtn) {
      this.resetBtn.onclick = () => this.resetData();
    }
  }
}
