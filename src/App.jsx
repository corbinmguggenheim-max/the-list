import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SearchBox } from "@mapbox/search-js-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";
import { supabase } from "./supabaseClient";

const appFont =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';

const starterPlaces = [
  {
    id: 1,
    name: "Employees Only",
    neighborhood: "West Village",
    type: "Cocktail Bar",
    status: "Visited",
    lngLat: [-74.0061, 40.7336],
    ratings: {
  Food: 8.7,
  Drinks: 9.6,
  Vibe: 9.8,
  Service: 8.2,
  Dateability: 9.7,
  Value: 8.1,
  Returnability: 9.9,
  Bathrooms: 8.9,
},
score: 9.14,
    notes: "Late-night speakeasy energy. Great date spot.",
  },
  {
    id: 2,
    name: "The Polo Bar",
    neighborhood: "Midtown East",
    type: "Restaurant",
    status: "Wishlist",
    lngLat: [-73.9738, 40.7615],
    ratings: {},
    score: null,
    notes: "Wishlist spot. Proper dressed-up dinner.",
  },
  {
    id: 3,
    name: "Overstory",
    neighborhood: "Financial District",
    type: "Cocktail Bar",
    status: "Visited",
    lngLat: [-74.0072, 40.7067],
    ratings: {
  Food: 7.8,
  Drinks: 9.9,
  Vibe: 9.7,
  Service: 9.4,
  Dateability: 9.5,
  Value: 8.4,
  Returnability: 9.8,
  Bathrooms: 9.1,
},
score: 9.42,
    notes: "Skyline views, polished drinks, impressive room.",
  },
];

const ratingCategories = [
  "Food",
  "Drinks",
  "Vibe",
  "Service",
  "Dateability",
  "Value",
  "Returnability",
  "Bathrooms",
];

function calculateScore(ratings) {
  const values = Object.values(ratings || {})
    .map(Number)
    .filter((value) => !Number.isNaN(value) && value > 0);

  if (values.length === 0) return null;

  const average =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Number(average.toFixed(1));
}

function normalizePlace(place) {
  return {
    ...place,
    lngLat: place.lngLat || place.lnglat,
    ratings: place.ratings || {},
    status: place.status || "Wishlist",
  };
}

function toSupabasePlace(place) {
  const { lngLat, lnglat, ...rest } = place;

  return {
    ...rest,
    lnglat: lnglat || lngLat,
  };
}

