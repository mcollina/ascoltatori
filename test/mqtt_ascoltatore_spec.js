var steed = require('steed')();

describeAscoltatore("MQTT", function() {

  afterEach(function(done) {
    this.instance.close(function() {
      done();
    });
    delete this.instance;
  });

  it("should sync two instances", function(done) {
    var other = new ascoltatori.MQTTAscoltatore(MQTTSettings());
    var that = this;
    steed.series([

      function(cb) {
        other.on("ready", cb);
      },

      function(cb) {
        that.instance.subscribe("hello", wrap(done), cb);
      },

      function(cb) {
        other.publish("hello", null, cb);
      },

      function(cb) {
        other.close(cb);
      }
    ]);
  });

  it("should publish with options", function(done) {
    var that = this;
    mqttServer.once('published', function(packet) {
      expect(packet.qos).to.eql(0);
      done();
    });
    that.instance.publish("hello/123", "42", { qos: 0 });
  });

});

describe("MQTT Reconnect Test", function() {
  it("should re-subscribe to topics", function(done) {
    this.timeout(3000); // Set the test timeout to 3s

    var that = this;
    var mosca = require("mosca");
    var msgReceived = false;

    var moscaOpts = {
      port: 6884,
      stats: false,
      logger: {
        level: "fatal"
      }
    };

    var clientOpts = {
      json: false,
      mqtt: require("mqtt"),
      host: "127.0.0.1",
      port: 6884
    };

    var mqttTestServer = new mosca.Server(moscaOpts);
    var newClient = new ascoltatori.MQTTAscoltatore(clientOpts);

    steed.series([
      function(cb) {
        newClient.once('ready',cb);
      },

      function(cb) {
        // Subscribe to topic for test
        newClient.subscribe('reconnect/test', function() {
          newClient.emit('success');
        }, cb);
      },

      // Stop the MQTT server
      function(cb) {
        mqttTestServer.close(cb);
      },

      // Start the MQTT server
      function(cb) {
        mqttTestServer = new mosca.Server(moscaOpts, cb);
      },

      // Setup listener and send message
      function(cb) {
        newClient.once('success', function() {
          msgReceived = true;
          cb();
        });

        newClient.once('ready', function(){
          newClient.publish('reconnect/test', 'blah');
        });
      },

    ], function() {
      if (msgReceived) {
        done();
      }
    });

  });
});
