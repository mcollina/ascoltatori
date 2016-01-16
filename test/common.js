"use strict";

global.sinon = require("sinon");
global.chai = require("chai");
global.expect = require("chai").expect;
global.async = require("async");

global.redisSettings = function() {
  return {
    json: false,
    redis: require('redis'),
    port: 6379,
    host: '127.0.0.1'
  };
};

var portCounter = 7042;
global.nextPort = function() {
  return ++portCounter;
};

global.zeromqSettings = function(remote_ports) {
  return {
    json: false,
    zmq: require("zmq"),
    port: "tcp://127.0.0.1:" + global.nextPort(),
    controlPort: "tcp://127.0.0.1:" + global.nextPort(),
    delay: 10
  };
};

global.AMQPSettings = function() {
  return {
    json: false,
    amqp: require("amqp"),
    exchange: "ascolatore" + global.nextPort()
  };
};

global.MQTTSettings = function() {
  return {
    json: false,
    mqtt: require("mqtt"),
    host: "127.0.0.1",
    port: 5883
  };
};

global.mongoSettings = function() {
  return {
    url: 'mongodb://127.0.0.1/ascoltatoriTests?auto_reconnect=true',
    pubsubCollection: 'pubsub',
    json: false,
    mongo: {} // put here your mongo-specific options!
  };
};

global.trieSettings = function() {
  return {
    json: false
  };
};

global.fileSystemSettings = function() {
  return {
    json: false
  };
};

global.eventEmitter2Settings = function() {
  return {
    json: false
  };
};

global.trieSettings = function() {
  return {
    json: false
  };
};

global.decoratorSettings = function() {
  var r = global.trieSettings();
  r.WrappedAscoltatore = global.ascoltatori.TrieAscoltatore;
  return r;
};

global.JSONSettings = global.decoratorSettings;

global.prefixSettings = function() {
  var r = global.decoratorSettings();
  r.args = [this.separator + "myprefix"];
  return r;
};

var mosca = require("mosca");

global.mqttServer = new mosca.Server({
  port: 5883,
  stats: false,
  logger: {
    level: "fatal"
  }
});

if (process.env.COVER) {
  global.ascoltatori = require("../lib-cov/ascoltatori");
} else {
  global.ascoltatori = require("../");
}

global.wrap = require("../lib/util").wrap;

global.chai.use(require("sinon-chai"));

global.check_no_topic_transform = function () {
  it("should not transform topics", function () {
    global.expect(this.instance._reInSeparator).not.to.exist;
    global.expect(this.instance._reOutSeparator).not.to.exist;
    global.expect(this.instance._reInWildcardOne).not.to.exist;
    global.expect(this.instance._reInWildcardSome).not.to.exist;

    var s = '';
    for (var i = 0; i < 256; i += 1) {
      s += String.fromCharCode(i);
    }

    global.expect(this.instance._subTopic(s)).to.equal(s);
    global.expect(this.instance._recvTopic(s)).to.equal(s);
    global.expect(this.instance._pubTopic(s)).to.equal(s);
  });
};

function intercept(instance, separator, wildcardOne, wildcardSome)
{
  var replace_sep = function(topic) {
    return topic.replace(/\//g, separator);
  };
  var replace_all = function(topic) {
    return replace_sep(topic)
           .replace(/\+/g, wildcardOne)
           .replace(/\*/g, wildcardSome);
  };
  var subscribe = instance.subscribe;
  var unsubscribe = instance.unsubscribe;
  var publish = instance.publish;
  instance.subscribe = function(topic, callback, done) {
    subscribe.call(this, replace_all(topic), callback, done);
  };
  instance.unsubscribe = function(topic, callback, done) {
    unsubscribe.call(this, replace_all(topic), callback, done);
  };
  instance.publish = function(topic, message, options, done) {
    publish.call(this, replace_sep(topic), message, options, done);
  };
  instance.sub = instance.subscribe;
  instance.unsub = instance.unsubscribe;
  instance.pub = instance.publish;
}

global.describeAscoltatore = function(type, f) {
  var typeCap = type[0].toUpperCase() + type.slice(1) + "Ascoltatore",
      makeSettings = global[type + "Settings"];

  var test = function(custom, separator, wildcardOne, wildcardSome, f2) {
    describe("ascoltatori." + typeCap + (custom || ""), function () {
      beforeEach(function(done) {
        this.separator = separator || "/";
        var settings = makeSettings.call(this),
            args = settings.args || [];
        if (custom) {
          settings.separator = separator;
          settings.wildcardOne = wildcardOne;
          settings.wildcardSome = wildcardSome;
        }
        if (settings.WrappedAscoltatore) {
          this.wrapped = settings = new settings.WrappedAscoltatore(settings);
          if (custom) {
            intercept(this.wrapped, separator, wildcardOne, wildcardSome);
          }
        }
        args.push(settings);
        this.instance = new global.ascoltatori[typeCap](args[0], args[1]);
        if (custom) {
          intercept(this.instance, separator, wildcardOne, wildcardSome);
        }
        this.instance.on("ready", done);
      });
      global.ascoltatori.behaveLikeAnAscoltatore();
      if (f) { f(); }
      if (f2) { f2(); }
    });
  };

  test();
  test("DifferentWildcardAndSeparator", "|", "!", "$");
  test("MQTTWildcardAndSeparator", "/", "+", "#", function () {
    if (type === "MQTT") {
      global.check_no_topic_transform();
    }
  });
};
