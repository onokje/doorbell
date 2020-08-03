const Gpio = require('onoff').Gpio;
const button = new Gpio(4, 'in', 'rising', {debounceTimeout: 10});

button.watch(function (err, value) {
    if (err) {
        throw err;
    }

    console.log(value);

    if (value === 1){
        console.log(new Date().toLocaleString() + " button triggered");

    }

});

process.on('SIGINT', function () {
    console.log('Exiting...');
    button.unexport();
});
console.log('ready');
