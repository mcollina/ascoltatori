describe("ascoltatori.AMQPAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.AMQPAscoltatore, "amqp", rabbitSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.AMQPAscoltatore(rabbitSettings());
    this.instance.on("ready", done);
  });

  afterEach(function(done) {
    this.instance.close(done);
    this.instance.on("error", function () {
      console.log(arguments);
      // we should just close it,
      // avoid errors
    });
  });

  it("should sync two instances", function(done) {
    var other = new ascoltatori.AMQPAscoltatore(this.instance._opts);
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
});
