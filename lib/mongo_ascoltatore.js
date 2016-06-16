"use strict";

var util = require("./util");
var wrap = util.wrap;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var SubsCounter = require("./subs_counter");
var debug = require("debug")("ascoltatori:mongodb");
var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var steed = require("steed");

/**
 * MongoAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `mongoskin` package.
 *
 * The options are:
 * `url`: the mongodb url (default: 'mongodb://localhost:27017/ascoltatori?auto_reconnect=true')
 * `pubsubCollection`: where to store the messages on mongodb (default: pubsub)
 * `mongo`: settings for the mongodb connection
 *
 * @api public
 * @param {Object} opts The options object
 */
var MongoAscoltatore = function(opts) {
  AbstractAscoltatore.call(this);

  if (typeof opts.db === 'string' || opts.uri) {
    // old options
    opts.uri = opts.uri || 'mongodb://127.0.0.1/';
    opts.db = opts.db || 'ascoltatori';
    opts.url = opts.uri + opts.db + '?auto_reconnect=true';
    delete opts.db;
  }

  this._opts = opts || {};
  this.url = this._opts.url || 'mongodb://127.0.0.1/ascoltatori?auto_reconnect=true';
  this._pubsubCollection = opts.pubsubCollection || 'pubsub';
  this._maxRetry = opts.maxRetry || 5;
  this.mongoOpts = this._opts.mongo || {};

  this._ascoltatore = new TrieAscoltatore(opts);

  this.channels = {};
  this._closed = false;

  this._handlingCursorFailure = false;
  this._lastSuccessfulHandling = new ObjectID();

  this.wait = this._opts.wait || 100;

  this.connectionParams = {
    capped: true,
    size: this._opts.size || 10 * 1024 * 1024, // 10 MB
    max: this._opts.max || 10000 // documents
  };

  var that = this;

  var setupDB = function(err, db) {
    if (err) {
      that.emit('error', err);
      return;
    }

    that.db = db;

    // creating the capped collection where we can exchange messages
    that.db.createCollection(that._pubsubCollection, that.connectionParams, function(err, collection) {
      if (err) {
        that.emit('error', err);
      } else  {
        that.collection = collection;

        debug('ready');

        // create a new object id. We will get all the events from now on
        that._poll(new ObjectID());

        that.emit('ready');
      }
    });
  };

  if (opts.db) {
    setupDB(null, opts.db);
  } else {
    MongoClient.connect(this.url, this.mongoOpts, setupDB);
  }
};

/**
 * Inheriting
 *
 * @api private
 */
MongoAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

MongoAscoltatore.prototype.publish = function(topic, message, options, done) {
  this._raiseIfClosed();
  message = message || "";
  done = done || function() {};

  var messageObj = {
    value: message,
    topic: topic,
    options: options
  };

  debug('publishing message', messageObj);

  this.collection.insert(messageObj, { w: 1 }, done);
};

/**
 *
 * @return {Boolean} true when the user is not connected with mongodb
 * @private
 */
MongoAscoltatore.prototype._disconnected = function() {
  return this.db.db.state === 'disconnected';
};

/**
 * Used to avoid to continue to go on if an error occurs
 *
 * @param die if true, avoid to keep going and just report the error
 * @param callback real callback to call
 * @return {Function} simply exit
 * @private
 */
MongoAscoltatore.prototype._handle = function(die, callback) {

  debug('handle');

  var that = this;

  return function() {
    if (that._disconnected()) {
      debug('disconnected');
      return;
    }

    var args = [].slice.call(arguments),
      err = args.shift();

    if (err && !that._closed) {
      that._handleCursorClosed(that._lastSuccessfulHandling);
      return;
    }

    if (err && die) {
      debug('ERROR: ' + err);
      return;
    }

    debug('handle -> calling the callback');
    callback.apply(that, args);
  };
};

MongoAscoltatore.prototype.subscribe = function(topic, callback, done) {
  this._raiseIfClosed();

  debug('subscribe');
  this._ascoltatore.subscribe(topic, callback, done);
};

/**
 * In case of error, wait for the db to recover (auto_reconnect).
 * And repoll the tailable collection.
 * @param latest
 * @private
 */
