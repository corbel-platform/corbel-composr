'use strict';

var engine = null,
  options = null,
  config = require('../../../src/lib/config'),
  path = require('path'),
  composr = require('composr-core'),
  https = require('https'),
  nock = require('nock'),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  expect = chai.expect,
  assert = chai.assert,
  fs = require('fs'),
  sinon = require('sinon');
chai.use(chaiAsPromised);

describe('Engine', function() {
  this.timeout(10 * 1000);

  var baseUrl = config('corbel.driver.options').urlBase;
  var retries = config('services.retries');
  var time = config('services.time');
  var domain = baseUrl.substring(0, baseUrl.indexOf("{") - 1);
  var engineAbsPath = null;
  var mySandbox = sinon.sandbox.create();

  describe('Services checking', function() {

    before(function() {
      options = {
        allowUnmocked: true
      };
      engineAbsPath = path.resolve(__dirname + '../../../../src/lib/engine.js');
    });

    beforeEach(function() {
      engine = require(engineAbsPath);
    });

    afterEach(function() {
      mySandbox.restore();
      nock.cleanAll();
      // Required to allow to create a new instance of 'engine'
      // Every time a 'require' is made, is saved into a local 'require' cache, so to create a new instance every time, 
      // we need to replace cache
      delete require.cache[engineAbsPath];
    });

    describe('Engine', function() {

      it('initialize engine on first time', function(done) {

        var stubOnComposrInit = mySandbox.stub(engine, 'initFirstTimeCore');
        var stubOnLaunchTries = mySandbox.stub(engine, 'launchTries');

        stubOnComposrInit.returns(Promise.resolve());
        stubOnLaunchTries.returns(Promise.resolve());

        engine.launchTries(retries)
          .should.be.fulfilled
          .then(function() {
            engine.initFirstTimeCore(null, null, true);
          })
          .then(function() {
            expect(stubOnComposrInit.calledOnce).to.be.true;
            expect(stubOnComposrInit.lastCall.args[2] === true).to.be.true;
          })
          .should.notify(done);
      });

      it('not initialize engine when core is not available', function(done) {

        var stubOnComposrInit = mySandbox.stub(engine, 'initFirstTimeCore');
        var stubOnLaunchTries = mySandbox.stub(engine, 'launchTries');

        stubOnComposrInit.returns(Promise.reject());
        stubOnLaunchTries.returns(Promise.reject());

        engine.launchTries(retries)
          .should.be.rejected
          .then(function() {
            engine.initFirstTimeCore(null, null, false)
              .should.be.rejected
          })
          .then(function() {
            expect(stubOnComposrInit.calledOnce).to.be.true;
            expect(stubOnComposrInit.lastCall.args[2] === false).to.be.true;
          })
          .should.notify(done);

      });

      it('initializes engine without data when one endpoint does not work on first time and retries ' + retries + ' times and finally login', function(done) {

        var stubOnComposrInit = mySandbox.stub(engine, 'initFirstTimeCore');
        var stubOnComposrInitCore = mySandbox.stub(engine, 'initCore');
        var stubOnServicesUp = mySandbox.stub(engine, 'waitTilServicesUp');

        stubOnServicesUp.onCall(0).returns(Promise.reject());
        stubOnServicesUp.onCall(1).returns(Promise.reject());
        stubOnServicesUp.onCall(2).returns(Promise.reject());
        stubOnServicesUp.onCall(3).returns(Promise.resolve());
        stubOnComposrInitCore.returns(Promise.resolve());
        stubOnComposrInit.returns(Promise.resolve());

        for (var i = 0; i < 3; i++) {
          engine.waitTilServicesUp()
            .should.be.rejected;
        }

        engine.initFirstTimeCore(null, null, false)
          .should.be.fulfilled

        engine.waitTilServicesUp()
          .should.be.fulfilled
          .then(function() {
            engine.initCore(true)
              .should.be.fulfilled
          })
          .then(function() {
            expect(stubOnServicesUp.callCount === 4).to.be.true;
            expect(stubOnComposrInit.calledOnce).to.be.true;
            expect(stubOnComposrInitCore.calledOnce).to.be.true;
            expect(stubOnComposrInit.firstCall.args[2] === false).to.be.true;
            expect(stubOnComposrInitCore.firstCall.args[0] === true).to.be.true;
          })
          .should.notify(done);

      });
    });

    describe('Engine requests', function() {

      it('Rejects by timeout', function(done) {

        nock(domain, options)
          .get('/iam/v1.0/version')
          .delayConnection(100)
          .reply(200)
          .get('/resources/v1.0/version')
          .delayConnection(100)
          .reply(200);

        return Promise.all(
            engine.initServiceCheckingRequests(['test'], 100)
          )
          .should.be.rejected
          .should.notify(done);
      });
    });
  });
});