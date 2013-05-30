"use strict";

var util = require("./util");
var wrap = util.wrap;
var MemoryAscoltatore = require("./memory_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var debug = require("debug")("ascoltatori:mqtt");
var SubsCounter = require("./subs_counter");

/**
 * MQTTAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `mqtt` package and it could be
 * backed up by any MQTT broker out there.
 *
 * The options are:
 *  - `keepalive`, the keepalive timeout in seconds (see the MQTT spec), the default is 3000;
 *  - `port`, the port to connect to;
 *  - `host`, the host to connect to;
 *  - `mqtt`, the mqtt module (it will automatically be required if not present).
 *
 * @api public
 * @param {Object} opts The options object
 */
function MQTTAscoltatore(opts) {
  AbstractAscoltatore.call(this);

  this._opts = opts || {};
  this._opts.keepalive = this._opts.keepalive || 3000;
  this._opts.qos = this._opts.qos || 0;
  this._opts.mqtt = this._opts.mqtt || require("mqtt");

  this._subs_counter = new SubsCounter();

  this._ascoltatore = new MemoryAscoltatore();
  this._ascoltatore.on("newTopic", this.emit.bind(this, "newTopic"));
  this._startConn();
}

/**
 * MQTTAscoltatore inherits from AbstractAscoltatore
 *
 * @api private
 */
MQTTAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

/**
 * Starts a new connection to an MQTT server.
 * Do nothing if it is already started.
 *
 * @api private
 */
MQTTAscoltatore.prototype._startConn = function() {
  var that = this,
    settings = null;
  if (this._client === undefined) {
    settings = {
      keepalive: that._opts.keepalive,
      clientId: util.buildIdentifier(),
      qos: that._opts.qos
    };

    debug("connecting..");
    this._client = that._opts.mqtt.createClient(that._opts.port, that._opts.host, settings);
    this._client.setMaxListeners(0);
    this._client.on("connect", function() {
      debug("connected");
      that.emit("ready");
    });
    this._client.on("message", function(topic, payload, packet) {
      debug("received new packet on topic " + topic);
      // we need to skip out this callback, so we do not
      // break the client when an exception occurs
      util.defer(function() {
        that._ascoltatore.publish(topic, payload, packet);
      });
    });
    this._client.on('error', function(e) {
      debug("error in the client");

      delete that._client;
      that.emit("error", e);
    });
  }
  return this._client;
};

MQTTAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();

  if (!this._subs_counter.include(topic)) {
    debug("registering new subscriber for topic " + topic);

    var opts = {
      qos: 1
    };
    this._client.subscribe(topic.replace("*", "#"), opts, function() {
      debug("registered new subscriber for topic " + topic);
      util.defer(done);
    });
  } else {
    util.defer(done);
  }

  this._subs_counter.add(topic);
  this._ascoltatore.subscribe(topic, callback);
};

MQTTAscoltatore.prototype.publish = function publish(topic, message, options, done) {
  this._raiseIfClosed();

  this._client.publish(topic, String(message), {
    qos: (options && (options.qos !== undefined)) ? options.qos : 1
  }, function() {
    debug("new message published to " + topic);
    wrap(done)();
  });
};

MQTTAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  var newDone = null;

  newDone = function() {
    debug("deregistered subscriber for topic " + topic);
    util.defer(done);
  };

  this._ascoltatore.unsubscribe(topic, callback);
  this._subs_counter.remove(topic);

  if (this._subs_counter.include(topic)) {
    newDone();
    return;
  }

  debug("deregistering subscriber for topic " + topic);
  this._client.unsubscribe(topic.replace("*", "#"), newDone);
};

MQTTAscoltatore.prototype.close = function close(done) {
  var that = this;
  debug("closing");
  if (!this._closed) {
    this._subs_counter.clear();
    this._client.once("close", function() {
      debug("closed");
      that._ascoltatore.close();
      delete that._client;
      that.emit("closed");
      util.defer(done);
    });
    this._client.end();
  } else {
    wrap(done)();
  }
};

util.aliasAscoltatore(MQTTAscoltatore.prototype);

/**
 * Exports the MQTTAscoltatore
 *
 * @api public
 */
module.exports = MQTTAscoltatore;
