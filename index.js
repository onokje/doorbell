require('dotenv').config();
const {
    MQTT_URL,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    BUTTON_PIN,
    MQTT_TOPIC_BUTTON_PRESS,
    MQTT_TOPIC_TEST,
    MQTT_TOPIC_CHANGE_RINGTONE,
    MQTT_TOPIC_ONLINE_STATUS
} = process.env;

const fs = require('fs');
const path = require('path');
const wav = require('wav');
const Speaker = require('speaker');
const pigpio = require('pigpio');
const Gpio = pigpio.Gpio;
const button = new Gpio(parseInt(BUTTON_PIN, 10), {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_DOWN,
    alert: true
});
button.glitchFilter(50000); // 10ms debounce (in microseconds)
const streamBuffers = require('stream-buffers');
const mqtt = require('mqtt');
const loudness = require('loudness');


const mqttOptions = { username: MQTT_USERNAME, password: MQTT_PASSWORD };
if (process.env.MQTT_CA_CERT) {
    mqttOptions.ca = fs.readFileSync(process.env.MQTT_CA_CERT);
    mqttOptions.rejectUnauthorized = true;
}
const client = mqtt.connect(MQTT_URL, mqttOptions);

loudness.setVolume(100);

function log(msg) {
    console.log(new Date().toLocaleString(), msg);
}

function sanitizeFilename(input) {
    const name = path.basename(input);
    if (!/^[\w\-]+\.wav$/i.test(name)) throw new Error(`Invalid filename: ${name}`);
    return name;
}

client.on('connect', function () {
    log('Mqtt connected');
    client.subscribe([MQTT_TOPIC_TEST, MQTT_TOPIC_CHANGE_RINGTONE], function (err) {
        if (!err) {
            client.publish(MQTT_TOPIC_ONLINE_STATUS, 'online')
        }
    })
});

let playing = false;
let wavBuffer;
let filename = 'doorbell_asterix.wav';

function loadFile(filename){
    fs.readFile(`sounds/${filename}`, function(err, data) {
        if (err) { log(`Failed to load ${filename}: ${err.message}`); return; }
        wavBuffer = data;
        log(`Wave file ${filename} loaded`);
    });
}

function playSound(wavBuf, callback) {
    // create wav reader:
    let reader = new wav.Reader();
    reader.on('format', (format) => {
        // create speaker
        let speaker = new Speaker(format);
        speaker.on('flush', callback);

        // the WAVE header is stripped from the output of the reader
        reader.pipe(speaker);
    });

    // create stream:
    let myReadableStreamBuffer = new streamBuffers.ReadableStreamBuffer({
        frequency: 10,   // in milliseconds.
        chunkSize: 2048  // in bytes.
    });
    myReadableStreamBuffer.put(wavBuf);
    myReadableStreamBuffer.pipe(reader);
    myReadableStreamBuffer.stop();
}

client.on('message', function (topic, message) {
    switch (topic) {
        case MQTT_TOPIC_TEST:
            log('Incoming message: Doorbell test');
            // play sound
            playSound(wavBuffer, () => {
                console.log('Play sound complete.');
                playing = false;
            });

            log("Sending doorbell event (test)...");
            client.publish(MQTT_TOPIC_BUTTON_PRESS, 'Doorbell ringing!');
            break;
        case MQTT_TOPIC_CHANGE_RINGTONE:
            log('Incoming message: change doorbell ring sound');
            try {
                loadFile(sanitizeFilename(message.toString()));
            } catch (e) {
                log(`Loading new sound failed: ${e.message}`);
            }
            break;
        default:
            throw Error('invalid message topic received');
    }
});

loadFile(filename);

button.on('alert', function(level, tick) {
    if (level === 1 && !playing) {
        log("Doorbell triggered, playing sound...");
        playing = true;

        playSound(wavBuffer, () => {
            console.log('Play sound complete.');
            playing = false;
        });

        log("Sending doorbell event...");

        client.publish(MQTT_TOPIC_BUTTON_PRESS, 'Doorbell ringing!');
    }
});

function shutdown() {
    log('Exiting...');
    pigpio.terminate();
    client.end();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
