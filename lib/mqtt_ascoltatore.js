"use strict";

var util = require("./util");
var wrap = util.wrap;
var defer = util.defer;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var debug = require("debug")("ascoltatori:mqtt");
var SubsCounter = require("./subs_counter");
var steed = require("steed")();

/**
 * MQTTAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `mqtt` package and it could be
 * backed up by any MQTT broker out there.
 *
 * The options are:
 *  - `url`: the URL to connect to, as defined in https://www.npmjs.com/package/mqtt#connect
 *  -  ... all the options defined in https://www.npmjs.com/package/mqtt#connect
 *
 * @api public
 * @param {Object} opts The options object
 */
function MQTTAscoltatore(opts) {
  AbstractAscoltatore.call(this, opts, {
    separator: '/',
    wildcardOne: '+',
    wildcardSome: '#'
  });

  this._opts = opts || {};
  this._opts.keepalive = this._opts.keepalive || 3000;
  this._opts.mqtt = this._opts.mqtt || require("mqtt");

  this._subs_counter = new SubsCounter();

  this._ascoltatore = new TrieAscoltatore(opts);
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
  var that = this;
  var url = that._opts.url;
  var settings = null;

  if (this._client === undefined) {
    debug("connecting..");
    if (url) {
      this._client = this._opts.mqtt.connect(url, that._opts);
    } else {
      this._client = this._opts.mqtt.connect(that._opts);
    }

    this._client.setMaxListeners(0);
    this._client.on("connect", function() {
      debug("connected");
      that.reconnectTopics(function(){
        that.emit("ready");
      });
    });
    this._client.on("message", function(topic, payload, packet) {
      debug("received new packet on topic " + topic);
      // we need to skip out this callback, so we do not
      // break the client when an exception occurs
      defer(function() {
        that._ascoltatore.publish(that._recvTopic(topic), payload, packet);
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

MQTTAscoltatore.prototype.reconnectTopics = function reconnectTopics(cb) {
  var that = this;

  var subscribedTopics = that._subs_counter.keys();

  var opts = {
    qos: 1
  };

  steed.each(subscribedTopics, function(topic, callback) {
    that._client.subscribe(that._subTopic(topic), opts, function() {
      debug("re-registered subscriber for topic " + topic);
      callback();
    });
  }, function(){
    cb();
  });

};

MQTTAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();

  if (!this._subs_counter.include(topic)) {
    debug("registering new subscriber for topic " + topic);

    var opts = {
      qos: 1
    };
    this._client.subscribe(this._subTopic(topic), opts, function() {
      debug("registered new subscriber for topic " + topic);
      defer(done);
    });
  } else {
    defer(done);
  }

  this._subs_counter.add(topic);
  this._ascoltatore.subscribe(topic, callback);
};

MQTTAscoltatore.prototype.publish = function publish(topic, message, options, done) {
  this._raiseIfClosed();

  this._client.publish(this._pubTopic(topic), message, {
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
    defer(done);
  };

  this._ascoltatore.unsubscribe(topic, callback);
  this._subs_counter.remove(topic);

  if (this._subs_counter.include(topic)) {
    newDone();
    return;
  }

  debug("deregistering subscriber for topic " + topic);
  this._client.unsubscribe(this._subTopic(topic), newDone);
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
      defer(done);
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
