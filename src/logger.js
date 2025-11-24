export default class Logger {
    constructor (level = 'info') { this.level = level }
    info (...args) { if (['info', 'debug'].includes(this.level)) console.log('[INFO]', ...args) }
    debug (...args) { if (this.level === 'debug') console.debug('[DEBUG]', ...args) }
    error (...args) { console.error('[ERROR]', ...args) }
}