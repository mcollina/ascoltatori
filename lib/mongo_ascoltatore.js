"use strict";

var util = require("./util");
var wrap = util.wrap;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var SubsCounter = require("./subs_counter");
var debug = require("debug")("ascoltatori:mongodb");

var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var BSON = mongo.BSONPure;

/**
 * MongoAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `mongoskin` package.
 *
 * The options are:
 * `uri`: the mongodb uri (default: 'mongodb://localhost:27017/')
 * `pubsubCollection`: where to store the messages on mongodb (default: pubsub)
 * `db`: the db to use (default: ascoltatori)
 * `mongo`: settings for the mongodb connection
 *
 * @api public
 * @param {Object} opts The options object
 */
var MongoAscoltatore = function(opts) {
  AbstractAscoltatore.call(this);
  this._opts = opts || {};
  this.uri = this._opts.uri || 'mongodb://127.0.0.1/';
  this._db = this._opts.db || 'ascoltatori';
  this._pubsubCollection = opts.pubsubCollection || 'pubsub';
  this.uri = this.uri + this._db;
  this.uri = this.uri + '?auto_reconnect';
  this.mongoOpts = this._opts.mongo || {};

  this._ascoltatore = new TrieAscoltatore();

  this.channels = {};
  this._closed = false;

  this.wait = this._opts.wait || 100;

  this.connectionParams = {
    capped: true,
    size: this._opts.size || 1000,
    max: this._opts.max || 100
  };

  this.mongoOpts.safe = true;

  var that = this;

  // this operation is SYNC, so emit after this will work
  MongoClient.connect(this.uri, this.mongoOpts, function(err, db) {
    that.db = db;

    // creating the capped collection where we can exchange messages
    that.db.createCollection(that._pubsubCollection, that.connectionParams, function(err, collection) {
      if (err) {
        throw new Error(err);
      } else  {
        that.collection = collection;

        // be sure to have a capped collection on the run
        that.db.executeDbCommand({
          "convertToCapped": that._pubsubCollection,
          size: that.connectionParams.size
        }, function ready() {
          debug('ready');

          // create a new object id. We will get all the events from now on
          that._poll(new BSON.ObjectID());

          that.emit('ready');
        });
      }
    });
  });
};

/**
 * Inheriting
 *
 * @api private
 */
MongoAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

MongoAscoltatore.prototype.publish = function(topic, message, done) {
  this._raiseIfClosed();
  message = message || "";
  done = done || function() {};

  var messageObj = {
    value: message,
    topic: topic
  };

  debug('publishing message: ' + message + ' on ' + topic + '...');

  this.collection.insert(messageObj, done);
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

    if (err) {
      that.emit('error', err);
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

  var cursor = this.collection.find({ _id: { $gte: latest } }, options);

  // we have created only the cursor, now take a look at the messages arrived until now
  this._more(latest, cursor);
};

/**
 *
 * @param latest as above, first id to use as reference
 * @param cursor of the database
 * @private
 */
MongoAscoltatore.prototype._more = function(latest, cursor) {
  var that = this;

  debug('more');

  cursor.each(that._handle(true, function(doc) {

    if(that._closed) {
      return;
    }

    if (!doc) {
      debug('setting the subscriber polling');
      that._pollTimeout = setTimeout(function() {
        that._poll(latest);
      }, that.wait);
      return;
    }

    debug('calling the subscriber callback');

    if (doc._id > latest) {
      latest = doc._id;
      process.nextTick(function() {
        that._ascoltatore.publish(doc.topic, doc.value);
      });
    }
  }));


  debug('exiting more');
};

MongoAscoltatore.prototype.unsubscribe = function() {
  this._raiseIfClosed();
  this._ascoltatore.unsubscribe.apply(this._ascoltatore, arguments);
};

MongoAscoltatore.prototype.unsub = MongoAscoltatore.prototype.unsubscribe;

MongoAscoltatore.prototype.close = function close(done) {
  if (this._pollTimeout) {
    clearTimeout(this._pollTimeout);
  }
  this._closed = true;
  this._ascoltatore.close(done);
  this.emit("closed");
  this.db.close();
};

util.aliasAscoltatore(MongoAscoltatore.prototype);

/**
 * Exports the MongoAscoltatore
 *
 * @api public
 */
module.exports = MongoAscoltatore;
