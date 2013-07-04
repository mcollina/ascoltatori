
describe("ascoltatori", function() {
  var makeFakeAscoltatore = function() {
    var r = {};
    r.publish = r.subscribe = r.unsubscribe = r.close = r.on =
    r.removeListener = r.registerDomain = function () {};
    return r;
  };

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it("should delegate to the use ascoltatore for 'pub'", function() {
    var ascoltatore = makeFakeAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "publish");
    ascoltatori.use(ascoltatore);
    ascoltatori.publish("hello");
    expect(spy).to.have.been.calledWith("hello");
  });

  it("should delegate to _global for 'subscribe'", function() {
    var ascoltatore = makeFakeAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "subscribe");
    var func = function(argument) {};
    ascoltatori.use(ascoltatore);
    ascoltatori.subscribe("hello", func);
    expect(spy).to.have.been.calledWith("hello", func);
  });

  it("should delegate to _global for 'removeListener'", function() {
    var ascoltatore = makeFakeAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "removeListener");
    var func = function(argument) {};
    ascoltatori.use(ascoltatore);
    ascoltatori.sub("hello", func);
    ascoltatori.removeListener("hello", func);
    expect(spy).to.have.been.calledWith("hello", func);
  });

  it("should delegate to _global for 'close'", function() {
    var ascoltatore = makeFakeAscoltatore();
    var spy = this.sandbox.spy(ascoltatore, "close");
    ascoltatori.use(ascoltatore);
    ascoltatori.close();
    expect(spy).to.have.been.called;
  });

  it("should provide a callback function for being ready", function(done) {
    var result = null;
    result = ascoltatori.build(function(a) {
      expect(a).to.be.equal(result);
      a.close(done);
    });
  });


    /*it("should create a new AbstractAscoltatore using function", function() {
      function DummyAscoltatore(options, ascoltatori) {
        ascoltatori.AbstractAscoltatore.call(this);

        this.close = function (done) {
          done();
        };

        this.emit("ready");
      }

      DummyAscoltatore.prototype = Object.create(ascoltatori.AbstractAscoltatore.prototype);

      var a = ascoltatori.build({
        json: false,
        type: DummyAscoltatore
      });
      toClose.push(a);
      expect(a).to.be.instanceOf(ascoltatori.AbstractAscoltatore);
    });*/


});