MongoAscoltatore.prototype._handleCursorClosed = function (latest) {
  debug('handleCursorClosed');
  if (this._closed !== false) {
    // Handle cursor closed. But we're closed actually. Do nothing
    return;
  }
  if (this._handlingCursorFailure !== false) {
    // Already handling this failure
    return;
  }
  var that = this;

  this._handlingCursorFailure = true;

  // Kind of hacky solution, I would prefer catch some mongo events
  // but unfortunately...
  var retry = 0;
  var reconnect = function () {
    debug('handleCursorClosed -> Wait for the database to be connected...');
    that.db.db(that.db.databaseName).stats({}, function (err, stats) {
      var success = true;
      if (err) {
        debug('handleCursorClosed -> Stats failed: ' + err);
        success = false;
      } else if (!stats.ok) {
        debug('handleCursorClosed -> Stats says that DB is not ok : ' + stats);
        success = false;
      }
      if (success === false) {
        retry++;
        debug('handleCursorClosed -> Handle cursor failed: retry #' + retry);
        if (retry < that._maxRetry) {
          setTimeout(reconnect, 5000);
        } else {
          that.emit('error', new Error('Mongo is out of order'));
          that._handlingCursorFailure = false;
        }
      } else {
        debug("handleCursorClosed ->  We're now ready. Poll.");
        that._checkCappedAndPoll(latest);
      }
    });
  };

  reconnect();
};

/**
 * Check if the pubsub collection is capped. Avoiding to enter in a
 * error event loop.
 * @param latest
 * @private
 */
MongoAscoltatore.prototype._checkCappedAndPoll = function(latest) {
  debug('checkCappedAndPoll');
  var that = this;
  this.collection.isCapped(function(err, isCapped) {
    if (err) {
      debug('checkCappedAndPoll -> Cannot stat isCapped. Give up');
      that.emit('error', new Error('Cannot stat if collection is capped or not'));
      that._handlingCursorFailure = false;
      return;
    }
    if (!isCapped) {
      debug('checkCappedAndPoll -> Collection is not capped. Give up');
      that.emit('error', new Error('Cannot recover. Collection is not capped.'));
      that._handlingCursorFailure = false;
    } else {
      debug('checkCappedAndPoll -> Capped Ok. Poll.');
      that._poll(latest);
      that._handlingCursorFailure = false;
    }
  });
};

/**
 * function to poll from mongodb for the infos
 * @param latest starting id to look at
 * @private
 */
MongoAscoltatore.prototype._poll = function(latest) {
  debug('poll');

  var options = {
    tailable: true,
    awaitdata: true,
    numberOfRetries: -1
  };

  this._cursor = this.collection.find({ _id: { $gt: latest } }, options);

  // we have created only the cursor, now take a look at the messages arrived until now
  this._more(latest);
};

/**
 *
 * @param {ObjectID} latest as above, first id to use as reference
 * @private
 */
MongoAscoltatore.prototype._more = function(latest) {
  var that = this;

  debug('more');

  that._cursor.each(that._handle(true, function(doc) {

    var value;

    if (!doc) {
      debug('setting the subscriber polling');
      that._pollTimeout = setTimeout(function() {
        that._poll(latest);
      }, that.wait);
      return;
    }

    debug('calling the subscriber callback');

    latest = latest > doc._id ? latest: doc._id;
    that._lastSuccessfulHandling = latest;

    if (!that._closed) {
      if (doc.value && doc.value.buffer) {
        value = doc.value.buffer;
      } else {
        value = doc.value;
      }

      that._ascoltatore.publish(doc.topic, value, doc.options);
    }
  }));
};

MongoAscoltatore.prototype.unsubscribe = function() {
  this._raiseIfClosed();
  this._ascoltatore.unsubscribe.apply(this._ascoltatore, arguments);
};

MongoAscoltatore.prototype.unsub = MongoAscoltatore.prototype.unsubscribe;

MongoAscoltatore.prototype.close = function close(done) {
  var that = this;
  var closeEmbedded = function() {
    that._ascoltatore.close(function() {
      that.emit("closed");
      if (done) {
        done();
      }
    });
  };

  if (this._pollTimeout) {
    clearTimeout(this._pollTimeout);
  }

  that._closed = true;

  steed.series([
    function(cb) {
      if (that._cursor) {
        that._cursor.close(cb);
        delete that._cursor;
      } else {
        cb();
      }
    },
    function(cb) {
      that.db.close(cb);
    }
  ], closeEmbedded);
};

util.aliasAscoltatore(MongoAscoltatore.prototype);

/**
 * Exports the MongoAscoltatore
 *
 * @api public
 */
module.exports = MongoAscoltatore;
