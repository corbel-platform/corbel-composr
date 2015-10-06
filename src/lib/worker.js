'use strict';

var engine = require('./engine'),
  corbelConnection = require('./corbelConnection'),
  amqp = require('amqplib'),
  uuid = require('uuid'),
  q = require('q'),
  ComposrError = require('./ComposrError'),
  config = require('./config'),
  logger = require('../utils/logger');

function doWork(ch, msg) {
  if (msg.fields.routingKey === config('rabbitmq.event')) {

    var message;
    try {
      message = JSON.parse(msg.content.toString('utf8'));
    } catch (error) {
      //ch.nack(error, false, false);
      throw new ComposrError('error:worker:message', 'Error parsing message: ' + error, 422);
    }

    if (message.type === corbelConnection.PHRASES_COLLECTION) {
      logger.debug('WORKER phrases event:', message);
      switch (message.action) {
        case 'DELETE':
          var id = message.resourceId;
          var domain = id.split('!')[0];
          engine.composr.Phrases.unregister(domain, id);

          //ch.ack(msg);
          break;

        default: // 'CREATE' or 'UPDATE'
          logger.debug('WORKER triggered create or update event', message.resourceId);

          corbelConnection.driver.then(function(driver) {
            return driver.resources.resource(corbelConnection.PHRASES_COLLECTION, message.resourceId).get();
          }).then(function(response) {
            var domain = response.data.id.split('!', [0]);
            engine.composr.Phrases.register(domain, response.data);
            //ch.ack(msg);
          })
            .catch(function(err) {
              logger.error('WORKER error: ', err);
              corbelConnection.regenerateDriver();
              throw new ComposrError('error:worker:phrase', 'Error registering phrase: ' + err, 422);
              //ch.nack(err, false, false);
            });

          break;

      }

    }
  }

}

function createChannel(conn) {
  var queue = 'composer-' + uuid.v4(),
    exchange = 'eventbus.exchange',
    pattern = '';

  return conn.createChannel()
    .then(function(ch) {
      return ch.assertQueue(queue, {
          durable: false,
          autoDelete: true
        }).then(function() {
          return ch.bindQueue(queue, exchange, pattern);
        })
        .then(function() {
          ch.consume(queue, function(message) {
              //Added callback function in case we need to do manual ack of the messages
              doWork(ch, message);
            },
            Object.create({
              noAck: true
            }));
        });
    });
}


function init() {
  var connUrl = 'amqp://' + config('rabbitmq.username') + ':' + config('rabbitmq.password') + '@' + config('rabbitmq.host') + ':' + config('rabbitmq.port');
  var conn;

  var workerID = uuid.v4();

  logger.info('Creating worker with ID', workerID);

  amqp.connect(connUrl)
    .then(function(connection) {
      conn = connection;
      //Close conection on SIGINT
      process.once('SIGINT', function() {
        connection.close();
        process.exit();
      });

      createChannel(connection)
        .then(function(channel) {
          logger.info('Worker up, with ID', workerID);
        })
        .catch(function(error) {
          logger.error('WORKER error ', error, 'with ID', workerID);
          if (conn) {
            conn.close(function() {
              process.exit(1);
            });
          }
        });
    })
    .then(null, function(err) {
      logger.error('Worker error %s with ID : %s', err, workerID);
      setTimeout(init, config('rabbitmq.reconntimeout'));
    });
}

module.exports = {
  init: init
};