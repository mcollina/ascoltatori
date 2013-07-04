"use strict";

var AbstractAscoltatore = require("./abstract_ascoltatore");
var util = require("./util");
var defer = util.defer;
var debug = require("debug")("ascoltatori:ee2");
var EventEmitter2 = require("eventemitter2").EventEmitter2;
var ascoltatori = require('./ascoltatori');

/**
 * A EventEmitter2Ascoltatore is a class that inherits from AbstractAscoltatore.
 * It is backed by EventEmitter2.
 *
 * @api public
 */
function EventEmitter2Ascoltatore(settings) {
  AbstractAscoltatore.call(this);

  this._event = new EventEmitter2({
    delimiter: '/',
    wildcard: true
  });

  this._event.setMaxListeners(0);

  this.emit("ready");
}


/**
 * See AbstractAscoltatore for the public API definitions.
 *
 * @api private
 */

EventEmitter2Ascoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

EventEmitter2Ascoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();
  debug("registered new subscriber for topic " + topic);

  this._event.on(topic.replace(/\*/g, '**').replace(/\+/g, '*').replace(/^\//g, ''), callback);
  defer(done);
};

EventEmitter2Ascoltatore.prototype.publish = function (topic, message, options, done) {
  this._raiseIfClosed();
  debug("new message published to " + topic);

  this._event.emit(topic.replace(/^\//g, ''), topic, message, options);

  defer(done);
};

EventEmitter2Ascoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  debug("deregistered subscriber for topic " + topic);

  this._event.off(topic, callback);

  defer(done);
};

EventEmitter2Ascoltatore.prototype.close = function close(done) {
  this._event.removeAllListeners();
  this.emit("closed");

  debug("closed");

  defer(done);
};

EventEmitter2Ascoltatore.prototype.registerDomain = function(domain) {
  debug("registered domain");

  if (!this._publish) {
    this._publish = this.publish;
  }

  this.publish = domain.bind(this._publish);
};

util.aliasAscoltatore(EventEmitter2Ascoltatore.prototype);

/**
 * Exports the EventEmitter2Ascoltatore.
 *
 * @api public
 */
module.exports = EventEmitter2Ascoltatore;
