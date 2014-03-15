"use strict";

var AbstractAscoltatore = require('./abstract_ascoltatore');
var QlobberFSQ = require('qlobber-fsq').QlobberFSQ;
var crypto = require('crypto');
var util = require('./util');
var debug = require('debug')('ascoltatori:filesystem');

/**
 * FileSystemAscoltatore is a class that inherits from AbstractAscoltatore.
 * It is implemented using the `qlobber-fsq` module and writes messages to disk. *
 * See the [`qlobber-fsq` documentation](https://github.com/davedoesdev/qlobber-fsq) for available options.
 */
function FileSystemAscoltatore(opts)
{
  AbstractAscoltatore.call(this);

  opts = opts || {};

  opts.separator = '.';
  opts.wildcard_one = '+';
  opts.wildcard_some = '*';
  opts.dedup = false;

  this._dehnd = '__filesystem_ascoltatore' + crypto.randomBytes(16).toString('base64');
  this._fsq = new QlobberFSQ(opts);

  var ths = this;

  this._fsq.on('start', function () {
    ths.emit('ready');
  });
}

/**
 * See AbstractAscoltatore for the public API definitions.
 *
 * @api private
 */

FileSystemAscoltatore.prototype = Object.create(AbstractAscoltatore.prototype);

FileSystemAscoltatore.prototype.subscribe = function (topic, callback, done)
{
  function cb(data, info, cb2)
  {
    data = JSON.parse(data);
    callback(info.topic.replace(/\./g, '\/'), data.message, data.options);
    cb2();
  }

  var f = cb;

  if (this._domain) {
    f = this._domain.bind(cb);
  }

  callback[this._dehnd] = callback[this._dehnd] || f;

  this._fsq.subscribe(topic.replace(/\//g, '.'), callback[this._dehnd], done);
};

FileSystemAscoltatore.prototype.unsubscribe = function (topic, callback, done)
{
  this._fsq.unsubscribe(topic.replace(/\//g, '.'), callback[this._dehnd] || callback, done);
};

FileSystemAscoltatore.prototype.publish = function (topic, message, options, done)
{
  this._fsq.publish(topic.replace(/\//g, '.'), JSON.stringify({
    message: message,
    options: options
  }), done);
};

FileSystemAscoltatore.prototype.close = function (done)
{
  this._fsq.stop_watching(done);
};

FileSystemAscoltatore.prototype.registerDomain = function (domain)
{
  debug('registered domain');

  this._domain = domain;

  var ths = this;

  domain.on('error', function () {
    // assume the worst (the error was thrown and the polling stopped)
    ths._fsq._watching = false;
  });
};

util.aliasAscoltatore(FileSystemAscoltatore.prototype);

/**
 * Exports the FileSystemAscoltatore.
 *
 * @api public
 */
module.exports = FileSystemAscoltatore;

