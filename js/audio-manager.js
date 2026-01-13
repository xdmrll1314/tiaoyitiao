// 音频管理器
class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
    }

    playTone(freq, type, duration, startTime = 0) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    startCharge() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.oscillator = this.ctx.createOscillator();
        this.gainNode = this.ctx.createGain();
        
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(150, this.ctx.currentTime);
        this.oscillator.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 2);
        
        this.gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
        
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.oscillator.start();
    }

    stopCharge() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
    
    playJump() {
        this.playTone(150, 'square', 0.1);
    }
    
    playLand() {
        this.playTone(100, 'sine', 0.1);
    }
    
    playScore(combo) {
        const baseFreq = 440;
        const freq = baseFreq + (combo * 50);
        this.playTone(freq, 'sine', 0.3);
        if (combo > 1) {
            this.playTone(freq * 1.5, 'triangle', 0.3, 0.05);
        }
    }

    playFail() {
        this.playTone(100, 'sawtooth', 0.5);
        this.playTone(80, 'sawtooth', 0.5, 0.2);
    }
}
