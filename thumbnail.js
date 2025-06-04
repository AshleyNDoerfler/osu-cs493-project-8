const { ObjectId, GridFSBucket } = require('mongodb');
const { connectToDb, getDBReference } = require('./lib/mongo');
const amqp = require('amqplib');
const sharp = require('sharp');
const { Readable } = require('stream');

async function runWorker() {
  await connectToDb();
  const db = getDBReference();

  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();
  await channel.assertQueue('photos', { durable: true });

  channel.consume('photos', async (msg) => {
    const { photoId } = JSON.parse(msg.content.toString());

    const imageBucket = new GridFSBucket(db, { bucketName: 'images' });
    const thumbBucket = new GridFSBucket(db, { bucketName: 'thumbs' });

    const downloadStream = imageBucket.openDownloadStream(new ObjectId(photoId));
    const chunks = [];

    downloadStream.on('data', chunk => chunks.push(chunk));
    downloadStream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const thumbnailBuffer = await sharp(buffer).resize(100, 100).jpeg().toBuffer();

        const uploadStream = thumbBucket.openUploadStream(`${photoId}.jpg`, {
          metadata: { originalId: photoId }
        });

        Readable.from(thumbnailBuffer).pipe(uploadStream).on('finish', async (thumbFile) => {
          await db.collection('images.files').updateOne(
            { _id: new ObjectId(photoId) },
            { $set: { 'metadata.thumbId': thumbFile._id } }
          );
          channel.ack(msg);
        });
      } catch (error) {
        console.error("Thumbnail generation failed:", error);
        channel.nack(msg, false, false); // Don't retry failed messages
      }
    });

    downloadStream.on('error', (err) => {
      console.error("Error downloading image:", err);
      channel.nack(msg, false, false);
    });

  }, { noAck: false });
}

runWorker().catch(console.error);