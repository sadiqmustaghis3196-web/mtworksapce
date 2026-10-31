import express from 'express';
import { attachSupabaseUser, requireRole } from '../services/rbac.js';
import { getMorningBrief } from '../services/fleetIntelligenceService.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI requests, please try again later.' }
});

router.use(attachSupabaseUser);
// Read-only for dashboard data
router.use(requireRole('super_admin', 'admin', 'fleet_manager'));

router.get('/morning-brief', aiRateLimiter, async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    if (!orgId) {
       return res.status(403).json({ error: 'User does not belong to an organization.' });
    }
    
    const brief = await getMorningBrief(orgId);
    return res.json(brief);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating morning brief.' });
  }
});

export default router;
