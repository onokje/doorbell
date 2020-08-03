require('dotenv').config();
const {MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, BUTTON_PIN} = process.env;

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
    client.subscribe('commands/doorbell/#', function (err) {
        if (!err) {
            client.publish('events', 'Doorbell online')
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
        case 'commands/doorbell/test':
            log('Incoming message: Doorbell test');
            // play sound
            playSound(wavBuffer, () => {
                console.log('Play sound complete.');
                playing = false;
            });
            break;
        case 'commands/doorbell/changering':
            log('Incoming message: change doorbell ring sound');
            // change sound
            switch (message.toString()) {
                case 'asterix':
                    loadFile('doorbell_asterix.wav');
                break;
                case 'fart':
                    loadFile('doorbell_fart.wav');
                    break;
                case 'lounge':
                    loadFile('doorbell_lounge_gong.wav');
                    break;
                case 'starwars':
                    loadFile('doorbell_starwars.wav');
                    break;
                case 'chewbacca':
                    loadFile('doorbell_chewbacca.wav');
                    break;
                case 'tardis':
                    loadFile('doorbell_tardis.wav');
                    break;
                case 'classic':
                    loadFile('doorbell_classic_fast.wav');
                    break;
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

        client.publish('events/doorbellRang', 'Doorbell ringing!');
    }

});

process.on('SIGINT', function () {
    log('Exiting...');
    button.unexport();
});
