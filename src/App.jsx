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

    categories:
      place.categories?.length
        ? place.categories
        : place.type
        ? [place.type]
        : [],
  };
}

function toSupabasePlace(place) {
  const { lngLat, lnglat, ...rest } = place;

  return {
    ...rest,
    lnglat: lnglat || lngLat,
  };
}

function formatUserName(email) {
  const userNames = {
    "raventechct@gmail.com": "Corbin Guggenheim",
    "corbin.m.guggenheim@gmail.com": "Corbin Guggenheim",
    "britni.kiosse@gmail.com": "Britni Kiosse"
  };

  if (!email) return "Unknown";

  return userNames[email.toLowerCase()] || email;
}

const experienceCategories = [
  "Rooftop",
  "Dinner",
  "Brunch",
  "Floral",
  "Theme",
  "Pop-Up",
  "Dive Bar",
  "Sports Bar",
  "Late Night",
];

const adminUsers = [
  "raventechct@gmail.com",
  "corbin.m.guggenheim@gmail.com",
];

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
  const hasSetDefaultFilter = useRef(false);
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [newCategories, setNewCategories] = useState(["Dinner"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeViewFilter, setActiveViewFilter] = useState("My Spots");
  const [activeCategoryFilters, setActiveCategoryFilters] = useState([]);
  const activeFilter = activeViewFilter;
  const setActiveFilter = setActiveViewFilter;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [session, setSession] = useState(null);
  const isAdmin = adminUsers.includes(
  session?.user?.email?.toLowerCase()
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [milestoneMessage, setMilestoneMessage] = useState(null);

  const filteredPlaces = places.filter((place) => {
  const matchesSearch = place.name
    .toLowerCase()
    .includes(searchQuery.toLowerCase());

  const addedBy = place.created_by?.toLowerCase();

const matchesViewFilter =
  activeViewFilter === "All" ||
  (
    activeViewFilter === "My Spots" &&
    place.owner_email?.toLowerCase() ===
      session?.user?.email?.toLowerCase()
  ) ||
  (
    activeViewFilter === "Added by Corbin" &&
    [
      "raventechct@gmail.com",
      "corbin.m.guggenheim@gmail.com",
    ].includes(addedBy)
  ) ||
  (
    activeViewFilter === "Added by Britni" &&
    addedBy === "britni.kiosse@gmail.com"
  );

const matchesCategoryFilters =
  activeCategoryFilters.length === 0 ||
  activeCategoryFilters.every((category) =>
  place.categories?.includes(category)
  );

const matchesFilter =
  matchesViewFilter && matchesCategoryFilters;
  

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

  function toggleNewCategory(category) {
  setNewCategories((currentCategories) =>
    currentCategories.includes(category)
      ? currentCategories.filter((item) => item !== category)
      : [...currentCategories, category]
  );
}
function toggleCategoryFilter(category) {
  setActiveCategoryFilters((currentFilters) =>
    currentFilters.includes(category)
      ? currentFilters.filter((item) => item !== category)
      : [...currentFilters, category]
  );
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
    created_by: session?.user?.email,
    owner_email: session?.user?.email,
    
    type: newCategories[0] || "",
    categories: newCategories,

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

const userEmail = session?.user?.email?.toLowerCase();

const userSpotCount =
  places.filter(
    (place) => place.created_by?.toLowerCase() === userEmail
  ).length + 1;

if (userSpotCount === 1) {
  setMilestoneMessage({
    title: "🎉 Britni! Your first spot! 🎉",
    lines: [
      "You did it!!!",
      "Buckle up, hold onto your shorts, and go find some spots!",
      "These are for you 🏆💐",
    ],
  });
}

if (userSpotCount === 5) {
  setMilestoneMessage({
    title: "🎉 Five spots! 🎉",
    lines: [
      "Look at you, you little animal...",
      "Ok no more trophies after this one 🏆",
    ],
  });
}

if (userSpotCount === 10) {
  setMilestoneMessage({
    title: "🎉 Ten spots! 🎉",
    lines: [
      "I said no more trophies.",
      "I DIDN'T SAY NO MORE FLOWERS 💐💐💐",
    ],
  });
}
}

savePlace();
  setNewName("");
  setNewNeighborhood("");
  setNewCategories(["Dinner"]);
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
  if (!session?.user?.email) {
    hasSetDefaultFilter.current = false;
    return;
  }

  if (hasSetDefaultFilter.current) return;

  setActiveFilter(isAdmin ? "All" : "My Spots");

  hasSetDefaultFilter.current = true;
}, [session?.user?.email, isAdmin]);

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
    height: isMobile ? 132 : 76,
    display: "grid",
    gridTemplateColumns: isMobile ? "48px 1fr 48px" : "220px 1fr 80px",
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
      gridColumn: isMobile ? 2 : "auto",
      gridRow: 1,
      textAlign: isMobile ? "center" : "left",
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
    onClick={() => {
      setMenuOpen((current) => !current);
      setFiltersOpen(false);
    }}
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
      gridColumn: isMobile ? 3 : "auto",
      gridRow: 1,
      justifySelf: "end",
    }}
  >
    ☰
  </button>
