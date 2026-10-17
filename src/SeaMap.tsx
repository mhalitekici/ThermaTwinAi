import { useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  Rectangle,
  TileLayer,
  useMapEvents,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { Crosshair, Layers, MapPin } from "lucide-react";
import type { Snapshot } from "./lib";
import { temp } from "./lib";
import "leaflet/dist/leaflet.css";
import { useApp } from "./context";

const center: LatLngExpression = [36.08, 33.59];
const bounds: LatLngBoundsExpression = [
  [35.95, 33.4],
  [36.15, 33.7],
];
function SelectPoint({ onSelect }: { onSelect: (value: string) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onSelect(
        lat >= 35.95 && lat <= 36.15 && lng >= 33.4 && lng <= 33.7
          ? "Akkuyu izleme alanı seçildi."
          : "MVP yalnızca çerçeve içindeki Akkuyu bölgesini destekliyor.",
      );
    },
  });
  return null;
}
function CenterControl() {
  const map = useMap();
  return (
    <button
      className="map-center"
      aria-label="Haritayı Akkuyu bölgesine ortala"
      onClick={() => map.setView(center, 10)}
    >
      <Crosshair size={17} />
    </button>
  );
}
export default function SeaMap({
  snapshot,
  large = false,
}: {
  snapshot: Snapshot | null;
  large?: boolean;
}) {
  const { theme } = useApp();
  const [layer, setLayer] = useState<"map" | "satellite">("map");
  const [tileError, setTileError] = useState(false);
  const [selection, setSelection] = useState(
    "Çerçeve içindeki deniz alanına tıklayarak bölgeyi seç.",
  );
  const point: LatLngExpression =
    snapshot?.source.latitude != null
      ? [snapshot.source.latitude, snapshot.source.longitude!]
      : [36.05, 33.55];
  return (
    <div className={`sea-map ${large ? "large" : ""}`}>
      <MapContainer
        className={
          layer === "map" && theme === "dark" ? "base-map dark-map" : "base-map"
        }
        center={center}
        zoom={10}
        minZoom={6}
        maxZoom={15}
        scrollWheelZoom={false}
        aria-label="Akkuyu ve Akdeniz etkileşimli haritası"
      >
        {layer === "map" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        ) : (
          <TileLayer
            attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
        )}
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: "#007f91",
            weight: 2,
            dashArray: "5 5",
            fillOpacity: 0.08,
          }}
        >
          <Popup>
            Akkuyu MVP izleme bölgesi
            <br />
            Bölgesel SST alanı; termal plume katmanı değildir.
          </Popup>
        </Rectangle>
        <CircleMarker
          center={[36.143, 33.541]}
          radius={5}
          pathOptions={{
            color: "#c7d9e4",
            fillColor: "#c7d9e4",
            fillOpacity: 1,
          }}
        >
          <Popup>Akkuyu kıyısı · konum referansı</Popup>
        </CircleMarker>
        {snapshot && (
          <CircleMarker
            center={point}
            radius={10}
            pathOptions={{
              color: "#49e2c5",
              fillColor: "#49e2c5",
              fillOpacity: 0.4,
              weight: 2,
            }}
          >
            <Popup>
              {snapshot.source.provider}
              <br />
              {temp(snapshot.observation.sst_c)} °C · {snapshot.origin_date}
              <br />
              {snapshot.source.resolution}
            </Popup>
          </CircleMarker>
        )}
        <SelectPoint onSelect={setSelection} />
        <CenterControl />
      </MapContainer>
      <div className="map-label">
        <span className="pulse-dot" /> AKKUYU · MERSİN{" "}
        <span className="map-coords">36.05° N / 33.55° E</span>
      </div>
      <button
        className="map-layer"
        title="Harita katmanını değiştir"
        onClick={() => {
          setLayer(layer === "map" ? "satellite" : "map");
          setTileError(false);
        }}
      >
        <Layers size={16} />
        {layer === "map" ? "Uydu görünümü" : "Temel harita"}
      </button>
      <div className="map-legend">
        <Crosshair size={14} /> Kesikli alan: izleme bölgesi <span />
        <MapPin size={14} /> Nokta: veri konumu
      </div>
      {tileError && (
        <div className="map-error" role="status">
          Temel harita yüklenemedi. İnternet bağlantısını kontrol edin; analiz
          bölgesi ve gerçek veri özeti korunur.
        </div>
      )}
      {large && (
        <div className="map-selection" role="status">
          {selection}
        </div>
      )}
    </div>
  );
}
