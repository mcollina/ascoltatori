
module.exports = function(Class, type, makeSettings) {

  makeSettings = makeSettings || function() { return {}; };

  ascoltatori.behaveLikeAnAscoltatore();

  beforeEach(function(done) {
    this.oldInstance = this.instance;

    var settings = makeSettings();

    if (!Array.isArray(settings)) {
      settings = [settings];
    }

    var Cons = Class.bind.apply(Class, [null].concat(settings));
    this.newInstance = ascoltatori.use(new Cons());

    this.instance = ascoltatori;
    this.instance.on("ready", done);
  });

  afterEach(function(done) {
    this.instance = this.oldInstance;
    ascoltatori.close(done);
  });

  it("should have an use method", function() {
    expect(this.instance).to.respondTo("use");
  });

  it("should return the ascoltatori object when calling use", function() {
    expect(this.newInstance).to.be.equal(ascoltatori);
  });

  if (!type) {
    return;
  }

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

    it("should build a new ascoltatore", function () {
      var settings = makeSettings();
      settings.type = type;
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(Class);
    });

    it("should build a new ascoltatore using a function as type", function() {
      var settings = makeSettings();
      settings.type = Class;
      var a = ascoltatori.build(settings);
      toClose.push(a);
      expect(a).to.be.instanceOf(Class);
    });
    
    it("should wrap it with a prefix", function(done) {
      var settings = makeSettings();
      settings.type = type;
      settings.prefix = "/hello";

      var a = ascoltatori.build(settings);
      toClose.push(a);

      var b = a._ascoltatore;
      
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

    it("should provide a callback function for being ready with settings", function(done) {
      var settings = makeSettings();
      settings.type = type;
      ascoltatori.build(settings, function(a) {
        toClose.push(a);
        done();
      });
    });

    it("should publish correctly a false with json = true", function(done) {
      var settings = makeSettings();
      settings.type = type;
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
      var settings = makeSettings();
      settings.type = type;
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
};
