describe("ascoltatori.DecoratorAscoltatore", function() {

  behaveLikeAnAscoltatore(ascoltatori.DecoratorAscoltatore,
                          null,
                          function () {
                            return new ascoltatori.TrieAscoltatore();
                          });

  beforeEach(function(done) {
    this.wrapped = new ascoltatori.TrieAscoltatore();
    this.instance = new ascoltatori.DecoratorAscoltatore(this.wrapped);
    this.instance.on("ready", done);
  });
});
