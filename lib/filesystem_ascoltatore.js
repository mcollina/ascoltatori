"use strict";

var AbstractAscoltatore = require('./abstract_ascoltatore');
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
  AbstractAscoltatore.call(this, opts, {
    separator: '.'
  });

  opts = opts || {};

  var QlobberFSQ = (opts.qlobber_fsq || require('qlobber-fsq')).QlobberFSQ;

  opts.separator = this._nativeSettings.separator;
  opts.wildcard_one = this._wildcardOne;
  opts.wildcard_some = this._wildcardSome;
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
  var ths = this;

  function cb(data, info, cb2)
  {
    data = JSON.parse(data);
    callback(ths._recvTopic(info.topic), data.message, data.options);
    cb2();
  }

  var f = cb;

  callback[this._dehnd] = callback[this._dehnd] || f;

  this._fsq.subscribe(this._subTopic(topic),
                      callback[this._dehnd],
                      done);
};

FileSystemAscoltatore.prototype.unsubscribe = function (topic, callback, done)
{
  this._fsq.unsubscribe(this._subTopic(topic),
                        callback[this._dehnd] || callback,
                        done);
};

FileSystemAscoltatore.prototype.publish = function (topic, message, options, done)
{
  this._fsq.publish(this._pubTopic(topic), JSON.stringify({
    message: message,
    options: options
  }), done);
};

FileSystemAscoltatore.prototype.close = function (done)
{
  this._fsq.stop_watching(done);
};

util.aliasAscoltatore(FileSystemAscoltatore.prototype);

/**
 * Exports the FileSystemAscoltatore.
 *
 * @api public
 */
module.exports = FileSystemAscoltatore;

