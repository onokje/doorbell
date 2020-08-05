# Doorbell script

This application listens for a button press, plays a sound and sends a message over mqtt.
This was created for the raspberry pi, but in theory it should work on any platform that has gpio, network and audio.

## Install:

This is a NodeJS application. So install that first. After NodeJS is installed, run the following:

- run `sudo apt-get install libasound2-dev` (speaker backend)
- run `npm install` or `yarn`
- run `cp .env.dist .env`
- Enter your mqtt url, username and password in `.env`. Change the button pin number if needed.

## Start the script:

- `node index.js`


## How to use:
By default, the script should play the Asterix sound when the button is pressed. To change this, send a mqtt message to topic: `commands/doorbell/changering` with a payload of the filename for the sound you want. You can put sound own sounds in the `sounds` folder. The sound files need to be wav files. MP3 or anything else won't work.

When the button is pressed, the application will send a mqtt message to topic `events/doorbellRang` with payload `Doorbell ringing!`.

To test the doorbell (without pressing the actual button), you can also send a mqtt message to topic `commands/doorbell/test` (payload won't matter, it will be ignored).