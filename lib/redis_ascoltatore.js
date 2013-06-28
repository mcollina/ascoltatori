"use strict";

var util = require("./util");
var wrap = util.wrap;
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
  AbstractAscoltatore.call(this);

  this._ready_sub = false;
  this._ready_pub = false;
  this._opts = opts || {};
  this._opts.redis = this._opts.redis || require("redis");

  this._ascoltatore = new TrieAscoltatore();
  this._startSub();
  this._startPub();

  this._subs_counter = new SubsCounter();
  this._ascoltatore.on("newTopic", this.emit.bind(this, "newTopic"));
}

/**
 * Create a connection to redis using a default
 * from the opts if there is 
 *
 * @param {Object} opts The options object
 * @param {String} connName The name of the connection
 * @api private
 */
function createConn(opts, connName) {
  var conn = opts[connName];
  if (conn === undefined) {
    debug("connecting to " + opts.host + ":" + opts.port);
    conn = opts.redis.createClient(opts.port, opts.host, opts);
  }
  if (opts.password !== undefined) {
    debug("authenticating using password");
    conn.auth(opts.password);
  }
  debug("selected database " + opts.db);
  conn.select(opts.db || 0);
  conn.retry_backoff = 5;
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

    handler = function(topic, message) {
      debug("new message received for topic " + topic);
      util.defer(function() {
        // we need to skip out this callback, so we do not
        // break the client when an exception occurs
        that._ascoltatore.publish(topic, message);
      });
    };

    this._sub.on("message", handler);
    this._sub.on("pmessage", function(sub, topic, message) {
      handler(topic, message);
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

function containsWildcard(topic) {
  return (topic.indexOf("*") >= 0) || (topic.indexOf("+") >= 0);
}

RedisAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();

  var newDone = function() {
    debug("registered new subscriber for topic " + topic);
    util.defer(done);
  };

  var subTopic = topic;

  if (containsWildcard(topic)) {
    subTopic = topic.replace(/\+/g, "*");
    this._sub.psubscribe(subTopic, newDone);
  } else {
    this._sub.subscribe(subTopic, newDone);
  }

  this._subs_counter.add(subTopic);

  this._ascoltatore.subscribe(topic, callback);
};

RedisAscoltatore.prototype.publish = function publish(topic, message, done) {
  this._raiseIfClosed();

  if (message === undefined || message === null) {
    message = false; // so we can convert it to JSON
  }

  this._client.publish(topic, message, function() {
    debug("new message published to " + topic);
    util.defer(done);
  });
};

RedisAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();

  var isWildcard = containsWildcard(topic),
      subTopic = topic;

  if (isWildcard) {
    subTopic = topic.replace(/\+/g, "*");
  }

  this._subs_counter.remove(subTopic);
  this._ascoltatore.unsubscribe(topic, callback);

  var newDone = function() {
    debug("deregistered subscriber for topic " + topic);
    util.defer(done);
  };

  if (this._subs_counter.include(subTopic)) {
    newDone();
    return this;
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
    util.defer(done);
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
  this._ascoltatore.close();
  this.emit("closed");
};

util.aliasAscoltatore(RedisAscoltatore.prototype);

/**
 * Exports the RedisAscoltatore
 *
 * @api public
 */
module.exports = RedisAscoltatore;
