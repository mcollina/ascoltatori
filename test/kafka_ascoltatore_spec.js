var fs = require("fs");
var util = require("../lib/util");
var steed = require('steed')();

describeAscoltatore("kafka", function() {

  afterEach(function(done) {
    this.instance.close();
    done();
  });

  it("should sync two instances", function(done) {
    var other = new ascoltatori.KafkaAscoltatore(kafkaSettings());
    var that = this;
    steed.series([

      function(cb) {
        other.on("ready", cb);
      },

      function(cb) {
        that.instance.subscribe("hello", util.wrap(done), cb);
      },

      function(cb) {
        other.publish("hello", null, cb);
      }
    ]);
  });

  it("should publish a binary payload", function(done) {
    var that = this;
    that.instance.sub("image",function(topic, value) {
      expect(value).to.eql(new Buffer("42"));
      util.wrap(done)();
    }, function() {
      that.instance.pub("image", new Buffer("42"));
    });
  });

  it("should publish a utf8 payload", function(done) {
    var that = this;
    that.instance.sub("hello",function(topic, value) {
      expect(value).to.eql("€99");
      util.wrap(done)();
    }, function() {
      that.instance.pub("hello", "€99");
    });
  });

});
