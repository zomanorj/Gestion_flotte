// Routes documents administratifs
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const ctrl    = require('../controllers/documentsController');
const { verifierToken, verifierRole } = require('../middleware/authMiddleware');

// Configuration Multer : stockage dans uploads/documents/
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/documents'),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `doc_${req.params.id}_${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (_req, file, cb) => {
    const autorisés = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    if (autorisés.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé (PDF, images, Word uniquement)'));
    }
  }
});

// Alertes et liste (lecture libre)
router.get('/alertes', ctrl.getAlertes);
router.get('/',        ctrl.getAll);

// Création et modification — admin ou gestionnaire
router.post('/',    verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.create);
router.put('/:id',  verifierToken, verifierRole('admin', 'gestionnaire'), ctrl.update);

// Upload de fichier
router.post('/:id/fichier',
  verifierToken, verifierRole('admin', 'gestionnaire'),
  upload.single('fichier'),
  ctrl.uploadFichier
);

// Suppression — admin uniquement
router.delete('/:id', verifierToken, verifierRole('admin'), ctrl.remove);

module.exports = router;
