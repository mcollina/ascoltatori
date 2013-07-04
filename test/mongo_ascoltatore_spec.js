describe("ascoltatori.MongoAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.MongoAscoltatore, "mongo", mongoSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.MongoAscoltatore(mongoSettings());
    this.instance.on("ready", done);
  });

  afterEach(function() {
    this.instance.close();
  });

  it("should do nothing", function(done) {
    done();
  });
});
