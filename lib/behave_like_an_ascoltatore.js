"use strict";

var wrap = require("./util").wrap;
var steed = require("steed")();

/**
 * This is a shared mocha test for verifying that an
 * ascoltatore is behaving like one.
 *
 * This requires that the test exposes an instance property
 * on `this`.
 *
 * See as an example:
 * https://github.com/mcollina/ascoltatori/blob/master/test/redis_ascoltatore_spec.js
 *
 * @api public
 */
module.exports = function() {

  var expect;

  // you MUST depend on chai only if you plan to run
  // this test
  expect = require("chai").expect;

  it("should have a subscribe function", function() {
    var that = this;
    expect(that.instance).to.respondTo("subscribe");
  });

  it("should have an publish function", function() {
    var that = this;
    expect(that.instance).to.respondTo("publish");
  });

  it("should support a publish/subscribe pattern", function(done) {
    var that = this;
    that.instance.subscribe("hello", wrap(done), function() {
      that.instance.publish("hello");
    });
  });

  it("should support 'pub/sub' combination for pub/sub", function(done) {
    var that = this;
    that.instance.sub("hello", wrap(done), function() {
      that.instance.pub("hello");
    });
  });

  it("should not raise an exception if pub is called without a done callback", function(done) {
    this.instance.pub("hello");
    setTimeout(done, 50);
  });

  it("should not raise an exception if sub is called without a done callback", function(done) {
    var that = this;
    that.instance.sub("hello", function() {});
    setTimeout(function() {
      // still, some Ascoltatore are steed
      // and we must give them some time
      done();
    }, 10);
  });

  it("should accept a done callback in pub", function(done) {
    this.instance.pub("hello", "world", done);
  });

  it("should support multi-level wildcard at start of topic", function(done) {
    var that = this;
    that.instance.sub("*/hello", wrap(done), function() {
      that.instance.pub("42/there/hello");
    });
  });

  it("should support multi-level wildcard in middle of topic", function(done) {
    var that = this;
    that.instance.sub("hello/*/end", wrap(done), function() {
      that.instance.pub("hello/there/42/end");
    });
  });

  it("should support multi-level wildcard at end of topic", function(done) {
    var that = this;
    that.instance.sub("hello/*", wrap(done), function() {
      that.instance.pub("hello/there/42");
    });
  });

  it("should support multi-level wildcard at the end of a topic with no separator", function(done) {
    var that = this;
    that.instance.sub("hello/*", wrap(done), function() {
      that.instance.pub("hello");
    });
  });

  it("should support single-level wildcard at start of topic", function(done) {
    var that = this;
    that.instance.sub("+/hello", wrap(done), function() {
      that.instance.pub("42/hello");
    });
  });

  it("should support single-level wildcard in middle of topic", function(done) {
    var that = this;
    that.instance.sub("hello/+/end", wrap(done), function() {
      that.instance.pub("hello/42/end");
    });
  });

  it("should support single-level wildcard at end of topic", function(done) {
    var that = this;
    that.instance.sub("hello/+", wrap(done), function() {
      that.instance.pub("hello/42");
    });
  });

  it("should support both wildcards in topic", function(done) {
    var that = this;
    that.instance.sub("hello/+/there/*/end", wrap(done), function() {
      that.instance.pub("hello/foo/there/bar/42/end");
    });
  });

  it("should not match multiple levels with single wildcard", function(done) {
    var that = this,
        callback = null;

    callback = function(topic) {
      expect(topic).to.equal(["hello", "42", "there"].join(that.separator));
      done();
    };

    that.instance.sub("hello/+/there", callback, function () {
      that.instance.pub("hello/42/43/there");
      that.instance.pub("hello/42/there");
    });
  });

  it("should unsubscribe from wildcard topics independently", function(done) {
    var that = this,
        callback1 = null,
        callback2 = null;

    callback1 = function(topic) {
      expect(topic).to.equal(["hello", "42", "there"].join(that.separator));
      done();
    };

    callback2 = function () { };

    that.instance.sub("hello/*/there", callback2, function () {
      that.instance.sub("hello/+/there", callback1, function () {
        that.instance.unsub("hello/*/there", callback2, function () {
          that.instance.pub("hello/42/there");
        });
      });
    });
  });

  it("should call each matching callback", function(done) {
    var that = this,
        callback = null,
        count = 0;

    callback = function(topic) {
      expect(topic).to.equal(["hello", "42"].join(that.separator));
      count += 1;
      if (count === 2) {
        done();
      }
    };

    that.instance.sub("hello/42", callback, function () {
      that.instance.sub("hello/*", callback, function () {
        that.instance.pub("hello/42");
      });
    });
  });

  it("should publish the topic name", function(done) {
    var that = this;
    that.instance.sub("hello/*", function(topic) {
      expect(topic).to.equal(["hello", "42"].join(that.separator));
      done();
    }, function() {
      that.instance.pub("hello/42");
    });
  });

  it("should publish the passed argument", function(done) {
    var that = this;
    that.instance.sub("hello/*", function(topic, value) {
      expect(value.toString()).to.equal("42");
      done();
    }, function() {
      that.instance.pub("hello/123", "42");
    });
  });

  it("should have an unsubscribe function", function() {
    var that = this;
    expect(that.instance).to.respondTo("unsubscribe");
  });

  it("should have an unsub function", function() {
    var that = this;
    expect(that.instance).to.respondTo("unsub");
  });

  it("should remove a listener", function(done) {
    var that = this;
    var funcToRemove = null;

    funcToRemove = function(topic, value) {
      throw "that should never run";
    };
    steed.series([

      function(cb) {
        that.instance.sub("hello", funcToRemove, cb);
      },

      function(cb) {
        that.instance.sub("hello", wrap(done), cb);
      },

      function(cb) {
        that.instance.unsub("hello", funcToRemove, cb);
      },

      function(cb) {
        that.instance.pub("hello", null, cb);
      }
    ]);
  });

  it("should remove a listener for global searches", function(done) {
    var that = this,
      funcToRemove = null;
    funcToRemove = function(topic, value) {
      throw "that should never run";
    };
    steed.series([

      function(cb) {
        that.instance.sub("hello/42", wrap(done), cb);
      },

      function(cb) {
        that.instance.sub("hello/*", funcToRemove, cb);
      },

      function(cb) {
        that.instance.unsub("hello/*", funcToRemove, cb);
      },

      function(cb) {
        that.instance.pub("hello/42", null, cb);
      }
    ]);
  });

  it("support at least 10 listeners", function(done) {
    var instance = this.instance,
      counter = 11,
      i = null,
      callback = null,
      subscribe = null,
      a = [];

    callback = function() {
      counter = counter - 1;
      if (counter === 0) {
        done();
      }
    };

    subscribe = function (done) {
      instance.subscribe("hello", callback, done);
    };

    for (i = counter; i > 0; i = i - 1) {
      a.push(subscribe);
    }

    steed.parallel(a, instance.publish.bind(instance, "hello", null));
  });

  it("should emit the ready event", function(done) {
    this.instance.on("ready", done);
  });

  it("should support at least 12 listeners as an EventEmitter", function(done) {
    var counter = 11,
      i = null,
      callback, a = [];

    callback = function() {
      counter = counter - 1;
      if (counter === 0) {
        done();
      }
    };

    for (i = counter; i > 0; i = i - 1) {
      a.push(this.instance.on.bind(this.instance, "ready", callback));
    }
    steed.parallel(a);
  });

  it("should support removing a single listener", function(done) {
    var that = this,
      funcToRemove;

    funcToRemove = function(topic, value) {
      throw "that should never run";
    };
    steed.series([

      function(cb) {
        that.instance.sub("hello", wrap(done), cb);
      },

      function(cb) {
        that.instance.sub("hello", funcToRemove, cb);
      },

      function(cb) {
        that.instance.unsub("hello", funcToRemove, cb);
      },

      function(cb) {
        that.instance.pub("hello", null, cb);
      }
    ]);
  });

  it("should have a close function", function() {
    var that = this;
    expect(that.instance).to.respondTo("close");
  });

  it("should throw an error if publishing when the ascoltatore has been closed", function(done) {
    this.instance.close(function() {
      expect(function() {
        this.instance.publish("hello", "world");
      }).to.throw;
      done();
    });
  });

  it("should throw an error if subscribing when the ascoltatore has been closed", function(done) {
    this.instance.close(function() {
      expect(function() {
        this.instance.subscribe("hello");
      }).to.throw;
      done();
    });
  });

  it("should close using a callback", function(done) {
    var that = this;
    this.instance.publish("hello", "world", function() {
      that.instance.close(done);
    });
  });

  it("should allow the close method to be called twice", function(done) {
    var that = this;
    steed.series([
      this.instance.publish.bind(this.instance, "hello", "world"),
      this.instance.close.bind(this.instance),
      this.instance.close.bind(this.instance)
    ], done);
  });

  it("should not deliver message twice for double subscription", function(done) {
    var that = this,
      count = 2,
      sub = null,
      d = null;

    d = function() {
      count = count - 1;
      if (count === 0) {
        done();
      }
    };

    sub = function(cb) {
      var called = false;
      that.instance.sub("hello", function() {
        expect(called).to.be.equal(false);
        called = true;
        d();
      }, cb);
    };

    steed.series([
      sub, sub,

      function(cb) {
        that.instance.pub("hello", "ahha", cb);
      }
    ]);
  });

  it("should not deliver message twice for multiple subscriptions using wildcards", function(done) {
    var that = this,
      count = 3,
      sub = null,
      d = null;

    d = function() {
      count = count - 1;
      if (count === 0) {
        done();
      }
    };

    sub = function(topic, cb) {
      var called = false;
      that.instance.sub(topic, function() {
        expect(called).to.equal(false);
        called = true;
        d();
      }, cb);
    };

    steed.series([
      function (cb) {
        sub("a/+", cb);
      },
      function (cb) {
        sub("+/b", cb);
      },
      function (cb) {
        sub("a/b", cb);
      },
      function(cb) {
        that.instance.pub("a/b", "ahha", cb);
      }
    ]);
  });
};
