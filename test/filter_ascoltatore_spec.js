
describeAscoltatore("filter", function(){
  it("should publish messages to the filtered delegate (hello)", function(done) {
    var that = this;
    this.instance.wrapped[0].ascoltatore.subscribe("/hello", wrap(done), function() {
      that.instance.publish("/hello", "world");
    });
  });
  it("should publish messages to the filtered delegate (hebida)", function(done) {
    var that = this;
    this.instance.wrapped[1].ascoltatore.subscribe("/hebida", wrap(done), function() {
      that.instance.publish("/hebida", "hoobida");
    });
  });
  it("should publish messages to a default delegate", function(done) {
    var that = this;
    this.instance.wrapped[2].ascoltatore.subscribe("/cheese", wrap(done), function() {
      that.instance.publish("/cheese", "yum");
    });
  });

});
