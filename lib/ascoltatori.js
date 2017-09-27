"use strict";

var SubsCounter = require("./subs_counter");
var util = require("./util");

/**
 * You can require any Ascolatore through this module.
 *
 * @api public
 */
module.exports.AbstractAscoltatore = function() { return require('./abstract_ascoltatore'); };
module.exports.TrieAscoltatore = function() { return require('./trie_ascoltatore'); };
module.exports.EventEmitter2Ascoltatore = function() { return require('./event_emitter2_ascoltatore'); };
module.exports.RedisAscoltatore = function() { return require("./redis_ascoltatore"); };
module.exports.ZeromqAscoltatore = function() { return require("./zeromq_ascoltatore"); };
module.exports.AMQPAscoltatore = function() { return require("./amqp_ascoltatore"); };
module.exports.AMQPLibAscoltatore = function() { return require("./amqplib_ascoltatore"); };
module.exports.MQTTAscoltatore = function() { return require("./mqtt_ascoltatore"); };
module.exports.PrefixAscoltatore = function() { return require("./prefix_acoltatore"); };
module.exports.MongoAscoltatore = function() { return require('./mongo_ascoltatore'); };
module.exports.DecoratorAscoltatore = function() { return require("./decorator_ascoltatore"); };
module.exports.JSONAscoltatore = function() { return require("./json_ascoltatore"); };
module.exports.FileSystemAscoltatore = function() { return require("./filesystem_ascoltatore"); };
module.exports.KafkaAscoltatore = function() { return require("./kafka_ascoltatore"); };

/**
 *
 * @api private
 */
var classes = {
  "amqp": module.exports.AMQPAscoltatore,
  "amqplib": module.exports.AMQPLibAscoltatore,
  "trie": module.exports.TrieAscoltatore,
  "eventemitter2": module.exports.EventEmitter2Ascoltatore,
  "mqtt": module.exports.MQTTAscoltatore,
  "redis": module.exports.RedisAscoltatore,
  "zmq": module.exports.ZeromqAscoltatore,
  "mongo": module.exports.MongoAscoltatore,
  "kafka": module.exports.KafkaAscoltatore,
  "filesystem": module.exports.FileSystemAscoltatore
};

/**
 * Builds an ascolatore based on the proper type.
 * It will encapsulate it in a PrefixAscolatore if a prefix key is
 * present.
 * The other options are passed through the constructor of the
 * Ascoltatore
 * 
 * Options:
 *  - `type`, it can be "amqp", "trie", "eventemitter2", "redis", "zmq", or just a class
 *    that will be instantiated (i.e. with `new`).
 *  - `prefix`, will be passed to the PrefixAscoltatore.
 *  - `json`, it can be setted to false if you do not want your messages
 *    to be wrapped inside JSON.
 *  - any other option that the ascolatore constructor may need.
 *
 *  @api public
 *  @param {Object} opts The options
 *  @param {Function} done The callback that will be called when the
 *  ascoltatore will be ready
 */
module.exports.build = function build(opts, done) {
  opts = opts || {};

  if (typeof opts === "function") {
    done = opts;
    opts = {};
  }

  var Klass = null,
    result = null;

  Klass = (typeof opts.type === 'function') ? opts.type :
            (classes[opts.type]() || module.exports.TrieAscoltatore);

  result = new Klass(opts, module.exports);

  if (opts.prefix) {
    result = new module.exports.PrefixAscoltatore(opts.prefix, result)
      .once("error", done);
  }

  if (opts.json !== false) {
    result = new module.exports.JSONAscoltatore(result)
      .once("error", done);
  }

  if (done) {
    setImmediate(function() {
      result.once("ready", function() {
        result.removeListener("error", done);
        done(null, result);
      });
    });
  }

  return result;
};

/**
 * These are just utilities
 *
 * @api private
 */
module.exports.SubsCounter = SubsCounter;
module.exports.util = util;

/**
 * You can require a shared mocha test to you if you want to develop
 * a custom Ascoltatore inside your app.
 *
 * @api public
 */
module.exports.behaveLikeAnAscoltatore = require("./behave_like_an_ascoltatore");
