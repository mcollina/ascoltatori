"use strict";

var util = require("./util");
var defer = util.defer;
var TrieAscoltatore = require("./trie_ascoltatore");
var AbstractAscoltatore = require('./abstract_ascoltatore');
var debug = require("debug")("ascoltatori:kafka");
var Qlobber = require('qlobber').Qlobber;
var SubsCounter = require("./subs_counter");

/**
 * KafkaAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented through the `kafka-node` package and it could be
 * backed up by kafka 0.8 and above.
 *
 * The options are:
 *  - connectionString: Zookeeper connection string, default localhost:2181/
 *  - clientId: This is a user-supplied identifier for the client application, default kafka-node-client
 *  - zkOptions: Object, Zookeeper options, see node-zookeeper-client
 *  - noAckBatchOptions: Object, when requireAcks is disabled on Producer side we can define the batch properties, 'noAckBatchSize' in bytes and 'noAckBatchAge' in milliseconds. The default value is { noAckBatchSize: null, noAckBatchAge: null } and it acts as if there was no batch
 *  - groupId: Consumer group id, defaults to kafka-node-group
 *  - encodings: map of topic:encoding where encoding is not the defaultEncoding
 *  - defaultEncoding: default value is utf8
 *
 * @api public
 * @param {Object} opts The options object
 */
function KafkaAscoltatore(opts) {
  AbstractAscoltatore.call(this, opts, {
    separator: '_',
    wildcardOne: '*',
    wildcardSome: '#'
  });
  this._default_opts = {connectionString: "localhost:2181/", clientId: "kafka-node-client", groupId: "kafka-node-group"};
  this._opts = opts || this._default_opts;
  this._opts.keepalive = this._opts.keepalive || 3000;
  this._opts.kafka = this._opts.kafka || require("kafka-node");
  this._opts.encodings = this._opts.encodings || {};
  this._opts.defaultEncoding = this._opts.defaultEncoding || "utf8";
  this._opts.noAckBatchOptions = this._opts.noAckBatchOptions || { noAckBatchSize: null, noAckBatchAge: null };

  this._knowntopics = [];
  this._subs_counter = new SubsCounter();
  this._qlobber_opts = {separator: '_',  wildcard_one: '*', wildcard_some: '#'};
  this._subs_matcher = new Qlobber(this._qlobber_opts);

  this._ascoltatore = new TrieAscoltatore(opts);
  this._consumerStarting = false;
  var connectionString = this._opts.connectionString || this._default_opts.connectionString;
  var clientId = this._opts.clientId || this._default_opts.clientId;
  var zkOptions = this._opts.zkOptions || this._default_opts.zkOptions;
  var noAckBatchOptions = this._opts.noAckBatchOptions;
  var Client = this._opts.kafka.Client;
  this._producerClient = new Client(connectionString,clientId,zkOptions,noAckBatchOptions);
  var HighLevelProducer = this._opts.kafka.HighLevelProducer;
  this._producer = new HighLevelProducer(this._producerClient);
  var that = this;
  this._producer.on('ready',function(){
     that.readZkTopics(function(err,topics){
        if(err){
           that.emit("error",err);
           return;
        }
       that._knowntopics = that._knowntopics.concat(topics);
       that.emit("ready");
      });
   });
}

/**
 * KafkaAscoltatore inherits from AbstractAscoltatore
 *
 * @api private
 */
KafkaAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

KafkaAscoltatore.prototype.withTopicPartitionsExpanded = function withTopicPartitionsExpanded(client,topics,callback){
  var that = this;
  var wanted = [];
  topics.forEach(function(t){
     wanted.push(t.topic);
  });
  client.loadMetadataForTopics(wanted, function(err, results) {
       if(err){
          callback(err,null);
          return;
       }
       var metadata = results[1].metadata;
       var partitions = [];
       for(var i=0;i<topics.length;i++){
           var topic = topics[i].topic;
           if (topic in metadata){
             var dictionary = metadata[topic];
             for (var key in dictionary) {
               if (dictionary.hasOwnProperty(key)) {
                  partitions.push({topic: topic, partition: dictionary[key].partition, time: -1, maxNum: 1});
               }
             }
           }
       }
       callback(null,partitions);
   });
};
KafkaAscoltatore.prototype.withTopicOffsetsAdded = function withTopicOffsetsAdded(client,topics,callback){
     var that = this;
     this.withTopicPartitionsExpanded(client, topics, function(err, partitions){
       if(err){
           callback(err,null);
           return;
       }
       for(var i=0;i<partitions.length;i++){
          partitions[i].time = -1;
          partitions[i].maxNum = 1;
       }
       var kafka = that._opts.kafka;
       var offset = new kafka.Offset(client);
       offset.fetch(partitions, function (err, data) {
           if(err){
             callback(err,null);
             return;
           }
           var offsets = [];
           for (var topic in data) {
             if (data.hasOwnProperty(topic)) {
                for(var partition in data[topic]){
                   if(data[topic].hasOwnProperty(partition)){
                      offsets.push({topic: topic, partition: parseInt(partition), offset: data[topic][partition][0]});
                   }
                }
             }
           }
           callback(null,offsets);
       });
   });
};

