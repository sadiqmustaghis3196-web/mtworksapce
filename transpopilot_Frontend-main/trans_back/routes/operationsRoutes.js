import express from 'express';
import { getOperationsToday, dispatchFleet, startPreTrip, submitPreTrip, getDriverOperationsToday } from '../controllers/operationsController.js';
import { attachSupabaseUser } from '../services/rbac.js';

const router = express.Router();

router.get('/today', attachSupabaseUser, getOperationsToday);
router.post('/dispatch', attachSupabaseUser, dispatchFleet);
router.post('/pre-trip/start', attachSupabaseUser, startPreTrip);
router.patch('/pre-trip/submit', attachSupabaseUser, submitPreTrip);
router.get('/driver/today', attachSupabaseUser, getDriverOperationsToday);

export default router;
