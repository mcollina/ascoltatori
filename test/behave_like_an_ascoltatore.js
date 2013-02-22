"use strict";

var domain = require("domain");
var _ = require("underscore");

module.exports = function () {

    it("should have have a subscribe function", function () {
        var that = this;
        expect(that.instance).to.respondTo("subscribe");
    });

    it("should have have an publish function", function () {
        var that = this;
        expect(that.instance).to.respondTo("publish");
    });

    it("should support a publish/subscribe pattern", function (done) {
        var that = this;
        that.instance.subscribe("hello", wrap(done), function () {
            that.instance.publish("hello");
        });
    });

    it("should support 'pub/sub' combination for pub/sub", function (done) {
        var that = this;
        that.instance.sub("hello", wrap(done), function () {
            that.instance.pub("hello");
        });
    });

    it("should not raise an exception if pub is called without a done callback", function () {
        var that = this;
        that.instance.pub("hello");
    });

    it("should not raise an exception if pub is called without a done callback", function () {
        var that = this;
        that.instance.sub("hello", function () {});
    });

    it("should accept a done callback in pub", function (done) {
        this.instance.pub("hello", null, done);
    });

    it("should support wildcards", function (done) {
        var that = this;
        that.instance.sub("hello/*", wrap(done), function () {
            that.instance.pub("hello/42");
        });
    });

    it("should publish the topic name", function (done) {
        var that = this;
        that.instance.sub("hello/*", function (topic) {
            expect(topic).to.equal("hello/42");
            done();
        }, function () {
            that.instance.pub("hello/42");
        });
    });

    it("should publish the passed argument", function (done) {
        var that = this;
        that.instance.sub("hello/*", function (topic, value) {
            expect(value).to.equal("42");
            done();
        }, function () {
            that.instance.pub("hello/123", "42");
        });
    });

    it("should not publish to 'newTopic' on new topics", function (done) {
        var that = this;
        that.instance.sub("newTopic", function () {
            done(new Error("this should never be called"));
        });

        that.instance.sub("*", statsWrap(done), function () {
            that.instance.pub("hello/42");
        });
    });

    it("should emit a 'newTopic' event on new topics", function (done) {
        var that = this;

        // a subscription is needed, otherwise in a multiprocess
        // environment you won't receive them
        that.instance.sub("*", wrap(null), function () {

            that.instance.on("newTopic", function (channel) {
                statsWrap(done)(channel);
            });

            that.instance.pub("hello/42");
        });
    });

    it("should have have an unsubscribe function", function () {
        var that = this;
        expect(that.instance).to.respondTo("unsubscribe");
    });

    it("should have have an unsub function", function () {
        var that = this;
        expect(that.instance).to.respondTo("unsub");
    });

    it("should remove a listener", function (done) {
        var that = this;
        var funcToRemove = function (topic, value) {
            throw "that should never run";
        };
        async.series([
            function (cb) {
                that.instance.sub("hello", funcToRemove, cb);
            },
            function (cb) {
                that.instance.unsub("hello", funcToRemove, cb);
            },
            function (cb) {
                that.instance.sub("hello", wrap(done), cb);
            },
            function (cb) {
                that.instance.pub("hello", null, cb);
            }
        ]);
    });

    it("should remove a listener for global searches", function (done) {
        var that = this;
        var funcToRemove = function (topic, value) {
            throw "that should never run";
        };
        async.series([
            function (cb) {
                that.instance.sub("hello/42", wrap(done), cb);
            },
            function (cb) {
                that.instance.sub("hello/*", funcToRemove, cb);
            },
            function (cb) {
                that.instance.unsub("hello/*", funcToRemove, cb);
            },
            function (cb) {
                that.instance.pub("hello/42", null, cb);
            }
        ]);
    });

    it("support at least 10 listeners", function (done) {
        var instance = this.instance;

        var counter = 11;
        var callback = function () {
            if (--counter == 0) {
                done();
            }
        };

        var a = [];
        for(var i = counter; i > 0; i--) {
            a.push(instance.sub.bind(instance, "hello", callback));
        }

        async.parallel(a, instance.publish.bind(instance, "hello", null));
    });

    it("should emit the ready event", function (done) {
        this.instance.on("ready", done);
    });

    it("should support at least 12 listeners as an EventEmitter", function (done) {
        var counter = 11;
        var callback = function () {
            if (--counter == 0) {
                done();
            }
        };

        var a = [];
        for(var i = counter; i > 0; i--) {
            a.push(this.instance.on.bind(this.instance, "ready", callback));
        }
        async.parallel(a);
    });

    it("should support removing a single listener", function (done) {
        var that = this;
        var funcToRemove = function (topic, value) {
            throw "that should never run";
        };
        async.series([
            function (cb) {
                that.instance.sub("hello", wrap(done), cb);
            },
            function (cb) {
                that.instance.sub("hello", funcToRemove, cb);
            },
            function (cb) {
                that.instance.unsub("hello", funcToRemove, cb);
            },
            function (cb) {
                that.instance.pub("hello", null, cb);
            }
        ]);
    });

    it("should have have a close function", function () {
        var that = this;
        expect(that.instance).to.respondTo("close");
    });

    it("should throw an error if publishing when the ascoltatore has been closed", function () {
        this.instance.close();
        expect(function () {
            this.instance.publish("hello", "world");
        }).to.throw;
    });

    it("should throw an error if subscribing when the ascoltatore has been closed", function () {
        this.instance.close();
        expect(function () {
            this.instance.subscribe("hello");
        }).to.throw;
    });

    it("should close using a callback", function (done) {
        var that = this;
        this.instance.publish("hello", "world", function () {
            that.instance.close(done);
        });
    });

    it("should allow the close method to be called twice", function (done) {
        var that = this;
        async.series([
            this.instance.publish.bind(this.instance, "hello", "world"),
            this.instance.close.bind(this.instance),
            this.instance.close.bind(this.instance)
        ], done);
    });

    // this is due to a bug in mocha
    // https://github.com/visionmedia/mocha/issues/513
    describe("wrapping uncaughtException", function () {
        var uncaughtExceptionHandler;
        var dm;

        beforeEach(function (done) {
            dm = domain.create();
            uncaughtExceptionHandler = _.last(process.listeners("uncaughtException"));
            process.removeListener("uncaughtException", uncaughtExceptionHandler);
            done();
        });

        afterEach(function (done) {
            process.on("uncaughtException", uncaughtExceptionHandler);
            dm.dispose();
            done();
        });

        it("should support domains", function (done) {
            var that = this;

            dm.on("error", function (err) {
                done();
            });

            that.instance.registerDomain(dm);

            that.instance.subscribe("throw", function () {
                throw new Error("ahaha");
            }, function () {
                // we need to properly wait that the subscribe
                // has happened correctly

                // the nextTick hack is needed to skip out
                // of mocha control
                process.nextTick(function () {
                    that.instance.publish("throw");
                });
            });
        });
    });

    it("should not deliver message twice for double subscription", function (done) {
        var that = this;

        var count = 2;

        var d = function () {
            count--;
            if (count === 0) {
                done();
            }
        };

        var sub = function (cb) {
            var called = false;
            that.instance.sub("hello", function () {
                expect(called).to.be.false;
                called = true;
                d();
            }, cb);
        };

        async.series([
            sub, sub,
            function (cb) {
                that.instance.pub("hello", "ahha", cb);
            }
        ]);
    });

    it("should publish correctly a false", function (done) {
        var that = this;
        that.instance.sub("hello/*", function (topic, value) {
            expect(value).to.be.false;
            done();
        }, function () {
            that.instance.pub("hello/123", false);
        });
    });
};