/**
 * Starts a new connection to an Kafka server.
 * Do nothing if it is already started.
 *
 * @api private
 */
KafkaAscoltatore.prototype._startConn = function(cb) {
  var that = this;
  if (this._consumer !== undefined) {
      return;
  }
   this._consumerStarting = true;
   var newcb = function(){
          that._consumerStarting = false;
          util.wrap(cb)();
          that.emit("consumer_connected");
   };
   var connectionString = that._opts.connectionString || that._default_opts.connectionString;
   var clientId = that._opts.clientId || that._default_opts.clientId;
   var zkOptions = that._opts.zkOptions || that._default_opts.zkOptions;
   var noAckBatchOptions = that._opts.noAckBatchOptions;
   var groupId = that._opts.groupId || that._default_opts.groupId;
   var Client = this._opts.kafka.Client;
   var HighLevelConsumer = this._opts.kafka.HighLevelConsumer;
   var Consumer = this._opts.kafka.Consumer;
   var subscribedTopics = that._subs_counter.keys();
   var subscriptions = [];
   subscribedTopics.forEach(function(topic){
        subscriptions.push({topic: topic, offset: -1});
   });
   debug("consumer connecting with connectionString=["+connectionString+"], clientId=["+clientId+"], groupId=["+groupId+"] and initial subscriptions",subscriptions);
   this._consumerClient = new Client(connectionString,clientId,zkOptions,noAckBatchOptions);
   var initConsumer = function(err,subscriptions){
        if(err){
          debug("problem with initConsumer",err);
          that.emit("error", err);
          return false;
        }
        debug("initial subscriptions expanded to ",subscriptions);
        that._consumer = new Consumer(that._consumerClient,subscriptions,{groupId: groupId,
                fromOffset: true,    autoCommit: false, encoding: "buffer" });

        that._consumer.on("message", function(message) {
            debug("received new message on topic ", message.topic);
            var value = message.value;
            var encoding = that._opts.encodings[message.topic] || that._opts.defaultEncoding;
            if(message.value && encoding !== "buffer"){
              value = message.value.toString(encoding);
              debug("message is", value);
            }
            if(that._ascoltatore._closed !== true){
              debug("publishing to _ascolatore ", message.topic);
              that._ascoltatore.publish(that._recvTopic(message.topic), value);
            }
        });
        that._consumer.on('error', function(e) {
          debug("error in client",e);
          that.emit("error", e);
        });
        defer(newcb);
    };
    that._consumerClient.on('ready',function() {
        that.withTopicOffsetsAdded(that._consumerClient,subscriptions,initConsumer);
    });
};

KafkaAscoltatore.prototype.subscribe = function subscribe(topic, onMessageReceived, done) {
  this._raiseIfClosed();
  var that = this;
  if(this._consumerStarting){
     debug("waiting for consumer_connected before subscribing");
     this.on("consumer_connected",function(){ that.subscribe(topic,onMessageReceived,done); });
     return;
  }

  debug("subscribe called for ",topic);
  var subtopic = this._subTopic(topic);
  this._subs_matcher.add(subtopic,'x');
  var matcher = new Qlobber(this._qlobber_opts);
  matcher.add(subtopic,'wanted');
  var subscribe_topics = [];
  for (var i=0, l=this._knowntopics.length; i<l; i++){
    var top = this._knowntopics[i];
    if(matcher.match(top).length > 0){
      if(!(that._subs_counter.include(top))){
        subscribe_topics.push({topic: top});
      }
      that._subs_counter.add(top);
    }
  }

  this._ascoltatore.subscribe(topic, onMessageReceived);
  if(subscribe_topics.length === 0){
     defer(done);
     return;
  }

  if(this._consumer === undefined){
    this._startConn(done);
    return;
  }

  this.addKafkaSubscriptions(subscribe_topics, done);
};

KafkaAscoltatore.prototype.addKafkaSubscriptions = function addKafkaSubscriptions(subscribe_topics, done) {
  var that = this;
  debug("registering new subscriber for topics ", subscribe_topics);
  this.withTopicOffsetsAdded(this._consumerClient,subscribe_topics,function(err,subscriptions){
          if(err){
            debug("problem adding kafka subscriptions with topic offsets added",err);
            that.emit("error",err);
            return;
          }
          that._consumer.addTopics(subscriptions,function(err,added) {
                if(err){
                  debug("problem with consumer.addTopics",err);
                  that.emit("error",err);
                  return;
                }
                debug("registered new kafka subscriptions", subscribe_topics);
                defer(done);
              },true);
    });
};

