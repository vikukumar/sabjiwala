// Customer/Home Delivery Location Marker
export const createCustomerIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; position: relative;">
        🏠
        <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; z-index: 3;"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "bg-transparent border-none shadow-none",
  });
};

// Store/Vendor Location Marker
export const createStoreIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; position: relative;">
        🏪
        <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #ef4444; border-radius: 50%; z-index: 3;"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "bg-transparent border-none shadow-none",
  });
};

// Delivery Boy / Agent Marker
export const createDeliveryAgentIcon = (L: any, vehicleType: string = "bike", heading: number = 0) => {
  let vehicleEmoji = "🛵";
  if (vehicleType === "bicycle") vehicleEmoji = "🚲";
  else if (vehicleType === "truck") vehicleEmoji = "🚚";

  return L.divIcon({
    html: `
      <div style="
        font-size: 28px; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; position: relative;
        transform: rotate(${heading}deg);
        transition: transform 0.3s ease;
      ">
        ${vehicleEmoji}
        <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #f97316; border-radius: 50%;; z-index: 3;"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "bg-transparent border-none shadow-none",
  });
};

// Generic Pin Icon for Location Selection
export const createLocationPinIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="font-size: 32px; line-height: 1; text-shadow: 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; transform: translateY(-10px);">
        📍
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    className: "bg-transparent border-none shadow-none",
  });
};

// Live GPS Location Marker (Pulsating Dot fallback to static)
export const createGPSLocationIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; justify-content: center; align-items: center;">
        <div style="width: 16px; height: 16px; background-color: #2563eb; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: "bg-transparent border-none shadow-none",
  });
};
