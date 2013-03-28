Ascoltatori
===========

[![Build
Status](https://travis-ci.org/mcollina/ascoltatori.png)](https://travis-ci.org/mcollina/ascoltatori)

__Ascoltatori__ is the publish/subscribe library that supports every
broker/protocol out there.
This list currently includes:

* [RabbitMQ](http://www.rabbitmq.com/) and all implementations of
  the [AMQP](http://www.amqp.org/) protocol.
* [Redis](http://redis.io/), the fabulous key/value store by
  [@antirez](https://github.com/antirez).
* [Mosquitto](http://mosquitto.org/) and all implementations of the
  [MQTT](http://mqtt.org/) protocol.
* [MongoDB](http://www.mongodb.org/), the documental NoSQL that
  is revolutioning how web apps are built.
* [ZeroMQ](http://www.zeromq.org/) without a central broker, so
  Ascoltatori can also be used in a P2P fashion.

The source code of __Ascoltatori__ had been annotated with
[dox](https://github.com/visionmedia/dox)
and the generated documentation is available at:
http://mcollina.github.com/ascoltatori/docs/ascoltatori.js.html

> Ascoltatori is an italian word which means listeners.
An Ascoltatore is therefore a single listener.

## Install

```
npm install ascoltatori --save
```

## Usage

__Ascoltatori__ is built to be extremely easy to use, and can provide a
useful abstraction for every compatible pub/sub broker.
In this way you can choose whatever broker suits you.

```
var ascoltatori = require('ascoltatori');

ascoltatori.build(function (ascoltatore) {

  ascoltatore.subscribe("hello/*", function() {
    // this will print { '0': "hello/42", '1': "a message" }
    console.log(arguments); 
    process.exit(0);
  });

  ascoltatore.publish("hello/42", "a message", function() {
    console.log("message published");
  });
});
```

See the tests for more examples regarding RedisAscoltatore,
AMQPAscoltatore, ZeromqAscoltatore, MQTTAscoltatore.

In the test/common.js file you can find all the options for
all the ascoltatori.

All ascoltatori supports the use of a wildcards, so everything
should work smoothly on every broker.
You might find some differences, and in that case file a bug
report, so I can fix them.

## Configuration and dependencies

This library does not depend directly on redis, AMQP (RabbitMQ),
0MQ, MQTT.js, but rather it encourages you to pass them to the
ascoltatori via an options object, like so (for Redis):

```
var ascoltatori = require('ascoltatori');

var settings = {
  type: 'redis',
  redis: require('redis'),
  db: 12,
  port: 424242,
  host: 192.168.42.42
};

ascoltatori.build(settings, function (ascoltatore) {

  ascoltatore.subscribe("hello/*", function() {
    // this will print { '0': "hello/42", '1': "a message" }
    console.log(arguments); 
    process.exit(0);
  });

  ascoltatore.publish("hello/42", "a message", function() {
    console.log("message published");
  });
});
```


By default, every ascoltatore built by the `ascoltatori.build`
wraps every published message in a JSON format.
This behaviour can be triggered off by passing a `{ json: false }`
settings object, like so:
```
require('ascoltatori').build({ json: false }, function(a) {
  // ...
});
```

If you feel one more option is missing, feel free to fork this library,
add it, and then send a pull request.

### Domain support

__Ascoltatori__ properly supports the [node.js domain API](http://nodejs.org/api/domain.html).
To use it, you have to call the `registerDomain` function on your
_Ascoltatore_, and it will take care of routing the exceptions to the
given domain. Look at this example:
```
var ascoltatori = require('ascoltatori');
var domain      = require("domain");

var d = domain.create();
d.on("error", function() {
  console.log(arguments); 
  process.exit(0);
});

ascoltatori.build(function (ascoltatore) {

  ascoltatore.registerDomain(d);

  ascoltatore.subscribe("hello/*", function() {
    throw new Error();
  });

  ascoltatore.publish("hello/42", "a message", function() {
    console.log("message published");
  });
});
```

## Debugging

__Ascoltatori__ supports the clever
[debug](https://github.com/visionmedia/debug) package, so it is able to
trigger the logging based on an external enviroment variable, like so:
```
$: DEBUG=ascoltatori:mqtt node exaples/mqtt_topic_bridge.js
```

The following debug flags are supported, one for each ascoltatore:
* `ascoltatori:amqp`
* `ascoltatori:memory`
* `ascoltatori:mqtt`
* `ascoltatori:prefix`
* `ascoltatori:redis`
* `ascoltatori:zmq`

## Reliability

Due to the various transports Ascoltatori uses, it is impossible to
garantee one of the various reliability properties across all of the
transports.
However, the MQTT and AMQP ascoltatori provides at-least-once semantics,
which means that the message might be received more than once, but at
least once.

## Contributing to Ascoltatori

* Check out the latest master to make sure the feature hasn't been
  implemented or the bug hasn't been fixed yet
* Check out the issue tracker to make sure someone already hasn't
  requested it and/or contributed it
* Fork the project
* Start a feature/bugfix branch
* Commit and push until you are happy with your contribution
* Make sure to add tests for it. This is important so I don't break it
  in a future version unintentionally.
* Please try not to mess with the Makefile and package.json. If you
  want to have your own version, or is otherwise necessary, that is
  fine, but please isolate to its own commit so I can cherry-pick around
  it.

## LICENSE - "MIT License"

Copyright (c) 2012-2013 Matteo Collina, http://matteocollina.com

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
