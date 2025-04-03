// js/audio.js
"use strict";
import { domElements } from './dom.js';
import { gameState } from './state.js';
import { playlist, POWERUP_SFX_CLICK_ID } from './config.js';

let currentTrackIndex = 0;
let musicShouldBePlaying = false;
let lastVolumeBeforeMute = 0.1;

export function loadTrack(idx, play) {
    const music = domElements['background-music'];
    const nameEl = domElements['current-track-name'];
    if (!music || !nameEl || !playlist.length) return;

    currentTrackIndex = (idx + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    if (!track) return;

    musicShouldBePlaying = play;
    let src = music.querySelector('source[type="audio/mpeg"]') || document.createElement('source');
    src.type = 'audio/mpeg';
    src.src = `resources/audio/${track.filename}`;
    if (!src.parentNode) music.appendChild(src);

    if (nameEl) nameEl.textContent = track.name;
    music.load();
    music.removeEventListener('canplay', handleCanPlay); // Ensure no duplicates
    music.addEventListener('canplay', handleCanPlay, { once: true });
    updatePlayPauseIcon();
}

function handleCanPlay() {
    if (musicShouldBePlaying) playCurrentTrack();
    else updatePlayPauseIcon();
}

export function playCurrentTrack() {
    const music = domElements['background-music'];
    if (!music || !music.currentSrc || gameState.isMuted) {
        musicShouldBePlaying = false;
        updatePlayPauseIcon();
        return;
    }
    music.play().then(() => {
        musicShouldBePlaying = true;
        updatePlayPauseIcon();
    }).catch(e => {
        if (e.name !== 'NotAllowedError') console.warn("Playback failed:", e);
        musicShouldBePlaying = false;
        updatePlayPauseIcon();
    });
}

export function pauseCurrentTrack() {
    const music = domElements['background-music'];
    if (music) {
        music.pause();
        musicShouldBePlaying = false;
        updatePlayPauseIcon();
    }
}

export function updatePlayPauseIcon() {
    const icon = domElements['play-pause-icon'];
    const btn = domElements['play-pause-button'];
    if (!icon || !btn) return;
    icon.innerHTML = musicShouldBePlaying ? '❚❚' : '►';
    btn.title = musicShouldBePlaying ? "Pause Music" : "Play Music";
}

export function playNextTrack() {
    if (domElements['background-music']) loadTrack(currentTrackIndex + 1, musicShouldBePlaying);
}

export function togglePlayPause() {
    const music = domElements['background-music'];
    if (!music) return;
    if (music.paused) {
        if (!music.currentSrc || music.currentSrc === '' || music.currentSrc === window.location.href) {
            loadTrack(0, true); // Load first track if nothing is loaded
        } else {
            playCurrentTrack();
        }
    } else {
        pauseCurrentTrack();
    }
}

export function setVolume(val = null) {
    const music = domElements['background-music'];
    const slider = domElements['volume-slider'];
    const sfxPurchase = domElements['sfx-purchase'];
    const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID];

    if (!music || !slider) return;

    let vol = val !== null ? parseFloat(val) : parseFloat(slider.value);
    if (isNaN(vol)) vol = 0.1;
    vol = Math.max(0, Math.min(1, vol));

    if (gameState.isMuted && vol > 0) {
        toggleMute(false); // Unmute if volume adjusted > 0 while muted
    }

    slider.value = vol;

    if (!gameState.isMuted || vol > 0) {
        if (vol > 0) lastVolumeBeforeMute = vol;
    }

    if (!gameState.isMuted) {
        music.volume = vol;
        const sfxVol = Math.min(1, vol * 1.5); // SFX potentially louder
        if (sfxPurchase) sfxPurchase.volume = sfxVol;
        if (sfxPowerup) sfxPowerup.volume = sfxVol;
    }

    if (vol === 0 && !gameState.isMuted) {
        toggleMute(true); // Mute if slider dragged to 0
    }

    updateMuteButtonVisuals();
}

export function toggleMute(forceMuteState = null) {
    const music = domElements['background-music'];
    const sfxPurchase = domElements['sfx-purchase'];
    const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID];
    const slider = domElements['volume-slider'];

    const shouldBeMuted = forceMuteState !== null ? forceMuteState : !gameState.isMuted;

    gameState.isMuted = shouldBeMuted;
    console.log(`Audio ${gameState.isMuted ? 'muted' : 'unmuted'}.`);

    if (gameState.isMuted) {
        if (music) music.muted = true;
        if (sfxPurchase) sfxPurchase.muted = true;
        if (sfxPowerup) sfxPowerup.muted = true;
        if (slider) {
            if (parseFloat(slider.value) > 0) {
                lastVolumeBeforeMute = parseFloat(slider.value);
            }
            slider.value = 0;
        }
        // Check if music *was* playing before pausing
        const wasPlaying = musicShouldBePlaying;
        if(music) music.pause(); // Ensure it's paused
        musicShouldBePlaying = wasPlaying; // Keep track if it should resume on unmute

    } else { // Unmuting
        if (music) music.muted = false;
        if (sfxPurchase) sfxPurchase.muted = false;
        if (sfxPowerup) sfxPowerup.muted = false;

        const restoreVol = (lastVolumeBeforeMute > 0) ? lastVolumeBeforeMute : 0.1;
        if (slider) slider.value = restoreVol;
        // Use setVolume to apply the restored volume correctly
        setVolume(restoreVol);

        // Only resume playing if it was supposed to be playing before mute
        if (musicShouldBePlaying && music && music.paused) {
            playCurrentTrack();
        }
    }
    updateMuteButtonVisuals();
}


export function updateMuteButtonVisuals() {
    const btn = domElements['mute-button'];
    const slider = domElements['volume-slider'];
    if (!btn || !slider) return;
    const isEffectivelyMuted = gameState.isMuted || parseFloat(slider.value) === 0;

    btn.textContent = isEffectivelyMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isEffectivelyMuted);
    btn.title = isEffectivelyMuted ? "Unmute All Audio" : "Mute All Audio";
}

export function playSoundEffect(audioElementId) {
     const audioElement = domElements[audioElementId];
     if (!audioElement || gameState.isMuted) return;
     if (audioElement.readyState >= 2) { // Ensure ready to play
         audioElement.currentTime = 0;
         audioElement.play().catch(e => {
             // Ignore errors like overlapping play requests
             if (e.name !== 'AbortError') {
                 console.warn(`SFX play failed (${audioElementId}):`, e);
             }
         });
     } else {
         // Optional: Load if not ready, then play? Might introduce delay.
         // audioElement.load();
         // audioElement.addEventListener('canplaythrough', () => {
         //     audioElement.currentTime = 0;
         //     audioElement.play().catch(()=>{});
         // }, { once: true });
          console.warn(`SFX (${audioElementId}) not ready, state: ${audioElement.readyState}`);
     }
}