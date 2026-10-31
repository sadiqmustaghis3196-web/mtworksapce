import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { supabase } from "../config/supabase.js";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed.'));
    }
  }
});

router.use(attachSupabaseUser);

const extractLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.socket.remoteAddress || 'unknown',
  message: { success: false, error: "Too many extraction requests, please try again later." }
});

// ═══════════════════════════════════════════════════════════════
// POST /fuel/extract — Extract Data from Receipt Image
// ═══════════════════════════════════════════════════════════════
router.post(
  "/fuel/extract",
  requireRole("admin", "super_admin", "fleet_manager", "driver"),
  extractLimiter,
  (req, res, next) => {
    upload.single('receipt')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "Missing receipt image." });
      }

      const { extractFuelReceiptData } = await import("../services/ai/geminiService.js");
      const extraction = await extractFuelReceiptData(file.buffer, file.mimetype, req.user.organization_id);

      if (!extraction) {
        return res.status(503).json({ success: false, error: "Extraction unavailable." });
      }

      return res.json({ 
        success: true, 
        extraction: extraction 
      });
    } catch (error) {
      console.error("Fuel Receipt Extraction Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /maintenance/extract — Extract Data from Maintenance Receipt Image
// ═══════════════════════════════════════════════════════════════
router.post(
  "/maintenance/extract",
  requireRole("admin", "super_admin", "fleet_manager", "driver"),
  extractLimiter,
  (req, res, next) => {
    upload.single('receipt')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "Missing receipt image." });
      }

      const { extractMaintenanceReceiptData } = await import("../services/ai/geminiService.js");
      const extraction = await extractMaintenanceReceiptData(file.buffer, file.mimetype, req.user.organization_id);

      if (!extraction) {
        return res.status(503).json({ success: false, error: "Extraction unavailable." });
      }

      return res.json({ 
        success: true, 
        extraction: extraction 
      });
    } catch (error) {
      console.error("Maintenance Receipt Extraction Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /fuel/records — Create Fuel Record
// ═══════════════════════════════════════════════════════════════
router.post("/fuel/records", requireRole("admin", "super_admin", "fleet_manager", "driver"), async (req, res) => {
  try {
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const record = req.body;
    record.organization_id = req.user.organization_id; // Securely enforce org scope

    const { data, error } = await supabase
      .from('fuel_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    
    return res.json({ success: true, record: data });
  } catch (error) {
    console.error("Create Fuel Record Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /fuel/records/:id/receipt — Upload Fuel Receipt
// ═══════════════════════════════════════════════════════════════
router.post(
  "/fuel/records/:id/receipt",
  requireRole("admin", "super_admin", "fleet_manager", "driver"),
  upload.single('receipt'),
  async (req, res) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(401).json({ success: false, error: "Unauthorized or missing organization" });
      }
      
      const recordId = req.params.id;
      const orgId = req.user.organization_id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: "Missing receipt image." });
      }

      // Verify the record belongs to the organization
      const { data: record, error: verifyError } = await supabase
        .from('fuel_records')
        .select('id, notes')
        .eq('id', recordId)
        .eq('organization_id', orgId)
        .single();
        
      if (verifyError || !record) {
        return res.status(404).json({ success: false, error: "Fuel record not found or access denied." });
      }

      const timestamp = Date.now();
      const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'jpg'; // Basic ext handling
      const filePath = `${orgId}/fuel/${recordId}_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('fleet-receipts')
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw uploadError;

      // Extract data using Gemini
      const { extractFuelReceiptData } = await import("../services/ai/geminiService.js");
      const extraction = await extractFuelReceiptData(file.buffer, file.mimetype, orgId);

      // Store extraction in notes for audit trail since we can't easily run schema migrations
      let updatedNotes = record.notes || "";
      if (extraction) {
        const aiSummary = `\n\n--- AI Extraction Suggestion ---\n${JSON.stringify(extraction, null, 2)}`;
        updatedNotes += aiSummary;
      }

      // Update the fuel record with the path and AI notes
      const { error: updateError } = await supabase
        .from('fuel_records')
        .update({ receipt_url: filePath, notes: updatedNotes.trim() })
        .eq('id', recordId);

      if (updateError) throw updateError;

      return res.json({ 
        success: true, 
        message: "Fuel receipt uploaded successfully.", 
        path: filePath,
        extraction: extraction 
      });
    } catch (error) {
      console.error("Fuel Receipt Upload Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /fuel/records/:id/receipt — Get Signed URL for Fuel Receipt
// ═══════════════════════════════════════════════════════════════
router.get("/fuel/records/:id/receipt", async (req, res) => {
  try {
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const recordId = req.params.id;
    const orgId = req.user.organization_id;

    const { data: record, error: fetchError } = await supabase
      .from('fuel_records')
      .select('receipt_url')
      .eq('id', recordId)
      .eq('organization_id', orgId)
      .single();
      
    if (fetchError || !record || !record.receipt_url) {
      return res.status(404).json({ success: false, error: "Receipt not found." });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('fleet-receipts')
      .createSignedUrl(record.receipt_url, 3600); // 1 hour expiry

    if (urlError) throw urlError;

    return res.json({ success: true, signedUrl: urlData.signedUrl });
  } catch (error) {
    console.error("Fuel Receipt URL Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /maintenance/records/:id/receipt — Upload Maintenance Receipt
// ═══════════════════════════════════════════════════════════════
router.post(
  "/maintenance/records/:id/receipt",
  requireRole("admin", "super_admin", "fleet_manager", "driver"),
  upload.single('receipt'),
  async (req, res) => {
    try {
      if (!req.user || !req.user.organization_id) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      
      const recordId = req.params.id;
      const orgId = req.user.organization_id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: "Missing receipt document." });
      }

      // Verify the record belongs to the organization
      const { data: record, error: verifyError } = await supabase
        .from('maintenance_records')
        .select('id')
        .eq('id', recordId)
        .eq('organization_id', orgId)
        .single();
        
      if (verifyError || !record) {
        return res.status(404).json({ success: false, error: "Maintenance record not found or access denied." });
      }

      const timestamp = Date.now();
      const ext = file.mimetype === 'application/pdf' ? 'pdf' : 'jpg';
      const filePath = `${orgId}/maintenance/${recordId}_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('fleet-receipts')
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('maintenance_records')
        .update({ receipt_url: filePath })
        .eq('id', recordId);

      if (updateError) throw updateError;

      return res.json({ success: true, message: "Maintenance receipt uploaded successfully.", path: filePath });
    } catch (error) {
      console.error("Maintenance Receipt Upload Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// GET /maintenance/records/:id/receipt — Get Signed URL for Maintenance Receipt
// ═══════════════════════════════════════════════════════════════
router.get("/maintenance/records/:id/receipt", async (req, res) => {
  try {
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const recordId = req.params.id;
    const orgId = req.user.organization_id;

    const { data: record, error: fetchError } = await supabase
      .from('maintenance_records')
      .select('receipt_url')
      .eq('id', recordId)
      .eq('organization_id', orgId)
      .single();
      
    if (fetchError || !record || !record.receipt_url) {
      return res.status(404).json({ success: false, error: "Receipt not found." });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('fleet-receipts')
      .createSignedUrl(record.receipt_url, 3600); // 1 hour expiry

    if (urlError) throw urlError;

    return res.json({ success: true, signedUrl: urlData.signedUrl });
  } catch (error) {
    console.error("Maintenance Receipt URL Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