</div>


{!selectedPlace && !showAddSpot && (
  <div
    style={{
      position: "absolute",
      zIndex: 30,
      top: isMobile ? 148 : 112,
      left: 24,
    }}
  >
    <button
      onClick={() => {
        setFiltersOpen((current) => !current);
        setMenuOpen(false);
      }}
      style={{
        padding: "10px 16px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(255,255,255,0.94)",
        color: "#1E2E45",
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      Filters
    </button>

  {filtersOpen && (
  <>
    <div
      onClick={() => setFiltersOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 29,
        background: "transparent",
        cursor: "default",
      }}
    />

    <div
        style={{
          position: "relative",
          zIndex: 31,
          marginTop: 10,
          width: 190,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(14px)",
          borderRadius: 18,
          padding: 8,
          boxShadow:
            "0 20px 60px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.08)",
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
      {[
  { label: `All (${places.length})`, value: "All" },
  ...experienceCategories.map((category) => ({
    label: category,
    value: category,
  })),
  { label: "Added by Corbin", value: "Added by Corbin" },
  { label: "Added by Britni", value: "Added by Britni" },
  { label: "My Spots", value: "My Spots" },
].map((filter) => {
  const isCategory = experienceCategories.includes(filter.value);

  const isSelected = isCategory
    ? activeCategoryFilters.includes(filter.value)
    : activeViewFilter === filter.value;

  return (
    <button
      key={filter.value}
      onClick={() => {
        if (isCategory) {
          toggleCategoryFilter(filter.value);
        } else {
          setActiveViewFilter(filter.value);
        }
      }}
      style={{
        width: "100%",
        border: "none",
        background: isSelected
          ? "rgba(30,46,69,0.10)"
          : "transparent",
        padding: "10px 12px",
        borderRadius: 12,
        textAlign: "left",
        cursor: "pointer",
        color: "#1E2E45",
        fontSize: 14,
        fontWeight: isSelected ? 600 : 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{filter.label}</span>
      {isSelected && <span>✓</span>}
    </button>
  );
})}
      </div>
      </>
    )}
  </div>
)}

{milestoneMessage && (
  <div
    style={{
      position: "absolute",
      zIndex: 300,
      inset: 0,
      background: "rgba(0,0,0,0.28)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 360,
        background: "white",
        borderRadius: 28,
        padding: 28,
        textAlign: "center",
        boxShadow: "0 24px 80px rgba(0,0,0,0.24)",
      }}
    >
      <h2 style={{ marginTop: 0, color: "#1E2E45" }}>
        {milestoneMessage.title}
      </h2>

      {milestoneMessage.lines.map((line) => (
        <p
          key={line}
          style={{
            fontSize: 16,
            color: "#1E2E45",
            lineHeight: 1.45,
            margin: "10px 0",
          }}
        >
          {line}
        </p>
      ))}

      <button
        onClick={() => setMilestoneMessage(null)}
        style={{
          marginTop: 16,
          border: "none",
          borderRadius: 999,
          padding: "12px 20px",
          background: "#1E2E45",
          color: "white",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Let's F*ckin GO!!!
      </button>
    </div>
  </div>
)}

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
  top: isMobile ? 148 : 24,
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
    top: isMobile ? 202 : 78,
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
   <>
    <div
      onClick={() => setMenuOpen(false)}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "transparent",
      }}
    />

  <div
    style={{
      position: "absolute",
      zIndex: 200,
      top: isMobile ? 64 : 76,
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
  onClick={() => {
    alert("Feature request form coming soon.");
    setMenuOpen(false);
  }}
  style={menuButtonStyle}
>
  Request Feature
</button>

<div
  style={{
    height: 1,
    background: "rgba(0,0,0,0.12)",
    margin: "10px 0",
  }}
/>

<button
  onClick={() => {
    signOut();
    setMenuOpen(false);
  }}
  style={{
    ...menuButtonStyle,
    color: "#D9534F",
  }}
>
  Sign Out
</button>
  </div>
  </>
)}

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

    <div style={{ marginBottom: 16 }}>
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
</div>

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

<div style={{ marginBottom: 12 }}>
  <div
    style={{
      marginBottom: 8,
      fontSize: 14,
      fontWeight: 600,
      color: "#1E2E45",
    }}
  >
    Categories
  </div>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    }}
  >
    {experienceCategories.map((category) => {
      const isSelected = newCategories.includes(category);

      return (
        <button
          key={category}
          type="button"
          onPointerDown={(e) => {
          e.preventDefault();
          toggleNewCategory(category);
          }}
          style={{
            border: isSelected
              ? "1px solid #1E2E45"
              : "1px solid rgba(0,0,0,0.14)",
            borderRadius: 999,
            padding: "8px 12px",
            background: isSelected ? "#1E2E45" : "white",
            color: isSelected ? "white" : "#1E2E45",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            touchAction: "manipulation",
            userSelect: "none",
          }}
        >
          {category}
        </button>
      );
    })}
  </div>
</div>

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
      top: isMobile ? 148 : 120,
      bottom: "auto",
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

    <input
  id="replace-place-image-input"
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedPlace) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("place-images")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("place-images")
      .getPublicUrl(fileName);

    const updatedPlace = {
      ...selectedPlace,
      image: publicUrlData.publicUrl,
    };

    updatePlace(updatedPlace);
  }}
