
var MongoClient = require('mongodb').MongoClient;
var steed = require('steed')();

describeAscoltatore("mongo", function() {
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

  it("should support the old connect uri + db", function(done) {
    this.instance.close(function() {
      this.instance = new ascoltatori.MongoAscoltatore({ uri: 'mongodb://127.0.0.1/', db: 'ascoltatoriTests2' });
      this.instance.on('ready', function() {
        expect(this.instance.db.databaseName).to.eql('ascoltatoriTests2');
        done();
      }.bind(this));
    }.bind(this));
  });

  it("should reuse another mongo connection", function(done) {
    this.instance.close(function() {
      MongoClient.connect('mongodb://127.0.0.1/ascoltatoriTest3', {}, function(err, db) {
        this.instance = new ascoltatori.MongoAscoltatore({ db: db });
        this.instance.on('ready', done);
      }.bind(this));
    }.bind(this));
  });

  it.skip("should publish 2000 messages without skipping one", function(done) {
    var that = this;
    var count = 0;
    var max = 2000;

    function doPub(n, next) {
      that.instance.pub("hello/123", "abcde " + n, {}, next);
    }

    that.instance.sub("hello/*", function(topic, value) {
      count++;
      if (count === max) {
        done();
      }
    }, function() {
      steed.times(max, doPub);
    });
  });

  it("should publish a big payload", function(done) {
    var that = this;
    var payload = new Buffer(5 * 1024);
    that.instance.sub("hello/*", function(topic, value) {
      expect(value).to.eql(payload);
      done();
    }, function(err) {
      that.instance.pub("hello/123", payload);
    });
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

  // flaky test on CI
  it.skip("should not suffer from mongo interruptions", function (done) {
    this.instance.close(function () {
      MongoClient.connect('mongodb://127.0.0.1/ascoltatoriTest4', {}, function (err, db) {
        db.on('error', done);
        this.instance = new ascoltatori.MongoAscoltatore({ db: db });
        this.instance.on('error', done);
        this.instance.on('ready', function () {
          _test(this);
        }.bind(this));
      }.bind(this));
    }.bind(this));

    function _test(that) {
      that.instance.subscribe("hello/*", function (topic, value, options) {
        if (value === "42") {
          done();
        }
      }, function () {
        that.instance.publish("hello/123", "21");
        that.instance.db.logout({}, function (err, res) {
          if (err) {
            throw(err);
          }
          that.instance.publish("hello/456", "42");
        });
      });
    }
  });

  it("should not duplicate messages", function(done) {
    this.timeout(5000);

    var that = this;
    var called = 0;
    that.instance.sub("hello", function(topic, value) {
      called++;
      expect(called).to.be.lessThan(3);
      expect(value).to.eql(new Buffer("42"));
    }, function() {
      that.instance.pub("hello", new Buffer("42"));
      that.instance.pub("hello", new Buffer("42"));
      setTimeout(done, 3000);
    });
  });

  it("should not duplicate messages when sending messages sequentially", function(done) {
    this.timeout(5000);

    var that = this;
    var called = 0;
    that.instance.sub("hello", function(topic, value) {
      called++;
      expect(called).to.be.lessThan(7);
      expect(value).to.eql(new Buffer("42"));
    }, function() {
      setTimeout(function(){
        that.instance.pub("hello", new Buffer("42"));
        that.instance.pub("hello", new Buffer("42"));
        setTimeout(function(){
          that.instance.pub("hello", new Buffer("42"));
          that.instance.pub("hello", new Buffer("42"));
          setTimeout(function(){
            that.instance.pub("hello", new Buffer("42"));
            that.instance.pub("hello", new Buffer("42"));
          },100);
        },100);
      },100);
      setTimeout(done, 3000);
    });
  });
});
