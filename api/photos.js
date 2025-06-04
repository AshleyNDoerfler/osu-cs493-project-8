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
} = require('../models/photo')

const router = Router()

function saveImageFile(image) {
  const db = getDBReference();
  const bucket =
    new GridFSBucket(db, { bucketName: 'images' });

  const metadata = {
    contentType: image.contentType,
    userId: image.userId,
    businessId: image.businessId
  };

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(
      image.filename,
      { metadata: metadata }
    );
    fs.createReadStream(image.path)
      .pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
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

async function getImageInfoById(id){
  try {
    const db = getDBReference();
    const bucket =
      new GridFSBucket(db, { bucketName: 'images' });
    const results =
      await bucket.find({ _id: new ObjectId(id) }).toArray();
    image = results[0];
    if (image) {
      const responseBody = {
        _id: image._id,
        url: `/media/images/${image._id.toString()}.${extension}`,
        contentType: image.metadata.contentType,
        businessId: image.metadata.businessId,
        userId: image.metadata.userId,
      };
      
      return responseBody;
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
      const image = {
        path: req.file.path,
        filename: req.file.filename,
        contentType: req.file.mimetype,
        userId: req.body.userId,
        businessId: req.body.businessId
      };      

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
    const photo = await getImageInfoById(req.params.id)
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

router.get('/media/images/:filename', (req, res, next) => {
  getImageDownloadStreamByFilename(req.params.filename)
    .on('file', (file) => {
      res.status(200).type(file.metadata.contentType);
    })
    .on('error', (err) => {
      if (err.code === 'ENOENT') {
        next();
      } else {
        next(err);
      }
    })
    .pipe(res);
});


router.use('*', (err, req, res, next) => {
  console.error(err);
  res.status(500).send({
    err: "An error occurred. Try again later."
  });
});

module.exports = router
