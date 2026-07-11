import { SFX_AUDIO, BGM_DEFAULT, bgmArtFor } from '../config/audio.js'

const BGM_NOTES = [523, 659, 784, 1046, 784, 659, 523, 392] // C5 E5 G5 C6 G5 E5 C5 G4 — placeholder overworld loop
const BGM_NOTE_DURATION = 0.22
const BGM_REAL_VOLUME = 0.4

/**
 * Plays real audio files the moment they exist (see config/audio.js +
 * AUDIO.md); otherwise synthesizes a short placeholder SFX/BGM via the raw
 * Web Audio API so there's still audio feedback before real assets exist.
 * Mute/volume persist to localStorage per PLAN.md Phase 7.
 */
export class AudioManager {
  constructor(scene) {
    this.scene = scene
    this.ctx = null
    this.bgmPlaying = false
    this.bgmTimerId = null
    this.bgmSound = null // the real Phaser Sound instance, when one is playing
    this.muted = this._loadMuted()
    this.volume = 1
    this.scene?.sound?.setMute(this.muted)
  }

  _loadMuted() {
    try {
      return localStorage.getItem('sm_muted') === 'true'
    } catch {
      return false
    }
  }

  toggleMute() {
    this.muted = !this.muted
    this.scene?.sound?.setMute(this.muted)
    try {
      localStorage.setItem('sm_muted', String(this.muted))
    } catch {
      // localStorage unavailable — mute state just won't persist across reloads.
    }
    return this.muted
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      this.ctx = new AudioContextClass()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  _playTone({ startFreq, endFreq, duration, type = 'sine', volume = 0.2 }) {
    if (this.muted) return
    const ctx = this._ensureContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime)
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration)
    }
    const v = volume * this.volume
    gain.gain.setValueAtTime(v, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }

  /** Plays the real audio clip if one's loaded, otherwise falls back to the synthesized tone. */
  _playSfx(audioEntry, toneConfig) {
    if (this.muted) return
    if (this.scene?.cache.audio.exists(audioEntry.key)) {
      this.scene.sound.play(audioEntry.key, { volume: (toneConfig.volume ?? 1) * this.volume })
    } else {
      this._playTone(toneConfig)
    }
  }

  playJump() {
    this._playSfx(SFX_AUDIO.jump, { startFreq: 440, endFreq: 880, duration: 0.15, type: 'square', volume: 0.15 })
  }

  playLand() {
    this._playSfx(SFX_AUDIO.land, { startFreq: 220, endFreq: 110, duration: 0.1, type: 'sine', volume: 0.12 })
  }

  playCoin() {
    this._playSfx(SFX_AUDIO.coin, { startFreq: 988, endFreq: 1568, duration: 0.12, type: 'square', volume: 0.15 })
  }

  playPowerUp() {
    this._playSfx(SFX_AUDIO.powerUp, { startFreq: 523, endFreq: 1046, duration: 0.3, type: 'triangle', volume: 0.18 })
  }

  playStomp() {
    this._playSfx(SFX_AUDIO.stomp, { startFreq: 300, endFreq: 80, duration: 0.15, type: 'square', volume: 0.16 })
  }

  playHurt() {
    this._playSfx(SFX_AUDIO.hurt, { startFreq: 200, endFreq: 100, duration: 0.25, type: 'sawtooth', volume: 0.16 })
  }

  playBubble() {
    this._playSfx(SFX_AUDIO.bubble, { startFreq: 700, endFreq: 500, duration: 0.2, type: 'sine', volume: 0.14 })
  }

  playRescue() {
    this._playSfx(SFX_AUDIO.rescue, { startFreq: 500, endFreq: 900, duration: 0.25, type: 'sine', volume: 0.16 })
  }

  playFlagpole() {
    this._playSfx(SFX_AUDIO.flagpole, { startFreq: 392, endFreq: 1046, duration: 0.5, type: 'triangle', volume: 0.2 })
  }

  playBlockBump() {
    this._playSfx(SFX_AUDIO.blockBump, { startFreq: 300, endFreq: 250, duration: 0.08, type: 'square', volume: 0.14 })
  }

  playBrickBreak() {
    this._playSfx(SFX_AUDIO.brickBreak, { startFreq: 180, endFreq: 60, duration: 0.2, type: 'sawtooth', volume: 0.18 })
  }

  /** Every 100 coins collected — see GameScene._handlePlayerItemOverlap. */
  play1Up() {
    this._playSfx(SFX_AUDIO.oneUp, { startFreq: 660, endFreq: 1760, duration: 0.4, type: 'triangle', volume: 0.22 })
  }

  /** Entering or exiting a warp pipe — see GameScene._warpPlayerToPipe. */
  playPipeWarp() {
    this._playSfx(SFX_AUDIO.pipeWarp, { startFreq: 150, endFreq: 500, duration: 0.3, type: 'sine', volume: 0.18 })
  }

  /** A pressure plate/switch just triggered (TimedDoor opening, or DualSwitchChest's pair completing). */
  playSwitch() {
    this._playSfx(SFX_AUDIO.switchOn, { startFreq: 500, endFreq: 700, duration: 0.1, type: 'square', volume: 0.14 })
  }

  playChestOpen() {
    this._playSfx(SFX_AUDIO.chestOpen, { startFreq: 440, endFreq: 1318, duration: 0.35, type: 'triangle', volume: 0.2 })
  }

  /** `levelId` picks an optional per-level BGM override (see config/audio.js bgmArtFor); falls back to the shared default, then to the synthesized loop. */
  startBgm(levelId) {
    if (this.bgmPlaying) return
    this.bgmPlaying = true

    const perLevelKey = levelId ? bgmArtFor(levelId).key : null
    const realKey = perLevelKey && this.scene?.cache.audio.exists(perLevelKey) ? perLevelKey : null
    const fallbackKey = !realKey && this.scene?.cache.audio.exists(BGM_DEFAULT.key) ? BGM_DEFAULT.key : null
    const bgmKey = realKey ?? fallbackKey

    if (bgmKey) {
      this.bgmSound = this.scene.sound.add(bgmKey, { loop: true, volume: BGM_REAL_VOLUME * this.volume })
      this.bgmSound.play()
    } else {
      this._scheduleBgmStep(0)
    }
  }

  stopBgm() {
    this.bgmPlaying = false
    if (this.bgmSound) {
      this.bgmSound.stop()
      this.bgmSound.destroy()
      this.bgmSound = null
    }
    if (this.bgmTimerId) clearTimeout(this.bgmTimerId)
    this.bgmTimerId = null
  }

  _scheduleBgmStep(index) {
    if (!this.bgmPlaying) return
    const freq = BGM_NOTES[index % BGM_NOTES.length]
    this._playTone({ startFreq: freq, duration: BGM_NOTE_DURATION * 0.9, type: 'triangle', volume: 0.05 })
    this.bgmTimerId = setTimeout(() => this._scheduleBgmStep(index + 1), BGM_NOTE_DURATION * 1000)
  }
}
