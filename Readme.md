# Doorbell

Listens for a GPIO button press, plays a WAV sound, and publishes an MQTT event. Built for Raspberry Pi but works on any platform with GPIO, audio, and network.

---

## Installation on Raspberry Pi (Raspbian Lite)

### 1. Install Node.js

Raspbian's built-in Node.js package is too old. Install a current LTS release via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x.x
```

### 2. Install system dependencies

```bash
sudo apt-get install -y libasound2-dev git
```

`libasound2-dev` is required to compile the `speaker` audio backend.

### 3. Create a dedicated user

The service runs as an unprivileged `doorbell` user. It needs access to the GPIO and audio subsystems:

```bash
sudo useradd -r -s /usr/sbin/nologin doorbell
sudo usermod -aG gpio,audio doorbell
```

### 4. Deploy the application

```bash
sudo mkdir /opt/doorbell
sudo git clone https://github.com/your-user/doorbell.git /opt/doorbell
# or copy the files manually:
# sudo cp -r /path/to/doorbell/* /opt/doorbell/

cd /opt/doorbell
sudo npm install --omit=dev
sudo chown -R doorbell:doorbell /opt/doorbell
```

### 5. Configure environment variables

```bash
sudo cp /opt/doorbell/.env.dist /opt/doorbell/.env
sudo nano /opt/doorbell/.env
```

Fill in your MQTT broker URL, credentials, and GPIO pin number. The file looks like this:

```
MQTT_URL=mqtt://your-broker-host
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password
BUTTON_PIN=4
MQTT_TOPIC_BUTTON_PRESS=events/doorbellRang
MQTT_TOPIC_TEST=commands/doorbell/test
MQTT_TOPIC_CHANGE_RINGTONE=commands/doorbell/changering
MQTT_TOPIC_ONLINE_STATUS=status/doorbell
```

Restrict permissions so credentials are not world-readable:

```bash
sudo chmod 600 /opt/doorbell/.env
```

### 6. Install the systemd service

```bash
sudo cp /opt/doorbell/doorbell.service /etc/systemd/system/doorbell.service
sudo systemctl daemon-reload
sudo systemctl enable doorbell
sudo systemctl start doorbell
```

Check that it started correctly:

```bash
sudo systemctl status doorbell
sudo journalctl -u doorbell -f
```

---

## Managing the service

| Action | Command |
|---|---|
| Start | `sudo systemctl start doorbell` |
| Stop | `sudo systemctl stop doorbell` |
| Restart | `sudo systemctl restart doorbell` |
| View logs | `sudo journalctl -u doorbell -f` |
| Disable autostart | `sudo systemctl disable doorbell` |

---

## Development / manual start

To run the app directly without the service (useful for testing on a Pi):

```bash
cd /opt/doorbell
node index.js
```

To simulate a button press without physical hardware, publish an MQTT message to the test topic:

```bash
mosquitto_pub -h your-broker -u your_username -P your_password \
  -t commands/doorbell/test -m test
```

---

## How it works

- **Button press** → plays the current ringtone WAV and publishes to `events/doorbellRang` with payload `Doorbell ringing!`
- **Change ringtone** → publish a filename (e.g. `doorbell_tardis.wav`) to `commands/doorbell/changering`. The file must exist in the `sounds/` directory and be a WAV file.
- **Test ring** → publish anything to `commands/doorbell/test` to trigger the same behaviour as a physical button press.
- **Online status** → on MQTT connect the app publishes `online` to `status/doorbell`.

Sound files live in `sounds/` and must be WAV format.

---

## Optional: MQTT over TLS

To connect to a broker using TLS (e.g. on port 8883), change the URL scheme and set the CA certificate path in `.env`:

```
MQTT_URL=mqtts://your-broker-host:8883
MQTT_CA_CERT=/path/to/ca.crt
```
