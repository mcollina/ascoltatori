"use strict";

var DecoratorAscoltatore = require("./decorator_ascoltatore");
var TrieAscoltatore = require("./trie_ascoltatore");
var util = require("./util");
var debug = require("debug")("ascoltatori:prefix");
var path = require("path");

/**
 * An Ascoltatore decorator to publish messages on a
 * parent Ascoltatore with a prefix.
 *
 * @param {String} prefix
 * @param {AbstractAscoltatore} ascoltatore
 * @api public
 */
function PrefixAscoltatore(prefix, ascoltatore) {
  DecoratorAscoltatore.call(this, ascoltatore || new TrieAscoltatore());

  this._prefix = prefix;
}

/**
 * See AbstractAscoltatore for the public API definitions.
 *
 * @api private
 */
PrefixAscoltatore.prototype = Object.create(DecoratorAscoltatore.prototype);

PrefixAscoltatore.prototype.wrapCallback = function(callback, next) {
  var that = this;
  if (!callback._prefix_ascoltatore_wrapper) {
    callback._prefix_ascoltatore_wrapper = function(t, payload) {
      callback(that._parentToLocal(t), payload);
    };
  }
  next(null, callback._prefix_ascoltatore_wrapper);
};

PrefixAscoltatore.prototype._localToParent = function(topic) {
  var newTopic = path.join(this._prefix, topic);
  debug("rewriting local topic " + topic + " into " + newTopic);
  return newTopic;
};

PrefixAscoltatore.prototype.wrapTopic = function(topic, next) {
  next(null, this._localToParent(topic));
};

PrefixAscoltatore.prototype._parentToLocal = function(topic) {
  var newTopic = topic.replace(new RegExp("^" + this._prefix + "/"), "");
  debug("rewriting remote topic " + topic + " into " + newTopic);
  return newTopic;
};

/**
 * Exports the PrefixAscoltatore.
 *
 * @api public
 */
module.exports = PrefixAscoltatore;
