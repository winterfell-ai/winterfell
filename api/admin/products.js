import admin from 'firebase-admin';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });
const runMiddleware = (req, res, fn) =>
  new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });

const db = admin.firestore();

export default async function handler(req, res) {
  // Authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await runMiddleware(req, res, upload.single('image'));

  try {
    let imageUrl = '';
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const result = await cloudinary.uploader.upload(dataURI, { folder: 'winterfell_products' });
      imageUrl = result.secure_url;
    } else if (req.body.existingImage) {
      imageUrl = req.body.existingImage;
    }

    const newProduct = {
      id: Date.now().toString(),
      name: req.body.name,
      price: parseFloat(req.body.price),
      category: req.body.category,
      brand: req.body.brand,
      description: req.body.description,
      image: imageUrl,
      colors: JSON.parse(req.body.colors || '[]'),
      specs: JSON.parse(req.body.specs || '{}'),
    };

    await db.collection('products').doc(newProduct.id).set(newProduct);
    res.status(200).json({ success: true, product: newProduct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
}
