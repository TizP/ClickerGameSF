// js/audio.js
"use strict";
import { domElements } from './dom.js';
import { gameState } from './state.js';
import { playlist, POWERUP_SFX_CLICK_ID } from './config.js';

let currentTrackIndex = 0;
let musicShouldBePlaying = false; // Tracks if music *should* be playing (user intent)
let lastVolumeBeforeMute = 0.1; // Default starting volume

export function loadTrack(idx, play) {
    const music = domElements['background-music'];
    const nameEl = domElements['current-track-name'];
    if (!music || !nameEl || !playlist || playlist.length === 0) {
        console.warn("Cannot load track: Missing elements or empty playlist.");
        return;
    }

    currentTrackIndex = (idx + playlist.length) % playlist.length; // Wrap around playlist
    gameState.currentTrackIndex = currentTrackIndex; // Store index in state for saving
    const track = playlist[currentTrackIndex];
    if (!track || !track.filename) {
        console.error(`Invalid track data at index ${currentTrackIndex}.`);
        // Attempt to play next valid track? For now, just stop.
        pauseCurrentTrack();
        return;
    }

    console.log(`Loading track ${currentTrackIndex}: ${track.name}`);
    musicShouldBePlaying = play; // Store user intent *before* loading
    gameState.musicShouldBePlaying = musicShouldBePlaying; // Save intent

    // Ensure source element exists
    let sourceEl = music.querySelector('source[type="audio/mpeg"]');
    if (!sourceEl) {
        sourceEl = document.createElement('source');
        sourceEl.type = 'audio/mpeg';
        music.appendChild(sourceEl);
    }
    sourceEl.src = `resources/audio/${track.filename}`;

    if (nameEl) nameEl.textContent = track.name;
    music.load(); // Important: Load the new source

    // Use 'canplay' event to attempt playback once ready
    music.removeEventListener('canplay', handleCanPlay); // Remove previous listener if any
    music.addEventListener('canplay', handleCanPlay, { once: true });

    updatePlayPauseIcon(); // Update icon immediately to reflect loading/intent
}

function handleCanPlay() {
    // This runs when the browser thinks it *can* play the track
    console.log("Track ready (canplay event).");
    if (musicShouldBePlaying && !gameState.isMuted) { // Check intent AND mute state
        playCurrentTrack();
    } else {
        updatePlayPauseIcon(); // Ensure icon is correct if not playing
    }
}

export function playCurrentTrack() {
    const music = domElements['background-music'];
    if (!music || !music.currentSrc || gameState.isMuted) {
        console.log("Play prevented: No music element, no source, or muted.");
        // Ensure intent reflects reality if playback is prevented
        if(musicShouldBePlaying) {
            musicShouldBePlaying = false;
            gameState.musicShouldBePlaying = false;
        }
        updatePlayPauseIcon();
        return;
    }

    // Check if already playing to avoid interruption errors
    if (!music.paused) {
        // console.log("Already playing."); // Can be noisy
        return;
    }

    console.log("Attempting to play track...");
    music.play().then(() => {
        console.log("Playback started successfully.");
        musicShouldBePlaying = true;
        gameState.musicShouldBePlaying = true; // Save intent
        updatePlayPauseIcon();
    }).catch(e => {
        // Common errors: NotAllowedError (user interaction needed), AbortError (load interrupted)
        if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') {
            console.error("Playback failed:", e);
        } else {
             console.warn(`Playback prevented (${e.name}). Waiting for interaction or load.`);
        }
        musicShouldBePlaying = false; // Playback failed, update intent
        gameState.musicShouldBePlaying = false;
        updatePlayPauseIcon();
    });
}

export function pauseCurrentTrack() {
    const music = domElements['background-music'];
    if (music) {
        music.pause();
        // Important: DO NOT change musicShouldBePlaying here on manual pause trigger.
        // Let togglePlayPause handle the intent change.
        // If paused by mute, musicShouldBePlaying remains true.
        console.log("Playback paused.");
        updatePlayPauseIcon(); // Update icon to 'play' symbol
    }
}

export function updatePlayPauseIcon() {
    const icon = domElements['play-pause-icon'];
    const btn = domElements['play-pause-button'];
    if (!icon || !btn) return;

    const music = domElements['background-music'];
    // Determine if visually playing (not paused AND user intends to play AND not muted)
    const isEffectivelyPlaying = music && !music.paused && musicShouldBePlaying && !gameState.isMuted;

    icon.innerHTML = isEffectivelyPlaying ? '❚❚' : '►';
    btn.title = isEffectivelyPlaying ? "Pause Music" : "Play Music";
}

export function playNextTrack() {
    console.log("Playing next track...");
    // Load the next track, maintain playing state if it was playing
    if (domElements['background-music']) {
        loadTrack(currentTrackIndex + 1, musicShouldBePlaying);
    }
}

