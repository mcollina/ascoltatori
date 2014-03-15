describe("ascoltatori.FileSystemAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.FileSystemAscoltatore, "filesystem", fileSystemSettings);

  beforeEach(function(done) {
    this.instance = new ascoltatori.FileSystemAscoltatore();
    this.instance.on("ready", done);
  });

  afterEach(function(done) {
    this.instance.close(done);
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
