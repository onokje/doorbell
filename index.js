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
const wav = require('wav');
const Speaker = require('speaker');
const Gpio = require('onoff').Gpio;
const button = new Gpio(BUTTON_PIN, 'in', 'rising', {debounceTimeout: 10});
const streamBuffers = require('stream-buffers');
const mqtt = require('mqtt');
const loudness = require('loudness');


const client  = mqtt.connect(MQTT_URL, {username: MQTT_USERNAME, password: MQTT_PASSWORD});

loudness.setVolume(100);

function log(msg) {
    console.log(new Date().toLocaleString(), msg);
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
        if (err) throw err;
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
                loadFile(message.toString());
            } catch (e) {
                log(`Loading new sound "${message.toString()}" failed`);
            }
            break;
        default:
            throw Error('invalid message topic received');
    }
});

loadFile(filename);

button.watch(function (err, value) {
    if (err) {
        throw err;
    }

    if (value === 1 && !playing){
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

process.on('SIGINT', function () {
    log('Exiting...');
    button.unexport();
});
