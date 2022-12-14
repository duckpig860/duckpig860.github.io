/**
 * @file audiomanager.class.js
 * @version 1.0.0
 */

import config from '../resources/config.js';
import resources from '../resources/resources.js';

export default class AudioManager {
    static _init() {
        AudioManager._sounds = new Map();
        AudioManager._tagInstance = new Map();
    }

    static asyncLoadSounds() {
        return Promise.all(Object.keys(resources.sounds).map(name => {
            const info = resources.sounds[name];
            const url = `./sounds/${info.path}${config.debug.preventCaching ? '?time=' + new Date().getTime() : ''}`;

            return fetch(url, { cache: 'no-cache' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(response.statusText);
                    }

                    return response.blob();
                })
                .then(blob => {
                    AudioManager._sounds.set(name, {
                        instances: Array.from({ length: info.count }, () => {
                            const source = document.createElement('source');
                            source.src = URL.createObjectURL(blob);
                            source.type = info.type;

                            const audio = new Audio();
                            audio.appendChild(source);
                            audio.load();

                            return audio;
                        }),
                        nextInstance: 0,
                        count: info.count,
                        baseVolume: info.baseVolume,
                    });
                })
                .catch(error => {
                    throw new Error(`Error loading sound file "${url}", ${error}`);
                });
        }));
    }

    /**
     * Play an audio instance.
     * @param {string} soundName - The sound name.
     * @param {string} [volume] - The sound volume. Defaults to 1.
     * @param {bool} [loop] - Whether the sound should loop. Defaults to false.
     * @param {bool} [restart] - Whether to restart the new audio instance if it is already playing. Defaults to true.
     * @param {object} [tag] - A tag identifying the new audio instance. Disabled by default.
     * @param {bool} [stopTagIfNotSame] - Whether to stop the old tag audio instance if not same as the new audio instance. Defaults to true.
     * @param {number} [currentTime] - The audio start time. Defaults to 0.
     */
    static play(soundName, volume = 1, loop = false, restart = true,
        tag = null, stopTagIfNotSame = true, currentTime = 0) {
        if (config.audio.mute) {
            return;
        }

        const sound = AudioManager._sounds.get(soundName);
        if (sound === undefined) {
            throw new Error(`Sound "${soundName}" does not exist`);
        }

        const instance = sound.instances[sound.nextInstance];
        sound.nextInstance = (sound.nextInstance + 1) % sound.instances.length;

        if (tag !== null) {
            const oldInstance = AudioManager._tagInstance.get(tag);
            if (oldInstance !== undefined && stopTagIfNotSame && oldInstance !== instance) {
                oldInstance.pause();
            }
            AudioManager._tagInstance.set(tag, instance);
        }

        instance.volume = Math.max(0, Math.min(1, volume * sound.baseVolume * config.audio.volume));
        instance.loop = loop;

        if (instance.paused || restart) {
            if (instance.currentTime !== 0) {
                instance.currentTime = 0;
            }
            instance.play();
        }

        return instance;
    }

    static stop(tag) {
        if (AudioManager._tagInstance.has(tag)) {
            AudioManager._tagInstance.get(tag).pause();
            AudioManager._tagInstance.delete(tag);
        }
    }

    static stopAll() {
        AudioManager._sounds.forEach(sound => {
            sound.instances.forEach(instance => instance.pause);
        });
    }

    static getSoundNames() {
        return Array.from(AudioManager._sounds.keys());
    }

    static getAudioInstance(soundName, index = 0) {
        const sound = AudioManager._sounds.get(soundName);
        if (sound === undefined) {
            throw new Error(`Sound "${soundName}" does not exist`);
        }
        return sound.instances[index];
    }

    static asyncPlaySilenceOnUserGesture() {
        return new Promise(resolve => {
            // https://gist.github.com/novwhisky/8a1a0168b94f3b6abfaa
            const silence = new Audio(
                'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');

            const play = () => {
                silence.play()
                    .then(() => {
                        document.removeEventListener('click', play, true);
                        document.removeEventListener('touchend', play, true);
                        document.removeEventListener('keydown', play, true);

                        resolve();
                    });
            };

            document.addEventListener('click', play, true);
            document.addEventListener('touchend', play, true);
            document.addEventListener('keydown', play, true);
        });
    }
}

AudioManager._init();
