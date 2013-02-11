
var util = require("./util");
var wrap = util.wrap;
var MemoryAscoltatore = require("./memory_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var SubsCounter = require("./subs_counter");

function RedisAscoltatore(opts) {
  AbstractAscoltatore.call(this);

  this._ready_sub = false;
  this._ready_pub = false;
  this._opts = opts;
  this._ascoltatore = new MemoryAscoltatore();
  this._sub;
  this._client;

  this._subs_counter = new SubsCounter();
  this._ascoltatore.on("newTopic", this.emit.bind(this, "newTopic"));
}

RedisAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype, {
  "_sub" : {
    configurable: false,
    get: function() {
      var that = this;
      if(this._sub_conn == undefined) {
        this._sub_conn = createConn(this._opts, 'sub_conn');
        this._sub_conn.on("ready", function() {
          that._updateReady("_ready_sub");
        });

        this._sub_conn.on("message", function(topic, message) {
          that._ascoltatore.publish(topic, JSON.parse(message));
        });
        this._sub_conn.on("pmessage", function(sub, topic, message) {
          that._ascoltatore.publish(topic, JSON.parse(message));
        });
      }
      return this._sub_conn;
    }
  },
  _client: {
    configurable: false,
    get: function() {
      var that = this;
      if(this._client_conn == undefined) {
        this._client_conn = createConn(this._opts, 'client_conn');
        this._client_conn.on("ready", function() {
          that._updateReady("_ready_pub");
        });
      }
      return this._client_conn;
    }
  }
});

RedisAscoltatore.prototype._updateReady = function updateReady(key) {
  this[key] = true;
  if(this._ready_pub && this._ready_sub) {
    this.emit("ready");
  }
};

RedisAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();
  if(containsWildcard(topic)) {
    this._sub.psubscribe(topic, wrap(done));
  } else {
    this._sub.subscribe(topic, wrap(done));
  }
  this._subs_counter.add(topic);
  this._ascoltatore.subscribe(topic, callback);
};

RedisAscoltatore.prototype.publish = function publish(topic, message, done) {
  this._raiseIfClosed();
  message = JSON.stringify(message || true);
  this._client.publish(topic, message, wrap(done));
};

RedisAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();
  this._subs_counter.remove(topic);
  this._ascoltatore.unsubscribe(topic, callback);

  if(this._subs_counter.include(topic)) {
    process.nextTick(wrap(done));
    return this;
  }

  if(containsWildcard(topic)) {
    this._sub.punsubscribe(topic, wrap(done));
  } else {
    this._sub.unsubscribe(topic, wrap(done));
  }

  return this;
};

RedisAscoltatore.prototype.close = function close(done) {
  var that = this;

  if (this._closed) {
    wrap(done)();
    return;
  }

  var closes = 2;
  this._subs_counter.clear();
  ["_sub_conn", "_client_conn"].forEach(function(c) {
    if(that[c] !== undefined) {
      that[c].on("end", function() {
        if(--closes === 0) {
          wrap(done)();
        }
      })
      that[c].quit();
      delete that[c];
    } else {
      closes--;
    }
  });
  this._ascoltatore.close();
  this.emit("closed");
};

util.aliasAscoltatore(RedisAscoltatore.prototype);

function containsWildcard(topic) {
  return topic.indexOf("*") >= 0;
}

function createConn(opts, connName) {
  var conn = opts[connName];
  if (conn === undefined){
    conn = opts.redis.createClient(opts.port, opts.host, opts);
  }
  if (opts.password != undefined){
    conn.auth(opts.password);
  }
  conn.select(opts.db || 0);
  conn.retry_backoff = 5;
  return conn;
}

module.exports = RedisAscoltatore;
