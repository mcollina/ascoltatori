"use strict";

global.sinon = require("sinon");
global.chai = require("chai");
global.expect = require("chai").expect;
global.async = require("async");

global.redisSettings = function() {
  return {
    json: false,
    redis: require('redis')
  };
};

var portCounter = 9042;
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

global.rabbitSettings = function() {
  return {
    json: false,
    amqp: require("amqp"),
    exchange: "ascolatore" + global.nextPort()
  };
};

global.mqttSettings = function() {
  return {
    json: false,
    mqtt: require("mqtt"),
    host: "127.0.0.1",
    port: 5883
  };
};

global.mongoSettings = function() {
  return {
    uri: 'mongodb://127.0.0.1/',
    db: 'ascoltatori',
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

var mosca = require("mosca");

global.mqttServer = new mosca.Server({
  port: 5883,
  logger: {
    level: "fatal"
  }
});

if (process.env.COVER) {
  global.ascoltatori = require("../lib-cov/ascoltatori");
} else {
  global.ascoltatori = require("../");
}

global.behaveLikeAnAscoltatore = function (Class, type, makeSettings) {
  describe("can be used by ascoltatori", function () {
    global.ascoltatori.canBeUsedByAscoltatori(Class, type, makeSettings);
  });

  global.ascoltatori.behaveLikeAnAscoltatore();
};

global.wrap = require("../lib/util").wrap;

global.chai.use(require("sinon-chai"));