KafkaAscoltatore.prototype.publish = function publish(topic, message, done) {
  this._raiseIfClosed();
  var that = this;
  // kafka cannot send a null message. Why are messages missing in the tests...
  if(message === undefined || message === null){
    message = '';
  }
  var pubtopic = this._pubTopic(topic);
  var doPublish = function(){
    var payload = {
      messages: message,
      topic: pubtopic
    };
    debug("about to publish new message to ",pubtopic);
    that._producer.send([payload], function(err,data) {
      if(err){
        debug("something went wrong publishing to "+pubtopic,err);
        that.emit("error",err);
      }else{
        debug("new message published to " + pubtopic);
      }
      util.wrap(done)();
    });
  };

  if(this._knowntopics.indexOf(pubtopic) >= 0){
     //we already know about this topic, so publish to it and we're done.
     doPublish();
     return;
  }

  // it's a new topic for kafka
  var createTopicCallback = function(err){
         if(err){
            debug("problem creating topic",err);
            that.emit("error",err);
            return;
         }
         //do subscribers await this new topic?
         var wanted = that._subs_matcher.match(pubtopic);
         if(wanted.length === 0){
             // nobody subscribed at our end, so just publish to kafka
             doPublish();
             return;
         }
         // somebody wants messages published to the new topic
         for(var i=0;i<wanted.length;i++){
            that._subs_counter.add(pubtopic);
         }
         if(that._consumer === undefined){
            // start the kafka consumer before publishing
            // starting the consumer will add the subscription
            that._startConn(doPublish);
            return;
         }
         // the kafka consumer is already running
         // just add the new subscriptions before publishing
         that.addKafkaSubscriptions([{topic: pubtopic}], function(){
             debug("publish route 4");
             doPublish();
         });
     };
  this.createTopics(pubtopic, createTopicCallback);
};

KafkaAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();
  var that = this;

  var subtopic = this._subTopic(topic);

  var newDone = function() {
    debug("deregistered subscriber for topic " + subtopic);
    defer(done);
  };

  this._subs_matcher.remove(subtopic);
  this._ascoltatore.unsubscribe(topic, callback);
  if(this._consumerClient === undefined){
    newDone();
    return;
  }

  var matcher = new Qlobber(this._qlobber_opts);
  matcher.add(subtopic,'unwanted');
  var unsubscribe_topics = [];
  for (var i=0, l=this._knowntopics.length; i<l; i++){
    var top = this._knowntopics[i];
    if(matcher.match(top).length > 0){
      that._subs_counter.remove(top);
      if(!(that._subs_counter.include(top))){
        unsubscribe_topics.push({topic: top});
      }
    }
  }

  if(unsubscribe_topics.length === 0 ) {
    newDone();
    return;
  }

  debug("deregistering subscriber for topic " + unsubscribe_topics);
  this.withTopicPartitionsExpanded(this._consumerClient,unsubscribe_topics,function(err,partitions){
      if(err){
        debug("problem expanding topics before unsubscribe",err);
        that.emit("error",err);
        return;
      }
      that._consumer.removeTopics(partitions,function(err,removed){ 
          if(err){
            debug("problem removing topics",err);
            that.emit("error",err);
            return;
          }
          newDone();
       });
  });
};

KafkaAscoltatore.prototype.readZkTopics = function readZkTopics(callback){
  var that = this;
  this._raiseIfClosed();
   this._producerClient.zk.client.getChildren("/config/topics", function (error, children, stats) {
     if (error) {
         callback(error,null);
         return;
     }
     callback(null,children);
   });
};

KafkaAscoltatore.prototype.createTopics = function createTopics(topics,callback){
  var that = this;
  if(typeof topics === 'string'){
     topics = [topics];
  }
  debug("creating topics ",topics);
  this._producer.createTopics(topics, false, function (err, data) {
         if(err){
            debug("problem creating topics",err);
            defer(function(){callback(err);});
            return;
         }
         that._knowntopics = that._knowntopics.concat(topics);
         defer(callback);
    });
};

KafkaAscoltatore.prototype.close = function close(done) {
  var that = this;
  debug("closing");
  if (!this._closed) {
    this._subs_counter.clear();
    if(this._producer){
      this._producer.close(function(){
        that._producerClient.close(function() {
          debug("closed producer");
          delete that._producerClient;
          delete that._producer;
        });
      });
    }
    if(this._consumer){
       that._consumer.close(function(){
        debug("closed consumer");
        that._consumerClient.close(function() {
          debug("closed");
          that._ascoltatore.close();
          delete that._consumerClient;
          delete that._consumer;
          that.emit("closed");
          defer(done);
        });
     });
    }else{
      this.emit("closed");
      util.wrap(done)();
    }
  } else {
    util.wrap(done)();
  }
};

util.aliasAscoltatore(KafkaAscoltatore.prototype);

/**
 * Exports the KafkaAscoltatore
 *
 * @api public
 */
module.exports = KafkaAscoltatore;