function App() {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  console.log("Token exists:", !!token);
  console.log("Token preview:", token?.substring(0, 10));
  const [mapStarted, setMapStarted] = useState(!!token);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [places, setPlaces] = useState([]);
  const [newName, setNewName] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newImage, setNewImage] = useState("");
  const [selectedMapboxPlace, setSelectedMapboxPlace] = useState(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const filteredPlaces = places.filter((place) => {
  const matchesSearch = place.name
    .toLowerCase()
    .includes(searchQuery.toLowerCase());

  const matchesFilter =
    activeFilter === "All" ||
    place.type === activeFilter ||
    (activeFilter === "Scored 9+" && place.score && place.score >= 9) ||
    (activeFilter === "Wishlist" && !place.score);

  return matchesSearch && matchesFilter;
});

  function startMap() {
    if (!token) return;

    localStorage.setItem("mapboxToken", token);

    mapboxgl.accessToken = token;

    mapRef.current = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: [-73.9851, 40.7589],
      zoom: 11.4,
    });

    mapRef.current.on("style.load", () => {
  const layers = mapRef.current.getStyle().layers;

  layers.forEach((layer) => {
    if (
      layer.type === "symbol" &&
      layer.layout &&
      layer.layout["text-field"]
    ) {
      mapRef.current.setLayoutProperty(
        layer.id,
        "visibility",
        "none"
      );
    }
  });
});

    mapRef.current.dragRotate.disable();
    mapRef.current.touchZoomRotate.disableRotation();

    mapRef.current.on("load", () => {
      setMapReady(true);
    });

    mapRef.current.on("click", () => {
      setSelectedPlace(null);
      setShowAddSpot(false);
});

      setMapStarted(true);
  }

  async function addSpot() {
  if (!newName || !newNeighborhood) return;

  const coordinates =
    selectedMapboxPlace?.geometry?.coordinates ||
    selectedMapboxPlace?.properties?.coordinates?.coordinates ||
    selectedMapboxPlace?.properties?.coordinates ||
    selectedMapboxPlace?.coordinates ||
    [-73.9851, 40.7589];

    console.log("Selected Mapbox Place:", selectedMapboxPlace);
    console.log("Coordinates being saved:", coordinates);

let uploadedImageUrl = "";

if (imageFile) {
  const fileExt = imageFile.name.split(".").pop();

  const fileName = `${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("place-images")
    .upload(fileName, imageFile);

  if (uploadError) {
    alert(uploadError.message);
    return;
  }

  const {
    data: { publicUrl },
  } = supabase.storage
    .from("place-images")
    .getPublicUrl(fileName);

  uploadedImageUrl = publicUrl;
  console.log("Uploaded image URL:", uploadedImageUrl);
}

  const newPlace = {
    name: selectedMapboxPlace?.properties?.name || newName,
    neighborhood:
      selectedMapboxPlace?.properties?.place_formatted || newNeighborhood,
    
    status: "Wishlist",
    
    type:
      selectedMapboxPlace?.properties?.feature_type === 
      "restaurant"
        ? "Restaurant"
        : "Cocktail Bar",

    lnglat: coordinates,

    score: null,

    notes: newNotes || "New spot added to THE LIST.",
    
    image: uploadedImageUrl,
    
    ratings: {
      Food: "",
      Drinks: "",
      Vibe: "",
      Service: "",
      Dateability: "",
      Value: "",
      Returnability: "",
      Bathrooms: "",
    },
  };

  async function savePlace() {
  const { data, error } = await supabase
    .from("places")
    .insert([toSupabasePlace(newPlace)])
    .select()
    .single();

  if (error) {
  console.error("Supabase insert error:", JSON.stringify(error, null, 2));
  alert(error.message);
  return;
}

 const savedPlace = normalizePlace(data);
 console.log("Supabase returned row:", data);
  console.log("Saved place:", savedPlace);

setPlaces([...places, savedPlace]);
setSelectedPlace(savedPlace);
}

savePlace();
  setNewName("");
  setNewNeighborhood("");
  setNewNotes("");
  setNewImage("");
  setShowAddSpot(false);
}

async function deleteSpot(placeToDelete) {
  setPlaces(
    places.filter(
      (place) => place.id !== placeToDelete.id
    )
  );

  setSelectedPlace(null);
  setConfirmDelete(false);

  const { error } = await supabase
    .from("places")
    .delete()
    .eq("id", placeToDelete.id);

  if (error) {
    console.error("Supabase delete error:", error);
    alert(error.message);
  }

  setSelectedPlace(null);
  setConfirmDelete(false);
}

async function updatePlace(updatedPlace) {
  setSelectedPlace(updatedPlace);
  setPlaces(
    places.map((place) =>
      place.id === updatedPlace.id ? updatedPlace : place
    )
  );

  const { error } = await supabase
    .from("places")
    .update(toSupabasePlace(updatedPlace))
    .eq("id", updatedPlace.id);

  if (error) {
    console.error("Supabase update error:", error);
    alert(error.message);
  }
}

function updateRating(category, value) {
  const numericValue = value;

  const updatedPlace = {
    ...selectedPlace,
    ratings: {
      ...(selectedPlace.ratings || {}),
      [category]: numericValue,
    },
  };

  updatedPlace.score = calculateScore(
  Object.fromEntries(
    Object.entries(updatedPlace.ratings).map(([key, val]) => [
      key,
      Number(val),
    ])
  )
);

updatePlace(updatedPlace);
}

const renderMarkers = useCallback(() => {
  if (!mapRef.current) return;

  markersRef.current.forEach((marker) => marker.remove());
  markersRef.current = [];

  filteredPlaces.forEach((place) => {
    const el = document.createElement("div");
el.style.width = "24px";
el.style.height = "36px";
el.style.cursor = "pointer";

const dot = document.createElement("div");
dot.style.width = "22px";
dot.style.height = "22px";
dot.style.borderRadius = "50%";
dot.style.background =
  place.status === "Wishlist"
    ? "white"
    : place.score && place.score >= 9
    ? "#C7A24B"
    : "#1E2E45";
dot.style.border = "4px solid white";
dot.style.boxShadow = "0 10px 28px rgba(0,0,0,0.25)";
dot.style.transition = "transform 0.18s ease";

el.addEventListener("mouseenter", () => {
  dot.style.transform = "scale(1.14)";
});

el.addEventListener("mouseleave", () => {
  dot.style.transform = "scale(1)";
});

const stem = document.createElement("div");
stem.style.width = "2px";
stem.style.height = "14px";
stem.style.background =
  place.status === "Wishlist"
    ? "#1E2E45"
    : place.score && place.score >= 9
    ? "#C7A24B"
    : "#1E2E45";
stem.style.margin = "0 auto";

el.appendChild(dot);
el.appendChild(stem);

const marker = new mapboxgl.Marker({
  element: el,
  anchor: "bottom",
})
  .setLngLat(place.lngLat)
  .addTo(mapRef.current);

 marker.getElement().addEventListener("click", (event) => {
  event.stopPropagation();

  setSelectedPlace(place);
  setConfirmDelete(false);
  setSearchQuery("");

  mapRef.current.flyTo({
    center: place.lngLat,
    zoom: 14.5,
    speed: 0.9,
    curve: 1.4,
    essential: true,
  });
});

    markersRef.current.push(marker);
  });
}, [filteredPlaces]);

useEffect(() => {
  if (token && mapStarted && !mapRef.current) {
    startMap();
  }
}, []);

useEffect(() => {
  localStorage.setItem("places", JSON.stringify(places));
}, [places]);

useEffect(() => {
  if (!mapReady) return;
  renderMarkers();
}, [mapReady, filteredPlaces, renderMarkers]);

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  return () => subscription.unsubscribe();
}, []);

useEffect(() => {
  function handleResize() {
    setIsMobile(isMobile);
    mapRef.current?.resize();
  }

  window.addEventListener("resize", handleResize);
  handleResize();

  return () => {
    window.removeEventListener("resize", handleResize);
  };
}, []);

useEffect(() => {
  async function loadPlaces() {
    const { data, error } = await supabase
      .from("places")
      .select("*");

    if (error) {
      console.error(error);
      return;
    }

    if (data && data.length > 0) {
      setPlaces(data.map(normalizePlace));
    } else {
      setPlaces(starterPlaces);
    }
  }

  loadPlaces();
}, []);

async function signUp() {
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    alert(error.message);
  } else {
    alert("Account created!");
  }
}

async function signIn() {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    alert("Please enter your email.");
    return;
  }

  const { data, error: allowError } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", cleanEmail)
    .single();

  if (allowError || !data) {
    alert("This email has not been approved for access.");
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      emailRedirectTo: "https://the-list-zeta.vercel.app",
    },
  });

  if (error) {
    alert(error.message);
  } else {
    alert("Check your email for your login link.");
  }
}
async function signOut() {
  await supabase.auth.signOut();
}

const menuButtonStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: "11px 12px",
  borderRadius: 12,
  textAlign: "left",
  cursor: "pointer",
  color: "#1E2E45",
  fontSize: 14,
  fontWeight: 500,
};

return (
  <div
    style={{
      height: "100vh",
      width: "100vw",
      position: "relative",
      overflow: "auto",
      fontFamily: appFont,
      background: "#F6F1E8",
    }}
  >
    {!session && (
  <div
    style={{
      position: "absolute",
      zIndex: 100,
      inset: 0,
      background: "rgba(246,241,232,0.96)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}
  >
    <div
      style={{
        width: 360,
        background: "white",
        padding: 28,
        borderRadius: 28,
        boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
      }}
    >
      <h1 style={{ color: "#1E2E45", marginTop: 0 }}>
        THE LIST
      </h1>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          boxSizing: "border-box",
}}
      />

      <button onClick={signIn} style={{ width: "100%", padding: 12 }}>
        Join The List
      </button>

    </div>
  </div>
)}

<div
  style={{
    position: "absolute",
    zIndex: 60,
    top: 0,
    left: 0,
    right: 0,
    height: isMobile ? 126 : 76,
    gridTemplateColumns: isMobile ? "1fr auto" : "220px 1fr 80px",
    gridTemplateRows: isMobile ? "auto auto" : "auto",
    alignItems: "center",
    gap: 16,
    padding: isMobile ? "14px 16px" : "14px 24px",
    background: "#FFFFFF",
    backdropFilter: "blur(18px)",
    borderBottom: "3px solid #000000",
  }}
>
  <div
    style={{
      fontFamily: "'Times New Roman', serif",
      fontWeight: 300,
      letterSpacing: -1,
      fontSize: isMobile ? 28 : 36,
      color: "#000000",
      letterSpacing: -0.8,
      whiteSpace: "nowrap",
    }}
  >
    The List
  </div>

  <div
  style={{
    display: "flex",
    justifyContent: "center",
    width: "100%",
    gridColumn: isMobile ? "1 / -1" : "auto",
    gridRow: isMobile ? 2 : "auto",
  }}
>
  <input
    placeholder="Search THE LIST"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    style={{
      width: isMobile ? "100%" : 600,
      maxWidth: "100%",
      padding: "12px 18px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.08)",
      background: "white",
      fontSize: 15,
      outline: "none",
    }}
  />
</div>

  <button
    onClick={() => setMenuOpen(!menuOpen)}
    style={{
      justifySelf: "end",
      background: "rgba(255,255,255,0.92)",
      color: "#1E2E45",
      border: "none",
      padding: "12px 16px",
      borderRadius: 999,
      cursor: "pointer",
      boxShadow:
        "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
      fontSize: 20,
      lineHeight: 1,
      backdropFilter: "blur(10px)",
    }}
  >
    ☰
  </button>
</div>

<p
  style={{
    position: "absolute",
    zIndex: 30,
    top: 78,
    left: 38,
    fontSize: 13,
    color: "#6B7280",
    margin: 0,
    letterSpacing: 0.4,
    background: "rgba(255,255,255,0.82)",
    padding: "4px 10px",
    borderRadius: 999,
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  }}
>
  {filteredPlaces.length} place
  {filteredPlaces.length !== 1 ? "s" : ""}
</p>

<div
  style={{
    position: "absolute",
    zIndex: 30,
    top: 112,
    left: 24,
    display: "flex",
    gap: 8,
    flexWrap: isMobile ? "nowrap" : "wrap",
    maxWidth: isMobile ? "calc(100vw - 32px)" : 420,
    overflowX: isMobile ? "auto" : "visible",
    paddingBottom: 4,
  }}
>
  {["All", "Restaurant", "Cocktail Bar", "Wishlist", "Scored 9+"].map(
    (filter) => (
      <button
        key={filter}
        onClick={() => setActiveFilter(filter)}
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border:
            activeFilter === filter
              ? "1px solid #1E2E45"
              : "1px solid rgba(0,0,0,0.08)",
          background:
            activeFilter === filter
              ? "#1E2E45"
              : "rgba(255,255,255,0.86)",
          color: activeFilter === filter ? "white" : "#1E2E45",
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        {filter}
      </button>
    )
  )}
</div>

<button
  onClick={() => setShowAddSpot(true)}
  onMouseEnter={(e) => {
    e.currentTarget.style.opacity = "0.92";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.opacity = "1";
  }}
  style={{
  position: "absolute",
  zIndex: 15,
  top: isMobile ? 88 : 24,
  right: isMobile ? 16 : 24,
  background: "#1E2E45",
  color: "white",
  border: "none",
  padding: "14px 22px",
  borderRadius: 999,
  cursor: "pointer",
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
  fontSize: 15,
  letterSpacing: 0.5,
  fontWeight: 500,
  backdropFilter: "blur(10px)",
}}
>
  + Add Spot
</button>

<button
  onClick={() => {
  if (!mapRef.current) {
    alert("Map is still loading.");
    return;
  }

  mapRef.current.flyTo({
    center: [-73.9851, 40.7589],
    zoom: 11.4,
    speed: 0.9,
    curve: 1.4,
    essential: true,
  });

  setSelectedPlace(null);
  setSearchQuery("");
  setActiveFilter("All");
}}
  style={{
    position: "absolute",
    zIndex: 15,
    top: isMobile ? 142 : 78,
    right: isMobile ? 16 : 24,
    background: "rgba(255,255,255,0.92)",
    color: "#1E2E45",
    border: "none",
    padding: "12px 18px",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
    fontSize: 14,
    letterSpacing: 0.4,
    backdropFilter: "blur(10px)",
  }}
>
  Reset View
</button>

{menuOpen && (
  <div
    style={{
      position: "absolute",
      zIndex: 50,
      top: isMobile ? 250 : 186,
      right: isMobile ? 16 : 24,
      width: 190,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(14px)",
      borderRadius: 20,
      padding: 10,
      boxShadow:
        "0 20px 60px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.08)",
      border: "1px solid rgba(15,23,42,0.06)",
    }}
  >
    <button
      onClick={() => {
        const data = JSON.stringify(places, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "the-list-backup.json";
        link.click();

        URL.revokeObjectURL(url);
        setMenuOpen(false);
      }}
      style={menuButtonStyle}
    >
      Export
    </button>

    <button
      onClick={() => {
        document.getElementById("import-backup-input").click();
        setMenuOpen(false);
      }}
      style={menuButtonStyle}
    >
      Import
    </button>

    <button
      onClick={signOut}
      style={{
        ...menuButtonStyle,
        color: "#D9534F",
      }}
    >
      Sign Out
    </button>
  </div>
)}

<button
  onClick={signOut}
  style={{
    position: "absolute",
    zIndex: 15,
    top: isMobile ? 304 : 240,
    right: isMobile ? 16 : 24,
    background: "rgba(255,255,255,0.92)",
    color: "#D9534F",
    border: "none",
    padding: "12px 18px",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
    fontSize: 14,
    letterSpacing: 0.4,
    backdropFilter: "blur(10px)",
  }}
>
  Sign Out
</button>

<button
  onClick={() => {
    const data = JSON.stringify(places, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "the-list-backup.json";
    link.click();

    URL.revokeObjectURL(url);
  }}
  style={{
    position: "absolute",
    zIndex: 15,
    top: isMobile ? 196 : 132,
    right: isMobile ? 16 : 24,
    background: "rgba(255,255,255,0.92)",
    color: "#1E2E45",
    border: "none",
    padding: "12px 18px",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
    fontSize: 14,
    letterSpacing: 0.4,
    backdropFilter: "blur(10px)",
  }}
>
  Export
</button>

<button
  onClick={() => {
    document.getElementById("import-backup-input").click();
  }}
  style={{
    position: "absolute",
    zIndex: 15,
    top: isMobile ? 250 : 186,
    right: isMobile ? 16 : 24,
    background: "rgba(255,255,255,0.92)",
    color: "#1E2E45",
    border: "none",
    padding: "12px 18px",
    borderRadius: 999,
    cursor: "pointer",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
    fontSize: 14,
    letterSpacing: 0.4,
    backdropFilter: "blur(10px)",
  }}
>
  Import
</button>

<input
  id="import-backup-input"
  type="file"
  accept=".json"
  style={{ display: "none" }}
  onChange={(event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const importedPlaces = JSON.parse(e.target.result);

        setPlaces(importedPlaces);
        localStorage.setItem(
          "places",
          JSON.stringify(importedPlaces)
        );

        alert("Backup imported successfully.");
      } catch {
        alert("Invalid backup file.");
      }
    };

    reader.readAsText(file);
  }}
/>

{showAddSpot && (
  <div
    style={{
      position: "absolute",
      zIndex: 25,
      top: isMobile ? 140 : 80,
      right: isMobile ? 16 : 20,
      width:
        isMobile
        ? "calc(100vw - 32px)"
        : 340,
      background: "white",
      padding: 24,
      borderRadius: 24,
      boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    }}
  >
    <h2 style={{ marginTop: 0, color: "#1E2E45" }}>
      Add Spot
    </h2>

    <SearchBox
  accessToken={token}
  options={{
    proximity: [-73.9851, 40.7589],
    types: "poi",
  }}
  placeholder="Search restaurant or bar"
  onRetrieve={(result) => {
    const feature = result.features?.[0] || result;
    setSelectedMapboxPlace(feature);
    setNewName(feature.properties.name || "");
    setNewNeighborhood(feature.properties.place_formatted || "");
  }}
/>

    <input
      placeholder="Neighborhood"
      value={newNeighborhood}
      onChange={(e) => setNewNeighborhood(e.target.value)}
      style={{
        width: "100%",
        padding: 12,
        marginBottom: 12,
        borderRadius: 10,
        border: "1px solid #ccc",
      }}
    />
    <textarea
        placeholder="Initial notes"
        value={newNotes}
        onChange={(e) => setNewNotes(e.target.value)}
        style={{
          width: "100%",
          minHeight: 90,
          padding: 12,
          marginBottom: 12,
          borderRadius: 16,
          border: "1px solid #ccc",
          resize: "vertical",
          outline: "none",
        }}
      />
      <input
  type="file"
  accept="image/*"
  onChange={(e) => {
    setImageFile(e.target.files[0]);
  }}
  style={{
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    border: "1px solid #ccc",
  }}
/>

    <button
      onClick={addSpot}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 10,
        border: "none",
        background: "#1E2E45",
        color: "white",
        cursor: "pointer",
      }}
    >
      Save Spot
    </button>
  </div>
)}
<AnimatePresence>
{selectedPlace && (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit= {{opacity: 0, y: 18, scale: 0.97 }}
     whileHover={{
      y: -2,
    }}
    transition={{ duration: 0.22, ease: "easeOut" }}
    style={{
      position: "absolute",
      zIndex: 20,
      left: isMobile ? 16 : "auto",
      right: isMobile ? 16 : 24,
      bottom: isMobile ? "auto" : 120,
      top: isMobile ? 16 : "auto",
      width: 
        isMobile 
          ? "calc(100vw - 32px)" 
          : 360,
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(18px)",
      border: "1px solid rgba(255,255,255,0.5)",
      padding: 24,
      borderRadius: 32,

      maxHeight:
        isMobile
          ? "70vh"
          : "85vh",

      overflowY: "auto",

      boxShadow:
        "0 20px 60px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.08)",
    }}
  >
    <button
      onClick={() => setSelectedPlace(null)}
      style={{
        float: "right",
        border: "none",
        background: "transparent",
        fontSize: 20,
        cursor: "pointer",
      }}
    >
      ×
    </button>

{selectedPlace.image && (
  <img
    src={selectedPlace.image}
    alt={selectedPlace.name}
    style={{
      width: "100%",
      height: 220,
      objectFit: "cover",
      borderRadius: 24,
      marginBottom: 18,
      boxShadow: "0 14px 40px rgba(0,0,0,0.14)",
    }}
  />
)}

    <input
  value={selectedPlace.name}
  onChange={(e) => {
    const updatedPlace = {
      ...selectedPlace,
      name: e.target.value,
    };

    updatePlace(updatedPlace);
  }}
  style={{
    width: "100%",
    fontSize: 32,
    fontWeight: 500,
    color: "#1E2E45",
    letterSpacing: -0.6,
    border: "none",
    background: "transparent",
    fontFamily: "Georgia, serif",
    outline: "none",
    marginBottom: 8,
    padding: 0,
  }}
/>

    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
  <input
    value={selectedPlace.neighborhood}
    onChange={(e) => {
      const updatedPlace = {
        ...selectedPlace,
        neighborhood: e.target.value,
      };

      updatePlace(updatedPlace);
    }}
    style={{
      flex: 1,
      border: "none",
      background: "rgba(0,0,0,0.04)",
      borderRadius: 999,
      padding: "8px 12px",
      outline: "none",
      color: "#6B7280",
    }}
  />

  <input
    value={selectedPlace.type}
    onChange={(e) => {
      const updatedPlace = {
        ...selectedPlace,
        type: e.target.value,
      };

      updatePlace(updatedPlace);
    }}
    style={{
      flex: 1,
      border: "none",
      background: "rgba(0,0,0,0.04)",
      borderRadius: 999,
      padding: "8px 12px",
      outline: "none",
      color: "#6B7280",
    }}
  />
</div>

<div style={{ marginBottom: 18 }}>
  <button
    onClick={() => {
      const updatedPlace = {
        ...selectedPlace,
        status:
          selectedPlace.status === "Visited"
            ? "Wishlist"
            : "Visited",
      };

      updatePlace(updatedPlace);
    }}
    style={{
      border: "none",
      borderRadius: 999,
      padding: "10px 16px",
      background:
        selectedPlace.status === "Visited"
          ? "#1E2E45"
          : "#C7A24B",
      color: "white",
      cursor: "pointer",
      fontWeight: 600,
      letterSpacing: 0.4,
      boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
    }}
  >
    {selectedPlace.status}
  </button>
</div>

    <h1
      style={{
        color: "#1E2E45",
        fontSize: 64,
        lineHeight: 1,
        letterSpacing: -2,
        fontWeight: 500,
        marginBottom: 12,
        marginBottom: 12,
        marginTop: 12,
        fontWeight: 300,
        letterSpacing: -1,
  }}
>
      {selectedPlace.score
  ? selectedPlace.score.toFixed(1)
  : "—"}
    </h1>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  }}
>
  {Object.entries(selectedPlace.ratings || {}).map(
    ([category, value]) => (
      <div
        key={category}
        style={{
          background: "rgba(15,23,42,0.035)",
          borderRadius: 20,
          border: "1px solid rgba(15,23,42,0.04)",
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 4,
          }}
        >
          {category}
        </div>

        <input
          value={value}
          onChange={(e) => 
            updateRating(category, e.target.value)
          }
          onFocus={(e) => {
           e.currentTarget.style.background =
            "rgba(15,23,42,0.05)";
          }}

onBlur={(e) => {
  e.currentTarget.style.background = "transparent";
}}
          inputMode="decimal"
          style={{
            width: "100%",
            fontSize: 18,
            color: "#1E2E45",
            fontWeight: 600,
            border: "none",
            background: "transparent",
            outline: "none",
            transition: "all 0.18s ease",
          }}
        />
      </div>
    )
  )}
</div>
    <textarea
  value={selectedPlace.notes}
  onChange={(e) => {
    const updatedPlace = {
      ...selectedPlace,
      notes: e.target.value,
    };

    updatePlace(updatedPlace);
  }}
  onFocus={(e) => {
  e.currentTarget.style.background =
    "rgba(15,23,42,0.05)";
}}

onBlur={(e) => {
  e.currentTarget.style.background =
    "rgba(15,23,42,0.035)";
}}
  style={{
    width: "100%",
    minHeight: 90,
    border: "none",
    background: "rgba(15,23,42,0.035)",
    borderRadius: 22,
    border: "1px solid rgba(15,23,42,0.04)",
    transition: "all 0.18s ease",
    padding: 12,
    resize: "vertical",
    outline: "none",
    fontSize: 15,
    lineHeight: 1.5,
    color: "#1F2937",
  }}
/>
    <button
  onClick={() => setConfirmDelete(true)}
  style={{
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #d9534f",
    background: "white",
    color: "#d9534f",
    cursor: "pointer",
    marginTop: 16,
  }}
>
  Delete Spot
</button>

{confirmDelete && (
  <div
    style={{
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      background: "rgba(217,83,79,0.08)",
      border: "1px solid rgba(217,83,79,0.25)",
    }}
  >
    <p style={{ marginTop: 0 }}>
      Are you sure you want to delete this spot?
    </p>

    <div style={{ display: "flex", gap: 8 }}>
  <button
    onClick={() => deleteSpot(selectedPlace)}
    style={{
      flex: 1,
      border: "none",
      borderRadius: 12,
      padding: "10px 12px",
      background: "#D9534F",
      color: "white",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Yes, delete
  </button>

  <button
    onClick={() => setConfirmDelete(false)}
    style={{
      flex: 1,
      border: "none",
      borderRadius: 12,
      padding: "10px 12px",
      background: "rgba(15,23,42,0.08)",
      color: "#1E2E45",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Cancel
  </button>
</div>
  </div>
)}

</motion.div>
  )}
</AnimatePresence>

      <div id="map" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

export default App;