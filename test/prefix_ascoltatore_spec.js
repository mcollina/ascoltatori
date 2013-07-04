describe("ascoltatori.PrefixAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.PrefixAscoltatore,
                          null,
                          function () {
                            return ["/myprefix", new ascoltatori.TrieAscoltatore()];
                          });

  beforeEach(function(done) {
    this.included = new ascoltatori.TrieAscoltatore();
    this.instance = new ascoltatori.PrefixAscoltatore("/myprefix", this.included);
    this.instance.on("ready", done);
  });

  it("should publish messages on the parent with a prefix", function(done) {
    var that = this;
    this.included.subscribe("/myprefix/hello", wrap(done), function() {
      that.instance.publish("/hello", "world");
    });
  });
});
