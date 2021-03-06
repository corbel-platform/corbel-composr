'use strict'
/* globals describe it */

var chai = require('chai')
var sinon = require('sinon')
var expect = chai.expect
var corbel = require('corbel-js')
var userToken
var tokenHook = require('../../../../src/lib/phraseHooks/tokenObjectHook')

describe('TokenObject hook', function () {
  var requestWith = function (authHeader) {
    var header = sinon.stub()
    header.withArgs('Authorization').returns(authHeader)
    return {header: header}
  }

  var userId = '999-fff-!'

  before(function () {
    var optUser = {
      iss: 1,
      aud: 'a',
      userId: userId,
      clientId: '54313'
    }

    userToken = corbel.jwt.generate(optUser, 'asd')
  })

  describe('for user', function () {
    it('Successful request', function () {
      var req = requestWith('Bearer ' + userToken)
      var res = {}
      var next = sinon.spy()

      tokenHook()(req, res, next)
      expect(next.calledWith()).to.be.true
      expect(req.tokenObject).to.exist
      expect(req.tokenObject.getUserId()).to.equals(userId)
    })

    it('400 for malformed auth token', function () {
      var reqs = [
        requestWith('Bearer'),
        requestWith('Bearer aaaaaa')
      ]

      reqs.forEach(function (req) {
        var res = {}
        var next = sinon.spy()

        tokenHook()(req, res, next)
        expect(next.calledOnce).to.be.true
        var error = next.args[0][0]
        expect(error).to.exist
        expect(error.error).to.equal('error:malformed:token')
      })
    })
  })
})
