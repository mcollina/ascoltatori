Ascoltatori&nbsp;&nbsp;&nbsp;[![Build Status](https://travis-ci.org/mcollina/ascoltatori.png)](https://travis-ci.org/mcollina/ascoltatori) [![Coverage Status](https://coveralls.io/repos/mcollina/ascoltatori/badge.png?branch=master)](https://coveralls.io/r/mcollina/ascoltatori?branch=master)
========================================

> TIP: Ascoltatori is an italian word which means listeners.
An Ascoltatore is therefore a single listener.

Ascoltatori is a simple publish/subscribe library supporting the following brokers/protocols:

* [Redis](http://redis.io/), a key/value store created by [@antirez](https://github.com/antirez).
* [MongoDB](http://www.mongodb.org/), a scalable, high-performance, document-oriented database.
* [Mosquitto](http://mosquitto.org/) and all implementations of the [MQTT](http://mqtt.org/) protocol.
* [RabbitMQ](http://www.rabbitmq.com/) and all implementations of the [AMQP](http://www.amqp.org/) protocol.
* [ZeroMQ](http://www.zeromq.org/) to use Ascoltatori in a P2P fashion.
* [QlobberFSQ](https://github.com/davedoesdev/qlobber-fsq), a shared file system queue.
* [Apache Kafka](http://kafka.apache.org), a high-throughput distributed messaging system.
* Memory-only routing, using [Qlobber](https://github.com/davedoesdev/qlobber).

Find out more about Ascoltatori reading the
[dox generated documentation](http://mcollina.github.com/ascoltatori/docs/lib/ascoltatori.js.html)

[![NPM](https://nodei.co/npm/ascoltatori.png)](https://nodei.co/npm/ascoltatori/)
[![NPM](https://nodei.co/npm-dl/ascoltatori.png)](https://nodei.co/npm/ascoltatori/)

## Install

Install the library using [npm](http://npmjs.org/).

```
$ npm install ascoltatori --save
```

Install the library using git.

```
$ git clone git://github.com/mcollina/ascoltatori.git
$ cd ascoltatori
$ npm install
```


## Getting Started

Ascoltatori focuses on providing a simple and unique abstraction for all
supported brokes. Here a simple example using Redis.

```javascript
var ascoltatori = require('ascoltatori');

ascoltatori.build(function (err, ascoltatore) {

  // subscribes to a topic
  ascoltatore.subscribe('hello', function() {
    console.log(arguments);
    // { '0': 'hello', '1': 'a message' }
  });

  // publishes a message to the topic 'hello'
  ascoltatore.publish('hello', 'a message', function() {
    console.log('message published');
  });
});
```


## Wildcards

All ascoltatori support the use of wildcards, so everything
should work smoothly on every broker.
You might find some differences, and in that case file a bug
report, so we can fix them.

The wildcard character `+` matches exactly one word:

```javascript
var ascoltatori = require('ascoltatori');

ascoltatori.build(function (err, ascoltatore) {

  ascoltatore.subscribe("hello/+/world", function() {
    // this will print { '0': "hello/there/world", '1': "a message" }
    console.log(arguments);
  });

  ascoltatore.subscribe("hello/+", function() {
    // this will not be called
    console.log(arguments);
  });

  ascoltatore.publish("hello/there/world", "a message", function() {
    console.log("message published");
  });
});
```

The wildcard character `*` matches zero or more words:

```javascript
var ascoltatori = require('ascoltatori');

ascoltatori.build(function (err, ascoltatore) {

  ascoltatore.subscribe("hello/*", function() {
    // this will print { '0': "hello/there/world", '1': "a message" }
    console.log(arguments);
  });

  ascoltatore.subscribe("*", function() {
    // this will print { '0': "hello/there/world", '1': "a message" }
    console.log(arguments);
  });

  ascoltatore.subscribe("hello/there/world/*", function() {
    // this will print { '0': "hello/there/world", '1': "a message" }
    console.log(arguments);
  });

  ascoltatore.publish("hello/there/world", "a message", function() {
    console.log("message published");
  });
});
```

Of course, you can mix `*` and `+` in the same subscription:

```javascript
var ascoltatori = require('ascoltatori');

ascoltatori.build(function (err, ascoltatore) {

  ascoltatore.subscribe("hello/+/world/*", function() {
    // this will print { '0': "hello/foo/world/bar/42", '1': "a message" }
    console.log(arguments);
  });

  ascoltatore.publish("hello/foo/world/bar/42", "a message", function() {
    console.log("message published");
  });
});
```


## Brokers

Ascoltatori supports different brokers. Here we show how to use each of them.

### Redis

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'redis',
  redis: require('redis'),
  db: 12,
  port: 6379,
  return_buffers: true, // to handle binary payloads
  host: localhost
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

### MongoDB

MongoDB uses [Capped Collections](http://docs.mongodb.org/manual/core/capped-collections/) to implement the pub/sub pattern.

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'mongo',
  url: 'mongodb://127.0.0.1/ascoltatori',
  pubsubCollection: 'ascoltatori',
  mongo: {} // mongo specific options
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

It is also possible to reuse an existing mongodb connection:

```javascript
var ascoltatori = require('ascoltatori');
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://127.0.0.1/ascoltatori', {}, function (err, db) {
  var settings = {
    type: 'mongo',
    db: db,
    pubsubCollection: 'ascoltatori'
  };
  ascoltatori.build(settings, function (err, ascoltatore) {
    // ...
  });
})
```

### MQTT (Mosquitto)

```javascript
var ascoltatori = require('ascoltatori');
settings = {
  type: 'mqtt',
  json: false,
  mqtt: require('mqtt'),
  url: 'mqtt://127.0.0.1:1883'
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

### AMQP (RabbitMQ)

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'amqp',
  json: false,
  amqp: require('amqp'),
  exchange: 'ascolatore5672'
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

### ZeroMQ

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'zmq',
  json: false,
  zmq: require("zmq"),
  port: "tcp://127.0.0.1:33333",
  controlPort: "tcp://127.0.0.1:33334",
  delay: 10
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```


### QlobberFSQ

You can use any of the [QlobberFSQ constructor options](https://github.com/davedoesdev/qlobber-fsq#qlobberfsqoptions), for example:

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'filesystem',
  json: false,
  qlobber_fsq: require("qlobber-fsq"),
  fsq_dir: "/shared/fsq"
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

If you don't specify `fsq_dir` then messages will be written into a directory named `fsq` in the `qlobber-fsq` module directory.


### Memory

```javascript
var ascoltatori = require('ascoltatori');
ascoltatori.build(function (err, ascoltatore) {
  // ...
});
```

## JSON

By default, every ascoltatore built by the `ascoltatori.build` wraps every
published message in a JSON format. This behaviour can be triggered off by
passing the `{ json: false }` option.

```javascript
require('ascoltatori').build({ json: false }, function(err, a) {
  // ...
});
```

### Apache Kafka

```javascript
var ascoltatori = require('ascoltatori');
var settings = {
  type: 'kafka',
  json: false,
  kafka: require("kafka-node"),
  connectString: "localhost:2181",
  clientId: "ascoltatori",
  groupId: "ascoltatori",
  defaultEncoding: "utf8",
  encodings: {
    image: "buffer"
  }
};

ascoltatori.build(settings, function (err, ascoltatore) {
  // ...
});
```

If you publish to a kafka topic that doesn't exist, that topic will be created using the default settings.

If you subscribe to a kafka topic that doesn't exist, that subscription will take affect only when something is published to the kafka topic through this ascoltatori.


## Debugging

Ascoltatori supports the [debug](https://github.com/visionmedia/debug) package
and triggers the logs based on an external enviroment variable.

```
$ DEBUG=ascoltatori:mqtt node examples/mqtt_topic_bridge.js
```

The following debug flags are supported:
* `ascoltatori:amqp`
* `ascoltatori:trie`
* `ascoltatori:mqtt`
* `ascoltatori:prefix`
* `ascoltatori:redis`
* `ascoltatori:zmq`
* `ascoltatori:ee2`
* `ascoltatori:filesystem`
* `ascoltatori:kafka`


## Reliability

Due to the various transports Ascoltatori uses, it is impossible to
garantee one of the various reliability properties across all of the
transports. However, the MQTT and AMQP ascoltatori provides at-least-once
semantics, which means that the message might be received more than once,
but at least once.


## Feedback

Use the [issue tracker](http://github.com/mcollina/ascoltatori/issues) for bugs.
[Tweet](http://twitter.com/matteocollina) us for any idea that can improve the project.


## Links

* [GIT Repository](http://github.com/mcollina/ascoltatori)
* [Ascoltatori Documentation](http://mcollina.github.com/ascoltatori/docs/ascoltatori.js.html)
* [Redis](http://redis.io/)
* [MongoDB](http://www.mongodb.org/)
* [Mosquitto](http://mosquitto.org/)
* [RabbitMQ](http://www.rabbitmq.com/)
* [ZeroMQ](http://www.zeromq.org/)
* [Apache Kafka](http://kafka.apache.org/)


## Authors

* [Matteo Collina](http://twitter.com/matteocollina)
* [David Halls](https://github.com/davedoesdev)


## Contributors

Special thanks to the [following people](https://github.com/mcollina/ascoltatori/contributors) for submitting patches.


## LICENSE - "MIT License"

Copyright (c) 2012-2015 Matteo Collina and Contributors, http://matteocollina.com

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
