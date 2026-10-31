import { supabase } from '../config/supabase.js';

export const getOperationsToday = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) {
      return res.status(400).json({ success: false, error: "Missing organization ID" });
    }

    // --- NEW CANONICAL STATE MACHINE ---
    const { count: vehiclesTotalCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId);
    const { count: vehiclesReadyCount } = await supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active');
    const { count: driversTotalCount } = await supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('organization_id', orgId);
    
    // Fetch ALL today's active/planned/completed routes
    const { data: allRoutes } = await supabase.from('routes')
      .select('id, name, estimated_distance, estimated_duration, driver_id, vehicle_id, status, completed_at, started_at, vehicle:vehicles(id, driver_id, vehicle_number), driver:drivers(id, user_id, first_name, last_name), waypoints:route_waypoints(id, status)')
      .eq('organization_id', orgId)
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      
    const todayRoutes = allRoutes || [];
    
    // 1. Identify routes that are already live
    const inProgressRoutes = todayRoutes.filter(r => r.status === 'in_progress' || r.status === 'dispatched');
    
    // 1b. Identify completed routes
    const completedRoutes = todayRoutes.filter(r => r.status === 'completed');
    
    // 2. Identify planned routes
    const plannedRoutes = todayRoutes.filter(r => r.status === 'planned');
    
    // Calculate 0/0 metrics consistently based on planned routes (what's left to do) + already dispatched routes
    const routesTotal = todayRoutes.length;
    
    // Assignments complete: any route (planned or live) that has a driver and vehicle
    const assignedRoutes = todayRoutes.filter(r => (r.driver_id || (r.vehicle && r.vehicle.driver_id)) && r.vehicle_id);
    const assignmentsComplete = assignedRoutes.length;
    const assignmentsTotal = routesTotal;
    
    // Pre-trips
    const { data: allInspections } = await supabase
      .from('pre_trip_inspections')
      .select('*')
      .in('route_id', assignedRoutes.map(r => r.id));
      
    let preTripComplete = 0;
    const preTripRequired = assignmentsTotal;
    
    let preTripBlocker = null;
    let dispatchableRoutes = [];
    
    if (allInspections) {
      assignedRoutes.forEach(r => {
        const insp = allInspections.filter(i => i.route_id === r.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
        r.preTripStatus = insp ? insp.status : 'not_started';
        
        if (r.preTripStatus === 'passed') {
          preTripComplete++;
          if (r.status === 'planned') {
            dispatchableRoutes.push({
              route_id: r.id,
              route_name: r.name,
              vehicle_id: r.vehicle_id,
              vehicle_name: r.vehicle?.vehicle_number,
              driver_id: r.driver_id || (r.vehicle && r.vehicle.driver_id),
              pre_trip_status: r.preTripStatus,
              distance: r.estimated_distance,
              duration: r.estimated_duration
            });
          }
        } else if (r.preTripStatus === 'failed') {
          preTripBlocker = {
            type: "pre_trip_failed",
            severity: "critical",
            route_id: r.id,
            vehicle_id: r.vehicle_id,
            driver_id: r.driver_id,
            title: "Vehicle failed pre-trip inspection",
            action: "Resolve Vehicle Issue"
          };
        }
      });
    }

    // Derive actual stage (PHASE 4)
    let stage = 'morning_setup';
    if (inProgressRoutes.length > 0) {
      stage = 'live_operations';
    } else if (dispatchableRoutes.length > 0) {
      stage = 'ready_for_dispatch';
    }

    let nextAction = null;
    let blockers = [];
    if (preTripBlocker) blockers.push(preTripBlocker);

    if (stage !== 'live_operations') {
      if (vehiclesTotalCount === 0) {
        nextAction = { type: "add_vehicles", title: "Add or Sync Vehicles", description: "Add or sync a vehicle before assigning drivers.", cta: "Sync Vehicles", target: "vehicles" };
      } else if (vehiclesReadyCount === 0) {
        nextAction = { type: "review_readiness", title: "Review Vehicle Readiness", description: "No vehicles are currently marked as active/ready.", cta: "Review Vehicles", target: "vehicles" };
      } else if (driversTotalCount === 0) {
        nextAction = { type: "add_drivers", title: "Resolve Driver Availability", description: "No drivers available for dispatch.", cta: "Add Drivers", target: "drivers" };
      } else if (routesTotal === 0) {
        nextAction = { type: "add_routes", title: "Create / Import Today's Routes", description: "No routes scheduled today.", cta: "Create Routes", target: "route-optimization" };
      } else if (assignmentsComplete < assignmentsTotal) {
        nextAction = { type: "complete_assignments", title: "Complete Vehicle Assignments", description: "Not all vehicles have drivers assigned.", cta: "Assign Drivers", target: "vehicles" };
      } else if (preTripRequired > preTripComplete) {
        nextAction = { type: "start_pretrip", title: "Start Pre-trip Inspection", description: "Pre-trip inspections are required before dispatch.", cta: "Start Pre-trip", target: "pre_trip" };
      } else if (preTripBlocker) {
        nextAction = { type: "resolve_blocker", title: preTripBlocker.title, description: "Action required before dispatch.", cta: preTripBlocker.action, target: "vehicles" };
      } else if (stage === 'ready_for_dispatch') {
        nextAction = { type: "dispatch_fleet", title: "Ready for Dispatch", description: "All required checks have been completed.", cta: "Dispatch Fleet", target: "dispatch" };
      }
    }

    return res.json({
      success: true,
      data: {
        stage,
        blockers,
        vehicles: { ready: vehiclesReadyCount || 0, total: vehiclesTotalCount || 0 },
        drivers: { available: driversTotalCount || 0, assigned: assignmentsComplete },
        routes: { scheduled: routesTotal, reviewed: 0 },
        assignments: { complete: assignmentsComplete, total: assignmentsTotal },
        preTrip: { complete: preTripComplete, required: preTripRequired },
        nextAction,
        readyRoutes: dispatchableRoutes, // Deprecated, use dispatchableRoutes
        dispatchableRoutes,
        completedRoutes,
        liveOperations: stage === "live_operations" ? { 
          activeVehicles: inProgressRoutes.length, 
          activeDrivers: inProgressRoutes.length, 
          onTimeRate: "100%", 
          lastUpdated: new Date().toISOString(),
          inProgressRoutes
        } : null
      }
    });
  } catch (error) {
    console.error("Operations Error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const dispatchFleet = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    if (!orgId) return res.status(400).json({ success: false, error: "Missing organization ID" });

    const { route_ids } = req.body || {};

    let query = supabase.from('routes').select('id, driver_id, vehicle_id, vehicle:vehicles(id, driver_id)').eq('organization_id', orgId).eq('status', 'planned');
    if (route_ids && Array.isArray(route_ids) && route_ids.length > 0) {
      query = query.in('id', route_ids);
    }
    
    const { data: routes } = await query;
    const assignedRoutes = routes ? routes.filter(r => (r.driver_id || (r.vehicle && r.vehicle.driver_id)) && r.vehicle_id) : [];
    
    if (routes && routes.length > 0 && assignedRoutes.length < routes.length) {
      return res.status(409).json({ success: false, code: "DRIVER_REQUIRED", message: "Assign a driver to all assigned vehicles before dispatch." });
    }

    if (assignedRoutes.length === 0) {
      return res.status(400).json({ success: false, code: "NO_ROUTES", message: "No eligible routes ready for dispatch." });
    }

    const dispatchable = [];
    for (let r of assignedRoutes) {
      const { data: inspection } = await supabase.from('pre_trip_inspections').select('status').eq('route_id', r.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inspection || inspection.status !== 'passed') {
        if (inspection?.status === 'failed') {
          return res.status(409).json({ success: false, code: "PRE_TRIP_FAILED", message: "Vehicle failed pre-trip inspection and cannot be dispatched." });
        }
        return res.status(409).json({ success: false, code: "PRE_TRIP_REQUIRED", message: "Pre-trip inspection must be completed before dispatch." });
      }
      dispatchable.push(r);
    }

    const dispatched = [];
    for (let r of dispatchable) {
      const resolvedDriverId = r.driver_id || r.vehicle.driver_id;
      const startedAt = new Date().toISOString();
      await supabase.from('routes').update({ status: 'in_progress', driver_id: resolvedDriverId, started_at: startedAt }).eq('id', r.id);
      dispatched.push({
        route_id: r.id,
        vehicle_id: r.vehicle_id,
        driver_id: resolvedDriverId,
        status: "in_progress",
        started_at: startedAt
      });
    }
    
    if (dispatched.length > 0) {
      await supabase.from('organizations').update({ operations_stage: 'live_operations' }).eq('id', orgId);
    }

    return res.json({ 
      success: true, 
      message: "Fleet dispatched successfully.",
      dispatched,
      stage: dispatched.length > 0 ? "live_operations" : undefined
    });
  } catch (error) {
    console.error("Dispatch Error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

export const startPreTrip = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const { route_id, vehicle_id, driver_id } = req.body;

    let resolvedDriverId = driver_id;
    if (!resolvedDriverId) {
      const { data: v } = await supabase.from('vehicles').select('driver_id').eq('id', vehicle_id).single();
      resolvedDriverId = v ? v.driver_id : null;
    }
    
    if (!resolvedDriverId) return res.status(400).json({ success: false, error: "No driver found for this vehicle." });

    const { data: existing } = await supabase.from('pre_trip_inspections').select('*').eq('route_id', route_id).eq('vehicle_id', vehicle_id).eq('driver_id', resolvedDriverId).maybeSingle();
    if (existing) return res.json({ success: true, data: existing });

    const { data, error } = await supabase.from('pre_trip_inspections').insert({
      organization_id: orgId, route_id, vehicle_id, driver_id: resolvedDriverId, status: 'in_progress', started_at: new Date().toISOString(), checklist: {}, failed_items: []
    }).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitPreTrip = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const { id, checklist, notes } = req.body;

    const failedItems = Object.entries(checklist).filter(([k, v]) => v !== 'pass').map(([k]) => k);
    const status = failedItems.length > 0 ? 'failed' : 'passed';

    const { data, error } = await supabase.from('pre_trip_inspections').update({
      checklist, notes, failed_items: failedItems, status, completed_at: new Date().toISOString()
    }).eq('id', id).eq('organization_id', orgId).select().single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDriverOperationsToday = async (req, res) => {
  try {
    const orgId = req.user?.organization_id;
    const userId = req.user?.id;
    
    if (!orgId || !userId) return res.status(400).json({ success: false, error: "Missing organization or user ID" });

    // 1. Get driver_id for this user
    const { data: driver, error: err1 } = await supabase.from('drivers').select('id, organization_id').eq('user_id', userId).maybeSingle();
    if (err1) return res.status(500).json({ success: false, code: "DB_QUERY_FAILED", message: err1.message, debug_step: "drivers_lookup" });
    if (!driver) return res.status(404).json({ success: false, code: "DRIVER_NOT_FOUND", message: "Driver profile not found.", debug_step: "drivers_lookup" });
    
    // 2. Find associated vehicle for this driver
    const { data: vehicle, error: err2 } = await supabase.from('vehicles').select('id, vehicle_number, vin').eq('driver_id', driver.id).eq('organization_id', orgId).maybeSingle();
    if (err2) return res.status(500).json({ success: false, code: "DB_QUERY_FAILED", message: err2.message, debug_step: "vehicles_lookup" });
    
    if (!vehicle) {
      return res.json({ success: true, data: { route: null }, debug_step: "no_vehicle_found" });
    }

    // 3. Find today's route assignment for this vehicle OR driver (driver_id might be set post-dispatch)
    const { data: route, error: err3 } = await supabase
      .from('routes')
      .select('id, name, vehicle_id, driver_id, status, estimated_distance, estimated_duration')
      .eq('organization_id', orgId)
      .eq('vehicle_id', vehicle.id)
      .in('status', ['planned', 'dispatched', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err3) return res.status(500).json({ success: false, code: "DB_QUERY_FAILED", message: err3.message, debug_step: "routes_lookup" });

    if (!route) {
      return res.json({ success: true, data: { route: null }, debug_step: "no_route_found" });
    }

    // 4. Get latest pre-trip inspection
    const { data: inspection, error: err4 } = await supabase
      .from('pre_trip_inspections')
      .select('*')
      .eq('route_id', route.id)
      .eq('driver_id', driver.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err4) return res.status(500).json({ success: false, code: "DB_QUERY_FAILED", message: err4.message, debug_step: "pretrip_lookup" });

    return res.json({
      success: true,
      data: {
        route: { ...route, vehicle },
        preTrip: inspection || null,
        driver_id: driver.id
      }
    });
  } catch (error) {
    console.error("getDriverOperationsToday Error:", error);
    res.status(500).json({ success: false, code: "SERVER_ERROR", message: error.message, debug_step: "catch_block" });
  }
};
