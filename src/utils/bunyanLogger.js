'use strict'

/* ************************************
  Bunyan Logger
**************************************/
var bunyan = require('bunyan')
var restify = require('restify')
var config = require('config')
var logStreamer = config.get('bunyan.streamServer')
var folderMaker = require('./folderMaker')
var yn = require('yn')

var logger = null

if (yn(config.get('bunyan.log'))) {
  folderMaker.makePath('./logs')

  var streams = [{
    level: 'error',
    path: './logs/api-error.log' // log ERROR and above to a file
  }, {
    level: 'trace',
    path: './logs/api.log'
  }]

  /* var streams = [{
    level: 'error',
    type: 'rotating-file',
    period: '6h', // 6h rotation
    count: 3, // keep 3 back copies
    path: './logs/api-error.log' // log ERROR and above to a file
  }, {
    level: 'trace',
    type: 'rotating-file',
    period: '3d', // 3d rotation
    count: 3, // keep 3 back copies
    path: './logs/api.log'
  }]*/

  if (yn(config.get('bunyan.stdout'))) {
    streams.push({
      level: 'debug', // Loggin depth
      stream: process.stdout // log INFO and above to stdout
    })
  }

  if (config.get('bunyan.syslog') && false) {
    // TODO: remove
    var bsyslog = require('bunyan-syslog')

    streams.push({
      level: 'debug',
      type: 'raw',
      stream: bsyslog.createBunyanStream({
        type: 'sys',
        facility: bsyslog.local0,
        host: '127.0.0.1',
        port: 514
      })
    })
  }

  if (logStreamer) {
    // TODO: make it work
    /* var io = require('socket.io-client')
    var socket = io.connect(logStreamer)
    var ss = require('socket.io-stream')

    var socketLoggerStream = ss.createStream()
    var bunyanStreamConfig = {
      level: 'debug',
      stream: socketLoggerStream
    }

    streams.push(bunyanStreamConfig)*/

    /* socket.on('reconnect', function () {

      console.log(_server.log.streams)
      var socketLoggerStream = ss.createStream()
      var bunyanStreamConfig = {
        level: 'debug',
        stream: socketLoggerStream
      }
      _server.log.streams[0] = bunyanStreamConfig
      ss(socket).emit('log-stream', socketLoggerStream, {
        server: config.get('serverID')
      })
    })*/

    /* ss(socket).emit('log-stream', socketLoggerStream, {
      server: config.get('serverID')
    })*/
  }

  logger = bunyan.createLogger({
    name: config.get('serverName'), // Logs server name
    streams: streams,
    serializers: restify.bunyan.serializers
  })
}

module.exports = logger
