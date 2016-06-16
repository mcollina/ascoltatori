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
  AbstractAscoltatore.call(this, settings, {
    wildcardOne: '*',
    wildcardSome: '**'
  });

  this._event = new EventEmitter2({
    delimiter: this._separator,
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

  this._event.on(this._subTopic(topic).replace(/^\//g, ''), callback);
  defer(done);
};

EventEmitter2Ascoltatore.prototype.publish = function (topic, message, options, done) {
  this._raiseIfClosed();
  debug("new message published to " + topic);

  this._event.emit(this._pubTopic(topic).replace(/^\//g, ''), topic, message, options);

  defer(done);
};

EventEmitter2Ascoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  debug("deregistered subscriber for topic " + topic);

  this._event.off(this._subTopic(topic).replace(/^\//g, ''), callback);

  defer(done);
};

EventEmitter2Ascoltatore.prototype.close = function close(done) {
  this._event.removeAllListeners();
  this.emit("closed");

  debug("closed");

  defer(done);
};

util.aliasAscoltatore(EventEmitter2Ascoltatore.prototype);

/**
 * Exports the EventEmitter2Ascoltatore.
 *
 * @api public
 */
module.exports = EventEmitter2Ascoltatore;
