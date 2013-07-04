"use strict";

var SubsCounter = require("./subs_counter");
var util = require("./util");

/**
 * You can require any Ascolatore through this module.
 *
 * @api public
 */
module.exports.AbstractAscoltatore = require('./abstract_ascoltatore');
module.exports.TrieAscoltatore = require('./trie_ascoltatore');
module.exports.EventEmitter2Ascoltatore = require('./event_emitter2_ascoltatore');
module.exports.RedisAscoltatore = require("./redis_ascoltatore");
module.exports.ZeromqAscoltatore = require("./zeromq_ascoltatore");
module.exports.AMQPAscoltatore = require("./amqp_ascoltatore");
module.exports.MQTTAscoltatore = require("./mqtt_ascoltatore");
module.exports.PrefixAscoltatore = require("./prefix_acoltatore");
module.exports.MongoAscoltatore = require('./mongo_ascoltatore');
module.exports.DecoratorAscoltatore = require("./decorator_ascoltatore");
module.exports.JSONAscoltatore = require("./json_ascoltatore");

/**
 *
 * @api private
 */
var classes = {
  "amqp": module.exports.AMQPAscoltatore,
  "trie": module.exports.TrieAscoltatore,
  "eventemitter2": module.exports.EventEmitter2Ascoltatore,
  "mqtt": module.exports.MQTTAscoltatore,
  "redis": module.exports.RedisAscoltatore,
  "zmq": module.exports.ZeromqAscoltatore,
  "mongo": module.exports.MongoAscoltatore
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
            (classes[opts.type] || module.exports.TrieAscoltatore);

  result = new Klass(opts, module.exports);

  if (opts.prefix) {
    result = new module.exports.PrefixAscoltatore(opts.prefix, result);
  }

  if (opts.json !== false) {
    result = new module.exports.JSONAscoltatore(result);
  }

  if (done) {
    module.exports.util.defer(function() {
      result.once("ready", function() {
        done(result);
      });
    });
  }

  return result;
};

/**
 * Use an Ascoltatore as a global pub/sub broker inside
 * the current node process.
 * Everyone requiring ascoltatori can use it.
 *
 * @param {AbstractAscoltatore} ascoltatore the Ascoltatore to use
 * @return {Object} the `ascoltatori` module
 * @api public
 */
module.exports.use = function use(ascoltatore) {
  ["publish", "subscribe", "unsubscribe", "close", "on",
      "removeListener", "registerDomain"
  ].forEach(function(f) {

    module.exports[f] = function(a, b, c, d) {
      return ascoltatore[f](a, b, c, d);
    };
  });

  util.aliasAscoltatore(this);

  return this;
};

/**
 * The default global Ascoltatore is a TrieAscoltatore.
 *
 * @api public
 */
module.exports.use(new module.exports.TrieAscoltatore());

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

/**
 *
 * @api private
 */
module.exports.canBeUsedByAscoltatori = require("./can_be_used_by_ascoltatori");
