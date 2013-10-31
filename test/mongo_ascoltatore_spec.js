describe("ascoltatori.MongoAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.MongoAscoltatore, "mongo", mongoSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.MongoAscoltatore(mongoSettings());
    this.instance.on("ready", done);
  });

  afterEach(function(done) {
    this.instance.close(done);
  });

  it("should publish a binary payload", function(done) {
    var that = this;
    that.instance.sub("hello/*", function(topic, value) {
      expect(value).to.eql(new Buffer("42"));
      done();
    }, function() {
      that.instance.pub("hello/123", new Buffer("42"));
    });
  });
});
