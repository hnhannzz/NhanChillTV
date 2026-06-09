// Cluster Service for NhanChillTV v1.4
const axios = require('axios');
const config = require('../config');
const systeminformation = require('systeminformation');

class ClusterService {
  constructor() {
    this.mode = config.mode || 'STANDALONE';
    this.workers = config.workers || [];
    this.workerStats = new Map();
    
    if (this.mode === 'MASTER') {
      this.startHealthCheck();
    }
  }

  startHealthCheck() {
    setInterval(async () => {
      for (const worker of this.workers) {
        try {
          const res = await axios.get(`${worker.url}/api/health`, { timeout: 2000 });
          this.workerStats.set(worker.id, {
            ...res.data,
            lastSeen: Date.now(),
            status: 'online'
          });
        } catch (err) {
          this.workerStats.set(worker.id, {
            status: 'offline',
            lastSeen: Date.now()
          });
        }
      }
    }, 5000);
  }

  async getBestWorker() {
    if (this.mode !== 'MASTER' || this.workers.length === 0) return null;
    
    let bestWorker = null;
    let lowestLoad = Infinity;

    for (const worker of this.workers) {
      const stats = this.workerStats.get(worker.id);
      if (stats && stats.status === 'online' && stats.cpuLoad) {
        if (stats.cpuLoad.currentLoad < lowestLoad) {
          lowestLoad = stats.cpuLoad.currentLoad;
          bestWorker = worker;
        }
      }
    }
    
    // Fallback to first available
    if (!bestWorker) {
      const available = this.workers.find(w => {
        const s = this.workerStats.get(w.id);
        return s && s.status === 'online';
      });
      bestWorker = available || null;
    }
    
    return bestWorker;
  }
}

module.exports = new ClusterService();
