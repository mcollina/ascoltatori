describe("ascoltatori.RedisAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.RedisAscoltatore, "redis", redisSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.RedisAscoltatore(redisSettings());
    this.instance.on("ready", done);
  });

  afterEach(function() {
    this.instance.close();
  });

  it("should sync two instances", function(done) {
    var other = new ascoltatori.RedisAscoltatore(redisSettings());
    var that = this;
    async.series([

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
    var initialConnection = opts.redis.createClient(opts.port, opts.host, opts);
    opts.client_conn = initialConnection;
    var that = this;
    that.instance = new ascoltatori.RedisAscoltatore(opts);
    that.instance.subscribe("hello", wrap(done), function() {
      that.instance.publish("hello");
    });
  });

  it('should get the redis client for subscribing already created', function(done) {
    var opts = redisSettings();
    var initialConnection = opts.redis.createClient(opts.port, opts.host, opts);
    opts.sub_conn = initialConnection;
    var that = this;
    that.instance = new ascoltatori.RedisAscoltatore(opts);
    that.instance.subscribe("hello", wrap(done), function() {
      that.instance.publish("hello");
    });
  });
});
