describe("ascoltatori.ZeromqAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.ZeromqAscoltatore, "zmq", zeromqSettings);

  var toClose = null;

  beforeEach(function(done) {
    this.instance = new ascoltatori.ZeromqAscoltatore(zeromqSettings());
    this.instance.on("ready", done);
    toClose = [this.instance];
  });

  afterEach(function(done) {
    async.parallel(toClose.map(function(i) {
      return function(cb) {
        i.close(cb);
      };
    }), done);
  });

  it("should sync two instances", function(done) {
    var instance = this.instance;
    var other = new ascoltatori.ZeromqAscoltatore(zeromqSettings());
    async.series([

      function(cb) {
        other.on("ready", cb);
      },

      function(cb) {
        toClose.push(other);
        // we connect to the other instance control channel
        other.connect(instance._opts.controlPort, cb);
      },

      function(cb) {
        instance.subscribe("world", wrap(done), cb);
      },

      function(cb) {
        other.publish("world", null, cb);
      }
    ]);
  });

  it("should sync three instances", function(done) {
    var instance = this.instance;
    var other = new ascoltatori.ZeromqAscoltatore(zeromqSettings());
    var other2 = new ascoltatori.ZeromqAscoltatore(zeromqSettings());

    var count = 2;
    var donner = function() {
      if (--count === 0)  {
        done();
      }
    };

    async.series([

      function(cb) {
        other.on("ready", cb);
      },

      function(cb) {
        toClose.push(other);
        other2.on("ready", cb);
      },

      function(cb) {
        toClose.push(other2);
        other.connect(instance._opts.controlPort);
        other2.connect(instance._opts.controlPort);
        setTimeout(cb, 500);
      },

      function(cb) {
        other2.subscribe("world", donner, cb);
      },

      function(cb) {
        other.subscribe("world", donner, cb);
      },

      function(cb) {
        instance.publish("world", null, cb);
      }
    ]);
  });
});
