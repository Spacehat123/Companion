/**
 * smiletest.js — "The Smile Test" Empirical Validation Engine.
 * Features:
 * - "Did that make you smile?" prompt with Yes / Not really buttons
 * - Per-reaction Yes/No tally persisted to localStorage
 * - Automatic tracking of time from page load to the first "Yes"
 * - Export button that copies the telemetry JSON to clipboard
 * - Support for ?test=1 query param (hides developer buttons for unbiased user testing)
 */

export class SmileTestManager {
  constructor(options = {}) {
    this.promptEl = options.promptEl;
    this.tallyListEl = options.tallyListEl;
    this.statsHeaderEl = options.statsHeaderEl;
    this.exportBtn = options.exportBtn;
    this.resetBtn = options.resetBtn;
    this.onFeedbackCallback = options.onFeedback || (() => {});

    this.pageStartTime = Date.now();
    this.firstSmileTimeSec = null;
    this.currentPendingAction = null;

    // Load persisted tally
    this.STORAGE_KEY = 'companion_smile_test_v1';
    this.data = this._loadData();

    this._bindEvents();
    this.render();
  }

  _loadData() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.firstSmileTimeSec) this.firstSmileTimeSec = parsed.firstSmileTimeSec;
        return parsed.tallies || {};
      }
    } catch (e) {
      console.warn('[SmileTest] Failed to load localStorage:', e);
    }
    return {};
  }

  _saveData() {
    try {
      const payload = {
        firstSmileTimeSec: this.firstSmileTimeSec,
        tallies: this.data,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[SmileTest] Failed to save localStorage:', e);
    }
  }

  prompt(actionName) {
    this.currentPendingAction = actionName;
    if (this.promptEl) {
      this.promptEl.classList.add('visible');
    }
  }

  dismiss() {
    this.currentPendingAction = null;
    if (this.promptEl) {
      this.promptEl.classList.remove('visible');
    }
  }

  recordAnswer(smiled) {
    const act = this.currentPendingAction || 'general';
    if (!this.data[act]) {
      this.data[act] = { yes: 0, no: 0 };
    }

    if (smiled) {
      this.data[act].yes++;
      // Record time to first smile if not yet recorded
      if (this.firstSmileTimeSec === null) {
        this.firstSmileTimeSec = Math.max(0.1, (Date.now() - this.pageStartTime) / 1000);
      }
    } else {
      this.data[act].no++;
    }

    this._saveData();
    this.dismiss();
    this.render();
    this.onFeedbackCallback(smiled);
  }

  render() {
    if (!this.tallyListEl) return;

    const entries = Object.entries(this.data);
    let totalYes = 0;
    let totalAll = 0;

    for (const [_, counts] of entries) {
      totalYes += counts.yes;
      totalAll += counts.yes + counts.no;
    }

    // Header stats
    if (this.statsHeaderEl) {
      const rate = totalAll > 0 ? Math.round((totalYes / totalAll) * 100) : 0;
      let text = `<b>Total Smiles:</b> ${totalYes} of ${totalAll} (${rate}%)`;
      if (this.firstSmileTimeSec !== null) {
        text += ` • <b>Time to 1st smile:</b> ${this.firstSmileTimeSec.toFixed(1)}s`;
      }
      this.statsHeaderEl.innerHTML = text;
    }

    // List per-action
    if (entries.length === 0) {
      this.tallyListEl.innerHTML = '<li class="muted">No test answers yet. Tap or shake to start!</li>';
      return;
    }

    this.tallyListEl.innerHTML = entries
      .map(([k, v]) => {
        const total = v.yes + v.no;
        const pct = total > 0 ? Math.round((v.yes / total) * 100) : 0;
        return `<li><b>${k}</b>: ${v.yes} of ${total} smiled (${pct}%)</li>`;
      })
      .join('');
  }

  exportJSON() {
    let totalYes = 0;
    let totalAll = 0;
    for (const [_, c] of Object.entries(this.data)) {
      totalYes += c.yes;
      totalAll += c.yes + c.no;
    }

    const exportPayload = {
      timestamp: new Date().toISOString(),
      timeToFirstSmileSec: this.firstSmileTimeSec ? Number(this.firstSmileTimeSec.toFixed(1)) : null,
      totalTested: totalAll,
      totalSmiled: totalYes,
      smileRate: totalAll > 0 ? `${((totalYes / totalAll) * 100).toFixed(1)}%` : '0%',
      reactionTallies: this.data,
      userAgent: navigator.userAgent,
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        alert('Smile Test data copied to clipboard as JSON!\n\n' + jsonStr);
      }).catch(() => {
        prompt('Copy your Smile Test JSON:', jsonStr);
      });
    } else {
      prompt('Copy your Smile Test JSON:', jsonStr);
    }
    return jsonStr;
  }

  reset() {
    if (confirm('Clear all Smile Test answers and reset telemetry?')) {
      this.data = {};
      this.firstSmileTimeSec = null;
      this.pageStartTime = Date.now();
      this._saveData();
      this.render();
    }
  }

  _bindEvents() {
    if (this.exportBtn) this.exportBtn.onclick = () => this.exportJSON();
    if (this.resetBtn) this.resetBtn.onclick = () => this.reset();

    const yesBtn = document.getElementById('smileYesBtn');
    const noBtn = document.getElementById('smileNoBtn');
    if (yesBtn) yesBtn.onclick = () => this.recordAnswer(true);
    if (noBtn) noBtn.onclick = () => this.recordAnswer(false);
  }

  static isTestMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('test') === '1' || params.get('test') === 'true';
  }
}
