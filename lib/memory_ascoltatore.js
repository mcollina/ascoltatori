"use strict";

var EventEmitter = require('events').EventEmitter;
var AbstractAscoltatore = require("./abstract_ascoltatore");
var SubsCounter = require("./subs_counter");
var util = require("./util");
var wrap = util.wrap;
var defer = util.defer;
var debug = require("debug")("ascoltatori:memory");

/**
 * A MemoryAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is backend by an EventEmitter and an object-map.
 *
 * @api public
 */
function MemoryAscoltatore() {
  AbstractAscoltatore.call(this);

  this._event = new EventEmitter();
  this._set = new SubsCounter();
  this.emit("ready");

  // avoid problems with listeners
  this._event.setMaxListeners(0);
}


/**
 * See AbstractAscoltatore for the public API definitions.
 *
 * @api private
 */

MemoryAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

function containsWildcard(topic) {
  return topic.indexOf("*") >= 0;
}

MemoryAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();
  debug("registered new subscriber for topic " + topic);
  if (containsWildcard(topic)) {
    var regexp = new RegExp(topic.replace("*", ".+")),
      that = this,
      handler = null;

    handler = function(e) {
      if (e.match(regexp)) {
        that.sub(e, callback);
      }
    };
    callback._ascoltatori_global_handler = handler;
    this._set.forEach(handler);
    this.on("newTopic", handler);
  } else {
    if (!this._set.include(topic)) {
      this._set.add(topic);
      this.emit("newTopic", topic);
      debug("new topic: " + topic);
    }
    this._event.on(topic, callback);
  }

  defer(done);
};

MemoryAscoltatore.prototype.publish = function publish(topic, message, options, done) {
  this._raiseIfClosed();
  debug("new message published to " + topic);

  if (!this._set.include(topic)) {
    this._set.add(topic);
    this.emit("newTopic", topic);
    debug("new topic: " + topic);
  }
  this._event.emit(topic, topic, message, options);

  defer(done);
};

MemoryAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  debug("deregistered subscriber for topic " + topic);

  var that = this,
    regexp = null;
  if (containsWildcard(topic)) {
    this.removeListener("newTopic", callback._ascoltatori_global_handler);
    regexp = new RegExp(topic.replace("*", ".+"));
    this._set.forEach(function(e) {
      if (e.match(regexp)) {
        that.unsub(e, callback);
      }
    });
  } else {
    this._set.remove(topic);
    this._event.removeListener(topic, callback);
  }

  defer(done);
};

MemoryAscoltatore.prototype.close = function close(done) {
  this._set.clear();
  this._event.removeAllListeners();
  this.emit("closed");

  debug("closed");

  defer(done);
};

MemoryAscoltatore.prototype.registerDomain = function(domain) {
  debug("registered domain");
  domain.add(this._event);
};

util.aliasAscoltatore(MemoryAscoltatore.prototype);

/**
 * Exports the MemoryAscoltatore.
 *
 * @api public
 */
module.exports = MemoryAscoltatore;
