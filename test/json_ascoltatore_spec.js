describe("ascoltatori.JSONAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.JSONAscoltatore,
                          null,
                          function () {
                            return new ascoltatori.TrieAscoltatore();
                          });

  beforeEach(function(done) {
    this.included = new ascoltatori.TrieAscoltatore();
    this.instance = new ascoltatori.JSONAscoltatore(this.included);
    this.instance.on("ready", done);
  });

  it("should transfer nulls as false", function(done) {
    var that = this;
    this.instance.subscribe("/hello", function(topic, payload) {
      expect(payload).to.be.eql(false);
      done();
    }, function() {
      that.instance.publish("/hello", null);
    });
  });

  it("should transfer undefined as false", function(done) {
    var that = this;
    this.instance.subscribe("/hello", function(topic, payload) {
      expect(payload).to.be.eql(false);
      done();
    }, function() {
      that.instance.publish("/hello", undefined);
    });
  });

  it("should transfer numbers", function(done) {
    var that = this;
    this.instance.subscribe("/hello", function(topic, payload) {
      expect(payload).to.be.eql(42);
      done();
    }, function() {
      that.instance.publish("/hello", 42);
    });
  });

  it("should publish messages on the parent encoding them as JSON", function(done) {
    var that = this;
    this.included.subscribe("/hello", function(topic, payload) {
      expect(payload).to.be.equal('{"key":"world"}');
      done();
    }, function() {
      that.instance.publish("/hello", {
        key: "world"
      });
    });
  });

  it("should publish correctly a false", function(done) {
    var that = this;
    that.instance.sub("hello/*", function(topic, value) {
      expect(value).to.be.eql(false);
      done();
    }, function() {
      that.instance.pub("hello/123", false);
    });
  });
});
