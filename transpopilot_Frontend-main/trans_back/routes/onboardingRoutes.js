import express from "express";
import multer from "multer";
import { supabase } from "../config/supabase.js";
import { attachSupabaseUser, requireRole } from "../services/rbac.js";
import { extractCdlData } from "../services/ocrService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(attachSupabaseUser);

// ═══════════════════════════════════════════════════════════════
// POST /driver/onboarding/cdl/ocr — Extract text via OCR
// ═══════════════════════════════════════════════════════════════
router.post(
  "/driver/onboarding/cdl/ocr",
  requireRole("driver"),
  upload.single('front_image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Missing front image for OCR." });
      }
      
      const extractedData = await extractCdlData(req.file.buffer);
      
      return res.json({ success: true, data: extractedData });
    } catch (error) {
      console.error("OCR Endpoint Error:", error);
      return res.status(500).json({ success: false, error: "OCR processing failed" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /driver/onboarding/cdl — Upload CDL and metadata
// ═══════════════════════════════════════════════════════════════
router.post(
  "/driver/onboarding/cdl",
  requireRole("driver"),
  upload.fields([{ name: 'front_image', maxCount: 1 }, { name: 'back_image', maxCount: 1 }]),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const orgId = req.user.organization_id;

      if (!orgId) return res.status(400).json({ success: false, error: "Missing organization_id." });

      const { license_number, state, license_class, endorsements, issue_date, expiry_date } = req.body;
      const frontFile = req.files['front_image']?.[0];
      const backFile = req.files['back_image']?.[0];

      if (!license_number || !state || !license_class || !issue_date || !expiry_date) {
         return res.status(400).json({ success: false, error: "Missing required license fields." });
      }

      if (!frontFile || !backFile) {
        return res.status(400).json({ success: false, error: "Missing front or back image files." });
      }

      // Upload to Supabase Storage
      const timestamp = Date.now();
      const frontPath = `${orgId}/${driverId}/cdl_front_${timestamp}`;
      const backPath = `${orgId}/${driverId}/cdl_back_${timestamp}`;

      const { error: frontUploadError } = await supabase.storage
        .from('driver-documents')
        .upload(frontPath, frontFile.buffer, { contentType: frontFile.mimetype });
      
      const { error: backUploadError } = await supabase.storage
        .from('driver-documents')
        .upload(backPath, backFile.buffer, { contentType: backFile.mimetype });

      if (frontUploadError || backUploadError) {
        throw new Error("Failed to upload images to storage.");
      }

      // Fetch driver internal ID
      const { data: driverRow, error: driverErr } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', driverId)
        .single();
        
      if (driverErr) throw driverErr;

      // Insert into driver_documents
      const { error: docError } = await supabase
        .from('driver_documents')
        .insert({
          driver_id: driverRow.id,
          organization_id: orgId,
          document_url: `${frontPath},${backPath}`,
          status: 'uploaded',
          metadata: {
            type: 'cdl',
            license_number,
            state,
            class: license_class,
            endorsements: endorsements || '',
            issue_date,
            front_path: frontPath,
            back_path: backPath
          },
          expires_at: expiry_date
        });

      if (docError) throw docError;

      // Update driver_onboarding_progress
      const { error: progError } = await supabase
        .from('driver_onboarding_progress')
        .update({ cdl_status: 'submitted' })
        .eq('driver_id', driverRow.id);

      if (progError) throw progError;

      return res.json({ success: true, message: "CDL uploaded successfully." });
    } catch (error) {
      console.error("CDL Upload Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /driver/onboarding/medical
// ═══════════════════════════════════════════════════════════════
router.post(
  "/driver/onboarding/medical",
  requireRole("driver"),
  upload.single('medical_card'),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const orgId = req.user.organization_id;
      const { type } = req.body; // 'upload' or 'electronic'

      // Fetch driver internal ID
      const { data: driverRow, error: driverErr } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', driverId)
        .single();
      if (driverErr) throw driverErr;

      let document_url = 'electronic_record_confirmed';
      if (type === 'upload') {
        if (!req.file) return res.status(400).json({ success: false, error: "Missing medical card image." });
        const path = `${orgId}/${driverId}/medical_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from('driver-documents')
          .upload(path, req.file.buffer, { contentType: req.file.mimetype });
        if (uploadError) throw uploadError;
        document_url = path;
      }

      // Record document
      await supabase.from('driver_documents').insert({
        driver_id: driverRow.id,
        organization_id: orgId,
        document_url,
        status: 'uploaded',
        metadata: { type: 'medical_qualification' }
      });

      // Update progress
      await supabase.from('driver_onboarding_progress').update({ medical_status: 'submitted' }).eq('driver_id', driverRow.id);

      return res.json({ success: true, message: "Medical qualification submitted." });
    } catch (error) {
      console.error("Medical Upload Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /driver/onboarding/consent
// ═══════════════════════════════════════════════════════════════
router.post(
  "/driver/onboarding/consent",
  requireRole("driver"),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const orgId = req.user.organization_id;
      const { stepId, signature } = req.body; // stepId: 'mvr', 'drug', 'clearinghouse'

      if (!signature) return res.status(400).json({ success: false, error: "Signature is required." });

      const { data: driverRow } = await supabase.from('drivers').select('id').eq('user_id', driverId).single();

      // Record consent document metadata (storing base64 signature functionally)
      // Note: ESIGN Act compliance requires third-party API integration for production.
      await supabase.from('driver_documents').insert({
        driver_id: driverRow.id,
        organization_id: orgId,
        document_url: 'digital_consent',
        status: 'uploaded',
        metadata: { 
          type: `${stepId}_consent`,
          signature_base64: signature,
          ip_address: req.ip,
          timestamp: new Date().toISOString()
        }
      });

      // Map stepId to database column
      const colMap = {
        'mvr': 'mvr_check_status',
        'drug': 'drug_screen_status',
        'clearinghouse': 'clearinghouse_status',
        'background': 'background_check_status'
      };
      
      const updateData = {};
      updateData[colMap[stepId]] = 'submitted';

      await supabase.from('driver_onboarding_progress').update(updateData).eq('driver_id', driverRow.id);

      return res.json({ success: true });
    } catch (error) {
      console.error("Consent Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// POST /driver/onboarding/employment-docs
// ═══════════════════════════════════════════════════════════════
router.post(
  "/driver/onboarding/employment-docs",
  requireRole("driver"),
  upload.fields([{ name: 'doc1', maxCount: 1 }, { name: 'doc2', maxCount: 1 }]),
  async (req, res) => {
    try {
      const driverId = req.user.id;
      const orgId = req.user.organization_id;

      const { data: driverRow } = await supabase.from('drivers').select('id, employee_type').eq('user_id', driverId).single();
      
      const doc1File = req.files['doc1']?.[0];
      const doc2File = req.files['doc2']?.[0];

      if (!doc1File) return res.status(400).json({ success: false, error: "Missing primary document." });

      const doc1Path = `${orgId}/${driverId}/emp_doc1_${Date.now()}`;
      const { error: upload1Err } = await supabase.storage.from('driver-documents').upload(doc1Path, doc1File.buffer, { contentType: doc1File.mimetype });
      if (upload1Err) throw upload1Err;
      
      let doc2Path = null;
      if (doc2File) {
        doc2Path = `${orgId}/${driverId}/emp_doc2_${Date.now()}`;
        const { error: upload2Err } = await supabase.storage.from('driver-documents').upload(doc2Path, doc2File.buffer, { contentType: doc2File.mimetype });
        if (upload2Err) throw upload2Err;
      }

      const { error: insertErr } = await supabase.from('driver_documents').insert({
        driver_id: driverRow.id,
        organization_id: orgId,
        document_url: doc2Path ? `${doc1Path},${doc2Path}` : doc1Path,
        status: 'uploaded',
        metadata: { type: 'employment_docs', employee_type: driverRow.employee_type }
      });
      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase.from('driver_onboarding_progress').update({ employment_docs_status: 'submitted' }).eq('driver_id', driverRow.id);
      if (updateErr) throw updateErr;

      return res.json({ success: true });
    } catch (error) {
      console.error("Employment Docs Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
