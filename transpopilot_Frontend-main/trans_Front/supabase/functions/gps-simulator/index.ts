import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "simulate";

    if (action === "simulate") {
      const result = await simulateGPSUpdates(supabase);
      return new Response(
        JSON.stringify(result),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else if (action === "single") {
      const vehicleId = url.searchParams.get("vehicle_id");
      if (!vehicleId) {
        return new Response(
          JSON.stringify({ error: "vehicle_id is required" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
      const result = await simulateSingleVehicle(supabase, vehicleId);
      return new Response(
        JSON.stringify(result),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in GPS simulator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

async function simulateGPSUpdates(supabase: any) {
  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("id, name, status, driver_id")
    .eq("status", "active");

  if (vehiclesError) {
    throw new Error(`Failed to fetch vehicles: ${vehiclesError.message}`);
  }

  if (!vehicles || vehicles.length === 0) {
    return { success: true, message: "No active vehicles to simulate", updated: 0 };
  }

  const locationUpdates = [];
  const driverLocationUpdates = [];

  for (const vehicle of vehicles) {
    const { data: lastLocation } = await supabase
      .from("vehicle_locations")
      .select("*")
      .eq("vehicle_id", vehicle.id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    let latitude, longitude, speed, heading;

    if (lastLocation) {
      const movement = generateRealisticMovement(
        parseFloat(lastLocation.latitude),
        parseFloat(lastLocation.longitude),
        parseFloat(lastLocation.heading) || 0
      );
      latitude = movement.latitude;
      longitude = movement.longitude;
      speed = movement.speed;
      heading = movement.heading;
    } else {
      const baseLocation = generateBaseLocation();
      latitude = baseLocation.latitude;
      longitude = baseLocation.longitude;
      speed = Math.random() * 60 + 10;
      heading = Math.random() * 360;
    }

    locationUpdates.push({
      vehicle_id: vehicle.id,
      latitude,
      longitude,
      speed,
      heading,
      altitude: 500 + Math.random() * 1000,
      odometer: Math.floor(Math.random() * 100000) + 50000,
      timestamp: new Date().toISOString(),
    });

    if (vehicle.driver_id) {
      const driverStatus = determineDriverStatus(speed);
      driverLocationUpdates.push({
        driver_id: vehicle.driver_id,
        latitude,
        longitude,
        status: driverStatus,
        timestamp: new Date().toISOString(),
      });
    }
  }

  const { error: locError } = await supabase
    .from("vehicle_locations")
    .insert(locationUpdates);

  if (locError) {
    throw new Error(`Failed to insert vehicle locations: ${locError.message}`);
  }

  if (driverLocationUpdates.length > 0) {
    const { error: driverError } = await supabase
      .from("driver_locations")
      .insert(driverLocationUpdates);

    if (driverError) {
      console.error("Failed to insert driver locations:", driverError);
    }
  }

  return {
    success: true,
    message: "GPS locations simulated successfully",
    vehicles_updated: locationUpdates.length,
    drivers_updated: driverLocationUpdates.length,
  };
}

async function simulateSingleVehicle(supabase: any, vehicleId: string) {
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, name, driver_id")
    .eq("id", vehicleId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    throw new Error("Vehicle not found");
  }

  const { data: lastLocation } = await supabase
    .from("vehicle_locations")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latitude, longitude, speed, heading;

  if (lastLocation) {
    const movement = generateRealisticMovement(
      parseFloat(lastLocation.latitude),
      parseFloat(lastLocation.longitude),
      parseFloat(lastLocation.heading) || 0
    );
    latitude = movement.latitude;
    longitude = movement.longitude;
    speed = movement.speed;
    heading = movement.heading;
  } else {
    const baseLocation = generateBaseLocation();
    latitude = baseLocation.latitude;
    longitude = baseLocation.longitude;
    speed = Math.random() * 60 + 10;
    heading = Math.random() * 360;
  }

  const newLocation = {
    vehicle_id: vehicleId,
    latitude,
    longitude,
    speed,
    heading,
    altitude: 500 + Math.random() * 1000,
    odometer: Math.floor(Math.random() * 100000) + 50000,
    timestamp: new Date().toISOString(),
  };

  const { error: locError } = await supabase
    .from("vehicle_locations")
    .insert(newLocation);

  if (locError) {
    throw new Error(`Failed to insert vehicle location: ${locError.message}`);
  }

  if (vehicle.driver_id) {
    const driverStatus = determineDriverStatus(speed);
    await supabase.from("driver_locations").insert({
      driver_id: vehicle.driver_id,
      latitude,
      longitude,
      status: driverStatus,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    success: true,
    message: "Vehicle location updated",
    location: newLocation,
  };
}

function generateBaseLocation() {
  const usaCities = [
    { name: "New York", lat: 40.7128, lng: -74.0060 },
    { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
    { name: "Chicago", lat: 41.8781, lng: -87.6298 },
    { name: "Houston", lat: 29.7604, lng: -95.3698 },
    { name: "Phoenix", lat: 33.4484, lng: -112.0740 },
    { name: "Dallas", lat: 32.7767, lng: -96.7970 },
    { name: "Atlanta", lat: 33.7490, lng: -84.3880 },
    { name: "Miami", lat: 25.7617, lng: -80.1918 },
  ];

  const city = usaCities[Math.floor(Math.random() * usaCities.length)];
  return {
    latitude: city.lat + (Math.random() - 0.5) * 0.5,
    longitude: city.lng + (Math.random() - 0.5) * 0.5,
  };
}

function generateRealisticMovement(
  currentLat: number,
  currentLng: number,
  currentHeading: number
) {
  const headingChange = (Math.random() - 0.5) * 30;
  const newHeading = (currentHeading + headingChange + 360) % 360;

  const distanceKm = (Math.random() * 0.5 + 0.1) / 60;
  const latChange = distanceKm * Math.cos((newHeading * Math.PI) / 180);
  const lngChange = distanceKm * Math.sin((newHeading * Math.PI) / 180);

  const newLat = currentLat + latChange;
  const newLng = currentLng + lngChange;

  const speedVariation = (Math.random() - 0.5) * 10;
  const baseSpeed = 45;
  const newSpeed = Math.max(0, Math.min(75, baseSpeed + speedVariation));

  return {
    latitude: newLat,
    longitude: newLng,
    speed: newSpeed,
    heading: newHeading,
  };
}

function determineDriverStatus(speed: number): string {
  if (speed < 1) {
    return Math.random() > 0.5 ? "break" : "active";
  } else if (speed < 5) {
    return "active";
  } else {
    return "driving";
  }
}
