const amqp = require('amqplib');

let channel;

async function setupRabbitMQ() {
  const connection = await amqp.connect('amqp://localhost');
  channel = await connection.createChannel();
  await channel.assertQueue('photoThumbnailQueue', { durable: true });
  console.log("RabbitMQ connected");
}

function enqueueThumbnailJob(photoId) {
  if (!channel) {
    throw new Error('RabbitMQ channel is not set up');
  }
  channel.sendToQueue('photoThumbnailQueue', Buffer.from(photoId.toString()), { persistent: true });
}

module.exports = {
  setupRabbitMQ,
  enqueueThumbnailJob
};