/>

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

   <textarea
  value={selectedPlace.name}
  onChange={(e) => {
    const updatedPlace = {
      ...selectedPlace,
      name: e.target.value,
    };

    updatePlace(updatedPlace);
  }}
  rows={2}
  style={{
    width: "100%",
    border: "none",
    outline: "none",
    resize: "none",
    overflow: "hidden",
    fontSize: isMobile ? 24 : 30,
    lineHeight: 1.1,
    fontWeight: 600,
    color: "#1E2E45",
    marginBottom: 4,
    background: "transparent",
    fontFamily: "Georgia, serif",
  }}
/>


<p
  style={{
    margin: "8px 0 12px",
    fontSize: 13,
    color: "#6B7280",
    letterSpacing: 0.3,
  }}
>
  Added by {formatUserName(selectedPlace.created_by)}
</p>

<button
  onClick={() =>
    document.getElementById("replace-place-image-input").click()
  }
  style={{
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 999,
    padding: "9px 14px",
    background: "white",
    color: "#1E2E45",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 12,
  }}
>
  + Add Photo
</button>


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
</div>

<div style={{ marginBottom: 16 }}>
  <div
    style={{
      marginBottom: 8,
      fontSize: 13,
      fontWeight: 600,
      color: "#1E2E45",
    }}
  >
    Categories
  </div>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    }}
  >
    {experienceCategories.map((category) => {
      const selectedCategories =
        selectedPlace.categories?.length
          ? selectedPlace.categories
          : selectedPlace.type
          ? [selectedPlace.type]
          : [];

      const isSelected = selectedCategories.includes(category);

      return (
        <button
          key={category}
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();

            const updatedCategories = isSelected
              ? selectedCategories.filter(
                  (item) => item !== category
                )
              : [...selectedCategories, category];

            const updatedPlace = {
              ...selectedPlace,
              categories: updatedCategories,
              type: updatedCategories[0] || "",
            };

            updatePlace(updatedPlace);
          }}
          style={{
            border: isSelected
              ? "1px solid #1E2E45"
              : "1px solid rgba(0,0,0,0.14)",
            borderRadius: 999,
            padding: "8px 12px",
            background: isSelected ? "#1E2E45" : "white",
            color: isSelected ? "white" : "#1E2E45",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            touchAction: "manipulation",
            userSelect: "none",
          }}
        >
          {isSelected ? `✓ ${category}` : category}
        </button>
      );
    })}
  </div>
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