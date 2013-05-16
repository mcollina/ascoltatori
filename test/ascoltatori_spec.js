describe("ascoltatori", function() {

  behaveLikeAnAscoltatore();

  beforeEach(function() {
    ascoltatori.use(new ascoltatori.MemoryAscoltatore());
    this.instance = ascoltatori;
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it("should have an use method", function() {
    expect(this.instance).to.respondTo("use");
  });

  it("should return the ascoltatori object when calling use", function() {
    var ascoltatore = new ascoltatori.MemoryAscoltatore();
    expect(ascoltatori.use(ascoltatore)).to.have.be.equal(ascoltatori);
  });

  it("should delegate to the use ascoltatore for 'pub'", function() {
    var ascoltatore = new ascoltatori.MemoryAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "publish");
    ascoltatori.use(ascoltatore);
    ascoltatori.publish("hello");
    expect(spy).to.have.been.calledWith("hello");
  });

  it("should delegate to _global for 'subscribe'", function() {
    var ascoltatore = new ascoltatori.MemoryAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "subscribe");
    var func = function(argument) {};
    ascoltatori.use(ascoltatore);
    ascoltatori.subscribe("hello", func);
    expect(spy).to.have.been.calledWith("hello", func);
  });

  it("should delegate to _global for 'removeListener'", function() {
    var ascoltatore = new ascoltatori.MemoryAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "removeListener");
    var func = function(argument) {};
    ascoltatori.use(ascoltatore);
    ascoltatori.sub("hello", func);
    ascoltatori.removeListener("hello", func);
    expect(spy).to.have.been.calledWith("hello", func);
  });

  it("should delegate to _global for 'close'", function() {
    var ascoltatore = new ascoltatori.MemoryAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "close");
    ascoltatori.use(ascoltatore);
    ascoltatori.close();
    expect(spy).to.have.been.called;
  });

  describe(".build", function() {

    var toClose = [];

    afterEach(function(done) {
      async.parallel(toClose.map(function(a) {
        return function(cb) {
          a.once("ready", function() {
            a.close(cb);
          });
        };
      }), done);
    });

    it("should create a new MQTTAscoltatore", function() {
      var settings = mqttSettings();
      settings.type = "mqtt";
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.MQTTAscoltatore);
    });

    it("should create a new RedisAscoltatore", function() {
      var settings = redisSettings();
      settings.type = "redis";
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.RedisAscoltatore);
    });

    it("should create a new AMQPAscoltatore", function() {
      var settings = rabbitSettings();
      settings.type = "amqp";
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.AMQPAscoltatore);
    });

    it("should create a new ZeromqAscoltatore", function() {
      var settings = zeromqSettings();
      settings.type = "zmq";
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.ZeromqAscoltatore);
    });

    it("should create a new MemoryAscolatore", function() {
      var a = ascoltatori.build({
        json: false
      });
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.MemoryAscoltatore);
    });

    it("should create a new AbstractAscoltatore using function", function() {
      var a = ascoltatori.build({
        json: false,
        type: function (options, ascoltatori) {
          this.__proto__ = ascoltatori.AbstractAscoltatore.prototype;
          ascoltatori.AbstractAscoltatore.call(this);

          this.close = function (done) {
            done();
          }

          this.emit("ready");
        }
      });
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.AbstractAscoltatore);
    });

    it("should wrap it with a prefix", function(done) {
      var settings = redisSettings();
      settings.type = "redis";
      settings.prefix = "/hello";

      var a = ascoltatori.build(settings);
      toClose.push(a);

      settings = redisSettings();
      settings.type = "redis";
      var b = ascoltatori.build(settings);
      toClose.push(b);

      async.series([

        function(cb) {
          a.on("ready", cb);
        },

        function(cb) {
          b.on("ready", cb);
        },

        function(cb) {
          b.subscribe("/hello/world", wrap(done), cb);
        },

        function(cb) {
          a.publish("/world", true);
        }
      ]);
    });

    it("should provide a callback function for being ready", function(done) {
      var result = null;
      result = ascoltatori.build(function(a) {
        toClose.push(a);
        expect(a).to.be.equal(result);
        done();
      });
    });

    it("should provide a callback function for being ready with settings", function(done) {
      var settings = redisSettings();
      settings.type = "redis";
      ascoltatori.build(settings, function(a) {
        toClose.push(a);
        done();
      });
    });

    it("should publish correctly a false with json = true", function(done) {
      var settings = redisSettings();
      settings.type = "redis";
      settings.json = true;
      ascoltatori.build(settings, function(a) {
        toClose.push(a);
        a.sub("hello/*", function(topic, value) {
          expect(value).to.be.eql(false);
          done();
        }, function() {
          a.pub("hello/123", false);
        });
      });
    });

    it("should publish correctly a false without json", function(done) {
      var settings = redisSettings();
      settings.type = "redis";
      delete settings.json;
      ascoltatori.build(settings, function(a) {
        toClose.push(a);
        a.sub("hello/*", function(topic, value) {
          expect(value).to.be.eql(false);
          done();
        }, function() {
          a.pub("hello/123", false);
        });
      });
    });
  });
});
