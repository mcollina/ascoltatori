"use strict";

var util = require("./util");
var wrap = util.wrap;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var SubsCounter = require("./subs_counter");
var debug = require("debug")("ascoltatori:mongodb");
var steed = require("steed");
var _mainTopic;
var _ascoltatore;
var _opts;
var _gcloudConnect;

/**
 * PubsubAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `google-cloud` package.
 *
 * The options are:
 * `topic`: the Google Cloud Pubsub topic that needs to be used
 * `gcloud.keyFilename`: keyfilename for gcloud
 * `gcloud.projectId`: gcloud project ID
 * `ackDeadline`: number, how higher, how more duplicates but also more deliveries
 * More info: https://github.com/GoogleCloudPlatform/google-cloud-node#elsewhere
 *
 * @api public
 * @param {Object} opts The options object
 */
var PubsubAscoltatore = function(opts) {

  AbstractAscoltatore.call(this);

  _ascoltatore  = new TrieAscoltatore(opts);
  _opts = opts; // these opts are needed in the whole scope
  _gcloudConnect = require('@google-cloud/pubsub')(_opts.gcloud);

  this._opts = opts || {};
  this._closed = false;
  this.channels = {};
  this._handlingCursorFailure = false;

  this._gcloudSubscribe(); // listen to Google PubSub

  this.emit('ready'); // Ascoltatore is ready to go
};

/**
 * Inheriting
 *
 * @api private
 */
PubsubAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

PubsubAscoltatore.prototype._gcloudSubscribe = function(){
  _mainTopic = _gcloudConnect.topic(_opts.topic);

  var subscription = _mainTopic.subscription(_opts.topic);

  subscription.on('message', function(message){
    if(message.data.value.data == null){
        var toBePublished = "!no-data!";
      } else {
        var toBePublished = String.fromCharCode.apply(null, new Uint16Array(message.data.value.data));
      }
      _ascoltatore.publish(message.data.topic, toBePublished, { qos: undefined, messageId: message.id }); // this is the message to the console when subscribed
      /** 
       * After this time (in ms) an acknowledgment will be sent out.
       */
      setTimeout(function(){
        message.ack(function(){}); // no callback
      }, _opts.ackDeadline)
  });
}

/**
 * When a publish is done, this function is called, it adds it to Google Pubsub
 */
PubsubAscoltatore.prototype.publish = function(topic, message, options, done) {
  var that = this;
  this._raiseIfClosed();
  message = message || "";
  done = done || function() {};

  var messageObj = {
    value: message,
    topic: topic,
    options: options
  };

  this._gcloudSubscribe(); // listen to Google PubSub

  /**
   * ADD TO PUBSUB
   */
  _mainTopic.publish({
    data: messageObj
  }, function(err) {
    done();
  });
};

PubsubAscoltatore.prototype.subscribe = function(topic, callback, done) {
  this._raiseIfClosed();
  debug('subscribe');
  this._gcloudSubscribe(); // listen to Google PubSub
  _ascoltatore.subscribe(topic, callback, done);
};

PubsubAscoltatore.prototype.unsubscribe = function() {
  this._raiseIfClosed();
  _ascoltatore.unsubscribe.apply(_ascoltatore, arguments);
};

PubsubAscoltatore.prototype.unsub = PubsubAscoltatore.prototype.unsubscribe;

PubsubAscoltatore.prototype.close = function close(done) {
  var that = this;
  var closeEmbedded = function() {
    _ascoltatore.close(function() {
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
      /**
       * CLOSE CONNECTION
       */
      debug('close connection');
    }
  ], closeEmbedded);
};

util.aliasAscoltatore(PubsubAscoltatore.prototype);

/**
 * Exports the MongoAscoltatore
 *
 * @api public
 */
module.exports = PubsubAscoltatore;
