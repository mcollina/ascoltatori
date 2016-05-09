"use strict";

var AbstractAscoltatore = require("./abstract_ascoltatore");
var util = require("./util");
var defer = util.defer;
var debug = require("debug")("ascoltatori:filter");
var ascoltatori = require('./ascoltatori');
var TrieAscoltatore = require("./trie_ascoltatore");
var async = require("async");

/**
 * A FilterAscoltatore is a class that inherits from AbstractAscoltatore,
 * delegating to the first ascoltatore which accepts a topic.
 *
 * @api public
 */
function FilterAscoltatore(settings) {
  AbstractAscoltatore.call(this, settings);

  settings = settings || {};
  var filters = settings.filters || [];
  debug(filters.length+" filters given");
  filters.push({accepts: /.*/, ascoltatore: {type: "trie"}});
  this.wrapped = [];
  var that = this;
  var xtors = [];
  var xtor = function(filter){
     return function(callback){
                 var wrapper = function(err,result){
                      callback(err,{accepts: filter.accepts, ascoltatore: result});
                 };
                 ascoltatori.build(filter.ascoltatore,wrapper);
             };
  };
  for(var i=0;i<filters.length;i++){
     xtors.push(xtor(filters[i]));
  }

    async.parallel(xtors, function(err,results){
      if(err){
        that.emit("error",err);
      } else {
        that.wrapped = results;
        for(var i=0;i<results.length;i++){
          debug("filter "+i+" is "+results[i].accepts.toString());
        }
        that.emit("ready");
      }
    });

}


/**
 * See AbstractAscoltatore for the public API definitions.
 *
 * @api private
 */

FilterAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

FilterAscoltatore.prototype._filter = function filter(topic) {
  for(var i=0;i<this.wrapped.length;i++){
     if(this.wrapped[i].accepts.test(topic)){
        debug("filter "+this.wrapped[i].accepts.toString()+" accepts "+topic);
        return this.wrapped[i].ascoltatore;
     }
  }
};

FilterAscoltatore.prototype.subscribe = function subscribe(topic, callback, done) {
  this._raiseIfClosed();
  this._filter(topic).subscribe(topic,callback,done);
};

FilterAscoltatore.prototype.publish = function (topic, message, options, done) {
  this._raiseIfClosed();
  this._filter(topic).publish(topic,message,options,done);
};

FilterAscoltatore.prototype.unsubscribe = function unsubscribe(topic, callback, done) {
  this._raiseIfClosed();
  this._filter(topic).unsubscribe(topic,callback,done);
};

FilterAscoltatore.prototype.close = function close(done) {
  if(this._closed){
     defer(done);
     return;
  }
  var closers = [];
  var closer = function(delegate){
     return function(callback){delegate.close(callback);};
  }
  for(var i=0;i<this.wrapped.length;i++){
     var delegate = this.wrapped[i].ascoltatore;
     closers.push(closer(delegate));
  }
  var that = this;
  async.parallel(closers, function(err,results){
      that.emit("closed"); 
      defer(done);
  });
};

FilterAscoltatore.prototype.registerDomain = function(domain) {

  if (!this._publish) {
    this._publish = this.publish;
  }

  this.publish = domain.bind(this._publish);
};

util.aliasAscoltatore(FilterAscoltatore.prototype);

/**
 * Exports the FilterAscoltatore.
 *
 * @api public
 */
module.exports = FilterAscoltatore;
