/*
 * API sub-router for businesses collection endpoints.
 */

const { Router } = require('express')
const multer = require('multer');
const crypto = require('crypto');
const { ObjectId, GridFSBucket } = require('mongodb');
const fs = require('fs');
const { getDBReference } = require('../lib/mongo');

const imageTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

const metadata = {
  contentType: image.contentType,
  userId: image.userId
};

const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/uploads`,
    filename: (req, file, callback) => {
      const filename = crypto.pseudoRandomBytes(16).toString('hex');
      const extension = imageTypes[file.mimetype];
      callback(null, `${filename}.${extension}`);
    }
  })
});

const { validateAgainstSchema } = require('../lib/validation')
const {
  PhotoSchema,
  insertNewPhoto,
  getPhotoById
} = require('../models/photo')

const router = Router()

function saveImageFile(image) {
  return new Promise((resolve, reject) => {
    const db = getDBReference();
    const bucket =
      new GridFSBucket(db, { bucketName: 'images' });

    const uploadStream = bucket.openUploadStream(
      image.filename,
      { metadata: metadata }
    );

    return new Promise((resolve, reject) => {
      fs.createReadStream(image.path)
        .pipe(uploadStream)
        .on('error', (err) => {
          reject(err);
        })
        .on('finish', (result) => {
          resolve(result._id);
        });
    });
  });
}

function removeUploadedFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function getImageInfoById(){
  try {
    const bucket =
      new GridFSBucket(db, { bucketName: 'images' });
    const results =
      await bucket.find({ _id: new ObjectId(id) }).toArray();
    if (image) {
      const responseBody = {
        _id: image._id,
        url: `/media/images/${image.filename}`,
        contentType: image.metadata.contentType,
        userId: image.metadata.userId,
      };
      
      res.status(200).send(responseBody);
    } else {
      next();
    }
    } catch (err) {
      next(err);
    }
}

function getImageDownloadStreamByFilename(filename) {
  const db = getDBReference();
  const bucket =
    new GridFSBucket(db, { bucketName: 'images' });
  return bucket.openDownloadStreamByName(filename);
}

/*
 * POST /photos - Route to create a new photo.
 */
router.post('/', upload.single('image'), async (req, res) => {
  if (validateAgainstSchema(req.body, PhotoSchema)) {
    try {
      const id = await saveImageFile(image);
      await removeUploadedFile(req.file);

      res.status(201).send({
        id: id,
        links: {
          photo: `/photos/${id}`,
          business: `/businesses/${req.body.businessId}`
        }
      })
    } catch (err) {
      console.error(err)
      res.status(500).send({
        error: "Error inserting photo into DB.  Please try again later."
      })
    }
  } else {
    res.status(400).send({
      error: "Request body is not a valid photo object"
    })
  }
})

/*
 * GET /photos/{id} - Route to fetch info about a specific photo.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const photo = await getPhotoById(req.params.id)
    if (photo) {
      res.status(200).send(photo)
    } else {
      next()
    }
  } catch (err) {
    console.error(err)
    res.status(500).send({
      error: "Unable to fetch photo.  Please try again later."
    })
  }
})

router.use('*', (err, req, res, next) => {
  console.error(err);
  res.status(500).send({
    err: "An error occurred. Try again later."
  });
});

module.exports = router
