# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Node.js IoT doorbell application for Raspberry Pi. It listens for a GPIO button press, plays a WAV sound, and publishes an MQTT event. Ringtone and behavior can be controlled remotely via MQTT.

## Setup

```bash
sudo apt-get install libasound2-dev   # system audio backend
npm install
cp .env.dist .env                     # then fill in credentials
```

## Running

```bash
node index.js        # start the doorbell application
node test.js         # test GPIO button input only (no MQTT/audio)
```

There is no build step, linter, or test suite — the project is a single runtime script.

## Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `MQTT_URL` | Broker URL, e.g. `mqtt://localhost` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Broker credentials |
| `BUTTON_PIN` | GPIO pin number for the doorbell button |
| `MQTT_TOPIC_BUTTON_PRESS` | Topic published when button is pressed |
| `MQTT_TOPIC_TEST` | Topic subscribed for triggering a test ring |
| `MQTT_TOPIC_CHANGE_RINGTONE` | Topic subscribed for changing the ringtone |
| `MQTT_TOPIC_ONLINE_STATUS` | Topic published on MQTT connect |

## Architecture

`index.js` is the entire application. It wires together three concerns:

1. **GPIO input** (`onoff`) — watches `BUTTON_PIN` for a rising edge with 10 ms debounce. On press, plays the current sound and publishes to `MQTT_TOPIC_BUTTON_PRESS`.

2. **Audio playback** (`wav` + `speaker`) — WAV files are loaded into a `Buffer` at startup (and on ringtone-change). `playSound()` pumps the buffer through a `ReadableStreamBuffer` → `wav.Reader` → `Speaker` pipeline. A `playing` flag prevents concurrent playback.

3. **MQTT control** (`mqtt`) — subscribes to test and ringtone-change topics. Test messages trigger the same play+publish flow as a physical button press. Ringtone-change messages call `loadFile()` with the new filename.

Sound files live in `sounds/` and must be WAV format. The default is `doorbell_asterix.wav`.

## General project and coding rules
- Project should always be compatible with any Raspberry Pi, Model 2b or later.