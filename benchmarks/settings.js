
module.exports.TrieAscoltatore = function() {
  return {};
};

module.exports.EventEmitter2Ascoltatore = function() {
  return {};
};

module.exports.RedisAscoltatore = function() {
  return {
    redis: require('redis')
  };
};

var portCounter = 10042;
module.exports.nextPort = function() {
  return portCounter++;
};

module.exports.ZeromqAscoltatore = function(remote_ports) {
  return {
    zmq: require("zmq"),
    port: "tcp://127.0.0.1:" + module.exports.nextPort(),
    controlPort: "tcp://127.0.0.1:" + module.exports.nextPort(),
    delay: 0
  };
};

module.exports.AMQPAscoltatore = function() {
  return {
    amqp: require("amqp"),
    exchange: "ascolatore" + module.exports.nextPort()
  };
};

module.exports.MQTTAscoltatore = function() {
  return {
    mqtt: require("mqtt"),
    host: "127.0.0.1",
    port: 1883
  };
};