export function togglePlayPause() {
    const music = domElements['background-music'];
    if (!music) return;

    if (music.paused || !musicShouldBePlaying) { // If paused OR intent was false, try to play
        musicShouldBePlaying = true; // Set intent to play
        gameState.musicShouldBePlaying = true; // Save intent
        if (!music.currentSrc || music.currentSrc === '' || music.currentSrc.endsWith('/')) {
            console.log("No track loaded, loading first track...");
            loadTrack(0, true); // Load and set intent to play
        } else {
            playCurrentTrack(); // Attempt to play existing track
        }
    } else { // If playing and intent was true, pause
        musicShouldBePlaying = false; // Set intent to pause
        gameState.musicShouldBePlaying = false; // Save intent
        pauseCurrentTrack();
    }
    // updatePlayPauseIcon is called within playCurrentTrack/pauseCurrentTrack
}


export function setVolume(val = null) {
    const music = domElements['background-music'];
    const slider = domElements['volume-slider'];
    const sfxPurchase = domElements['sfx-purchase'];
    const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID]; // Use constant

    if (!slider) return; // Only require slider for this function

    let vol = val !== null ? parseFloat(val) : parseFloat(slider.value);
    if (isNaN(vol)) vol = lastVolumeBeforeMute; // Fallback to last known volume
    vol = Math.max(0, Math.min(1, vol)); // Clamp between 0 and 1

    // Unmute if volume is adjusted above 0 while muted
    if (gameState.isMuted && vol > 0) {
        toggleMute(false); // Explicitly unmute
    }

    slider.value = vol; // Update slider position

    // Store the last non-zero volume for restoration after mute
    if (vol > 0) {
        lastVolumeBeforeMute = vol;
        gameState.lastVolume = vol; // Save to state
    }

    // Apply volume to audio elements if *not* globally muted
    if (!gameState.isMuted) {
        if (music) music.volume = vol;
        const sfxVol = Math.min(1, vol * 1.2); // Example: SFX up to 20% louder
        if (sfxPurchase) sfxPurchase.volume = sfxVol;
        if (sfxPowerup) sfxPowerup.volume = sfxVol;
    }

    // If slider is dragged to 0, explicitly mute
    if (vol === 0 && !gameState.isMuted) {
        toggleMute(true); // Mute
    }

    updateMuteButtonVisuals(); // Reflect potential mute state change
}

export function toggleMute(forceMuteState = null) {
    const music = domElements['background-music'];
    const sfxPurchase = domElements['sfx-purchase'];
    const sfxPowerup = domElements[POWERUP_SFX_CLICK_ID];
    const slider = domElements['volume-slider'];

    const shouldBeMuted = forceMuteState !== null ? forceMuteState : !gameState.isMuted;

    if (shouldBeMuted === gameState.isMuted) return; // No change needed

    gameState.isMuted = shouldBeMuted;
    console.log(`Audio ${gameState.isMuted ? 'muted' : 'unmuted'}.`);

    if (gameState.isMuted) {
        // Muting: Mute elements, set slider to 0, pause music playback
        if (music) music.muted = true;
        if (sfxPurchase) sfxPurchase.muted = true;
        if (sfxPowerup) sfxPowerup.muted = true;
        if (slider) {
            const currentSliderVol = parseFloat(slider.value);
             if (currentSliderVol > 0) { // Store volume only if it wasn't already 0
                 lastVolumeBeforeMute = currentSliderVol;
                 gameState.lastVolume = currentSliderVol; // Save to state
             }
            slider.value = 0; // Visually set slider to muted state
        }
        if(music && !music.paused) { // Check if music is actually playing before pausing
             music.pause();
             console.log("Music paused due to mute.");
        }
        // Keep gameState.musicShouldBePlaying as it was (user intent)

    } else { // Unmuting
        if (music) music.muted = false;
        if (sfxPurchase) sfxPurchase.muted = false;
        if (sfxPowerup) sfxPowerup.muted = false;

        // Restore volume level using setVolume to apply correctly
        // Use saved lastVolume, fallback to lastVolumeBeforeMute (transient), fallback to 0.1
        const restoreVol = (gameState.lastVolume > 0) ? gameState.lastVolume : (lastVolumeBeforeMute > 0 ? lastVolumeBeforeMute : 0.1);
        setVolume(restoreVol); // This also updates slider.value

        // Only resume playing if it was *intended* to be playing
        if (musicShouldBePlaying && music && music.paused) {
            playCurrentTrack();
        }
    }
    updateMuteButtonVisuals();
    updatePlayPauseIcon(); // Also update play/pause icon as mute affects playback state
}


export function updateMuteButtonVisuals() {
    const btn = domElements['mute-button'];
    const slider = domElements['volume-slider'];
    if (!btn || !slider) return;

    // Consider muted if state is muted OR if slider is at absolute 0
    const isEffectivelyMuted = gameState.isMuted || parseFloat(slider.value) === 0;

    btn.textContent = isEffectivelyMuted ? '🔇' : '🔊';
    btn.classList.toggle('muted', isEffectivelyMuted);
    btn.title = isEffectivelyMuted ? "Unmute All Audio" : "Mute All Audio";
}

export function playSoundEffect(audioElementId) {
     const audioElement = domElements[audioElementId];
     if (!audioElement || gameState.isMuted) return; // Don't play if muted

     // Reset playback position and play
     audioElement.currentTime = 0;
     audioElement.play().catch(e => {
         // Ignore errors often caused by rapid consecutive plays (AbortError)
         if (e.name !== 'AbortError') {
             console.warn(`SFX play failed (${audioElementId}):`, e);
         }
     });
}