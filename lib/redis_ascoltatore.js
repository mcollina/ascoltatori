"use strict";

var Redis = require('ioredis');
var msgpack = require('msgpack-lite');
var util = require("./util");
var wrap = util.wrap;
var defer = util.defer;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var SubsCounter = require("./subs_counter");
var debug = require("debug")("ascoltatori:redis");

/**
 * RedisAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `node_redis` package and it could be
 * backed up by any redis version greater than 2.2.
 *
 * The RedisAscoltatore defines two
 * properties _sub and _pub for handling
 * the two connections needed by redis.
 *
 * The options are:
 *  - `port`, the optional port to connect to;
 *  - `host`, the optional host to connect to;
 *  - `db`, the database to connect to (defaults to 0);
 *  - `password`, the optional password to use;
 *  - `sub_conn`, the optional redis connection to use for the sub and psub commands;
 *  - `pub_conn`, the optional redis connection to use for the pub command;
 *  - `redis`, the redis module (it will automatically be required if not present).
 *
 * @api public
 * @param {Object} opts The options object
 */
function RedisAscoltatore(opts) {
  AbstractAscoltatore.call(this, opts, {
    separator: '/',
    wildcardOne: '*',
    wildcardSome: '*'
  });

  this._ready_sub = false;
  this._ready_pub = false;
  this._opts = opts || {};

  this._ascoltatores = {};

  this._startSub();
  this._startPub();

  this._subs_counter = new SubsCounter();
}

/**
 * Create a connection to redis using a default
 * from the opts if there is.
 *
 * @param {Object} opts The options object
 * @param {String} connName The name of the connection
 * @api private
 */
function createConn(opts, connName) {
  var conn = opts[connName];
  if (conn === undefined) {
    debug("connecting with ", opts);
    conn = new Redis(opts);
  }
  return conn;
}

/**
 * Inheriting
 *
 * @api private
 */
RedisAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

/**
 * Start the pub connection
 *
 * @api private
 */
RedisAscoltatore.prototype._startPub = function() {
  var that = this;
  if (this._client === undefined) {
    this._client = createConn(this._opts, 'client_conn');
    this._client.on("ready", function() {
      debug("created pub connection");
      that._updateReady("_ready_pub");
    });
  }
  return this._client;
};

/**
 * Start the sub connection
 *
 * @api private
 */
RedisAscoltatore.prototype._startSub = function() {
  var that = this,
    handler = null;

  if (this._sub === undefined) {
    this._sub = createConn(this._opts, 'sub_conn');
    this._sub.on("ready", function() {
      debug("created sub connection");
      that._updateReady("_ready_sub");
    });

    handler = function(sub, topic, payload) {
      topic = topic.toString(); // cast to string in case of Buffer instance (nodejs-redis >=2.0)
      debug("new message received for topic " + topic);
      defer(function() {
        // we need to skip out this callback, so we do not
        // break the client when an exception occurs
        var ascoltatore = that._ascoltatores[sub];
        topic = topic.replace(new RegExp('/$'), '');
        topic = that._recvTopic(topic);

        payload = msgpack.decode(payload);
        
        if (ascoltatore) {
          ascoltatore.publish(topic, payload.message, payload.options);
        } else {
          debug("no ascoltatore for subscription: " + sub);
        }
      });
    };

    this._sub.on("messageBuffer", function (topic, message) {
      handler(topic, topic, message);
    });
    this._sub.on("pmessageBuffer", function(sub, topic, message) {
      handler(sub, topic, message);
    });
  }

  return this._sub;
};

RedisAscoltatore.prototype._updateReady = function updateReady(key) {
  this[key] = true;
  if (this._ready_pub && this._ready_sub) {
    this.emit("ready");
  }
};

RedisAscoltatore.prototype._containsWildcard = function(topic) {
  return (topic.indexOf(this._wildcardOne) >= 0) ||
         (topic.indexOf(this._wildcardSome) >= 0);
};

RedisAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();

  var newDone = function() {
    debug("registered new subscriber for topic " + topic);
    defer(done);
  };

  var subTopic = this._subTopic(topic);

  if (!subTopic.match(new RegExp('[/*]$'))) {
    subTopic += '/';
  }

  if (this._containsWildcard(topic)) {
    this._sub.psubscribe(subTopic, newDone);
  } else {
    this._sub.subscribe(subTopic, newDone);
  }

  debug("redis subscription topic is " + subTopic);
  this._subs_counter.add(subTopic);

  var ascoltatore = this._ascoltatores[subTopic];

  if (!ascoltatore) {
    ascoltatore = this._ascoltatores[subTopic] = new TrieAscoltatore(this._opts);
  }

  ascoltatore.subscribe(topic, callback);
};

RedisAscoltatore.prototype.publish = function publish(topic, message, options, done) {
  this._raiseIfClosed();

  if (message === undefined || message === null) {
    message = false; // so we can convert it to JSON
  }

  var payload = {
    message: message,
    options: options
  };

  topic = this._pubTopic(topic);

  if (!topic.match(new RegExp('/$'))) {
    topic += '/';
  }
  
  this._client.publish(topic, msgpack.encode(payload), function() {
    debug("new message published to " + topic);
    defer(done);
  });
};

RedisAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  var isWildcard = this._containsWildcard(topic),
      subTopic = this._subTopic(topic);

  if (!subTopic.match(new RegExp('[/*]$'))) {
    subTopic += '/';
  }

  this._subs_counter.remove(subTopic);

  var ascoltatore = this._ascoltatores[subTopic];

  if (ascoltatore) {
    ascoltatore.unsubscribe(topic, callback);
  }

  var newDone = function() {
    debug("deregistered subscriber for topic " + topic);
    defer(done);
  };

  if (this._subs_counter.include(subTopic)) {
    newDone();
    return this;
  }

  if (ascoltatore) {
    ascoltatore.close();
    delete this._ascoltatores[subTopic];
  }

  if (isWildcard) {
    this._sub.punsubscribe(subTopic, newDone);
  } else {
    this._sub.unsubscribe(subTopic, newDone);
  }

  return this;
};

RedisAscoltatore.prototype.close = function close(done) {
  var that = this,
    newDone = null,
    closes = 2;

  newDone = function() {
    debug("closed");
    defer(done);
  };

  if (this._closed) {
    newDone();
    return;
  }

  this._subs_counter.clear();
  ["_sub", "_client"].forEach(function(c) {
    if (that[c] !== undefined) {
      that[c].on("end", function() {
        closes = closes - 1;
        if (closes === 0) {
          newDone();
        }
      });
      that[c].quit();
      delete that[c];
    } else {
      closes = closes - 1;
    }
  });

  for (var subTopic in this._ascoltatores) {
    this._ascoltatores[subTopic].close();
  }
  this._ascoltatores = {};

  this.emit("closed");
};

util.aliasAscoltatore(RedisAscoltatore.prototype);

/**
 * Exports the RedisAscoltatore
 *
 * @api public
 */
module.exports = RedisAscoltatore;
