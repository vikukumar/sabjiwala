// Customer/Home Delivery Location Marker (Blue)
export const createCustomerIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #3b82f6; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" width="18" height="18">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 11.2c-2.67 0-8 1.34-8 4v1.8h16v-1.8c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    className: "",
  });
};

// Store/Vendor Location Marker (Red)
export const createStoreIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #ef4444; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" width="18" height="18">
            <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    className: "",
  });
};

// Delivery Boy / Agent Marker (Orange)
export const createDeliveryAgentIcon = (L: any, vehicleType: string = "bike") => {
  let svgPath = "";
  
  if (vehicleType === "truck") {
    svgPath = '<rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>';
  } else if (vehicleType === "bicycle") {
    svgPath = '<circle cx="5.5" cy="17.5" r="2.5"></circle><circle cx="18.5" cy="17.5" r="2.5"></circle><path d="M15 5h1M12 17.5V14l-3-3 4-3 2 3h2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>';
  } else if (vehicleType === "scooty") {
    svgPath = '<circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="M6 18h4l2-5h5l1.5 2.5h1.5l1-2.5v-2h-3l-1.5-3H13v2.5l-2 2.5H8l-2-5H3v2h2l1 5.5z"></path>';
  } else {
    // Default bike
    svgPath = '<circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="18" r="3"></circle><path d="M6 18h4.5l2-6h4l1.5 6H21v-2l-2-4h-4.5L12 8H8L6 18z"></path>';
  }

  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background-color: #f97316; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${vehicleType === 'bicycle' ? 'none' : '#ffffff'}" stroke="#ffffff" stroke-width="1.5" width="22" height="22">
            ${svgPath}
          </svg>
        </div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    className: "",
  });
};

// Generic Pin Icon for Location Selection (Indigo)
export const createLocationPinIcon = (L: any) => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">
        <div style="position: absolute; width: 32px; height: 32px; background: linear-gradient(135deg, #6366f1 0%, #9333ea 100%); border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; z-index: 10;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "",
  });
};
