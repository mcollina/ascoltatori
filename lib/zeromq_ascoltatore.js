"use strict";

var util = require("./util");
var wrap = util.wrap;
var defer = util.defer;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var debug = require("debug")("ascoltatori:zmq");
var steed = require("steed")();

/**
 * ZeromqAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `zmq` package.
 * ZeromqAscoltatore operates in a true peer-to-peer fashion, so there is
 * no central broker.
 * The two or more instances MUST be aware of each other and connect to each
 * other by the `connect` method.
 * All the instances transmit to everyone ALL messages in a broadcast fashion,
 * however loops are avoided.
 *
 * The options are:
 *  - `port`, the zmq port where messages will be published;
 *  - `controlPort`, the zmq port where control messages will be exchanged;
 *  - `remotePorts`, the remote control ports that will be connected to;
 *  - `zmq`, the zmq module (it will automatically be required if not present);
 *  - `delay`, a delay that is applied to the `ready` and `closed` events (the default is 5ms);
 *
 * @api public
 */
function ZeromqAscoltatore(opts) {
  AbstractAscoltatore.call(this);

  this._opts = opts || {};
  this._opts.delay = this._opts.delay || 5;
  this._opts.zmq = this._opts.zmq || require("zmq");

  this._ascoltatore = new TrieAscoltatore(opts);
  this._startSubs();
  this._startPub();
  this._startControl();

  this._connectedControls = [];
}

/**
 * Inherits from AbstractAscoltatore
 *
 * @api private
 */
ZeromqAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

/**
 * Create 0MQ connection using of the given type.
 *
 * @api private
 */
function createConn(opts, type) {
  var conn = opts.zmq.socket(type);
  conn.identity = util.buildIdentifier();

  debug("created " + type + " connection");
  return conn;
}

/**
 * Starts a connection to all the remote ports.
 *
 * @api private
 */
ZeromqAscoltatore.prototype._startSubs = function() {
  var that = this;
  if (this._sub_conns === undefined) {
    that._sub_conns = [];
    that._opts.remotePorts = that._opts.remotePorts || [];
    that._opts.remotePorts.forEach(function(port) {
      that.connect(port);
    });
  }
  return this._sub_conns;
};

ZeromqAscoltatore.prototype._startPub = function() {
  var that = this;
  if (that._pub_conn === undefined) {
    that._pub_conn = createConn(that._opts, "pub");
    debug("opening pub port " + that._opts.port);
    that._pub_conn.bind(that._opts.port, function(err) {
      if (err) {
        throw err;
      }

      debug("bound the publish connection to port " + that._opts.port);

      setTimeout(function() {
        that._connectSub(that._opts.port, function() {
          that.emit("ready");
        });
      }, that._opts.delay);
    });
  }
  return that._pub_conn;
};

ZeromqAscoltatore.prototype._startControl = function() {
  var that = this;
  if (that._control_conn === undefined) {
    that._control_conn = createConn(that._opts, "req");
    debug("opening control port " + that._opts.controlPort);
    that._control_conn.bind(that._opts.controlPort, function(err) {
      if (err) {
        throw err;
      }

      debug("bound the control connection to port " + that._opts.controlPort);

      that._control_conn_interval = setInterval(function() {
        var packet = that._sub_conns.map(function(c) {
          return c.port;
        }).join(",");
        debug("sending control packet " + packet);
        that._control_conn.send(packet);
      }, 250);

      that._control_conn.on("message", function(data) {
        debug("received connect response from " + data);
        that._connectSub(data);
      });
    });
  }
};

/**
 * Connect the Ascoltatore to the remote ZeromqAscoltatore exposed
 * through the given port
 *
 * @param {String} port The control port of the remote ascoltatore
 * @param {Function} callback
 * @api public
 */
ZeromqAscoltatore.prototype.connect = function connect(port, callback) {
  var that = this,
    conn = null;

  conn = createConn(that._opts, "rep");

  conn.connect(port);

  that._connectedControls.push(conn);

  conn.on("message", function(data) {
    debug("received connect request from " + data);
    conn.send(that._opts.port);

    var dests = String(data).split(",").filter(function(dest) {
      var found = true;
      that._sub_conns.forEach(function(conn) {
        if (conn.port === dest) {
          found = false;
        }
      });
      return found;
    }).map(function(dest) {
      return function(cb) {
        that._connectSub(dest, cb);
      };
    });

    steed.parallel(dests, function() {
      setTimeout(function() {
        wrap(callback)();
      }, that._opts.delay);
    });
  });
};

/**
 * Connect the Ascoltatore to the remote ZMQ port.
 *
 * @param {String} port The control port of the remote ascoltatore
 * @param {Function} callback
 * @api private
 */
ZeromqAscoltatore.prototype._connectSub = function(port, callback) {
  var that = this,
    conn = createConn(that._opts, "sub");

  port = String(port);

  debug("connecting to port " + port);
  conn.port = port;
  conn.connect(port);
  conn.subscribe("");
  that._sub_conns.push(conn);

  conn.on("message", function(data) {
    data = data.toString();
    var topic = null,
      message = null;

    topic = data.substr(0, data.indexOf(" "));
    message = data.substr(data.indexOf(" ") + 1);

    that._ascoltatore.publish(topic, message);

    debug("new message received for topic " + topic);
  });

  setTimeout(function() {
    debug("connected and subscribed to " + port);
    defer(callback);
  }, this._opts.delay);

  return this;
};

/**
 * Private stuff
 *
 * @api private
 */
ZeromqAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();
  debug("registered new subscriber for topic " + topic);
  this._ascoltatore.subscribe(topic, callback, done);
};

ZeromqAscoltatore.prototype.publish = function publish(topic, message, done) {
  this._raiseIfClosed();

  var toSend = topic + " " + message;

  this._pub_conn.send(toSend);
  debug("new message published to " + topic);
  defer(done); // simulate some steedhronicity
};

ZeromqAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();
  debug("deregistered subscriber for topic " + topic);
  this._ascoltatore.unsubscribe(topic, callback);
  defer(done); // simulate some steedhronicity
};

ZeromqAscoltatore.prototype.close = function close(done) {
  var that = this;

  if (this._closed) {
    defer(done);
    return;
  }

  if (that._sub_conns !== undefined) {
    that._sub_conns.forEach(function(s) {
      s.close();
    });
    delete that._sub_conns;
  }

  that._connectedControls.forEach(function(s) {
    s.close();
  });

  if (that._pub_conn !== undefined) {
    that._pub_conn.close();
    delete that._pub_conn;
  }

  if (that._control_conn !== undefined && that._control_conn._zmq.state === 0) {
    that._control_conn.close();
    clearInterval(that._control_conn_interval);
    delete that._control_conn_interval;
  }

  setTimeout(function() {
    debug("closed");
    that._ascoltatore.close();
    that.emit("closed");
    defer(done);
  }, this._opts.delay);
};

util.aliasAscoltatore(ZeromqAscoltatore.prototype);

/**
 * Export ZeromqAscoltatore
 *
 * @api public
 */
module.exports = ZeromqAscoltatore;
