var fs = require("fs");
var Redis = require("ioredis");
var steed = require("steed")();

describeAscoltatore("redis", function() {

  afterEach(function() {
    this.instance.close();
  });

  it("should publish a binary payload", function(done) {
    this.instance.close();

    var settings = redisSettings();

    this.instance = new ascoltatori.RedisAscoltatore(settings);

    var that = this;
    var expected = fs.readFileSync(__dirname + "/image.png");
    that.instance.sub("image", function(topic, value) {
      expect(value).to.be.deep.equal(expected);
      done();
    }, function() {
      that.instance.pub("image", expected);
    });
  });

  it("should sync two instances", function(done) {
    var other = new ascoltatori.RedisAscoltatore(redisSettings());
    var that = this;
    steed.series([

      function(cb) {
        other.on("ready", cb);
      },

      function(cb) {
        that.instance.subscribe("hello", wrap(done), cb);
      },

      function(cb) {
        other.publish("hello", null, cb);
      }
    ]);
  });

  it('should get the redis client for publish already created', function(done) {
    var opts = redisSettings();
    var initialConnection = new Redis(opts);
    opts.client_conn = initialConnection;
    var that = this;
    that.instance = new ascoltatori.RedisAscoltatore(opts);
    that.instance.subscribe("hello", wrap(done), function() {
      that.instance.publish("hello");
    });
  });

  it('should get the redis client for subscribing already created', function(done) {
    var opts = redisSettings();
    var initialConnection = new Redis(opts);
    opts.sub_conn = initialConnection;
    var that = this;
    that.instance = new ascoltatori.RedisAscoltatore(opts);
    that.instance.subscribe("hello", wrap(done), function() {
      that.instance.publish("hello");
    });
  });

  it("should publish with options", function(done) {
    var that = this;
    that.instance.subscribe("hello/*", function(topic, value, options) {
      expect(value).to.equal("42");
      expect(options.qos).to.equal(1);
      expect(options.messageId).to.equal(5);
      done();
    }, function() {
      that.instance.publish("hello/123", "42", { qos: 1, messageId: 5 });
    });
  });
});
