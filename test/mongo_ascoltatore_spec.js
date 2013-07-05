describe("ascoltatori.MongoAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.MongoAscoltatore, "mongo", mongoSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.MongoAscoltatore(mongoSettings());
    this.instance.on("ready", done);
  });

  afterEach(function(done) {
    this.instance.close(done);
  });
});
