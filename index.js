var Service, Characteristic;
var SerialPort = require("serialport");
var inherits = require('util').inherits;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-lgtv-rs232c", "LGTVRS232C", LGTVRS232C);
}

function LGTVRS232C(log, config) {
    this.log = log;

    this.path = config["path"];
    this.name = config["name"] || "LG TV";
    this.manufacturer = config["manufacturer"] || "LG";
    this.model = config["model"] || "Model not available";
    this.serial = config["serial"] || "Non-defined serial";

    this.timeout = config.timeout || 1000;
    this.queue = [];
    this.callbackQueue = [];
    this.ready = true;

    this.serialPort = new SerialPort(this.path, {
        baudrate: 9600,
        parser: SerialPort.parsers.readline("\r"),
        autoOpen: false
    }); // this is the openImmediately flag [default is true]
        
    this.serialPort.on('data', function(data) {
        this.log("Received data: " + data);
        this.serialPort.close(function(error) {
            this.log("Closing connection");
            if(error) this.log("Error when closing connection: " + error)
            var callback;
            if(this.callbackQueue.length) callback = this.callbackQueue.shift()
                if(callback) callback(data,0);
            }.bind(this)); // close after response
        }.bind(this));
}

LGTVRS232C.prototype = {

    send: function(cmd, callback) {
        this.sendCommand(cmd, callback);
    },
        
    exec: function() {
        // Check if the queue has a reasonable size
        if(this.queue.length > 50) {
            this.queue.clear();
            this.callbackQueue.clear();
        }
        
        this.queue.push(arguments);
        this.process();
    },
        
    sendCommand: function(command, callback) {
        this.log("serialPort.open");
        if(this.serialPort.isOpen()){
            this.log("serialPort is already open...");
            if(callback) callback(0,1);
        }
        else{
            this.serialPort.open(function (error) {
                             if(error) {
                                this.log("Error when opening serialport: " + error);
                                if(callback) callback(0,error);
                             }
                             else {
                                 if(callback) this.callbackQueue.push(callback);
                                 this.serialPort.write(command, function(err) {
                                                   if(err) this.log("Write error = " + err);
                                                   }.bind(this));
                             }
                             }.bind(this));
        }
    },

    process: function() {
        if (this.queue.length === 0) return;
        if (!this.ready) return;
        var self = this;
        this.ready = false;
        this.send.apply(this, this.queue.shift());
        
        setTimeout(function () {
                   self.ready = true;
                   self.process();
                   }, this.timeout);
    },

    setPowerState: function(value, callback) {
        var self = this;
        var cmd = value?"ka 01 00\r":"ka 01 01\r";
        this.exec(cmd, function(response,error) {
                  if (error) {
                  this.log('Serial power function failed: %s');
                  if(callback) callback(error);
                  }
                  else {
                  this.log('Serial power function succeeded!');
                  if(callback) callback();
                  }
                  }.bind(this));
    },

    getPowerState: function (callback) {
        var self = this;
        cmd = "OK01\r";
        this.exec(cmd, function(response,error) {
                  
                  this.log("Power state is: " + response);
                  if (response && response.includes("OK01")) {
                  if(callback) callback(null, true);
                  }
                  else {
                  if(callback) callback(null, false);
                  }
                  }.bind(this))
    },

    setGameState: function(value, callback) {
        var self = this;
        var cmd = value?"AVMD3   \r":"AVMD17  \r";
        this.exec(cmd, function(response,error) {
                  if (error) {
                  this.log('Serial game mode function failed: %s');
                  if(callback) callback(error);
                  }
                  else {
                  this.log('Serial game mode function succeeded!');
                  if(callback) callback();
                  }
                  }.bind(this));
    },

    getGameState: function (callback) {
        var self = this;
        cmd = "AVMD????\r";
        this.exec(cmd, function(response, error) {
                  
                  this.log("Game state is:", response);
                  if (response && response.includes("3")) {
                  callback(null, true);
                  }
                  else {
                  callback(null, false);
                  }
                  }.bind(this))
    },

    setInputState: function(value, callback) {
        var self = this;
        // var cmd = "IAVD"+value+"   \r";
        var cmd = "kb 01 0"+value+"\r";
        this.exec(cmd, function(response,error) {
                  if (error) {
                  this.log('Serial input mode function failed: %s');
                  if(callback) callback(error);
                  }
                  else {
                  this.log('Serial input mode function succeeded!');
                  if(callback) callback();
                  }
                  }.bind(this));
    },

    getInputState: function (callback) {
        var self = this;
        cmd = "kb 01 FF\r";
        this.exec(cmd, function(response, error) {
                  
                  this.log("Input state is:", response);
                  if (response && response.includes("OK02x")) {
                  callback(null, 1);
                  }
                  else if (response && response.includes("OK03x")) {
                  callback(null, 2);
                  }
                  else if (response && response.includes("OK04x")) {
                  callback(null, 3);
                  }
                  else if (response && response.includes("OK05x")) {
                  callback(null, 4);
                  }
                  else if (response && response.includes("OK06x")) {
                  callback(null, 5);
                  }
                  else if (response && response.includes("OK07x")) {
                  callback(null, 6);
                  }
                  else if (response && response.includes("OK08x")) {
                  callback(null, 7);
                  }
                  else if (response && response.includes("OK09x")) {
                  callback(null, 8);
                  }
                  else if (response && response.includes("OK0ax")) {
                  callback(null, 9);
                  }
                  else {
                  callback(null, 0);
                  }
                  }.bind(this))
    },

    identify: function (callback) {
        callback();
    },

    getServices: function () {
        var service = new Service.AccessoryInformation();
        service.setCharacteristic(Characteristic.Name, this.name)
               .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
               .setCharacteristic(Characteristic.Model, this.model);

        var switchService = new Service.Switch(this.name);
        switchService.getCharacteristic(Characteristic.On)
                     .on('set', this.setPowerState.bind(this))
                     .on('get', this.getPowerState.bind(this));

        makeInputStateCharacteristic();

        switchService.addCharacteristic(InputStateCharacteristic)
                     .on('set', this.setInputState.bind(this))
                     .on('get', this.getInputState.bind(this));

        makeGameStateCharacteristic();

        switchService.addCharacteristic(GameStateCharacteristic)
                     .on('set', this.setGameState.bind(this))
                     .on('get', this.getGameState.bind(this));

        return [service, switchService];
    }
};

function makeGameStateCharacteristic() {
    GameStateCharacteristic = function () {
        Characteristic.call(this, 'Game Mode State', '212131F4-2E14-4FF4-AE13-C97C3232499E');
        this.setProps({
                      format: Characteristic.Formats.BOOL,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        this.value = this.getDefaultValue();
    };
    
    inherits(GameStateCharacteristic, Characteristic);
}

function makeInputStateCharacteristic() {
    InputStateCharacteristic = function () {
        Characteristic.call(this, 'Input State', '212131F4-2E14-4FF4-AE13-C97C3232499D');
        this.setProps({
                      format: Characteristic.Formats.INT,
                      unit: Characteristic.Units.NONE,
                      maxValue: 5,
                      minValue: 0,
                      minStep: 1,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        this.value = this.getDefaultValue();
    };
    
    inherits(InputStateCharacteristic, Characteristic);
}
